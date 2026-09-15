"use client";

import { useId } from "react";
import type { ActualizacionViva } from "@/lib/busqueda/use-actualizar";

/** Una accion sobre los titulares en vivo, con estado separado de las filas. */
export function ActualizarNoticias({ estado }: { estado: ActualizacionViva }) {
  const descripcion = useId();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => void estado.actualizar()}
        disabled={estado.actualizando}
        aria-describedby={descripcion}
        className="rounded-full border border-filo px-4 py-3 text-meta text-tinta-titulo transition-colors hover:bg-vela focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta-titulo disabled:cursor-wait disabled:opacity-50"
      >
        {estado.actualizando ? "Actualizando…" : "Actualizar"}
      </button>
      <span id={descripcion} className="sr-only">Actualiza los titulares en vivo de esta sección.</span>
      <span role="status" className="text-meta text-tinta-meta">{estado.avisoActualizacion}</span>
    </div>
  );
}
