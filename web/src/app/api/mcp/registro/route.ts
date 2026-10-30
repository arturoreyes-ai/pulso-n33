import { responderRegistro } from "@/lib/mcp/oauth/registro";
import { secretoMcp } from "@/lib/mcp/oauth/servidor";

/**
 * El registro dinamico de clientes del MCP (lib/mcp/oauth/registro.ts), que
 * usa n8n. Publico por ruta exacta: quien se registra no tiene sesion, y lo
 * que lo acota es la lista de destinos. Sin MCP_HABILITADO contesta 404.
 */
export async function POST(peticion: Request): Promise<Response> {
  const secreto = secretoMcp();
  if (secreto === null) return new Response(null, { status: 404 });
  return responderRegistro(peticion, secreto);
}
