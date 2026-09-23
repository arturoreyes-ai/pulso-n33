"use client";

import { useState } from "react";

import { Segmentado } from "@/components/ui/segmentado";

import { precargar, type ClaveGrafica } from "@/lib/graficas/registro";

export type Vista = "lista" | "grafica";

/**
 * Interruptor lista/grafica.
 *
 * La vista por omision es la LISTA de numeros, no la grafica. Los numeros son
 * el entregable; la grafica es el adorno. Y de paso Recharts no entra al
 * bundle inicial.
 *
 * `onPointerEnter` y `onFocus` precargan el chunk para que llegue antes de
 * que el clic se resuelva.
 */
export function useVista(clave: ClaveGrafica) {
  const [vista, setVista] = useState<Vista>("lista");
  const intento = () => precargar(clave);
  return { vista, setVista, intento };
}

/** El segmentado del tablero (ui/segmentado.tsx) desde el 23 de septiembre
 *  de 2026; antes era una pareja propia, sin pista y en minusculas. */
export function Alternar({
  vista,
  onVista,
  onIntento,
}: {
  vista: Vista;
  onVista: (v: Vista) => void;
  onIntento: () => void;
}) {
  return (
    <Segmentado etiqueta="Vista" ancho="justo" opciones={[
      { id: "lista", nombre: "Lista", activo: vista === "lista", onElegir: () => onVista("lista") },
      { id: "grafica", nombre: "Gráfica", activo: vista === "grafica", onElegir: () => onVista("grafica"), onCalentar: onIntento },
    ]} />
  );
}
