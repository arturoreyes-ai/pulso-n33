"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import useSWRImmutable from "swr/immutable";

import type { RespuestaRedesEnVivo, ErrorRedesEnVivo } from "@/lib/redes-en-vivo/responder";
import { leerApi, useHayServidor } from "./disponible";
import type { RespuestaTermino } from "./termino";
import { MINIMO_CONSULTA } from "./tipos";

/**
 * Los dos pedazos de la busqueda de un termino en Redes, del lado del
 * navegador. Los funde lib/dominio/termino-vivo.ts; aqui solo se piden.
 *
 * La mitad gratuita se pide al entrar, una vez por termino y sesion, como la
 * busqueda de la portada. La pagada NO: la arranca `iniciar`, que es el boton,
 * y despues se pregunta cada pocos segundos hasta que termina. Un termino
 * nuevo es un componente nuevo (busqueda-redes.tsx lo monta con `key`), asi
 * que el estado de una busqueda pagada no pasa a la siguiente.
 */

export function useTermino(q: string) {
  const hayServidor = useHayServidor();
  const termino = q.trim();
  const llave = hayServidor && termino.length >= MINIMO_CONSULTA ? `/api/termino?q=${encodeURIComponent(termino)}` : null;
  const { data, error, isLoading } = useSWRImmutable<RespuestaTermino>(llave, (ruta: string) => leerApi<RespuestaTermino>(ruta));
  return { data, error, cargando: llave !== null && isLoading, activa: llave !== null };
}

/** Cada cuanto se pregunta. Las corridas tardan minutos; mas seguido no
 *  trae nada antes y cada pregunta relee los conjuntos de datos. */
const INTERVALO_MS = 5_000;

export type FalloRedesEnVivo = ErrorRedesEnVivo["codigo"] | "red";

export function useRedesEnVivo(q: string) {
  const termino = q.trim();
  const [id, setId] = useState<string | null>(null);
  const [iniciando, setIniciando] = useState(false);
  const [fallo, setFallo] = useState<{ codigo: FalloRedesEnVivo; mensaje: string } | null>(null);

  const llave = id === null ? null : `/api/redes-en-vivo?id=${encodeURIComponent(id)}&q=${encodeURIComponent(termino)}`;
  const { data, error } = useSWR<RespuestaRedesEnVivo>(llave, (ruta: string) => leerApi<RespuestaRedesEnVivo>(ruta, { cache: "no-store" }), {
    refreshInterval: (ultima) => (ultima === undefined || ultima.estado === "buscando" ? INTERVALO_MS : 0),
    revalidateOnFocus: false,
    revalidateIfStale: false,
    // Un error pasajero (la red del telefono) no detiene la busqueda: se
    // vuelve a preguntar en el siguiente turno.
    shouldRetryOnError: true,
    errorRetryInterval: INTERVALO_MS,
  });

  const iniciar = useCallback(async () => {
    if (iniciando || id !== null) return;
    setIniciando(true);
    setFallo(null);
    try {
      const r = await fetch("/api/redes-en-vivo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: termino }),
        cache: "no-store",
      });
      const cuerpo = (await r.json().catch(() => null)) as ({ id?: unknown } & Partial<ErrorRedesEnVivo>) | null;
      if (r.ok && typeof cuerpo?.id === "string") {
        setId(cuerpo.id);
      } else {
        setFallo({
          codigo: cuerpo?.codigo ?? "red",
          mensaje: typeof cuerpo?.mensaje === "string" ? cuerpo.mensaje : "La búsqueda en redes no está disponible por ahora.",
        });
      }
    } catch {
      setFallo({ codigo: "red", mensaje: "La búsqueda en redes no está disponible por ahora." });
    } finally {
      setIniciando(false);
    }
  }, [iniciando, id, termino]);

  return {
    iniciar,
    iniciando,
    iniciada: id !== null,
    respuesta: data ?? null,
    fallo,
    // Un error de lectura con respuesta previa no borra lo que ya llego.
    errorLectura: error !== undefined && data === undefined,
  };
}
