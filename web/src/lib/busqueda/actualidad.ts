/**
 * Una seccion de Google Noticias, en vivo. Pura salvo por `solicitar`, que
 * se inyecta como en lib/garitas/cbp.ts::responderGaritas para probarla sin
 * red.
 *
 * Contesta cuatro formas de "donde", todas "que esta sonando ahora":
 *
 *   ?a=mexico          la seccion NATION de la edicion mexicana
 *   ?a=internacional   la seccion WORLD en espanol y en ingles, intercaladas
 *   ?a=region          las secciones LOCALES de Tijuana (es) y San Diego (en)
 *   ?z=<zona>          la seccion LOCAL de esa zona, en su(s) idioma(s)
 *
 * y, encima de cualquiera, un rubro opcional:
 *
 *   &t=<rubro>         una BUSQUEDA de los terminos del rubro (rubros.ts) mas
 *                      los terminos de lugar de ese "donde", ultimos dos dias,
 *                      de la que queda lo que NOMBRA el rubro en el titular
 *
 * Las dos primeras existen por un hueco concreto: hasta el 11 de septiembre
 * de 2026, elegir Mexico o Internacional en el muro sin escribir nada dejaba
 * una lista vacia con pastillas que no hacian nada, porque el corpus no
 * participa en esos ambitos y la busqueda en vivo no tenia consulta. Las
 * otras dos las pidio el cliente ese mismo dia, mas tarde: una seccion en la
 * portada con lo que destaca en las noticias del lugar que se esta mirando.
 * El rubro llego despues, cuando mostro la caja "Trending topics" de Google:
 * el RSS no la expone, asi que se aproxima con busquedas y se dice que lo es.
 *
 * Decisiones que parecen arbitrarias y no lo son:
 *
 *  - NO se reordena. La seccion llega en el orden de Google, que no es por
 *    fecha (23 inversiones en 45 items el dia que se midio): es su ranking
 *    de la seccion, y ese orden ES la senal. Ordenar por fecha la borraria.
 *  - Mexico es la seccion NATION de la edicion mexicana, no la portada
 *    "Noticias destacadas": la portada mezcla mundo y pais, y el filtro de
 *    al lado ya es Internacional. Decision del cliente, 11 de septiembre.
 *  - La region NO es la seccion "Baja California". Existe, y el sondeo del
 *    11 de septiembre de 2026 la devolvio VACIA (0 items). El corredor se
 *    arma con sus dos polos, Tijuana y San Diego; cada zona tiene la suya en
 *    su pagina.
 *  - Quince como mucho (TOPE_ACTUALIDAD), no cuarenta: el cliente pidio
 *    acortar la cola el 12 de septiembre de 2026, porque en una lista por
 *    relevancia lo que se aleja del lugar o del rubro se junta al final.
 *  - La interfaz NO nombra al agregador, tambien a peticion del cliente ese
 *    dia; el codigo y los docs si, porque de ahi sale el dato.
 *  - Dos rejas que solo restan, despues de la de region y antes del corte.
 *    En un rubro, el titular tiene que nombrar lo que se busco
 *    (rubros.ts::nombraRubro). En todo, un titular que dice entre
 *    parentesis una fecha vieja se va (fecha-titular.ts): Google fecha el dia
 *    en que releyo la pagina, y el 25 de septiembre de 2026 eso metia en
 *    Deportes partidos de ESPN de julio con hora de ese dia. Por eso un rubro
 *    se lee con TOPE_CRUDO_RUBRO y no con quince: lo que las rejas quitan no
 *    puede dejar el capitulo corto.
 *  - Nada de esto toca `data/` ni el pipeline. Son `ResultadoExterno`, no
 *    `Nota`: sin id, zona, tono ni figura, y no cuentan en ninguna cifra de
 *    prensa. PRODUCT.md separa a proposito esas dos clases de afirmacion.
 *
 * Sobre el nombre: `destacados` ya es otra cosa en este repo (los posts de
 * Instagram de data/redes.json), `portada` es la vista de inicio del tablero
 * y `tendencias` son las de X. "Actualidad" no colisiona con nada.
 */

