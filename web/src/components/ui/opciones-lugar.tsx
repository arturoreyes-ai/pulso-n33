"use client";

import Link from "next/link";

import { clasesChip } from "@/components/ui/clases";
import { Segmentado, type OpcionSegmento } from "@/components/ui/segmentado";

/**
 * El cuerpo de TODO dialogo de lugar: el alcance arriba en un segmentado y los
 * lugares debajo como pastillas que fluyen.
 *
 * Existe porque habia tres. La portada tenia este (ahora/controles-ahora.tsx),
 * Redes tenia renglones del ancho de la hoja con una palomita y otros nombres
 * —«Corredor / México / Mundo» contra «Región / México / Internacional», «Toda
 * la región» contra «El corredor»— y la cinta del resto de las paginas otra
 * lista de renglones. El cliente lo vio el 23 de septiembre de 2026 con dos
 * capturas lado a lado: el mismo gesto no puede verse de dos maneras en el
 * mismo producto. Aqui vive la FORMA; cada llamador pone solo sus datos (a
 * donde lleva cada opcion), que es lo unico que de verdad cambia entre ellos.
 *
 * Por que el alcance va arriba y no despues de las ciudades: el docstring de
 * controles-ahora.tsx cuenta los dos intentos que fallaron por eso.
 *
 * Una opcion de alcance puede NAVEGAR (`href`, la portada) o ELEGIR sin
 * navegar (`onElegir`, las cubetas de Redes, que son estado del visor). La que
 * elige cierra su propia hoja: no desmonta nada, y sin cerrarla la hoja se
 * quedaba encima del contenido que acababa de cambiar.
 *
 * Cliente por ese `onClick`. Un componente de servidor puede montarlo igual
 * mientras solo pase `href`, que es lo que hace la cinta.
 */

export type OpcionAlcance = OpcionSegmento;

export interface OpcionLugar {
  id: string;
  nombre: string;
  href: string;
  activo: boolean;
}

export function OpcionesLugar({ alcances, lugares, etiquetaLugares = "Lugares de la región" }: {
  /** Con menos de dos no se pinta: no hay nada que elegir. */
  alcances: readonly OpcionAlcance[];
  /** `null` cuando el alcance no se subdivide (México, Internacional). */
  lugares: readonly OpcionLugar[] | null;
  etiquetaLugares?: string;
}) {
  const conAlcance = alcances.length > 1;
  return (
    <div className="grid gap-4 p-4">
      {conAlcance ? <Segmentado etiqueta="Alcance" opciones={alcances} cerrarDialogo /> : null}
      {lugares === null ? null : (
        <PastillasLugar lugares={lugares} etiqueta={etiquetaLugares} className={conAlcance ? "border-t border-filo pt-4" : ""} />
      )}
    </div>
  );
}

/** Las pastillas de lugar, solas: las usa este dialogo y el selector de zona
 *  del encabezado de una pagina (chrome/selector-zona.tsx). */
export function PastillasLugar({ lugares, etiqueta, className = "" }: {
  lugares: readonly OpcionLugar[];
  etiqueta?: string;
  className?: string;
}) {
  return (
    <ul aria-label={etiqueta} className={`flex flex-wrap gap-2 ${className}`}>
      {lugares.map((l) => (
        <li key={l.id}>
          <Link href={l.href} aria-current={l.activo ? "page" : undefined} className={clasesChip(l.activo)}>
            {l.nombre}
          </Link>
        </li>
      ))}
    </ul>
  );
}
