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
 *
 * Y un tercero el mismo dia, `redes`: el de TikTok con Instagram, Facebook y lo
 * muy visto de YouTube (lib/analisis/guion-redes.ts), el que abre el boton de
 * la barra de /redes. Sus piezas son clips, como en TikTok.
 *
 * Y `mixto` desde el 28 de septiembre de 2026, el unico que la pantalla pide
 * (lib/analisis/guion-mixto.ts): lo mas popular de las cuatro redes con los
 * titulares que cuentan lo mismo, en un solo guion. Una pieza es un clip con
 * su nota de prensa (`nota`), una nota leida sola, o un clip sin nota.
 */

/** Separa copias en el CDN y en SWR. 3 desde el 25 de septiembre de 2026:
 *  `origen`, `pregunta`, `sinLeer` y `leidos` cambiaron la forma. 4 el mismo
 *  dia: el guion ya no cita medios ni cuentas, garitas ya no es una pieza del
 *  modelo, y cada pieza trae `ampliable`; la copia de la hora anterior decia
 *  todo eso al reves. 5 el 28 de septiembre: cada pieza trae `nota`. */
export const VERSION_GUION = "5";

export const ORIGENES_GUION = ["tiktok", "prensa", "redes", "mixto"] as const;
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
 *  - Deportes (30 de septiembre de 2026): lo mas popular y comentado del
 *    deporte en Baja California, Mexico y el mundo, con los clips de redes al
 *    centro como De Red en Red y Estado de Alerta.
 */
export const PROGRAMAS_GUION = ["noticias33", "deredenred", "deportes", "minutapolitica", "estadodealerta"] as const;
export type ProgramaGuion = (typeof PROGRAMAS_GUION)[number];

export const NOMBRE_PROGRAMA: Record<ProgramaGuion, string> = {
  noticias33: "Noticias 33",
  deredenred: "De Red en Red",
  deportes: "Deportes",
  minutapolitica: "Minuta Política",
  estadodealerta: "Estado de Alerta",
};

/** Temas por guion, en los programas que se arman por tema. Aqui y no en
 *  guion.ts (que lo reexporta) porque /guion lo dice en pantalla, y el cliente
 *  no debe cargar el prompt para leer un numero. */
export const MAXIMO_TEMAS: Record<Exclude<ProgramaGuion, "noticias33">, number> = {
  deredenred: 6,
  deportes: 6,
  // Un programa de debate desarrolla pocos temas y los desarrolla con la mesa.
  minutapolitica: 4,
  estadodealerta: 6,
};

/** Lo que trae cada guion, en una linea, para elegir en /guion. Dice la forma
 *  que guion.ts exige a cada programa: los maximos salen de MAXIMO_TEMAS, y
 *  las cinco de Noticias 33 son sus cuatro ejes mas la libre, en letra porque
 *  un lector de pantalla junta el nombre y la linea: «Noticias 33 5 notas». */
export const DESCRIPCION_PROGRAMA: Record<ProgramaGuion, string> = {
  noticias33: "Cinco notas: garitas, Tijuana, la mañanera, California y una libre.",
  deredenred: `Farándula, conciertos y estrenos de México y Baja, y lo más comentado de fuera; hasta ${MAXIMO_TEMAS.deredenred} temas.`,
  deportes: `Lo más comentado del deporte en la región, México y el mundo, hasta ${MAXIMO_TEMAS.deportes} temas.`,
  minutapolitica: `Política local y nacional, hasta ${MAXIMO_TEMAS.minutapolitica} temas, cada uno con una pregunta para la mesa.`,
  estadodealerta: `Nota roja local, de noche, hasta ${MAXIMO_TEMAS.estadodealerta} sucesos.`,
};

/** De que sale el guion, en una linea, bajo el titulo de /guion. Aqui y no en
 *  el panel porque la cabecera es de servidor (app/guion/page.tsx). */
export const MATERIAL_GUION = "Lo escribe una IA con lo más popular de TikTok, Instagram, Facebook y YouTube y los titulares de prensa que cuentan lo mismo, de las últimas 24 horas.";

/**
 * Que el guion lo escribio un modelo, dicho donde el equipo lo va a ver
 * (cliente, 28 de septiembre de 2026): arriba del guion en pantalla, en el
 * texto copiado y bajo el titulo del Word. Hasta ese dia solo lo decia una
 * linea gris al pie de la pantalla y del subtitulo del Word, y el texto
 * copiado no lo decia en ninguna parte: pegado en un chat del equipo, un
 * guion escrito por un modelo se leia como escrito por una persona.
 */
export const ROTULO_IA = "Generado con IA";
export const CONSEJO_IA = "Revísalo antes de salir al aire: puede equivocarse.";

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

/** Los dos alcances de De Red en Red (cliente, 30 de septiembre de 2026): la
 *  farandula que se mueve en Mexico y Baja, y UNA pieza de fuera, la mas
 *  comentada del dia (guion.ts::MAXIMO_POR_EJE). */
export const EJES_REDENRED = ["mexico", "internacional"] as const;
export type EjeRedEnRed = (typeof EJES_REDENRED)[number];

export const NOMBRE_EJE_REDENRED: Record<EjeRedEnRed, string> = {
  mexico: "México y Baja",
  internacional: "Internacional",
};

/** Los tres alcances de Deportes, con los nombres de las cubetas del sitio
 *  (Region / Mexico / Internacional). La region es el corredor: Baja
 *  California y San Diego, asi que los Padres son de aqui. */
export const EJES_DEPORTES = ["region", "mexico", "internacional"] as const;
export type EjeDeportes = (typeof EJES_DEPORTES)[number];

export const NOMBRE_EJE_DEPORTES: Record<EjeDeportes, string> = {
  region: "Región",
  mexico: "México",
  internacional: "Internacional",
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
   *  TikTok, en la nota de garitas y en una fila sin enlace verificable. En
   *  `mixto`, el del titular que acompana al clip, si lo hay. */
  ampliable: { url: string; dominio: string; titulo: string } | null;
  /** Solo `mixto`: el titular que cuenta el mismo hecho que el clip, con el
   *  que se dijo la entrada; `fuente` es el medio, para el equipo, y no se
   *  dice. Null en un clip sin nota de prensa, en una nota leida (su titular
   *  es `fuente`) y en los otros origenes. */
  nota: { url: string; fuente: string } | null;
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
  /** Solo `redes` y `mixto`: hasta cuando llegan las publicaciones, la
   *  cosecha mas vieja de las redes leidas (ISO), o null si no se leyo
   *  ninguna. Ausente en los demas origenes y en un guion guardado antes del
   *  28 de septiembre de 2026. */
  hasta?: string | null;
}
