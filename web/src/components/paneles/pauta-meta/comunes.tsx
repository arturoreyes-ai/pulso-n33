import type { ReactNode } from "react";

import { clasesBoton } from "@/components/ui/clases";
import type { RangoMeta, SeccionMeta } from "@/lib/datos/tipos";

export const CAMPO_META = "w-full rounded-nucleo border border-filo bg-vanta px-4 py-3 text-cuerpo text-tinta-titulo";
/** La pastilla del tablero (ui/clases.ts), no una propia: hasta el 23 de
 *  septiembre de 2026 era otra, con borde y a tamano `text-meta`, y la pagina
 *  se leia como de otro producto. `BOTON_META_ACTIVO` es la accion principal. */
export const BOTON_META = `${clasesBoton(false)} disabled:opacity-40`;
export const BOTON_META_ACTIVO = `${clasesBoton(true)} disabled:opacity-40`;
const NUMERO = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });
const FECHA = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const numeroMeta = (n: number | null | undefined) => n == null ? "sin dato" : NUMERO.format(n);
export function fechaMeta(fecha: string | null | undefined) {
  if (!fecha) return "sin fecha";
  const valor = new Date(`${fecha.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(valor.getTime()) ? "sin fecha" : FECHA.format(valor);
}
export function importeMeta(n: number | null, moneda: string | null) {
  return n === null ? "sin dato" : `${numeroMeta(n)} ${moneda ?? "· moneda sin confirmar"}`;
}
export function rangoMeta(rango: RangoMeta | null, moneda?: string | null) {
  if (!rango) return "sin dato";
  const valor = rango.minimo === null ? `≤ ${numeroMeta(rango.maximo)}` : rango.maximo === null
    ? `≥ ${numeroMeta(rango.minimo)}` : rango.minimo === rango.maximo ? numeroMeta(rango.minimo)
    : `${numeroMeta(rango.minimo)} – ${numeroMeta(rango.maximo)}`;
  return `${valor}${moneda ? ` ${moneda}` : ""}`;
}

export function FuenteMeta<T>({ seccion }: { seccion: SeccionMeta<T> }) {
  const estado = seccion.estado === "ok" ? "Disponible" : seccion.estado === "parcial" ? "Información parcial"
    : seccion.datos !== null ? "Última información disponible" : "Sin dato";
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-vela pb-4 text-meta text-tinta-meta">
    <span className={seccion.estado === "ok" ? "text-tinta-dato" : "text-aviso"}>{estado}</span>
    {seccion.ultimo_exito ? <span>Consultado {fechaMeta(seccion.ultimo_exito)}</span> : null}
    {seccion.periodo ? <span>{fechaMeta(seccion.periodo.desde)} — {fechaMeta(seccion.periodo.hasta)}</span> : null}
    <span>{seccion.geografia === "MX" ? "México" : seccion.geografia}</span>
    <a href={seccion.fuente} target="_blank" rel="noreferrer" className="ml-auto text-tinta-dato underline underline-offset-4">Ver en Meta ↗</a>
  </div>;
}

export function DatoMeta({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-meta text-tinta-meta">{etiqueta}</dt>
    <dd className="mt-2 break-words text-cuerpo tabular-nums text-tinta-titulo">{children}</dd></div>;
}

export function CampoMeta({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return <label className="grid min-w-0 gap-2 text-meta text-tinta-meta">{etiqueta}{children}</label>;
}

export const PESTANAS_META = [
  ["anuncios", "Anuncios"], ["informacion", "Información"], ["audiencia", "Audiencia"],
  ["comparar", "Comparar"], ["reporte", "Reporte"],
] as const;
export type PestanaMeta = typeof PESTANAS_META[number][0];

export function PestanasMeta({ actual, cambiar }: { actual: PestanaMeta; cambiar: (valor: PestanaMeta) => void }) {
  // La pinta es la de todas las pestanas del tablero (`.pestana-lector`,
  // ui/pestanas.tsx); se queda como `tablist` de verdad, con flechas, porque
  // aqui cada pestana gobierna un panel (`aria-controls`).
  return <div role="tablist" aria-label="Publicidad Meta" className="pestanas-lector"
    onKeyDown={(evento) => {
      const indice = PESTANAS_META.findIndex(([id]) => id === actual);
      const siguiente = evento.key === "ArrowRight" ? (indice + 1) % PESTANAS_META.length
        : evento.key === "ArrowLeft" ? (indice + PESTANAS_META.length - 1) % PESTANAS_META.length
        : evento.key === "Home" ? 0 : evento.key === "End" ? PESTANAS_META.length - 1 : null;
      if (siguiente === null) return;
      evento.preventDefault();
      const opcion = PESTANAS_META[siguiente];
      if (opcion) cambiar(opcion[0]);
      evento.currentTarget.querySelectorAll<HTMLButtonElement>("button")[siguiente]?.focus();
    }}>
    {PESTANAS_META.map(([id, nombre]) => <button key={id} type="button" role="tab" id={`meta-tab-${id}`}
      aria-selected={actual === id} aria-controls="meta-contenido" tabIndex={actual === id ? 0 : -1}
      onClick={() => cambiar(id)} className="pestana-lector text-cuerpo">
      {nombre}</button>)}
  </div>;
}
