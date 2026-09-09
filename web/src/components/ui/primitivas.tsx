import type { ReactNode } from "react";

import { pct } from "@/lib/dominio/formato";
import { clasesChip } from "./clases";

/* ------------------------------------------------------------------ chips */

export function Chip({
  activo,
  onClick,
  children,
  cuenta,
}: {
  activo: boolean;
  onClick: () => void;
  children: ReactNode;
  cuenta?: number;
}) {
  return (
    <button type="button" aria-pressed={activo} onClick={onClick} className={clasesChip(activo)}>
      <span>{children}</span>
      {cuenta === undefined ? null : (
        <span className="text-meta tabular-nums text-tinta-meta">{cuenta}</span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ hueco */

/**
 * Un hueco de cobertura, rotulado. Nunca un cero: un cero se lee como "aqui
 * no pasa nada" en vez de "aqui no medimos", y son cosas distintas.
 */
export function Hueco({ children, titulo }: { children: ReactNode; titulo?: string }) {
  return (
    <span title={titulo} className="text-meta text-aviso/80 italic">
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- esqueleto */

export function Esqueleto({ className = "h-[280px]" }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Cargando"
      className={`w-full animate-pulse rounded-nucleo bg-vela ${className}`}
    />
  );
}

/* ------------------------------------------------------------------ barra */

/** Barra horizontal. Escala con `transform`, nunca con `width`. */
export function Barra({ fraccion, color }: { fraccion: number; color?: string }) {
  const f = Math.max(0, Math.min(1, fraccion));
  return (
    <span className="block h-[7px] w-full overflow-hidden rounded-full bg-vela">
      <span
        className="block h-full origin-left rounded-full transition-transform duration-[var(--dur-cambio)] ease-firma"
        style={{
          transform: `scaleX(${f})`,
          backgroundColor: color ?? "var(--color-chart-1)",
        }}
      />
    </span>
  );
}

export interface Segmento {
  etiqueta: string;
  n: number;
  color: string;
}

/**
 * Barra de partes (negativo / neutral / positivo). Cada segmento crece con
 * flex-grow, asi que no hay ancho animado ni calculo de porcentaje en CSS.
 * La leyenda dice conteos; el porcentaje, si aplica, lo dice la frase.
 */
export function BarraSegmentada({
  segmentos,
  ariaLabel,
}: {
  segmentos: readonly Segmento[];
  ariaLabel: string;
}) {
  const total = segmentos.reduce((acc, s) => acc + s.n, 0);
  if (total === 0) return null;
  return (
    <div>
      <div
        role="img"
        aria-label={ariaLabel}
        className="flex h-2 w-full overflow-hidden rounded-full bg-vela"
      >
        {segmentos.map((s) =>
          s.n === 0 ? null : (
            <span key={s.etiqueta} style={{ flexGrow: s.n, backgroundColor: s.color }} />
          ),
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-meta text-tinta-meta">
        {segmentos.map((s) => (
          <li key={s.etiqueta} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="tabular-nums text-tinta-dato">{s.n}</span> {s.etiqueta}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ signo */

/**
 * Variacion con signo y flecha. El color no es el unico portador: va el
 * glifo Y el numero con signo. `invertir` es para series donde subir es malo
 * (delitos).
 */
export function Signo({
  v,
  invertir = false,
  decimales = 1,
}: {
  v: number | null | undefined;
  invertir?: boolean;
  decimales?: number;
}) {
  if (v === null || v === undefined || Number.isNaN(v)) {
    return <span className="text-meta text-aviso/80 italic">sin dato</span>;
  }
  if (Math.abs(v) < 0.05) return <span className="text-tinta-prosa">{pct(0, decimales)}</span>;
  const bueno = v > 0 !== invertir;
  return (
    <span className={bueno ? "text-sube" : "text-baja"}>
      {v > 0 ? "▲ " : "▼ "}
      {pct(v, decimales)}
    </span>
  );
}

/* -------------------------------------------------------------------- kpi */

/**
 * Una cifra con su frase. La frase es el entregable: el numero solo la
 * ilustra. `hueco` pinta el valor como salvedad y no como dato.
 */
export function Kpi({
  etiqueta,
  valor,
  frase,
  fuente,
  hueco = false,
  extra,
}: {
  etiqueta: string;
  valor: ReactNode;
  frase: string;
  fuente?: string;
  hueco?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-meta text-tinta-meta">{etiqueta}</p>
      <p
        className={
          hueco
            ? "text-rotulo text-aviso/85 italic"
            : "text-cifra tabular-nums text-tinta-titulo"
        }
      >
        {valor}
      </p>
      <p className="text-lectura text-tinta-dato">{frase}</p>
      {extra === undefined ? null : <div className="mt-1">{extra}</div>}
      {fuente === undefined ? null : (
        <p className="mt-auto text-meta text-tinta-meta">{fuente}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- fila */

export function FilaConteo({
  etiqueta,
  valor,
  titulo,
  atenuada = false,
}: {
  etiqueta: ReactNode;
  valor: ReactNode;
  titulo?: string;
  atenuada?: boolean;
}) {
  return (
    <li
      title={titulo}
      className="flex items-baseline gap-3 border-b border-vela py-1.5 text-meta last:border-0"
    >
      <span className={atenuada ? "text-aviso/80" : "text-tinta-dato"}>{etiqueta}</span>
      <span className={`ml-auto tabular-nums ${atenuada ? "text-aviso/80" : "text-tinta-titulo"}`}>
        {valor}
      </span>
    </li>
  );
}
