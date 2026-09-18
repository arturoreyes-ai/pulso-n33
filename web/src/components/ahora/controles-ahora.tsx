"use client";

import Link from "next/link";

import { clasesChip } from "@/components/ui/clases";
import { rutaDeEntrada } from "@/lib/busqueda/entrada";
import type { Rubro } from "@/lib/busqueda/rubros";
import type { Entrada } from "@/lib/busqueda/capitulos";
import { NOMBRE_CORTO, ZONAS_RUTA } from "@/lib/dominio/zonas";

export function nombreDe(entrada: Entrada): string {
  // «El corredor» y no «Toda la región»: esta entrada trae Tijuana y San
  // Diego, no las nueve zonas. El SEGMENTO de arriba si se llama Región,
  // porque ese si agrupa el corredor y los ocho municipios.
  if (entrada === "region") return "El corredor";
  if (entrada === "mexico") return "México";
  if (entrada === "internacional") return "Internacional";
  return NOMBRE_CORTO[entrada];
}

/**
 * El cuerpo del dialogo «Por dónde empezar». El lector lo cierra al pulsar
 * cualquier opcion, y aqui dentro todo es un enlace: la entrada vive en la URL
 * —segmento para un municipio, `?e=` para las ediciones— asi que elegir es
 * navegar, y eso da `aria-current` de verdad y hace la eleccion compartible.
 *
 * DOS INTENTOS ANTES DE ESTE, y los dos fallaron por el mismo motivo: ponian
 * los tres ALCANCES despues de las ocho ciudades.
 *
 *  1. Once enlaces planos. Mexico e Internacional caian a 631px del inicio de
 *     una hoja que mide como mucho 80svh, o sea fuera de la pantalla: las dos
 *     opciones que cambian la escala del recorrido entero eran las unicas que
 *     no se veian.
 *  2. Las ciudades plegables bajo un caret. Arreglaba el pliegue a costa de un
 *     control raro —un boton de desplegar flotando FUERA de la pastilla que
 *     navega, con la palomita dentro y el caret afuera, dos afordancias a la
 *     derecha en dos sitios distintos— y de un estado que la hoja no necesita.
 *
 * Lo que lo resuelve no es una tercera manera de plegar: es el ORDEN. Con los
 * tres alcances arriba, en un segmentado, estan siempre visibles sin importar
 * lo que venga debajo, y el plegado deja de hacer falta. Las ciudades pasan a
 * ser pastillas que fluyen —una faceta, que es lo que son— en vez de ocho
 * botones del ancho de la hoja.
 *
 * Es el modelo que ya tenia chrome/navegacion-titulares.tsx para el alcance
 * del muro: Region abre sus ciudades, Mexico e Internacional no tienen
 * subdivisiones. Se conserva aqui porque aquel archivo se fue con el muro.
 *
 * Sin estado de cliente: elegir un alcance NAVEGA, asi que no hay nada que
 * abrir ni cerrar dentro de la hoja.
 */

/** Los tres alcances, en el orden en que crecen. */
const ALCANCES: readonly { entrada: Entrada; nombre: string }[] = [
  { entrada: "region", nombre: "Región" },
  { entrada: "mexico", nombre: "México" },
  { entrada: "internacional", nombre: "Internacional" },
];

/** El corredor primero, que es la region sin municipio, y luego los ocho. */
const LUGARES: readonly Entrada[] = ["region", ...ZONAS_RUTA];

/** `rubro` viaja para CONSERVARSE, no para mostrarse: aqui no se elige tema.
 *  Cambiar de lugar con Seguridad puesta deja Seguridad puesta, que es lo que
 *  cualquiera espera de dos facetas de la misma pantalla. */
export function OpcionesAhora({ entrada, rubro }: { entrada: Entrada; rubro: Rubro | null }) {
  // Una zona ES la region, acotada. El segmentado marca Region y la pastilla
  // de abajo dice cual.
  const enRegion = entrada !== "mexico" && entrada !== "internacional";

  return (
    <div className="grid gap-4 p-4">
      <div role="group" aria-label="Alcance" className="grid grid-cols-3 gap-1 rounded-full border border-filo bg-vanta p-1">
        {ALCANCES.map(({ entrada: alcance, nombre }) => {
          const activo = alcance === "region" ? enRegion : alcance === entrada;
          return (
            <Link
              key={alcance}
              href={rutaDeEntrada(alcance, rubro)}
              aria-current={activo ? "page" : undefined}
              className={[
                "rounded-full px-3 py-2 text-center text-cuerpo",
                "transition-colors duration-[var(--dur-toque)] ease-firma",
                activo
                  ? "bg-realce text-tinta-titulo"
                  : "text-tinta-prosa hover:bg-vela hover:text-tinta-titulo",
              ].join(" ")}
            >
              {nombre}
            </Link>
          );
        })}
      </div>

      {/* Mexico e Internacional no se subdividen: no hay nada que listar. */}
      {enRegion ? (
        <ul aria-label="Lugares de la región" className="flex flex-wrap gap-2 border-t border-filo pt-4">
          {LUGARES.map((lugar) => {
            const activo = lugar === entrada;
            return (
              <li key={lugar}>
                <Link
                  href={rutaDeEntrada(lugar, rubro)}
                  aria-current={activo ? "page" : undefined}
                  className={clasesChip(activo)}
                >
                  {nombreDe(lugar)}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
