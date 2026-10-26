/**
 * Lo que comparten todas las herramientas del MCP.
 *
 * Desde el 26 de octubre de 2026 el MCP hace todo lo que hace el tablero, no
 * solo contar el gasto (pedido del dueno: «que pueda hacer todo, y que vea
 * cuanto cuesta para tomarlo en cuenta»). Cada herramienta llama a la MISMA
 * funcion que la ruta del sitio (`responder*`), con sus interruptores, topes y
 * libros: el MCP no tiene un camino propio que pueda saltarse un limite.
 *
 * Tres clases, y la anotacion es lo que hace que Claude pida o no permiso
 * (guia de conectores de Anthropic: «Read-only tools can run without
 * per-call confirmation, and destructive tools always prompt»):
 *  - LECTURA: no cuesta y no cambia nada.
 *  - PAGO: gasta dinero (Apify o IA). Su descripcion dice cuanto ANTES de
 *    usarla y su respuesta dice cuanto costo DESPUES.
 *  - DESTRUCTIVA: borra o cambia algo que no se recupera solo.
 */

/** Quien llama (el id del token) y el origen publico del sitio, para
 *  devolver enlaces que se abren en el navegador. */
export type Contexto = { usuarioId: number; origen: string };

export type Herramienta = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: Record<string, boolean | string>;
  correr: (a: Record<string, unknown>, c: Contexto) => Promise<unknown>;
};

export const LECTURA = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
export const PAGO = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };
export const DESTRUCTIVA = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };

export const objeto = (properties: Record<string, unknown>, required: string[] = []) =>
  ({ type: "object", properties, ...(required.length > 0 ? { required } : {}), additionalProperties: false });

/** Un error de la accion, dicho para el modelo: se devuelve como `isError`
 *  y no se registra como fallo del servidor. */
export class ErrorDeAccion extends Error {}

export function texto(a: Record<string, unknown>, campo: string): string | null {
  const v = a[campo];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export function requerido(a: Record<string, unknown>, campo: string): string {
  const v = texto(a, campo);
  if (v === null) throw new ErrorDeAccion(`Falta «${campo}».`);
  return v;
}

export function entero(a: Record<string, unknown>, campo: string, porOmision: number, maximo: number): number {
  const n = Math.trunc(Number(a[campo] ?? porOmision));
  return Number.isFinite(n) && n > 0 ? Math.min(n, maximo) : porOmision;
}

/**
 * El cuerpo de una respuesta del sitio, o el error que dice. Varias rutas
 * contestan 200 con `{codigo, mensaje}` cuando algo falla (el guion, por
 * ejemplo, para no cachear el fallo como 4xx): eso tambien es error aqui.
 */
export async function leerRespuesta(r: Response): Promise<unknown> {
  const tipo = r.headers.get("content-type") ?? "";
  const datos: unknown = tipo.includes("json") ? await r.json().catch(() => null) : null;
  const o = datos !== null && typeof datos === "object" && !Array.isArray(datos) ? (datos as Record<string, unknown>) : null;
  const mensaje = o && (typeof o.mensaje === "string" ? o.mensaje : typeof o.detalle === "string" ? o.detalle : null);
  const soloError = o !== null && typeof o.codigo === "string" && mensaje !== null && Object.keys(o).length <= 3;
  if (!r.ok || soloError) throw new ErrorDeAccion(mensaje ?? `El tablero contestó ${r.status}.`);
  return datos;
}
