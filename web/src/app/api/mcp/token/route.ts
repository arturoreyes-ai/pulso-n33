import { responderToken } from "@/lib/mcp/oauth/servidor";

/**
 * El token del MCP de gasto (lib/mcp/oauth/servidor.ts): canjea un codigo de
 * autorizacion o un refresco. Publica por ruta exacta (rutas-publicas.ts)
 * porque quien llama es Claude, no un navegador con sesion; la protegen el
 * PKCE y los valores de un solo uso. Sin MCP_HABILITADO contesta 404.
 */
export async function POST(peticion: Request): Promise<Response> {
  return responderToken(peticion);
}
