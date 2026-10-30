/**
 * Excepciones exactas a la puerta del tablero. No usar `startsWith`: abrir
 * `/api/garitas/lo-que-sea` convertiría futuras rutas hermanas en públicas sin
 * que quien las agregue tuviera que decidirlo.
 *
 * `/api/seguimiento/purgar` es la otra, desde el 28 de septiembre de 2026: la
 * llama el cron diario de Vercel, que no trae sesion. No publica nada —borra
 * el texto vencido y contesta cuantos— y sin `CRON_SECRET` contesta 401
 * siempre (lib/seguimiento/responder.ts::responderPurga).
 *
 * Las del MCP de gasto, desde el 26 de octubre de 2026 (lib/mcp/): el
 * endpoint, el token y los dos documentos de descubrimiento. Quien llama es
 * Claude, sin sesion de Entra; el endpoint exige su propio token OAuth y
 * todas contestan 404 sin MCP_HABILITADO. La pantalla de autorizacion
 * (/mcp/autorizar) NO esta aqui a proposito: es donde se pide la sesion.
 */
const PUBLICAS = new Set([
  "/api/garitas",
  "/api/seguimiento/purgar",
  "/api/mcp",
  "/api/mcp/token",
  "/api/mcp/registro",
  "/.well-known/oauth-protected-resource",
  "/.well-known/oauth-protected-resource/api/mcp",
  "/.well-known/oauth-authorization-server",
]);

export function esRutaPublica(ruta: string): boolean {
  return PUBLICAS.has(ruta);
}
