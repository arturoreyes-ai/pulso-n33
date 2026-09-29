import { MODELO_GUION, MODELO_RESPALDO_GUION } from "./config";

/**
 * La llamada al modelo del guion y de «Ampliar», con su plan para cuando el
 * modelo se niega. Una sola, por la razon de redes.py::zona_por_ambito.
 *
 * EL CASO. El 28 de septiembre de 2026 el guion paso de Sonnet 5 a Sonnet 5.5,
 * a pedido del cliente (el mismo precio, $2 / $10 por millon, y el modelo
 * nuevo). Sonnet 5.5 trae clasificadores de seguridad que Sonnet 5 no tenia:
 * puede negarse (HTTP 200, `stop_reason: "refusal"`) en cinco categorias, una
 * de ellas «general_harms», que tambien toca trabajo legitimo. Estado de
 * Alerta es nota roja todas las noches, y una negativa se veia como «No se
 * pudo preparar el guion» sin mas.
 *
 * DOS RESPALDOS, porque ninguno alcanza solo:
 *  - El del servidor: `fallbacks: "default"` con la cabecera
 *    `server-side-fallback-2026-07-01`, que reintenta dentro de la misma
 *    llamada. En Sonnet 5.5 solo cubre «cyber» y «frontier_llm», que aqui casi
 *    no pasan.
 *  - El nuestro: una negativa que el servidor no reencamino se reintenta UNA
 *    vez en `MODELO_RESPALDO_GUION` (Sonnet 5), con el mismo cuerpo sin
 *    `fallbacks`. El cuerpo no lleva `thinking`, asi que vale igual para los
 *    dos modelos. Con el mismo plazo: el segundo intento corre con lo que le
 *    quede al primero, porque la ruta tiene 60 segundos.
 *
 * Una negativa que llega a los dos modelos es un fallo del guion, como
 * cualquier otro: se dice «No se pudo preparar…» y no se guarda.
 */

/** Las categorias que el respaldo del servidor ya reintento en Sonnet 5:
 *  repetirlas aqui seria pagar dos veces el mismo intento. */
const REINTENTADAS_POR_EL_SERVIDOR = new Set(["cyber", "frontier_llm"]);

/** Los modelos donde el respaldo del servidor existe en su forma «default». */
const CON_RESPALDO_DEL_SERVIDOR = new Set(["claude-sonnet-5-5"]);

type Bloque = { type?: string; text?: string };
type Respuesta = { content?: Bloque[]; stop_reason?: string; stop_details?: { category?: string | null } | null };

export type ResultadoModelo =
  | { ok: true; bloques: Bloque[]; modelo: string }
  | { ok: false };

async function una(solicitar: typeof fetch, modelo: string, cuerpo: Record<string, unknown>, senal: AbortSignal): Promise<Respuesta | null> {
  const conServidor = CON_RESPALDO_DEL_SERVIDOR.has(modelo);
  try {
    const r = await solicitar("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
        ...(conServidor ? { "anthropic-beta": "server-side-fallback-2026-07-01" } : {}),
      },
      cache: "no-store",
      signal: senal,
      body: JSON.stringify({ model: modelo, ...cuerpo, ...(conServidor ? { fallbacks: "default" } : {}) }),
    });
    if (!r.ok) return null;
    return (await r.json()) as Respuesta;
  } catch {
    return null;
  }
}

/**
 * Pide al modelo, y si se niega, al respaldo. `cuerpo` es la peticion sin
 * `model`. Devuelve los bloques de la respuesta que no se nego, o `ok: false`
 * si no hubo respuesta o se negaron los dos.
 */
export async function pedirAlModeloGuion(solicitar: typeof fetch, cuerpo: Record<string, unknown>, opciones: {
  modelo?: string;
  /** El plazo de las dos llamadas juntas. */
  limiteMs: number;
}): Promise<ResultadoModelo> {
  const modelo = opciones.modelo ?? MODELO_GUION;
  const senal = AbortSignal.timeout(opciones.limiteMs);
  const primera = await una(solicitar, modelo, cuerpo, senal);
  if (primera === null) return { ok: false };
  if (primera.stop_reason !== "refusal") return { ok: true, bloques: primera.content ?? [], modelo };
  const categoria = primera.stop_details?.category ?? "";
  if (modelo === MODELO_RESPALDO_GUION || (CON_RESPALDO_DEL_SERVIDOR.has(modelo) && REINTENTADAS_POR_EL_SERVIDOR.has(categoria))) return { ok: false };
  const segunda = await una(solicitar, MODELO_RESPALDO_GUION, cuerpo, senal);
  if (segunda === null || segunda.stop_reason === "refusal") return { ok: false };
  return { ok: true, bloques: segunda.content ?? [], modelo: MODELO_RESPALDO_GUION };
}
