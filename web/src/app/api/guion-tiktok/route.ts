import type { NextRequest } from "next/server";

import { responderGuionTikTok } from "@/lib/analisis/guion-tiktok";

/**
 * Guion para locucion de la pestana TikTok: los clips de un programa del canal
 * (`p=noticias33|deredenred`) sobre los videos del dia.
 *
 * Delgada como las demas. GET para que la respuesta se cachee por programa
 * durante un ciclo del cron: se pide con un boton, y el cache es lo que hace
 * que pulsarlo otra vez en el mismo ciclo no sea otra llamada de pago. `v` y
 * `g` (el `generado` del archivo) solo separan copias en el CDN.
 */
/** Un guion completo tarda mas que una ficha: ~2,000 tokens de salida. */
export const maxDuration = 60;

export async function GET(peticion: NextRequest): Promise<Response> {
  return responderGuionTikTok({ p: peticion.nextUrl.searchParams.get("p") });
}
