"use client";

import useSWR from "swr";
import useSWRImmutable from "swr/immutable";

import { RUTAS } from "./config";
import { leerJson } from "./fetcher";
import type {
  DocComunicados,
  DocArchivoIndice,
  DocConversacion,
  DocFuentes,
  DocIndicadores,
  DocNotas,
  DocRedes,
  DocRedesComentarios,
  DocRoster,
  DocTendencias,
  DocGastoElectoral,
  DocFinanciamientoPartidos,
} from "./tipos";

// Las llaves son las cadenas de RUTAS, identicas en cada consumidor, asi que
// SWR deduplica a UNA peticion por archivo aunque varios componentes las
// pidan. Si dos componentes provocan dos peticiones, es que las llaves se
// separaron.
//
// Modo inmutable en todo lo de contenido: el cron lo escribe una vez cada 6
// horas y no cambia mientras la pestana esta abierta.

export const useNotas = () => useSWRImmutable<DocNotas>(RUTAS.notas, leerJson);
/** Con llave anulable: los comunicados solo son un capitulo del recorrido de
 *  Tecate, y en las otras ocho entradas no hay que pedir el archivo. Es el
 *  mismo recurso que useActualidad(null). */
export const useComunicados = (activo = true) =>
  useSWRImmutable<DocComunicados>(activo ? RUTAS.comunicados : null, leerJson);
export const useIndicadores = () =>
  useSWRImmutable<DocIndicadores>(RUTAS.indicadores, leerJson);
export const useConversacion = () =>
  useSWRImmutable<DocConversacion>(RUTAS.conversacion, leerJson);
export const useFuentes = () => useSWRImmutable<DocFuentes>(RUTAS.fuentes, leerJson);
export const useRoster = () => useSWRImmutable<DocRoster>(RUTAS.roster, leerJson);
export const useRedes = () => useSWRImmutable<DocRedes>(RUTAS.redes, leerJson);
/** El texto de los comentarios. Un 404 aqui NO es error del panel: el archivo
 *  vive fuera de git y un despliegue puede no traerlo. */
export const useRedesComentarios = () =>
  useSWRImmutable<DocRedesComentarios>(RUTAS.redesComentarios, leerJson);
export const useTikTok = () => useSWRImmutable<DocRedes>(RUTAS.tiktok, leerJson);
export const useTikTokComentarios = () =>
  useSWRImmutable<DocRedesComentarios>(RUTAS.tiktokComentarios, leerJson);
/** Tendencias de X por ubicacion: un solo archivo, sin par de texto. */
export const useTendencias = () => useSWRImmutable<DocTendencias>(RUTAS.tendencias, leerJson);
export const useGastoElectoral = () =>
  useSWRImmutable<DocGastoElectoral>(RUTAS.gastoElectoral, leerJson);
export const useFinanciamientoPartidos = () =>
  useSWRImmutable<DocFinanciamientoPartidos>(RUTAS.financiamientoPartidos, leerJson);

/** El indice del archivo solo se pide si alguien abre el historico. */
export const useArchivo = (activo: boolean) =>
  useSWRImmutable<DocArchivoIndice>(activo ? RUTAS.archivoIndice : null, leerJson);

/* `useEstado` y `useTemas` se fueron con el muro el 15 de septiembre de 2026:
   estado.json era el reloj que sondeaba la marca de frescura y temas.json
   alimentaba el panel de temas y el resumen de cifras, y ninguna de las dos
   pantallas existe ya. El pipeline los sigue escribiendo —el historial de git
   ES el archivo, y estado.json lleva la hora de corrida que hace que cada
   corrida produzca un commit—, simplemente no los lee nadie en el sitio. */
