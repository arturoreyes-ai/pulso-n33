import type { ComentarioPublicado, DestacadoConsulta, DocRedesComentarios, DocRoster, SaludConsulta } from "@/lib/datos/tipos";
import { leerDatoPublicado, type LeerDatos } from "@/lib/datos/publicado";
import { nombraFigura } from "@/lib/busqueda/figura";
import { SIN_CACHE, json } from "@/lib/busqueda/respuesta";
import { validarConsulta } from "@/lib/busqueda/validar";
import type { PiezasTermino, TonoPie } from "@/lib/dominio/termino-vivo";
import { servicioTono, type ServicioTono } from "@/lib/tono/servicio";
import {
  ACTORES,
  ActorProhibido,
  ErrorApify,
  TERMINADAS,
  estadoCorrida,
  iniciarCorrida,
  itemsDe,
  type Actor,
  type Tope,
} from "./apify";
import {
  REUSO_HORAS,
  TOPE_DIARIO_POR_PERSONA,
  TOPE_MENSUAL_USD,
  ZONA_HORARIA,
  redesEnVivoHabilitadas,
  tokenApify,
} from "./config";
import {
  REDES_PAGADAS,
  claveDe,
  esIdBusqueda,
  libroNeon,
  type CorridaRed,
  type FilaBusqueda,
  type Libro,
  type Red,
} from "./libro";
import {
  COMENTARIOS_MAXIMO,
  COMENTARIOS_VISIBLES,
  esOpinion,
  brigadas,
  etiquetaDe,
  limpiarComentario,
  limpiarPostFacebook,
  limpiarPostInstagram,
  limpiarVideoTiktok,
  nombraEnPie,
  publicarComentarios,
  type ComentarioLimpio,
  type Descarte,
  type Publicacion,
} from "./limpiar";

/**
 * /api/redes-en-vivo: la busqueda PAGADA de un termino en TikTok, Instagram y
 * Facebook, detras de un boton.
 *
 * El 23 de septiembre de 2026 el cliente pidio que la lupa trajera
 * publicaciones y comentarios de cualquier termino, y decidio tres cosas que
 * este archivo sostiene: que se paga solo cuando alguien pulsa (un boton por
 * busqueda, como Analizar), que hay topes —50 USD al mes encima de la cosecha
 * programada y diez busquedas por persona al dia— y que Facebook entra por su
 * busqueda por palabra aunque el proveedor la haga con cuentas propias. Las
 * tres estan en docs/PLAN.md.
 *
 * Invierte, a sabiendas, la decision del 18 de septiembre de 2026 («nunca una
 * busqueda en vivo pagada desde el navegador»). Lo que se conserva de ella:
 * el navegador nunca elige actor ni entrada —manda un termino—, y el gasto lo
 * decide el servidor contra el libro, no la pagina.
 *
 * DOS PASADAS, como pulso/consultas.py, y sin estado en la funcion:
 *
 *  1. POST arranca las tres busquedas y vuelve con un id.
 *  2. Cada GET mira las corridas. Cuando la busqueda de una red termina, se
 *     queda con las publicaciones que NOMBRAN el termino —la leccion del
 *     sondeo del 18 de septiembre: TikTok devolvio 3 de 3 videos ajenos para
 *     cada termino del cliente— y arranca la de comentarios de las diez de mas
 *     alcance. Solo las que pasan el filtro se pagan dos veces.
 *
 * Nada se guarda de nuestro lado: cada GET vuelve a leer los conjuntos de
 * datos de Apify, que es donde ya vive lo que devuelve la cosecha programada,
 * y arma la respuesta de nuevo. La identidad de quien comenta se tira en
 * limpiar.ts antes de salir de la funcion, y la respuesta es `no-store`.
 */

