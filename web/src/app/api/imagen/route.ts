import type { NextRequest } from "next/server";

import { responderImagen } from "@/lib/busqueda/imagen-viva";

/**
 * La miniatura de una fila en vivo, leida del `og:image` del propio medio.
 *
 * Delgada a proposito, como /api/analizar, /api/buscar y /api/actualidad: lee
 * los parametros y delega en una funcion con `solicitar` inyectado, que es lo
 * que la hace probable sin red.
 *
 * GET y no POST para que la respuesta se cachee por URL: la foto de un
 * articulo publicado no cambia, y el segundo lector que se detenga en el mismo
 * titular no debe costar otra vuelta al medio.
 *
 * Sin llave de modelo y sin interruptor: esto no gasta. A diferencia de
 * /api/analizar, aqui no hay llamada de pago que proteger —es un GET publico—,
 * asi que la unica puerta es la sesion que ya exige proxy.ts.
 */
export const maxDuration = 30;

export async function GET(peticion: NextRequest): Promise<Response> {
  const params = peticion.nextUrl.searchParams;
  return responderImagen({ u: params.get("u"), d: params.get("d") });
}
