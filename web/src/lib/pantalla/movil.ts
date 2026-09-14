"use client";

import { useSyncExternalStore } from "react";

/**
 * ¿Es una pantalla angosta?
 *
 * La pagina de redes abre en Visual en el telefono y en Lista en escritorio
 * (decision del 14 de septiembre de 2026). El umbral es 48rem, el `md` de
 * Tailwind, porque es el mismo punto donde las clases del visor cambian de
 * tarjeta a pantalla completa a dos columnas: dos fuentes del mismo numero
 * se separarian en silencio.
 *
 * El servidor responde "no es movil" siempre. Los dos HTML deben coincidir, y
 * la prosa de Lista tiene que viajar en el HTML del servidor (el argumento
 * completo esta en paneles/selector-red.tsx). El costo, dicho sin rodeos: en
 * un telefono hay un segundo render tras la hidratacion, y el panel de Lista
 * alcanza a pedir su JSON de comentarios una vez. Un snapshot `null` con un
 * marcador evitaria ese cuadro pero borraria la prosa del HTML, que es peor.
 *
 * Tienda de modulo con la forma de busqueda/disponible.ts. La consulta se
 * crea perezosamente: este modulo tambien se importa en el servidor, donde no
 * hay `window`.
 */

const CONSULTA = "(min-width: 48rem)";

let consulta: MediaQueryList | null = null;

function obtener(): MediaQueryList {
  if (consulta === null) consulta = window.matchMedia(CONSULTA);
  return consulta;
}

function suscribir(avisar: () => void) {
  const mql = obtener();
  mql.addEventListener("change", avisar);
  return () => mql.removeEventListener("change", avisar);
}

const leer = () => !obtener().matches;

const leerServidor = () => false;

export function useEsMovil(): boolean {
  return useSyncExternalStore(suscribir, leer, leerServidor);
}
