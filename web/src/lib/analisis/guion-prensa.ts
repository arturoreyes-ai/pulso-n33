import { componerConsulta, type Ambito } from "@/lib/busqueda/ambito";
import { consultaDeRubro, esTitular } from "@/lib/busqueda/actualidad";
import { archivoPublicado, atarTodas, type LeerArchivo } from "@/lib/busqueda/archivo";
import { catalogoPublicado, type CatalogoBusqueda, type LeerCatalogo } from "@/lib/busqueda/catalogo";
import { titularVencido } from "@/lib/busqueda/fecha-titular";
import { fusionarLocales } from "@/lib/busqueda/fusionar";
import { soloDeMexico } from "@/lib/busqueda/extranjero";
import { cosecharFeeds, urlDeActualidad, urlDeFeed, urlDeLugar, type Pedido } from "@/lib/busqueda/google-noticias";
import { esRedSocial, soloDeLaRegion } from "@/lib/busqueda/region";
import { json, SIN_CACHE } from "@/lib/busqueda/respuesta";
import { esSeccionDeRubro, nombraRubro, SECCION_DE_RUBRO, type Rubro } from "@/lib/busqueda/rubros";
import { nombraAlguno } from "@/lib/busqueda/tema-publicacion";
import type { Idioma, ResultadoExterno } from "@/lib/busqueda/tipos";
import { enlaceParaAnalisis } from "@/lib/busqueda/enlaces";
import { plegar } from "@/lib/dominio/formato";
import { analisisHabilitado, MODELO_GUION } from "./config";
import { normalizarDominio } from "./dominio";
import { PROGRAMAS_GUION, type EjeMinuta, type EjeNoticias33, type ProgramaGuion } from "./contrato-guion";
import {
  decible,
  escribirGuion,
  fallo,
  huecosDe,
  nombraCalifornia,
  TERMINOS_IMPACTO,
  TERMINOS_MANANERA,
  type Pieza,
  type Plan,
} from "./guion";

/**
 * Guion para locucion sobre las NOTICIAS: los titulares en vivo de la portada,
 * con las reglas de cada programa del canal. Hermano de guion-tiktok.ts; el
 * prompt, el esquema y las comprobaciones son los mismos (guion.ts).
 *
 * EL CASO. El 25 de septiembre de 2026 el cliente pidio el guion «para las
 * noticias tambien», con los cuatro programas: Noticias 33, De Red en Red,
 * Minuta Politica y Estado de Alerta. La portada es En Tendencia, que lee
 * Google Noticias en vivo, y de ahi sale este: no de notas.json, que en el
 * sitio publicado envejece hasta el siguiente despliegue humano (AGENTS.md,
 * «Deployment, as it actually is») y le haria decir al conductor las noticias
 * de antier.
 *
 * TITULAR Y NADA MAS. El modelo lee `[n] Titular`: no se abre ninguna nota.
 * Leer el cuerpo de cinco a doce notas por guion seria el analisis en lote
 * que la excepcion de Analizar prohibe por escrito. Por eso cada pieza es una
 * NOTA LEIDA sin pase: no hay clip, y lo que el guion dice cabe en lo que dice
 * un titular. Hasta la tarde del 25 de septiembre de 2026 leia tambien el
 * medio y lo citaba en cada nota («de acuerdo con El Imparcial»); el cliente
 * lo pidio fuera, y lo que el modelo no lee no lo dice. El medio y el enlace
 * siguen en la pieza, para el equipo, no para el aire. Leer UNA nota entera
 * es «Ampliar» (ampliar.ts), un boton por nota y no un paso de este guion: por
 * eso cada pieza trae `ampliable`.
 *
 * LAS GARITAS NO SON UN TITULAR desde ese mismo dia. El eje leia la busqueda
 * de Google, y la nota salia de un tercero: «San Ysidro registra demoras de
 * hasta 90 minutos... segun datos actualizados a la 1:00 de la tarde
 * publicados por tijuanaenlinea.com», con CBP en /api/garitas. Ahora no hay eje
 * de garitas aqui: la nota la arma la tarjeta con CBP (nota-garitas.ts), fuera
 * de este guion, que se cachea una hora.
 *
 * LOS CANDIDATOS LOS DECIDE EL CODIGO, como en TikTok, con las piezas que ya
 * usa la portada: las secciones locales de Google, las busquedas de los rubros
 * (rubros.ts, medidas contra el tope de 31 palabras) y las rejas que solo
 * restan —la region, la fecha del titular, que el titular nombre lo buscado—.
 * Un programa no cambia de ejes segun la pagina desde la que se pida, igual
 * que el de TikTok: el guion lee lo mismo desde /tecate que desde /.
 *
 * Medido el 25 de septiembre de 2026 a media mañana, titulares de las ultimas
 * 24 horas que pasan las rejas: garitas 21 en espanol y 2 en ingles (cuando
 * eran titulares); presidenta 51; la seccion de Tijuana 23 y la de San Diego
 * 36; Politica local 14 mas 5 en ingles y nacional 93; Seguridad local 70 mas 3; y
 * Espectaculos local 10 y nacional 88.
 *
 * UN FEED CAIDO NO ES UN EJE VACIO. Si todos los feeds de un eje fallan, el
 * eje va a `sinLeer` y la pantalla dice que no se pudo leer; decir «sin notas
 * hoy: Garitas» afirmaria un hueco que nadie midio, la regla 4 al reves. Y una
 * respuesta con cualquier feed caido no se cachea, la misma postura de
 * /api/actualidad.
 *
 * `solicitar` se inyecta: las salidas de red son los feeds de Google y el
 * modelo, y ninguna otra. probar-analisis.cjs lo afirma.
 */

