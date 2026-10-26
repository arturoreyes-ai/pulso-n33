/**
 * Quien puede pedir un token: solo Claude, identificado por su Client ID
 * Metadata Document (CIMD).
 *
 * Con CIMD el `client_id` es una URL HTTPS y el servidor de autorizacion la
 * descarga para leer los `redirect_uris` del cliente. Descargar una URL que
 * manda un desconocido es un SSRF servido en bandeja, asi que no se descarga
 * cualquiera: solo las dos que Anthropic publica, comprobadas el 26 de
 * octubre de 2026 —la de claude.ai, Desktop y Cowork, y la de Claude Code—.
 * Este MCP es para el Claude del presidente y nada mas; abrirlo a otro
 * cliente es agregar su URL aqui con la razon.
 */

export const CLIENTES = new Set([
  "https://claude.ai/oauth/mcp-oauth-client-metadata",
  "https://claude.ai/oauth/claude-code-client-metadata",
]);

export type Cliente = { client_id: string; client_name: string; redirect_uris: string[] };

const MS_LIMITE = 5_000;
const VIGENCIA_MS = 3_600_000;
const cache = new Map<string, { cliente: Cliente; hasta: number }>();

/** El documento del cliente, validado; null si no es uno de los nuestros o
 *  no se pudo leer. Se guarda una hora por instancia. */
export async function leerCliente(clientId: string, solicitar: typeof fetch = fetch): Promise<Cliente | null> {
  if (!CLIENTES.has(clientId)) return null;
  const guardado = cache.get(clientId);
  if (guardado !== undefined && guardado.hasta > Date.now()) return guardado.cliente;
  try {
    const r = await solicitar(clientId, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(MS_LIMITE) });
    if (!r.ok) return null;
    const doc = (await r.json()) as Partial<Cliente>;
    // El documento tiene que decir que es esa misma URL (CIMD, seccion 4).
    if (doc.client_id !== clientId || !Array.isArray(doc.redirect_uris)) return null;
    const cliente: Cliente = {
      client_id: clientId,
      client_name: typeof doc.client_name === "string" ? doc.client_name : new URL(clientId).host,
      redirect_uris: doc.redirect_uris.filter((u): u is string => typeof u === "string"),
    };
    cache.set(clientId, { cliente, hasta: Date.now() + VIGENCIA_MS });
    return cliente;
  } catch {
    return null;
  }
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * El `redirect_uri` pedido contra los del documento: exacto, salvo en
 * loopback, donde el puerto no cuenta (RFC 8252 7.3). Claude Code abre un
 * puerto efimero distinto en cada sesion y declara `http://localhost/callback`
 * y `http://127.0.0.1/callback`; Anthropic pide aceptar los dos asi.
 */
export function redirectPermitido(pedido: string, declarados: string[]): boolean {
  let p: URL;
  try {
    p = new URL(pedido);
  } catch {
    return false;
  }
  if (p.hash !== "") return false;
  return declarados.some((d) => {
    if (d === pedido) return true;
    let u: URL;
    try {
      u = new URL(d);
    } catch {
      return false;
    }
    return (
      u.protocol === "http:" && p.protocol === "http:"
      && LOOPBACK.has(u.hostname) && u.hostname === p.hostname
      && u.pathname === p.pathname && p.search === ""
    );
  });
}
