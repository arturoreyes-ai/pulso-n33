/**
 * Una seccion de Google Noticias en vivo: una edicion (a=mexico,
 * a=internacional), el corredor (a=region) o la seccion local de una zona
 * (z=<slug>), y encima un rubro opcional (t=clima|seguridad|deportes|
 * politica|economia) que la convierte en busqueda. Delgada a proposito: la
 * logica vive en lib/busqueda/actualidad.ts, que scripts/probar-busqueda.cjs
 * prueba sin red.
 *
 * Sin `dynamic` ni `revalidate`, por la razon escrita en buscar/route.ts.
 * proxy.ts ya exige sesion en todo /api/*.
 */

import type { NextRequest } from "next/server";

import { responderActualidad } from "@/lib/busqueda/actualidad";

/** Misma cuenta que buscar/route.ts: 6 s por feed y los dos en paralelo. */
export const maxDuration = 15;

export async function GET(peticion: NextRequest): Promise<Response> {
  const params = peticion.nextUrl.searchParams;
  return responderActualidad({ actualizar: params.get("actualizar") === "1", a: params.get("a"), z: params.get("z"), t: params.get("t") });
}
