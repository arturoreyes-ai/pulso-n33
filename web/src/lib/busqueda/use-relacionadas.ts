"use client";

import useSWRImmutable from "swr/immutable";

import { leerApi, useHayServidor } from "./disponible";
import type { NotaRelacionada, RespuestaRelacionadas } from "./tipos";

/**
 * Las notas anteriores sobre lo mismo que un titular, pedidas al abrir la hoja.
 *
 * LLAVE ANULABLE, que es el mismo recurso de useActualidad(null) y de
 * useComunicados(activo): mientras no hay hoja abierta no se pide nada. El
 * recorrido encadena hasta nueve capitulos de quince tarjetas y casi ninguna
 * hoja se abre; pedirlas por adelantado serian ~135 listas para tirar.
 *
 * INMUTABLE porque la respuesta es funcion del titular y del corpus del
 * despliegue, y ese no cambia mientras la pestana esta abierta. Volver a abrir
 * la misma tarjeta lee la copia de SWR y no vuelve a salir.
 *
 * TRES ESTADOS Y NO DOS. «No hay coincidencias» y «no se pudo consultar» tienen
 * que llegar distintos a la hoja: la primera frase nombra que la cobertura no
 * es pareja en el corredor, y decir eso cuando en realidad no se miro afirma un
 * hueco que nadie midio (regla 4 de PRODUCT.md).
 */

const SIN_NOTAS: readonly NotaRelacionada[] = [];

export interface RelacionadasVivas {
  notas: readonly NotaRelacionada[];
  cargando: boolean;
  /** No se pudo consultar el archivo. NO es «no hay notas anteriores». */
  fallo: boolean;
}

export function useRelacionadas(titulo: string | null): RelacionadasVivas {
  const hayServidor = useHayServidor();
  const llave =
    titulo === null || titulo.trim() === "" || !hayServidor
      ? null
      : `/api/relacionadas?t=${encodeURIComponent(titulo)}`;

  const { data, error, isLoading } = useSWRImmutable<RespuestaRelacionadas>(
    llave,
    (ruta: string) => leerApi<RespuestaRelacionadas>(ruta),
  );

  return {
    notas: data?.relacionadas ?? SIN_NOTAS,
    // Con llave nula y una hoja abierta no se esta cargando: no hay servidor,
    // que es un fallo y se dice como tal.
    cargando: llave !== null && isLoading,
    fallo: error !== undefined || (titulo !== null && !hayServidor),
  };
}