/**
 * Una hora en el CDN. La pagina la pide con la hora en la llave, asi que en
 * esa hora pulsar otra vez el mismo programa no es otra llamada de pago, y la
 * hora siguiente trae los titulares de la hora siguiente. Sin
 * stale-while-revalidate: revalidar en segundo plano seria pagar un guion que
 * nadie pidio.
 */
export const CACHE_GUION_PRENSA = "public, max-age=0, s-maxage=3600";

/** Las ultimas 24 horas, como el guion de TikTok. Sobre `publicado`, que es
 *  la fecha que da Google; `when:` la honra de forma irregular. */
export const HORAS_GUION_PRENSA = 24;
const VENTANA_CONSULTA = "when:1d";

/** Candidatos por eje y por programa sin ejes: los mismos topes que TikTok. */
export const CANDIDATOS_POR_EJE_PRENSA = 6;
export const CANDIDATOS_POR_TEMA_PRENSA = 12;

/** Lo que Google lee de una busqueda cabe en 31 palabras
 *  (rubros.ts::PALABRAS_MAXIMAS_GOOGLE); cada lista de aqui se mide en
 *  probar-analisis.cjs con su lugar y su ventana. */
const lista = (terminos: readonly string[]) => `(${terminos.map((t) => (/\s/.test(t) ? `"${t}"` : t)).join(" OR ")})`;

const busqueda = (terminos: readonly string[], idioma: Idioma, ambito: Ambito): Pedido =>
  ({ url: urlDeFeed(componerConsulta(`${lista(terminos)} ${VENTANA_CONSULTA}`, ambito, null), idioma), idioma });

/**
 * Un rubro como lo lee la portada (actualidad.ts): para Mexico, la seccion
 * tematica de Google cuando la hay y la reja de Mexico siempre; si no, su
 * busqueda con la reja del titular.
 */
function deRubro(rubro: Rubro, idioma: Idioma, ambito: Ambito): Feed {
  const tema = SECCION_DE_RUBRO[rubro];
  const mexico = ambito === "mexico";
  if (esSeccionDeRubro(rubro, ambito) && tema !== undefined) {
    return { pedido: { url: urlDeActualidad(tema, "es"), idioma: "es" }, nombra: (r) => esTitular(r.titulo), region: false, mexico };
  }
  return {
    pedido: { url: urlDeFeed(consultaDeRubro(rubro, idioma, ambito, null), idioma), idioma },
    nombra: (r) => nombraRubro(r.titulo, rubro, idioma),
    region: ambito === "region",
    mexico,
  };
}

