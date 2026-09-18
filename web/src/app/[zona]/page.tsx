import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

import { Pagina } from "@/components/paginas/pagina";
import { PARAM_CONSULTA, PARAM_RUBRO } from "@/lib/busqueda/entrada";
import { metadatos } from "@/lib/dominio/metadatos";
import { SLUGS, zonaDeSlug } from "@/lib/dominio/zonas";

/**
 * La portada de una zona: /tijuana, /mexicali, /ensenada, /rosarito, /tecate,
 * /san-quintin, /san-felipe y /san-diego. Desde el 15 de septiembre de 2026 es
 * En Tendencia empezando por esa zona.
 *
 * La zona es un SEGMENTO DE RUTA y no un parametro de consulta ni un estado
 * de cliente: asi cada zona se prerenderiza como HTML estatico con su propio
 * titulo, se puede compartir y marcar, y el boton de atras funciona. Las
 * islas de cliente reciben la zona como prop y filtran el mismo JSON, que SWR
 * ya tiene en cache al cambiar de zona.
 *
 * Las otras tres vistas de esta misma zona cuelgan de `[seccion]`, un nivel
 * mas abajo.
 */

interface Props {
  params: Promise<{ zona: string }>;
  searchParams: Promise<{ [clave: string]: string | string[] | undefined }>;
}

/** Como en la portada de la region: esta ruta monta el lector, que mide con
 *  `env(safe-area-inset-*)`. */
export const viewport: Viewport = { viewportFit: "cover" };

/** Solo los ocho slugs conocidos; cualquier otro es 404, no una pagina vacia. */
export const dynamicParams = false;

export function generateStaticParams() {
  return SLUGS.map((zona) => ({ zona }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const z = zonaDeSlug((await params).zona);
  if (z === null) return {};
  return metadatos(z, null);
}

export default async function PaginaZona({ params, searchParams }: Props) {
  const z = zonaDeSlug((await params).zona);
  if (z === null) notFound();
  // La zona NO lee `?e=`: ahi manda el segmento, que es el eje de lugar. La
  // consulta si, para que se pueda buscar dentro de este lugar, y el tema
  // tambien: un rubro ACOTA el lugar en vez de competir con el, asi que
  // `/tijuana?t=clima` significa algo y `/tijuana?e=mexico` no.
  const facetas = await searchParams;
  const q = facetas[PARAM_CONSULTA];
  const t = facetas[PARAM_RUBRO];
  return (
    <Pagina
      zona={z}
      vista={null}
      consulta={typeof q === "string" ? q : null}
      rubro={typeof t === "string" ? t : null}
    />
  );
}
