// De donde salen los JSON. Es la unica costura: mover los datos a otro host
// es cambiar esta variable y redesplegar.
//
// OJO con NEXT_PUBLIC_*: se INCRUSTA en el bundle del cliente al construir,
// no se lee en tiempo de ejecucion. Por eso aqui nunca puede ir un token,
// seria publico. Y por eso cambiar de host necesita un redespliegue, no solo
// una variable.

const BASE = (process.env.NEXT_PUBLIC_DATOS_URL ?? "/data").replace(/\/+$/, "");

export const RUTAS = {
  comunicados: `${BASE}/comunicados.json`,
  estado: `${BASE}/estado.json`,
  fuentes: `${BASE}/fuentes.json`,
  notas: `${BASE}/notas.json`,
  temas: `${BASE}/temas.json`,
  indicadores: `${BASE}/indicadores.json`,
  roster: `${BASE}/roster.json`,
  archivoIndice: `${BASE}/archivo/indice.json`,
  redes: `${BASE}/redes.json`,
  // Fuera de git, aunque salga de data/ como el resto (ver .gitignore, que lo
  // excluye por nombre). Puede no existir en un despliegue desde git puro; el
  // panel de redes lo dice en vez de fallar.
  redesComentarios: `${BASE}/redes-comentarios.json`,
  // TikTok: mismo contrato que redes.json, mismo par de archivos.
  tiktok: `${BASE}/tiktok.json`,
  tiktokComentarios: `${BASE}/tiktok-comentarios.json`,
  // YouTube: Shorts y videos largos por feed publico. Mismo contrato que
  // redes.json pero SIN par de texto: este modulo no cosecha comentarios, y
  // el documento lo dice con `cosecha_comentarios: false`.
  youtube: `${BASE}/youtube.json`,
  // X: el ranking de tendencias por ubicacion, sin tuits ni identidad. Lo
  // escribe `pulso tendencias`; un solo archivo, sin par de texto.
  tendencias: `${BASE}/tendencias.json`,
  gastoElectoral: `${BASE}/gasto-electoral.json`,
  financiamientoPartidos: `${BASE}/financiamiento-partidos.json`,
} as const;

/** Un mes del archivo, que solo se pide cuando alguien lo pide. */
export const rutaMes = (mes: string) => `${BASE}/archivo/notas-${mes}.json`;

// Aqui vivia MISMO_ORIGEN, que decidia si el preload llevaba crossorigin.
// Se fue porque la respuesta no depende del origen: el preload lo lleva
// SIEMPRE, o el modo de credenciales no empareja con el del fetch que lo
// consume y el navegador tira la descarga. El razonamiento completo esta
// donde se toma la decision, en app/layout.tsx.
