import { metadatosServidor, origenPublico, secretoMcp } from "@/lib/mcp/oauth/servidor";

/** RFC 8414: los extremos del servidor de autorizacion del MCP de gasto y lo
 *  que acepta (lib/mcp/oauth/servidor.ts). Sin MCP_HABILITADO, 404. */
export function GET(peticion: Request): Response {
  if (secretoMcp() === null) return new Response(null, { status: 404 });
  return Response.json(metadatosServidor(origenPublico(peticion.headers)), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
