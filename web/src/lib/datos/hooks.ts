"use client";

import useSWR from "swr";
import useSWRImmutable from "swr/immutable";

import { RUTAS } from "./config";
import { leerJson } from "./fetcher";
import type {
  DocComunicados,
  DocConsultas,
  DocConsultasComentarios,
  DocIndicadores,
  DocRedes,
  DocRedesComentarios,
  DocTendencias,
  DocGastoElectoral,
  DocFinanciamientoPartidos,
  DocPublicidadMeta,
  DocPerfilMeta,
} from "./tipos";

// Las llaves son las cadenas de RUTAS, identicas en cada consumidor, asi que
// SWR deduplica a UNA peticion por archivo aunque varios componentes las
// pidan. Si dos componentes provocan dos peticiones, es que las llaves se
// separaron.
//
// Modo inmutable en todo lo de contenido: el cron lo escribe una vez cada 6
// horas y no cambia mientras la pestana esta abierta.

/** Con llave anulable: los comunicados solo son un capitulo del recorrido de
 *  Tecate, y en las otras ocho entradas no hay que pedir el archivo. Es el
 *  mismo recurso que useActualidad(null). */
export const useComunicados = (activo = true) =>
  useSWRImmutable<DocComunicados>(activo ? RUTAS.comunicados : null, leerJson);
export const useIndicadores = () =>
  useSWRImmutable<DocIndicadores>(RUTAS.indicadores, leerJson);
export const useRedes = () => useSWRImmutable<DocRedes>(RUTAS.redes, leerJson);
/** El texto de los comentarios. Un 404 aqui NO es error del panel: el archivo
 *  vive fuera de git y un despliegue puede no traerlo. */
export const useRedesComentarios = () =>
  useSWRImmutable<DocRedesComentarios>(RUTAS.redesComentarios, leerJson);
export const useTikTok = () => useSWRImmutable<DocRedes>(RUTAS.tiktok, leerJson);
/** Shorts y videos largos por feed publico. SIN par de comentarios: este
 *  modulo no los cosecha, y el documento lo dice con `cosecha_comentarios`. */
export const useYouTube = () => useSWRImmutable<DocRedes>(RUTAS.youtube, leerJson);
export const useTikTokComentarios = () =>
  useSWRImmutable<DocRedesComentarios>(RUTAS.tiktokComentarios, leerJson);
/** Paginas de medios en Facebook, con su par de texto como Instagram. */
export const useFacebook = () => useSWRImmutable<DocRedes>(RUTAS.facebook, leerJson);
export const useFacebookComentarios = () =>
  useSWRImmutable<DocRedesComentarios>(RUTAS.facebookComentarios, leerJson);
/** Tendencias de X por ubicacion: un solo archivo, sin par de texto. */
export const useTendencias = () => useSWRImmutable<DocTendencias>(RUTAS.tendencias, leerJson);
/** Que se dice de un termino. Un 404 es un estado normal: el archivo se
 *  escribe a mano y un despliegue puede no traerlo; el buscador de Redes
 *  simplemente no ofrece terminos. */
export const useConsultas = () => useSWRImmutable<DocConsultas>(RUTAS.consultas, leerJson);
export const useConsultasComentarios = () =>
  useSWRImmutable<DocConsultasComentarios>(RUTAS.consultasComentarios, leerJson);
export const useGastoElectoral = () =>
  useSWRImmutable<DocGastoElectoral>(RUTAS.gastoElectoral, leerJson);
// Una peticion interrumpida no debe dejar el piloto en un esqueleto eterno.
// Compartir este lector conserva la deduplicacion de SWR por URL.
const leerMeta = <T,>(ruta: string) => leerJson<T>(ruta, { signal: AbortSignal.timeout(15000) });
export const usePublicidadMeta = () =>
  useSWRImmutable<DocPublicidadMeta>(RUTAS.publicidadMeta, leerMeta, { shouldRetryOnError: false });
export const usePerfilMeta = (id: string | null) =>
  useSWRImmutable<DocPerfilMeta>(id && /^[a-z0-9_]{2,12}$/.test(id) ? `${RUTAS.perfilesMeta}/${id}.json` : null, leerMeta, { shouldRetryOnError: false });
export const useFinanciamientoPartidos = () =>
  useSWRImmutable<DocFinanciamientoPartidos>(RUTAS.financiamientoPartidos, leerJson);

/* `useEstado` y `useTemas` se fueron con el muro el 15 de septiembre de 2026:
   estado.json era el reloj que sondeaba la marca de frescura y temas.json
   alimentaba el panel de temas y el resumen de cifras, y ninguna de las dos
   pantallas existe ya. El pipeline los sigue escribiendo —el historial de git
   ES el archivo, y estado.json lleva la hora de corrida que hace que cada
   corrida produzca un commit—, simplemente no los lee nadie en el sitio. */

/* `useNotas` se fue el 18 de septiembre de 2026, y con el los ultimos 917 KB
   que el navegador bajaba del archivo. Sus tres lectores —miniaturas, enlace
   del propio medio y notas relacionadas— cruzaban el titular de quince filas
   en vivo contra 6,020 notas; ese cruce lo hace ahora el servidor contra el
   mismo disco (lib/busqueda/archivo.ts). Con el se fueron tambien `useFuentes`,
   `useRoster` y `useArchivo`, que ya no tenian ni un consumidor. */
