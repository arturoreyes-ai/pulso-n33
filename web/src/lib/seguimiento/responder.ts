import type { DocRoster } from "@/lib/datos/tipos";
import { hayBaseDeDatos } from "@/lib/acceso/bd";
import { leerDatoPublicado, type LeerDatos } from "@/lib/datos/publicado";
import { nombraFigura } from "@/lib/busqueda/figura";
import { SIN_CACHE, json } from "@/lib/busqueda/respuesta";
import {
  ActorProhibido,
  ErrorApify,
  TERMINADAS,
  abortarCorrida,
  borrarDataset,
  estadoCorrida,
  iniciarCorrida,
  itemsDe,
  type Corrida,
} from "@/lib/redes-en-vivo/apify";
import { tokenApify } from "@/lib/redes-en-vivo/config";
import { servicioTono, type ServicioTono } from "@/lib/tono/servicio";
import { almacenNeon, RECLAMO_VENCE_MS, type Almacen, type Corridas, type FilaActualizacion, type FilaSeguimiento } from "./almacen";
import {
  MINUTOS_ENTRE_ACTUALIZACIONES,
  RETENCION_DIAS,
  TOPE_DIARIO_POR_PERSONA,
  TOPE_MENSUAL_USD,
  ZONA_HORARIA,
  seguimientoHabilitado,
} from "./config";
import type {
  Actualizacion,
  CodigoErrorSeguimiento,
  ErrorSeguimiento,
  IdiomaSeguido,
  PublicacionSeguida,
  RespuestaListaSeguimiento,
  RespuestaSeguimiento,
  TonoComentario,
} from "./contrato";
import {
  TOPES,
  contarTono,
  entradaComentarios,
  entradaPublicacion,
  esTono,
  leerComentarios,
  leerPublicacion,
  publicacionDeUrl,
  topeDe,
} from "./cosecha";

/**
 * /api/seguimiento: seguir UNA publicacion de Instagram, TikTok o Facebook y
 * volver a leerla cuando alguien pulsa «Actualizar».
 *
 * Lo pidio el cliente el 28 de septiembre de 2026: una pagina para dar
 * seguimiento a una publicacion —ver sus comentarios mas recientes y el tono
 * general de lo que se comenta— con varias actualizaciones a lo largo del
 * tiempo. Y decidio cuatro cosas que este archivo sostiene: que cada
 * actualizacion se paga al pulsar un boton y nunca sola, que el tope es
 * PROPIO y no el de la busqueda en vivo, que la lista es del equipo y no de
 * cada persona, y que el texto se borra a los 15 dias o antes, con un boton.
 *
 * Es la busqueda en vivo con la URL ya dada, y por eso cabe en el mismo
 * molde: POST arranca, cada GET mira si las corridas terminaron y la primera
 * que las encuentra terminadas gana el derecho a guardar. La diferencia es
 * donde queda el resultado. Alla se vuelve a leer de Apify en cada pregunta;
 * aqui se guarda limpio en la base —sin identidad, con las menciones
 * enmascaradas— y el conjunto crudo se BORRA de Apify en cuanto se guardo,
 * porque traia nombre, usuario y foto de quien comento.
 *
 * El navegador nunca elige actor ni entrada: manda una URL, y solo una que
 * `canonizarPublicacion` reconoce.
 */

export interface DependenciasSeguimiento {
  almacen?: Almacen;
  tono?: ServicioTono;
  leer?: LeerDatos;
  usuario?: () => Promise<{ id: number }>;
  entorno?: NodeJS.ProcessEnv;
  ahora?: () => Date;
  solicitar?: typeof fetch;
  hayBase?: () => boolean;
}

async function usuarioDeSesion(): Promise<{ id: number }> {
  const { requerirUsuario } = await import("@/lib/acceso/sesion");
  return requerirUsuario();
}

