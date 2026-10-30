/**
 * El tablero como servidor de autorizacion OAuth 2.1 de su propio MCP.
 *
 * EL CASO. La primera version (26 de octubre de 2026) pedia una llave en
 * `?llave=`, porque un conector personalizado de claude.ai solo recibe una
 * URL. Revisado ese mismo dia contra la especificacion de MCP y la guia de
 * conectores de Anthropic, las dos lo prohiben: un token en la query acaba en
 * logs, proxies e historiales. La guia ofrece cabeceras fijas, pero estan en
 * beta para pocas organizaciones.
 *
 * Por que no Entra directo, que ya es la entrada del tablero: Entra no acepta
 * como Application ID URI una URL de *.vercel.app (pide un dominio verificado
 * del tenant) y su documento de descubrimiento no anuncia
 * `code_challenge_methods_supported`, que la especificacion ordena revisar al
 * cliente antes de seguir. Asi que el tablero emite sus propios tokens y
 * DELEGA la identidad: /mcp/autorizar esta detras de proxy.ts como cualquier
 * pagina, y quien llega ya entro con Microsoft. Solo un administrador activo
 * y aprobado recibe codigo.
 *
 * Lo que hay aqui, con lo que pide Anthropic para un conector:
 *  - descubrimiento: RFC 9728 (recurso) y RFC 8414 (servidor), con
 *    `client_id_metadata_document_supported` y `"none"` como metodo del
 *    token, las dos marcas con que Claude elige CIMD;
 *  - codigo de autorizacion con PKCE S256 obligatorio, de un solo uso;
 *  - refresco rotado, con deteccion de reuso por familia;
 *  - el token: `application/x-www-form-urlencoded`, errores de RFC 6749.
 */

import { hayBaseDeDatos, sql } from "@/lib/acceso/bd";
import { buscarUsuarioPorId } from "@/lib/acceso/usuarios";
import { aleatorio, ALCANCE, emitirAcceso, huellaDe, pkceValido, SEGUNDOS_ACCESO } from "./claves";

export const RUTA_MCP = "/api/mcp";
export const RUTA_AUTORIZAR = "/mcp/autorizar";
export const RUTA_TOKEN = "/api/mcp/token";
export const RUTA_REGISTRO = "/api/mcp/registro";
export const RUTA_METADATOS_RECURSO = "/.well-known/oauth-protected-resource/api/mcp";

const SEGUNDOS_CODIGO = 120;
const DIAS_REFRESCO = 30;

/** Encendido con MCP_HABILITADO=true, AUTH_SECRET y base de datos. Apagado,
 *  todas las rutas del MCP contestan 404: no existen. */
export function secretoMcp(entorno: NodeJS.ProcessEnv = process.env): string | null {
  if (entorno.MCP_HABILITADO !== "true") return null;
  const secreto = (entorno.AUTH_SECRET ?? "").trim();
  if (secreto.length < 32 || !hayBaseDeDatos()) return null;
  return secreto;
}

/**
 * El origen publico, de las cabeceras de la peticion: en Vercel es el alias
 * por el que entro (pulso-n33.vercel.app). Emisor, recurso y metadatos salen
 * todos de aqui, asi que son coherentes entre si sea cual sea el alias.
 * Minusculas, sin puerto por omision: la forma canonica de RFC 8707.
 */
export function origenPublico(cabeceras: Headers): string {
  const host = (cabeceras.get("x-forwarded-host") ?? cabeceras.get("host") ?? "").split(",")[0]!.trim().toLowerCase();
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = (cabeceras.get("x-forwarded-proto") ?? (local ? "http" : "https")).split(",")[0]!.trim();
  return new URL(`${proto}://${host}`).origin;
}

export const recursoDe = (origen: string) => `${origen}${RUTA_MCP}`;

export function metadatosRecurso(origen: string) {
  return {
    resource: recursoDe(origen),
    authorization_servers: [origen],
    scopes_supported: [ALCANCE],
    bearer_methods_supported: ["header"],
    resource_name: "Pulso N33",
  };
}

