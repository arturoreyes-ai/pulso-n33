import { leerDatoPublicado, type LeerDatos } from "@/lib/datos/publicado";
import type { BuscadorMedio } from "./buscadores";
import type { Idioma } from "./tipos";

/**
 * Lo que la busqueda en vivo necesita saber de los medios, y que vive en
 * config/ y no en data/: los buscadores verificados de config/consultas.json,
 * el nombre y el idioma de cada medio de config/medios.json y el idioma de
 * cada fila de redes (config/instagram.json, tiktok.json, youtube.json).
 *
 * Lo arma scripts/sincronizar-datos.mjs en public/data/catalogo-busqueda.json,
 * como ya copiaba config/roster.json. No es una segunda copia del config: es
 * una proyeccion de solo cuatro campos, sin las notas de sondeo, y solo de las
 * filas `activo` y `verificado`. Un buscador que no se sondeo no llega aqui.
 *
 * El idioma de un medio LO DECLARA SU FILA, nunca se adivina del texto: es la
 * leccion de San Diego (pulso/sentimiento.py), que aqui decide que titulares
 * pasan por el modelo de tono.
 */

export interface MedioCatalogo {
  id: string;
  nombre: string;
  dominio: string;
  idioma: Idioma;
  /** `activo` de config/medios.json. Un catalogo de antes del campo no lo
   *  trae y se lee como encendido: la proyeccion no apagaba nada. */
  activo: boolean;
}

/** Una fila de config/instagram.json, tiktok.json o youtube.json: su id es el
 *  `cuenta` de cada destacado. */
export interface CuentaCatalogo {
  id: string;
  idioma: Idioma;
}

export interface CatalogoBusqueda {
  buscadores: BuscadorMedio[];
  medios: MedioCatalogo[];
  cuentas: CuentaCatalogo[];
}

export const NOMBRE_CATALOGO = "catalogo-busqueda.json";

const esIdioma = (x: unknown): x is Idioma => x === "es" || x === "en";

/** Valida la forma, fila por fila: una fila rota se cae, no tumba el resto. */
export function leerFormaCatalogo(crudo: unknown): CatalogoBusqueda | null {
  if (typeof crudo !== "object" || crudo === null) return null;
  const c = crudo as { buscadores?: unknown; medios?: unknown; cuentas?: unknown };
  if (!Array.isArray(c.buscadores) || !Array.isArray(c.medios)) return null;
  const cuentas = (Array.isArray(c.cuentas) ? c.cuentas : []).filter((m): m is CuentaCatalogo =>
    typeof m === "object" && m !== null
    && typeof (m as CuentaCatalogo).id === "string"
    && esIdioma((m as CuentaCatalogo).idioma));
  const buscadores = c.buscadores.filter((b): b is BuscadorMedio =>
    typeof b === "object" && b !== null
    && typeof (b as BuscadorMedio).id === "string"
    && typeof (b as BuscadorMedio).nombre === "string"
    && typeof (b as BuscadorMedio).url === "string" && (b as BuscadorMedio).url.startsWith("https://")
    && (b as BuscadorMedio).url.includes("{q}")
    && esIdioma((b as BuscadorMedio).idioma));
  const medios = c.medios.filter((m): m is Omit<MedioCatalogo, "activo"> & { activo?: unknown } =>
    typeof m === "object" && m !== null
    && typeof (m as MedioCatalogo).id === "string"
    && typeof (m as MedioCatalogo).nombre === "string"
    && typeof (m as MedioCatalogo).dominio === "string"
    && esIdioma((m as MedioCatalogo).idioma))
    .map((m) => ({ id: m.id, nombre: m.nombre, dominio: m.dominio, idioma: m.idioma, activo: m.activo !== false }));
  return { buscadores, medios, cuentas };
}

export type LeerCatalogo = () => Promise<CatalogoBusqueda | null>;

let memoria: Promise<CatalogoBusqueda | null> | null = null;

/** Se memoiza por proceso, como archivo.ts: solo cambia con un despliegue. */
export function catalogoCon(leer: LeerDatos = leerDatoPublicado): LeerCatalogo {
  return () => leer(NOMBRE_CATALOGO).then(leerFormaCatalogo);
}

export const catalogoPublicado: LeerCatalogo = () => {
  memoria ??= catalogoCon()();
  return memoria;
};
