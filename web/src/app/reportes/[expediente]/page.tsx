import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Navegacion } from "@/components/chrome/navegacion";
import { VistaExpediente } from "@/components/reportes/expediente";
import { requerirUsuario } from "@/lib/acceso/sesion";
import { expedientePorId } from "@/lib/expedientes/expedientes";

/**
 * Un expediente: el informe editorial fijo de lib/expedientes/. Mismo
 * candado que /reportes, 404 a quien no es administrador.
 *
 * El `<title>` no nombra a la persona, como /seguimiento/[id] no nombra la
 * publicacion: viaja en el historial y en los enlaces compartidos, y la
 * pagina es de sesion.
 */
export const metadata: Metadata = {
  title: "Expediente · Pulso",
  description: "Lo que más se publicó sobre una persona en un año, por historia y alcance.",
  robots: { index: false, follow: false },
};

export default async function PaginaExpediente({ params }: PageProps<"/reportes/[expediente]">) {
  const [usuario, { expediente }] = await Promise.all([requerirUsuario(), params]);
  if (usuario.rol !== "admin") notFound();
  const e = expedientePorId(expediente);
  if (e === undefined) notFound();
  return (
    <>
      <Navegacion zona={null} vista={null} pagina="reportes" />
      <VistaExpediente e={e} />
    </>
  );
}
