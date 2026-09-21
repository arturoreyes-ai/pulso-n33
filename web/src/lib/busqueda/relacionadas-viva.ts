import { archivoPublicado, type LeerArchivo } from "./archivo";
import { recortar, relacionadasPara } from "./relacionadas";
import { CACHE_ARCHIVO, SIN_CACHE, json } from "./respuesta";
import { TOPE_RELACIONADAS, type ErrorRelacionadas, type RespuestaRelacionadas } from "./tipos";

/**
 * Notas del archivo que hablan de lo mismo que un titular en vivo.
 *
 * Hermano de imagen-viva.ts: `relacionadas.ts` es la funcion pura y esto es
 * quien la contesta. Vive aparte de la ruta para que scripts/probar-busqueda.
 * cjs lo pruebe sin disco, inyectando `leerArchivo`, igual que `solicitar` en
 * actualidad.ts.
 *
 * POR QUE UNA RUTA PROPIA Y NO UN CAMPO MAS EN /api/actualidad, que era la
 * forma obvia:
 *
 *  1. El capitulo de comunicados de Tecate NO pasa por /api/actualidad. Sale
 *     del documento municipal y lo adapta use-capitulos.ts en el cliente, asi
 *     que un campo colgado de la respuesta en vivo dejaria ese capitulo —y
 *     solo ese— sin el chip, en silencio. Una ruta aparte sirve igual a los
 *     tres tipos de tarjeta.
 *  2. La cadena encadena hasta nueve capitulos de quince filas. Adjuntar seis
 *     relacionadas a cada una serian ~135 listas por lector para las pocas
 *     hojas que alguien abre. Aqui se pide al pulsar el chip.
 *
 * SE CACHEA LARGO a proposito: la respuesta es funcion del titular y del
 * corpus del despliegue, y el corpus no cambia hasta el siguiente. No es como
 * las filas en vivo, que envejecen en minutos.
 */

/** Un titular, no una consulta: no hay minimo de tres letras ni terminos de
 *  lugar que componer. El tope solo descarta un pegado accidental. */
const LARGO_MAXIMO_TITULO = 300;

export interface ConsultaRelacionadas {
  t: string | null;
}

export async function responderRelacionadas(
  consulta: ConsultaRelacionadas,
  leerArchivo: LeerArchivo = archivoPublicado,
): Promise<Response> {
  const titulo = (consulta.t ?? "").trim();
  if (titulo === "" || titulo.length > LARGO_MAXIMO_TITULO) {
    const error: ErrorRelacionadas = {
      codigo: "titulo",
      mensaje: "Falta el titular o es demasiado largo.",
    };
    return json(error, 400, SIN_CACHE);
  }

  const indices = await leerArchivo();
  if (indices === null) {
    // NO se contesta con una lista vacia. Vacio significa «no hay notas
    // anteriores sobre esto», y la hoja lo dice nombrando que la cobertura no
    // es pareja en el corredor. Decir eso cuando lo cierto es que no se pudo
    // mirar el archivo afirma un hueco que nadie midio, que es la regla 4 de
    // PRODUCT.md al reves. El caso real que lo produce: notas.json fuera de
    // `outputFileTracingIncludes`, que falla solo en produccion.
    const error: ErrorRelacionadas = {
      codigo: "datos",
      mensaje: "No se pudieron consultar las notas anteriores.",
    };
    return json(error, 503, SIN_CACHE);
  }

  const cuerpo: RespuestaRelacionadas = {
    relacionadas: recortar(
      relacionadasPara(titulo, indices.relacionadas, TOPE_RELACIONADAS),
    ),
  };
  return json(cuerpo, 200, CACHE_ARCHIVO);
}
