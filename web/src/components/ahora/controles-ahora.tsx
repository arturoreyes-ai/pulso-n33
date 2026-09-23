"use client";

import { OpcionesLugar } from "@/components/ui/opciones-lugar";
import { rutaDeEntrada } from "@/lib/busqueda/entrada";
import type { Rubro } from "@/lib/busqueda/rubros";
import type { Entrada } from "@/lib/busqueda/capitulos";
import { ZONAS_RUTA } from "@/lib/dominio/zonas";
import { nombreDe } from "./nombre-ahora";

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
 *
 * La forma vive en ui/opciones-lugar.tsx desde el 23 de septiembre de 2026 y
 * la comparten Redes y la cinta: aqui quedan solo los datos de la portada.
 */

/** Los tres alcances, en el orden en que crecen. */
const ALCANCES: readonly { entrada: Entrada; nombre: string }[] = [
  { entrada: "region", nombre: "Región" },
  { entrada: "mexico", nombre: "México" },
  { entrada: "internacional", nombre: "Internacional" },
];

/** «Todas» primero, que es la region sin municipio, y luego los ocho. */
const LUGARES: readonly Entrada[] = ["region", ...ZONAS_RUTA];

/** `rubro` viaja para CONSERVARSE, no para mostrarse: aqui no se elige tema.
 *  Cambiar de lugar con Seguridad puesta deja Seguridad puesta, que es lo que
 *  cualquiera espera de dos facetas de la misma pantalla. */
export function OpcionesAhora({ entrada, rubro }: { entrada: Entrada; rubro: Rubro | null }) {
  // Una zona ES la region, acotada. El segmentado marca Region y la pastilla
  // de abajo dice cual.
  const enRegion = entrada !== "mexico" && entrada !== "internacional";
  return (
    <OpcionesLugar
      alcances={ALCANCES.map(({ entrada: alcance, nombre }) => ({
        id: alcance,
        nombre,
        href: rutaDeEntrada(alcance, rubro),
        activo: alcance === "region" ? enRegion : alcance === entrada,
      }))}
      // Mexico e Internacional no se subdividen: no hay nada que listar.
      lugares={enRegion
        ? LUGARES.map((lugar) => ({ id: lugar, nombre: nombreDe(lugar), href: rutaDeEntrada(lugar, rubro), activo: lugar === entrada }))
        : null}
    />
  );
}
