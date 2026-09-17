import type { NextRequest } from "next/server";

import { responderAnalisisConversacion } from "@/lib/analisis/conversacion";

/**
 * «De que se habla»: la lectura de los comentarios de toda una seleccion.
 *
 * Delgada como las demas. GET para que la respuesta se cachee por lugar y
 * ambito durante un ciclo del cron: la primera persona que pulse paga la
 * llamada y las demas leen la copia, que es lo que hace que un boton cueste lo
 * mismo que un trabajo de fondo sin serlo. `v` solo separa copias en el CDN.
 */
export const maxDuration = 30;

export async function GET(peticion: NextRequest): Promise<Response> {
  const params = peticion.nextUrl.searchParams;
  return responderAnalisisConversacion({ z: params.get("z"), c: params.get("c") });
}
