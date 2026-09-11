/**
 * La seccion de Google Noticias de un ambito sin corpus, en vivo. Pura salvo
 * por `solicitar`, que se inyecta como en lib/garitas/cbp.ts::responderGaritas
 * para probarla sin red.
 *
 * Existe por un hueco concreto. Hasta el 11 de septiembre de 2026, elegir
 * Mexico o Internacional sin escribir nada dejaba el muro como una lista
 * vacia con pastillas que no hacian nada: el corpus no participa en esos
 * ambitos y la busqueda en vivo no tenia consulta. El cliente pidio ver ahi
 * lo que esta sonando en ese momento, y poder buscar encima.
 *
 * Tres decisiones que parecen arbitrarias y no lo son:
 *
 *  - NO se reordena. La seccion llega en el orden de Google, que no es por
 *    fecha (23 inversiones en 45 items el dia que se midio): es su ranking
 *    de la seccion, y ese orden ES la senal. Ordenar por fecha la borraria.
 *  - Mexico es la seccion NATION de la edicion mexicana, no la portada
 *    "Noticias destacadas": la portada mezcla mundo y pais, y el filtro de
 *    al lado ya es Internacional. Decision del cliente, 11 de septiembre.
 *  - Nada de esto toca `data/` ni el pipeline. Son `ResultadoExterno`, no
 *    `Nota`: sin id, zona, tono ni figura, y no cuentan en ninguna cifra de
 *    prensa. PRODUCT.md separa a proposito esas dos clases de afirmacion.
 *
 * Sobre el nombre: `destacados` ya es otra cosa en este repo (los posts de
 * Instagram de data/redes.json) y `portada` es la vista de inicio del
 * tablero. "Actualidad" no colisiona con nada.
 */

import { esAmbitoActualidad, type AmbitoActualidad } from "./ambito";
import { fusionarLocales } from "./fusionar";
import { cosecharFeeds, urlDeActualidad, type TemaGoogle } from "./google-noticias";
import { CACHE_CDN, SIN_CACHE, json } from "./respuesta";
import {
  TOPE_RESULTADOS,
  type ErrorActualidad,
  type Idioma,
  type RespuestaActualidad,
} from "./tipos";

/**
 * Que seccion y en que edicion. Mexico va solo en espanol, que es lo que
 * significa pedir la edicion mexicana; Internacional abre las dos, igual que
 * `localesDe` en ambito.ts, y fusionarLocales las intercala.
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

export async function responderActualidad(
  crudo: string | null,
  solicitar: typeof fetch = fetch,
  ahora: string = new Date().toISOString(),
): Promise<Response> {
  if (!esAmbitoActualidad(crudo)) {
    // Un ambito con corpus no tiene seccion en vivo y la pagina no lo pide,
    // asi que llegar aqui es uso indebido y conviene que se vea.
    const error: ErrorActualidad = {
      codigo: "ambito",
      mensaje: "Solo mexico o internacional.",
    };
    return json(error, 400, SIN_CACHE);
  }

  const pedidos = FEEDS_ACTUALIDAD[crudo].map(({ tema, idioma }) => ({
    url: urlDeActualidad(tema, idioma),
    idioma,
  }));
  const cosechas = await cosecharFeeds(pedidos, TOPE_RESULTADOS, solicitar);

  // Intercalados por locale y sin repetir titular. NUNCA ordenados aqui.
  const fusionados = fusionarLocales(cosechas.map((c) => c.resultados));
  const cuerpo: RespuestaActualidad = {
    ambito: crudo,
    consultado: ahora,
    resultados: fusionados.slice(0, TOPE_RESULTADOS),
    fuentes: cosechas.map((c) => c.salud),
    truncada: fusionados.length > TOPE_RESULTADOS,
  };

  // Nunca un 502: un problema rio arriba viaja como 200 con la salud dentro,
  // para que la pagina pueda DECIR que paso en vez de mostrarse rota.
  const todoBien = cosechas.every((c) => c.salud.estado === "ok");
  return json(cuerpo, 200, todoBien ? CACHE_CDN : SIN_CACHE);
}
