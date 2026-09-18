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
export const VERSION_ANALISIS_PUBLICACION = "1";

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

/** Version de la lectura de conjunto, independiente de la de una publicacion. */
export const VERSION_ANALISIS_CONVERSACION = "1";

/**
 * «De que se habla»: lo que se repite en los comentarios de TODAS las
 * publicaciones que el lector tiene delante, no de una.
 *
 * Es la unica pieza del producto que mira varias publicaciones a la vez, asi
 * que las salvedades pesan mas, no menos: son los comentarios MAS VOTADOS de
 * las publicaciones destacadas de una ventana de 24 horas —del orden del 6% de
 * los que las plataformas reportan— y no una muestra de ninguna ciudad. Por eso
 * `leidos`, `publicaciones` y `reportados` los cuenta el codigo y se pintan al
 * lado, nunca divididos.
 */
export interface LecturaConversacion {
  /** Los hilos que se repiten, en prosa. Sin conteos por tema: un conteo que
   *  el modelo inventa no lo puede verificar nadie. */
  lectura: string;
  salvedad: string;
}

export interface AnalisisConversacion extends LecturaConversacion {
  /** Comentarios cuyo texto se mando al modelo. */
  leidos: number;
  /** Publicaciones de la seleccion. */
  publicaciones: number;
  /**
   * De cuantas de ellas salio texto de verdad.
   *
   * Va aparte y se pinta aparte: casi nunca coinciden —el archivo de texto solo
   * trae los mas votados de algunas— y decir «15 comentarios en 30 publicaciones» sugiere
   * que se leyo algo de las treinta. El hueco se rotula, no se disimula.
   */
  publicacionesConTexto: number;
  /** Lo que las plataformas dicen tener en esas mismas publicaciones. */
  reportados: number;
}