function dependencias(d: DependenciasSeguimiento) {
  const entorno = d.entorno ?? process.env;
  return {
    entorno,
    almacen: d.almacen ?? almacenNeon,
    tono: d.tono ?? servicioTono(entorno),
    leer: d.leer ?? leerDatoPublicado,
    usuario: d.usuario ?? usuarioDeSesion,
    ahora: d.ahora ?? (() => new Date()),
    solicitar: d.solicitar ?? fetch,
    hayBase: d.hayBase ?? hayBaseDeDatos,
  };
}

type Deps = ReturnType<typeof dependencias>;

// Los mensajes dicen QUE pasa, nunca como: ni Apify, ni el libro, ni el tope
// en dolares (AGENTS.md, «The UI says what, never how»).
const MENSAJES: Record<CodigoErrorSeguimiento, string> = {
  apagado: "El seguimiento de publicaciones no está disponible por ahora.",
  url: "Pega el enlace completo de una publicación de Instagram, TikTok o Facebook.",
  no_existe: "Esa publicación ya no está en seguimiento.",
  limite_dia: "Llegaste al límite de actualizaciones de hoy.",
  limite_mes: "Las actualizaciones no están disponibles por ahora.",
  reciente: "Se actualizó hace poco. Vuelve a intentarlo en unos minutos.",
  no_disponible: "La publicación no respondió. Vuelve a intentarlo más tarde.",
};

const ESTADO: Record<CodigoErrorSeguimiento, number> = {
  apagado: 400, url: 400, no_existe: 404, limite_dia: 429, limite_mes: 429, reciente: 409, no_disponible: 503,
};

const error = (codigo: CodigoErrorSeguimiento) =>
  json({ codigo, mensaje: MENSAJES[codigo] } satisfies ErrorSeguimiento, ESTADO[codigo], SIN_CACHE);

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const esIdSeguimiento = (s: string | null | undefined): s is string => typeof s === "string" && ID.test(s);

async function sesion(d: Deps): Promise<{ id: number } | Response> {
  try {
    return await d.usuario();
  } catch (e) {
    const estado = (e as { estado?: unknown }).estado;
    return json({ detalle: e instanceof Error ? e.message : "Sin sesión" }, typeof estado === "number" ? estado : 401, SIN_CACHE);
  }
}

/** El texto vencido se borra en cada visita, ademas del cron diario: si nadie
 *  abre la pagina el cron lo hace, y si el cron no corre lo hace la visita. */
async function purgarSinFallar(d: Deps): Promise<void> {
  try {
    await d.almacen.purgar(RETENCION_DIAS);
  } catch {
    // Una purga fallida no tumba la lectura; la lectura misma ya filtra por
    // la retencion, asi que nada vencido llega a la pantalla.
  }
}

// ---------------------------------------------------------------- arrancar

/** Arranca las dos corridas de una lectura recien reservada. */
async function arrancar(seg: FilaSeguimiento, act: FilaActualizacion, d: Deps): Promise<boolean> {
  const token = tokenApify(d.entorno);
  d.tono.calentar();
  const pedidos = [entradaPublicacion(seg.red, seg.url), entradaComentarios(seg.red, seg.url)] as const;
  const topes = [TOPES[seg.red].publicacion, TOPES[seg.red].comentarios] as const;
  const arranques = await Promise.allSettled(pedidos.map((p, i) => iniciarCorrida(p.actor, p.entrada, topes[i]!, token, d.solicitar)));
  const prohibido = arranques.find((a) => a.status === "rejected" && a.reason instanceof ActorProhibido);
  if (prohibido !== undefined) throw (prohibido as PromiseRejectedResult).reason;
  const pasada = (a: PromiseSettledResult<Corrida>) => (a.status === "fulfilled" ? { id: a.value.id, dataset: a.value.dataset, usd: null } : null);
  const corridas: Corridas = { publicacion: pasada(arranques[0]!), comentarios: pasada(arranques[1]!) };
  if (corridas.publicacion === null && corridas.comentarios === null) {
    await d.almacen.fallar(act.id, act.gastoId, 0);
    return false;
  }
  await d.almacen.guardarCorridas(act.id, corridas);
  return true;
}

