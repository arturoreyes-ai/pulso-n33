// De donde salen los JSON. Es la unica costura: mover los datos a otro host
// es cambiar esta variable y redesplegar.
//
// OJO con NEXT_PUBLIC_*: se INCRUSTA en el bundle del cliente al construir,
// no se lee en tiempo de ejecucion. Por eso aqui nunca puede ir un token,
// seria publico. Y por eso cambiar de host necesita un redespliegue, no solo
// una variable.

const BASE = (process.env.NEXT_PUBLIC_DATOS_URL ?? "/data").replace(/\/+$/, "");

export const RUTAS = {
  estado: `${BASE}/estado.json`,
  fuentes: `${BASE}/fuentes.json`,
  notas: `${BASE}/notas.json`,
  temas: `${BASE}/temas.json`,
  conversacion: `${BASE}/conversacion.json`,
  indicadores: `${BASE}/indicadores.json`,
  roster: `${BASE}/roster.json`,
  archivoIndice: `${BASE}/archivo/indice.json`,
} as const;

/** Un mes del archivo, que solo se pide cuando alguien lo pide. */
export const rutaMes = (mes: string) => `${BASE}/archivo/notas-${mes}.json`;

/**
 * Si los JSON son del mismo origen. Decide si el preload necesita
 * crossorigin: si el modo CORS del preload no coincide con el del fetch que
 * lo consume, el navegador descarta la descarga y la hace dos veces.
 */
export const MISMO_ORIGEN = BASE.startsWith("/");
