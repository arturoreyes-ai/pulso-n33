import Link from "next/link";

import { clasesChip } from "@/components/ui/clases";
import { ruta, type Vista } from "@/lib/dominio/secciones";
import { NOMBRE_CORTO, ZONAS_RUTA, type ZonaRuta } from "@/lib/dominio/zonas";
import { ConteoZona } from "./conteo-zona";

/**
 * Las opciones del selector: `null` primero, que es "Toda la región", y luego
 * las nueve zonas.
 *
 * A nivel de modulo y no dentro del componente: no depende de props ni de
 * estado, asi que rearmarla en cada render solo produce un arreglo nuevo que
 * parece distinto. `readonly` deja el contrato por escrito y en manos del
 * compilador: es lo que hace seguro compartir una sola instancia.
 */
const OPCIONES_ZONA: readonly (ZonaRuta | null)[] = [null, ...ZONAS_RUTA];

/**
 * El selector de zona: nueve enlaces, no nueve botones.
 *
 * Componente de servidor. La zona activa viene por prop desde la ruta, asi que
 * `aria-current` sale en el HTML sin estado de cliente ni riesgo de hydration.
 * `next/link` precarga las otras zonas al verlas o tocarlas, y como los JSON
 * ya estan en el cache de SWR, cambiar de zona es instantaneo.
 *
 * CONSERVA LA VISTA. Cambiar de zona desde /tijuana/redes lleva a
 * /ensenada/redes, no a /ensenada: los dos ejes del tablero se mueven por
 * separado, y perder la vista al cambiar de lugar obligaba a volver a
 * buscarla. Por eso el selector necesita saber en que pagina esta.
 *
 * En movil la fila hace scroll horizontal con snap; en escritorio envuelve.
 */
export function SelectorZona({
  zona,
  vista = null,
  conteos = false,
}: {
  zona: ZonaRuta | null;
  vista?: Vista;
  conteos?: boolean;
}) {
  // `scroll-mt` porque la pastilla del LUGAR en la nav apunta a #zonas: sin
  // esto el selector aterriza debajo de la pildora flotante, que es fija.
  // Mismo calculo que usa `Seccion` para sus anclas.
  return (
    <nav
      id="zonas"
      aria-label="Zona"
      className="-mx-4 scroll-mt-[calc(var(--nav-alto)+1.5rem)] px-4 md:mx-0 md:px-0"
    >
      <ul className="flex snap-x gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible">
        {OPCIONES_ZONA.map((z) => {
          const activo = z === zona;
          return (
            <li key={z ?? "region"} className="shrink-0 snap-start">
              <Link
                href={ruta(z, vista)}
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
