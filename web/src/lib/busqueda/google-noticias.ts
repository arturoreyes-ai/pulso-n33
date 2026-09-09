/**
 * Cliente del RSS de busqueda de Google Noticias. Solo servidor.
 *
 * Espejo deliberado de pulso/fetch.py: mismo User-Agent, mismo Accept, y la
 * misma leccion de NoEsFeed -- Google contesta 200 con HTML (interstitial de
 * consentimiento, o una pantalla de 429 disfrazada) mas seguido de lo que
 * parece, y sin olfatearlo el motivo llega como un error de parseo que manda
 * a depurar el lector en vez de la consulta.
 */

import { parsearFeed } from "./rss";
import type { Idioma, ResultadoExterno, SaludFeed } from "./tipos";

const URL_BASE = "https://news.google.com/rss/search";

export const LOCALES: Record<Idioma, { hl: string; gl: string; ceid: string }> = {
  es: { hl: "es-419", gl: "MX", ceid: "MX:es-419" },
  en: { hl: "en-US", gl: "US", ceid: "US:en" },
};

const AGENTE = "PulsoN33/web (+https://github.com/arturoreyes-ai/pulso-n33)";
const ACEPTA =
  "application/rss+xml, application/atom+xml, application/xml, text/xml";

const MS_LIMITE = 6_000;
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * URLSearchParams y NUNCA concatenacion. Esto -- no la lista blanca de
 * caracteres de validar.ts -- es lo que impide que una consulta con "&hl=en-US"
 * se convierta en otro parametro y cambie la edicion del feed. La lista blanca
 * es defensa en profundidad; si alguien la "simplifica" pensando que era el
 * guarda, el guarda sigue siendo esta linea.
 */
export function urlDeFeed(q: string, idioma: Idioma): string {
  const locale = LOCALES[idioma];
  const params = new URLSearchParams({
    q,
    hl: locale.hl,
    gl: locale.gl,
    ceid: locale.ceid,
  });
  return `${URL_BASE}?${params.toString()}`;
}

export interface Cosecha {
  salud: SaludFeed;
  resultados: ResultadoExterno[];
}

export async function traerFeed(
  q: string,
  idioma: Idioma,
  tope: number,
): Promise<Cosecha> {
  const t0 = Date.now();
  const fallo = (error: string): Cosecha => ({
    salud: { idioma, estado: "fallo", obtenidas: 0, ms: Date.now() - t0, error },
    resultados: [],
  });

  try {
    const r = await fetch(urlDeFeed(q, idioma), {
      headers: { "User-Agent": AGENTE, Accept: ACEPTA },
      // Una sola capa de cache, la del CDN. `next: { revalidate }` encima
      // daria dos caches con llaves distintas.
      cache: "no-store",
      signal: AbortSignal.timeout(MS_LIMITE),
    });
    if (!r.ok) return fallo(`Google respondio ${r.status}`);

    const crudo = (await r.text()).slice(0, MAX_BYTES);
    const cabeza = crudo.slice(0, 1024).trimStart().toLowerCase();
    if (cabeza.startsWith("<!doctype html") || cabeza.startsWith("<html")) {
      return fallo("respuesta HTML, no RSS: Google interpuso una pagina");
    }

    const resultados = parsearFeed(crudo, idioma, tope);
    return {
      salud: {
        idioma,
        estado: "ok",
        obtenidas: resultados.length,
        ms: Date.now() - t0,
        error: null,
      },
      resultados,
    };
  } catch (e) {
    const nombre = e instanceof Error ? e.name : "Error";
    const mensaje = e instanceof Error ? e.message : String(e);
    return fallo(
      nombre === "TimeoutError"
        ? `Google no respondio en ${MS_LIMITE / 1000} s`
        : `${nombre}: ${mensaje}`.slice(0, 300),
    );
  }
}
