"use client";

import type { ReactNode } from "react";

import { usaCorpus } from "@/lib/busqueda/ambito";
import type { ZonaRuta } from "@/lib/dominio/zonas";
import { useAmbito } from "@/lib/muro/filtro-ambito";

/**
 * Pinta a sus hijos solo mientras el alcance de la pagina (?a=) tiene corpus.
 *
 * En Mexico e Internacional el muro de titulares YA es la lista en vivo con
 * sus rubros; la seccion "Lo que destaca ahora" de mas abajo seria la misma
 * lista dos veces en una pagina. Decision del cliente, 12 de septiembre de
 * 2026: una sola implementacion por alcance, y en esos dos vive en el muro.
 *
 * Los hijos llegan como payload de servidor (la seccion con su prosa), igual
 * que en Revelar. Lee useSearchParams, asi que quien lo monte en una ruta
 * prerenderizada lo pone bajo <Suspense>; titulares.tsx lo hace.
 */
export function SoloConCorpus({
  zona,
  children,
}: {
  zona: ZonaRuta | null;
  children: ReactNode;
}) {
  const ambito = useAmbito(zona);
  return usaCorpus(ambito) ? <>{children}</> : null;
}
