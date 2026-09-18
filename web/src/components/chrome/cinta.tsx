import Link from "next/link";
import { ArrowLeft as FlechaAtras } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

import { CINTA, CINTA_PAGINA, CONTROL, FILA_CINTA, ICONO_ESTRECHO } from "@/components/chrome/medidas-cinta";
import { LugarCinta } from "@/components/chrome/lugar-cinta";

/**
 * La barra superior de una pagina que no es un lector, en el telefono.
 *
 * EL CASO: hasta el 18 de septiembre de 2026 el telefono tenia dos barras. Los
 * lectores —la portada y redes— llevaban una franja pegada a la orilla, opaca,
 * de 71px y con un filo de 1px; las demas paginas llevaban una pastilla
 * flotante de 62px, redonda, traslucida y con blur, a 16px del borde. Se
 * escribieron por separado y divergieron en cuatro decisiones que nadie tomo:
 * el radio del control (16 contra redondo), el lavado del hover (--color-vela
 * contra --color-filo), el material de la superficie y el tamano del icono de
 * la izquierda (20 contra 18 contra 14). El cliente pidio una sola, y esta es
 * la del lector.
 *
 * Comparte el CSS con el lector y NO un componente con ranuras (`.cinta`,
 * `.fila-cinta` en globals.css; los `size` en medidas-cinta.ts). Lo que
 * difiere entre las dos superficies no son las medidas sino el bloque
 * contenedor: la del lector es `flex: none` dentro de una caja fija que posee
 * el viewport y lleva cuatro dialogos con refs e ids generados; esta es una
 * franja `sticky` en flujo, de servidor. La union de esos dos juegos de props
 * no es un componente, es una API de layout — y «una sola definicion de las
 * medidas» es justo lo que el CSS da gratis.
 *
 * SIN CASA Y SIN LUPA, que es lo que la hace la misma barra y no una parecida.
 * El control de la izquierda del lector es «volver» en una pagina interior y
 * nada en la portada: indicadores ES interior, asi que lleva flecha; las
 * sueltas y la de 404 no tienen pagina padre y no llevan ninguna, con «En
 * Tendencia» a un renglon dentro del menu.
 *
 * Tampoco hay info, y desde el 18 de septiembre de 2026 el lector tampoco la
 * tiene: se quito con su prosa, y el mismo dia se quito el pie de todo el
 * tablero. No hay nada que este menu tenga que llevar aparte de la navegacion.
 */
export function Cinta({
  volver,
  rotulo,
  valor,
  tituloLugar,
  lugares,
  menu,
}: {
  /** A donde lleva la flecha. Sin esto no se pinta: una suelta no tiene padre. */
  volver?: string;
  /** La pagina: «Indicadores», «Garitas». */
  rotulo: string;
  /** Lo que se esta viendo: «Tijuana», «El corredor». */
  valor: string;
  tituloLugar?: string;
  /** Las opciones de lugar. Sin esto el bloque es inerte y no lleva caret. */
  lugares?: ReactNode;
  /** La navegacion del sitio, como nodo de servidor. */
  menu: ReactNode;
}) {
  return (
    <div className={`${CINTA} ${CINTA_PAGINA}`}>
      <div className={FILA_CINTA}>
        {volver === undefined ? null : (
          <Link href={volver} className={`${CONTROL} shrink-0`} aria-label="Volver">
            <FlechaAtras size={ICONO_ESTRECHO} aria-hidden />
          </Link>
        )}
        <LugarCinta rotulo={rotulo} valor={valor} titulo={tituloLugar}>
          {lugares}
        </LugarCinta>
        {menu}
      </div>
    </div>
  );
}