export function metadatosServidor(origen: string) {
  return {
    issuer: origen,
    authorization_endpoint: `${origen}${RUTA_AUTORIZAR}`,
    token_endpoint: `${origen}${RUTA_TOKEN}`,
    scopes_supported: [ALCANCE],
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    // n8n se registra solo (registro.ts); Claude sigue eligiendo CIMD.
    registration_endpoint: `${origen}${RUTA_REGISTRO}`,
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
  };
}

/** El `WWW-Authenticate` de un 401: Claude solo arranca la entrada con un
 *  401 que apunte a los metadatos del recurso. */
export function desafio401(origen: string): string {
  return `Bearer error="invalid_token", error_description="Hace falta entrar", resource_metadata="${origen}${RUTA_METADATOS_RECURSO}", scope="${ALCANCE}"`;
}

/** El `resource` que manda el cliente tiene que ser este MCP; sin el, se
 *  entiende este. */
export function recursoAceptado(pedido: string | null, origen: string): boolean {
  if (pedido === null || pedido === "") return true;
  try {
    const u = new URL(pedido);
    return `${u.origin}${u.pathname.replace(/\/$/, "")}` === recursoDe(origen) && u.search === "" && u.hash === "";
  } catch {
    return false;
  }
}

// === Almacen =================================================================

export async function guardarCodigo(d: {
  usuarioId: number; clienteId: string; redirectUri: string; desafio: string; recurso: string;
}): Promise<string> {
  const codigo = aleatorio();
  await sql()`
    INSERT INTO mcp_oauth (huella, tipo, usuario_id, cliente_id, redirect_uri, desafio, recurso, familia, expira_en)
    VALUES (${huellaDe(codigo)}, 'codigo', ${d.usuarioId}, ${d.clienteId}, ${d.redirectUri}, ${d.desafio}, ${d.recurso},
            gen_random_uuid(), now() + make_interval(secs => ${SEGUNDOS_CODIGO}))`;
  return codigo;
}

type Fila = { usuario_id: number; cliente_id: string; redirect_uri: string | null; desafio: string | null; recurso: string; familia: string };

/** Marca usado y devuelve, en una sola sentencia: dos canjes simultaneos del
 *  mismo valor no pueden ganar los dos. */
async function canjear(valor: string, tipo: "codigo" | "refresco"): Promise<Fila | null> {
  const [fila] = (await sql()`
    UPDATE mcp_oauth SET usado_en = now()
     WHERE huella = ${huellaDe(valor)} AND tipo = ${tipo} AND usado_en IS NULL AND expira_en > now()
     RETURNING usuario_id, cliente_id, redirect_uri, desafio, recurso, familia`) as Fila[];
  return fila ?? null;
}

/** Un refresco ya usado que vuelve a llegar fue copiado: se quema la familia. */
async function quemarSiReusado(valor: string): Promise<void> {
  await sql()`
    UPDATE mcp_oauth SET usado_en = COALESCE(usado_en, now())
     WHERE familia = (SELECT familia FROM mcp_oauth WHERE huella = ${huellaDe(valor)} AND tipo = 'refresco' AND usado_en IS NOT NULL)`;
}

async function guardarRefresco(usuarioId: number, clienteId: string, recurso: string, familia: string): Promise<string> {
  const refresco = aleatorio();
  await sql()`
    INSERT INTO mcp_oauth (huella, tipo, usuario_id, cliente_id, recurso, familia, expira_en)
    VALUES (${huellaDe(refresco)}, 'refresco', ${usuarioId}, ${clienteId}, ${recurso}, ${familia}::uuid,
            now() + make_interval(days => ${DIAS_REFRESCO}))`;
  return refresco;
}

async function purgarVencidos(): Promise<void> {
  try {
    await sql()`DELETE FROM mcp_oauth WHERE expira_en < now() - interval '1 day'`;
  } catch {
    // Barrer es higiene; no tumba un canje.
  }
}

// === El token ================================================================

const SIN_CACHE = { "Cache-Control": "no-store", Pragma: "no-cache" };

function errorToken(error: string, descripcion: string, estado = 400): Response {
  return Response.json({ error, error_description: descripcion }, { status: estado, headers: SIN_CACHE });
}

