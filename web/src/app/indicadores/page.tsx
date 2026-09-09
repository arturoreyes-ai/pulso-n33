import type { Metadata } from "next";

import { Pagina } from "@/components/paginas/pagina";
import { metadatos } from "@/lib/dominio/metadatos";

/** Las cifras oficiales de toda la region. La misma vista por zona esta en `[zona]/[seccion]`. */
export const metadata: Metadata = metadatos(null, "indicadores");

export default function PaginaIndicadoresRegion() {
  return <Pagina zona={null} vista="indicadores" />;
}
