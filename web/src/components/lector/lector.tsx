"use client";

import { ArrowLeft as FlechaAtras, CaretDown as Desplegar, List as Menu, MagnifyingGlass as Lupa, X as Cerrar } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";

import { CINTA, CONTROL, FILA_CINTA, ICONO_CONTROL, ICONO_DESPLEGAR, ICONO_ESTRECHO } from "@/components/chrome/medidas-cinta";

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
 * cambia de plataforma. En escritorio la pildora flotante sigue arriba y la
 * caja empieza debajo de ella (`--nav-alto`).
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
 * El MENU de la barra es la navegacion del sitio, y en el telefono es la
 * unica. La regla de globals.css oculta todo lo que no sea el lector, y la
 * pildora flotante vuelve solo a partir de 48rem; mientras el lector fue una
 * pagina interior eso bastaba, porque la flecha de volver llevaba a una pagina
 * normal con su nav. Desde que la PORTADA es un lector no hay tal pagina detras,
 * y sin este control un telefono se queda sin manera de salir. Llega como nodo
 * de servidor para que la accion de servidor de «Salir» y los iconos no entren
 * al bundle de cliente.
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

export function Lector({ volver, rotulo, rotuloValor, valor, tituloOpciones, opciones, acciones, busqueda, menu, pestanas, restaurarFoco, children }: {
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
  /** El cuerpo del dialogo de busqueda. Sin esto no se pinta la lupa: redes
   *  no busca, solo la portada. */
  busqueda?: ReactNode;
  /** La navegacion del sitio, como HTML de servidor. */
  menu: ReactNode;
  /** La fila de pestanas bajo la barra, si la pagina tiene facetas. */
  pestanas?: ReactNode;
  /** Si el lector se remonta al elegir, la pagina lo pone en true para
   *  devolver el foco al selector. */
  restaurarFoco?: RefObject<boolean>;
  children: ReactNode;
}) {
  const selector = useRef<HTMLButtonElement>(null);
  const lugares = useRef<HTMLDialogElement>(null);
  const navegacion = useRef<HTMLDialogElement>(null);
  const buscador = useRef<HTMLDialogElement>(null);
  const idOpciones = `opciones-${babosa(rotulo)}`;
  const idMenu = `menu-${babosa(rotulo)}`;
  const idBusqueda = `busqueda-${babosa(rotulo)}`;
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
          {/* `id="zonas"`: la pastilla del lugar en la pildora flotante apunta a
              ese ancla; aqui el lugar se elige con este boton. */}
          <button ref={selector} id="zonas" type="button" className="flex min-w-0 flex-1 items-center gap-2 rounded-nucleo px-2 py-2 text-left hover:bg-vela md:flex-none"
            aria-haspopup="dialog" aria-controls={idOpciones} onClick={() => lugares.current?.showModal()}>
            <span className="min-w-0">
              <span className="block text-meta text-tinta-meta">{rotuloValor ?? rotulo}</span>
              <span className="block truncate text-cuerpo text-tinta-titulo">{valor}</span>
            </span>
            <Desplegar size={ICONO_DESPLEGAR} className="shrink-0 text-tinta-meta" aria-hidden />
          </button>
          <span className="hidden flex-1 md:block" aria-hidden />
          {acciones}
          {busqueda === undefined ? null : (
            <button type="button" className={CONTROL} aria-label="Buscar titulares" aria-haspopup="dialog" aria-controls={idBusqueda}
              onClick={() => buscador.current?.showModal()}>
              <Lupa size={ICONO_ESTRECHO} aria-hidden />
            </button>
          )}
          {/* Solo en el telefono. A partir de 48rem la pildora flotante vuelve
              a verse sobre el lector (globals.css) y lleva a las mismas
              paginas: dos navegaciones identicas a diez pixeles una de otra.
              Debajo de ese ancho la pildora esta oculta y esto es la UNICA
              salida hacia las otras paginas y hacia Salir, asi que se esconde,
              no se borra. La consulta vive en globals.css, junto al `display`
              de la clase, porque una utilidad de Tailwind pierde contra el. */}
          <button type="button" data-solo-movil className={CONTROL} aria-label="Ir a otra página" aria-haspopup="dialog" aria-controls={idMenu}
            onClick={() => navegacion.current?.showModal()}>
            <Menu size={ICONO_CONTROL} aria-hidden />
          </button>
        </div>
        {pestanas}
      </div>

      {/* Cierra al elegir: aqui dentro todo navega. */}
      <dialog ref={lugares} id={idOpciones} className="dialogo-lector" aria-labelledby={`titulo-${idOpciones}`}
        onClick={(evento) => { if ((evento.target as HTMLElement).closest("a, button")) lugares.current?.close(); }}>
        <div className="cabecera-dialogo-lector">
          <h2 id={`titulo-${idOpciones}`} className="text-rotulo text-tinta-titulo">{tituloOpciones}</h2>
          <button type="button" className={CONTROL} aria-label="Cerrar opciones"><Cerrar size={20} aria-hidden /></button>
        </div>
        {opciones}
      </dialog>

      {/* Cierra al pulsar cualquier enlace o boton, como el de lugares: aqui
          todo lo de dentro navega o envia. */}
      <dialog ref={navegacion} id={idMenu} className="dialogo-lector" aria-labelledby={`titulo-${idMenu}`}
        onClick={(evento) => { if ((evento.target as HTMLElement).closest("a, button")) navegacion.current?.close(); }}>
        <div className="cabecera-dialogo-lector">
          <h2 id={`titulo-${idMenu}`} className="text-rotulo text-tinta-titulo">Ir a</h2>
          <button type="button" className={CONTROL} aria-label="Cerrar menú"><Cerrar size={20} aria-hidden /></button>
        </div>
        {menu}
      </dialog>

      {busqueda === undefined ? null : (
        // Sin cierre delegado: el campo y el boton de enviar viven aqui, y
        // cerrar al primer clic dentro haria imposible escribir.
        <dialog ref={buscador} id={idBusqueda} className="dialogo-lector" aria-labelledby={`titulo-${idBusqueda}`}>
          <div className="cabecera-dialogo-lector">
            <h2 id={`titulo-${idBusqueda}`} className="text-rotulo text-tinta-titulo">Buscar</h2>
            <button type="button" className={CONTROL} aria-label="Cerrar búsqueda" onClick={() => buscador.current?.close()}>
              <Cerrar size={20} aria-hidden />
            </button>
          </div>
          {busqueda}
        </dialog>
      )}

      {children}
    </div>
  );
}
