"use client";

import { useMemo } from "react";
import useSWRImmutable from "swr/immutable";

import { ErrorDatos, leerJson } from "@/lib/datos/fetcher";
import { SLUG_DE_ZONA, type ZonaRuta } from "@/lib/dominio/zonas";
import { ambitoPorOmision, type Ambito } from "./ambito";
import { marcarSinServidor, useHayServidor } from "./disponible";
import { suprimirConocidas } from "./fusionar";
import {
  MINIMO_CONSULTA,
  type RespuestaBusqueda,
  type ResultadoExterno,
} from "./tipos";

const SIN_RESULTADOS: readonly ResultadoExterno[] = [];

async function leerBusqueda(ruta: string): Promise<RespuestaBusqueda> {
  try {
    return await leerJson<RespuestaBusqueda>(ruta);
  } catch (e) {
    // 404 con HTML, o 200 con la cascara de la app: no hay route handler.
    // Se apunta en la tienda para no volver a preguntar en esta sesion.
    if (e instanceof ErrorDatos && (e.status === 404 || e.status === 405)) {
      marcarSinServidor();
    } else if (e instanceof ErrorDatos && e.message.includes("no JSON")) {
      marcarSinServidor();
    }
    throw e;
  }
}

export interface BusquedaViva {
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

  const { data, error, isLoading } = useSWRImmutable<RespuestaBusqueda>(
    activa ? `/api/buscar?${partes.join("&")}` : null,
    leerBusqueda,
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
