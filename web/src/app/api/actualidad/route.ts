/**
 * La seccion de Google Noticias de Mexico o del mundo, en vivo. Delgada a
 * proposito: la logica vive en lib/busqueda/actualidad.ts, que
 * scripts/probar-busqueda.cjs prueba sin red.
 *
 * Sin `dynamic` ni `revalidate`, por la razon escrita en buscar/route.ts.
 * proxy.ts ya exige sesion en todo /api/*.
 */

import type { NextRequest } from "next/server";

import { responderActualidad } from "@/lib/busqueda/actualidad";

/** Misma cuenta que buscar/route.ts: 6 s por feed y los dos en paralelo. */
export const maxDuration = 15;

export async function GET(peticion: NextRequest): Promise<Response> {
  return responderActualidad(peticion.nextUrl.searchParams.get("a"));
}
