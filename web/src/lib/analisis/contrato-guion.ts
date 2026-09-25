/**
 * El guion para locucion: lo que un conductor del canal dice al aire, por
 * programa, sobre el material del dia. Contrato propio desde el 25 de
 * septiembre de 2026, cuando dejo de ser solo de TikTok: vivio un dia dentro
 * de contrato-publicacion.ts, y un guion sobre titulares de prensa no es una
 * publicacion.
 *
 * DOS ORIGENES, un solo guion. `tiktok` escribe sobre la primera linea del pie
 * de los videos cosechados (lib/analisis/guion-tiktok.ts) y cada pieza es un
 * CLIP que el equipo extrae; `prensa` escribe sobre los titulares en vivo de la
 * portada (lib/analisis/guion-prensa.ts) y cada pieza es una NOTA LEIDA, sin
 * clip: el conductor la lee a camara. Por eso `pase` es null en prensa, y no
 * una frase de relleno: no hay a que darle paso.
 */

/** Separa copias en el CDN y en SWR. 3 desde el 25 de septiembre de 2026:
 *  `origen`, `pregunta`, `sinLeer` y `leidos` cambiaron la forma. 4 el mismo
 *  dia: el guion ya no cita medios ni cuentas, garitas ya no es una pieza del
 *  modelo, y cada pieza trae `ampliable`; la copia de la hora anterior decia
 *  todo eso al reves. */
export const VERSION_GUION = "4";

export const ORIGENES_GUION = ["tiktok", "prensa"] as const;
export type OrigenGuion = (typeof ORIGENES_GUION)[number];

/**
 * Los programas que tienen guion, en el orden de la programacion que mando el
 * cliente.
 *
 *  - Noticias 33 (24 de septiembre de 2026): exactamente cinco piezas, una por
 *    eje (garitas, informacion de Tijuana, la mañanera de la presidenta,
 *    informacion de California) y la quinta libre. Desde el 25 la de garitas
 *    no la escribe el modelo: la arma la tarjeta con /api/garitas
 *    (lib/analisis/nota-garitas.ts), y en TikTok es una nota leida, no un clip.
 *  - De Red en Red (el mismo dia): una pieza por cada tema de espectaculos.
 *  - Minuta Politica (25 de septiembre de 2026): analisis politico en vivo,
 *    coyuntura local y nacional, casos controversiales y debate. Cada tema
 *    cierra con una pregunta para la mesa.
 *  - Estado de Alerta (el mismo dia): nota roja nocturna, sucesos policiacos,
 *    seguridad y hechos de impacto.
 */
export const PROGRAMAS_GUION = ["noticias33", "deredenred", "minutapolitica", "estadodealerta"] as const;
export type ProgramaGuion = (typeof PROGRAMAS_GUION)[number];

export const NOMBRE_PROGRAMA: Record<ProgramaGuion, string> = {
  noticias33: "Noticias 33",
  deredenred: "De Red en Red",
  minutapolitica: "Minuta Política",
  estadodealerta: "Estado de Alerta",
};

export const EJES_NOTICIAS33 = ["garitas", "tijuana", "mananera", "california"] as const;
export type EjeNoticias33 = (typeof EJES_NOTICIAS33)[number];

export const NOMBRE_EJE: Record<EjeNoticias33, string> = {
  garitas: "Garitas",
  tijuana: "Información de Tijuana",
  mananera: "Mañanera de la presidenta",
  california: "Información de California",
};

/** La coyuntura de Minuta Politica: la del corredor y el estado, y la del
 *  pais. Lo internacional no entra: el cliente pidio «local y nacional». */
export const EJES_MINUTA = ["local", "nacional"] as const;
export type EjeMinuta = (typeof EJES_MINUTA)[number];

export const NOMBRE_EJE_MINUTA: Record<EjeMinuta, string> = {
  local: "Coyuntura local",
  nacional: "Coyuntura nacional",
};

/**
 * Una pieza: el video que se extrae, o el titular que se lee, y lo que el
 * conductor dice sobre el.
 *
 * `eje` es el nombre impreso: un eje de Noticias 33, el tema que el modelo
 * nombro en De Red en Red y Estado de Alerta, o «Coyuntura local · <tema>» en
 * Minuta Politica. `fuente` la resuelve EL SERVIDOR desde el numero que el
 * modelo cito; una pieza que cita algo fuera de la lista de su eje no llega
 * aqui.
 */
export interface ClipGuion {
  eje: string;
  /** La quinta pieza de Noticias 33, fuera de la regla de uno por eje. */
  libre: boolean;
  /** Para la escaleta, no se dice. */
  titular: string;
  /** Lo que el conductor dice a camara: antes del clip, o la nota entera. */
  entrada: string;
  /** La frase que da paso al clip. No describe el video. Null en prensa:
   *  una nota leida no tiene clip al que darle paso. */
  pase: string | null;
  /** Lo que dice DESPUES: remata o enlaza con la pieza siguiente. */
  salida: string;
  /** Solo Minuta Politica: la pregunta abierta que el conductor lanza a la
   *  mesa. Null en los demas programas. */
  pregunta: string | null;
  /** En prensa, `url` es el enlace del propio medio cuando el archivo lo
   *  conoce y el de la fila en vivo si no; `fuente`, el nombre del medio. La
   *  nota de garitas es nuestra: `url` es la ruta de /garitas, relativa, y
   *  `fuente` «Garitas». No se dice al aire en ningun caso. */
  fuente: { url: string; fuente: string };
  /** Prensa: con que se abre la nota entera para «Ampliar»
   *  (lib/analisis/ampliar.ts): el enlace verificable, el dominio del medio y
   *  el titular original, que no es `titular` (ese es de la escaleta). Null en
   *  TikTok, en la nota de garitas y en una fila sin enlace verificable. */
  ampliable: { url: string; dominio: string; titulo: string } | null;
}

/** La respuesta de /api/ampliar-nota: la nota reescrita con la nota entera, y
 *  nada del texto leido. */
export interface NotaAmpliada {
  entrada: string;
}

/**
 * Un guion de verdad y no un resumen, desde la segunda version del 24 de
 * septiembre de 2026: la primera traia un titular y dos frases por clip, y
 * el cliente dijo con razon que eso es un resumen. Un guion de locucion abre
 * el segmento, entra a cada pieza, sale de ella y cierra.
 */
export interface Guion {
  origen: OrigenGuion;
  programa: ProgramaGuion;
  /** Con lo que el conductor abre el segmento. */
  apertura: string;
  clips: ClipGuion[];
  /** Con lo que lo cierra. */
  cierre: string;
  /** Ejes sin una sola pieza en la ventana. Lo cuenta el codigo, no el
   *  modelo, y se dice: un eje vacio no se rellena con otro. */
  faltantes: string[];
  /** Ejes que no se pudieron LEER: en prensa, todos sus feeds fallaron. No es
   *  «sin notas hoy», que seria afirmar un hueco que nadie midio (la regla 4
   *  al reves). En TikTok siempre vacio: el archivo se lee entero o no. */
  sinLeer: string[];
  /** Piezas que el modelo leyo. */
  leidos: number;
}