type Inicio = { ok: true; id: string } | { ok: false; codigo: CodigoErrorSeguimiento; fecha?: string };

async function iniciar(seg: FilaSeguimiento, usuario: { id: number }, d: Deps): Promise<Inicio> {
  const reserva = await d.almacen.reservar({
    seguimientoId: seg.id,
    usuarioId: usuario.id,
    topeUsd: topeDe(seg.red),
    topeMensual: TOPE_MENSUAL_USD,
    topeDiario: TOPE_DIARIO_POR_PERSONA,
    minutos: MINUTOS_ENTRE_ACTUALIZACIONES,
    zona: ZONA_HORARIA,
  });
  if (!reserva.ok) {
    if (reserva.motivo === "reciente") return { ok: false, codigo: "reciente", fecha: reserva.fecha };
    return { ok: false, codigo: reserva.motivo === "dia" ? "limite_dia" : reserva.motivo === "mes" ? "limite_mes" : "no_existe" };
  }
  // Otra persona ya pulso: se ve su lectura y no se paga otra.
  if (reserva.enCurso) return { ok: true, id: reserva.actualizacion.id };
  return (await arrancar(seg, reserva.actualizacion, d))
    ? { ok: true, id: reserva.actualizacion.id }
    : { ok: false, codigo: "no_disponible" };
}

// ---------------------------------------------------------------- avanzar

async function borrarConjuntos(corridas: Corridas, d: Deps): Promise<void> {
  const token = tokenApify(d.entorno);
  const conjuntos = [corridas.publicacion?.dataset, corridas.comentarios?.dataset].filter((x): x is string => typeof x === "string");
  await Promise.all(conjuntos.map((c) => borrarDataset(c, token, d.solicitar)));
}

/**
 * Lleva una lectura abierta tan lejos como se pueda en esta peticion: si sus
 * corridas terminaron, la reclama, lee, limpia, etiqueta y guarda. Si no,
 * no hace nada y la siguiente pregunta vuelve a mirar.
 */
