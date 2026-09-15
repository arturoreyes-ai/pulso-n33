"use client";

import { useActualizar, type ActualizacionViva } from "./use-actualizar";

import { useMemo } from "react";
import useSWRImmutable from "swr/immutable";

import { SLUG_DE_ZONA, type ZonaRuta } from "@/lib/dominio/zonas";
import { ambitoPorOmision, type Ambito } from "./ambito";
import { leerApi, useHayServidor } from "./disponible";
import { suprimirConocidas } from "./fusionar";
import {
  MINIMO_CONSULTA,
  type RespuestaBusqueda,
  type ResultadoExterno,
} from "./tipos";

const SIN_RESULTADOS: readonly ResultadoExterno[] = [];

export interface BusquedaViva extends ActualizacionViva {
  /** Lo que no esta ya en el muro de arriba. */
  resultados: readonly ResultadoExterno[];
  /** Cuantos se quitaron por estar ya en el muro. Se dice, no se esconde. */
  suprimidas: number;
  cargando: boolean;
  /** Locales que fallaron, para poder decir cual. */
  caidos: ("es" | "en")[];
  fallo: boolean;
  truncada: boolean;
  /** False cuando ya se sabe que no hay servidor: el bloque no se pinta. */
  activa: boolean;
}

export function useBusquedaViva(
  consulta: string,
  titulosCorpus: ReadonlySet<string>,
  ambito: Ambito,
  zona: ZonaRuta | null,
): BusquedaViva {
  const hayServidor = useHayServidor();
  const q = consulta.trim();
  const activa = hayServidor && q.length >= MINIMO_CONSULTA;

  // Llave null: SWR no pide nada. Inmutable, como el resto de hooks de datos:
  // una peticion por (consulta, ambito, sesion). El ambito y la zona van en la
  // llave, asi que cambiar de pastilla y volver se sirve del cache -- y el CDN,
  // que llavea por URL completa, guarda cada ambito por separado gratis.
  //
  // El ambito solo viaja cuando NO es el de omision, para que la llave de la
  // busqueda normal sea la corta y se comparta entre las dos formas de pedir
  // lo mismo.
  const partes = [`q=${encodeURIComponent(q)}`];
  if (ambito !== ambitoPorOmision(zona)) partes.push(`a=${ambito}`);
  if (zona !== null) partes.push(`z=${SLUG_DE_ZONA[zona]}`);

  const llave = activa ? `/api/buscar?${partes.join("&")}` : null;
  const actualizacion = useActualizar<RespuestaBusqueda>(llave);

  const { data, error, isLoading } = useSWRImmutable<RespuestaBusqueda>(
    llave,
    (ruta: string) => leerApi<RespuestaBusqueda>(ruta),
  );

  const { visibles, suprimidas } = useMemo(() => {
    if (data === undefined) return { visibles: SIN_RESULTADOS, suprimidas: 0 };
    return suprimirConocidas(data.resultados, titulosCorpus);
  }, [data, titulosCorpus]);

  const caidos = useMemo(
    () =>
      (data?.fuentes ?? [])
        .filter((f) => f.estado === "fallo")
        .map((f) => f.idioma),
    [data],
  );

  return {
    ...actualizacion,
    resultados: visibles,
    suprimidas,
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
