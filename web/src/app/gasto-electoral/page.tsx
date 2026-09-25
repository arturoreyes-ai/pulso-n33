import type { Metadata } from "next";
import { Suspense } from "react";

import { Navegacion } from "@/components/chrome/navegacion";
import { Seccion } from "@/components/chrome/seccion";
import { PanelGastoElectoral } from "@/components/paneles/gasto-electoral";
import { Esqueleto } from "@/components/ui/primitivas";

export const metadata: Metadata = {
  title: "Gasto electoral de Baja California · Pulso",
  description:
    "Gasto auditado de candidaturas de Baja California, financiamiento a partidos y publicidad política en Meta.",
};

export default function PaginaGastoElectoral() {
  return (
    <>
      <Navegacion zona={null} vista={null} pagina="gasto-electoral" />
      <header className="mx-auto w-full max-w-[88rem] px-4 pb-6 md:px-8">
        <div>
          <h1 className="max-w-[18ch] font-titular text-hero [font-stretch:112%] text-tinta-titulo">
            Gasto electoral de Baja California
          </h1>
          <p className="mt-4 text-meta text-tinta-meta">Candidaturas 2024 · Partidos 2026 · Publicidad Meta</p>
          <p className="mt-6 max-w-[65ch] text-lectura text-tinta-prosa">
            Consulta el gasto auditado de las candidaturas, las asignaciones a partidos
            y la publicidad de figuras públicas en Meta. Cada vista conserva sus fuentes,
            periodos y conceptos.
          </p>
        </div>
      </header>

      <Seccion id="gasto-electoral" pegada>
        <Suspense fallback={<Esqueleto className="h-[32rem]" />}>
          <PanelGastoElectoral />
        </Suspense>
      </Seccion>

    </>
  );
}
