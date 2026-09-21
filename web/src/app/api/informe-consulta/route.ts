import type { NextRequest } from "next/server";

import { responderInformeConsulta } from "@/lib/informe/informe";

/**
 * El informe en PDF de un termino en seguimiento.
 *
 * Delgada como las demas rutas de analisis. GET para que el CDN guarde la
 * respuesta por termino durante un ciclo de la ingesta: la primera descarga
 * paga la lectura automatica y las demas reciben la copia. `v` solo separa
 * copias cuando cambia el documento. Un minuto porque el render y el modelo
 * van en serie; medido, el render de un termino esta debajo de dos segundos.
 */
export const maxDuration = 60;

export async function GET(peticion: NextRequest): Promise<Response> {
  return responderInformeConsulta({ c: peticion.nextUrl.searchParams.get("c") });
}
