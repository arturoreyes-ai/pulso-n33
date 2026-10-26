/**
 * La solicitud de autorizacion que llega a /mcp/autorizar, revisada antes de
 * ensenar nada (OAuth 2.1, seccion 4.1.2.1):
 *
 *  - Si el cliente o el `redirect_uri` no son validos, NO se redirige: se
 *    dice en pantalla. Redirigir a un destino no verificado convierte la
 *    pantalla en una redireccion abierta.
 *  - Cualquier otro error, con el destino ya verificado, vuelve al cliente
 *    como `?error=` con su `state`, que es como Claude se entera.
 *
 * La solicitud aprobada viaja al formulario FIRMADA (claves.ts, uso
 * «solicitud») con quien la vio y su vencimiento: la accion de servidor no
 * vuelve a confiar en campos del formulario.
 */

import { desafioValido, firmar, leerFirmado } from "./claves";
import { leerCliente, redirectPermitido } from "./clientes";
import { recursoAceptado, recursoDe } from "./servidor";

const MINUTOS_SOLICITUD = 10;

export type Solicitud = {
  clienteId: string;
  clienteNombre: string;
  /** El host del client_id, que es lo que se nombra en pantalla: el nombre
   *  del documento lo escribe el propio cliente. */
  clienteHost: string;
  redirectUri: string;
  desafio: string;
  estado: string | null;
  recurso: string;
};

export type Revision =
  | { tipo: "pantalla"; mensaje: string }
  | { tipo: "regreso"; url: string }
  | { tipo: "ok"; solicitud: Solicitud };

/** La URL de vuelta al cliente, con `iss` (RFC 9207) para que el cliente
 *  sepa que servidor contesto. */
export function urlDeRegreso(redirectUri: string, valores: Record<string, string | null>, origen: string): string {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(valores)) if (v !== null) u.searchParams.set(k, v);
  u.searchParams.set("iss", origen);
  return u.toString();
}

export async function revisarSolicitud(
  p: Record<string, string | undefined>,
  origen: string,
  solicitar: typeof fetch = fetch,
): Promise<Revision> {
  const clienteId = p.client_id ?? "";
  const cliente = await leerCliente(clienteId, solicitar);
  if (cliente === null) return { tipo: "pantalla", mensaje: "Esta aplicación no está autorizada para conectarse al tablero." };
  const redirectUri = p.redirect_uri ?? "";
  if (!redirectPermitido(redirectUri, cliente.redirect_uris)) {
    return { tipo: "pantalla", mensaje: "La dirección de regreso no corresponde a la aplicación." };
  }
  const estado = p.state ?? null;
  const volver = (error: string, descripcion: string): Revision => ({
    tipo: "regreso",
    url: urlDeRegreso(redirectUri, { error, error_description: descripcion, state: estado }, origen),
  });
  if (p.response_type !== "code") return volver("unsupported_response_type", "Solo response_type=code.");
  // PKCE obligatorio y solo S256: OAuth 2.1 y la guia de conectores.
  if (p.code_challenge_method !== "S256" || !desafioValido(p.code_challenge ?? "")) {
    return volver("invalid_request", "Hace falta PKCE con S256.");
  }
  if (!recursoAceptado(p.resource ?? null, origen)) return volver("invalid_target", "Este servidor solo autoriza su MCP.");
  return {
    tipo: "ok",
    solicitud: {
      clienteId,
      clienteNombre: cliente.client_name,
      clienteHost: new URL(clienteId).host,
      redirectUri,
      desafio: p.code_challenge ?? "",
      estado,
      recurso: recursoDe(origen),
    },
  };
}

type Firmada = Solicitud & { u: number; exp: number };

export function firmarSolicitud(s: Solicitud, usuarioId: number, secreto: string, ahora = Date.now()): string {
  const firmada: Firmada = { ...s, u: usuarioId, exp: Math.floor(ahora / 1000) + MINUTOS_SOLICITUD * 60 };
  return firmar(firmada, secreto, "solicitud");
}

/** La solicitud firmada, si es de esta persona y no vencio. */
export function leerSolicitud(valor: string, usuarioId: number, secreto: string, ahora = Date.now()): Solicitud | null {
  const f = leerFirmado<Firmada>(valor, secreto, "solicitud");
  if (f === null || f.u !== usuarioId || f.exp <= Math.floor(ahora / 1000)) return null;
  const { u: _u, exp: _exp, ...solicitud } = f;
  return solicitud;
}
