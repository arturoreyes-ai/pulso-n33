"use client";

import useSWR from "swr";
import useSWRImmutable from "swr/immutable";

import { RUTAS } from "./config";
import { leerJson } from "./fetcher";
import type {
  DocArchivoIndice,
  DocConversacion,
  DocEstado,
  DocFuentes,
  DocIndicadores,
  DocNotas,
  DocRoster,
  DocTemas,
} from "./tipos";

// Las llaves son las cadenas de RUTAS, identicas en cada consumidor, asi que
// SWR deduplica a UNA peticion por archivo aunque varios componentes las
// pidan. Si dos componentes provocan dos peticiones, es que las llaves se
// separaron.
//
// Modo inmutable en todo lo de contenido: el cron lo escribe una vez cada 6
// horas y no cambia mientras la pestana esta abierta.

export const useNotas = () => useSWRImmutable<DocNotas>(RUTAS.notas, leerJson);
export const useTemas = () => useSWRImmutable<DocTemas>(RUTAS.temas, leerJson);
export const useIndicadores = () =>
  useSWRImmutable<DocIndicadores>(RUTAS.indicadores, leerJson);
export const useConversacion = () =>
  useSWRImmutable<DocConversacion>(RUTAS.conversacion, leerJson);
export const useFuentes = () => useSWRImmutable<DocFuentes>(RUTAS.fuentes, leerJson);
export const useRoster = () => useSWRImmutable<DocRoster>(RUTAS.roster, leerJson);

/** El indice del archivo solo se pide si alguien abre el historico. */
export const useArchivo = (activo: boolean) =>
  useSWRImmutable<DocArchivoIndice>(activo ? RUTAS.archivoIndice : null, leerJson);

/**
 * estado.json es el unico que se sondea: son 600 bytes y es el reloj. Cuando
 * el cron deja un corte nuevo, esto es lo que mueve la marca de frescura.
 */
export const useEstado = () =>
  useSWR<DocEstado>(RUTAS.estado, leerJson, {
    refreshInterval: 5 * 60_000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });
