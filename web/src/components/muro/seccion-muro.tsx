"use client";

import type { ReactNode } from "react";
import { Seccion } from "@/components/chrome/seccion";
import { usaCorpus } from "@/lib/busqueda/ambito";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";
import { useAmbito } from "@/lib/muro/filtro-ambito";

/**
 * Mexico e Internacional reutilizan el muro como lista en vivo. El titulo
 * fijo de servidor seguia diciendo Titulares sobre Tijuana al cambiar a
 * Mexico: esta envoltura lee el mismo alcance que las filas, sin duplicarlas.
 */
export function SeccionMuro({ zona, children }: { zona: ZonaRuta | null; children: ReactNode }) {
  const ambito = useAmbito(zona);
  const enVivo = !usaCorpus(ambito);
  const nombre = zona === null ? null : NOMBRE_CORTO[zona];
  const lugar = ambito === "mexico" ? "México" : "el mundo";
  const entrada = enVivo
    ? `Los titulares que destacan en este momento en ${lugar}, por rubro. Es una lectura en vivo y no cuenta en las cifras de prensa.`
    : nombre === null
      ? "La zona sale del lugar que nombra el titular, no del medio. Al buscar se añaden resultados en vivo."
      : zona === "Tijuana"
        ? "Titulares que mencionan Tijuana. La delegación sale del propio titular, y la mayoría no nombra ninguna."
        : `Titulares que mencionan ${nombre}. Al buscar se añaden resultados en vivo.`;

  return (
    <Seccion
      id="muro"
      pegada={enVivo}
      titulo={enVivo ? "En Tendencia" : nombre === null ? "Titulares" : `Titulares sobre ${nombre}`}
      entrada={entrada}
    >
      {children}
    </Seccion>
  );
}
