import { NavPildora } from "@/components/chrome/nav-pildora";
import { Pie } from "@/components/chrome/pie";
import type { Vista } from "@/lib/dominio/secciones";
import type { ZonaRuta } from "@/lib/dominio/zonas";
import { PaginaCobertura } from "./cobertura";
import { PaginaIndicadores } from "./indicadores";
import { PaginaRedes } from "./redes";
import { PaginaTitulares } from "./titulares";

/**
 * Una celda de la rejilla lugar x vista: 9 lugares por 4 vistas.
 *
 * Todas las rutas del tablero terminan aqui, y por eso la nav y el pie se
 * escriben UNA vez. Antes esto era `tablero.tsx`, que componia las nueve
 * secciones seguidas y las servia iguales en las nueve zonas: una pagina de
 * ~9 pantallas donde el 80% de lo que bajaba no era lo que se venia a ver.
 *
 * El cuerpo se elige por tabla y no por una escalera de ternarios, que es lo
 * que crece mal cuando se agrega la quinta vista.
 */
const CUERPOS = {
  portada: PaginaTitulares,
  redes: PaginaRedes,
  indicadores: PaginaIndicadores,
  cobertura: PaginaCobertura,
} as const;

export function Pagina({ zona, vista }: { zona: ZonaRuta | null; vista: Vista }) {
  const Cuerpo = CUERPOS[vista ?? "portada"];

  return (
    <>
      <NavPildora zona={zona} vista={vista} />
      <Cuerpo zona={zona} />
      {/* El pie se repite en las cuatro paginas a proposito. Es prosa de
          servidor, no pesa un byte de bundle, y es la integridad del producto:
          recortarlo por pagina obligaria a decidir en cual de las cuatro se
          puede omitir que esto mide volumen de prensa y no opinion publica.
          Ninguna. */}
      <Pie />
    </>
  );
}
