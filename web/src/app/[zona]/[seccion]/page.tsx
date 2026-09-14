import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Pagina } from "@/components/paginas/pagina";
import { metadatos } from "@/lib/dominio/metadatos";
import { SECCIONES, seccionDeSlug } from "@/lib/dominio/secciones";
import { SLUGS, zonaDeSlug } from "@/lib/dominio/zonas";

/**
 * Las dos vistas interiores de una zona: /tijuana/redes, /ensenada/indicadores,
 * /san-diego/redes y las 13 restantes.
 *
 * Un solo archivo dinamico y no dos carpetas literales bajo `[zona]`: son 16
 * paginas identicas salvo por dos segmentos, y `generateStaticParams` las
 * prerenderiza todas igual. La contrapartida es que el slug hay que
 * validarlo, que es exactamente lo que ya hace la zona un nivel arriba.
 *
 * La region NO pasa por aqui: `/redes` es una carpeta literal hermana de
 * `[zona]`, porque en la raiz no puede haber dos segmentos dinamicos.
 */

interface Props {
  params: Promise<{ zona: string; seccion: string }>;
}

/** Solo las 24 combinaciones conocidas; cualquier otra es 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return SLUGS.flatMap((zona) => SECCIONES.map((seccion) => ({ zona, seccion })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { zona, seccion } = await params;
  const z = zonaDeSlug(zona);
  const s = seccionDeSlug(seccion);
  if (z === null || s === null) return {};
  return metadatos(z, s);
}

export default async function PaginaZonaSeccion({ params }: Props) {
  const { zona, seccion } = await params;
  const z = zonaDeSlug(zona);
  const s = seccionDeSlug(seccion);
  if (z === null || s === null) notFound();
  return <Pagina zona={z} vista={s} />;
}
