"use client";

import { useActualizar, type ActualizacionViva } from "./use-actualizar";

import { useMemo } from "react";
import useSWRImmutable from "swr/immutable";

import { SLUG_DE_ZONA, type ZonaRuta } from "@/lib/dominio/zonas";
import { esEdicion, type Entrada } from "./capitulos";
import { leerApi, useHayServidor } from "./disponible";
import {
  MINIMO_CONSULTA,
  type RespuestaBusqueda,
  type ResultadoExterno,
} from "./tipos";

const SIN_RESULTADOS: readonly ResultadoExterno[] = [];

export interface BusquedaViva extends ActualizacionViva {
  resultados: readonly ResultadoExterno[];
  cargando: boolean;
  /** Locales que fallaron, para poder decir cual. */
  caidos: ("es" | "en")[];
  fallo: boolean;
  truncada: boolean;
  /** False cuando ya se sabe que no hay servidor: el bloque no se pinta. */
  activa: boolean;
}

/**
 * Una busqueda en vivo, para el recorrido de la portada.
 *
 * Nacio para el muro, y de ahi arrastraba dos cosas que ya no aplican y se
 * quitaron el 15 de septiembre de 2026 al irse esa pagina: recibia el conjunto
 * de titulares del corpus para SUPRIMIR los resultados que el muro ya mostraba
 * arriba —sin muro no hay nada que repetir— y recibia un ambito, que elegian
 * unas pastillas que tampoco existen. El alcance es el de la ENTRADA: `/`
 * busca en el corredor (con Google tal cual a la cabeza, ver buscar.ts),
 * `/tijuana` en Tijuana, y `?e=mexico` en Mexico. La edicion no se mandaba
 * hasta el 25 de septiembre de 2026, y buscar desde Mexico buscaba en el
 * corredor.
 */
export function useBusquedaViva(consulta: string, zona: ZonaRuta | null, entrada: Entrada = zona ?? "region"): BusquedaViva {
  const hayServidor = useHayServidor();
  const q = consulta.trim();
  const activa = hayServidor && q.length >= MINIMO_CONSULTA;

  // Llave null: SWR no pide nada. Inmutable, como el resto de hooks de datos:
  // una peticion por (consulta, zona, sesion). La zona va en la llave, asi que
  // volver a una busqueda ya hecha se sirve del cache -- y el CDN, que llavea
  // por URL completa, guarda cada zona por separado gratis.
  const partes = [`q=${encodeURIComponent(q)}`];
  if (esEdicion(entrada)) partes.push(`a=${entrada}`);
  else if (zona !== null) partes.push(`z=${SLUG_DE_ZONA[zona]}`);

  const llave = activa ? `/api/buscar?${partes.join("&")}` : null;
  const actualizacion = useActualizar<RespuestaBusqueda>(llave);

  const { data, error, isLoading } = useSWRImmutable<RespuestaBusqueda>(
    llave,
    (ruta: string) => leerApi<RespuestaBusqueda>(ruta),
  );

  const caidos = useMemo(
    () =>
      (data?.fuentes ?? [])
        .filter((f) => f.estado === "fallo")
        .map((f) => f.idioma),
    [data],
  );

  return {
    ...actualizacion,
    resultados: data?.resultados ?? SIN_RESULTADOS,
    cargando: activa && isLoading,
    caidos,
    // Contra cuantas fuentes se pidieron, no contra dos: en ambito 'mexico'
    // solo se consulta una edicion y un ">= 2" no seria fallo nunca.
    fallo:
      error !== undefined ||
      (data !== undefined && data.fuentes.length > 0 && caidos.length === data.fuentes.length),
    truncada: data?.truncada ?? false,
    activa,
  };
}
