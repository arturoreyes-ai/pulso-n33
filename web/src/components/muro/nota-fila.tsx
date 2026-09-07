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
 * La altura intrinseca es la medida real de una fila de una o dos lineas. Si
 * el numero esta mal, la barra de scroll salta; hay que volver a medirla si
 * cambia la escala tipografica.
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
      className="grid grid-cols-[4rem_1fr] gap-4 border-b border-vela py-3.5 [contain-intrinsic-size:0_96px] [content-visibility:auto]"
    >
      <div className="pt-0.5 font-mono text-2xs leading-snug tabular-nums text-tinta-meta">
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
        <h3 className="text-[15px] leading-snug font-normal">
          <a
            href={nota.url}
            target="_blank"
            rel="noopener nofollow noreferrer"
            className="text-tinta-titulo transition-colors duration-700 ease-firma hover:text-chart-1"
          >
            {nota.titulo}
          </a>
        </h3>

        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-2xs text-tinta-meta">
          <span>{nota.dominio}</span>

          {delegacionesDeNota(nota).map((d) => (
            <span
              key={d}
              data-delegacion={d}
              title={`Delegación ${d}, nombrada en el titular`}
              className="inline-block rounded-full border border-filo bg-vela px-2 py-px text-2xs whitespace-nowrap text-tinta-dato"
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
                    ? "resuelto por el cargo vigente a la fecha"
                    : "nombrado en el titular"
                } («${f.clave}»)`}
                className={`inline-block rounded-full border px-2 py-px text-2xs whitespace-nowrap ${
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
                  ? "Tono del titular asignado por un modelo entrenado en texto de redes. Mide el tono de la frase, no la postura hacia una persona."
                  : "Tono del titular por diccionario de linea base, no publicable."
              }
              className={`inline-block rounded-full border px-2 py-px text-2xs whitespace-nowrap ${
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
