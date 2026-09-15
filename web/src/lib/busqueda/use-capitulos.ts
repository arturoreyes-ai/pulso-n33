"use client";

import { useMemo, useRef } from "react";

import { capitulosDe, hilar, type Capitulos, type Entrada, type EstadoCapitulo, type Hilado } from "./capitulos";
import type { Idioma, ResultadoExterno } from "./tipos";
import { useActualidad, type ActualidadViva } from "./use-actualidad";
import { plegar } from "@/lib/dominio/formato";

/**
 * Los ocho capitulos de /ahora, en vivo, hilados en tarjetas.
 *
 * Llama a useActualidad OCHO veces, una por capitulo, siempre, con `null` en
 * los que aun no toca pedir (useActualidad con null no pide nada). El numero
 * es fijo porque `Capitulos` es una tupla, y eso es lo que hace legal el
 * patron: la regla de los hooks es que la cuenta no cambie entre renders, no
 * que no haya varios.
 *
 * CONGELA cada capitulo la primera vez que asienta. useActualidad se refresca
 * cada cinco minutos y al volver a la pestana, y una lista que cambia bajo el
 * dedo del lector mueve la tarjeta que esta leyendo, o la borra. Lo que se
 * hila es la copia congelada; si la lista viva ya es otra, `hayNuevos` lo
 * dice y el recorrido ofrece recargar, que es remontar y volver a congelar.
 */

export interface CapitulosVivos {
  capitulos: Capitulos;
  hilado: Hilado;
  /** False cuando ya se sabe que no hay servidor: no se pinta el recorrido. */
  disponible: boolean;
  /** Alguna lista viva trae titulares distintos de los congelados. */
  hayNuevos: boolean;
}

type Congelado =
  | { estado: "fallo" }
  | { estado: "listo"; resultados: readonly ResultadoExterno[]; caidos: readonly Idioma[]; truncada: boolean };

const INACTIVO: EstadoCapitulo = { estado: "inactivo" };
const CARGANDO: EstadoCapitulo = { estado: "cargando" };

/** Lo que se congela de una respuesta ya asentada, o null si aun no asento. */
function asentado(viva: ActualidadViva): Congelado | null {
  if (viva.cargando) return null;
  if (viva.resultados.length > 0 || viva.consultado !== null) {
    return { estado: "listo", resultados: viva.resultados, caidos: viva.caidos, truncada: viva.truncada };
  }
  if (viva.fallo) return { estado: "fallo" };
  return null;
}

const claves = (resultados: readonly ResultadoExterno[]): string =>
  resultados.map((r) => plegar(r.titulo)).join("\n");

export function useCapitulos(entrada: Entrada, activados: number): CapitulosVivos {
  const capitulos = useMemo(() => capitulosDe(entrada), [entrada]);
  const congelados = useRef<(Congelado | null)[]>(Array.from({ length: capitulos.length }, () => null));

  const vivas = [
    useActualidad(activados > 0 ? capitulos[0].pedido : null),
    useActualidad(activados > 1 ? capitulos[1].pedido : null),
    useActualidad(activados > 2 ? capitulos[2].pedido : null),
    useActualidad(activados > 3 ? capitulos[3].pedido : null),
    useActualidad(activados > 4 ? capitulos[4].pedido : null),
    useActualidad(activados > 5 ? capitulos[5].pedido : null),
    useActualidad(activados > 6 ? capitulos[6].pedido : null),
    useActualidad(activados > 7 ? capitulos[7].pedido : null),
  ] as const;

  const estados: EstadoCapitulo[] = [];
  let hayNuevos = false;
  vivas.forEach((viva, i) => {
    if (!viva.activa) {
      estados.push(INACTIVO);
      return;
    }
    // Escritura perezosa del ref durante el render: solo de null a un valor,
    // una vez por capitulo. Es la inicializacion tardia que React permite.
    let hielo = congelados.current[i] ?? null;
    if (hielo === null) {
      hielo = asentado(viva);
      congelados.current[i] = hielo;
    }
    if (hielo === null) {
      estados.push(CARGANDO);
      return;
    }
    estados.push(hielo);
    if (hielo.estado === "fallo") {
      if (viva.resultados.length > 0) hayNuevos = true;
    } else if (!viva.cargando && viva.resultados.length > 0 && claves(viva.resultados) !== claves(hielo.resultados)) {
      hayNuevos = true;
    }
  });

  const hilado = useMemo(() => hilar(capitulos, estados), [capitulos, ...estados]);

  return { capitulos, hilado, disponible: vivas[0].activa, hayNuevos };
}
