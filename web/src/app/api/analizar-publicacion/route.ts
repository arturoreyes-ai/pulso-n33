import type { NextRequest } from "next/server";

import { responderAnalisisPublicacion } from "@/lib/analisis/publicacion";

/**
 * La lectura automatica de una publicacion de Instagram o TikTok.
 *
 * Ruta aparte y no un modo de /api/analizar, aunque compartan la mitad de la
 * forma. Lo que define a aquella es que SI abre la nota de un tercero; lo que
 * define a esta es que NO abre nada. Ramificar las dos dentro de un `if`
 * pondria las dos afirmaciones detras de la misma condicion, y la prueba
 * offline ya no podria decir «esta entrada hizo exactamente una peticion, y
 * fue a la API del modelo». Asi la postura legal es una propiedad del archivo.
 *
 * Delgada como /api/buscar, /api/actualidad y /api/garitas: lee los parametros
 * y delega en una funcion con `solicitar` y `leer` inyectados.
 *
 * GET y no POST para que la respuesta se cachee por URL: la segunda persona
 * que pulse el boton sobre el mismo video no debe costar otra llamada de pago.
 * `v` y `g` no se leen aqui —solo separan copias en el CDN—; no son parametros
 * muertos que convenga limpiar.
 *
 * proxy.ts ya exige sesion para llegar aqui.
 */
export const maxDuration = 30;

export async function GET(peticion: NextRequest): Promise<Response> {
  const params = peticion.nextUrl.searchParams;
  return responderAnalisisPublicacion({ u: params.get("u"), r: params.get("r") });
}
