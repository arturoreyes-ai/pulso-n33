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

/** Version del resumen de TikTok, independiente de la de una publicacion. */
export const VERSION_RESUMEN_TIKTOK = "1";

/** Debajo de esto no hay asuntos que agrupar: hay tres pies repetidos con
 *  otras palabras. Rosarito tenia tres videos el 20 de septiembre de 2026.
 *  Vive aqui y no en resumen-tiktok.ts porque la tarjeta decide con el si se
 *  pinta, y aquel modulo arrastra `node:fs` por datos-redes.ts. */
export const MINIMO_VIDEOS_RESUMEN = 5;

/**
 * «Resumen con IA»: de que hablan los videos de TikTok mas vistos de una
 * seleccion, agrupado por asunto y con la fuente de cada punto.
 *
 * Es la forma del resumen que TikTok pinta sobre su propia busqueda y que el
 * cliente mostro el 23 de septiembre de 2026. Ese resumen NO se puede traer: el
 * actor no lo devuelve, vive en la pagina de busqueda de la app, y publicarlo
 * seria publicar lo que el modelo de otra empresa resumio de cuerpos de notas.
 * Este lo escribe un modelo sobre la primera linea del pie de cada video, que
 * es lo que la tarjeta ya muestra, y nada mas.
 *
 * `fuentes` de cada punto son indices en `fuentes` de la respuesta, y los
 * resuelve EL SERVIDOR. El modelo solo cita numeros de la lista que recibio; un
 * numero que no existe se tira, y un punto que se queda sin fuente se tira
 * entero: una afirmacion que no se puede rastrear a un video no se pinta.
 */
export interface PuntoResumen {
  texto: string;
  fuentes: number[];
}

export interface SeccionResumen {
  titulo: string;
  puntos: PuntoResumen[];
}

export interface LecturaResumen {
  /** Una o dos frases: de que tratan, en conjunto. */
  entrada: string;
  secciones: SeccionResumen[];
  /** Que NO establece el material. La salvedad de muestreo es de la pagina. */
  salvedad: string;
}

export interface ResumenTikTok extends LecturaResumen {
  /** Los videos citados, en el orden en que se le dieron al modelo (del mas
   *  popular al menos). `url` es la canonica de `canonizarPublicacion`, la
   *  misma llave con la que el visor arma `clave`. */
  fuentes: { url: string; fuente: string }[];
  /** Videos de la seleccion que el modelo leyo. Lo cuenta el codigo. */
  videos: number;
}
