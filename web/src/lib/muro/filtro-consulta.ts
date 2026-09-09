"use client";

import { useSearchParams } from "next/navigation";

import { LARGO_MAXIMO_CONSULTA } from "@/lib/busqueda/tipos";

export const PARAM_CONSULTA = "q";

/**
 * La busqueda del muro, en la URL (?q=garita).
 *
 * Mismo trato que ?d= en filtro-delegacion.ts, cuyo comentario ya decia que la
 * busqueda deberia tenerlo: se comparte y se marca. Con replaceState y no
 * pushState, para que escribir no llene el historial de una entrada por tecla.
 *
 * La URL es SEMILLA, no fuente de verdad mientras se escribe. El valor del
 * input vive en useState y se refresca en el mismo cuadro de la tecla; aqui
 * solo se escribe con retardo. La razon es concreta: Next sincroniza
 * useSearchParams con la History API, asi que cada replaceState vuelve a
 * renderizar a TODOS los consumidores del arbol -- incluido el
 * useFiltroDelegacion que vive en el mismo hook -- y a diez teclas por segundo
 * eso cuesta mas que la llamada al historial.
 *
 * Quien lo use en una ruta prerenderizada tiene que estar bajo <Suspense>.
 * `Muro` ya lo esta, por ?d=.
 */
export function useConsultaUrl(): string {
  const params = useSearchParams();
  return (params.get(PARAM_CONSULTA) ?? "").slice(0, LARGO_MAXIMO_CONSULTA);
}

export function escribirConsulta(q: string) {
  const url = new URL(window.location.href);
  if (q.trim() === "") url.searchParams.delete(PARAM_CONSULTA);
  else url.searchParams.set(PARAM_CONSULTA, q);
  window.history.replaceState(null, "", url);
}
