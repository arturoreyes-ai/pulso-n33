/**
 * Busqueda en vivo en Google Noticias, en espanol y en ingles.
 *
 * Existe porque el muro solo puede buscar en lo que la ultima corrida del cron
 * ya cosecho, y el cron corre cada seis horas. Esto contesta "que hay ahora
 * mismo", que es otra pregunta.
 *
 * Sale del navegador y no de la pagina por dos razones: el feed de Google no
 * manda CORS, y la llave del cache del CDN es la URL, asi que una racha de
 * gente buscando lo mismo despues de una noticia es UNA llamada rio arriba.
 *
 * Delgada a proposito desde el 18 de septiembre de 2026: la logica vive en
 * lib/busqueda/buscar.ts, que scripts/probar-busqueda.cjs prueba sin red.
 *
 * NO se exporta `dynamic` ni `revalidate`. Desde Next 15 un GET ya es dinamico
 * por omision, leer `nextUrl` lo confirma, y las dos opciones son legado que
 * desaparece si algun dia se enciende Cache Components: escribirlas seria
 * ruido que alguien tendria que borrar.
 */

import type { NextRequest } from "next/server";

import { responderBusqueda } from "@/lib/busqueda/buscar";

/**
 * Tope de la plataforma. El presupuesto interno son 6 s por feed y los dos van
 * en paralelo, asi que queda holgado por debajo: un feed lento sale como
 * 'fallo' legible en el cuerpo y no como un 504 del host.
 */
export const maxDuration = 15;

export async function GET(peticion: NextRequest): Promise<Response> {
  const params = peticion.nextUrl.searchParams;
  return responderBusqueda({
    q: params.get("q"),
    z: params.get("z"),
    a: params.get("a"),
    actualizar: params.get("actualizar") === "1",
  });
}
