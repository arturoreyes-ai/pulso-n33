import type { Metadata } from "next";

import { NavPildora } from "@/components/chrome/nav-pildora";
import { TableroGaritas } from "@/components/garitas/tablero-garitas";

/**
 * Garitas es una pagina SUELTA: esta en la nav pero no en la rejilla lugar x
 * vista, porque mide esperas del corredor y no de un municipio (ver
 * `lib/dominio/secciones.ts::SUELTAS`).
 *
 * La nav se monta aqui, en el servidor, y no dentro del tablero: `NavPildora`
 * es un componente de servidor —lleva la accion de cerrar sesion y el icono
 * `dist/ssr`— y meterlo en el arbol de cliente del tablero lo arrastraria al
 * bundle entero. Es la misma forma que `/gasto-electoral`.
 */
export const metadata: Metadata = {
  title: "Garitas · Pulso",
  description:
    "Esperas reportadas por CBP hacia Estados Unidos en San Ysidro y Otay Mesa, para vehículos y peatones, con la hora de reporte de cada carril.",
};

export default function PaginaGaritas() {
  return (
    <>
      <NavPildora zona={null} vista={null} pagina="garitas" />
      <TableroGaritas />
    </>
  );
}
