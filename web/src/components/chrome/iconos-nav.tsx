/**
 * Dos iconos de la navegacion que Phosphor no trae, armados con trazos de
 * Phosphor para que sean de la misma familia (chrome/riel.tsx).
 *
 * EL CASO, 28 de septiembre de 2026: el cliente pidio «autos» para Garitas y
 * «un guion con destellos de IA» para Guion. Phosphor tiene `Car` pero no
 * varios, y tiene `FilmScript` y `Sparkle` por separado. Un icono dibujado a
 * mano desde cero habria sido otra familia —otro grosor, otras esquinas— al
 * lado de catorce de Phosphor; estos reusan sus trazados tal cual (licencia
 * MIT) y solo los componen, en la reticula de 256 de Phosphor.
 *
 * - `IconoAutos`: dos `Car` escalonados, el de atras mas chico, como la fila
 *   de una garita. El de atras se RECORTA con una mascara donde pasa el de
 *   adelante, con un aire de trazo entre los dos: sin eso, en el peso regular
 *   se verian las lineas del de atras a traves del hueco del de adelante.
 * - `IconoGuion`: la hoja de guion de cine (`FilmScript`, con sus tres
 *   perforaciones) y un destello de `Sparkle` en la esquina, recortado igual.
 *   El destello va siempre relleno: a 22px un destello de contorno es una
 *   estrella de cuatro rayitas que no se lee.
 *
 * `id` es OBLIGATORIO y distinto por superficie: la mascara se referencia por
 * id, y el riel y la barra de pestanas pintan el mismo icono en la misma
 * pagina, uno de ellos en `display: none`. Una mascara definida dentro de un
 * SVG que no se pinta no aplica en Chrome, asi que compartir el id rompia el
 * icono visible en uno de los dos anchos.
 *
 * Mismas props que un icono de Phosphor que la nav usa: `size`, `weight`
 * (`regular` | `fill`) y `className`. Van `aria-hidden`: el rotulo los nombra.
 */

import type { ReactNode } from "react";

type Peso = "regular" | "fill";

interface Props {
  id: string;
  size?: number;
  weight?: Peso;
  className?: string;
}

const AUTO: Record<Peso, string> = {
  regular:
    "M240,104H229.2L201.42,41.5A16,16,0,0,0,186.8,32H69.2a16,16,0,0,0-14.62,9.5L26.8,104H16a8,8,0,0,0,0,16h8v80a16,16,0,0,0,16,16H64a16,16,0,0,0,16-16V184h96v16a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V120h8a8,8,0,0,0,0-16ZM69.2,48H186.8l24.89,56H44.31ZM64,200H40V184H64Zm128,0V184h24v16Zm24-32H40V120H216ZM56,144a8,8,0,0,1,8-8H80a8,8,0,0,1,0,16H64A8,8,0,0,1,56,144Zm112,0a8,8,0,0,1,8-8h16a8,8,0,0,1,0,16H176A8,8,0,0,1,168,144Z",
  fill:
    "M240,104H229.2L201.42,41.5A16,16,0,0,0,186.8,32H69.2a16,16,0,0,0-14.62,9.5L26.8,104H16a8,8,0,0,0,0,16h8v80a16,16,0,0,0,16,16H64a16,16,0,0,0,16-16v-8h96v8a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V120h8a8,8,0,0,0,0-16ZM80,152H56a8,8,0,0,1,0-16H80a8,8,0,0,1,0,16Zm120,0H176a8,8,0,0,1,0-16h24a8,8,0,0,1,0,16ZM44.31,104,69.2,48H186.8l24.89,56Z",
};

/** La silueta del auto, sin huecos: lo que tapa al de atras. */
const SILUETA_AUTO =
  "M240,104H229.2L201.42,41.5A16,16,0,0,0,186.8,32H69.2a16,16,0,0,0-14.62,9.5L26.8,104H16a8,8,0,0,0,0,16h8v80a16,16,0,0,0,16,16H64a16,16,0,0,0,16-16v-8h96v8a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V120h8a8,8,0,0,0,0-16Z";

const HOJA: Record<Peso, string> = {
  regular:
    "M200,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V40A16,16,0,0,0,200,24Zm0,192H56V40H200V216ZM96,76A12,12,0,1,1,84,64,12,12,0,0,1,96,76Zm0,104a12,12,0,1,1-12-12A12,12,0,0,1,96,180Zm0-52a12,12,0,1,1-12-12A12,12,0,0,1,96,128Z",
  fill:
    "M200,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V40A16,16,0,0,0,200,24ZM76,188a12,12,0,1,1,12-12A12,12,0,0,1,76,188Zm0-48a12,12,0,1,1,12-12A12,12,0,0,1,76,140Zm0-48A12,12,0,1,1,88,80,12,12,0,0,1,76,92Z",
};

/** El destello grande de `Sparkle` (peso fill), sin las dos cruces chicas. */
const DESTELLO =
  "M208,144a15.78,15.78,0,0,1-10.42,14.94L146,178l-19,51.62a15.92,15.92,0,0,1-29.88,0L78,178l-51.62-19a15.92,15.92,0,0,1,0-29.88L78,110l19-51.62a15.92,15.92,0,0,1,29.88,0L146,110l51.62,19A15.78,15.78,0,0,1,208,144Z";

/** El aire entre las dos piezas, en unidades de la reticula: ~2px a 22px. */
const AIRE = 26;

function Lienzo({ size = 22, className, children }: { size?: number; className?: string; children: ReactNode }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" fill="currentColor" aria-hidden className={className}>
      {children}
    </svg>
  );
}

// El de atras: 0.6, arriba a la izquierda. El de adelante: 0.72, abajo a la
// derecha. Se tocan en una banda de ~10 unidades; la mascara hace el resto.
const ATRAS = "translate(3.2 -11.2) scale(0.6)";
const ADELANTE = "translate(69.24 84.96) scale(0.72)";

export function IconoAutos({ id, size, weight = "regular", className }: Props) {
  const mascara = `${id}-autos`;
  return (
    <Lienzo size={size} className={className}>
      <mask id={mascara} maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256">
        <rect width="256" height="256" fill="white" />
        <path d={SILUETA_AUTO} transform={ADELANTE} fill="black" stroke="black" strokeWidth={AIRE / 0.72} strokeLinejoin="round" />
      </mask>
      {/* La mascara va en un <g> y no en el <path>: sobre el path se leeria
          en SU sistema ya escalado y recortaria casi todo el auto de atras. */}
      <g mask={`url(#${mascara})`}>
        <path d={AUTO[weight]} transform={ATRAS} />
      </g>
      <path d={AUTO[weight]} transform={ADELANTE} />
    </Lienzo>
  );
}

// El destello a 0.54, centrado en (198, 58): la esquina de arriba a la
// derecha de la hoja, que ocupa 40..216 x 24..232.
const EN_ESQUINA = "translate(137.52 -19.76) scale(0.54)";

export function IconoGuion({ id, size, weight = "regular", className }: Props) {
  const mascara = `${id}-guion`;
  return (
    <Lienzo size={size} className={className}>
      <mask id={mascara} maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256">
        <rect width="256" height="256" fill="white" />
        <path d={DESTELLO} transform={EN_ESQUINA} fill="black" stroke="black" strokeWidth={AIRE / 0.54} strokeLinejoin="round" />
      </mask>
      <g mask={`url(#${mascara})`}>
        <path d={HOJA[weight]} />
      </g>
      <path d={DESTELLO} transform={EN_ESQUINA} />
    </Lienzo>
  );
}
