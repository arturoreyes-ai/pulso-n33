import type { NextRequest } from "next/server";

import { responderAmpliar } from "@/lib/analisis/ampliar";

/**
 * «Ampliar» una nota del guion de prensa: la lee entera y la reescribe para
 * decirse (lib/analisis/ampliar.ts). Es la excepcion de /api/analizar, con su
 * misma lectura de la nota.
 *
 * Delgada como las demas. GET para que la respuesta se cachee por nota y por
 * programa: la segunda pulsacion sobre la misma nota no es otra llamada de
 * pago. `v` solo separa copias en el CDN. proxy.ts ya exige sesion.
 */
export const maxDuration = 60;

export async function GET(peticion: NextRequest): Promise<Response> {
  const params = peticion.nextUrl.searchParams;
  return responderAmpliar({ p: params.get("p"), u: params.get("u"), m: params.get("m"), d: params.get("d"), t: params.get("t") });
}
