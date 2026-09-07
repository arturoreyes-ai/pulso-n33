"use client";

import dynamic from "next/dynamic";

import { Esqueleto } from "@/components/ui/primitivas";

/**
 * Registro de graficas, cargadas a demanda.
 *
 * `ssr: false` porque Recharts mide el DOM. `loading` con la MISMA altura que
 * el marco, o cada grafica aporta salto de layout al hidratar.
 *
 * Recharts no entra nunca al bundle inicial: son ~100 KB comprimidos que solo
 * hacen falta si alguien abre la vista de grafica.
 */
const cargando = () => <Esqueleto className="h-[280px]" />;
const cargandoZona = () => <Esqueleto className="h-[220px]" />;

/**
 * `crimen` y `crimenZona` apuntan al MISMO modulo con el mismo especificador
 * literal: es un solo chunk. Son dos entradas porque el marco de carga tiene
 * que medir lo mismo que la grafica que reemplaza, y la de zona es mas baja.
 */
export const GRAFICAS = {
  crimen: dynamic(() => import("@/components/graficas/crimen"), {
    ssr: false,
    loading: cargando,
  }),
  crimenZona: dynamic(() => import("@/components/graficas/crimen"), {
    ssr: false,
    loading: cargandoZona,
  }),
} as const;

export type ClaveGrafica = keyof typeof GRAFICAS;

/**
 * Mapa de THUNKS, nunca de cadenas de ruta.
 *
 * Un `Record<string, string>` de rutas, o un template literal dentro de
 * `import()`, vuelve el grafo de modulos imposible de analizar y el empacador
 * o mete todos los candidatos o falla en tiempo de ejecucion. Dos mapas de
 * thunks con los mismos especificadores literales resuelven al mismo chunk
 * (las peticiones se deduplican) y los dos quedan visibles al analisis.
 */
const PRECARGA: Record<ClaveGrafica, () => Promise<unknown>> = {
  crimen: () => import("@/components/graficas/crimen"),
  crimenZona: () => import("@/components/graficas/crimen"),
};

/** Se llama al pasar el puntero o al enfocar, para que el chunk llegue antes
 *  de que el clic se resuelva. */
export function precargar(k: ClaveGrafica) {
  void PRECARGA[k]();
}
