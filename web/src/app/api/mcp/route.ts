import { responderMcp } from "@/lib/mcp/servidor";

/**
 * El servidor MCP de gasto (lib/mcp/servidor.ts), para conectarlo al Claude
 * del presidente de la empresa. Va fuera de la sesion de Entra porque quien
 * llama es el servidor de Anthropic, no un navegador: lo protege su propio
 * OAuth (lib/mcp/oauth/), y sin MCP_HABILITADO contesta 404.
 */
export const maxDuration = 60;

export async function POST(peticion: Request): Promise<Response> {
  return responderMcp(peticion);
}

export async function GET(peticion: Request): Promise<Response> {
  return responderMcp(peticion);
}

export async function DELETE(peticion: Request): Promise<Response> {
  return responderMcp(peticion);
}
