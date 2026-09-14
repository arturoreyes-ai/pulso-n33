"use client";

import { memo } from "react";

import type { ResultadoExterno } from "@/lib/busqueda/tipos";
import { fechaCorta, hora } from "@/lib/dominio/formato";

/**
 * Una fila que no paso por el pipeline.
 *
 * Va en la MISMA lista que NotaFila, asi que copia su reticula exacta
 * -- `grid-cols-[4rem_1fr]`, `py-3.5`, la columna de fecha en monoespaciada --
 * o las dos columnas bailan al alternarse. Y por eso tambien lleva el mismo
 * `contain-intrinsic-size`: la anatomia es la misma (titular de dos lineas mas
 * una linea de meta), y en una lista mezclada la estimacion del scroll tiene
 * que ser una sola.
 *
 * No reusa NotaFila porque no puede: un ResultadoExterno no tiene id, ni
 * zonas, ni delegaciones, ni figuras, ni tono. Lo que si lleva es el rotulo
 * `en vivo`, y ese es el punto: PRODUCT.md separa a proposito los medios del
 * catalogo de lo que aparece en una busqueda -- «"4 medios" y "sí" no son la
 * misma clase de afirmación»-- asi que borrar la marca presentaria las dos
 * como el mismo tipo de dato.
 *
 * NO recibe `corte`. El muro mide la edad contra `estado.generado`, que puede
 * tener seis horas, y una nota de hace diez minutos daria una edad negativa
 * que `edad()` devuelve como cadena vacia. Aqui la hora va absoluta, con los
 * mismos formateadores de formato.ts (doce horas, hora de Tijuana) que usa el
 * resto del tablero.
 */

function Fila({ r }: { r: ResultadoExterno }) {
  const iso = r.publicado;
  const valida = iso !== null && !Number.isNaN(Date.parse(iso));

  return (
    <article className="grid grid-cols-[4rem_1fr] gap-4 border-b border-vela py-3.5 [contain-intrinsic-size:0_104px] [content-visibility:auto]">
      <div className="pt-0.5 font-mono text-meta tabular-nums text-tinta-meta">
        {iso !== null && valida ? (
          <>
            <time dateTime={iso}>{fechaCorta(iso)}</time>
            <span className="block">{hora(iso)}</span>
          </>
        ) : (
          "s/f"
        )}
      </div>

      <div className="min-w-0">
        <h3 className="text-lectura font-normal">
          {/* nofollow: es un enlace que devolvio un buscador, no una cita. */}
          <a
            href={r.url}
            target="_blank"
            rel="noopener nofollow noreferrer"
            className="text-tinta-titulo transition-colors hover:text-chart-1-texto"
          >
            {r.titulo}
          </a>
        </h3>

        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-meta text-tinta-meta">
          <span>{r.medio}</span>
          <span
            title="Resultado en vivo: no tiene zona, tono ni figura, y no cuenta en las cifras de prensa."
            className="inline-block rounded-full border border-dashed border-filo px-2 py-px text-meta whitespace-nowrap text-tinta-meta"
          >
            en vivo
          </span>
          {r.idioma === "en" ? (
            <span className="inline-block rounded-full border border-filo bg-vela px-2 py-px text-meta whitespace-nowrap text-tinta-dato">
              inglés
            </span>
          ) : null}
        </p>
      </div>
    </article>
  );
}

export const FilaExterna = memo(Fila);