/**
 * Lo que cada pasada puede costar como mucho. La suma es lo que se reserva en
 * el libro al pulsar: el peor caso, no el esperado.
 *
 * Precios leidos de la ficha de cada actor el 23 de septiembre de 2026, en el
 * nivel Silver de la cuenta: TikTok 0.0023 USD por video (mas 0.0008 por
 * filtro) y 0.00075 por comentario; Instagram 0.0019 por resultado; Facebook
 * 0.0025 por resultado de busqueda y 0.0017 por comentario. Con diez
 * comentarios en cada una de diez publicaciones por red, una busqueda completa
 * sale en unos 0.60 USD. La sonda pagada de ese dia, con «Vive la Baja», costo
 * 0.095 USD en 43 s: pocas publicaciones con comentarios.
 *
 * El tope de la busqueda de TikTok NO es su costo: el actor declara
 * `minimalMaxTotalChargeUsd: 0.5` y rechaza con 400 cualquier corrida con un
 * tope menor. Con 0.10 la sonda de TikTok no arranco. Cobra lo que produce
 * (~0.06 USD por 20 videos); el tope solo acota.
 */
export const TOPES: Record<Red, { posts: Tope; comentarios: Tope }> = {
  tiktok: { posts: { usd: 0.5, items: 20, segundos: 180 }, comentarios: { usd: 0.6, items: 110, segundos: 240 } },
  instagram: { posts: { usd: 0.15, items: 20, segundos: 180 }, comentarios: { usd: 0.4, items: 110, segundos: 240 } },
  facebook: { posts: { usd: 0.1, items: 20, segundos: 180 }, comentarios: { usd: 0.25, items: 110, segundos: 240 } },
};

export const TOPE_POR_BUSQUEDA = REDES_PAGADAS.reduce((n, red) => n + TOPES[red].posts.usd + TOPES[red].comentarios.usd, 0);

/** La ventana de las redes, igual a la retencion del texto. */
export const VENTANA_DIAS = 30;
/** Cuantas publicaciones por red pasan a la segunda pasada. */
export const PUBLICACIONES_POR_RED = 10;
export const COMENTARIOS_POR_PUBLICACION = 10;
/** Una segunda pasada reclamada que no dejo corrida en este tiempo: la
 *  peticion que la reclamo murio. Se suelta sin comentarios. */
const RECLAMO_VENCE_MS = 90_000;

export type EstadoRed = "sin_iniciar" | "buscando" | "comentarios" | "listo" | "fallo";

export interface RespuestaRedesEnVivo {
  id: string;
  estado: "buscando" | "listo" | "fallo";
  redes: Record<Red, EstadoRed>;
  piezas: PiezasTermino;
  textos: DocRedesComentarios;
}

export interface ErrorRedesEnVivo {
  codigo: "apagado" | "vacia" | "larga" | "invalida" | "limite_dia" | "limite_mes" | "busqueda" | "no_disponible";
  mensaje: string;
}

export interface DependenciasRedesEnVivo {
  solicitar?: typeof fetch;
  libro?: Libro;
  tono?: ServicioTono;
  leer?: LeerDatos;
  usuario?: () => Promise<{ id: number }>;
  entorno?: NodeJS.ProcessEnv;
  ahora?: () => Date;
}

const error = (codigo: ErrorRedesEnVivo["codigo"], mensaje: string, estado: number) =>
  json({ codigo, mensaje } satisfies ErrorRedesEnVivo, estado, SIN_CACHE);

// Los mensajes dicen QUE pasa, nunca como: ni Apify, ni el libro, ni el tope
// en dolares (AGENTS.md, «The UI says what, never how»).
const APAGADO = "La búsqueda en redes no está disponible por ahora.";
const LIMITE_DIA = "Llegaste al límite de búsquedas en redes de hoy.";
const LIMITE_MES = "La búsqueda en redes no está disponible por ahora.";
const NO_DISPONIBLE = "La búsqueda en redes no está disponible por ahora.";

async function usuarioDeSesion(): Promise<{ id: number }> {
  const { requerirUsuario } = await import("@/lib/acceso/sesion");
  return requerirUsuario();
}

