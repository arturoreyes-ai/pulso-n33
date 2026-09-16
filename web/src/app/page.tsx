import type { Viewport } from "next";

import { Pagina } from "@/components/paginas/pagina";
import { PARAM_CONSULTA, PARAM_EDICION } from "@/lib/busqueda/entrada";

/**
 * La portada: En Tendencia, el recorrido de titulares en vivo del corredor.
 *
 * El titulo y la descripcion los pone el layout. Las otras tres vistas de la
 * region viven en `prensa/`, `redes/` e `indicadores/`, hermanas de `[zona]/`:
 * Next resuelve primero el segmento literal, asi que `/prensa` es siempre la
 * seccion. Que ninguna zona pueda llamarse como una seccion lo sostiene una
 * guardia de tipos en lib/dominio/secciones.ts.
 *
 * Mexico e Internacional se eligen aqui mismo con `?e=`; un municipio tiene su
 * propia ruta. Ver lib/busqueda/entrada.ts.
 */

/**
 * La portada monta el lector a pantalla completa, y el lector mide con
 * `env(safe-area-inset-*)`: la barra se separa del notch y la tarjeta del
 * borde de gestos. Sin esto esos valores son 0 y no se nota en escritorio ni
 * en un telefono sin muesca. Vivia en /ahora, que era la unica ruta con lector
 * hasta el 15 de septiembre de 2026.
 */
export const viewport: Viewport = { viewportFit: "cover" };

/**
 * `?e=` se lee AQUI, en el servidor, y baja como prop. La version anterior lo
 * leia en cliente con `useSearchParams` bajo un `<Suspense>` y el limite se
 * quedaba pendiente para siempre en esta ruta: ver el docstring de
 * components/paginas/en-tendencia.tsx. Leerlo aqui hace la ruta dinamica, que
 * es lo correcto para una pagina cuyo contenido es en vivo de todos modos, y
 * de paso la faceta funciona sin JavaScript.
 *
 * `/<zona>` no recibe faceta: ahi manda el segmento, que es el eje de lugar.
 */
export default async function Portada({ searchParams }: {
  searchParams: Promise<{ [clave: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const e = params[PARAM_EDICION];
  const q = params[PARAM_CONSULTA];
  return (
    <Pagina
      zona={null}
      vista={null}
      edicion={typeof e === "string" ? e : null}
      consulta={typeof q === "string" ? q : null}
    />
  );
}
