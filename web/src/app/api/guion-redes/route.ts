import type { NextRequest } from "next/server";

import { responderGuionRedes } from "@/lib/analisis/guion-redes";

/**
 * Guion para locucion de /redes: las piezas de un programa del canal
 * (`p=noticias33|deredenred|minutapolitica|estadodealerta`) sobre TikTok,
 * Instagram, Facebook y lo muy visto de YouTube.
 *
 * Delgada como las demas. GET para que la respuesta se cachee por programa y
 * corte durante un ciclo del cron: se pide con un boton, y el cache es lo que
 * hace que pulsarlo otra vez no sea otra llamada de pago. `v` y `g` (los
 * cortes de las cuatro redes) solo separan copias en el CDN.
 */
/** Un guion completo tarda mas que una ficha: ~2,000 tokens de salida. */
export const maxDuration = 60;

export async function GET(peticion: NextRequest): Promise<Response> {
  return responderGuionRedes({ p: peticion.nextUrl.searchParams.get("p") });
}
