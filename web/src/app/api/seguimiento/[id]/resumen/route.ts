import type { NextRequest } from "next/server";

import { responderResumir } from "@/lib/seguimiento/responder";

/**
 * El resumen de los comentarios de una publicacion en seguimiento, cuando no
 * salio con su ultima lectura. POST porque es una llamada de pago a un modelo,
 * como toda lectura con IA del tablero: detras de un boton.
 */
export const maxDuration = 30;

export async function POST(_: NextRequest, ctx: RouteContext<"/api/seguimiento/[id]/resumen">): Promise<Response> {
  const { id } = await ctx.params;
  return responderResumir(id);
}