/**
 * La consulta de California: el estado y su dependencia de caminos, nada mas.
 * Medido el 25 de septiembre de 2026, «Los Ángeles» y «Sacramento» traian
 * paginas de deporte («Sacramento State vs. Buffalo», «Buffalo Bills vs. Los
 * Angeles Chargers», «FC Dallas - Los Angeles FC | Pronóstico»). San Diego
 * entra por su seccion, que es como el cliente describio el eje: «su
 * California es la zona San Diego».
 */
const TERMINOS_CALIFORNIA_PRENSA: readonly string[] = ["California", "Caltrans", "CHP"];

export interface Feed {
  pedido: Pedido;
  /** La reja del titular: si no nombra lo que se busco, se va. */
  nombra: (r: ResultadoExterno) => boolean;
  /** Si pasa por soloDeLaRegion: lo que dice ser de aqui. */
  region: boolean;
  /** Si pasa por soloDeMexico: un rubro de la entrada Mexico. */
  mexico?: boolean;
}

const siempre = () => true;

/**
 * Los feeds de cada eje, o de `temas` en un programa sin ejes. Dentro de un
 * eje se intercalan en este orden (fusionarLocales): el primero manda en el
 * primer puesto. Las llaves son las del contrato por `satisfies`: un eje con
 * otro nombre no tendria candidatos y se diria vacio. Garitas no tiene feed:
 * la pone la tarjeta con CBP (nota-garitas.ts).
 */
export function feedsDe(programa: ProgramaGuion): Record<string, Feed[]> {
  switch (programa) {
    case "noticias33":
      return {
        tijuana: [{ pedido: { url: urlDeLugar("Tijuana", "es"), idioma: "es" }, nombra: siempre, region: true }],
        mananera: [{ pedido: busqueda(["mañanera", "conferencia matutina", "Palacio Nacional", "presidenta"], "es", "mexico"), nombra: (r) => nombraAlguno(r.titulo, TERMINOS_MANANERA), region: false }],
        california: [
          { pedido: { url: urlDeLugar("San Diego", "en"), idioma: "en" }, nombra: siempre, region: true },
          { pedido: busqueda(TERMINOS_CALIFORNIA_PRENSA, "es", "mexico"), nombra: (r) => nombraCalifornia(r.titulo, TERMINOS_CALIFORNIA_PRENSA), region: false },
          { pedido: busqueda(TERMINOS_CALIFORNIA_PRENSA, "en", "internacional"), nombra: (r) => nombraCalifornia(r.titulo, TERMINOS_CALIFORNIA_PRENSA), region: false },
        ],
      } satisfies Record<Exclude<EjeNoticias33, "garitas">, Feed[]>;
    case "deredenred":
      return { temas: [deRubro("espectaculos", "es", "region"), deRubro("espectaculos", "es", "mexico"), deRubro("espectaculos", "en", "region")] };
    case "minutapolitica":
      return {
        local: [deRubro("politica", "es", "region"), deRubro("politica", "en", "region")],
        nacional: [deRubro("politica", "es", "mexico")],
      } satisfies Record<EjeMinuta, Feed[]>;
    case "estadodealerta":
      return {
        temas: [
          deRubro("seguridad", "es", "region"),
          { pedido: busqueda(["incendio", "choque", "accidente", "volcadura", "atropellan", "explosión"], "es", "region"), nombra: (r) => nombraAlguno(r.titulo, TERMINOS_IMPACTO), region: true },
          deRubro("seguridad", "en", "region"),
          { pedido: busqueda(["fire", "crash", "collision", "explosion", "rescue"], "en", "region"), nombra: (r) => nombraAlguno(r.titulo, TERMINOS_IMPACTO), region: true },
        ],
      };
  }
}

