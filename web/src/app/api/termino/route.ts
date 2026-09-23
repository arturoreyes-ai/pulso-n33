import type { NextRequest } from "next/server";

import { responderTermino } from "@/lib/busqueda/termino";

/**
 * La mitad gratuita de la busqueda de un termino en Redes: la prensa de seis
 * meses con su tono, lo que el panel de redes ya cosecho que lo nombra y las
 * tendencias de X. La mitad pagada es /api/redes-en-vivo, detras de un boton.
 *
 * Delgada como /api/buscar: la logica vive en lib/busqueda/termino.ts, que
 * scripts/probar-redes-en-vivo.cjs prueba sin red ni disco. proxy.ts ya
 * exige sesion para llegar aqui.
 *
 * 60 s y no 15: ademas de los feeds, espera al servicio de tono, cuyo arranque
 * en frio carga el modelo (lib/tono/servicio.ts corta cada lote a los 40 s y
 * el tono sale «sin tono», nunca neutral).
 */
export const maxDuration = 60;

export async function GET(peticion: NextRequest): Promise<Response> {
  return responderTermino(peticion.nextUrl.searchParams.get("q"));
}
