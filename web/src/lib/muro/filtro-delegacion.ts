"use client";

import { useSearchParams } from "next/navigation";

import {
  PARAM_DELEGACION,
  delegacionDeSlug,
  slugDeFiltro,
  type FiltroDelegacion,
} from "@/lib/dominio/delegaciones";

/**
 * El filtro por delegacion vive en la URL (?d=otay) y no en estado local:
 * asi se comparte y se marca, igual que la zona. Pero es un PARAMETRO y no un
 * segmento de ruta, porque una delegacion no es una pagina: solo filtra el
 * muro de /tijuana. El hash ya lo usa la navegacion por secciones (#muro).
 *
 * Se escribe con replaceState, no con pushState: cambiar de delegacion no
 * crea entrada de historial, igual que el filtro por tema y la busqueda.
 * Next sincroniza useSearchParams con la History API nativa.
 *
 * Quien lo use en una ruta prerenderizada tiene que estar bajo <Suspense>:
 * sin eso `next build` falla y `next dev` no lo avisa.
 */
export function useFiltroDelegacion(zona: string | null): FiltroDelegacion | null {
  // Siempre se llama: regla de hooks. Fuera de Tijuana el parametro se ignora.
  const params = useSearchParams();
  return zona === "Tijuana" ? delegacionDeSlug(params.get(PARAM_DELEGACION)) : null;
}

export function elegirDelegacion(f: FiltroDelegacion | null) {
  const url = new URL(window.location.href);
  if (f === null) url.searchParams.delete(PARAM_DELEGACION);
  else url.searchParams.set(PARAM_DELEGACION, slugDeFiltro(f));
  window.history.replaceState(null, "", url);
}
