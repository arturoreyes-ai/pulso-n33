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
  // La portada es el recorrido desde el 15 de septiembre de 2026.
  portada: (l) =>
    `Los titulares que destacan ahora sobre ${l}, uno por pantalla, con su fuente y su enlace. Es una lectura en vivo y no cuenta en las cifras de prensa.`,
  // Instagram y TikTok publican el texto; YouTube nunca. La linea decia «Se
  // publica el texto de los comentarios» de las tres y era falsa para una.
  redes: (l) =>
    `Lo que se publica y lo que se comenta en Instagram, TikTok y YouTube sobre ${l}, y lo que X marca como tendencia. Se publica lo que se dijo, nunca quién lo dijo.`,
  indicadores: (l) =>
    `Precios de vivienda, predial, incidencia delictiva y percepción en ${l}, cada cifra con su fuente y su salvedad.`,
};

/** El titulo, como guardas y no como tres ternarios encajados. */
function titulo(nombre: string | null, vista: Vista): string {
  // La portada de la region se queda con el titulo del layout: es "Pulso" a
  // secas, no "En Tendencia · Pulso".
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
