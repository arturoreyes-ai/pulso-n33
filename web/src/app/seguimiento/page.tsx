import type { Metadata } from "next";

import { Navegacion } from "@/components/chrome/navegacion";
import { TableroSeguimiento } from "@/components/seguimiento/tablero-seguimiento";

/**
 * Seguimiento es una pagina SUELTA, como Garitas y Gasto electoral: esta en
 * la nav pero no en la rejilla lugar x vista, porque una publicacion que el
 * equipo sigue no es de un municipio (lib/dominio/secciones.ts::SUELTAS).
 *
 * La nav se monta aqui, en el servidor, y no dentro del tablero: `Navegacion`
 * lleva la accion de cerrar sesion y arrastrarla al arbol de cliente la
 * meteria al bundle entero (ver app/garitas/page.tsx).
 */
export const metadata: Metadata = {
  title: "Seguimiento · Pulso",
  description: "Publicaciones de Instagram, TikTok y Facebook que el equipo sigue: sus comentarios más recientes y el tono de lo que se comenta.",
};

export default function PaginaSeguimiento() {
  return (
    <>
      <Navegacion zona={null} vista={null} pagina="seguimiento" />
      <header className="mx-auto w-full max-w-[88rem] px-4 pb-8 md:px-8">
        <h1 className="max-w-[18ch] font-titular text-hero [font-stretch:112%] text-tinta-titulo">Seguimiento</h1>
        <p className="mt-4 text-meta text-tinta-meta">Instagram · TikTok · Facebook</p>
      </header>
      <TableroSeguimiento />
    </>
  );
}
