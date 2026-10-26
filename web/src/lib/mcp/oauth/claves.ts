/**
 * Lo criptografico del OAuth del MCP, todo con node:crypto y sin dependencia.
 *
 * El token de acceso es nuestro, no de Entra: el tablero es el servidor de
 * autorizacion (ver servidor.ts). Por eso basta una firma HMAC con una llave
 * derivada de AUTH_SECRET, la misma variable que ya firma la sesion de
 * Auth.js, separada por un prefijo para que una firma de un uso no valga en
 * el otro. Lo que viaja: quien (`sub`), para que servidor (`aud`, el MCP
 * canonico), quien lo emitio (`iss`), el cliente y el vencimiento. Nada mas.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SEGUNDOS_ACCESO = 3600;
/** Todo el tablero, desde el 26 de octubre de 2026 (antes «gasto», cuando el
 *  MCP solo contaba el gasto). Un token del alcance viejo deja de valer y
 *  Claude vuelve a pedir permiso, que es lo correcto: lo que se concede
 *  cambio. */
export const ALCANCE = "pulso";

const PREFIJO = "pmcp";

function b64(datos: Buffer | string): string {
  return Buffer.from(datos).toString("base64url");
}

/** Para que firma un valor. Cada uso tiene su llave: una solicitud de
 *  autorizacion firmada no puede presentarse como token de acceso. */
export type Uso = "acceso" | "solicitud";

function llave(secreto: string, uso: Uso): Buffer {
  return createHash("sha256").update(`pulso-mcp-${uso}|${secreto}`).digest();
}

/** Un valor opaco de 256 bits: un codigo o un token de refresco. */
export function aleatorio(): string {
  return randomBytes(32).toString("base64url");
}

/** Lo que se guarda de un valor opaco: su sha256 en hex. */
export function huellaDe(valor: string): string {
  return createHash("sha256").update(valor).digest("hex");
}

/** PKCE S256 (RFC 7636): BASE64URL(SHA256(verificador)) == desafio. El
 *  verificador mide de 43 a 128 caracteres del alfabeto sin reserva. */
export function pkceValido(verificador: string, desafio: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verificador)) return false;
  const calculado = Buffer.from(createHash("sha256").update(verificador).digest("base64url"));
  const esperado = Buffer.from(desafio);
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

export function desafioValido(desafio: string): boolean {
  return /^[A-Za-z0-9\-_]{43}$/.test(desafio);
}

export type Acceso = { sub: number; aud: string; iss: string; cid: string; scp: string; iat: number; exp: number };

export function firmar(datos: object, secreto: string, uso: Uso): string {
  const cuerpo = b64(JSON.stringify(datos));
  const firma = createHmac("sha256", llave(secreto, uso)).update(`${PREFIJO}.${cuerpo}`).digest("base64url");
  return `${PREFIJO}.${cuerpo}.${firma}`;
}

/** Lo firmado, si la firma es buena; null si no. No mira el vencimiento. */
export function leerFirmado<T>(token: string, secreto: string, uso: Uso): T | null {
  const partes = token.split(".");
  if (partes.length !== 3 || partes[0] !== PREFIJO) return null;
  const [, cuerpo = "", firma = ""] = partes;
  const esperada = Buffer.from(createHmac("sha256", llave(secreto, uso)).update(`${PREFIJO}.${cuerpo}`).digest("base64url"));
  const dada = Buffer.from(firma);
  if (dada.length !== esperada.length || !timingSafeEqual(dada, esperada)) return null;
  try {
    return JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function emitirAcceso(sub: number, aud: string, iss: string, cid: string, secreto: string, ahora = Date.now()): string {
  const iat = Math.floor(ahora / 1000);
  const datos: Acceso = { sub, aud, iss, cid, scp: ALCANCE, iat, exp: iat + SEGUNDOS_ACCESO };
  return firmar(datos, secreto, "acceso");
}

/**
 * Un token de acceso valido PARA ESTE servidor: firma, vencimiento, emisor y
 * audiencia. La audiencia es la que exige la especificacion de MCP («MUST
 * validate that access tokens were issued specifically for them»): un token
 * emitido para otro recurso no entra aunque la firma sea buena.
 */
export function verificarAcceso(token: string, aud: string, iss: string, secreto: string, ahora = Date.now()): Acceso | null {
  const a = leerFirmado<Acceso>(token, secreto, "acceso");
  if (a === null || typeof a.sub !== "number" || typeof a.exp !== "number") return null;
  if (a.exp <= Math.floor(ahora / 1000)) return null;
  if (a.aud !== aud || a.iss !== iss || a.scp !== ALCANCE) return null;
  return a;
}
