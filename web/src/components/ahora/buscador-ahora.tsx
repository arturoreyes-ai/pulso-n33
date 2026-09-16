"use client";

import { ArrowRight as Flecha } from "@phosphor-icons/react";
import Link from "next/link";

import { LARGO_MAXIMO_CONSULTA, MINIMO_CONSULTA } from "@/lib/busqueda/tipos";

/**
 * El cuerpo del dialogo de busqueda del lector.
 *
 * Es un `<form method="get">` de verdad y no un campo que busca al teclear.
 * Dos razones, y la segunda es la que manda: en un lector a pantalla completa
 * cada tecla reconstruiria la pila de tarjetas bajo el dedo de quien lee, y
 * ademas asi la busqueda funciona sin JavaScript y queda en la URL, que es lo
 * que la hace compartible y la conserva al recargar.
 *
 * `accion` es la ruta del lugar donde se esta leyendo, asi que enviar desde
 * /tijuana busca en Tijuana. Enviar tambien suelta la faceta `?e=`: una
 * busqueda sustituye a la edicion, no se suma a ella.
 *
 * TRES ARREGLOS de la primera version, los tres visibles en pantalla:
 *
 *  1. El campo era `bg-vela` CON borde, y encima cae el anillo de foco de
 *     globals.css (2px de chart-3 con 2px de separacion). Tres lineas
 *     concentricas alrededor de una caja de texto. Ahora el campo es un hueco
 *     —`bg-vanta`, mas hondo que la hoja— con un solo filo de pelo, y el
 *     anillo de foco es lo unico que se suma al enfocarlo.
 *  2. El aspa: `type="search"` pinta la suya en WebKit en cuanto hay texto, y
 *     quedaban dos maneras de vaciar el campo que no eran la misma. Se apaga
 *     en globals.css; el campo se vacia seleccionando, como cualquier otro.
 *  3. «Salir de la búsqueda» era una pastilla del mismo ancho y peso que
 *     «Buscar», debajo de ella y al lado del aspa de cerrar el dialogo: tres
 *     controles que parecian el mismo. Cerrar el dialogo y salir de la
 *     busqueda son cosas distintas —una tapa la hoja, la otra cambia lo que
 *     se esta leyendo— asi que ahora solo hay UN boton, y la salida es un
 *     enlace discreto que nombra su destino en vez de nombrar la accion.
 */
export function BuscadorAhora({ accion, lugar, consulta }: {
  accion: string;
  /** Donde se busca, para decirlo en vez de hacerlo adivinar. */
  lugar: string;
  consulta: string | null;
}) {
  return (
    <div className="grid gap-5 px-4 pt-5 pb-6">
      <form method="get" action={accion} className="grid gap-3">
        <label htmlFor="consulta-lector" className="text-meta text-tinta-meta">
          En {lugar}
        </label>

        <input
          id="consulta-lector"
          name="q"
          type="search"
          defaultValue={consulta ?? ""}
          required
          minLength={MINIMO_CONSULTA}
          maxLength={LARGO_MAXIMO_CONSULTA}
          autoComplete="off"
          enterKeyHint="search"
          placeholder="garita, agua, presupuesto…"
          className="w-full rounded-nucleo border border-filo bg-vanta px-4 py-3 text-cuerpo text-tinta-titulo placeholder:text-tinta-inerte"
        />

        {/* El icono va en su propio circulo, a ras del relleno derecho, y no
            suelto junto al texto. Al pulsar, el boton cede un punto: es la
            unica animacion aqui y usa las curvas del tablero. */}
        <button
          type="submit"
          className="group inline-flex items-center justify-between gap-3 rounded-full bg-realce py-2 pl-5 pr-2 text-cuerpo text-tinta-titulo transition-[background-color,transform] duration-[var(--dur-toque)] ease-firma hover:bg-filo active:scale-[0.99]"
        >
          <span>Buscar</span>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-vanta transition-transform duration-[var(--dur-cambio)] ease-firma group-hover:translate-x-0.5">
            <Flecha size={16} weight="light" aria-hidden />
          </span>
        </button>
      </form>

      {consulta === null ? null : (
        <Link
          href={accion}
          className="justify-self-start text-meta text-tinta-meta underline decoration-filo underline-offset-4 transition-colors duration-[var(--dur-toque)] ease-firma hover:text-tinta-titulo"
        >
          Volver al recorrido
        </Link>
      )}
    </div>
  );
}
