import type { ReactNode } from "react";

import { Navegacion } from "@/components/chrome/navegacion";
import type { Seccion, Vista } from "@/lib/dominio/secciones";
import type { ZonaRuta } from "@/lib/dominio/zonas";
import { PaginaEnTendencia } from "./en-tendencia";
import { PaginaIndicadores } from "./indicadores";
import { PaginaRedes } from "./redes";

/**
 * Una celda de la rejilla lugar x vista: 9 lugares por 3 vistas.
 *
 * Todas las rutas del tablero terminan aqui, y por eso la nav y el pie se
 * escriben UNA vez. Antes esto era `tablero.tsx`, que componia las nueve
 * secciones seguidas y las servia iguales en las nueve zonas: una pagina de
 * ~9 pantallas donde el 80% de lo que bajaba no era lo que se venia a ver.
 *
 * El cuerpo se elige por tabla y no por una escalera de ternarios, que es lo
 * que crece mal cuando se agrega otra vista.
 */
const CUERPOS: Record<Seccion, (props: { zona: ZonaRuta | null; consulta: string | null }) => ReactNode> = {
  // Redes lee `consulta` (la busqueda de la lupa, `?q=`); Indicadores toma
  // solo `zona`, y una funcion que recibe menos props sigue siendo asignable.
  redes: PaginaRedes,
  indicadores: PaginaIndicadores,
};

/**
 * La PORTADA queda fuera de la tabla, y no por descuido: es la unica vista que
 * tiene una ENTRADA —Mexico o Internacional, en `?e=`— y por lo tanto la unica
 * con una prop que las otras no pueden recibir. Meterla en la tabla obligaria
 * a darles un `edicion` que ninguna lee, que es peor mentira que esta rama.
 *
 * `consulta` SI viaja a la tabla desde el 18 de septiembre de 2026: la portada
 * la lee para buscar titulares y Redes para buscar publicaciones y terminos en
 * seguimiento. Solo la ruta de region de Redes la lee del servidor
 * (app/redes/page.tsx); la de zona no, porque un termino no es un lugar.
 */
export function Pagina({ zona, vista, edicion = null, consulta = null, rubro = null }: { zona: ZonaRuta | null; vista: Vista; edicion?: string | null; consulta?: string | null; rubro?: string | null }) {
  const Cuerpo = vista === null ? null : CUERPOS[vista];

  // AQUI VIVIA EL PREESTRENO DE notas.json, y su ausencia es el cambio.
  //
  // La portada lo pedia con `preload(..., {as: "fetch"})` porque el recorrido
  // lo bajaba entero: 4.8 MB, 917 KB comprimido, 6,020 notas, para resolver
  // las miniaturas, el enlace del propio medio y las notas relacionadas de
  // como mucho quince filas a la vez. Era ~95% de todo lo que el tablero
  // descarga. Desde el 18 de septiembre de 2026 esos tres cruces los hace el
  // servidor contra el mismo disco (lib/busqueda/archivo.ts): las dos primeras
  // llegan resueltas en cada fila y la tercera se pide al abrir la hoja.
  //
  // Lo que se fue con el preestreno es toda la cuestion del modo de
  // credenciales —`as: "fetch"` sin `crossOrigin` hacia que Chrome descartara
  // la descarga y la pagara dos veces—, que solo existia porque el consumidor
  // era un `fetch` pelado del cliente. Ya no hay consumidor de cliente.

  return (
    <>
      <Navegacion zona={zona} vista={vista} />
      {Cuerpo === null ? <PaginaEnTendencia zona={zona} edicion={edicion} consulta={consulta} rubro={rubro} /> : <Cuerpo zona={zona} consulta={consulta} />}
      {/* El pie se repite en las tres paginas a proposito. Es prosa de
          servidor, no pesa un byte de bundle, y es la integridad del producto:
          recortarlo por pagina obligaria a decidir en cual se puede omitir que
          esto mide volumen de prensa y no opinion publica. Ninguna. */}
    </>
  );
}
