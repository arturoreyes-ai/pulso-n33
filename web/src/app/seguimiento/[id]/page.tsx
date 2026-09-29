import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Navegacion } from "@/components/chrome/navegacion";
import { FichaSeguimiento } from "@/components/seguimiento/ficha-seguimiento";

/**
 * Una publicacion en seguimiento. El HTML es un cascaron: la ficha sale de
 * /api/seguimiento/[id], que la lee de la base y avanza la lectura en curso,
 * y el titulo de la pestana no dice cual es a proposito — el `<title>` viaja
 * en el historial y en los enlaces compartidos, y la base es de sesion.
 */
export const metadata: Metadata = {
  title: "Seguimiento · Pulso",
  description: "Los comentarios más recientes de una publicación y el tono de lo que se comenta.",
};

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export default async function PaginaPublicacionSeguida({ params }: PageProps<"/seguimiento/[id]">) {
  const { id } = await params;
  if (!ID.test(id)) notFound();
  return (
    <>
      <Navegacion zona={null} vista={null} pagina="seguimiento" />
      <FichaSeguimiento id={id} />
    </>
  );
}