function dependencias(d: DependenciasRedesEnVivo) {
  const entorno = d.entorno ?? process.env;
  return {
    entorno,
    solicitar: d.solicitar ?? fetch,
    libro: d.libro ?? libroNeon,
    tono: d.tono ?? servicioTono(entorno),
    leer: d.leer ?? leerDatoPublicado,
    usuario: d.usuario ?? usuarioDeSesion,
    ahora: d.ahora ?? (() => new Date()),
  };
}

function hace(ahora: Date, dias: number): string {
  return new Date(ahora.getTime() - dias * 86_400_000).toISOString().slice(0, 10);
}

/** La entrada de la primera pasada de cada red. Ninguna trae sesion. */
export function entradaPosts(red: Red, termino: string, ahora: Date): { actor: Actor; entrada: Record<string, unknown> } | null {
  if (red === "tiktok") {
    return {
      actor: ACTORES.tiktokBusqueda,
      entrada: {
        searchQueries: [termino],
        searchSection: "/video",
        resultsPerPage: TOPES.tiktok.posts.items,
        videoSearchSorting: "MOST_RELEVANT",
        videoSearchDateFilter: "PAST_MONTH",
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadSlideshowImages: false,
        shouldDownloadAvatars: false,
        shouldDownloadMusicCovers: false,
      },
    };
  }
  if (red === "instagram") {
    // Instagram no busca por palabra sin sesion: lo que hay es la etiqueta.
    const etiqueta = etiquetaDe(termino);
    if (etiqueta === "") return null;
    return {
      actor: ACTORES.instagram,
      entrada: {
        directUrls: [`https://www.instagram.com/explore/tags/${etiqueta}/`],
        resultsType: "posts",
        resultsLimit: TOPES.instagram.posts.items,
        onlyPostsNewerThan: `${VENTANA_DIAS} days`,
      },
    };
  }
  return {
    actor: ACTORES.facebookBusqueda,
    entrada: {
      query: termino,
      resultsCount: TOPES.facebook.posts.items,
      searchType: "top",
      startDate: hace(ahora, VENTANA_DIAS),
    },
  };
}

export function entradaComentarios(red: Red, urls: readonly string[]): { actor: Actor; entrada: Record<string, unknown> } {
  if (red === "tiktok") {
    return { actor: ACTORES.tiktokComentarios, entrada: { postURLs: [...urls], commentsPerPost: COMENTARIOS_POR_PUBLICACION, maxRepliesPerComment: 0 } };
  }
  if (red === "instagram") {
    return { actor: ACTORES.instagram, entrada: { directUrls: [...urls], resultsType: "comments", resultsLimit: COMENTARIOS_POR_PUBLICACION } };
  }
  return {
    actor: ACTORES.facebookComentarios,
    entrada: {
      startUrls: urls.map((url) => ({ url })),
      resultsLimit: COMENTARIOS_POR_PUBLICACION,
      viewOption: "RANKED_UNFILTERED",
      onlyCommentsNewerThan: `${VENTANA_DIAS} days`,
    },
  };
}

// ------------------------------------------------------------------ POST

