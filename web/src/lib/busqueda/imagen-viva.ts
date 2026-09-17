import { resolverEnlace } from "@/lib/analisis/resolver-enlace";
import { urlSegura } from "@/lib/analisis/url";
import { imagenDeHtml } from "./og-imagen";
import { json, SIN_CACHE } from "./respuesta";

/**
 * La miniatura de una fila en vivo, leida de la pagina del propio medio.
 *
 * EL CASO: una fila en vivo no trae imagen y casi nunca la puede recuperar del
 * corpus. Medido sobre data/notas.json el 17 de septiembre de 2026: de 503
 * notas llegadas por busqueda, CERO recuperan miniatura por titular plegado, y
 * el 95% son de medios que no estan en el catalogo —226 distintos—. El cruce de
 * imagenes.ts sirve para el capitulo local y no alcanza para Mexico,
 * Internacional ni los rubros, que son la mayoria de las tarjetas. De ahi la
 * pantalla en blanco.
 *
 * QUE HACE Y QUE NO, porque toca una linea que estaba escrita como prohibida:
 *
 *  - SI resuelve el token y abre la pagina del medio. El comentario de
 *    capitulos.ts decia que seguir el redirector para leer el `og:image`
 *    estaba prohibido; se reescribio al abrir esto. La regla del pipeline NO
 *    cambia y es sobre otra cosa: alla el token rota entre corridas y cambiaria
 *    el `url` de una nota ya guardada, ensuciando data/. Aqui no se guarda
 *    ninguna nota.
 *  - NO guarda nada, y NO DEVUELVE NADA MAS QUE UNA URL. El HTML vive en
 *    memoria el tiempo de una peticion. Que la respuesta no contenga texto de
 *    la nota es una prueba de scripts/probar-analisis.cjs, no una intencion:
 *    es lo mismo que sostiene «no se guardan cuerpos ni resumenes».
 *  - NO cuesta dinero. No hay modelo ni proveedor: es un GET publico con la
 *    stdlib de la plataforma. Un actor de Apify haria este mismo GET cobrando
 *    por resultado, sobre trafico de lectores en vez del cron.
 *  - NO es masivo. Se pide solo para la tarjeta ASENTADA y la siguiente
 *    (use-imagen-viva.ts), no para las 135 del recorrido.
 *
 * Todo fallo —429, pagina de consentimiento, sin `og:image`— vuelve como
 * `null` y la tarjeta se queda con su placa. Nunca se adivina una URL.
 *
 * `solicitar` se inyecta, como en lib/analisis/analizar.ts, para probarlo sin
 * red.
 */

/** Seis horas: un ciclo de ingesta. La foto de un articulo publicado no
 *  cambia, y el segundo lector que se detenga en el mismo titular no debe
 *  costar otra vuelta al medio. */
export const CACHE_IMAGEN = "public, max-age=0, s-maxage=21600, stale-while-revalidate=604800";

const MS_LIMITE = 8000;
/** Suficiente para un `<head>`. Se corta igual que en resolver-enlace.ts. */
const MAX_BYTES = 512_000;
const AGENTE = "PulsoN33/web (+https://github.com/arturoreyes-ai/pulso-n33)";

type Respuesta = { imagen: string | null };

const sinImagen = (): Response => json({ imagen: null } satisfies Respuesta, 200, SIN_CACHE);

export async function responderImagen(
  params: { u: string | null; d: string | null },
  solicitar: typeof fetch = fetch,
): Promise<Response> {
  const resuelto = await resolverEnlace(params.u, params.d, solicitar);
  // Un enlace que no se resuelve es un hueco rotulado, no un error: la tarjeta
  // ya tiene con que pintarse. Se contesta 200 con null para no ensuciar la
  // consola del lector con fallos que no son suyos.
  if (!resuelto.ok) return sinImagen();
  const url = resuelto.url;
  if (urlSegura(url.toString()) === null) return sinImagen();

  let html: string;
  try {
    const r = await solicitar(url.toString(), {
      headers: { "User-Agent": AGENTE, Accept: "text/html,application/xhtml+xml" },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(MS_LIMITE),
    });
    if (!r.ok) return sinImagen();
    const tipo = (r.headers.get("content-type") ?? "").toLowerCase();
    if (tipo !== "" && !tipo.includes("html")) return sinImagen();
    html = (await r.text()).slice(0, MAX_BYTES);
  } catch {
    return sinImagen();
  }

  const imagen = imagenDeHtml(html, url);
  // Solo la URL. El `html` muere aqui.
  return json({ imagen } satisfies Respuesta, 200, imagen === null ? SIN_CACHE : CACHE_IMAGEN);
}
