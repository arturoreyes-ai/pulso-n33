"use client";

import { useMemo, useRef } from "react";

import { CAPITULOS_MAXIMO, capitulosDe, hilar, type Capitulos, type Entrada, type EstadoCapitulo, type Hilado } from "./capitulos";
import type { Idioma, ResultadoExterno } from "./tipos";
import { useActualidad, type ActualidadViva } from "./use-actualidad";
import { useComunicados } from "@/lib/datos/hooks";
import type { DocComunicados } from "@/lib/datos/tipos";
import { plegar } from "@/lib/dominio/formato";

/**
 * Los capitulos del recorrido, en vivo, hilados en tarjetas.
 *
 * Llama a useActualidad NUEVE veces, siempre, con `null` en las ranuras que no
 * toca pedir o que no son de la lectura en vivo (useActualidad con null no pide
 * nada). Nueve y no ocho porque la cadena de Tecate suma los comunicados del
 * Ayuntamiento; el numero es una constante, `CAPITULOS_MAXIMO`, y eso es lo que
 * hace legal el patron: la regla de los hooks es que la cuenta no cambie entre
 * renders, no que no haya varios. Por lo mismo `estados` se arma SIEMPRE con
 * nueve entradas —rellenando con inactivo— aunque la cadena tenga ocho: el
 * useMemo de abajo lleva dependencias con spread y React exige que el arreglo
 * no cambie de tamano entre renders.
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

/** Cuantos comunicados entran al recorrido. Son boletines, no lo que esta
 *  pasando: cinco es una seccion del recorrido y no un tercio de el. Vienen
 *  ordenados por fecha descendente, asi que son los cinco ultimos. */
export const TOPE_COMUNICADOS = 5;

/** Lo que se congela de una respuesta ya asentada, o null si aun no asento. */
function asentado(viva: ActualidadViva): Congelado | null {
  if (viva.cargando) return null;
  if (viva.resultados.length > 0 || viva.consultado !== null) {
    return { estado: "listo", resultados: viva.resultados, caidos: viva.caidos, truncada: viva.truncada };
  }
  if (viva.fallo) return { estado: "fallo" };
  return null;
}

/**
 * Lo mismo para el documento municipal. Hermano de `asentado` y no el mismo:
 * aquel distingue «todavia no» de «vino vacio» con `consultado`, un campo que
 * solo devuelve la lectura en vivo.
 *
 * El mapeo a ResultadoExterno es directo porque un comunicado ya es titular,
 * fuente y enlace. `publicado` lleva una fecha SIN hora, y de eso se entera la
 * tarjeta por su capitulo: pintarle hora diria medianoche, que es falso.
 */
function asentadoComunicados(doc: DocComunicados | undefined, cargando: boolean, fallo: boolean): Congelado | null {
  if (cargando) return null;
  if (doc === undefined) return fallo ? { estado: "fallo" } : null;
  const resultados: ResultadoExterno[] = doc.comunicados.slice(0, TOPE_COMUNICADOS).map((c) => ({
    titulo: c.titulo,
    url: c.url,
    dominio: "tecate.gob.mx",
    medio: doc.fuente.nombre,
    publicado: c.fecha,
    idioma: "es",
  }));
  return { estado: "listo", resultados, caidos: [], truncada: false };
}

const claves = (resultados: readonly ResultadoExterno[]): string =>
  resultados.map((r) => plegar(r.titulo)).join("\n");

export function useCapitulos(entrada: Entrada, activados: number): CapitulosVivos {
  const capitulos = useMemo(() => capitulosDe(entrada), [entrada]);
  const congelados = useRef<(Congelado | null)[]>(Array.from({ length: CAPITULOS_MAXIMO }, () => null));

  /** El pedido de la ranura i, o null si no toca, no existe o no es de la
   *  lectura en vivo. Se escribe una vez y se usa nueve. */
  const pedido = (i: number) => {
    const c = capitulos[i];
    if (c === undefined || activados <= i || c.fuente !== "actualidad") return null;
    return c.pedido;
  };

  const vivas = [
    useActualidad(pedido(0)),
    useActualidad(pedido(1)),
    useActualidad(pedido(2)),
    useActualidad(pedido(3)),
    useActualidad(pedido(4)),
    useActualidad(pedido(5)),
    useActualidad(pedido(6)),
    useActualidad(pedido(7)),
    useActualidad(pedido(8)),
  ] as const;

  // El indice del capitulo de comunicados en ESTA cadena, o -1. Solo Tecate.
  const iComunicados = capitulos.findIndex((c) => c.fuente === "comunicados");
  const comunicados = useComunicados(iComunicados >= 0);

  const estados: EstadoCapitulo[] = [];
  let hayNuevos = false;
  for (let i = 0; i < CAPITULOS_MAXIMO; i++) {
    const c = capitulos[i];
    if (c === undefined) {
      estados.push(INACTIVO);
      continue;
    }
    if (i === iComunicados) {
      if (activados <= i) {
        estados.push(INACTIVO);
        continue;
      }
      let hielo = congelados.current[i] ?? null;
      if (hielo === null) {
        hielo = asentadoComunicados(comunicados.data, comunicados.isLoading, comunicados.error !== undefined);
        congelados.current[i] = hielo;
      }
      estados.push(hielo ?? CARGANDO);
      continue;
    }
    const viva = vivas[i]!;
    if (!viva.activa) {
      estados.push(INACTIVO);
      continue;
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
      continue;
    }
    estados.push(hielo);
    if (hielo.estado === "fallo") {
      if (viva.resultados.length > 0) hayNuevos = true;
    } else if (!viva.cargando && viva.resultados.length > 0 && claves(viva.resultados) !== claves(hielo.resultados)) {
      hayNuevos = true;
    }
  }

  const hilado = useMemo(() => hilar(capitulos, estados), [capitulos, ...estados]);

  return { capitulos, hilado, disponible: vivas[0]!.activa, hayNuevos };
}
