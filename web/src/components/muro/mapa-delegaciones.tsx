"use client";

import { MAPA_DELEGACIONES } from "@/lib/dominio/delegaciones-mapa";
import { NOMBRE_CORTO_DELEGACION, type FiltroDelegacion } from "@/lib/dominio/delegaciones";
import type { Delegacion } from "@/lib/datos/tipos";

/**
 * GUARDADO (7 de septiembre de 2026). Sin consumidor a proposito.
 *
 * Que lo enciende: renderizar <MapaDelegaciones> junto a <SelectorDelegacion>
 * en `muro/muro.tsx`. Ya recibe las mismas tres props que ese sitio pasa hoy
 * (activa, conteo, onElegir), asi que son cinco lineas.
 *
 * Por que esta apagado: `notas.json` todavia no trae la clave `delegaciones`,
 * asi que las nueve delegaciones marcan 0 y «sin delegacion identificada» se
 * queda con las 205. Un mapa de nueve poligonos en cero no informa.
 *
 * Se queda DENTRO de src/ y compilando, no en docs/ ni en una rama. El
 * `Record<Delegacion, ...>` de aqui abajo es exhaustivo sobre la union, asi
 * que `pnpm tipos` falla EN ESTE ARCHIVO en cuanto alguien agregue una decima
 * delegacion, y le dice que falta su poligono y su etiqueta. Eso es mejor
 * anti-podredumbre que cualquier nota, y es gratis; sacarlo de src/ lo tira.
 * Tambien entro al barrido de tokens, para que encenderlo no reimporte de
 * golpe nueve valores fuera de escala.
 *
 * Dos defectos conocidos, anotados mientras el contexto esta fresco:
 *  - el <rect> de fondo codifica 1000x620 a mano contra
 *    MAPA_DELEGACIONES.viewBox; si el viewBox cambia, se desincroniza y nada
 *    lo detecta.
 *  - los poligonos llevan role="button" y tabIndex sobre un <g> de SVG. No es
 *    un boton: no hay semantica de Espacio/Enter de plataforma (se emula a
 *    mano) y aria-pressed sobre un grafico se anuncia de forma inconsistente.
 *    Si se enciende, necesita <button> de verdad encima del SVG.
 */

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
    <section className="relative overflow-hidden rounded-nucleo border border-filo bg-[#0d0b0c] px-3 py-3 sm:px-5 sm:py-4" aria-labelledby="titulo-mapa-delegaciones">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-meta uppercase text-chart-1-texto">Corte territorial</p>
          <h2 id="titulo-mapa-delegaciones" className="mt-1 text-cuerpo font-medium text-tinta-dato">Delegaciones de Tijuana</h2>
        </div>
        <p className="max-w-[13rem] text-right text-meta text-tinta-meta">Pulsa un polígono para filtrar. Otro pulso limpia el filtro.</p>
      </div>
      <svg
        viewBox={MAPA_DELEGACIONES.viewBox}
        role="group"
        aria-label="Mapa interactivo de delegaciones de Tijuana"
        className="h-auto w-full"
      >
        <rect width="1000" height="620" rx="22" fill="var(--color-vanta)" />
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
                stroke={activaEsta ? "#f36b5f" : "var(--color-filo)"}
                strokeWidth={activaEsta ? 3 : 1.5}
                vectorEffect="non-scaling-stroke"
                className="transition-[fill,stroke] group-hover:fill-chart-1/30 group-focus-visible:fill-chart-1/35"
              />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                className="pointer-events-none fill-tinta-dato text-rotulo font-medium group-hover:fill-tinta-titulo group-focus-visible:fill-tinta-titulo"
              >
                {NOMBRE_CORTO_DELEGACION[d]}
              </text>
              <text
                x={x}
                y={y + 22}
                textAnchor="middle"
                className="pointer-events-none fill-tinta-meta text-lectura tabular-nums"
              >
                {cuenta}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 border-t border-vela pt-2 text-meta text-tinta-meta">
        Fuente: IMPLAN Tijuana, <a className="text-tinta-meta underline decoration-tinta-inerte underline-offset-2 hover:text-tinta-titulo" href="https://www.arcgis.com/home/item.html?id=3db7ce3e475348e1b640fcd045d62901" target="_blank" rel="noreferrer">Mapa Base Delegaciones–Colonias 2014</a>. Polígonos históricos; nombres y pertenencia de colonias: directorio IMPLAN actualizado 2026-09-04.
      </p>
    </section>
  );
}
