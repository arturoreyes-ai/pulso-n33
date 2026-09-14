/**
 * Contrato de /api/buscar y de /api/actualidad. El unico modulo que importan
 * los dos lados.
 *
 * Es deliberadamente OTRO tipo que `Nota`: un resultado en vivo no paso por el
 * pipeline, asi que no tiene id, ni zona, ni delegacion, ni tono, ni figura.
 * Darle la forma de `Nota` invitaria a mezclarlo en el muro y en los conteos,
 * y esas dos cifras no se pueden sumar: la de arriba son notas cosechadas y
 * clasificadas por zona, tono y figura; esta son enlaces sin clasificar que
 * se pidieron hace un segundo. Un solo numero no significaria ninguna.
 */

// Ciclos solo de tipos con ambito.ts y rubros.ts: se borran al compilar.
import type { AmbitoActualidad } from "./ambito";
import type { Rubro } from "./rubros";
import type { Slug } from "@/lib/dominio/zonas";

export type Idioma = "es" | "en";

export interface ResultadoExterno {
  titulo: string;
  /** Redirector opaco de Google (news.google.com/rss/articles/CBM...). NO es
   *  el enlace del medio; la fila lo dice. */
  url: string;
  /** Host real, del atributo url de <source>. Espejo de
   *  pulso/normalizar.py::dominio. */
  dominio: string;
  /** Texto de <source>: el nombre del medio como lo escribe Google. */
  medio: string;
  /** ISO-8601 desde el pubDate RFC 2822, o null si no se pudo interpretar. */
  publicado: string | null;
  /**
   * EL LOCALE QUE LO DEVOLVIO, NO EL IDIOMA DEL TEXTO. Un feed es-419 puede
   * devolver una nota en ingles. Nunca alimentar un modelo con este campo:
   * esa es exactamente la falla que AGENTS.md documenta como la que "shipped
   * broken for months and nothing flagged it".
   */
  idioma: Idioma;
}

/** Salud por locale. Reusa el vocabulario de `Fuente` a proposito. */
export interface SaludFeed {
  idioma: Idioma;
  estado: "ok" | "fallo";
  obtenidas: number;
  ms: number;
  error: string | null;
}

export interface RespuestaBusqueda {
  consulta: string;
  resultados: ResultadoExterno[];
  fuentes: SaludFeed[];
  /** True si se recorto al tope. Se reporta, no se esconde. */
  truncada: boolean;
}

export interface ErrorBusqueda {
  codigo: "vacia" | "larga" | "invalida";
  mensaje: string;
}

/**
 * Que seccion de Google Noticias se pidio a /api/actualidad: una edicion
 * (`mexico`, `internacional`), el corredor (`region`: Tijuana y San Diego) o
 * la seccion LOCAL de una zona (`zona`, con el slug en `zona`).
 */
export type SeccionActualidad = AmbitoActualidad | "region" | "zona";

/**
 * Lo que devuelve /api/actualidad: una seccion de Google Noticias tal como
 * esta en este momento.
 *
 * Misma fila que la busqueda (`ResultadoExterno`) y misma salud por locale.
 * Lo que cambia es el orden: aqui NUNCA se reordena. La seccion viene en el
 * orden de Google, que no es por fecha (23 inversiones en 45 items el dia que
 * se midio), y ese orden es la senal de "que esta sonando ahora".
 */
export interface RespuestaActualidad {
  seccion: SeccionActualidad;
  /** El slug de la zona cuando `seccion` es "zona"; null en las demas. */
  zona: Slug | null;
  /** El rubro pedido con t=, o null si es la seccion tal cual. Con rubro la
   *  lista es una BUSQUEDA (ver rubros.ts), no la seccion de Google. */
  rubro: Rubro | null;
  /** Hora del servidor al pedirle a Google. Con el CDN puede tener 5 min. */
  consultado: string;
  resultados: ResultadoExterno[];
  fuentes: SaludFeed[];
  truncada: boolean;
}

export interface ErrorActualidad {
  codigo: "ambito" | "zona" | "rubro";
  mensaje: string;
}

/** Google trunca de todos modos; 2 KB es un pegado accidental. */
export const LARGO_MAXIMO_CONSULTA = 120;

/** Por debajo de esto no se consulta: casi todo empata y no dice nada. */
export const MINIMO_CONSULTA = 3;

export const TOPE_RESULTADOS = 40;

/**
 * Tope de /api/actualidad, mas corto que el de la busqueda a proposito. El
 * cliente pidio el 12 de septiembre de 2026 "un maximo de 15" para acortar la
 * cola: en una lista ordenada por relevancia lo que se aleja del lugar o del
 * rubro se acumula al final, y quince es donde todavia se sostiene.
 */
export const TOPE_ACTUALIDAD = 15;
