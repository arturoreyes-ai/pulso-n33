import type { Metadata } from "next";

import { Navegacion } from "@/components/chrome/navegacion";
import { TableroReportes } from "@/components/reportes/tablero-reportes";

export const metadata: Metadata = {
  title: "Reportes · Pulso",
  description: "Reportes de los términos en seguimiento y búsqueda de noticias y publicaciones en redes.",
};

/** Un término no pertenece a una zona. La búsqueda conserva su URL al
 * compartir o volver atrás, como los lectores, sin iniciar cosechas pagadas. */
export default async function PaginaReportes({ searchParams }: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
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
