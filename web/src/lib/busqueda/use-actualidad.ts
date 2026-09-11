"use client";

import { useMemo } from "react";
import useSWR from "swr";

import { esAmbitoActualidad, type Ambito } from "./ambito";
import { leerApi, useHayServidor } from "./disponible";
import type { Idioma, RespuestaActualidad, ResultadoExterno } from "./tipos";

const SIN_RESULTADOS: readonly ResultadoExterno[] = [];

/**
 * Cada cuanto se vuelve a pedir mientras la pestana esta a la vista. Igual
 * que el s-maxage del route handler: pedir mas seguido solo pega en el CDN.
 */
const REFRESCO_MS = 5 * 60_000;

export interface ActualidadViva {
  /** En el orden de Google. No se reordena en ningun punto del camino. */
  resultados: readonly ResultadoExterno[];
  cargando: boolean;
  /** Locales que fallaron, para poder decir cual. */
  caidos: Idioma[];
  fallo: boolean;
  truncada: boolean;
  /** Hora del servidor al pedirle a Google, o null mientras no llega. */
  consultado: string | null;
  /** False cuando no se pide nada: ambito con corpus, o ya se sabe que no
   *  hay servidor. El bloque no se pinta. */
  activa: boolean;
}

/**
 * La seccion de Google Noticias del ambito, en vivo.
 *
 * useSWR y NO swr/immutable, a diferencia del resto de hooks de datos: esto
 * cambia mientras la pestana esta abierta, y "en este momento" es el punto.
 * Se refresca cada cinco minutos y al volver a la pestana.
 *
 * Sin `keepPreviousData`: la llave cambia al pasar de Mexico a Internacional,
 * y conservar la anterior pintaria las filas de Mexico debajo de la pastilla
 * de Internacional por un instante. Revalidar la MISMA llave si conserva
 * `data`, asi que el refresco de cinco minutos no vacia la lista.
 *
 * La zona NO va en la llave: la seccion no depende de ella, asi que
 * /tijuana?a=mexico y /?a=mexico comparten una entrada de SWR y una del CDN.
 */
export function useActualidad(ambito: Ambito, pedir: boolean): ActualidadViva {
  const hayServidor = useHayServidor();
  const activa = pedir && hayServidor && esAmbitoActualidad(ambito);

  const { data, error, isLoading } = useSWR<RespuestaActualidad>(
    activa ? `/api/actualidad?a=${ambito}` : null,
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

  return {
    resultados: data?.resultados ?? SIN_RESULTADOS,
    cargando: activa && isLoading,
    caidos,
    // Contra cuantas fuentes se pidieron, no contra dos: Mexico es una sola.
    fallo:
      error !== undefined ||
      (data !== undefined && data.fuentes.length > 0 && caidos.length === data.fuentes.length),
    truncada: data?.truncada ?? false,
    consultado: data?.consultado ?? null,
    activa,
  };
}
