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
 *
 * `imagen` y `referencia` NO rompen eso, y conviene decir por que: las dos las
 * resuelve el servidor cruzando el titular contra el archivo publicado
 * (lib/busqueda/archivo.ts), y ninguna es una clasificacion del pipeline. Una
 * es la miniatura que el propio medio publica; la otra, el enlace de ese medio
 * cuando el archivo ya lo conocia. Siguen sin traer id, zona, tono ni figura,
 * asi que la fila sigue sin poder sumarse con nada.
 */

// Ciclos solo de tipos con ambito.ts y rubros.ts: se borran al compilar.
import type { AmbitoActualidad } from "./ambito";
import type { Rubro } from "./rubros";
import type { Slug } from "@/lib/dominio/zonas";

export type Idioma = "es" | "en";

/**
 * Por que camino llego una fila. `google`: el RSS de Google Noticias, con el
 * redirector opaco en `url`. `medio`: el buscador propio de un medio del
 * catalogo (buscadores.ts), con el enlace del medio. `archivo`: una nota que
 * el pipeline ya tenia (notas.json), sin su zona, su tono ni sus figuras.
 * Viaja por el cable pero no se pinta como palabra: la tarjeta solo lo usa
 * para no rotular «en tendencia» una nota del archivo.
 */
export type OrigenResultado = "google" | "medio" | "archivo";

export interface ResultadoExterno {
  titulo: string;
  /** Con `origen: "google"`, el redirector opaco de Google
   *  (news.google.com/rss/articles/CBM...), que NO es el enlace del medio; con
   *  `medio` y casi siempre con `archivo`, el enlace del propio medio. */
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
  /**
   * Miniatura del archivo publicado, o null. Null es «el archivo no la tiene»
   * y no un hueco que rellenar: la tarjeta se queda con su placa y, si acaso,
   * la pide a la pagina del propio medio (use-imagen-viva.ts).
   */
  imagen: string | null;
  /** A donde manda Analizar. Null cuando el dominio que anuncia la fila no se
   *  puede normalizar; si el archivo no conocia la nota, lleva el token opaco,
   *  que es lo que resolver-enlace.ts sabe abrir despues de confirmar. */
  referencia: ReferenciaAnalisis | null;
  origen: OrigenResultado;
}

/** Salud del buscador propio de un medio. `robots` no es una falla: es el
 *  sitio diciendo que no, un veredicto estable que no impide cachear. */
export interface SaludBuscador {
  id: string;
  nombre: string;
  estado: "ok" | "fallo" | "robots";
  titulares: number;
  anteriores: number;
  ms: number;
  error: string | null;
}

/**
 * Lo que recibe Analizar: el enlace del medio que ya conoce el archivo o, si
 * la nota acaba de aparecer, el token opaco. Vive aqui y no en enlaces.ts
 * porque ahora viaja por el cable; enlaces.ts lo reexporta.
 */
export interface ReferenciaAnalisis {
  url: string;
  dominio: string;
}

/**
 * Una nota del archivo, recortada a lo que la hoja de relacionadas pinta.
 *
 * NO es un `Nota` recortado por comodidad: es la regla 5 de PRODUCT.md hecha
 * tipo. Antes la hoja recibia el `Nota` entero y se limitaba a no pintar
 * `postura`; ahora el tono no esta en el alcance del panel y no se puede
 * pintar por descuido. Tampoco viajan `figuras`, `zonas` ni `alcance`.
 */
export interface NotaRelacionada {
  id: string;
  titulo: string;
  url: string;
  dominio: string;
  fecha: string | null;
}

/** Lo que devuelve /api/relacionadas: como mucho seis, sin totales. */
export interface RespuestaRelacionadas {
  relacionadas: NotaRelacionada[];
}

/** `datos` es «no se pudo mirar el archivo», que la hoja dice distinto de «no
 *  hay coincidencias». Mismo vocabulario que analizar-publicacion. */
export interface ErrorRelacionadas {
  codigo: "titulo" | "datos";
  mensaje: string;
}

/** Cuantas notas relacionadas se ofrecen. Muy por debajo del piso de 30, asi
 *  que el panel no saca porcentajes de aqui (regla 2). */
export const TOPE_RELACIONADAS = 6;

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
  /** Los buscadores propios de los medios, desde el 23 de septiembre de 2026.
   *  Vacio fuera del ambito `region`: esos medios no se leen por zona. */
  medios: SaludBuscador[];
  /** True si se recorto al tope. Se reporta, no se esconde. */
  truncada: boolean;
}

/**
 * Ventana de la prensa de la busqueda, la misma que `ventana_prensa_dias` de
 * config/consultas.json: seis meses, porque el cliente los pidio el 18 de
 * septiembre de 2026 y Google acepta `when:180d` pero no `when:6m`. Un
 * titular no es texto de conversacion y no lo ata la retencion de 30 dias.
 */
export const VENTANA_PRENSA_DIAS = 180;

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
