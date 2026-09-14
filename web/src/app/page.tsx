import { Pagina } from "@/components/paginas/pagina";

/**
 * La portada de la region: los titulares de las nueve zonas.
 *
 * El titulo y la descripcion los pone el layout. Las otras tres vistas de la
 * region viven en `redes/` e `indicadores/`, hermanas de
 * `[zona]/`: Next resuelve primero el segmento literal, asi que `/redes` es
 * siempre la seccion. Que ninguna zona pueda llamarse como una seccion lo
 * sostiene una guardia de tipos en lib/dominio/secciones.ts.
 */
export default function Portada() {
  return <Pagina zona={null} vista={null} />;
}
