/**
 * Cuanto costo cada llamada al modelo, anotado en `uso_modelo`
 * (db/0005_uso_modelo.sql).
 *
 * EL CASO. El 26 de octubre de 2026 el presidente de la empresa pidio ver
 * desde su Claude cuanto cuesta cada accion del tablero (app/api/mcp). Apify
 * se podia contestar: tiene libro propio (busquedas_redes, gasto_seguimiento)
 * y su cuenta dice lo cobrado. Anthropic no: seis lugares llamaban al modelo
 * y ninguno guardaba `usage`, asi que «cuanto cuesta un guion» era el
 * comentario de config.ts («~$0.02») y no una medida.
 *
 * Lo que NO hace, a proposito:
 *  - No guarda texto: ni lo enviado, ni lo contestado, ni el termino. Solo
 *    tokens, dolares, la etiqueta fija de la accion y quien pulso.
 *  - No frena ni retrasa la respuesta. Se escribe con `after()` cuando hay
 *    peticion; un fallo de la base se traga, porque una lectura que el
 *    lector ya pago no se pierde por no poder anotarla.
 *  - No se carga en las pruebas: sin base de datos regresa de inmediato, y
 *    la sesion y `after` se importan solo despues de esa comprobacion, para
 *    que los probar-*.cjs no arrastren next-auth.
 */

import { hayBaseDeDatos, sql } from "@/lib/acceso/bd";
import { contextoActual } from "./contexto";

/** Dolares por millon de tokens, precio de lista de Anthropic al 26 de
 *  octubre de 2026. La escritura de cache cuesta 1.25 veces la entrada (TTL
 *  de 5 minutos) y la lectura 0.1 veces. Se busca por prefijo para que un id
 *  con fecha («claude-haiku-4-5-20251001») encuentre su fila. */
export const PRECIOS: readonly { prefijo: string; entrada: number; salida: number }[] = [
  { prefijo: "claude-haiku-4-5", entrada: 1, salida: 5 },
  { prefijo: "claude-haiku-5-5", entrada: 0.1, salida: 0.5 },
  { prefijo: "claude-sonnet-5-5", entrada: 2, salida: 10 },
  { prefijo: "claude-sonnet-5", entrada: 2, salida: 10 },
  { prefijo: "claude-sonnet-4-6", entrada: 3, salida: 15 },
  { prefijo: "claude-opus-5-5", entrada: 4, salida: 20 },
  { prefijo: "claude-opus-5", entrada: 5, salida: 25 },
];

const FACTOR_ESCRITURA_CACHE = 1.25;
const FACTOR_LECTURA_CACHE = 0.1;

export type Uso = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

function entero(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** El precio de un modelo. El prefijo mas largo gana: «claude-sonnet-5»
 *  no debe cobrar un «claude-sonnet-5-5». Un modelo desconocido es `null`,
 *  y su fila se anota a precio de Sonnet 5.5. */
export function precioDe(modelo: string): { entrada: number; salida: number } | null {
  let mejor: (typeof PRECIOS)[number] | null = null;
  for (const p of PRECIOS) {
    if (modelo.startsWith(p.prefijo) && (mejor === null || p.prefijo.length > mejor.prefijo.length)) mejor = p;
  }
  return mejor;
}

export function costoDe(modelo: string, uso: Uso): number {
  const p = precioDe(modelo) ?? { entrada: 2, salida: 10 };
  const millon = 1_000_000;
  return (
    (entero(uso.input_tokens) * p.entrada
      + entero(uso.cache_creation_input_tokens) * p.entrada * FACTOR_ESCRITURA_CACHE
      + entero(uso.cache_read_input_tokens) * p.entrada * FACTOR_LECTURA_CACHE
      + entero(uso.output_tokens) * p.salida) / millon
  );
}

async function quienPulso(): Promise<number | null> {
  try {
    const { usuarioActual } = await import("@/lib/acceso/sesion");
    return (await usuarioActual()).id;
  } catch {
    return null;
  }
}

async function escribir(accion: string, modelo: string, uso: Uso, negativa: boolean, usuarioId: number | null): Promise<void> {
  try {
    await sql()`
      INSERT INTO uso_modelo (accion, modelo, usuario_id, tokens_entrada, tokens_salida,
                              tokens_cache_escritura, tokens_cache_lectura, usd, negativa)
      VALUES (${accion.slice(0, 48)}, ${modelo.slice(0, 64)}, ${usuarioId},
              ${entero(uso.input_tokens)}, ${entero(uso.output_tokens)},
              ${entero(uso.cache_creation_input_tokens)}, ${entero(uso.cache_read_input_tokens)},
              ${costoDe(modelo, uso)}, ${negativa})`;
  } catch {
    // Ver el encabezado: anotar no puede tumbar una respuesta ya pagada.
  }
}

/**
 * Anota una respuesta del Messages API. `cuerpo` es el JSON tal como llego;
 * se lee `model`, `usage` y `stop_reason` y nada mas. `modeloPedido` cubre la
 * respuesta que no trae `model`.
 */
export async function anotarUsoModelo(accion: string, modeloPedido: string, cuerpo: unknown): Promise<void> {
  if (cuerpo === null || typeof cuerpo !== "object") return;
  const r = cuerpo as { model?: unknown; usage?: Uso; stop_reason?: unknown };
  if (r.usage === undefined) return;
  const modelo = typeof r.model === "string" && r.model !== "" ? r.model : modeloPedido;
  const uso = r.usage;
  const negativa = r.stop_reason === "refusal";
  // Dentro del MCP: la persona es la del token y el costo se le devuelve a
  // la herramienta (contexto.ts). Se toma AHORA, antes de `after`.
  const contexto = contextoActual();
  contexto?.costos.push({ accion, modelo, usd: costoDe(modelo, uso) });
  if (!hayBaseDeDatos()) return;
  try {
    const { after } = await import("next/server");
    after(async () => escribir(accion, modelo, uso, negativa, contexto ? contexto.usuarioId : await quienPulso()));
  } catch {
    // Fuera de una peticion (un script): se escribe ahora.
    await escribir(accion, modelo, uso, negativa, contexto?.usuarioId ?? null);
  }
}
