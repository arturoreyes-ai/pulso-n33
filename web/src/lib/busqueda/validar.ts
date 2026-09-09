/**
 * Validacion de la consulta que llega a /api/buscar.
 *
 * La lista blanca de caracteres es defensa en profundidad, NO la frontera de
 * seguridad: lo que impide que "&hl=en-US" se cuele como parametro del feed es
 * construir la URL con URLSearchParams (ver google-noticias.ts::urlDeFeed).
 * Aqui solo se corta lo que no tiene por que venir de una caja de busqueda:
 * saltos de linea, controles, y los signos que delatan un pegado raro.
 */

import { LARGO_MAXIMO_CONSULTA, type ErrorBusqueda } from "./tipos";

/**
 * Letras, marcas, numeros y la puntuacion que de verdad se escribe al buscar.
 * Los operadores de Google (site:, comillas, OR) pasan a proposito: el
 * encargo fue "completely unfiltered".
 */
const PERMITIDO = /^[\p{L}\p{M}\p{N} .,:;'"#&()\-_/]+$/u;

export type Veredicto =
  | { ok: true; q: string }
  | { ok: false; error: ErrorBusqueda };

export function validarConsulta(cruda: string | null): Veredicto {
  const q = (cruda ?? "").trim();
  if (q === "") {
    // El cliente no consulta con menos de MINIMO_CONSULTA, asi que una
    // consulta vacia es uso indebido y conviene que se vea. Una consulta
    // valida sin resultados es 200 con lista vacia: son casos distintos.
    return { ok: false, error: { codigo: "vacia", mensaje: "Falta la consulta." } };
  }
  if (q.length > LARGO_MAXIMO_CONSULTA) {
    return {
      ok: false,
      error: {
        codigo: "larga",
        mensaje: `La consulta pasa de ${LARGO_MAXIMO_CONSULTA} caracteres.`,
      },
    };
  }
  if (!PERMITIDO.test(q)) {
    return {
      ok: false,
      error: { codigo: "invalida", mensaje: "La consulta trae caracteres que no se aceptan." },
    };
  }
  return { ok: true, q };
}
