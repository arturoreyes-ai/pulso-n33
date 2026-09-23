"use client";

import Link from "next/link";

/**
 * La fila de pestanas del tablero: texto, sin pastilla, y el subrayado corto
 * en `chart-1` bajo la activa (`.pestana-lector` en globals.css, a la manera
 * de la pagina de tendencias de X).
 *
 * Una sola desde el 23 de septiembre de 2026. Estaba copiada tal cual en
 * Redes y en la busqueda de Redes, reescrita en los temas de la portada, y
 * Publicidad Meta tenia otra con una raya a todo lo ancho y sin fondo al pasar
 * el puntero: cuatro filas para un solo gesto, y el cliente pidio que todo se
 * viera del mismo proyecto.
 *
 * Una pestana NAVEGA (`href`, con `aria-current`) cuando la eleccion vive en
 * la URL, o ELIGE (`onElegir`, con `aria-pressed`) cuando es estado de la
 * pantalla. La pinta es la misma; la semantica, la de cada caso.
 */

export type Pestana = {
  id: string;
  nombre: string;
  activa: boolean;
  /** Precarga al pasar el puntero o enfocar (Redes calienta su JSON). */
  onCalentar?: () => void;
} & ({ href: string; onElegir?: never } | { onElegir: () => void; href?: never });

export function FilaPestanas({ etiqueta, pestanas }: { etiqueta: string; pestanas: readonly Pestana[] }) {
  return (
    <div role="group" aria-label={etiqueta} className="pestanas-lector">
      {pestanas.map((p) =>
        p.href !== undefined ? (
          // scroll={false}: el lector es una caja fija con su propio
          // desplazamiento; restaurar el de la pagina no mueve nada.
          <Link key={p.id} href={p.href} scroll={false} aria-current={p.activa ? "page" : undefined}
            className="pestana-lector text-cuerpo" onPointerEnter={p.onCalentar} onFocus={p.onCalentar}>
            {p.nombre}
          </Link>
        ) : (
          <button key={p.id} type="button" aria-pressed={p.activa} className="pestana-lector text-cuerpo"
            onClick={p.onElegir} onPointerEnter={p.onCalentar} onFocus={p.onCalentar}>
            {p.nombre}
          </button>
        ),
      )}
    </div>
  );
}
