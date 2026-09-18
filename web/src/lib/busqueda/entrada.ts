import { esEdicion, type Entrada } from "./capitulos";
import { esRubro, type Rubro } from "./rubros";
import { ruta } from "@/lib/dominio/secciones";
import { ZONAS_RUTA, type ZonaRuta } from "@/lib/dominio/zonas";

/**
 * Por donde empieza el recorrido, repartido entre la ruta y la query.
 *
 * Los dos ejes no son un capricho: un municipio ES un lugar y ya tenia
 * segmento —`/tecate` significaba «el tablero de Tecate» mucho antes de que la
 * portada fuera el recorrido—, mientras que Mexico e Internacional no son
 * lugares del producto y meterlos en `[zona]` los acreditaria como tales.
 * Viven en `?e=`, igual que el alcance del muro vive en `?a=`
 * (lib/muro/filtro-ambito.ts).
 *
 * El intento anterior fue hacerlos enlaces a `/` y guardar la eleccion en una
 * variable de modulo. No funciona, y falla callado: navegar a la ruta en la que
 * ya estas no remonta el arbol, asi que `congelados` de use-capitulos.ts nunca
 * se reconstruye y se ven los capitulos de la region bajo la etiqueta «Mexico».
 * Con un parametro el valor cambia en el render, cambia la llave del recorrido
 * y las listas se descongelan, que es lo que ya hacia cambiar de zona.
 *
 * Ademas es compartible y sobrevive a una recarga, que es exactamente lo que
 * secciones.ts dice que la rejilla de rutas existe para no perder.
 */
export const PARAM_EDICION = "e";

/** La consulta de la busqueda del lector. Se lee en el servidor, como `?e=`,
 *  y por la misma razon: ver el docstring de paginas/en-tendencia.tsx. */
export const PARAM_CONSULTA = "q";

/**
 * El rubro por el que empieza el recorrido.
 *
 * Se llama `t` porque asi se llama YA en /api/actualidad, y dos nombres para lo
 * mismo es como se desincronizan las cosas. Es ORTOGONAL al lugar: `?e=` elige
 * entre lugar y edicion —por eso una zona no lo lee, ahi manda el segmento—
 * mientras que un rubro acota cualquiera de los dos, asi que `/tijuana?t=clima`
 * si significa algo y se lee en las dos rutas.
 */
export const PARAM_RUBRO = "t";

/** `capitulos.ts::esEdicion` acota un `Entrada` que ya es valido; lo que llega
 *  de la URL es una cadena cualquiera y necesita su propia guarda. */
const esEdicionCruda = (s: string | null): s is "mexico" | "internacional" =>
  s === "mexico" || s === "internacional";

/**
 * La entrada de una pagina. La ZONA MANDA: `/tijuana?e=mexico` muestra
 * Tijuana, porque el segmento es el eje de lugar y la query solo existe
 * cuando no hay lugar. Un valor inventado cae en la region, sin dejar la barra
 * en un estado que no existe.
 */
export function entradaDe(zona: ZonaRuta | null, crudo: string | null): Entrada {
  if (zona !== null) return zona;
  return esEdicionCruda(crudo) ? crudo : "region";
}

/** El rubro de una pagina, o null por «Todo». Un valor inventado cae en null
 *  por la misma razon que `entradaDe`: un enlace viejo o mal escrito muestra la
 *  cadena completa, no una pestana marcada que no existe. */
export function rubroDe(crudo: string | null): Rubro | null {
  return esRubro(crudo) ? crudo : null;
}

/**
 * A donde lleva elegir una entrada, o un rubro, en el lector.
 *
 * Los dos parametros viajan juntos porque los dos controles conservan lo que el
 * otro eligio: cambiar de lugar no tira el tema y cambiar de tema no tira el
 * lugar. `URLSearchParams` y no concatenacion, que es lo que hace que
 * `/?e=mexico&t=seguridad` salga bien sin contar interrogaciones a mano.
 */
export function rutaDeEntrada(entrada: Entrada, rubro: Rubro | null = null): string {
  const base = esEdicion(entrada) || entrada === "region" ? ruta(null, null) : ruta(entrada, null);
  const params = new URLSearchParams();
  if (esEdicion(entrada)) params.set(PARAM_EDICION, entrada);
  if (rubro !== null) params.set(PARAM_RUBRO, rubro);
  const cola = params.toString();
  return cola === "" ? base : `${base}?${cola}`;
}

/** El corredor, las ocho zonas y las dos ediciones, en ese orden. */
export const ENTRADAS: readonly Entrada[] = ["region", ...ZONAS_RUTA, "mexico", "internacional"];
