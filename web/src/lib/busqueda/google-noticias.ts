/**
 * Cliente del RSS de Google Noticias. Solo servidor.
 *
 * Dos feeds del mismo generador: la BUSQUEDA (/rss/search?q=), que usa
 * /api/buscar, y la SECCION (/rss/headlines/section/topic/<TEMA>), que usa
 * /api/actualidad. Comparten el lector, las cabeceras y la salud.
 *
 * Espejo deliberado de pulso/fetch.py: mismo User-Agent, mismo Accept, y la
 * misma leccion de NoEsFeed -- Google contesta 200 con HTML (interstitial de
 * consentimiento, o una pantalla de 429 disfrazada) mas seguido de lo que
 * parece, y sin olfatearlo el motivo llega como un error de parseo que manda
 * a depurar el lector en vez de la consulta.
 *
 * pulso/busquedas.py solo espeja la mitad de busqueda, y es a proposito. La
 * seccion no la cosecha el pipeline: `data/` no puede decir "ahora mismo" con
 * un cron de seis horas, y un titular nacional que no nombra ningun lugar de
 * la region seria `alcance: nacional` y nunca llegaria al muro.
 */

import { dominioDe, parsearFeed } from "./rss";
import type { Idioma, ResultadoExterno, SaludFeed } from "./tipos";

export const HOST_GOOGLE = "news.google.com";

const URL_BUSQUEDA = `https://${HOST_GOOGLE}/rss/search`;
const URL_SECCION = `https://${HOST_GOOGLE}/rss/headlines/section/topic`;

export const LOCALES: Record<Idioma, { hl: string; gl: string; ceid: string }> = {
  es: { hl: "es-419", gl: "MX", ceid: "MX:es-419" },
  en: { hl: "en-US", gl: "US", ceid: "US:en" },
};

/**
 * Las secciones que se piden, por su alias publico. Google contesta al alias
 * con un 302 al id opaco de la seccion (/rss/topics/CAAq...) y fetch lo sigue
 * solo. Se pide por el alias y no por el id porque el alias es el documentado
 * y el id no promete nada.
 */
export type TemaGoogle = "NATION" | "WORLD";

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
  return `${URL_BUSQUEDA}?${params.toString()}`;
}

/** La seccion de una edicion. Sin consulta: la edicion la fija el locale. */
export function urlDeActualidad(tema: TemaGoogle, idioma: Idioma): string {
  const locale = LOCALES[idioma];
  const params = new URLSearchParams({
    hl: locale.hl,
    gl: locale.gl,
    ceid: locale.ceid,
  });
  return `${URL_SECCION}/${tema}?${params.toString()}`;
}

/**
 * Exactamente news.google.com por https. Nunca `startsWith`:
 * "news.google.com.evil.example" empieza igual.
 */
export function esUrlDeGoogle(u: string): boolean {
  try {
    const x = new URL(u);
    return x.protocol === "https:" && x.hostname === HOST_GOOGLE;
  } catch {
    return false;
  }
}

export interface Cosecha {
  salud: SaludFeed;
  resultados: ResultadoExterno[];
}

/**
 * Un feed, ya con su URL armada por quien llama (urlDeFeed o urlDeActualidad).
 *
 * `solicitar` se inyecta, como en lib/garitas/cbp.ts::responderGaritas, para
 * que scripts/probar-busqueda.cjs lo pruebe sin red. En produccion el valor
 * por omision se resuelve al llamar, asi que es el fetch de Next.
 */
export async function traerFeed(
  url: string,
  idioma: Idioma,
  tope: number,
  solicitar: typeof fetch = fetch,
): Promise<Cosecha> {
  const t0 = Date.now();
  const fallo = (error: string): Cosecha => ({
    salud: { idioma, estado: "fallo", obtenidas: 0, ms: Date.now() - t0, error },
    resultados: [],
  });

  try {
    const r = await solicitar(url, {
      headers: { "User-Agent": AGENTE, Accept: ACEPTA },
      // Una sola capa de cache, la del CDN. `next: { revalidate }` encima
      // daria dos caches con llaves distintas.
      cache: "no-store",
      signal: AbortSignal.timeout(MS_LIMITE),
    });
    if (!r.ok) return fallo(`Google respondio ${r.status}`);

    // fetch sigue el 302 de las secciones solo. Si el destino final no es
    // news.google.com no se lee ni un byte: un feed de otro host con <source>
    // inventados se pintaria como si Google lo hubiera dicho. `r.url` es ""
    // en una Response sintetica (las pruebas), de ahi la condicion.
    if (r.url !== "" && !esUrlDeGoogle(r.url)) {
      return fallo(`redirigido fuera de ${HOST_GOOGLE}: ${dominioDe(r.url)}`);
    }

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

export interface Pedido {
  url: string;
  idioma: Idioma;
}

/**
 * Los feeds de una respuesta, en paralelo.
 *
 * allSettled y no all: que se caiga un locale no puede tumbar el otro. Es la
 * misma postura de pulso/fetch.py, "una fuente caida no tumba la corrida".
 * traerFeed ya devuelve sus fallas como salud; el rechazo que se cubre aqui
 * es el que no deberia ocurrir, y aun asi sale como fila de salud y no como
 * excepcion.
 */
export async function cosecharFeeds(
  pedidos: readonly Pedido[],
  tope: number,
  solicitar: typeof fetch = fetch,
): Promise<Cosecha[]> {
  const acuerdos = await Promise.allSettled(
    pedidos.map((p) => traerFeed(p.url, p.idioma, tope, solicitar)),
  );
  return acuerdos.map((a, i) =>
    a.status === "fulfilled"
      ? a.value
      : {
          salud: {
            idioma: pedidos[i]!.idioma,
            estado: "fallo" as const,
            obtenidas: 0,
            ms: 0,
            error: String(a.reason).slice(0, 300),
          },
          resultados: [],
        },
  );
}
