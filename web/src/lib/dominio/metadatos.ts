import type { Metadata } from "next";

import { tituloSeccion, type Seccion, type Vista } from "./secciones";
import { NOMBRE_CORTO, type ZonaRuta } from "./zonas";

/**
 * El titulo y la descripcion de cada celda de la rejilla lugar x vista.
 *
 * Vive aqui y no en cada `page.tsx` porque son 36 combinaciones y la mayoria
 * se generan: escribirlas a mano es como se llega a que /ensenada/redes se
 * anuncie como "Pulso" a secas en la pestana y en un enlace compartido.
 */

/** Lo que la pagina dice de si misma, en una linea. */
const DESCRIPCION: Record<Seccion | "portada", (lugar: string) => string> = {
  portada: (l) => `Titulares sobre ${l}, con su fuente, su enlace y el tema del que forman parte.`,
  redes: (l) =>
    `Lo que se publica y lo que se comenta en Instagram, TikTok y YouTube sobre ${l}. Se publica el texto de los comentarios, nunca quién los escribió.`,
  indicadores: (l) =>
    `Precios de vivienda, predial, incidencia delictiva y percepción en ${l}, cada cifra con su fuente y su salvedad.`,
  cobertura: (l) => `Qué se cubre de ${l} y qué no. Los huecos se rotulan; no se rellenan con ceros.`,
};

/** El titulo, como guardas y no como tres ternarios encajados. */
function titulo(nombre: string | null, vista: Vista): string {
  // La portada de la region se queda con el titulo del layout: es "Pulso" a
  // secas, no "Titulares · Pulso".
  if (vista === null) return nombre === null ? "Pulso" : `${nombre} · Pulso`;
  return `${tituloSeccion(vista, nombre)} · Pulso`;
}

export function metadatos(zona: ZonaRuta | null, vista: Vista): Metadata {
  const nombre = zona === null ? null : NOMBRE_CORTO[zona];
  return {
    title: titulo(nombre, vista),
    description: DESCRIPCION[vista ?? "portada"](nombre ?? "el corredor Tijuana–San Diego"),
  };
}
