"use client";

import { ArrowLeft as FlechaAtras, CaretDown as Desplegar } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";

import { CINTA, CONTROL, FILA_CINTA, ICONO_DESPLEGAR, ICONO_ESTRECHO } from "@/components/chrome/medidas-cinta";
import { Hoja } from "@/components/ui/hoja";

/**
 * El lector: la caja que ES la pantalla.
 *
 * Nacio en /ahora para el telefono (15 de septiembre de 2026) y el mismo dia
 * se monto el Visual de redes dentro y paso a ser la pantalla tambien en
 * escritorio. Los dos recorren tarjetas de una en una, y la pagina que los
 * rodea —encabezado, pie, la pildora en el telefono— no cabe con ellas: una
 * tarjeta que mide "la pantalla menos la pildora" deja medias tarjetas al
 * ajustar. Aqui la caja es fija, mide el viewport visual (`--alto-lector`) y
 * tiene su propia barra arriba: volver, que se esta viendo (abre un dialogo
 * con las opciones) y las acciones de cada pagina. Debajo de
 * la barra puede ir una fila de pestanas (`pestanas`), que es como redes
 * cambia de plataforma. En escritorio la caja empieza a la derecha del riel
 * (`--riel-ancho`); en el telefono termina encima de la barra de pestanas
 * (`--barra-alto`). Las dos medidas viven en globals.css.
 *
 * Lo que se OCULTA mientras el lector esta arriba lo decide una sola regla en
 * globals.css (`main:has(.lector) > :not(:has(.lector))`), no cada pagina.
 *
 * NO hay boton de «Acerca de», ni pie. Los hubo hasta el 18 de septiembre de
 * 2026: el dialogo traia la entrada de cada pagina y, dentro, el pie del sitio.
 * El cliente quito los dos ese dia —primero la ficha, luego el pie de todo el
 * tablero— porque explicarle al lector de donde sale lo que ve no es trabajo de
 * la pantalla. Lo que NO se fue son las salvedades que viven donde se leen: los
 * huecos los rotula cada panel («sin dato», «fuera de muestra»), las filas en
 * vivo dicen que no se suman a las cifras de prensa, y las lecturas del modelo
 * llevan su SALVEDAD_FIJA. Ver docs/PLAN.md y PRODUCT.md.
 *
 * Dialogos nativos: el resto del lector queda inerte y Escape devuelve el foco
 * al control que abrio, sin desplazar la tarjeta que se estaba leyendo.
 *
 * La barra NO lleva menu desde el 28 de septiembre de 2026. Lo llevo mientras
 * fue la unica salida del telefono hacia las otras paginas y hacia «Salir»,
 * porque la regla de globals.css oculta todo lo que no sea el lector. Hoy la
 * navegacion del sitio es un riel en escritorio y una barra de pestanas en el
 * telefono (chrome/riel.tsx), las dos exentas de esa regla, y el boton de menu
 * aqui arriba seria la misma lista a un pulgar de distancia.
 */

/** La clase de un control de la barra, para las acciones que aporta cada
 *  pagina (recargar en la portada). Se define en chrome/medidas-cinta.ts junto
 *  al resto de las medidas y se reexporta aqui para no mover a sus cinco
 *  importadores, y para que chrome/ no tenga que importar de lector/ para
 *  dibujar la misma barra. */
export { CONTROL };

/**
 * Los ids de los dialogos salen del rotulo, y un rotulo de dos palabras —«En
 * Tendencia»— metia un espacio en `id`, en `aria-controls` y en
 * `aria-labelledby`. Los tres son listas de IDREF separadas por espacio: el
 * dialogo se quedaba sin nombre accesible y el boton apuntaba a dos ids que no
 * existen. Compila, typechequea y se ve perfecto.
 */
