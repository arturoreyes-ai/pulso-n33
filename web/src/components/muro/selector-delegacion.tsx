"use client";

import {
  DELEGACIONES,
  NOMBRE_CORTO_DELEGACION,
  SIN_DELEGACION,
  type FiltroDelegacion,
} from "@/lib/dominio/delegaciones";
import { Chip } from "@/components/ui/primitivas";

/**
 * La fila de delegaciones de Tijuana. Botones y no enlaces, porque una
 * delegacion no es una pagina: es un filtro del muro que vive en ?d=.
 *
 * Las nueve salen siempre, con su conteo aunque sea cero. Esconder las que
 * hoy no tienen notas haria parecer que el tablero no las conoce; un cero
 * dice "la prensa no las nombro esta semana", que es distinto. El ultimo chip
 * es el cajon honesto: la mayoria de los titulares de Tijuana no nombra
 * ninguna delegacion, y eso se cuenta en vez de esconderse.
 */
export function SelectorDelegacion({
  activa,
  conteo,
  onElegir,
}: {
  activa: FiltroDelegacion | null;
  conteo: Map<FiltroDelegacion, number>;
  onElegir: (f: FiltroDelegacion | null) => void;
}) {
  return (
    <div role="group" aria-label="Delegación" className="-mx-4 px-4 md:mx-0 md:px-0">
      <div className="flex snap-x gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible">
        <span className="shrink-0 snap-start">
          <Chip activo={activa === null} onClick={() => onElegir(null)}>
            Toda Tijuana
          </Chip>
        </span>
        {DELEGACIONES.map((d) => (
          <span key={d} className="shrink-0 snap-start" title={d}>
            <Chip activo={activa === d} onClick={() => onElegir(d)} cuenta={conteo.get(d) ?? 0}>
              {NOMBRE_CORTO_DELEGACION[d]}
            </Chip>
          </span>
        ))}
        <span
          className="shrink-0 snap-start"
          title="Titulares de Tijuana que no nombran ninguna delegación ni un lugar dentro de una"
        >
          <Chip
            activo={activa === SIN_DELEGACION}
            onClick={() => onElegir(SIN_DELEGACION)}
            cuenta={conteo.get(SIN_DELEGACION) ?? 0}
          >
            Sin delegación identificada
          </Chip>
        </span>
      </div>
    </div>
  );
}
