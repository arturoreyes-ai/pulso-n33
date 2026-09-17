import { dominioDeUrl, normalizarDominio } from "./dominio";
import { urlSegura } from "./url";

/**
 * Resuelve un token de Google Noticias solo cuando una persona confirma
 * Analizar y el archivo aun no conoce el enlace del medio.
 *
 * El caso que lo motivo fue una nota de El Imparcial sobre PMV Minera: estaba
 * en el recorrido en vivo pero no en notas.json, asi que el cliente devolvia
 * null antes de llamar a la ruta. El token no redirige por HTTP. Su pagina
 * publica dos parametros efimeros y un POST al mismo host devuelve el enlace
 * editorial. Es un protocolo no documentado: un cambio, un 429 o una pagina
 * de consentimiento son un hueco rotulado, nunca permiso para adivinar URL.
 *
 * Referencia de interoperabilidad, consultada el 17 de septiembre de 2026:
 * https://github.com/dbernheisel/google_news_decoder/blob/main/lib/google_news_decoder.ex
 */

const HOST_GOOGLE = "news.google.com";
const URL_LOTE = `https://${HOST_GOOGLE}/_/DotsSplashUi/data/batchexecute`;
const MS_LIMITE = 8_000;
/**
 * El tope de la pagina del buscador. Es grande porque tiene que serlo: los
 * dos parametros viven al FINAL del documento, asi que recortar por el
 * principio los tira enteros.
 *
 * Medido el 17 de septiembre de 2026, depurando exactamente esto: la pagina
 * pesa 1,132,857 caracteres y `data-n-a-ts` empieza en el 1,131,303. Con el
 * tope anterior de 1,000,000 no entraban, y el fallo salia rotulado
 * `etapa=parametros` -- el MISMO sintoma que un cambio de protocolo o una
 * pagina de consentimiento, que es lo que lo hizo pasar por roto de Google
 * en vez de por recorte nuestro. Si vuelve a fallar ahi, mide el largo de la
 * pagina antes de dar por muerto el protocolo.
 */
const MAX_PAGINA = 4_000_000;
const MAX_LOTE = 200_000;
const AGENTE = "PulsoN33/web (+https://github.com/arturoreyes-ai/pulso-n33)";

type Etapa = "url" | "dominio" | "token" | "parametros" | "resolucion" | "destino";

export type ResultadoEnlace =
  | { ok: true; url: URL; dominio: string }
  | { ok: false; codigo: "url" | "enlace"; etapa: Etapa; estado: number | null; host: string | null };

const fallo = (
  codigo: "url" | "enlace",
  etapa: Etapa,
  host: string | null,
  estado: number | null = null,
): ResultadoEnlace => ({ ok: false, codigo, etapa, estado, host });

function idDeToken(u: URL): string | null {
  if (u.hostname !== HOST_GOOGLE) return null;
  const m = /^\/(?:(?:rss\/)?articles|read)\/([A-Za-z0-9_-]+)\/?$/.exec(u.pathname);
  const id = m?.[1] ?? "";
  return id.length >= 8 && id.length <= 4096 ? id : null;
}

function urlDeLote(crudo: string): string | null {
  const separador = crudo.indexOf("\n\n");
  if (separador === -1) return null;
  try {
    const exterior = JSON.parse(crudo.slice(separador + 2).trim()) as unknown;
    if (!Array.isArray(exterior) || !Array.isArray(exterior[0])) return null;
    const interiorCrudo = exterior[0][2];
    if (typeof interiorCrudo !== "string") return null;
    const interior = JSON.parse(interiorCrudo) as unknown;
    if (!Array.isArray(interior) || typeof interior[1] !== "string") return null;
    return interior[1];
  } catch {
    return null;
  }
}

export async function resolverEnlace(
  crudo: string | null,
  dominioCrudo: string | null,
  solicitar: typeof fetch = fetch,
): Promise<ResultadoEnlace> {
  const inicial = urlSegura(crudo);
  const dominio = normalizarDominio(dominioCrudo ?? "");
  if (inicial === null || dominio === null) return fallo("url", "url", dominio);

  if (inicial.hostname !== HOST_GOOGLE) {
    return dominioDeUrl(inicial) === dominio
      ? { ok: true, url: inicial, dominio }
      : fallo("enlace", "dominio", dominio);
  }

  const id = idDeToken(inicial);
  if (id === null) return fallo("enlace", "token", dominio);

  let firma: string;
  let marca: number;
  try {
    const urlPagina = `https://${HOST_GOOGLE}/articles/${id}`;
    const pagina = await solicitar(urlPagina, {
      headers: {
        "User-Agent": AGENTE,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: "CONSENT=PENDING+987",
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(MS_LIMITE),
    });
    if (!pagina.ok) return fallo("enlace", "parametros", dominio, pagina.status);
    if (pagina.url !== "" && new URL(pagina.url).hostname !== HOST_GOOGLE) {
      return fallo("enlace", "parametros", dominio, pagina.status);
    }
    const html = (await pagina.text()).slice(0, MAX_PAGINA);
    const firmaCruda = /data-n-a-sg="([^"]+)"/.exec(html)?.[1] ?? "";
    const marcaCruda = /data-n-a-ts="([^"]+)"/.exec(html)?.[1] ?? "";
    if (!/^[A-Za-z0-9_-]{8,256}$/.test(firmaCruda) || !/^\d{9,13}$/.test(marcaCruda)) {
      return fallo("enlace", "parametros", dominio, pagina.status);
    }
    firma = firmaCruda;
    marca = Number(marcaCruda);
  } catch {
    return fallo("enlace", "parametros", dominio);
  }

  let destinoCrudo: string | null;
  try {
    const interno = JSON.stringify([
      "garturlreq",
      [
        ["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1],
        "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0,
      ],
      id,
      marca,
      firma,
    ]);
    const pedido = JSON.stringify([[ ["Fbv4je", interno] ]]);
    const lote = await solicitar(URL_LOTE, {
      method: "POST",
      headers: {
        "User-Agent": AGENTE,
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Origin: `https://${HOST_GOOGLE}`,
        Referer: `https://${HOST_GOOGLE}/`,
        "X-Same-Domain": "1",
        Cookie: "CONSENT=PENDING+987",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(MS_LIMITE),
      body: `f.req=${encodeURIComponent(pedido)}`,
    });
    if (!lote.ok) return fallo("enlace", "resolucion", dominio, lote.status);
    destinoCrudo = urlDeLote((await lote.text()).slice(0, MAX_LOTE));
    if (destinoCrudo === null) return fallo("enlace", "resolucion", dominio, lote.status);
  } catch {
    return fallo("enlace", "resolucion", dominio);
  }

  const destino = urlSegura(destinoCrudo);
  if (destino === null || dominioDeUrl(destino) !== dominio) {
    return fallo("enlace", "destino", dominio);
  }
  return { ok: true, url: destino, dominio };
}
