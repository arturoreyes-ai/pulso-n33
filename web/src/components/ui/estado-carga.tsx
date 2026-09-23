"use client";

import { useEffect, useState } from "react";

/**
 * El estado de carga de una busqueda: una rejilla de 3x3 pixeles con un
 * frente que avanza, la etiqueta con un brillo que la recorre y el tiempo
 * transcurrido en cifras tabulares.
 *
 * Lo pidio el cliente el 23 de septiembre de 2026, con el componente ya
 * escrito, para lo que se ve mientras una busqueda trae resultados. Se adapto
 * a este repositorio y no se pego tal cual:
 *  - Nombres en español y tokens de la escala (`tinta-*`, `text-cuerpo`,
 *    `text-meta`) en vez de `ink-*` y tamaños en px, que `pnpm tokens`
 *    rechaza.
 *  - Sin la variante «Surfer»: reproducia un video de Subway Surfers alojado
 *    en el almacenamiento de un tercero. Material ajeno, en un host que este
 *    proyecto no controla, dentro de un tablero para el cliente.
 *  - Celdas de 6px y no 4px: quien lee es gente mayor (la misma razon por la
 *    que crecieron las cifras de la ficha), y en un lector de pantalla
 *    completa un glifo de 14px se pierde. Tiempos intactos: ciclo de 650 ms,
 *    90 ms entre columnas del chevron, de modo que siempre hay dos frentes.
 *  - El cronometro va `aria-hidden`. `role="status"` es una region viva: un
 *    numero que cambia cada 100 ms dentro de ella se leeria sin parar. Se
 *    anuncia la etiqueta y nada mas.
 *  - Con `prefers-reduced-motion` la rejilla queda quieta y tenue y el brillo
 *    se apaga (globals.css); el cronometro sigue.
 */

const CHEVRON = Array.from({ length: 9 }, (_, i) => {
  const fila = Math.floor(i / 3);
  const columna = i % 3;
  return (columna + Math.abs(fila - 1)) * 90;
});

const ORDEN_ORBITA = [0, 1, 2, 5, 8, 7, 6, 3];
const ORBITA = Array.from({ length: 9 }, (_, i) => {
  const k = ORDEN_ORBITA.indexOf(i);
  return k === -1 ? null : k * 110;
});

export type VarianteCarga = "avance" | "puntos" | "orbita";

const PATRONES: Record<VarianteCarga, { retrasos: (number | null)[]; duracion: number; redonda: boolean }> = {
  avance: { retrasos: CHEVRON, duracion: 650, redonda: false },
  puntos: { retrasos: CHEVRON, duracion: 650, redonda: true },
  orbita: { retrasos: ORBITA, duracion: 950, redonda: false },
};

function RejillaCarga({ retrasos, duracion, redonda }: { retrasos: (number | null)[]; duracion: number; redonda: boolean }) {
  return (
    <span aria-hidden className="grid shrink-0 grid-cols-[repeat(3,6px)] gap-[2px]">
      {retrasos.map((retraso, indice) => (
        <span
          key={indice}
          className={`pixel-carga size-[6px] bg-tinta-titulo ${redonda ? "rounded-full" : ""}`}
          style={{
            opacity: retraso === null ? 0.07 : 0.15,
            animation: retraso === null ? "none" : `pixel-encendido ${duracion}ms ease-in-out ${retraso}ms infinite`,
          }}
        />
      ))}
    </span>
  );
}

/** Decimas de segundo desde que se monto, como «4.2s» o «1m 3.4s». */
function useTranscurrido(): string {
  const [decimas, setDecimas] = useState(0);
  useEffect(() => {
    const reloj = setInterval(() => setDecimas((d) => d + 1), 100);
    return () => clearInterval(reloj);
  }, []);
  const total = decimas / 10;
  if (total < 60) return `${total.toFixed(1)}s`;
  return `${Math.floor(total / 60)}m ${(total % 60).toFixed(1)}s`;
}

export function EstadoCarga({ etiqueta = "Buscando", variante = "avance" }: { etiqueta?: string; variante?: VarianteCarga }) {
  const transcurrido = useTranscurrido();
  const { retrasos, duracion, redonda } = PATRONES[variante];
  return (
    <div role="status" className="flex w-fit items-center gap-3">
      <RejillaCarga retrasos={retrasos} duracion={duracion} redonda={redonda} />
      <span
        className="brillo-carga bg-clip-text text-cuerpo font-medium text-transparent"
        style={{
          backgroundImage: "linear-gradient(90deg, var(--color-tinta-meta) 35%, var(--color-tinta-titulo) 50%, var(--color-tinta-meta) 65%)",
          backgroundSize: "200% 100%",
          animation: "brillo-texto 1.4s linear infinite",
        }}
      >
        {etiqueta}
      </span>
      <span aria-hidden className="font-mono text-meta tabular-nums text-tinta-meta">{transcurrido}</span>
    </div>
  );
}
