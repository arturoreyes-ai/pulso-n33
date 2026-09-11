"use client";

import { useSyncExternalStore } from "react";

import { ErrorDatos, leerJson } from "@/lib/datos/fetcher";

/**
 * ¿Hay servidor detras de /api/buscar?
 *
 * En una exportacion estatica, o en el sitio plano de `sitio/`, la ruta no
 * existe: GitHub Pages devuelve su 404 en HTML y un host mal configurado
 * puede devolver hasta un 200 con la cascara de la app. Las dos cosas las
 * cubre la misma regla, que ya vive en lib/datos/fetcher.ts: lo que no sea
 * 200 con content-type JSON significa "no hay servidor".
 *
 * Tienda de modulo, con la forma de filtro-tema.ts y por la misma razon:
 * sobrevive a la navegacion entre zonas, asi que se pregunta una vez por
 * sesion y no una por pagina. Al saberse que no hay, la llave de SWR pasa a
 * null y el bloque desaparece solo, sin esperar otra tecla.
 */

let hay: boolean | null = null; // null = todavia no se sabe
const oyentes = new Set<() => void>();

function suscribir(o: () => void) {
  oyentes.add(o);
  return () => {
    oyentes.delete(o);
  };
}

const leer = () => hay !== false;

// El servidor pinta como si lo hubiera, que es el estado inicial del cliente:
// asi los dos HTML coinciden.
const leerServidor = () => true;

export function marcarSinServidor() {
  if (hay === false) return;
  hay = false;
  for (const o of oyentes) o();
}

/** False solo cuando ya se comprobo que no hay. */
export function useHayServidor(): boolean {
  return useSyncExternalStore(suscribir, leer, leerServidor);
}

/**
 * Lector de /api/*: leerJson mas la deteccion de "no hay servidor".
 *
 * Un 404 con HTML, o un 200 con la cascara de la app, significan que la ruta
 * no existe; se apunta en la tienda para no volver a preguntar en esta
 * sesion. Vive aqui y no en cada hook porque /api/buscar y /api/actualidad
 * comparten exactamente esta regla, y la tienda que escribe es esta.
 */
export async function leerApi<T>(ruta: string): Promise<T> {
  try {
    return await leerJson<T>(ruta);
  } catch (e) {
    if (e instanceof ErrorDatos && (e.status === 404 || e.status === 405)) {
      marcarSinServidor();
    } else if (e instanceof ErrorDatos && e.message.includes("no JSON")) {
      marcarSinServidor();
    }
    throw e;
  }
}