const babosa = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function Lector({ volver, rotulo, rotuloValor, valor, tituloOpciones, opciones, acciones, busqueda, pestanas, restaurarFoco, children }: {
  /** A donde lleva la flecha de volver. Sin esto no se pinta la flecha: la
   *  portada es un lector y no tiene pagina detras a la que volver. */
  volver?: string;
  /** La pagina («En Tendencia», «Redes»). Siembra los ids de los dialogos,
   *  asi que NO cambia entre modos de una misma pagina. */
  rotulo: string;
  /** Lo que se lee en pequeno sobre el valor, si no es el rotulo. La
   *  busqueda lo usa para decir «Búsqueda» sin renombrar la pagina ni mover
   *  los ids de sus cuatro dialogos. */
  rotuloValor?: string;
  /** Lo que se esta viendo («Tijuana», «Toda la región»). */
  valor: string;
  tituloOpciones: string;
  /** El cuerpo del dialogo de opciones. El lector lo cierra al pulsar
   *  cualquier enlace o boton de dentro. */
  opciones: ReactNode;
  acciones?: ReactNode;
  /** La busqueda EN la barra (ui/busqueda-en-barra.tsx): la pastilla
   *  «Buscar» que se abre en su sitio. Sin esto no se pinta. La portada busca
   *  titulares; Redes busca publicaciones y terminos en seguimiento desde el
   *  18 de septiembre de 2026. Hasta el 28 era el cuerpo de una hoja modal. */
  busqueda?: ReactNode;
  /** La fila de pestanas bajo la barra, si la pagina tiene facetas. */
  pestanas?: ReactNode;
  /** Si el lector se remonta al elegir, la pagina lo pone en true para
   *  devolver el foco al selector. */
  restaurarFoco?: RefObject<boolean>;
  children: ReactNode;
}) {
  const selector = useRef<HTMLButtonElement>(null);
  const lugares = useRef<HTMLDialogElement>(null);
  const idOpciones = `opciones-${babosa(rotulo)}`;
  useEffect(() => {
    if (restaurarFoco?.current) selector.current?.focus({ preventScroll: true });
    if (restaurarFoco) restaurarFoco.current = false;
  }, [restaurarFoco]);

  return (
    <div className="lector">
      <div className={CINTA}>
        <div className={FILA_CINTA} aria-label={`Controles de ${rotulo}`}>
          {volver === undefined ? null : (
            <Link href={volver} className={`${CONTROL} shrink-0`} aria-label="Volver">
              <FlechaAtras size={ICONO_ESTRECHO} aria-hidden />
            </Link>
          )}
          <button ref={selector} type="button" className="flex min-w-0 flex-1 items-center gap-2 rounded-nucleo px-2 py-2 text-left hover:bg-vela md:flex-none"
            aria-haspopup="dialog" aria-controls={idOpciones} onClick={() => lugares.current?.showModal()}>
            <span className="min-w-0">
              <span className="block text-meta text-tinta-meta">{rotuloValor ?? rotulo}</span>
              <span className="block truncate text-cuerpo text-tinta-titulo">{valor}</span>
            </span>
            <Desplegar size={ICONO_DESPLEGAR} className="shrink-0 text-tinta-meta" aria-hidden />
          </button>
          <span className="hidden flex-1 md:block" aria-hidden />
          {acciones}
          {/* La busqueda dice «Buscar», con borde y fondo, en todos los
              anchos (cliente, 28 de septiembre de 2026): una lupa sola entre
              los iconos de la barra no se distinguia de ellos. El nombre
              accesible empieza con la palabra visible («Buscar titulares»),
              que es lo que pide quien la dicta por voz. Cabe en el telefono
              porque los destellos del guion salieron de la barra ese dia.
              Al abrirse, el campo se dibuja encima de esta fila (`.fila-cinta`
              es `position: relative`), asi que nada de la barra se mueve. */}
          {busqueda}
        </div>
        {pestanas}
      </div>

      {/* Los enlaces navegan y desmontan la hoja; el boton de cierre la cierra aqui. */}
      <Hoja ref={lugares} titulo={tituloOpciones} rotuloCerrar="Cerrar opciones" id={idOpciones}>
        {opciones}
      </Hoja>

      {children}
    </div>
  );
}
