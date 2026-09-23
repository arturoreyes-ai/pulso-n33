"use client";

import { CaretDown as Desplegar } from "@phosphor-icons/react";
import { useRef, type ReactNode } from "react";

import { ICONO_DESPLEGAR } from "@/components/chrome/medidas-cinta";
import { Hoja } from "@/components/ui/hoja";

/**
 * El bloque «donde estas» de la cinta, con su hoja de lugares.
 *
 * Es el mismo control que la barra del lector lleva desde que existe —rotulo
 * arriba, valor abajo, caret— y esta aqui para que la version de una pagina no
 * sea una segunda interpretacion de ese dibujo. Las medidas salen de
 * medidas-cinta.ts; el alto de la cinta lo fija justamente este bloque de dos
 * renglones.
 *
 * EL CARET SOLO APARECE SI HAY HOJA. En esta app `CaretDown` tiene un solo
 * significado, fijado por el lector: «esto abre un dialogo». Una pagina sin eje
 * de lugar —garitas, gasto electoral, la de 404— dice donde esta y no ofrece
 * nada que desplegar, asi que se pinta como texto y no como control. Un caret
 * que no abre un menu es una mentira sobre el glifo, y es una que se descubre
 * enseguida: /tijuana/redes y /tijuana/indicadores son paginas hermanas y estan
 * a un toque una de la otra.
 *
 * Es de CLIENTE por `showModal()`, y por eso las opciones entran como
 * `children`: se construyen en el servidor (chrome/opciones-zona.tsx), igual
 * que la hoja de paginas recibe `MenuLector`.
 */
export function LugarCinta({
  rotulo,
  valor,
  titulo,
  children,
}: {
  /** La pagina: «Indicadores», «Garitas». */
  rotulo: string;
  /** Lo que se esta viendo: «Tijuana», «El corredor». */
  valor: string;
  /** El encabezado de la hoja. Sin `children` no se usa. */
  titulo?: string;
  /** Las opciones, como nodo de servidor. Sin esto el bloque es inerte. */
  children?: ReactNode;
}) {
  const hoja = useRef<HTMLDialogElement>(null);

  const texto = (
    <span className="min-w-0">
      <span className="block text-meta text-tinta-meta">{rotulo}</span>
      <span className="block truncate text-cuerpo text-tinta-titulo">{valor}</span>
    </span>
  );

  if (children === undefined) {
    // Mismo relleno que el boton, para que el texto caiga sobre la misma linea
    // que en una pagina que si despliega y la cinta no cambie de alto.
    return <span className="min-w-0 flex-1 px-2 py-2">{texto}</span>;
  }

  return (
    <>
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 rounded-nucleo px-2 py-2 text-left hover:bg-vela"
        aria-haspopup="dialog"
        aria-controls="lugar-cinta"
        onClick={() => hoja.current?.showModal()}
      >
        {texto}
        <Desplegar size={ICONO_DESPLEGAR} className="shrink-0 text-tinta-meta" aria-hidden />
      </button>

      {/* Los enlaces navegan y desmontan la hoja; el boton de cierre la cierra aqui. */}
      <Hoja ref={hoja} titulo={titulo ?? "Lugar"} rotuloCerrar="Cerrar opciones" id="lugar-cinta">
        {children}
      </Hoja>
    </>
  );
}
