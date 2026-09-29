"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";

import { leerJson } from "@/lib/datos/fetcher";
import type { ErrorSeguimiento, IdiomaSeguido, RespuestaListaSeguimiento, RespuestaSeguimiento } from "./contrato";

/**
 * El seguimiento de publicaciones del lado del navegador: la lista, la ficha
 * y los tres botones (seguir, actualizar, dejar de seguir).
 *
 * La ficha se vuelve a pedir cada cinco segundos mientras una lectura corre,
 * como la busqueda en vivo (busqueda/use-termino.ts): cada pregunta es la que
 * puede encontrar las corridas terminadas y guardarlas. Sin lectura abierta no
 * se pregunta, y el foco no revalida: la ficha no cambia sola.
 */

const INTERVALO_MS = 5_000;
const LISTA = "/api/seguimiento";
// leerJson y no leerApi: esa apunta un 404 como «no hay servidor» para toda
// la sesion, y aqui un 404 es una publicacion que alguien dejo de seguir.
const leer = <T,>(ruta: string) => leerJson<T>(ruta, { cache: "no-store" });

export const rutaFicha = (id: string) => `/api/seguimiento/${encodeURIComponent(id)}`;

export function useListaSeguimiento() {
  return useSWR<RespuestaListaSeguimiento>(LISTA, leer, {
    refreshInterval: (ultima) => (ultima?.publicaciones.some((p) => p.enCurso) ? INTERVALO_MS * 2 : 0),
    revalidateOnFocus: false,
  });
}

export function useFichaSeguimiento(id: string) {
  return useSWR<RespuestaSeguimiento>(rutaFicha(id), leer, {
    refreshInterval: (ultima) => (ultima?.enCurso ? INTERVALO_MS : 0),
    revalidateOnFocus: false,
    // Un error pasajero (la red del telefono) no detiene la lectura: se
    // vuelve a preguntar en el siguiente turno.
    shouldRetryOnError: true,
    errorRetryInterval: INTERVALO_MS,
  });
}

export type Fallo = { codigo: ErrorSeguimiento["codigo"] | "red"; mensaje: string };

const SIN_RED: Fallo = { codigo: "red", mensaje: "No se pudo conectar. Vuelve a intentarlo." };

async function enviar(ruta: string, init: RequestInit): Promise<{ ok: true; cuerpo: Record<string, unknown> } | { ok: false; fallo: Fallo }> {
  try {
    const r = await fetch(ruta, { ...init, cache: "no-store" });
    const cuerpo = (await r.json().catch(() => null)) as (Record<string, unknown> & Partial<ErrorSeguimiento>) | null;
    if (r.ok && cuerpo !== null) return { ok: true, cuerpo };
    return {
      ok: false,
      fallo: typeof cuerpo?.mensaje === "string" && typeof cuerpo.codigo === "string"
        ? { codigo: cuerpo.codigo, mensaje: cuerpo.mensaje }
        : SIN_RED,
    };
  } catch {
    return { ok: false, fallo: SIN_RED };
  }
}

/** Un boton que llama a la API: evita el doble clic y guarda el fallo. */
function useAccion<A extends unknown[]>(accion: (...args: A) => Promise<{ ok: true; cuerpo: Record<string, unknown> } | { ok: false; fallo: Fallo }>) {
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<Fallo | null>(null);
  const correr = useCallback(async (...args: A) => {
    if (enviando) return null;
    setEnviando(true);
    setFallo(null);
    try {
      const r = await accion(...args);
      if (!r.ok) {
        setFallo(r.fallo);
        return null;
      }
      return r.cuerpo;
    } finally {
      setEnviando(false);
    }
  }, [accion, enviando]);
  return { correr, enviando, fallo, limpiar: () => setFallo(null) };
}

const agregar = (url: string, idioma: IdiomaSeguido) =>
  enviar(LISTA, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, idioma }) });
const actualizar = (id: string) => enviar(rutaFicha(id), { method: "POST" });
const borrar = (id: string) => enviar(rutaFicha(id), { method: "DELETE" });

export const useAgregar = () => useAccion(agregar);
export const useActualizar = () => useAccion(actualizar);
export const useBorrar = () => useAccion(borrar);