/** Dentro de la ventana. Una fila sin fecha legible no se puede situar en las
 *  ultimas 24 horas, asi que no entra: la reja solo resta. */
export function reciente(r: ResultadoExterno, ahora: string, horas = HORAS_GUION_PRENSA): boolean {
  if (r.publicado === null) return false;
  const edad = Date.parse(ahora) - Date.parse(r.publicado);
  return Number.isFinite(edad) && edad <= horas * 3_600_000;
}

/**
 * El nombre que se dice al aire. Google da el medio a veces por su nombre y a
 * veces por su dominio: el 25 de septiembre de 2026, en la misma hora, N+
 * llego como «N+» y como «nmas.com.mx», y el guion decia «informa
 * nmas.com.mx». Cuando el medio llega como dominio y el catalogo conoce ese
 * dominio, se dice su nombre del catalogo; si no lo conoce, el dominio se
 * queda. No se adivina: oem.com.mx es de dos diarios (pulso/busquedas.py).
 */
export function nombreDeMedio(r: Pick<ResultadoExterno, "medio" | "dominio">, catalogo: CatalogoBusqueda | null): string {
  if (catalogo === null || /\s/.test(r.medio) || !r.medio.includes(".")) return r.medio;
  const dominio = normalizarDominio(r.dominio);
  const fila = dominio === null ? undefined : catalogo.medios.find((m) => normalizarDominio(m.dominio) === dominio);
  return fila?.nombre ?? r.medio;
}

/**
 * Con que se abre la nota entera para «Ampliar» (ampliar.ts): la referencia
 * que el archivo verifico, o la del token de Google con el dominio del medio,
 * la misma que usa Analizar en la tarjeta (enlaces.ts). Null si la fila no
 * trae un dominio legible: no hay contra que verificar el destino.
 */
function ampliableDe(r: ResultadoExterno): Pieza["ampliable"] {
  const ref = r.referencia ?? enlaceParaAnalisis(r, SIN_ENLACES);
  return ref === null ? null : { url: ref.url, dominio: ref.dominio, titulo: r.titulo };
}
const SIN_ENLACES: ReadonlyMap<string, string> = new Map();

const MENSAJE_POCOS: Record<ProgramaGuion, string> = {
  noticias33: "No hay notas de hoy para los ejes de Noticias 33.",
  deredenred: "No hay notas de entretenimiento de hoy.",
  minutapolitica: "No hay notas de política de hoy.",
  estadodealerta: "No hay notas de nota roja de hoy.",
};

const NO_DISPONIBLE = "Los titulares en vivo no están disponibles en esta vista.";

/**
 * El plan de un programa: lee sus feeds, pasa las rejas y reparte. Devuelve
 * tambien si algun feed fallo, que decide la cache.
 */
