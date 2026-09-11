"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CaretDown } from "@phosphor-icons/react";

import { clasesChip } from "@/components/ui/clases";
import { ambitoPorOmision, usaCorpus } from "@/lib/busqueda/ambito";
import { PARAM_DELEGACION } from "@/lib/dominio/delegaciones";
import { ruta } from "@/lib/dominio/secciones";
import { NOMBRE_CORTO, ZONAS_RUTA, type ZonaRuta } from "@/lib/dominio/zonas";
import { elegirAmbito, PARAM_AMBITO, useAmbito } from "@/lib/muro/filtro-ambito";
import { ConteoZona } from "./conteo-zona";

const ZONAS: readonly (ZonaRuta | null)[] = [null, ...ZONAS_RUTA];
const ALCANCES = ["region", "mexico", "internacional"] as const;
const ROTULOS = { region: "Región", mexico: "México", internacional: "Internacional" };

/** Región abre sus ciudades; México e Internacional no tienen subdivisiones
 * regionales. La ruta conserva la ciudad al cambiar de alcance para volver
 * a ella sin una segunda selección. El estado compartido sigue en ?a=. */
export function NavegacionTitulares({ zona }: { zona: ZonaRuta | null }) {
  const ambito = useAmbito(zona);
  const parametros = useSearchParams();
  const regional = usaCorpus(ambito);

  return (
    <nav id="zonas" aria-label="Alcance de titulares" className="scroll-mt-[calc(var(--nav-alto)+1.5rem)]">
      <div role="group" aria-label="Alcance" className="flex gap-1.5 overflow-x-auto pb-1 whitespace-nowrap">
        {ALCANCES.map((alcance) => (
          <button
            key={alcance}
            type="button"
            aria-pressed={alcance === "region" ? regional : ambito === alcance}
            aria-expanded={alcance === "region" ? regional : undefined}
            aria-controls={alcance === "region" ? "ciudades-titulares" : undefined}
            onClick={() => elegirAmbito(alcance === "region" ? ambitoPorOmision(zona) : alcance, zona)}
            className={`${clasesChip(alcance === "region" ? regional : ambito === alcance)} shrink-0`}
          >
            {ROTULOS[alcance]}
            {alcance === "region" ? <CaretDown size={14} aria-hidden className={regional ? "self-center" : "self-center -rotate-90"} /> : null}
          </button>
        ))}
      </div>
      <div id="ciudades-titulares" hidden={!regional}>
        <ul aria-label="Ciudades de la región" className="mt-3 flex snap-x gap-1.5 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible">
          {ZONAS.map((destino) => {
            const consulta = new URLSearchParams(parametros.toString());
            consulta.delete(PARAM_AMBITO);
            if (destino !== zona) consulta.delete(PARAM_DELEGACION);
            const sufijo = consulta.toString();
            const activo = ambito === "region" ? destino === null : destino === zona;
            return (
              <li key={destino ?? "region"} className="shrink-0 snap-start">
                <Link
                  href={`${ruta(destino, null)}${sufijo ? `?${sufijo}` : ""}`}
                  scroll={false}
                  aria-current={activo ? "page" : undefined}
                  className={clasesChip(activo)}
                >
                  <span>{destino === null ? "Toda la región" : NOMBRE_CORTO[destino]}</span>
                  <ConteoZona zona={destino} />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
