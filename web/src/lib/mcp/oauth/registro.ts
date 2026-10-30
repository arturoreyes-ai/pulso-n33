/**
 * Registro dinamico de clientes (RFC 7591), solo para los destinos de la
 * lista.
 *
 * EL CASO. El 30 de octubre de 2026 la credencial «MCP OAuth2 API» de n8n
 * fallo contra el MCP con «Invalid OAuth2 server metadata: expected string,
 * received undefined»: n8n se registra a si mismo y nuestros metadatos no
 * tenian `registration_endpoint`, porque hasta ese dia el MCP aceptaba solo
 * los dos documentos CIMD de Claude (clientes.ts). El usuario decidio que n8n
 * haga todo lo que hace Claude, acciones pagadas incluidas, con los mismos
 * topes: un flujo de n8n corre sin que nadie pulse, y eso deja atras, para el
 * MCP, el «nunca programado» del seguimiento (docs/PLAN.md lo anota).
 *
 * Por que acotado y no abierto: un registro abierto deja que cualquiera
 * consiga un client_id y mande a un administrador una pantalla de «Permitir»
 * que devuelve el codigo a SU servidor. Asi que cada `redirect_uri` tiene que
 * tener un origen de la lista (`MCP_DESTINOS_PERMITIDOS`, separados por coma;
 * por omision el n8n de la empresa), y se vuelve a revisar en cada
 * autorizacion: quitar un origen de la lista desconecta a sus clientes.
 *
 * Sin estado: el client_id ES el registro firmado (claves.ts, uso
 * «cliente»), asi que no hay tabla de clientes que mantener ni que purgar.
 * Quien lo altera rompe la firma. El cliente es publico (PKCE, sin secreto),
 * como el de Claude.
 */

import { firmar, leerFirmado } from "./claves";
import type { Cliente } from "./clientes";

/** El n8n de la empresa, dado por el usuario el 30 de octubre de 2026. */
const DESTINOS_POR_OMISION = ["https://n8n.viveenlabaja.mx"];

const PREFIJO_CLIENTE = "pdcr:";
const TOPE_DESTINOS = 5;
const TOPE_NOMBRE = 80;

export function destinosPermitidos(entorno: NodeJS.ProcessEnv = process.env): Set<string> {
  const lista = (entorno.MCP_DESTINOS_PERMITIDOS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return new Set(lista.length > 0 ? lista : DESTINOS_POR_OMISION);
}

function destinoPermitido(uri: string, permitidos: Set<string>): boolean {
  try {
    const u = new URL(uri);
    return u.protocol === "https:" && u.hash === "" && permitidos.has(u.origin.toLowerCase());
  } catch {
    return false;
  }
}

type Registro = { r: string[]; n: string; t: number };

export const esClienteRegistrado = (clientId: string) => clientId.startsWith(PREFIJO_CLIENTE);

/** El cliente que un client_id registrado lleva adentro, si la firma es buena
 *  y sus destinos SIGUEN en la lista. */
export function clienteRegistrado(clientId: string, secreto: string, entorno: NodeJS.ProcessEnv = process.env): Cliente | null {
  if (!esClienteRegistrado(clientId)) return null;
  const r = leerFirmado<Registro>(clientId.slice(PREFIJO_CLIENTE.length), secreto, "cliente");
  if (r === null || !Array.isArray(r.r) || r.r.length === 0) return null;
  const permitidos = destinosPermitidos(entorno);
  if (!r.r.every((u) => destinoPermitido(u, permitidos))) return null;
  return { client_id: clientId, client_name: r.n, redirect_uris: r.r };
}

function error(codigo: string, descripcion: string): Response {
  return Response.json({ error: codigo, error_description: descripcion }, { status: 400, headers: { "Cache-Control": "no-store" } });
}

export async function responderRegistro(peticion: Request, secreto: string, entorno: NodeJS.ProcessEnv = process.env): Promise<Response> {
  if (peticion.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await peticion.json()) as Record<string, unknown>;
  } catch {
    return error("invalid_client_metadata", "El cuerpo va como JSON.");
  }
  const uris = Array.isArray(cuerpo.redirect_uris) ? cuerpo.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  if (uris.length === 0 || uris.length > TOPE_DESTINOS) return error("invalid_redirect_uri", "Hace falta entre 1 y 5 redirect_uris.");
  const permitidos = destinosPermitidos(entorno);
  const fuera = uris.find((u) => !destinoPermitido(u, permitidos));
  if (fuera !== undefined) return error("invalid_redirect_uri", `Este servidor no acepta clientes que vuelvan a ${fuera}.`);
  const nombre = typeof cuerpo.client_name === "string" && cuerpo.client_name.trim() !== ""
    ? cuerpo.client_name.trim().slice(0, TOPE_NOMBRE)
    : new URL(uris[0]!).host;
  const emitido = Math.floor(Date.now() / 1000);
  const clientId = `${PREFIJO_CLIENTE}${firmar({ r: uris, n: nombre, t: emitido } satisfies Registro, secreto, "cliente")}`;
  return Response.json({
    client_id: clientId,
    client_id_issued_at: emitido,
    client_name: nombre,
    redirect_uris: uris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    // Cliente publico con PKCE, como el de Claude: no hay secreto que guardar.
    token_endpoint_auth_method: "none",
  }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