export async function responderInicio(cuerpo: unknown, deps: DependenciasRedesEnVivo = {}): Promise<Response> {
  const d = dependencias(deps);
  const secreto = (d.entorno.AUTH_SECRET ?? "").trim();
  if (!redesEnVivoHabilitadas(d.entorno) || secreto === "") return error("apagado", APAGADO, 400);
  const q = typeof cuerpo === "object" && cuerpo !== null ? (cuerpo as { q?: unknown }).q : null;
  const veredicto = validarConsulta(typeof q === "string" ? q : null);
  if (!veredicto.ok) return json(veredicto.error, 400, SIN_CACHE);
  const termino = veredicto.q;

  let usuario: { id: number };
  try {
    usuario = await d.usuario();
  } catch (e) {
    const estado = (e as { estado?: unknown }).estado;
    return json({ detalle: e instanceof Error ? e.message : "Sin sesión" }, typeof estado === "number" ? estado : 401, SIN_CACHE);
  }

  const reserva = await d.libro.reservar({
    clave: claveDe(termino, secreto),
    usuarioId: usuario.id,
    topeUsd: TOPE_POR_BUSQUEDA,
    topeMensual: TOPE_MENSUAL_USD,
    topeDiario: TOPE_DIARIO_POR_PERSONA,
    horas: REUSO_HORAS,
    zona: ZONA_HORARIA,
  });
  if (!reserva.ok) return reserva.motivo === "dia" ? error("limite_dia", LIMITE_DIA, 429) : error("limite_mes", LIMITE_MES, 429);
  if (reserva.reusada) return json({ id: reserva.fila.id }, 200, SIN_CACHE);

  // El modelo de tono tarda en arrancar en frio; que lo haga mientras las
  // redes tardan sus minutos.
  d.tono.calentar();
  const token = tokenApify(d.entorno);
  const id = reserva.fila.id;
  const ahora = d.ahora();
  const arranques = await Promise.allSettled(REDES_PAGADAS.map(async (red) => {
    const pedido = entradaPosts(red, termino, ahora);
    const vacia: CorridaRed = { fase: "fallo", posts: null, comentarios: null, urls: [], reclamada: null };
    if (pedido === null) {
      await d.libro.guardarRed(id, red, vacia);
      return false;
    }
    try {
      const corrida = await iniciarCorrida(pedido.actor, pedido.entrada, TOPES[red].posts, token, d.solicitar);
      await d.libro.guardarRed(id, red, { ...vacia, fase: "publicaciones", posts: { id: corrida.id, dataset: corrida.dataset, usd: null } });
      return true;
    } catch (e) {
      if (e instanceof ActorProhibido) throw e;
      await d.libro.guardarRed(id, red, vacia);
      return false;
    }
  }));
  const prohibido = arranques.find((a) => a.status === "rejected");
  if (prohibido !== undefined) throw (prohibido as PromiseRejectedResult).reason;
  if (arranques.every((a) => a.status === "fulfilled" && a.value === false)) {
    await d.libro.cerrar(id, "fallo", 0);
    return error("no_disponible", NO_DISPONIBLE, 503);
  }
  return json({ id }, 202, SIN_CACHE);
}

// ------------------------------------------------------------------- GET

interface Vista {
  estado: EstadoRed;
  publicaciones: Publicacion[] | null;
  comentarios: ComentarioLimpio[] | null;
  salud: SaludConsulta;
  /** Lo que ya cobro esta red, cuando se sabe todo. */
  usd: number;
}

/** Las publicaciones de la primera pasada que se quedan: las que nombran el
 *  termino, las de mas alcance primero. Pura, para que dos GET que la
 *  calculan sobre el mismo conjunto de datos lleguen a la misma lista. */
export function quedarse(red: Red, items: readonly Record<string, unknown>[], termino: string, ahora: Date): { quedan: Publicacion[]; descartes: Partial<Record<Descarte | "no_nombra", number>> } {
  const descartes: Partial<Record<Descarte | "no_nombra", number>> = {};
  const vistos = new Set<string>();
  const quedan: Publicacion[] = [];
  for (const item of items) {
    const p = red === "tiktok"
      ? limpiarVideoTiktok(item, termino, ahora, VENTANA_DIAS)
      : red === "instagram"
        ? limpiarPostInstagram(item, etiquetaDe(termino), ahora, VENTANA_DIAS)
        : limpiarPostFacebook(item, ahora, VENTANA_DIAS);
    if (typeof p === "string") {
      descartes[p] = (descartes[p] ?? 0) + 1;
      continue;
    }
    if (!nombraEnPie(p.pie, termino)) {
      descartes.no_nombra = (descartes.no_nombra ?? 0) + 1;
      continue;
    }
    if (vistos.has(p.destacado.url)) continue;
    vistos.add(p.destacado.url);
    quedan.push(p);
  }
  quedan.sort((a, b) => (b.destacado.likes ?? 0) - (a.destacado.likes ?? 0)
    || (b.destacado.comentarios ?? 0) - (a.destacado.comentarios ?? 0)
    || a.destacado.url.localeCompare(b.destacado.url));
  return { quedan: quedan.slice(0, PUBLICACIONES_POR_RED), descartes };
}