export async function planPrensa(
  programa: ProgramaGuion,
  solicitar: typeof fetch,
  ahora: string,
  leerArchivo: LeerArchivo,
  leerCatalogo: LeerCatalogo = async () => null,
): Promise<{ plan: Plan | null; caido: boolean; todoCaido: boolean; noLeidos: Set<string> }> {
  const grupos = Object.entries(feedsDe(programa));
  const todos = grupos.flatMap(([, feeds]) => feeds);
  const tope = programa === "noticias33" || programa === "minutapolitica" ? CANDIDATOS_POR_EJE_PRENSA : CANDIDATOS_POR_TEMA_PRENSA;
  // Cien filas por feed, como un rubro: las rejas quitan mucho y leer quince
  // dejaria el eje en dos (actualidad.ts::TOPE_CRUDO_RUBRO).
  const cosechas = await cosecharFeeds(todos.map((f) => f.pedido), 100, solicitar);
  const okDe = new Map(todos.map((f, i) => [f, cosechas[i]!.salud.estado === "ok"]));

  const porEje: Record<string, ResultadoExterno[]> = {};
  const noLeidos = new Set<string>();
  let i = 0;
  for (const [eje, feeds] of grupos) {
    const lotes = feeds.map((f) => {
      const filas = cosechas[i++]!.resultados.filter((r) => !esRedSocial(r.dominio) && !titularVencido(r.titulo, ahora) && reciente(r, ahora) && decible(r));
      return (f.region ? soloDeLaRegion(filas) : f.mexico === true ? soloDeMexico(filas) : filas).filter(f.nombra);
    });
    porEje[eje] = fusionarLocales(lotes).slice(0, tope);
    if (feeds.every((f) => okDe.get(f) === false)) noLeidos.add(eje);
  }
  const caido = [...okDe.values()].some((ok) => !ok);
  const todoCaido = [...okDe.values()].every((ok) => !ok);

  // El enlace del propio medio cuando el archivo conoce la nota; si no, el de
  // la fila. Y una sola pieza por titular: la misma nota puede salir en dos
  // ejes (la de Sentri, en Tijuana y en California) con dos enlaces de Google
  // distintos, y tiene que tener un solo numero.
  const [indices, catalogo] = await Promise.all([leerArchivo(), leerCatalogo()]);
  const piezas = new Map<string, Pieza>();
  const aPieza = (r: ResultadoExterno): Pieza => {
    const clave = plegar(r.titulo);
    let p = piezas.get(clave);
    if (p === undefined) {
      p = { url: r.referencia?.url ?? r.url, fuente: nombreDeMedio(r, catalogo), titulo: r.titulo, ampliable: ampliableDe(r) };
      piezas.set(clave, p);
    }
    return p;
  };
  const candidatos: Record<string, Pieza[]> = {};
  for (const [eje, filas] of Object.entries(porEje)) candidatos[eje] = atarTodas(filas, indices).map(aPieza);

  const base = { origen: "prensa" as const, programa };
  const conEjes = programa === "noticias33" || programa === "minutapolitica";
  const listaDe = (): Pieza[] => [...new Map(Object.values(candidatos).flat().map((p) => [p.url, p])).values()];
  if (!conEjes) {
    const lista = candidatos.temas ?? [];
    return { plan: lista.length === 0 ? null : { ...base, lista, candidatos: null, faltantes: [], sinLeer: [] }, caido, todoCaido, noLeidos };
  }
  const lista = listaDe();
  if (lista.length === 0) return { plan: null, caido, todoCaido, noLeidos };
  const { faltantes, sinLeer } = huecosDe(programa, candidatos, noLeidos);
  return { plan: { ...base, lista, candidatos, faltantes, sinLeer }, caido, todoCaido, noLeidos };
}

export async function responderGuionPrensa(
  params: { p: string | null },
  solicitar: typeof fetch = fetch,
  ahora: string = new Date().toISOString(),
  leerArchivo: LeerArchivo = archivoPublicado,
  leerCatalogo: LeerCatalogo = catalogoPublicado,
  /** Solo para comparar modelos a mano; la ruta usa siempre MODELO_GUION. */
  modelo: string = MODELO_GUION,
): Promise<Response> {
  if (!analisisHabilitado()) {
    return json({ codigo: "apagado", mensaje: "El guion automático no está disponible." }, 400, SIN_CACHE);
  }
  const programa = PROGRAMAS_GUION.find((p) => p === params.p);
  if (programa === undefined) return json({ codigo: "programa", mensaje: "Programa desconocido." }, 400, SIN_CACHE);

  const { plan, caido, todoCaido } = await planPrensa(programa, solicitar, ahora, leerArchivo, leerCatalogo);
  if (todoCaido) return fallo(NO_DISPONIBLE, "datos");
  // Sin nada que escribir y con algun feed caido no se puede afirmar que no
  // hubo notas: se dice que no se pudo leer.
  if (plan === null) return caido ? fallo(NO_DISPONIBLE, "datos") : fallo(MENSAJE_POCOS[programa], "pocos");
  return escribirGuion(plan, { solicitar, modelo, cache: caido ? SIN_CACHE : CACHE_GUION_PRENSA });
}
