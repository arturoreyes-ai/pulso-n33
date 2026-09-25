import type { NextRequest } from "next/server";

import { responderGuionPrensa } from "@/lib/analisis/guion-prensa";

/**
 * Guion para locucion de la portada: las notas de un programa del canal
 * (`p=noticias33|deredenred|minutapolitica|estadodealerta`) sobre los
 * titulares en vivo.
 *
 * Delgada como las demas. GET para que la respuesta se cachee por programa y
 * por hora: se pide con un boton, y el cache es lo que hace que pulsarlo otra
 * vez en la misma hora no sea otra llamada de pago. `v` y `g` (la hora) solo
 * separan copias en el CDN.
 */
/** Seis segundos de feeds en paralelo y hasta cincuenta del modelo. */
export const maxDuration = 60;

export async function GET(peticion: NextRequest): Promise<Response> {
  return responderGuionPrensa({ p: peticion.nextUrl.searchParams.get("p") });
}
