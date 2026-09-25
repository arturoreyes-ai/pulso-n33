"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

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
 *
 * La fila se desplaza de lado con la barra oculta, y desde el 24 de
 * septiembre de 2026 la de temas tiene nueve pestanas: un telefono ve cinco.
 * Dos cosas lo hacen legible. La activa se centra al montar —elegir
 * «Economia» navega, la fila se vuelve a pintar desde el principio, y la
 * pestana marcada quedaba fuera de vista—, y `data-mas` desvanece la orilla
 * por donde queda fila (globals.css). Se mueve `scrollLeft` y no
 * `scrollIntoView`, que tambien desplazaria la caja del lector.
 */

type Orilla = "inicio" | "fin" | "ambos";

function orilla(el: HTMLElement): Orilla | null {
  const antes = el.scrollLeft > 1;
  const despues = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
  return antes && despues ? "ambos" : antes ? "inicio" : despues ? "fin" : null;
}

export type Pestana = {
  id: string;
  nombre: string;
  activa: boolean;
  /** Precarga al pasar el puntero o enfocar (Redes calienta su JSON). */
  onCalentar?: () => void;
} & ({ href: string; onElegir?: never } | { onElegir: () => void; href?: never });

export function FilaPestanas({ etiqueta, pestanas }: { etiqueta: string; pestanas: readonly Pestana[] }) {
  const fila = useRef<HTMLDivElement>(null);
  const activa = pestanas.find((p) => p.activa)?.id ?? null;

  useEffect(() => {
    const el = fila.current;
    if (el === null) return;
    const marcar = () => {
      const o = orilla(el);
      if (o === null) delete el.dataset.mas;
      else el.dataset.mas = o;
    };
    const marcada = el.querySelector<HTMLElement>('[aria-current="page"], [aria-pressed="true"]');
    if (marcada !== null) {
      // Por rectangulos y no por offsetLeft: la fila no esta posicionada, asi
      // que offsetLeft se mide contra otro ancestro.
      const f = el.getBoundingClientRect();
      const m = marcada.getBoundingClientRect();
      el.scrollLeft = Math.max(0, el.scrollLeft + (m.left + m.width / 2) - (f.left + f.width / 2));
    }
    marcar();
    el.addEventListener("scroll", marcar, { passive: true });
    const tamano = new ResizeObserver(marcar);
    tamano.observe(el);
    return () => {
      el.removeEventListener("scroll", marcar);
      tamano.disconnect();
    };
  }, [activa]);

  return (
    <div ref={fila} role="group" aria-label={etiqueta} className="pestanas-lector">
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
