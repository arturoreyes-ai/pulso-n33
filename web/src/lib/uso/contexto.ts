/**
 * Quien hace la accion y cuanto va costando, mientras corre una herramienta
 * del MCP.
 *
 * El registro de IA (modelo.ts) sacaba a la persona de la sesion de Entra, y
 * una llamada del MCP no trae esa sesion: el costo se habria anotado sin
 * nadie. Aqui el MCP deja el id del token, y de paso junta lo que cuesta
 * cada llamada al modelo para decirlo en la respuesta de la herramienta,
 * que es lo que el dueno pidio el 26 de octubre de 2026: ver lo que cuesta
 * cada cosa al hacerla. Fuera del MCP no hay contexto y todo sigue igual.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export type CostoModelo = { accion: string; modelo: string; usd: number };
export type ContextoUso = { usuarioId: number; costos: CostoModelo[] };

const almacen = new AsyncLocalStorage<ContextoUso>();

export function conContexto<T>(contexto: ContextoUso, f: () => Promise<T>): Promise<T> {
  return almacen.run(contexto, f);
}

export function contextoActual(): ContextoUso | undefined {
  return almacen.getStore();
}
