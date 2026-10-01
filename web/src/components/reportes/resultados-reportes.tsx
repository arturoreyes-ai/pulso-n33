"use client";

import Link from "next/link";

import { PestanasBusqueda, ResultadosBusqueda, useVistaBusqueda } from "@/components/busqueda/resultados-busqueda";
import { clasesBoton } from "@/components/ui/clases";

/** La búsqueda de /reportes. Es la MISMA de la portada y de Redes
 * (busqueda/resultados-busqueda.tsx), que nació aquí: prensa existente y
 * todas las publicaciones disponibles, sin comentarios ni búsquedas pagadas.
 * Lo único propio es la cabecera, porque aquí no hay barra de lector. */
export function ResultadosReportes({ consulta }: { consulta: string }) {
  const [vista, setVista] = useVistaBusqueda();
  return (
    <section aria-labelledby="resultados-reportes" className="grid gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="resultados-reportes" className="min-w-0 break-words font-titular text-rotulo text-tinta-titulo">Resultados para {consulta}</h2>
        <Link href="/reportes" className={clasesBoton(false)}>Limpiar búsqueda</Link>
      </div>
      <PestanasBusqueda vista={vista} onVista={setVista} />
      <ResultadosBusqueda consulta={consulta} vista={vista} />
    </section>
  );
}
