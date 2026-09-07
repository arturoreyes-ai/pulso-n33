"use client";

import { useState } from "react";

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
    <div role="group" aria-label="Vista" className="flex shrink-0 gap-1">
      {(["lista", "grafica"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={vista === v}
          onClick={() => onVista(v)}
          {...(v === "grafica"
            ? { onPointerEnter: onIntento, onFocus: onIntento }
            : {})}
          className={`rounded-full px-3 py-1 text-xs transition-all duration-700 ease-firma ${
            vista === v
              ? "bg-white/15 text-white"
              : "text-white/40 hover:bg-white/[0.06] hover:text-white/70"
          }`}
        >
          {v === "lista" ? "lista" : "gráfica"}
        </button>
      ))}
    </div>
  );
}
