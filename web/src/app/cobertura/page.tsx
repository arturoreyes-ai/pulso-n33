import type { Metadata } from "next";

import { Pagina } from "@/components/paginas/pagina";
import { metadatos } from "@/lib/dominio/metadatos";

/** Que se cubre y que no, en toda la region. La misma vista por zona esta en `[zona]/[seccion]`. */
export const metadata: Metadata = metadatos(null, "cobertura");

export default function PaginaCoberturaRegion() {
  return <Pagina zona={null} vista="cobertura" />;
}
