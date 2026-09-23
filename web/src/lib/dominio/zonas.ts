import type { Nota, Zona } from "@/lib/datos/tipos";

/**
 * Las zonas del producto, en el orden en que se muestran. Incluye las que hoy
 * salen en cero: un cero rotulado es informacion, una zona ausente de la
 * lista parece un olvido.
 */
export const ZONAS_PRODUCTO = [
  "Tijuana",
  "Mexicali",
  "Ensenada",
  "Playas de Rosarito",
  "Tecate",
  "San Quintín",
  "San Felipe",
  "San Diego",
  "estatal",
] as const;

/** Las notas nacionales no tienen zona; se agrupan aparte, al final. */
export const NACIONAL = "nacional";

const ORDEN = [...ZONAS_PRODUCTO, NACIONAL];

/** Map de indice, construido una vez a nivel de modulo. */
export const ORDEN_ZONA = new Map<string, number>(ORDEN.map((z, i) => [z, i]));

export const rango = (z: string) => ORDEN_ZONA.get(z) ?? 99;

/* ------------------------------------------------------------------ rutas */

/** Las ocho zonas con pagina propia. 'estatal' no es un lugar: no tiene ruta. */
export type ZonaRuta = Exclude<Zona, "estatal">;

export const ZONAS_RUTA = ZONAS_PRODUCTO.filter((z): z is ZonaRuta => z !== "estatal");

/** Los siete municipios de Baja California, para los indicadores mexicanos. */
export const MUNICIPIOS_BC = ZONAS_RUTA.filter((z) => z !== "San Diego");

export const esMunicipio = (z: ZonaRuta) => z !== "San Diego";

export const SLUG_DE_ZONA = {
  Tijuana: "tijuana",
  Mexicali: "mexicali",
  Ensenada: "ensenada",
  "Playas de Rosarito": "rosarito",
  Tecate: "tecate",
  "San Quintín": "san-quintin",
  "San Felipe": "san-felipe",
  "San Diego": "san-diego",
} as const satisfies Record<ZonaRuta, string>;

export type Slug = (typeof SLUG_DE_ZONA)[ZonaRuta];

export const SLUGS: readonly Slug[] = ZONAS_RUTA.map((z) => SLUG_DE_ZONA[z]);

const ZONA_DE_SLUG = new Map<string, ZonaRuta>(ZONAS_RUTA.map((z) => [SLUG_DE_ZONA[z], z]));

export const zonaDeSlug = (s: string): ZonaRuta | null => ZONA_DE_SLUG.get(s) ?? null;

/**
 * La PORTADA de una zona. Para conservar la vista en la que esta el lector
 * —de /tijuana/redes a /ensenada/redes— es `secciones.ts::ruta`, que es la
 * misma funcion con el segundo eje. Esta se queda para los enlaces que
 * significan "vete a esa zona" y no "cambia de zona": el muro y el panorama,
 * que solo existen en la portada.
 */
export const rutaDeZona = (z: ZonaRuta | null) => (z === null ? "/" : `/${SLUG_DE_ZONA[z]}`);

/**
 * Como se llama la opcion «sin municipio» en todo selector de lugar: la
 * portada, Redes, la cinta y el selector de la pagina. Un solo nombre en un
 * solo sitio desde el 23 de septiembre de 2026, a pedido del cliente: la
 * portada decia «El corredor», Redes «Toda la región» y el resto lo mismo con
 * otra forma. Ese dia fue «Todas» unas horas; el cliente lo encontro ambiguo
 * —en Redes quedaba encima de la pestaña «Todas», que son las plataformas— y
 * volvio a «Toda la región».
 */
export const NOMBRE_TODA_REGION = "Toda la región";

/** Como se le dice a la zona en una frase corta. */
export const NOMBRE_CORTO: Record<ZonaRuta, string> = {
  Tijuana: "Tijuana",
  Mexicali: "Mexicali",
  Ensenada: "Ensenada",
  "Playas de Rosarito": "Rosarito",
  Tecate: "Tecate",
  "San Quintín": "San Quintín",
  "San Felipe": "San Felipe",
  "San Diego": "San Diego",
};
