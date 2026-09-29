/**
 * Lo que /api/seguimiento contesta. Tipos nada mas, sin nada de servidor, para
 * que la pagina los importe sin arrastrar el cliente de Apify ni la base.
 *
 * Tres reglas de PRODUCT.md viven en la FORMA, no en un comentario:
 *
 *  - Un hueco es `null`, nunca 0. Instagram no publica compartidos, una cuenta
 *    puede ocultar sus likes, una lectura puede fallar: cada uno sale `null` y
 *    la pantalla dice «sin dato».
 *  - El tono se cuenta, no se promedia: `ConteoTono` son cuatro cubetas que
 *    suman el total, y la pantalla no saca porcentajes de ellas (una
 *    publicacion rara vez pasa de 30 comentarios con palabras).
 *  - El tono se muestra tambien cuando el titulo nombra a una figura del
 *    roster: es la excepcion a la regla 5 que el cliente decidio para esta
 *    pagina el 29 de septiembre de 2026, con su salvedad fija en pantalla
 *    (docs/PLAN.md). Hasta ese dia viajaba `tono.mostrado` en false y la
 *    tarjeta decia «Sin dato» en la publicacion del informe de Burgueño.
 */

export type RedSeguida = "instagram" | "tiktok" | "facebook";
export const REDES_SEGUIDAS: readonly RedSeguida[] = ["instagram", "tiktok", "facebook"];

export type IdiomaSeguido = "es" | "en";

export type TonoComentario = "positivo" | "negativo" | "neutral";

export interface ConteoTono {
  positivo: number;
  negativo: number;
  neutral: number;
  /** Lo que no se pudo leer: en ingles, o el servicio no respondio. */
  sinTono: number;
}

/** Lo que la red decia en ese momento. `null` es «sin dato». */
export interface Metricas {
  likes: number | null;
  comentarios: number | null;
  reproducciones: number | null;
  compartidos: number | null;
  guardados: number | null;
}

export interface PublicacionSeguida {
  id: string;
  red: RedSeguida;
  url: string;
  idioma: IdiomaSeguido;
  /** La primera linea del pie; null hasta la primera lectura. */
  titulo: string | null;
  /** Solo TikTok. */
  creador: string | null;
  publicado: string | null;
  tipo: "imagen" | "video" | "carrusel" | "otro" | null;
  creado: string;
}

export type EstadoActualizacion = "leyendo" | "listo" | "fallo";

export interface Actualizacion {
  id: string;
  fecha: string;
  estado: EstadoActualizacion;
  metricas: Metricas | null;
  leidos: number | null;
  nuevos: number | null;
  /** null: no hubo lectura de tono (fallo, o una lectura de antes del 29 de
   *  septiembre de 2026 sobre una publicacion que nombra a una figura). */
  tono: ConteoTono | null;
}

export interface ComentarioSeguido {
  /** Solo para la llave de React; no identifica a nadie. */
  huella: string;
  texto: string;
  /** Cuando se escribio, segun la red. */
  escrito: string | null;
  /** Llego con la ultima lectura y no estaba antes. */
  nuevo: boolean;
  sentimiento: TonoComentario | null;
}

export interface ResumenSeguimiento extends PublicacionSeguida {
  /** La ultima lectura terminada, o null si nunca se leyo. */
  ultima: { fecha: string; metricas: Metricas | null } | null;
  enCurso: boolean;
  /** Los comentarios guardados ahora (dentro de los 15 dias). */
  comentarios: number;
}

export interface RespuestaListaSeguimiento {
  disponible: boolean;
  publicaciones: ResumenSeguimiento[];
}

export interface RespuestaSeguimiento {
  disponible: boolean;
  publicacion: PublicacionSeguida;
  enCurso: boolean;
  /** La mas reciente primero. */
  actualizaciones: Actualizacion[];
  /** Los mas recientes primero, todos los que siguen dentro de la retencion. */
  comentarios: ComentarioSeguido[];
  tono: { conteo: ConteoTono };
  /** «Lo que dicen los comentarios» de la ultima lectura, o null. */
  resumen: { texto: string; leidos: number; fecha: string } | null;
  /** Sin resumen, si se puede pedir uno: la lectura automatica encendida y al
   *  menos diez comentarios guardados. La pagina pinta el boton con esto. */
  resumible: boolean;
  retencionDias: number;
  /** Desde cuando se puede volver a actualizar, si la ultima lectura es de
   *  hace muy poco; null si ya se puede. Lo decide el servidor, que es quien
   *  lo hace cumplir. */
  proxima: string | null;
}

export type CodigoErrorSeguimiento =
  | "apagado"
  | "url"
  | "no_existe"
  | "limite_dia"
  | "limite_mes"
  | "reciente"
  | "pocos"
  | "no_disponible";

export interface ErrorSeguimiento {
  codigo: CodigoErrorSeguimiento;
  mensaje: string;
}