const ORIGEN: Record<Red, SaludConsulta["origen"]> = { tiktok: "busqueda", instagram: "hashtag", facebook: "busqueda" };

async function verRed(
  red: Red,
  c: CorridaRed | undefined,
  fila: FilaBusqueda,
  termino: string,
  d: ReturnType<typeof dependencias>,
  token: string,
): Promise<Vista> {
  const salud = (estado: SaludConsulta["estado"], posts = 0, comentarios = 0, errorTexto?: string): SaludConsulta => ({
    consulta: "vivo", plataforma: red, origen: ORIGEN[red], fuente: red === "instagram" ? etiquetaDe(termino) : termino,
    estado, posts, comentarios, ...(errorTexto === undefined ? {} : { error: errorTexto }),
  });
  if (c === undefined) return { estado: "sin_iniciar", publicaciones: null, comentarios: null, salud: salud("fallo"), usd: 0 };
  if (c.fase === "fallo" || c.posts === null) return { estado: "fallo", publicaciones: null, comentarios: null, salud: salud("fallo", 0, 0, "sin resultados"), usd: c.posts?.usd ?? 0 };

  const ahora = d.ahora();
  let actual: CorridaRed = c;

  // Primera pasada: ¿termino?
  if (actual.fase === "publicaciones") {
    const corrida = await estadoCorrida(actual.posts!.id, token, d.solicitar);
    if (!TERMINADAS.has(corrida.estado)) {
      return { estado: "buscando", publicaciones: null, comentarios: null, salud: salud("ok"), usd: 0 };
    }
    if (corrida.estado !== "SUCCEEDED") {
      actual = { ...actual, fase: "fallo", posts: { ...actual.posts!, usd: corrida.usd } };
      await d.libro.guardarRed(fila.id, red, actual);
      return { estado: "fallo", publicaciones: null, comentarios: null, salud: salud("fallo", 0, 0, corrida.estado), usd: corrida.usd ?? 0 };
    }
    const items = await itemsDe(actual.posts!.dataset, TOPES[red].posts.items * 2, token, d.solicitar);
    const { quedan } = quedarse(red, items, termino, ahora);
    const urls = quedan.map((p) => p.destacado.url);
    if (await d.libro.reclamar(fila.id, red, ahora.toISOString())) {
      const posts = { ...actual.posts!, usd: corrida.usd };
      if (urls.length === 0) {
        actual = { ...actual, fase: "listo", posts, urls };
      } else {
        const pedido = entradaComentarios(red, urls);
        try {
          const cc = await iniciarCorrida(pedido.actor, pedido.entrada, TOPES[red].comentarios, token, d.solicitar);
          actual = { ...actual, fase: "comentarios", posts, urls, reclamada: ahora.toISOString(), comentarios: { id: cc.id, dataset: cc.dataset, usd: null } };
        } catch (e) {
          if (e instanceof ActorProhibido) throw e;
          actual = { ...actual, fase: "listo", posts, urls };
        }
      }
      await d.libro.guardarRed(fila.id, red, actual);
    } else {
      // Otra peticion gano la segunda pasada: se muestra lo que ya hay y la
      // siguiente pregunta vera la corrida de comentarios que ella arranco.
      return { estado: "comentarios", publicaciones: quedan, comentarios: null, salud: salud("ok", quedan.length), usd: 0 };
    }
    if (actual.fase === "comentarios") {
      return { estado: "comentarios", publicaciones: quedan, comentarios: null, salud: salud("ok", quedan.length), usd: 0 };
    }
    return { estado: "listo", publicaciones: quedan, comentarios: [], salud: salud("ok", quedan.length), usd: corrida.usd ?? 0 };
  }

  // Ya paso la primera: sus publicaciones se releen del conjunto de datos.
  const posts = actual.posts;
  if (posts === null) return { estado: "fallo", publicaciones: null, comentarios: null, salud: salud("fallo"), usd: 0 };
  const items = await itemsDe(posts.dataset, TOPES[red].posts.items * 2, token, d.solicitar);
  const quedan = quedarse(red, items, termino, ahora).quedan.filter((p) => actual.urls.includes(p.destacado.url));

  if (actual.fase === "comentarios") {
    if (actual.comentarios === null) {
      const vencida = actual.reclamada !== null && ahora.getTime() - Date.parse(actual.reclamada) > RECLAMO_VENCE_MS;
      if (vencida) {
        actual = { ...actual, fase: "listo" };
        await d.libro.guardarRed(fila.id, red, actual);
        return { estado: "listo", publicaciones: quedan, comentarios: [], salud: salud("ok", quedan.length), usd: actual.posts?.usd ?? 0 };
      }
      return { estado: "comentarios", publicaciones: quedan, comentarios: null, salud: salud("ok", quedan.length), usd: 0 };
    }
    const cc = await estadoCorrida(actual.comentarios.id, token, d.solicitar);
    if (!TERMINADAS.has(cc.estado)) {
      return { estado: "comentarios", publicaciones: quedan, comentarios: null, salud: salud("ok", quedan.length), usd: 0 };
    }
    actual = { ...actual, fase: "listo", comentarios: { ...actual.comentarios, usd: cc.usd } };
    await d.libro.guardarRed(fila.id, red, actual);
  }

  const pedidas = new Set(actual.urls);
  const comentarios = actual.comentarios === null
    ? []
    : (await itemsDe(actual.comentarios.dataset, TOPES[red].comentarios.items * 2, token, d.solicitar))
      .map((item) => limpiarComentario(red, item, pedidas))
      .filter((x): x is ComentarioLimpio => x !== null);
  return {
    estado: "listo",
    publicaciones: quedan,
    comentarios,
    salud: salud("ok", quedan.length, comentarios.length),
    usd: (actual.posts?.usd ?? 0) + (actual.comentarios?.usd ?? 0),
  };
}

