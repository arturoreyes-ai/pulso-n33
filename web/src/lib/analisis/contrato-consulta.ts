/**
 * La lectura automatica de un termino, para el informe en PDF.
 *
 * Aparte de LecturaConversacion (contrato-publicacion.ts) por la misma razon
 * que aquella esta aparte de la de una publicacion: el alcance es otro —los
 * comentarios de TODAS las publicaciones destacadas de un termino en 30 dias,
 * de tres redes— y un contrato compartido acabaria cambiando por el motivo
 * equivocado.
 */
export interface LecturaConsulta {
  /** Que asuntos reaparecen y en que terminos, en prosa. Sin conteos por
   *  tema: un conteo que el modelo inventa no lo puede verificar nadie. */
  lectura: string;
  /** Que NO establece el material. La salvedad de muestreo es de la pagina. */
  salvedad: string;
}
