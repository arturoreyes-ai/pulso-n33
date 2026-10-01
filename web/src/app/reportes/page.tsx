import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Navegacion } from "@/components/chrome/navegacion";
import { TableroReportes } from "@/components/reportes/tablero-reportes";
import { requerirUsuario } from "@/lib/acceso/sesion";

export const metadata: Metadata = {
  title: "Reportes · Pulso",
  description: "Reportes de los términos en seguimiento y búsqueda de noticias y publicaciones en redes.",
  robots: { index: false, follow: false },
};

/** Un término no pertenece a una zona. La búsqueda conserva su URL al
 * compartir o volver atrás, como los lectores, sin iniciar cosechas pagadas.
 *
 * Solo administradores «por ahora» (cliente, 29 de septiembre de 2026): a
 * cualquier otro le responde 404, como Accesos, y no una página que diga que
 * no puede verla. La nav tampoco la pinta (`soloAdmin` en secciones.ts). */
export default async function PaginaReportes({ searchParams }: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const [usuario, { q }] = await Promise.all([requerirUsuario(), searchParams]);
  if (usuario.rol !== "admin") notFound();
  const consulta = typeof q === "string" ? q.trim() : "";
  return (
    <>
      <Navegacion zona={null} vista={null} pagina="reportes" />
      <div className="mx-auto w-full max-w-[88rem] px-4 pb-16 md:px-8">
        <header className="mb-8 max-w-[48rem]">
          <h1 className="font-titular text-hero text-tinta-titulo [font-stretch:112%]">Reportes</h1>
          <p className="mt-4 text-lectura text-tinta-prosa">Lo que se publica sobre las personas, empresas y temas que sigues.</p>
        </header>
        <TableroReportes key={consulta} consulta={consulta} />
      </div>
    </>
  );
}
