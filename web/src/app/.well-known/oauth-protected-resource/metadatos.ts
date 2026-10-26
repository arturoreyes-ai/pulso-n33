import { metadatosRecurso, origenPublico, secretoMcp } from "@/lib/mcp/oauth/servidor";

/** RFC 9728: que recurso es el MCP y quien emite sus tokens. Se sirve en la
 *  raiz y con el sufijo de la ruta del MCP, que es el que Claude prueba
 *  primero. Sin MCP_HABILITADO, 404. */
export function responderMetadatosRecurso(peticion: Request): Response {
  if (secretoMcp() === null) return new Response(null, { status: 404 });
  return Response.json(metadatosRecurso(origenPublico(peticion.headers)), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