import { componerConsulta, esAmbitoActualidad, type Ambito, type AmbitoActualidad } from "./ambito";
import { archivoPublicado, atarTodas, type LeerArchivo } from "./archivo";
import { fusionarLocales } from "./fusionar";
import { soloDeLaRegion } from "./region";
import {
  cosecharFeeds,
  urlDeActualidad,
  urlDeFeed,
  urlDeLugar,
  type Pedido,
  type TemaGoogle,
} from "./google-noticias";
import { CACHE_CDN, SIN_CACHE, json } from "./respuesta";
import { titularVencido } from "./fecha-titular";
import { consultaDeTerminos, esRubro, nombraRubro, VENTANA_DE, type Rubro } from "./rubros";
import {
  TOPE_ACTUALIDAD,
  type ErrorActualidad,
  type Idioma,
  type RespuestaActualidad,
  type SeccionActualidad,
} from "./tipos";
import { SLUG_DE_ZONA, zonaDeSlug, type ZonaRuta } from "@/lib/dominio/zonas";

/**
 * Las ediciones. Mexico va solo en espanol, que es lo que significa pedir la
 * edicion mexicana; Internacional abre las dos, igual que `localesDe` en
 * ambito.ts, y fusionarLocales las intercala.
 */
export const FEEDS_ACTUALIDAD: Record<
  AmbitoActualidad,
  readonly { tema: TemaGoogle; idioma: Idioma }[]
> = {
  mexico: [{ tema: "NATION", idioma: "es" }],
  internacional: [
    { tema: "WORLD", idioma: "es" },
    { tema: "WORLD", idioma: "en" },
  ],
};

interface Lugar {
  lugar: string;
  idioma: Idioma;
  /**
   * Si este locale ademas pide la SECCION geografica de Google. Por omision si.
   *
   * Existe porque la lista cumple dos papeles: de aqui salen las secciones del
   * capitulo local Y los idiomas en que se buscan los rubros. Para Tijuana eso
   * dejo de coincidir: la seccion en ingles de «Tijuana» devuelve local del
   * condado de San Diego sin relacion con Tijuana, pero la BUSQUEDA en ingles
   * lleva los terminos de lugar pegados y si trae cobertura fronteriza de
   * verdad. Un solo campo separaba las dos cosas; dos listas paralelas se
   * habrian desincronizado.
   */
  seccion?: boolean;
}

/**
 * La seccion LOCAL de cada zona, por el nombre con que Google la conoce y en
 * el idioma de su prensa.
 *
 * Sondeo del 11 de septiembre de 2026, items por seccion: Tijuana 72 en
 * espanol y 12 en ingles, Ensenada 70, San Diego 69 (ingles), Mexicali 59,
 * Rosarito 8, Tecate 6, San Quintin 5, San Felipe 1. Tijuana va en los dos
 * idiomas porque la prensa de San Diego la cubre y la seccion en ingles
 * existe; las demas, en el idioma de su prensa. Las cuatro chicas traen lo
 * que traen: Google arma la seccion con lo que indexa, y ahi indexa poco. Se
 * muestra lo que hay y el panel dice cuanto, nunca se rellena.
 */
export const LUGARES_ACTUALIDAD: Record<ZonaRuta, readonly Lugar[]> = {
  // Tijuana iba tambien en ingles «porque la prensa de San Diego la cubre», y
  // eso resulto ser otra cosa: de cuatro filas en ingles, tres eran locales del
  // condado de San Diego sin relacion con Tijuana (Chula Vista School Board,
  // un groundbreaking en Imperial Beach, grafiti en South Bay). La seccion en
  // ingles de «Tijuana» es, en la practica, la del area fronteriza en ingles.
  // La cobertura en ingles sigue llegando por El corredor —que es Tijuana mas
  // San Diego a proposito— y por /san-diego. Cada zona en el idioma de su
  // prensa, como las otras siete.
  Tijuana: [
    { lugar: "Tijuana", idioma: "es" },
    { lugar: "Tijuana", idioma: "en", seccion: false },
  ],
  Mexicali: [{ lugar: "Mexicali", idioma: "es" }],
  Ensenada: [{ lugar: "Ensenada", idioma: "es" }],
  "Playas de Rosarito": [{ lugar: "Playas de Rosarito", idioma: "es" }],
  Tecate: [{ lugar: "Tecate", idioma: "es" }],
  "San Quintín": [{ lugar: "San Quintín", idioma: "es" }],
  "San Felipe": [{ lugar: "San Felipe", idioma: "es" }],
  "San Diego": [{ lugar: "San Diego", idioma: "en" }],
};

