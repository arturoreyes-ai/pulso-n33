/**
 * Un servidor MCP para que el presidente de la empresa le pregunte a su
 * Claude cuanto cuesta Pulso N33 (pedido el 26 de octubre de 2026).
 *
 * Por que escrito a mano y no con el SDK de MCP: lo que hace falta es el
 * transporte «Streamable HTTP» en su forma sin estado —un POST con un
 * mensaje JSON-RPC y una respuesta JSON—, que la especificacion permite tal
 * cual: el servidor puede contestar `application/json` en vez de abrir un
 * flujo SSE, y no esta obligado a ofrecer el GET. Son cuatro metodos. El SDK
 * traeria su transporte con sesiones y zod como dependencia para eso, y este
 * repo prefiere el camino corto que ya se entiende (como el .docx escrito a
 * mano en documento-guion.ts).
 *
 * LA ENTRADA es OAuth con el tablero como servidor de autorizacion
 * (oauth/servidor.ts): sin token valido, 401 con `WWW-Authenticate` apuntando
 * a los metadatos, que es lo unico que hace a Claude abrir la ventana de
 * entrada. Hasta el 26 de octubre de 2026 fue una llave en `?llave=`, que la
 * especificacion y la guia de conectores prohiben (ver ese archivo).
 *
 * Lo que expone es dinero y nombres del equipo, nunca texto: ni comentarios,
 * ni terminos buscados, ni titulares. Las herramientas son de solo lectura.
 */

import type { Contexto } from "./comun";
import { correrHerramienta, HERRAMIENTAS } from "./herramientas";
import { verificarAcceso } from "./oauth/claves";
import { desafio401, origenPublico, puedeConectar, recursoDe, secretoMcp } from "./oauth/servidor";

/** De la mas nueva a la mas vieja. Si el cliente pide una que no esta, se le
 *  ofrece la primera y el decide (la negociacion de `initialize`). */
const VERSIONES = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const INSTRUCCIONES = [
  "Pulso N33 es el tablero de inteligencia regional de Tijuana–San Diego. Este servidor hace lo mismo que el tablero: leer noticias, redes, X, garitas, reportes y el seguimiento; generar guiones, analizar, seguir publicaciones y buscar en redes; administrar usuarios; y decir cuánto cuesta todo eso.",
  "Las herramientas cuyo título dice «(cuesta)» gastan dinero real. Antes de usar una, dile a la persona cuánto suele costar (está en su descripción y en cuanto_cuesta_cada_accion); después, dile lo que costó, que viene en la respuesta (costo_ia, costo o reservado_usd).",
  "Montos en dólares estadounidenses salvo el gasto electoral, que va en pesos; fechas en hora de Tijuana.",
  "«sin_dato» quiere decir que esa cifra no se registraba o no se pudo leer: no es cero, no lo reportes como cero.",
].join(" ");

/** El usuario del token, o por que no: sin token o con uno malo, 401 (que
 *  dispara la entrada); con uno bueno de alguien que ya no es administrador,
 *  403 sin desafio, que Claude muestra como error terminal. */
async function quienLlama(peticion: Request, secreto: string, origen: string): Promise<number | 401 | 403> {
  const cabecera = peticion.headers.get("authorization") ?? "";
  if (!cabecera.startsWith("Bearer ")) return 401;
  const acceso = verificarAcceso(cabecera.slice(7).trim(), recursoDe(origen), origen, secreto);
  if (acceso === null) return 401;
  return (await puedeConectar(acceso.sub)) ? acceso.sub : 403;
}

type Mensaje = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: unknown;
};

/** Las versiones que todavia admitian lotes JSON-RPC; 2025-06-18 los quito. */
const VERSIONES_CON_LOTES = new Set(["2025-03-26", "2024-11-05"]);

/**
 * La especificacion (Streamable HTTP, «Security Warning») exige rechazar con
 * 403 un `Origin` presente e invalido, contra el DNS rebinding. Claude llama
 * desde los servidores de Anthropic, sin `Origin`; un navegador si lo manda,
 * y solo se acepta el del propio tablero (el Inspector de MCP en local).
 */
export function origenValido(peticion: Request, propio: string): boolean {
  const origen = peticion.headers.get("origin");
  return origen === null || origen.toLowerCase() === propio;
}

const SIN_CACHE = { "Cache-Control": "no-store" };

