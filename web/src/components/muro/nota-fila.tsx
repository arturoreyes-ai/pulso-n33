"use client";

import { memo } from "react";

import type { Figura, Nota } from "@/lib/datos/tipos";
import { NOMBRE_CORTO_DELEGACION, delegacionesDeNota } from "@/lib/dominio/delegaciones";
import { cuando } from "@/lib/dominio/formato";
import { cargoDe, nombreCorto } from "@/lib/dominio/roster";

/**
 * Una fila del muro.
 *
 * `content-visibility: auto` VA AQUI, en la fila, no en la seccion. Con
 * `contain-intrinsic-size` el navegador se salta layout y pintado de las
 * ~660 filas que estan fuera de pantalla.
 *
 * `auto` y no `hidden`: `auto` deja el contenido encontrable con Ctrl+F y
 * alcanzable por un lector de pantalla. `hidden` haria invisibles 660 de 669
 * titulares para los dos.
 *
 * La altura intrinseca es la medida de una fila de dos lineas, que es el
 * caso comun. Si el numero esta mal, la barra de scroll salta a lo largo de
 * 669 filas, y se lee como un bug de scroll y no de tipografia.
 *
 * RECALCULADA al pasar a la escala de texto. El titular era 15px con
 * leading-snug (1.375 -> 20.6px por linea) y ahora es `lectura`, 16px con
 * 1.55 (24.8px). La cuenta, de arriba abajo:
 *
 *   py-3.5 arriba y abajo      28.0
 *   titular de dos lineas      49.6   (2 x 16px x 1.55)
 *   mt-1.5                      6.0
 *   linea de meta con pastillas 19.4  (12px x 1.45, mas py-px)
 *   border-b                    1.0
 *                             ------
 *                             104.0
 *
 * Antes daba 92.2 por la misma cuenta y el numero puesto era 96, o sea que
 * llevaba holgura para las filas cuya linea de meta se envuelve. Se conserva
 * esa proporcion. Es una cuenta, no una medicion: conviene confirmarla en el
 * navegador con getBoundingClientRect sobre una fila DENTRO de pantalla
 * (fuera de pantalla, content-visibility hace que mida cero).
 *
 * `memo` paga porque `nota` tiene identidad estable (los objetos son de SWR),
 * `corte` es un numero y `roster` es un Map memoizado. Si alguno se
 * reconstruyera en cada render, memo seria puro costo.
 */
const FilaBase = function Fila({
  nota,
  corte,
  roster,
}: {
  nota: Nota;
  corte: number;
  roster: Map<string, Figura>;
}) {
  const t = cuando(nota, corte);

  return (
    <article
      className="grid grid-cols-[4rem_1fr] gap-4 border-b border-vela py-3.5 [contain-intrinsic-size:0_104px] [content-visibility:auto]"
    >
      <div className="pt-0.5 font-mono text-meta tabular-nums text-tinta-meta">
        {t.iso === null ? (
          t.principal
        ) : (
          <time dateTime={t.iso}>{t.principal}</time>
        )}
        {t.edad === "" ? null : (
          <span className="block text-tinta-meta">{t.edad}</span>
        )}
      </div>

      <div className="min-w-0">
        <h3 className="text-lectura font-normal">
          <a
            href={nota.url}
            target="_blank"
            rel="noopener nofollow noreferrer"
            className="text-tinta-titulo transition-colors hover:text-chart-1-texto"
          >
            {nota.titulo}
          </a>
        </h3>

        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-meta text-tinta-meta">
          <span>{nota.dominio}</span>

          {delegacionesDeNota(nota).map((d) => (
            <span
              key={d}
              data-delegacion={d}
              title={`Delegación ${d}, nombrada en el titular`}
              className="inline-block rounded-full border border-filo bg-vela px-2 py-px text-meta whitespace-nowrap text-tinta-dato"
            >
              {NOMBRE_CORTO_DELEGACION[d]}
            </span>
          ))}

          {nota.figuras.map((f) => {
            const cargo = cargoDe(f.id, roster);
            return (
              <span
                key={`${f.id}-${f.via}`}
                data-via={f.via}
                title={`${cargo === null ? "" : cargo + " · "}${
                  f.via === "cargo"
                    ? "por el cargo que ocupaba en la fecha de la nota"
                    : "nombrado en el titular"
                }`}
                className={`inline-block rounded-full border px-2 py-px text-meta whitespace-nowrap ${
                  f.via === "cargo"
                    ? "border-dashed border-filo text-tinta-meta"
                    : "border-filo bg-vela text-tinta-dato"
                }`}
              >
                {nombreCorto(f.id, roster)}
              </span>
            );
          })}

          {nota.postura === null ? null : (
            <span
              title={
                nota.postura.metodo === "modelo"
                  ? "Cómo suena el titular. No mide la postura hacia una persona."
                  : "Tono preliminar del titular."
              }
              className={`inline-block rounded-full border px-2 py-px text-meta whitespace-nowrap ${
                nota.postura.etiqueta === "adversa"
                  ? "border-baja/30 text-baja/80"
                  : nota.postura.etiqueta === "favorable"
                    ? "border-sube/30 text-sube/80"
                    : "border-filo text-tinta-meta"
              }`}
            >
              tono {nota.postura.etiqueta === "adversa" ? "adverso" : nota.postura.etiqueta}
            </span>
          )}
        </p>
      </div>
    </article>
  );
};

export const NotaFila = memo(FilaBase);
