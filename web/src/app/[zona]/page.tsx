import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Pagina } from "@/components/paginas/pagina";
import { metadatos } from "@/lib/dominio/metadatos";
import { SLUGS, zonaDeSlug } from "@/lib/dominio/zonas";

/**
 * La portada de una zona: /tijuana, /mexicali, /ensenada, /rosarito, /tecate,
 * /san-quintin, /san-felipe y /san-diego.
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
}

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

export default async function PaginaZona({ params }: Props) {
  const z = zonaDeSlug((await params).zona);
  if (z === null) notFound();
  return <Pagina zona={z} vista={null} />;
}