async function avanzar(seg: FilaSeguimiento, act: FilaActualizacion, d: Deps, roster: DocRoster | null): Promise<void> {
  if (act.estado === "listo" || act.estado === "fallo") return;
  const ahora = d.ahora();
  const edad = ahora.getTime() - Date.parse(act.creado);
  const { publicacion: pub, comentarios: com } = act.corridas;
  if (!pub && !com) {
    // La peticion que reservo murio antes de arrancar las corridas.
    if (edad > RECLAMO_VENCE_MS) await d.almacen.fallar(act.id, act.gastoId, 0);
    return;
  }
  if (act.estado === "guardando" && act.reclamada !== null && ahora.getTime() - Date.parse(act.reclamada) < RECLAMO_VENCE_MS) return;

  const token = tokenApify(d.entorno);
  let estados: (Corrida | null)[];
  try {
    estados = await Promise.all([pub, com].map((p) => (p ? estadoCorrida(p.id, token, d.solicitar) : Promise.resolve(null))));
  } catch (e) {
    if (!(e instanceof ErrorApify)) throw e;
    // Apify no contesta por las corridas de una lectura de hace mas de un
    // dia: no va a contestar. Se cierra con lo reservado, que es el peor caso.
    if (edad > 86_400_000) await d.almacen.fallar(act.id, act.gastoId, act.topeUsd);
    return;
  }
  if (estados.some((e) => e !== null && !TERMINADAS.has(e.estado))) return;
  if (!(await d.almacen.reclamar(act.id, ahora.toISOString()))) return;

  const usd = estados.reduce((n, e) => n + (e?.usd ?? 0), 0);
  try {
    const [itemsPub, itemsCom] = await Promise.all([
      pub && estados[0]?.estado === "SUCCEEDED" ? itemsDe(pub.dataset, 5, token, d.solicitar) : Promise.resolve([]),
      com && estados[1]?.estado === "SUCCEEDED" ? itemsDe(com.dataset, TOPES[seg.red].comentarios.items * 2, token, d.solicitar) : Promise.resolve([]),
    ]);
    const publicacion = itemsPub.map((i) => leerPublicacion(seg.red, i)).find((x) => x !== null) ?? null;
    const comentarios = leerComentarios(seg.red, itemsCom, seg.url);
    if (publicacion === null && comentarios.length === 0) {
      // Borrada, privada o caida: no hay nada que guardar y se dice «no se
      // pudo leer», nunca «cero comentarios».
      await d.almacen.fallar(act.id, act.gastoId, usd);
      await borrarConjuntos(act.corridas, d);
      return;
    }

    // Regla 5: con una figura del roster en el titulo no se pide tono. Sin
    // roster legible, tampoco: no se puede comprobar.
    const titulo = publicacion?.titulo || seg.titulo || "";
    const figura = roster === null || nombraFigura(titulo, roster);
    const conocidas = await d.almacen.conocidas(seg.id, comentarios.map((c) => c.huella));
    const etiquetas = new Map<string, TonoComentario | null>();
    if (!figura && seg.idioma === "es") {
      // Solo lo que no tiene etiqueta todavia: lo ya leido conserva la suya.
      const faltan = comentarios.filter((c) => (conocidas.get(c.huella) ?? null) === null);
      const r = faltan.length === 0 ? [] : await d.tono.etiquetar(faltan.map((c) => c.crudo), "comentarios", "es");
      faltan.forEach((c, i) => { const e = r?.[i]; etiquetas.set(c.huella, esTono(e) ? e : null); });
    }
    const filas = comentarios.map((c) => ({
      huella: c.huella,
      texto: c.texto,
      likes: c.likes,
      escrito: c.escrito,
      sentimiento: figura || seg.idioma !== "es" ? null : etiquetas.get(c.huella) ?? conocidas.get(c.huella) ?? null,
    }));
    await d.almacen.guardar({
      actualizacion: act,
      publicacion,
      metricas: publicacion?.metricas ?? null,
      comentarios: filas,
      nuevos: filas.filter((f) => !conocidas.has(f.huella)).length,
      tono: figura ? null : contarTono(filas.map((f) => f.sentimiento)),
      usd,
    });
  } catch (e) {
    if (e instanceof ErrorApify) {
      await d.almacen.fallar(act.id, act.gastoId, usd);
      await borrarConjuntos(act.corridas, d);
      return;
    }
    throw e;
  }
  await borrarConjuntos(act.corridas, d);
}

// ---------------------------------------------------------------- piezas

const publicacionDe = (s: FilaSeguimiento): PublicacionSeguida => ({
  id: s.id, red: s.red, url: s.url, idioma: s.idioma, titulo: s.titulo, creador: s.creador,
  publicado: s.publicado, tipo: s.tipo, creado: s.creado,
});

const abierta = (a: FilaActualizacion) => a.estado === "leyendo" || a.estado === "guardando";

function actualizacionDe(a: FilaActualizacion, figura: boolean): Actualizacion {
  return {
    id: a.id,
    fecha: a.creado,
    estado: abierta(a) ? "leyendo" : a.estado === "listo" ? "listo" : "fallo",
    metricas: a.metricas,
    leidos: a.leidos,
    nuevos: a.nuevos,
    tono: figura ? null : a.tono,
  };
}

/** Pulsar dentro de la media hora de la ultima lectura no arranca nada. */
function proximaDe(ultima: FilaActualizacion | undefined, ahora: Date): string | null {
  if (ultima === undefined) return null;
  const desde = Date.parse(ultima.creado) + MINUTOS_ENTRE_ACTUALIZACIONES * 60_000;
  return desde > ahora.getTime() ? new Date(desde).toISOString() : null;
}

async function leerRoster(d: Deps): Promise<DocRoster | null> {
  return (await d.leer("roster.json")) as DocRoster | null;
}

// ---------------------------------------------------------------- rutas

