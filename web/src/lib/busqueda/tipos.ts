/**
 * Contrato de /api/buscar. El unico modulo que importan los dos lados.
 *
 * Es deliberadamente OTRO tipo que `Nota`: un resultado en vivo no paso por el
 * pipeline, asi que no tiene id, ni zona, ni delegacion, ni tono, ni figura.
 * Darle la forma de `Nota` invitaria a mezclarlo en el muro y en los conteos,
 * y esas dos cifras no se pueden sumar: la de arriba son notas cosechadas y
 * clasificadas por zona, tono y figura; esta son enlaces sin clasificar que
 * se pidieron hace un segundo. Un solo numero no significaria ninguna.
 */

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

/** Google trunca de todos modos; 2 KB es un pegado accidental. */
export const LARGO_MAXIMO_CONSULTA = 120;

/** Por debajo de esto no se consulta: casi todo empata y no dice nada. */
export const MINIMO_CONSULTA = 3;

export const TOPE_RESULTADOS = 40;
