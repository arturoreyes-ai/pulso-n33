import type { Metadata } from "next";
import { Suspense } from "react";

import { Navegacion } from "@/components/chrome/navegacion";
import { Seccion } from "@/components/chrome/seccion";
import { PanelGastoElectoral } from "@/components/paneles/gasto-electoral";
import { Esqueleto } from "@/components/ui/primitivas";

export const metadata: Metadata = {
  title: "Gasto electoral de Baja California · Pulso",
  description:
    "Gasto final auditado de candidaturas de Baja California en 2024 y financiamiento público asignado a partidos en 2026.",
};

export default function PaginaGastoElectoral() {
  return (
    <>
      <Navegacion zona={null} vista={null} pagina="gasto-electoral" />
      <header className="mx-auto w-full max-w-[88rem] px-4 pb-6 md:px-8">
        <div className="entrada">
          <h1 className="max-w-[18ch] font-titular text-hero [font-stretch:112%] text-tinta-titulo">
            Gasto electoral de Baja California
          </h1>
          <p className="mt-4 text-meta text-tinta-meta">Elecciones 2024 · cifras finales auditadas</p>
          <p className="mt-6 max-w-[65ch] text-lectura text-tinta-prosa">
            Busca una candidatura para ver cuánto reportó, qué determinó la auditoría y
            cómo quedó frente a su tope y a la misma contienda. Las asignaciones a partidos
            de 2026 viven en una vista separada: no son gasto de campaña.
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