/** GET /api/seguimiento: la lista del equipo. */
export async function responderLista(deps: DependenciasSeguimiento = {}): Promise<Response> {
  const d = dependencias(deps);
  const disponible = seguimientoHabilitado(d.entorno);
  if (!d.hayBase()) return json({ disponible: false, publicaciones: [] } satisfies RespuestaListaSeguimiento, 200, SIN_CACHE);
  await purgarSinFallar(d);
  const filas = await d.almacen.listar(RETENCION_DIAS);
  const cuerpo: RespuestaListaSeguimiento = {
    disponible,
    publicaciones: filas.map((f) => ({ ...publicacionDe(f), ultima: f.ultima, enCurso: f.enCurso, comentarios: f.comentarios })),
  };
  return json(cuerpo, 200, SIN_CACHE);
}

/** POST /api/seguimiento con `{ url, idioma }`: agrega y arranca la primera
 *  lectura. Es POST porque cuesta, como la busqueda en vivo. */
export async function responderAgregar(cuerpo: unknown, deps: DependenciasSeguimiento = {}): Promise<Response> {
  const d = dependencias(deps);
  if (!seguimientoHabilitado(d.entorno)) return error("apagado");
  const datos = typeof cuerpo === "object" && cuerpo !== null ? (cuerpo as { url?: unknown; idioma?: unknown }) : {};
  const publicacion = typeof datos.url === "string" ? publicacionDeUrl(datos.url) : null;
  if (publicacion === null) return error("url");
  const idioma: IdiomaSeguido = datos.idioma === "en" ? "en" : "es";
  const usuario = await sesion(d);
  if (usuario instanceof Response) return usuario;

  const { fila, nueva } = await d.almacen.agregar({ ...publicacion, idioma, usuarioId: usuario.id });
  const inicio = await iniciar(fila, usuario, d);
  // Agregada queda aunque la primera lectura no arranque (el tope del dia, un
  // fallo de la red): la ficha lo dice y el boton sigue ahi.
  return json({ id: fila.id, nueva, lectura: inicio.ok ? "leyendo" : inicio.codigo }, nueva ? 201 : 200, SIN_CACHE);
}

/** GET /api/seguimiento/[id]: la ficha, y de paso avanza la lectura abierta. */
export async function responderFicha(id: string, deps: DependenciasSeguimiento = {}): Promise<Response> {
  const d = dependencias(deps);
  if (!esIdSeguimiento(id)) return error("no_existe");
  if (!d.hayBase()) return error("apagado");
  await purgarSinFallar(d);
  const seg = await d.almacen.leer(id);
  if (seg === null) return error("no_existe");

  const roster = await leerRoster(d);
  let acts = await d.almacen.actualizaciones(id, 60);
  const abiertas = acts.filter(abierta);
  if (abiertas.length > 0 && tokenApify(d.entorno) !== "") {
    for (const a of abiertas) await avanzar(seg, a, d, roster);
    acts = await d.almacen.actualizaciones(id, 60);
  }
  // La publicacion pudo estrenar titulo en esta misma peticion.
  const actual = (await d.almacen.leer(id)) ?? seg;
  const figura = roster === null || nombraFigura(actual.titulo ?? "", roster);
  const { filas, conteo } = await d.almacen.comentarios(id, RETENCION_DIAS, 500);
  // «Nuevo» es lo que trajo la ultima lectura y no estaba antes. En la
  // primera lectura todo seria nuevo, y marcarlo todo no dice nada.
  const listas = acts.filter((a) => a.estado === "listo");
  const ultima = listas[0];
  const marcarNuevos = listas.length > 1 && ultima !== undefined;
  const cuerpo: RespuestaSeguimiento = {
    disponible: seguimientoHabilitado(d.entorno),
    publicacion: publicacionDe(actual),
    enCurso: acts.some(abierta),
    actualizaciones: acts.map((a) => actualizacionDe(a, figura)),
    comentarios: filas.map((c) => ({
      huella: c.huella,
      texto: c.texto,
      escrito: c.escrito,
      nuevo: marcarNuevos && Date.parse(c.primeraVez) >= Date.parse(ultima.creado),
      sentimiento: figura ? null : c.sentimiento,
    })),
    tono: { mostrado: !figura, conteo },
    retencionDias: RETENCION_DIAS,
    proxima: proximaDe(ultima, d.ahora()),
  };
  return json(cuerpo, 200, SIN_CACHE);
}