/** El corredor: sus dos polos, uno en cada idioma. Ver el docstring. */
export const CORREDOR_ACTUALIDAD: readonly Lugar[] = [
  { lugar: "Tijuana", idioma: "es" },
  { lugar: "San Diego", idioma: "en" },
];

const pedidosDeLugares = (lugares: readonly Lugar[]): Pedido[] =>
  lugares
    .filter((l) => l.seccion !== false)
    .map(({ lugar, idioma }) => ({ url: urlDeLugar(lugar, idioma), idioma }));

/**
 * La consulta de un rubro para un "donde": terminos del rubro en el idioma
 * de la edicion, la ventana, y los terminos de lugar que componerConsulta
 * pega segun el ambito (los de la zona, los de la region, o ninguno para las
 * ediciones). Pura y exportada para probarla.
 */
export function consultaDeRubro(
  rubro: Rubro,
  idioma: Idioma,
  ambito: Ambito,
  zona: ZonaRuta | null,
): string {
  return componerConsulta(`${consultaDeTerminos(rubro, idioma)} ${VENTANA_DE[rubro].consulta}`, ambito, zona);
}

/**
 * Cuantas filas se leen de cada feed de un rubro antes de las rejas: las cien
 * que Google contesta. Su busqueda empata el cuerpo y la reja del titular
 * quita mucho -- 16 de 20 en Deportes del corredor en ingles, el dia que se
 * midio --, asi que leer quince dejaria el capitulo en tres.
 */
export const TOPE_CRUDO_RUBRO = 100;

export interface ConsultaActualidad {
  actualizar?: boolean;
  a: string | null;
  z: string | null;
  t: string | null;
}

/** El "donde", ya resuelto: que seccion es, en que idiomas, y sus feeds. */
interface Donde {
  seccion: SeccionActualidad;
  zona: ZonaRuta | null;
  ambito: Ambito;
  idiomas: readonly Idioma[];
  pedidosSeccion: Pedido[];
}

interface Resuelta {
  seccion: SeccionActualidad;
  zona: ZonaRuta | null;
  rubro: Rubro | null;
  pedidos: Pedido[];
}

type Error = { error: ErrorActualidad };

/**
 * `z` manda sobre `a`: una zona inventada es 400 aunque `a` sea valido, para
 * que un enlace mal armado se vea en vez de caer en silencio a otra seccion.
 */
function resolverDonde(consulta: ConsultaActualidad): Donde | Error {
  if (consulta.z !== null) {
    const zona = zonaDeSlug(consulta.z);
    if (zona === null) {
      return { error: { codigo: "zona", mensaje: "Zona desconocida." } };
    }
    const lugares = LUGARES_ACTUALIDAD[zona];
    return {
      seccion: "zona",
      zona,
      ambito: "zona",
      idiomas: lugares.map((l) => l.idioma),
      pedidosSeccion: pedidosDeLugares(lugares),
    };
  }
  if (consulta.a === "region") {
    return {
      seccion: "region",
      zona: null,
      ambito: "region",
      idiomas: CORREDOR_ACTUALIDAD.map((l) => l.idioma),
      pedidosSeccion: pedidosDeLugares(CORREDOR_ACTUALIDAD),
    };
  }
  if (esAmbitoActualidad(consulta.a)) {
    const feeds = FEEDS_ACTUALIDAD[consulta.a];
    return {
      seccion: consulta.a,
      zona: null,
      ambito: consulta.a,
      idiomas: feeds.map((f) => f.idioma),
      pedidosSeccion: feeds.map(({ tema, idioma }) => ({
        url: urlDeActualidad(tema, idioma),
        idioma,
      })),
    };
  }
  // La pagina nunca pide otra cosa, asi que llegar aqui es uso indebido y
  // conviene que se vea.
  return {
    error: {
      codigo: "ambito",
      mensaje: "Solo mexico, internacional o region en a=; una zona va en z=.",
    },
  };
}

