import type { Metadata } from "next";

import { Pagina } from "@/components/paginas/pagina";
import { PARAM_CONSULTA } from "@/lib/busqueda/entrada";
import { metadatos } from "@/lib/dominio/metadatos";

/**
 * Instagram, TikTok, YouTube y las tendencias de X de toda la region. La misma
 * vista por zona esta en `[zona]/[seccion]`.
 *
 * Desde el 18 de septiembre de 2026 ESTA ruta lee `?q=`: la busqueda de la lupa
 * de Redes, que muestra un termino en seguimiento (data/consultas.json) o filtra
 * las publicaciones cargadas. Se lee en el SERVIDOR y baja como prop, igual que
 * en la portada y por la misma razon escrita en paginas/en-tendencia.tsx: un
 * `useSearchParams` bajo Suspense se queda colgado en una ruta prerrenderizada.
 * Leer `searchParams` vuelve esta pagina dinamica, como ya lo es `/`; el HTML
 * es un cascaron y los datos llegan por SWR, asi que no cambia lo que baja.
 *
 * Solo la ruta de REGION la lee. La de zona sigue prerrenderizada y sin
 * busqueda: un termino no es un lugar, y el formulario de la lupa envia
 * siempre aqui aunque se abra desde /tijuana/redes.
 */
export const metadata: Metadata = metadatos(null, "redes");

export default async function PaginaRedesRegion({ searchParams }: {
  searchParams: Promise<{ [clave: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const q = params[PARAM_CONSULTA];
  return <Pagina zona={null} vista="redes" consulta={typeof q === "string" ? q : null} />;
}