const CERO = { positivo: 0, negativo: 0, neutral: 0, sin_clasificar: 0, sin_modelo_idioma: 0 };

export async function responderEstado(id: string | null, q: string | null, deps: DependenciasRedesEnVivo = {}): Promise<Response> {
  const d = dependencias(deps);
  const secreto = (d.entorno.AUTH_SECRET ?? "").trim();
  if (!redesEnVivoHabilitadas(d.entorno) || secreto === "") return error("apagado", APAGADO, 400);
  const veredicto = validarConsulta(q);
  if (!veredicto.ok) return json(veredicto.error, 400, SIN_CACHE);
  if (!esIdBusqueda(id)) return error("busqueda", "No se encontró esa búsqueda.", 404);
  const termino = veredicto.q;
  const fila = await d.libro.leer(id);
  // El id solo no abre una busqueda: hay que saber que se busco.
  if (fila === null || fila.clave !== claveDe(termino, secreto)) return error("busqueda", "No se encontró esa búsqueda.", 404);

  const token = tokenApify(d.entorno);
  const roster = (await d.leer("roster.json")) as DocRoster | null;
  const figura = roster === null || nombraFigura(termino, roster);

  let vistas: Record<Red, Vista>;
  try {
    const lista = await Promise.all(REDES_PAGADAS.map((red) => verRed(red, fila.corridas[red], fila, termino, d, token)));
    vistas = Object.fromEntries(REDES_PAGADAS.map((red, i) => [red, lista[i]!])) as Record<Red, Vista>;
  } catch (e) {
    if (e instanceof ActorProhibido) throw e;
    if (e instanceof ErrorApify) return error("no_disponible", NO_DISPONIBLE, 503);
    throw e;
  }

  // El tono: los pies y los comentarios de lo que ya es definitivo, en
  // espanol, en dos llamadas. Con un termino del roster no se pide nada.
  const publicaciones = REDES_PAGADAS.flatMap((red) => vistas[red].publicaciones ?? []);
  const comentarios = REDES_PAGADAS.flatMap((red) => vistas[red].comentarios ?? []);
  const deBrigada = brigadas(comentarios);
  const opinion = comentarios.filter((c) => esOpinion(c, deBrigada));
  const [etPies, etComentarios] = figura
    ? [null, null]
    : await Promise.all([
        publicaciones.length === 0 ? Promise.resolve([] as (string | null)[]) : d.tono.etiquetar(publicaciones.map((p) => p.destacado.titulo), "comentarios", "es"),
        comentarios.length === 0 ? Promise.resolve([] as (string | null)[]) : d.tono.etiquetar(comentarios.map((c) => c.texto), "comentarios", "es"),
      ]);
  const esTono = (e: string | null | undefined): e is "positivo" | "negativo" | "neutral" => e === "positivo" || e === "negativo" || e === "neutral";
  const pies: Record<string, TonoPie> = {};
  publicaciones.forEach((p, i) => { const e = etPies?.[i]; pies[p.destacado.url] = esTono(e) ? e : "sin_clasificar"; });
  const tonoDe = new Map<string, ComentarioPublicado["sentimiento"]>();
  comentarios.forEach((c, i) => { const e = etComentarios?.[i]; tonoDe.set(c.id, esTono(e) ? e : null); });

  const redes: PiezasTermino["redes"] = {};
  for (const red of REDES_PAGADAS) {
    const v = vistas[red];
    if (v.publicaciones === null && v.estado !== "listo") continue;
    const suyos = (v.comentarios ?? []);
    redes[red] = (v.publicaciones ?? []).map((p): DestacadoConsulta => {
      const del = suyos.filter((c) => c.post === p.destacado.url);
      const op = del.filter((c) => esOpinion(c, deBrigada));
      const sentimiento = { ...CERO };
      for (const c of op) {
        const t = tonoDe.get(c.id) ?? null;
        if (c.idioma !== "es") sentimiento.sin_modelo_idioma += 1;
        else if (t === null) sentimiento.sin_clasificar += 1;
        else sentimiento[t] += 1;
      }
      return { ...p.destacado, cosechados: del.length, opinion: op.length, sentimiento };
    });
  }

  const urls = new Set(publicaciones.map((p) => p.destacado.url));
  const porPost = publicarComentarios(comentarios, urls, tonoDe, COMENTARIOS_VISIBLES, COMENTARIOS_MAXIMO);
  const estados = Object.fromEntries(REDES_PAGADAS.map((red) => [red, vistas[red].estado])) as Record<Red, EstadoRed>;
  const terminadas = REDES_PAGADAS.every((red) => ["listo", "fallo", "sin_iniciar"].includes(estados[red]));
  const estado: RespuestaRedesEnVivo["estado"] = !terminadas ? "buscando"
    : REDES_PAGADAS.some((red) => estados[red] === "listo") ? "listo" : "fallo";
  if (terminadas && fila.estado === "buscando") {
    await d.libro.cerrar(fila.id, estado === "listo" ? "listo" : "fallo", REDES_PAGADAS.reduce((n, red) => n + vistas[red].usd, 0));
  }

  const conModelo = !figura && ((publicaciones.length > 0 && etPies !== null) || (comentarios.length > 0 && etComentarios !== null));
  const generado = d.ahora().toISOString();
  const cuerpo: RespuestaRedesEnVivo = {
    id: fila.id,
    estado,
    redes: estados,
    piezas: {
      termino,
      generado,
      figura,
      redes,
      salud: REDES_PAGADAS.map((red) => vistas[red].salud),
      pies,
      metodo: conModelo ? "modelo" : "ninguno",
      modelo: conModelo ? "pysentimiento/robertuito-sentiment-analysis" : null,
    },
    textos: {
      esquema: 1,
      generado,
      plataforma: "consultas",
      retencion_dias: 30,
      visibles: COMENTARIOS_VISIBLES,
      maximo: COMENTARIOS_MAXIMO,
      por_post: porPost,
    },
  };
  return json(cuerpo, 200, SIN_CACHE);
}
