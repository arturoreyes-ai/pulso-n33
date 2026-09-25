import type { SugerenciaSocial } from "./contrato";

/**
 * La ficha de una PUBLICACION de Instagram o TikTok.
 *
 * Contrato hermano del de prensa (contrato.ts) y no una extension suya, por
 * tres razones que no son de estilo:
 *
 *  - `conversacion` no significa nada sobre una nota, y `medio` no significa
 *    nada sobre un post.
 *  - Los dos validadores son estrictos a proposito. Con campos opcionales
 *    sobre una interfaz compartida, una respuesta de prensa malformada podria
 *    validar como una de publicacion y al reves.
 *  - La pantalla tiene que mantener separado lo que dice la publicacion de lo
 *    que dicen los comentarios. Es la regla 3 de PRODUCT.md en forma de
 *    interfaz: prensa y comentarios lado a lado, nunca fundidos.
 *
 * Lo unico que se reutiliza tal cual es `SugerenciaSocial`. El «que formato
 * conviene para esta publicacion» que pidio el cliente ES el mismo tipo que ya
 * existia para los titulares desde el 17 de septiembre de 2026, con los mismos
 * tres campos, y una sola forma significa un solo renderizador.
 */

/** Version de ESTA ficha, independiente de la de prensa: los dos contratos
 *  cambian por razones distintas y comparten CDN. */
export const VERSION_ANALISIS_PUBLICACION = "2";

export type RedAnalizable = "instagram" | "tiktok";

export interface LecturaPublicacion {
  /** Lo que dice la publicacion: su pie. NUNCA lo que se ve en pantalla —el
   *  modelo no mira el video ni la imagen, y el prompt se lo prohibe. */
  lectura: string;
  /**
   * Que se repite entre los comentarios mas votados, en prosa.
   *
   * `null` cuando no llego ningun texto de comentarios, y lo decide EL
   * SERVIDOR contando lo que mando, nunca el modelo. Si lo decidiera el modelo
   * podria escribir una conversacion sin haber leido un solo comentario, que
   * es exactamente el fallo que este campo existe para impedir.
   *
   * Prosa y no una lista con conteos por tema: un conteo que el modelo inventa
   * es una cifra que nadie puede verificar, y este panel acaba de quitar de la
   * pantalla las cifras que SI se podian verificar. Cuantos comentarios se
   * leyeron va en `leidos`, que lo cuenta el codigo.
   */
  conversacion: string | null;
  /** Que NO se puede saber con esto. */
  salvedad: string;
  sugerenciaSocial: SugerenciaSocial;
}

export interface AnalisisPublicacion extends LecturaPublicacion {
  red: RedAnalizable;
  /** Ya resuelta en el servidor: «@creador» en TikTok, el nombre de la cuenta
   *  en Instagram. La misma que pinta la tarjeta (`fuenteDePublicacion`), para
   *  que dos implementaciones de una etiqueta no diverjan el dia que falte un
   *  `creador`. */
  fuente: string;
  /** Comentarios cuyo texto se leyo. Lo cuenta el codigo, no el modelo. */
  leidos: number;
  /** Los que la plataforma dice tener. Van AL LADO de `leidos`, jamas
   *  divididos: esa division seria un porcentaje sobre menos de treinta
   *  comentarios, que es la regla 2, y mezclaria dos mediciones distintas, que
   *  es la 3. */
  reportados: number;
}

/** Version del guion de TikTok, independiente de la de una publicacion. */
export const VERSION_GUION_TIKTOK = "2";

/**
 * Los programas que tienen guion, desde el 24 de septiembre de 2026. El
 * cliente mando la programacion del canal y las reglas de extraccion de la
 * hora de edicion, y pidio que el «Resumen con IA» de la pestana TikTok
 * pasara a ser eso: un guion que un conductor memoriza y dice.
 *
 *  - Noticias 33: exactamente cinco clips, uno por eje (garitas, informacion
 *    de Tijuana, la mañanera de la presidenta, informacion de California) y
 *    el quinto libre, el de mas interes entre los cuatro ejes.
 *  - De Red en Red: un clip por cada tema de espectaculos que se desarrolle.
 */
export const PROGRAMAS_GUION = ["noticias33", "deredenred"] as const;
export type ProgramaGuion = (typeof PROGRAMAS_GUION)[number];

export const NOMBRE_PROGRAMA: Record<ProgramaGuion, string> = {
  noticias33: "Noticias 33",
  deredenred: "De Red en Red",
};

export const EJES_NOTICIAS33 = ["garitas", "tijuana", "mananera", "california"] as const;
export type EjeNoticias33 = (typeof EJES_NOTICIAS33)[number];

export const NOMBRE_EJE: Record<EjeNoticias33, string> = {
  garitas: "Garitas",
  tijuana: "Información de Tijuana",
  mananera: "Mañanera de la presidenta",
  california: "Información de California",
};

/**
 * Un clip: el video que se extrae y lo que el conductor dice sobre el.
 *
 * `eje` es el nombre impreso: un eje de Noticias 33, o el tema de
 * espectaculos que el modelo nombro en De Red en Red. `fuente` la resuelve EL
 * SERVIDOR desde el numero que el modelo cito; un clip que cita un video que
 * no estaba en la lista de su eje no llega aqui.
 */
export interface ClipGuion {
  eje: string;
  /** El quinto clip de Noticias 33, fuera de la regla de uno por eje. */
  libre: boolean;
  /** Para la escaleta, no se dice. */
  titular: string;
  /** Lo que el conductor dice a camara ANTES del clip. */
  entrada: string;
  /** La frase que da paso al clip. No describe el video. */
  pase: string;
  /** Lo que dice DESPUES del clip: remata o enlaza con el siguiente. */
  salida: string;
  fuente: { url: string; fuente: string };
}

/**
 * Un guion de verdad y no un resumen, desde la segunda version del mismo 24
 * de septiembre de 2026: la primera traia un titular y dos frases por clip, y
 * el cliente dijo con razon que eso es un resumen. Un guion de locucion abre
 * el segmento, entra a cada nota a camara, da paso al clip, sale de el y
 * cierra.
 */
export interface GuionTikTok {
  programa: ProgramaGuion;
  /** Con lo que el conductor abre el segmento. */
  apertura: string;
  clips: ClipGuion[];
  /** Con lo que lo cierra. */
  cierre: string;
  /** Ejes sin un solo video en la ventana. Lo cuenta el codigo, no el
   *  modelo, y se dice: un eje vacio no se rellena con otro. */
  faltantes: string[];
  /** Videos que el modelo leyo. */
  videos: number;
}
