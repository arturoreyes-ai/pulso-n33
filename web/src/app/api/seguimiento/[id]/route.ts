import type { NextRequest } from "next/server";

import { responderActualizar, responderBorrar, responderFicha } from "@/lib/seguimiento/responder";

/**
 * Una publicacion en seguimiento: su ficha (GET, que ademas avanza la lectura
 * que este corriendo), una lectura nueva (POST, pagada) y el borrado para
 * siempre (DELETE).
 *
 * 60 s: el GET que encuentra terminadas las corridas lee dos conjuntos de
 * datos y espera al servicio de tono, que en frio tarda ~10 s y despues ~120
 * ms por comentario.
 */
export const maxDuration = 60;

export async function GET(_: NextRequest, ctx: RouteContext<"/api/seguimiento/[id]">): Promise<Response> {
  const { id } = await ctx.params;
  return responderFicha(id);
}

export async function POST(_: NextRequest, ctx: RouteContext<"/api/seguimiento/[id]">): Promise<Response> {
  const { id } = await ctx.params;
  return responderActualizar(id);
}

export async function DELETE(_: NextRequest, ctx: RouteContext<"/api/seguimiento/[id]">): Promise<Response> {
  const { id } = await ctx.params;
  return responderBorrar(id);
}
