"use client";

import { ArrowRight as Flecha } from "@phosphor-icons/react";
import Link from "next/link";
import type { ReactNode } from "react";

import { LARGO_MAXIMO_CONSULTA, MINIMO_CONSULTA } from "@/lib/busqueda/tipos";

/**
 * El cuerpo de todo dialogo de busqueda: etiqueta, campo, «Buscar» con su
 * flecha en circulo y, si ya se esta buscando, la salida como enlace discreto.
 *
 * Una sola desde el 23 de septiembre de 2026. La portada (ahora/buscador-
 * ahora.tsx) y Redes (paneles/buscador-redes.tsx) eran dos copias linea por
 * linea que se defendian como «gemelos deliberados»; lo que las distingue —la
 * etiqueta, el destino, la salida, los terminos en seguimiento de Redes— son
 * exactamente las props de aqui, y dos copias de la misma forma acaban
 * divergiendo. Las razones de la forma (form GET de verdad, campo hondo con un
 * solo filo, un solo boton y la salida como enlace) estan escritas en el
 * docstring de buscador-ahora.tsx.
 */
export function FormularioBusqueda({ accion, idCampo, etiqueta, consulta, placeholder, salida, children }: {
  accion: string;
  idCampo: string;
  etiqueta: string;
  consulta: string | null;
  placeholder: string;
  /** El texto del enlace que sale de la busqueda; solo se pinta con consulta. */
  salida: string;
  /** Lo que va entre el formulario y la salida (los terminos de Redes). */
  children?: ReactNode;
}) {
  return (
    <div className="grid gap-5 px-4 pt-5 pb-6">
      <form method="get" action={accion} className="grid gap-3">
        <label htmlFor={idCampo} className="text-meta text-tinta-meta">{etiqueta}</label>
        <input
          id={idCampo}
          name="q"
          type="search"
          defaultValue={consulta ?? ""}
          required
          minLength={MINIMO_CONSULTA}
          maxLength={LARGO_MAXIMO_CONSULTA}
          autoComplete="off"
          enterKeyHint="search"
          placeholder={placeholder}
          className="w-full rounded-nucleo border border-filo bg-vanta px-4 py-3 text-cuerpo text-tinta-titulo placeholder:text-tinta-inerte"
        />
        {/* El icono va en su propio circulo, a ras del relleno derecho. Al
            pulsar, el boton cede como todas las pastillas (ui/clases.ts). */}
        <button
          type="submit"
          className="group inline-flex items-center justify-between gap-3 rounded-full bg-realce py-2 pl-5 pr-2 text-cuerpo text-tinta-titulo transition-[color,background-color,scale] duration-[var(--dur-toque)] ease-out hover:bg-filo active:scale-[0.97]"
        >
          <span>Buscar</span>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-vanta transition-transform duration-[var(--dur-cambio)] ease-firma group-hover:translate-x-0.5">
            <Flecha size={16} aria-hidden />
          </span>
        </button>
      </form>

      {children}

      {consulta === null ? null : (
        <Link
          href={accion}
          className="justify-self-start text-meta text-tinta-meta underline decoration-filo underline-offset-4 transition-colors duration-[var(--dur-toque)] ease-out hover:text-tinta-titulo"
        >
          {salida}
        </Link>
      )}
    </div>
  );
}
