import type { Metadata } from "next";

import { Pagina } from "@/components/paginas/pagina";
import { metadatos } from "@/lib/dominio/metadatos";

/** Instagram, TikTok y YouTube de toda la region. La misma vista por zona esta en `[zona]/[seccion]`. */
export const metadata: Metadata = metadatos(null, "redes");

export default function PaginaRedesRegion() {
  return <Pagina zona={null} vista="redes" />;
}
