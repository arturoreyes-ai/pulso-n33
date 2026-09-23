import { normalizarDominio } from "@/lib/analisis/dominio";
import { resolverEnlace } from "@/lib/analisis/resolver-enlace";
import { urlSegura } from "@/lib/analisis/url";
import { robotsCon, type Robotero } from "./buscadores";
import { buscarEnWordpress } from "./enlace-medio";
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
 * PRIMERO EL MEDIO, DESPUES GOOGLE (23 de septiembre de 2026). Ese dia no
 * salia ni una foto: Google contestaba a la IP con su pagina de «trafico
 * inusual» y todo pasaba por ahi. Ahora, cuando la fila trae su titular (`t`),
 * se le pregunta antes al buscador WordPress del propio medio
 * (enlace-medio.ts), que suele dar enlace e imagen en una sola peticion. Google
 * queda para los medios que no son WordPress, y cuando bloquea se deja de
 * llamarlo `PAUSA_GOOGLE_MS`: insistir alarga el bloqueo y cada intento cuesta
 * dos peticiones y hasta 16 s de espera por tarjeta. Un sitio que resulto no
 * ser WordPress tampoco se vuelve a probar en seis horas.
 *
 * Un `null` se cachea quince minutos (`CACHE_HUECO`) y no cero: con cero, cada
 * lector y cada remontaje volvian a golpear a Google por la misma tarjeta
 * mientras duraba el bloqueo, que es lo que lo sostiene.
 *
 * `solicitar` se inyecta, como en lib/analisis/analizar.ts, para probarlo sin
 * red.
 */

/** Seis horas: un ciclo de ingesta. La foto de un articulo publicado no
 *  cambia, y el segundo lector que se detenga en el mismo titular no debe
 *  costar otra vuelta al medio. */
export const CACHE_IMAGEN = "public, max-age=0, s-maxage=21600, stale-while-revalidate=604800";

/** Quince minutos: lo bastante para no insistir durante un bloqueo, poco para
 *  que una tarjeta se quede sin foto si el medio la publica un rato despues. */
export const CACHE_HUECO = "public, max-age=0, s-maxage=900, stale-while-revalidate=900";

/** Lo que el proceso recuerda entre peticiones. Inyectable para las pruebas. */
export interface EstadoImagen {
  /** Hasta cuando no se llama a Google (ms epoch). */
  googleHasta: number;
  /** Dominio -> hasta cuando se da por no-WordPress. */
  sinWordpress: Map<string, number>;
}

export const PAUSA_GOOGLE_MS = 10 * 60 * 1000;
const PAUSA_WORDPRESS_MS = 6 * 60 * 60 * 1000;

const ESTADO: EstadoImagen = { googleHasta: 0, sinWordpress: new Map() };

const MS_LIMITE = 8000;
/** Suficiente para un `<head>`. Se corta igual que en resolver-enlace.ts. */
const MAX_BYTES = 512_000;
const AGENTE = "PulsoN33/web (+https://github.com/arturoreyes-ai/pulso-n33)";

type Respuesta = { imagen: string | null };

const sinImagen = (): Response => json({ imagen: null } satisfies Respuesta, 200, SIN_CACHE);
const hueco = (): Response => json({ imagen: null } satisfies Respuesta, 200, CACHE_HUECO);
const conImagen = (imagen: string): Response => json({ imagen } satisfies Respuesta, 200, CACHE_IMAGEN);

export async function responderImagen(
  params: { u: string | null; d: string | null; t?: string | null },
  solicitar: typeof fetch = fetch,
  opciones: { estado?: EstadoImagen; ahora?: () => number; robots?: Robotero } = {},
): Promise<Response> {
  const estado = opciones.estado ?? ESTADO;
  const ahora = opciones.ahora ?? Date.now;
  // Lo que no es una direccion abrible no se abre, ni al medio ni a Google.
  if (urlSegura(params.u) === null) return sinImagen();
  const dominio = normalizarDominio(params.d ?? "");
  const titulo = (params.t ?? "").trim();

  let url: URL | null = null;
  if (dominio !== null && titulo !== "" && (estado.sinWordpress.get(dominio) ?? 0) <= ahora()) {
    const medio = await buscarEnWordpress(titulo, dominio, solicitar, opciones.robots ?? robotsCon(solicitar));
    if (medio.tipo === "nota") {
      if (medio.imagen !== null) return conImagen(medio.imagen);
      url = medio.url;
    } else if (medio.tipo === "no_wordpress") {
      estado.sinWordpress.set(dominio, ahora() + PAUSA_WORDPRESS_MS);
    }
  }

  if (url === null) {
    const esToken = (() => {
      try {
        return new URL(params.u ?? "").hostname === "news.google.com";
      } catch {
        return false;
      }
    })();
    if (esToken && estado.googleHasta > ahora()) return hueco();
    const resuelto = await resolverEnlace(params.u, params.d, solicitar);
    // Un enlace que no se resuelve es un hueco rotulado, no un error: la
    // tarjeta ya tiene con que pintarse. Se contesta 200 con null para no
    // ensuciar la consola del lector con fallos que no son suyos.
    if (!resuelto.ok) {
      // `parametros` es tambien el sintoma del bloqueo (302 a /sorry o 429):
      // se deja descansar a Google en vez de insistir tarjeta por tarjeta.
      if (esToken && (resuelto.etapa === "parametros" || resuelto.etapa === "resolucion")) {
        estado.googleHasta = ahora() + PAUSA_GOOGLE_MS;
        return hueco();
      }
      return sinImagen();
    }
    url = resuelto.url;
  }
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
  return imagen === null ? sinImagen() : conImagen(imagen);
}