/** Quien puede tener token: administrador, activo y aprobado. Se vuelve a
 *  mirar en cada canje y en cada llamada al MCP. */
export async function puedeConectar(usuarioId: number): Promise<boolean> {
  const u = await buscarUsuarioPorId(usuarioId);
  return u !== null && u.activo && u.aprobado && u.rol === "admin";
}

function clienteDeBasic(cabecera: string | null): string | null {
  if (cabecera === null || !cabecera.startsWith("Basic ")) return null;
  try {
    const [id] = Buffer.from(cabecera.slice(6).trim(), "base64").toString("utf8").split(":");
    return id ? decodeURIComponent(id) : null;
  } catch {
    return null;
  }
}

export async function responderToken(peticion: Request, entorno: NodeJS.ProcessEnv = process.env): Promise<Response> {
  const secreto = secretoMcp(entorno);
  if (secreto === null) return new Response(null, { status: 404 });
  if (peticion.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  if (!(peticion.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded")) {
    return errorToken("invalid_request", "El cuerpo va como application/x-www-form-urlencoded.");
  }
  const origen = origenPublico(peticion.headers);
  const f = new URLSearchParams(await peticion.text());
  // Un cliente publico lo manda en el cuerpo; algunos (como puede hacer n8n)
  // lo mandan en una cabecera Basic. El secreto, si viene, no se usa: nadie
  // lo tiene, el cliente es publico y lo que prueba quien es es el PKCE.
  const clienteId = f.get("client_id") ?? clienteDeBasic(peticion.headers.get("authorization")) ?? "";
  if (!recursoAceptado(f.get("resource"), origen)) return errorToken("invalid_target", "Este servidor solo emite tokens para su MCP.");

  const entregar = async (usuarioId: number, familia: string) => {
    // Se barre aqui y no al entrar: una peticion mal formada no toca la base.
    void purgarVencidos();
    const refresco = await guardarRefresco(usuarioId, clienteId, recursoDe(origen), familia);
    return Response.json({
      access_token: emitirAcceso(usuarioId, recursoDe(origen), origen, clienteId, secreto),
      token_type: "Bearer",
      expires_in: SEGUNDOS_ACCESO,
      refresh_token: refresco,
      scope: ALCANCE,
    }, { headers: SIN_CACHE });
  };

  switch (f.get("grant_type")) {
    case "authorization_code": {
      const codigo = f.get("code") ?? "";
      const verificador = f.get("code_verifier") ?? "";
      if (codigo === "" || verificador === "") return errorToken("invalid_request", "Faltan code o code_verifier.");
      const fila = await canjear(codigo, "codigo");
      if (fila === null) return errorToken("invalid_grant", "El código no existe, venció o ya se usó.");
      if (fila.cliente_id !== clienteId || fila.redirect_uri !== f.get("redirect_uri")) {
        return errorToken("invalid_grant", "El código se emitió para otro cliente o destino.");
      }
      if (fila.desafio === null || !pkceValido(verificador, fila.desafio)) return errorToken("invalid_grant", "El code_verifier no corresponde.");
      if (!(await puedeConectar(fila.usuario_id))) return errorToken("invalid_grant", "La cuenta ya no es administradora del tablero.");
      return entregar(fila.usuario_id, fila.familia);
    }
    case "refresh_token": {
      const valor = f.get("refresh_token") ?? "";
      if (valor === "") return errorToken("invalid_request", "Falta refresh_token.");
      const fila = await canjear(valor, "refresco");
      if (fila === null) {
        await quemarSiReusado(valor);
        return errorToken("invalid_grant", "El token de refresco no existe, venció o ya se usó.");
      }
      if (fila.cliente_id !== clienteId) return errorToken("invalid_grant", "El token se emitió para otro cliente.");
      if (!(await puedeConectar(fila.usuario_id))) return errorToken("invalid_grant", "La cuenta ya no es administradora del tablero.");
      return entregar(fila.usuario_id, fila.familia);
    }
    default:
      return errorToken("unsupported_grant_type", "Se aceptan authorization_code y refresh_token.");
  }
}
