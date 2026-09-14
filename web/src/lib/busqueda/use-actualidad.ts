"use client";

import { useMemo } from "react";
import useSWR from "swr";

import type { AmbitoActualidad } from "./ambito";
import { leerApi, useHayServidor } from "./disponible";
import type { Rubro } from "./rubros";
import type { Idioma, RespuestaActualidad, ResultadoExterno } from "./tipos";
import { SLUG_DE_ZONA, type ZonaRuta } from "@/lib/dominio/zonas";

const SIN_RESULTADOS: readonly ResultadoExterno[] = [];
const SIN_IDIOMAS: readonly Idioma[] = [];

/**
 * Cada cuanto se vuelve a pedir mientras la pestana esta a la vista. Igual
 * que el s-maxage del route handler: pedir mas seguido solo pega en el CDN.
 */
const REFRESCO_MS = 5 * 60_000;

/**
 * Que se pide, con la misma forma que entiende /api/actualidad: una edicion
 * o el corredor van en `a=`, la seccion local de una zona en `z=`, y un
 * rubro opcional en `t=` la vuelve busqueda.
 */
export type PedidoActualidad = (
  | { ambito: AmbitoActualidad | "region" }
  | { zona: ZonaRuta }
) & { rubro?: Rubro | null };

export interface ActualidadViva {
  /** En el orden de Google. No se reordena en ningun punto del camino. */
  resultados: readonly ResultadoExterno[];
  cargando: boolean;
  /** Locales que fallaron, para poder decir cual. */
  caidos: Idioma[];
  /** Ediciones que se pidieron, para decir en que idioma(s) viene la lista. */
  idiomas: readonly Idioma[];
  fallo: boolean;
  truncada: boolean;
  /** Hora del servidor al pedirle a Google, o null mientras no llega. */
  consultado: string | null;
  /** False cuando no se pide nada: sin pedido, o ya se sabe que no hay
   *  servidor. El bloque no se pinta. */
  activa: boolean;
}

function llaveDe(p: PedidoActualidad): string {
  const donde = "zona" in p ? `z=${SLUG_DE_ZONA[p.zona]}` : `a=${p.ambito}`;
  const rubro = p.rubro === undefined || p.rubro === null ? "" : `&t=${p.rubro}`;
  return `/api/actualidad?${donde}${rubro}`;
}

/**
 * Una seccion de Google Noticias, en vivo.
 *
 * useSWR y NO swr/immutable, a diferencia del resto de hooks de datos: esto
 * cambia mientras la pestana esta abierta, y "en este momento" es el punto.
 * Se refresca cada cinco minutos y al volver a la pestana.
 *
 * Sin `keepPreviousData`: la llave cambia al pasar de Mexico a Internacional,
 * o de un rubro a otro, y conservar la anterior pintaria las filas de uno
 * debajo de la pastilla del otro por un instante. Revalidar la MISMA llave
 * si conserva `data`, asi que el refresco de cinco minutos no vacia la lista.
 *
 * La llave es la URL de la API y nada mas, asi que dos islas que piden lo
 * mismo comparten una entrada de SWR y una del CDN.
 */
export function useActualidad(pedido: PedidoActualidad | null): ActualidadViva {
  const hayServidor = useHayServidor();
  const activa = pedido !== null && hayServidor;

  const { data, error, isLoading } = useSWR<RespuestaActualidad>(
    pedido !== null && hayServidor ? llaveDe(pedido) : null,
    (ruta: string) => leerApi<RespuestaActualidad>(ruta),
    { refreshInterval: REFRESCO_MS, revalidateOnFocus: true },
  );

  const caidos = useMemo(
    () =>
      (data?.fuentes ?? [])
        .filter((f) => f.estado === "fallo")
        .map((f) => f.idioma),
    [data],
  );

  const idiomas = useMemo(
    () => (data === undefined ? SIN_IDIOMAS : data.fuentes.map((f) => f.idioma)),
    [data],
  );

  return {
    resultados: data?.resultados ?? SIN_RESULTADOS,
    cargando: activa && isLoading,
    caidos,
    idiomas,
    // Contra cuantas fuentes se pidieron, no contra dos: Mexico es una sola.
    fallo:
      error !== undefined ||
      (data !== undefined && data.fuentes.length > 0 && caidos.length === data.fuentes.length),
    truncada: data?.truncada ?? false,
    consultado: data?.consultado ?? null,
    activa,
  };
}
