"use client";

import { useSearchParams } from "next/navigation";

import {
  ambitoPorOmision,
  ambitosDe,
  esAmbito,
  type Ambito,
} from "@/lib/busqueda/ambito";
import type { ZonaRuta } from "@/lib/dominio/zonas";

export const PARAM_AMBITO = "a";

/**
 * Hasta donde busca el muro, en la URL (?a=mexico).
 *
 * Mismo trato que ?d= y ?q=: se comparte y se marca, y se escribe con
 * replaceState para no llenar el historial. A diferencia de la consulta, esto
 * NO lleva retardo: es un toque, no una tecla, y la lista tiene que responder
 * al instante.
 *
 * Se DERIVA en el render, sin efecto que lo sincronice. Un ambito que no
 * corresponde a esta pagina -- ?a=zona en el indice, o un valor inventado --
 * cae al de omision en vez de dejar la barra en un estado que no existe.
 */
export function useAmbito(zona: ZonaRuta | null): Ambito {
  const params = useSearchParams();
  const crudo = params.get(PARAM_AMBITO);
  if (!esAmbito(crudo)) return ambitoPorOmision(zona);
  return ambitosDe(zona).includes(crudo) ? crudo : ambitoPorOmision(zona);
}

export function elegirAmbito(a: Ambito, zona: ZonaRuta | null) {
  const url = new URL(window.location.href);
  if (a === ambitoPorOmision(zona)) url.searchParams.delete(PARAM_AMBITO);
  else url.searchParams.set(PARAM_AMBITO, a);
  window.history.replaceState(null, "", url);
}
