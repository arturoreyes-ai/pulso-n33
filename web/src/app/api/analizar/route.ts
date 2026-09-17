import type { NextRequest } from "next/server";

import { responderAnalisis } from "@/lib/analisis/analizar";

/**
 * La lectura automatica de una nota enlazada.
 *
 * Delgada a proposito, como /api/buscar, /api/actualidad y /api/garitas: lee
 * los parametros y delega en una funcion con `solicitar` inyectado, que es lo
 * que la hace probable sin red.
 *
 * GET y no POST para que la respuesta se cachee por URL: una nota publicada no
 * cambia, y la segunda persona que pulse el boton sobre el mismo titular no
 * debe costar otra llamada de pago.
 *
 * Sin `dynamic` ni `revalidate`: los GET son dinamicos por omision y esas
 * opciones son legado. proxy.ts ya exige sesion para llegar aqui.
 */
export const maxDuration = 60;

export async function GET(peticion: NextRequest): Promise<Response> {
  const params = peticion.nextUrl.searchParams;
  return responderAnalisis({ u: params.get("u"), m: params.get("m"), d: params.get("d") });
}
