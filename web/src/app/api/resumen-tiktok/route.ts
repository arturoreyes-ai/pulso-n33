import type { NextRequest } from "next/server";

import { responderResumenTikTok } from "@/lib/analisis/resumen-tiktok";

/**
 * «Resumen con IA» de la pestana TikTok: de que hablan los videos mas vistos
 * de un lugar.
 *
 * Delgada como las demas. GET para que la respuesta se cachee por lugar y
 * ambito durante un ciclo del cron: la tarjeta la pide sola al abrirse
 * (decision del cliente del 23 de septiembre de 2026), asi que el cache es lo
 * que hace que eso cueste una llamada por lugar y ciclo y no una por visita.
 * `v` y `g` (el `generado` del archivo) solo separan copias en el CDN.
 */
export const maxDuration = 30;

export async function GET(peticion: NextRequest): Promise<Response> {
  const params = peticion.nextUrl.searchParams;
  return responderResumenTikTok({ z: params.get("z"), c: params.get("c") });
}
