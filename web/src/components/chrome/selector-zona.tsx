import Link from "next/link";

import { clasesChip } from "@/components/ui/primitivas";
import { NOMBRE_CORTO, ZONAS_RUTA, rutaDeZona, type ZonaRuta } from "@/lib/dominio/zonas";
import { ConteoZona } from "./conteo-zona";

/**
 * El selector de zona: nueve enlaces, no nueve botones.
 *
 * Componente de servidor. La zona activa viene por prop desde la ruta, asi que
 * `aria-current` sale en el HTML sin estado de cliente ni riesgo de hydration.
 * `next/link` precarga las otras zonas al verlas o tocarlas, y como los JSON
 * ya estan en el cache de SWR, cambiar de zona es instantaneo.
 *
 * En movil la fila hace scroll horizontal con snap; en escritorio envuelve.
 */
export function SelectorZona({
  zona,
  conteos = false,
}: {
  zona: ZonaRuta | null;
  conteos?: boolean;
}) {
  const items: (ZonaRuta | null)[] = [null, ...ZONAS_RUTA];
  return (
    <nav id="zonas" aria-label="Zona" className="-mx-4 px-4 md:mx-0 md:px-0">
      <ul className="flex snap-x gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible">
        {items.map((z) => {
          const activo = z === zona;
          return (
            <li key={z ?? "region"} className="shrink-0 snap-start">
              <Link
                href={rutaDeZona(z)}
                aria-current={activo ? "page" : undefined}
                className={clasesChip(activo)}
              >
                <span>{z === null ? "Toda la región" : NOMBRE_CORTO[z]}</span>
                {conteos ? <ConteoZona zona={z} /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