function error(id: Mensaje["id"], codigo: number, mensaje: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code: codigo, message: mensaje } };
}

async function atender(m: Mensaje, contexto: Contexto): Promise<object | null> {
  // Una RESPUESTA del cliente (trae result o error y no method) se acepta y
  // no se contesta, igual que una notificacion: la especificacion pide 202.
  if (m.method === undefined && (m.result !== undefined || m.error !== undefined)) return null;
  // Una notificacion (sin id) no se contesta.
  const esNotificacion = m.id === undefined;
  if (m.jsonrpc !== "2.0" || typeof m.method !== "string") return esNotificacion ? null : error(m.id, -32600, "Petición inválida");
  if (esNotificacion) return null;
  switch (m.method) {
    case "initialize": {
      const pedida = typeof m.params?.protocolVersion === "string" ? m.params.protocolVersion : "";
      return {
        jsonrpc: "2.0",
        id: m.id,
        result: {
          protocolVersion: VERSIONES.includes(pedida) ? pedida : VERSIONES[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "pulso-n33", title: "Pulso N33", version: "2.0.0" },
          instructions: INSTRUCCIONES,
        },
      };
    }
    case "ping":
      return { jsonrpc: "2.0", id: m.id, result: {} };
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id: m.id,
        result: { tools: HERRAMIENTAS.map(({ correr: _correr, ...h }) => h) },
      };
    case "tools/call": {
      const nombre = typeof m.params?.name === "string" ? m.params.name : "";
      const args = m.params?.arguments;
      const argumentos = args !== null && typeof args === "object" && !Array.isArray(args) ? (args as Record<string, unknown>) : {};
      return { jsonrpc: "2.0", id: m.id, result: await correrHerramienta(nombre, argumentos, contexto) };
    }
    default:
      return error(m.id, -32601, `Método no disponible: ${m.method}`);
  }
}

export async function responderMcp(peticion: Request, entorno: NodeJS.ProcessEnv = process.env): Promise<Response> {
  const secreto = secretoMcp(entorno);
  if (secreto === null) return new Response(null, { status: 404, headers: SIN_CACHE });
  const origen = origenPublico(peticion.headers);
  if (!origenValido(peticion, origen)) {
    return Response.json(error(null, -32000, "Origen no permitido"), { status: 403, headers: SIN_CACHE });
  }
  const llamante = await quienLlama(peticion, secreto, origen);
  if (llamante === 401) {
    return Response.json({ error: "invalid_token", error_description: "Hace falta entrar" },
      { status: 401, headers: { ...SIN_CACHE, "WWW-Authenticate": desafio401(origen) } });
  }
  if (llamante === 403) {
    return Response.json(error(null, -32001, "Tu cuenta ya no es administradora del tablero."), { status: 403, headers: SIN_CACHE });
  }
  // El cliente manda la version negociada en cada peticion despues de
  // `initialize`; una que no se habla es 400, dice la especificacion. Sin la
  // cabecera se supone 2025-03-26.
  const version = peticion.headers.get("mcp-protocol-version");
  if (version !== null && !VERSIONES.includes(version)) {
    return Response.json(error(null, -32600, `Versión del protocolo no admitida: ${version}`), { status: 400, headers: SIN_CACHE });
  }
  if (peticion.method !== "POST") {
    // Sin flujo SSE del servidor: la especificacion pide 405 en ese caso.
    return new Response(null, { status: 405, headers: { ...SIN_CACHE, Allow: "POST" } });
  }
  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return Response.json(error(null, -32700, "JSON inválido"), { status: 400, headers: SIN_CACHE });
  }
  // Las versiones viejas del protocolo mandan lotes; desde 2025-06-18 el
  // cuerpo es UN mensaje.
  const lote = Array.isArray(cuerpo);
  if (lote && !VERSIONES_CON_LOTES.has(version ?? "2025-03-26")) {
    return Response.json(error(null, -32600, "Esta versión del protocolo no admite lotes"), { status: 400, headers: SIN_CACHE });
  }
  const mensajes = (lote ? cuerpo : [cuerpo]) as Mensaje[];
  const respuestas = (await Promise.all(mensajes.map((m) => atender(m ?? {}, { usuarioId: llamante, origen })))).filter((r) => r !== null);
  if (respuestas.length === 0) return new Response(null, { status: 202, headers: SIN_CACHE });
  return Response.json(lote ? respuestas : respuestas[0], { headers: SIN_CACHE });
}