/** POST /api/seguimiento/[id]: una lectura nueva. */
export async function responderActualizar(id: string, deps: DependenciasSeguimiento = {}): Promise<Response> {
  const d = dependencias(deps);
  if (!seguimientoHabilitado(d.entorno)) return error("apagado");
  if (!esIdSeguimiento(id)) return error("no_existe");
  const usuario = await sesion(d);
  if (usuario instanceof Response) return usuario;
  const seg = await d.almacen.leer(id);
  if (seg === null) return error("no_existe");
  const inicio = await iniciar(seg, usuario, d);
  if (!inicio.ok) {
    return json({ codigo: inicio.codigo, mensaje: MENSAJES[inicio.codigo], ...(inicio.fecha === undefined ? {} : { fecha: inicio.fecha }) }, ESTADO[inicio.codigo], SIN_CACHE);
  }
  return json({ id: inicio.id }, 202, SIN_CACHE);
}

/**
 * DELETE /api/seguimiento/[id]: deja de seguirla y borra para siempre su
 * historia y su texto. Lo que el cliente pidio como «borrado anticipado»: no
 * espera los 15 dias.
 *
 * El gasto se queda (vive en su tabla), y una lectura que seguia corriendo se
 * detiene en Apify y se cierra con lo que alcanzo a cobrar; si Apify no dice
 * cuanto, con lo reservado.
 */
export async function responderBorrar(id: string, deps: DependenciasSeguimiento = {}): Promise<Response> {
  const d = dependencias(deps);
  if (!esIdSeguimiento(id)) return error("no_existe");
  if (!d.hayBase()) return error("apagado");
  const usuario = await sesion(d);
  if (usuario instanceof Response) return usuario;
  const borrado = await d.almacen.borrar(id);
  if (borrado === null) return error("no_existe");
  const token = tokenApify(d.entorno);
  for (const a of borrado.abiertas) {
    const pasadas = [a.corridas.publicacion, a.corridas.comentarios].filter((p): p is NonNullable<typeof p> => !!p);
    let usd = 0;
    let sabido = true;
    for (const p of pasadas) {
      // La que ya termino dice lo que cobro; la que sigue viva se detiene.
      const estado = token === "" ? null : await estadoCorrida(p.id, token, d.solicitar).catch(() => null);
      const corrida = estado !== null && !TERMINADAS.has(estado.estado) ? await abortarCorrida(p.id, token, d.solicitar) : estado;
      if (corrida === null || corrida.usd === null) sabido = false;
      else usd += corrida.usd;
    }
    await d.almacen.cerrarGasto(a.gastoId, sabido ? usd : a.topeUsd);
    if (token !== "") await borrarConjuntos(a.corridas, d);
  }
  return json({ borrado: true }, 200, SIN_CACHE);
}

/** GET /api/seguimiento/purgar, desde el cron diario de Vercel. */
export async function responderPurga(autorizacion: string | null, deps: DependenciasSeguimiento = {}): Promise<Response> {
  const d = dependencias(deps);
  const secreto = (d.entorno.CRON_SECRET ?? "").trim();
  // Sin secreto configurado la ruta no abre nunca: es publica (el cron no
  // trae sesion) y lo unico que la protege es esto.
  if (secreto === "" || autorizacion !== `Bearer ${secreto}`) {
    return json({ detalle: "No autorizado" }, 401, SIN_CACHE);
  }
  if (!d.hayBase()) return json({ borrados: 0 }, 200, SIN_CACHE);
  return json({ borrados: await d.almacen.purgar(RETENCION_DIAS) }, 200, SIN_CACHE);
}
