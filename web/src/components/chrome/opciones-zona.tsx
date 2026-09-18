import Link from "next/link";

import { clasesChip } from "@/components/ui/clases";
import { ruta, type Vista } from "@/lib/dominio/secciones";
import { NOMBRE_CORTO, ZONAS_RUTA, type ZonaRuta } from "@/lib/dominio/zonas";

/**
 * El cuerpo del dialogo «Lugar» de la cinta: enlaces, nunca botones.
 *
 * El lugar es un eje de la RUTA, asi que elegirlo es navegar, y conserva la
 * vista igual que `chrome/selector-zona.tsx`: desde /tijuana/indicadores se
 * sale a /ensenada/indicadores y no a /ensenada. Perder la vista al cambiar de
 * lugar obliga a volver a buscarla, que es lo que la rejilla de dos ejes
 * existe para evitar.
 *
 * Sale de `ZONAS_RUTA` y de `ruta()`, las mismas dos fuentes que lee el
 * selector de chips del cuerpo de la pagina: la lista sigue teniendo una sola
 * declaracion y lo unico que cambia es la presentacion —renglones en una hoja
 * contra pastillas en la pagina—, como ya pasa entre `MenuLector` y la
 * pastilla flotante, que salen las dos de `VISTAS` y `SUELTAS`.
 *
 * Componente de SERVIDOR. Baja a `LugarCinta` como nodo, por el mismo canal
 * por el que `MenuLector` baja a la hoja de paginas.
 */
const OPCIONES: readonly (ZonaRuta | null)[] = [null, ...ZONAS_RUTA];

export function OpcionesZona({ zona, vista }: { zona: ZonaRuta | null; vista: Vista }) {
  return (
    <ul className="grid gap-2 p-4">
      {OPCIONES.map((z) => {
        const activo = z === zona;
        return (
          <li key={z ?? "region"}>
            <Link
              href={ruta(z, vista)}
              aria-current={activo ? "page" : undefined}
              className={`${clasesChip(activo)} w-full justify-between`}
            >
              {z === null ? "Toda la región" : NOMBRE_CORTO[z]}
              {activo ? <span aria-hidden>✓</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
