import { OpcionesLugar } from "@/components/ui/opciones-lugar";
import { ruta, type Vista } from "@/lib/dominio/secciones";
import { NOMBRE_CORTO, NOMBRE_TODA_REGION, ZONAS_RUTA, type ZonaRuta } from "@/lib/dominio/zonas";

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
 * Desde el 23 de septiembre de 2026 la forma es la de la portada y Redes
 * (ui/opciones-lugar.tsx): pastillas, no renglones con palomita.
 *
 * Componente de SERVIDOR. Baja a `LugarCinta` como nodo, por el mismo canal
 * por el que `MenuLector` baja a la hoja de paginas.
 */
const OPCIONES: readonly (ZonaRuta | null)[] = [null, ...ZONAS_RUTA];

export function OpcionesZona({ zona, vista }: { zona: ZonaRuta | null; vista: Vista }) {
  // Sin alcance: fuera de la portada y de Redes no hay México ni
  // Internacional que elegir, asi que el componente pinta solo las pastillas.
  return (
    <OpcionesLugar
      alcances={[]}
      lugares={OPCIONES.map((z) => ({
        id: z ?? "region",
        nombre: z === null ? NOMBRE_TODA_REGION : NOMBRE_CORTO[z],
        href: ruta(z, vista),
        activo: z === zona,
      }))}
    />
  );
}
