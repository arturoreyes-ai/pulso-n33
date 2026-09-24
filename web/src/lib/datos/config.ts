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
  // Sigue publicandose y sigue siendo la salida del pipeline, pero el
  // NAVEGADOR ya no lo pide: son 917 KB comprimidos y lo que hacia falta de el
  // se resuelve en el servidor (lib/busqueda/archivo.ts), que lo lee del disco
  // por nombre y no por esta tabla. Volver a colgarle un hook es deshacer eso.
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
  // Facebook: las paginas de medios de config/facebook.json (23 de
  // septiembre de 2026). Mismo contrato y mismo par de archivos que redes.json.
  facebook: `${BASE}/facebook.json`,
  facebookComentarios: `${BASE}/facebook-comentarios.json`,
  // X: el ranking de tendencias por ubicacion, sin tuits ni identidad. Lo
  // escribe `pulso tendencias`; un solo archivo, sin par de texto.
  tendencias: `${BASE}/tendencias.json`,
  // Consultas: que se dice de un termino en 30 dias. Lo escribe `pulso
  // consultas` a mano, fuera del cron, asi que puede no existir; la busqueda
  // de Redes lo dice en vez de fallar. Su texto va fuera de git como los
  // otros dos archivos de comentarios.
  consultas: `${BASE}/consultas.json`,
  consultasComentarios: `${BASE}/consultas-comentarios.json`,
  gastoElectoral: `${BASE}/gasto-electoral.json`,
  // El producto se llama «Publicidad Meta» en pantalla y los identificadores lo
  // conservan; los ARCHIVOS se llaman `pauta-meta` y la diferencia es
  // deliberada. Las listas de filtrado en espanol —EasyList Spanish, que uBlock
  // Origin activa sola a quien navega en espanol— bloquean cualquier URL que
  // contenga «publicidad», y lo hacen en el navegador: el servidor responde 200
  // y la peticion nunca sale, con ERR_BLOCKED_BY_CLIENT en la consola. El panel
  // quedaba en «No se pudo cargar Publicidad Meta» sin que nada del lado del
  // servidor fallara, y en produccion le pasaria a cualquier visitante con esas
  // listas, no solo en desarrollo. `pauta` es el termino de medios y no esta en
  // ninguna lista. No renombrar estas dos rutas de vuelta.
  publicidadMeta: `${BASE}/pauta-meta.json`,
  perfilesMeta: `${BASE}/pauta-meta`,
  financiamientoPartidos: `${BASE}/financiamiento-partidos.json`,
} as const;

// Aqui vivia MISMO_ORIGEN, que decidia si el preload llevaba crossorigin.
// Se fue porque la respuesta no depende del origen: el preload lo lleva
// SIEMPRE, o el modo de credenciales no empareja con el del fetch que lo
// consume y el navegador tira la descarga. El razonamiento completo esta
// donde se toma la decision, en app/layout.tsx.
