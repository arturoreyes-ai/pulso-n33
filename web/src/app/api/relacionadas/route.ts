/**
 * Notas del archivo que hablan de lo mismo que un titular en vivo. Delgada a
 * proposito: la logica vive en lib/busqueda/relacionadas-viva.ts, que
 * scripts/probar-busqueda.cjs prueba sin disco.
 *
 * Sin `dynamic` ni `revalidate`, por la razon escrita en buscar/route.ts.
 * proxy.ts ya exige sesion en todo /api/*.
 */

import type { NextRequest } from "next/server";

import { responderRelacionadas } from "@/lib/busqueda/relacionadas-viva";

export async function GET(peticion: NextRequest): Promise<Response> {
  return responderRelacionadas({ t: peticion.nextUrl.searchParams.get("t") });
}