/** Que feeds contesta cada consulta. Pura. */
export function resolverActualidad(consulta: ConsultaActualidad): Resuelta | Error {
  const donde = resolverDonde(consulta);
  if ("error" in donde) return donde;
  if (consulta.t === null) {
    return { seccion: donde.seccion, zona: donde.zona, rubro: null, pedidos: donde.pedidosSeccion };
  }
  if (!esRubro(consulta.t)) {
    return { error: { codigo: "rubro", mensaje: "Rubro desconocido." } };
  }
  const rubro = consulta.t;
  return {
    seccion: donde.seccion,
    zona: donde.zona,
    rubro,
    pedidos: donde.idiomas.map((idioma) => ({
      url: urlDeFeed(consultaDeRubro(rubro, idioma, donde.ambito, donde.zona), idioma),
      idioma,
    })),
  };
}

export async function responderActualidad(
  consulta: ConsultaActualidad,
  solicitar: typeof fetch = fetch,
  ahora: string = new Date().toISOString(),
  leerArchivo: LeerArchivo = archivoPublicado,
): Promise<Response> {
  const r = resolverActualidad(consulta);
  if ("error" in r) return json(r.error, 400, SIN_CACHE);

  const tope = r.rubro === null ? TOPE_ACTUALIDAD : TOPE_CRUDO_RUBRO;
  const cosechas = await cosecharFeeds(r.pedidos, tope, solicitar);

  // Intercalados por locale y sin repetir titular. NUNCA ordenados aqui.
  const crudos = fusionarLocales(cosechas.map((c) => c.resultados));

  // La reja de region SOLO en lo que dice ser de aqui. Mexico e Internacional
  // existen precisamente para traer lo de fuera: filtrarlos los vaciaria.
  const deAqui =
    r.seccion === "zona" || r.seccion === "region" ? soloDeLaRegion(crudos) : crudos;
  // Las dos rejas del docstring. `idioma` es el de la edicion que devolvio la
  // fila, que es el idioma en que se pidieron los terminos.
  const rubro = r.rubro;
  const fusionados = deAqui.filter(
    (f) => !titularVencido(f.titulo, ahora) && (rubro === null || nombraRubro(f.titulo, rubro, f.idioma)),
  );

  // El cruce contra el archivo va DESPUES del corte: solo se resuelve lo que
  // de verdad sale. Un archivo ilegible deja las filas como estan —`imagen` y
  // `referencia` en null—, que es el mismo estado que una fila sin empate y no
  // uno nuevo que la tarjeta tenga que saber distinguir.
  const indices = await leerArchivo();
  const cuerpo: RespuestaActualidad = {
    seccion: r.seccion,
    zona: r.zona === null ? null : SLUG_DE_ZONA[r.zona],
    rubro: r.rubro,
    consultado: ahora,
    resultados: atarTodas(fusionados.slice(0, TOPE_ACTUALIDAD), indices),
    fuentes: cosechas.map((c) => c.salud),
    truncada: fusionados.length > TOPE_ACTUALIDAD,
  };

  // Nunca un 502: un problema rio arriba viaja como 200 con la salud dentro,
  // para que la pagina pueda DECIR que paso en vez de mostrarse rota.
  const todoBien = cosechas.every((c) => c.salud.estado === "ok");
  return json(cuerpo, 200, todoBien && !consulta.actualizar ? CACHE_CDN : SIN_CACHE);
}
