"use client";

import { useSyncExternalStore } from "react";

/**
 * Estado compartido del filtro por tema.
 *
 * El panel de temas y el muro son islas de cliente SEPARADAS, con secciones
 * de servidor en medio. Meterlas bajo un padre de cliente comun para
 * compartir estado arrastraria al bundle toda la prosa metodologica de esas
 * secciones, que es justo lo que se quiere mantener como HTML.
 *
 * Una tienda externa minima resuelve el cruce sin ese costo: cada isla se
 * suscribe por su cuenta.
 */

const VACIO: ReadonlySet<string> = new Set();

let actual: ReadonlySet<string> = VACIO;
const oyentes = new Set<() => void>();

function avisar() {
  for (const o of oyentes) o();
}

function suscribir(o: () => void) {
  oyentes.add(o);
  return () => {
    oyentes.delete(o);
  };
}

const leer = () => actual;

// El servidor renderiza sin filtro, que es el estado inicial del cliente, asi
// que no hay diferencia entre los dos HTML.
const leerServidor = () => VACIO;

/** Alterna: volver a tocar el mismo tema lo limpia. */
export function alternarTema(ids: readonly string[]) {
  if (ids.length === 0) {
    actual = VACIO;
  } else if (actual.size === ids.length && ids.every((i) => actual.has(i))) {
    actual = VACIO;
  } else {
    actual = new Set(ids);
  }
  avisar();
}

export function limpiarTema() {
  if (actual.size === 0) return;
  actual = VACIO;
  avisar();
}

export function useFiltroTema(): ReadonlySet<string> {
  return useSyncExternalStore(suscribir, leer, leerServidor);
}
