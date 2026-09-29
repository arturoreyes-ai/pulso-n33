import type { NextRequest } from "next/server";

import { responderAgregar, responderLista } from "@/lib/seguimiento/responder";

/**
 * La lista de publicaciones en seguimiento (GET) y el alta de una (POST con
 * `{ url, idioma }`), que arranca su primera lectura pagada.
 *
 * Delgada como las demas: la logica, el tope y la razon de cada cosa viven en
 * lib/seguimiento/responder.ts, que scripts/probar-seguimiento.cjs prueba sin
 * red ni base de datos. proxy.ts exige sesion para llegar aqui.
 */
export const maxDuration = 30;

export async function GET(): Promise<Response> {
  return responderLista();
}

export async function POST(peticion: NextRequest): Promise<Response> {
  let cuerpo: unknown = null;
  try {
    cuerpo = await peticion.json();
  } catch {
    cuerpo = null;
  }
  return responderAgregar(cuerpo);
}
