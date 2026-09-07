"use client";

import { MAPA_DELEGACIONES } from "@/lib/dominio/delegaciones-mapa";
import { NOMBRE_CORTO_DELEGACION, type FiltroDelegacion } from "@/lib/dominio/delegaciones";
import type { Delegacion } from "@/lib/datos/tipos";

const ETIQUETAS: Record<Delegacion, [number, number]> = {
  Centro: [285, 205],
  "Cerro Colorado": [535, 226],
  "La Mesa": [370, 342],
  "La Presa A.L.R.": [585, 374],
  "La Presa Este": [775, 420],
  "Otay Centenario": [525, 130],
  "Playas de Tijuana": [120, 300],
  "San Antonio de los Buenos": [250, 430],
  "Sánchez Taboada": [420, 495],
};

const pathD = (points: readonly (readonly [number, number])[]) =>
  points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ") + " Z";

export function MapaDelegaciones({
  activa,
  conteo,
  onElegir,
}: {
  activa: FiltroDelegacion | null;
  conteo: Map<FiltroDelegacion, number>;
  onElegir: (delegacion: FiltroDelegacion | null) => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d0b0c] px-3 py-3 sm:px-5 sm:py-4" aria-labelledby="titulo-mapa-delegaciones">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-2xs uppercase tracking-[0.22em] text-chart-1/80">Corte territorial</p>
          <h2 id="titulo-mapa-delegaciones" className="mt-1 text-sm font-medium text-white/85">Delegaciones de Tijuana</h2>
        </div>
        <p className="max-w-[13rem] text-right text-2xs leading-relaxed text-white/35">Pulsa un polígono para filtrar. Otro pulso limpia el filtro.</p>
      </div>
      <svg
        viewBox={MAPA_DELEGACIONES.viewBox}
        role="group"
        aria-label="Mapa interactivo de delegaciones de Tijuana"
        className="h-auto w-full"
      >
        <rect width="1000" height="620" rx="22" fill="rgb(255 255 255 / 0.015)" />
        {Object.entries(MAPA_DELEGACIONES.paths).map(([nombre, points]) => {
          const d = nombre as Delegacion;
          const activaEsta = activa === d;
          const cuenta = conteo.get(d) ?? 0;
          const [x, y] = ETIQUETAS[d] ?? [500, 300];
          return (
            <g
              key={nombre}
              role="button"
              tabIndex={0}
              aria-label={`${nombre}: ${cuenta} notas`}
              aria-pressed={activaEsta}
              onClick={() => onElegir(activaEsta ? null : d)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onElegir(activaEsta ? null : d);
                }
              }}
              className="group cursor-pointer outline-none"
            >
              <title>{`${nombre}: ${cuenta} notas`}</title>
              <path
                d={pathD(points)}
                fill={activaEsta ? "rgb(224 52 43 / 0.36)" : "rgb(224 52 43 / 0.11)"}
                stroke={activaEsta ? "#f36b5f" : "rgb(255 255 255 / 0.26)"}
                strokeWidth={activaEsta ? 3 : 1.5}
                vectorEffect="non-scaling-stroke"
                className="transition-[fill,stroke] duration-300 group-hover:fill-chart-1/30 group-focus-visible:fill-chart-1/35"
              />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                className="pointer-events-none fill-white/70 text-[18px] font-medium tracking-tight group-hover:fill-white group-focus-visible:fill-white"
              >
                {NOMBRE_CORTO_DELEGACION[d]}
              </text>
              <text
                x={x}
                y={y + 22}
                textAnchor="middle"
                className="pointer-events-none fill-white/35 text-[15px] tabular-nums"
              >
                {cuenta}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 border-t border-white/[0.07] pt-2 text-2xs leading-relaxed text-white/35">
        Fuente: IMPLAN Tijuana, <a className="text-white/55 underline decoration-white/20 underline-offset-2 hover:text-white" href="https://www.arcgis.com/home/item.html?id=3db7ce3e475348e1b640fcd045d62901" target="_blank" rel="noreferrer">Mapa Base Delegaciones–Colonias 2014</a>. Polígonos históricos; nombres y pertenencia de colonias: directorio IMPLAN actualizado 2026-09-04.
      </p>
    </section>
  );
}
