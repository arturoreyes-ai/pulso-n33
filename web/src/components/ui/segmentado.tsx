"use client";

import Link from "next/link";

/**
 * El segmentado del tablero: dos o tres opciones excluyentes en una pista
 * redonda, la activa rellena. Lo usan el alcance del dialogo de lugar
 * (opciones-lugar.tsx), la vista de Gasto electoral y los alternadores de
 * lista/grafica.
 *
 * Extraido el 23 de septiembre de 2026: Gasto electoral tenia pastillas con
 * borde y `Alternar` otras sin fondo y en minusculas, para el mismo gesto que
 * el alcance de la portada.
 *
 * Una opcion NAVEGA (`href`) o ELIGE (`onElegir`). `cerrarDialogo` hace que la
 * que elige cierre la hoja que la contiene: no navega ni desmonta nada, y sin
 * cerrarla la hoja tapaba el contenido que acababa de cambiar.
 */

export type OpcionSegmento = {
  id: string;
  nombre: string;
  activo: boolean;
  /** Precarga al pasar el puntero o enfocar (el chunk de una grafica). */
  onCalentar?: () => void;
} & (
  | { href: string; onElegir?: never }
  | { onElegir: () => void; href?: never }
);

const SEGMENTO = "rounded-full px-3 py-2 text-center text-cuerpo transition-colors duration-[var(--dur-toque)] ease-firma";
const clase = (activo: boolean) =>
  `${SEGMENTO} ${activo ? "bg-realce text-tinta-titulo" : "text-tinta-prosa hover:bg-vela hover:text-tinta-titulo"}`;

export function Segmentado({ etiqueta, opciones, cerrarDialogo = false, ancho = "lleno" }: {
  etiqueta: string;
  opciones: readonly OpcionSegmento[];
  cerrarDialogo?: boolean;
  /** `lleno` reparte la fila entera (dentro de una hoja); `justo` mide lo que
   *  miden las opciones (en una cabecera de panel). */
  ancho?: "lleno" | "justo";
}) {
  const pista = ancho === "lleno"
    ? "grid gap-1 rounded-full border border-filo bg-vanta p-1"
    : "inline-flex gap-1 rounded-full border border-filo bg-vanta p-1";
  return (
    <div role="group" aria-label={etiqueta} className={pista}
      style={ancho === "lleno" ? { gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` } : undefined}>
      {opciones.map((o) =>
        o.href !== undefined ? (
          <Link key={o.id} href={o.href} aria-current={o.activo ? "page" : undefined} className={clase(o.activo)}>
            {o.nombre}
          </Link>
        ) : (
          <button key={o.id} type="button" aria-pressed={o.activo} className={clase(o.activo)}
            onPointerEnter={o.onCalentar} onFocus={o.onCalentar}
            onClick={(evento) => {
              o.onElegir();
              if (cerrarDialogo) evento.currentTarget.closest("dialog")?.close();
            }}>
            {o.nombre}
          </button>
        ),
      )}
    </div>
  );
}
