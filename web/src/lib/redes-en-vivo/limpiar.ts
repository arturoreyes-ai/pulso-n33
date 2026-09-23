import { createHash } from "node:crypto";

import type { ComentarioPublicado, DestacadoConsulta } from "@/lib/datos/tipos";
import { canonizarPublicacion } from "@/lib/dominio/publicaciones";
import type { RedTermino } from "@/lib/dominio/termino-vivo";

/**
 * Lo que se guarda de lo que devuelve Apify, en la busqueda en vivo. Solo
 * servidor.
 *
 * Es la COPIA en TypeScript de los limpiadores del pipeline —
 * pulso/tiktok.py::_limpiar_video y _limpiar_comentario, pulso/instagram.py::
 * _limpiar_post y _limpiar, pulso/facebook.py::_limpiar_post y
 * _limpiar_comentario— y de pulso/redes.py::publicar_comentarios. Dos copias
 * de lo mismo envejecen por separado, y esta regla es de las que no pueden
 * envejecer: la identidad de quien comenta se tira AQUI, antes de que nada
 * salga de la funcion. Por eso las dos copias comparten un fixture
 * (web/scripts/fixtures/redes-en-vivo/) que la prueba de Python
 * (tests/test_redes_en_vivo_paridad.py) y la de Node
 * (scripts/probar-redes-en-vivo.cjs) comparan contra el mismo resultado.
 *
 * Todo es LISTA BLANCA: la salida se arma campo por campo y nunca resta de la
 * entrada. Un campo nuevo del actor —un `ownerUsername` renombrado— no puede
 * colarse porque nada lo copia.
 *
 * Lo que la copia NO hace, a proposito: zonificar. El gacetero vive en
 * Python (pulso/zonas.py) y la busqueda de un termino no lo necesita —un
 * termino no es un lugar, y la ficha no pinta lugar (`lugar={false}`)—, asi
 * que cada publicacion sale `zona: "nacional"` sin `alcance`, igual que
 * `consultas.reunirPublicacionesConsulta` hace con lo agregado a mano.
 *
 * Las longitudes se cuentan en PUNTOS DE CODIGO, como Python: un emoji es un
 * caracter alla y dos aqui si se usa `.length`, y el recorte a 300 dejaria
 * medio emoji.
 */

export const TITULO_MAXIMO = 160;
export const COMENTARIOS_VISIBLES = 5;
export const COMENTARIOS_MAXIMO = 10;
export const TEXTO_MAXIMO = 300;
export const UMBRAL_BRIGADA = 3;
export const MENCION_ENMASCARADA = "@…";

const RE_MENCION = /@[A-Za-z0-9_.]{2,}/g;
const RE_ESCAPE_U = /(?:\\u[0-9a-fA-F]{4})+/g;
const RE_ETIQUETAS_FINALES = /(?:\s+#\S+)+\s*$/u;
/** Los separadores de str.splitlines() de Python. */
const RE_LINEAS = /\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/;

const puntos = (s: string): string[] => Array.from(s);

/** pulso/normalizar.py::fold: minusculas, sin marcas (categoria Mn), espacios
 *  colapsados. `plegar` de formato.ts solo quita el bloque combinante basico;
 *  aqui decide el id de un comentario, asi que se copia exacto. */
export function fold(s: string): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "").replace(/\s+/g, " ").trim();
}

/** pulso/redes.py::_titulo: la primera linea no vacia, recortada. */
export function titulo(pie: string, maximo = TITULO_MAXIMO): string {
  for (const linea of (pie ?? "").split(RE_LINEAS)) {
    const limpio = linea.split(/\s+/).filter(Boolean).join(" ");
    if (limpio !== "") {
      const p = puntos(limpio);
      return p.length > maximo ? p.slice(0, maximo - 1).join("").trimEnd() + "…" : limpio;
    }
  }
  return "";
}

/** pulso/tiktok.py::_desescapar: '🚦' literal a su emoji. Un
 *  sustituto suelto deja la secuencia tal cual. */
export function desescapar(texto: string): string {
  return (texto ?? "").replace(RE_ESCAPE_U, (secuencia) => {
    const unidades = secuencia.split("\\u").filter(Boolean).map((h) => Number.parseInt(h, 16));
    const salida = String.fromCharCode(...unidades);
    const suelto = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
    return suelto.test(salida) ? secuencia : salida;
  });
}

/** pulso/tiktok.py::_quitar_etiquetas_finales. */
export function quitarEtiquetasFinales(texto: string): string {
  const limpio = (texto ?? "").replace(RE_ETIQUETAS_FINALES, "");
  return limpio.replace(/#\S+/gu, "").trim() === "" ? (texto ?? "") : limpio;
}

/** sha256(post|fold(texto)[:400])[:16]: pulso/redes.py::_id_comentario. No
 *  sale de la funcion; solo desempata el orden. */
export function idComentario(post: string, texto: string): string {
  const crudo = `${post}|${puntos(fold(texto)).slice(0, 400).join("")}`;
  return createHash("sha256").update(crudo, "utf8").digest("hex").slice(0, 16);
}

const entero = (x: unknown): number => {
  const n = typeof x === "number" ? x : typeof x === "string" ? Number.parseInt(x, 10) : 0;
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
const cadena = (x: unknown): string => (typeof x === "string" ? x : "");

/** Fecha-hora ISO en UTC sin milisegundos, con `+00:00` como en Python. */
function isoUtc(ms: number): string {
  return new Date(Math.floor(ms / 1000) * 1000).toISOString().replace(".000Z", "+00:00");
}

function desdeIso(crudo: string): string | null {
  const t = crudo.trim();
  if (t === "") return null;
  // Una hora sin zona se toma como UTC, como pulso/instagram.py::_publicado.
  const conZona = /(?:Z|[+-]\d{2}:?\d{2})$/.test(t) ? t : `${t}Z`;
  const ms = Date.parse(conZona);
  return Number.isNaN(ms) ? null : isoUtc(ms);
}

// ---------------------------------------------------------------- publicaciones

export interface Publicacion {
  red: RedTermino;
  /** El pie entero, para decidir si NOMBRA el termino. No sale de aqui. */
  pie: string;
  destacado: Omit<DestacadoConsulta, "cosechados" | "opinion" | "sentimiento">;
}

export type Descarte = "sin_url" | "anuncio" | "privado" | "sin_creador" | "sin_fecha" | "futuro" | "vieja";

function enVentana(publicado: string, ahora: Date, dias: number): Descarte | null {
  const ms = Date.parse(publicado);
  if (ms > ahora.getTime()) return "futuro";
  return ms < ahora.getTime() - dias * 86_400_000 ? "vieja" : null;
}

/** pulso/tiktok.py::_limpiar_video, sin la zona. */
export function limpiarVideoTiktok(item: Record<string, unknown>, termino: string, ahora: Date, dias: number): Publicacion | Descarte {
  const url = canonizarPublicacion(cadena(item.webVideoUrl) || cadena(item.url), "tiktok");
  if (url === null) return "sin_url";
  if (item.isAd || item.isSponsored) return "anuncio";
  const autor = (item.authorMeta ?? {}) as Record<string, unknown>;
  if (autor.privateAccount) return "privado";
  const handle = cadena(autor.name).trim().replace(/^@+/, "").toLowerCase();
  if (handle === "") return "sin_creador";
  const t = item.createTime;
  const publicado = typeof t === "number" && t > 0 ? isoUtc(Math.trunc(t) * 1000) : desdeIso(cadena(item.createTimeISO));
  if (publicado === null) return "sin_fecha";
  const fuera = enVentana(publicado, ahora, dias);
  if (fuera !== null) return fuera;
  const pie = desescapar(cadena(item.text));
  const destacado: Publicacion["destacado"] = {
    url,
    cuenta: "vivo",
    zona: "nacional",
    creador: `@${handle}`,
    publicado,
    fecha: publicado.slice(0, 10),
    titulo: titulo(quitarEtiquetasFinales(pie)),
    tipo: item.isSlideshow ? "carrusel" : "video",
    likes: Math.max(0, entero(item.diggCount)),
    comentarios: Math.max(0, entero(item.commentCount)),
    compartidos: Math.max(0, entero(item.shareCount)),
    guardados: Math.max(0, entero(item.collectCount)),
    temas: [],
    origen: "busqueda",
    fuente: termino,
  };
  const vistas = Math.max(0, entero(item.playCount));
  if (vistas > 0) destacado.reproducciones = vistas;
  const meta = (item.videoMeta ?? {}) as Record<string, unknown>;
  const dur = entero(meta.duration);
  if (dur > 0) destacado.duracion = dur;
  return { red: "tiktok", pie, destacado };
}

const TIPOS_INSTAGRAM: Record<string, DestacadoConsulta["tipo"]> = { Image: "imagen", Video: "video", Sidecar: "carrusel" };

/** pulso/instagram.py::_limpiar_post, sin la zona de la cuenta. */
export function limpiarPostInstagram(item: Record<string, unknown>, etiqueta: string, ahora: Date, dias: number): Publicacion | Descarte {
  const url = canonizarPublicacion((cadena(item.url) || cadena(item.postUrl)).trim(), "instagram");
  if (url === null) return "sin_url";
  const publicado = desdeIso(cadena(item.timestamp));
  if (publicado === null) return "sin_fecha";
  const fuera = enVentana(publicado, ahora, dias);
  if (fuera !== null) return fuera;
  const pie = cadena(item.caption);
  const destacado: Publicacion["destacado"] = {
    url,
    cuenta: "vivo",
    zona: "nacional",
    publicado,
    fecha: publicado.slice(0, 10),
    titulo: titulo(pie),
    tipo: TIPOS_INSTAGRAM[cadena(item.type)] ?? "otro",
    likes: Math.max(0, entero(item.likesCount)),
    comentarios: Math.max(0, entero(item.commentsCount)),
    temas: [],
    origen: "hashtag",
    fuente: etiqueta,
  };
  const vistas = Math.max(entero(item.videoViewCount), entero(item.videoPlayCount));
  if (vistas > 0) destacado.reproducciones = vistas;
  return { red: "instagram", pie, destacado };
}

/**
 * Un resultado de la busqueda de Facebook (`scraper_one~facebook-posts-search`).
 *
 * Sus campos no son los del actor de paginas: `postText`, `timestamp`,
 * `reactionsCount`, `sharesCount`, `author`. `author` trae nombre, perfil, id y
 * foto de quien publico, y NADA de eso se copia: en una busqueda por palabra
 * quien publica puede ser una persona y no una pagina. La `fuente` que se
 * pinta es el slug de la pagina cuando el enlace es de una pagina
 * (`/<pagina>/posts/…`) y «Facebook» cuando no, que es lo que dice el enlace y
 * nada mas.
 */
export function limpiarPostFacebook(item: Record<string, unknown>, ahora: Date, dias: number): Publicacion | Descarte {
  const url = canonizarPublicacion(cadena(item.url) || cadena(item.postUrl) || cadena(item.topLevelUrl), "facebook");
  if (url === null) return "sin_url";
  if (item.isSponsored || item.isAd) return "anuncio";
  const t = item.timestamp;
  const publicado = typeof t === "number" && t > 0
    ? isoUtc((t > 1e11 ? Math.trunc(t / 1000) : Math.trunc(t)) * 1000)
    : desdeIso(cadena(t) || cadena(item.time) || cadena(item.date));
  if (publicado === null) return "sin_fecha";
  const fuera = enVentana(publicado, ahora, dias);
  if (fuera !== null) return fuera;
  const pie = cadena(item.postText) || cadena(item.text) || cadena(item.message);
  const pagina = /^https:\/\/www\.facebook\.com\/([^/]+)\/(?:posts|videos)\//.exec(url)?.[1];
  const destacado: Publicacion["destacado"] = {
    url,
    cuenta: "vivo",
    zona: "nacional",
    publicado,
    fecha: publicado.slice(0, 10),
    titulo: titulo(pie),
    tipo: /\/(?:videos|reel)\/|\/watch/.test(url) ? "video" : "otro",
    likes: Math.max(0, entero(item.reactionsCount ?? item.likes ?? item.reactionCount)),
    comentarios: Math.max(0, entero(item.commentsCount ?? item.comments ?? item.commentCount)),
    compartidos: Math.max(0, entero(item.sharesCount ?? item.shares ?? item.shareCount)),
    temas: [],
    origen: "busqueda",
    fuente: pagina ?? "Facebook",
  };
  return { red: "facebook", pie, destacado };
}

/** Si el pie NOMBRA el termino: la frase plegada, o su etiqueta (`#vivelabaja`
 *  para «Vive la Baja»). Es la regla de buscadores.ts::nombra llevada a las
 *  redes, y la que el sondeo del 18 de septiembre de 2026 pedia: la busqueda de
 *  TikTok devolvio 3 de 3 videos ajenos para cada termino del cliente. */
export function nombraEnPie(pie: string, termino: string): boolean {
  const aguja = fold(termino);
  if (aguja === "") return false;
  const texto = fold(pie);
  return texto.includes(aguja) || texto.includes(`#${etiquetaDe(termino)}`);
}

/** «Vive la Baja» -> «vivelabaja»: la etiqueta que Instagram entiende. */
export function etiquetaDe(termino: string): string {
  return fold(termino).replace(/[^\p{L}\p{N}_]/gu, "");
}

// ------------------------------------------------------------------ comentarios

export interface ComentarioLimpio {
  id: string;
  texto: string;
  post: string;
  /** La red de la busqueda: la «fuente» de la regla de brigada. */
  cuenta: string;
  idioma: "es" | "en";
  fecha: string;
  likes: number;
}

/**
 * El post al que pertenece un comentario, entre los pedidos. Cada actor lo
 * dice con otra llave (pulso/consultas.py::_url_comentario); si no lo dice,
 * el comentario se tira: atribuirlo al primero pedido, como hace el pipeline,
 * aqui pondria el texto de un post debajo de otro en pantalla.
 */
function postDe(red: RedTermino, item: Record<string, unknown>, pedidas: ReadonlySet<string>): string | null {
  const candidatos = red === "tiktok"
    ? [cadena(item.videoWebUrl), cadena(item.postURL)]
    : red === "instagram"
      ? [cadena(item.postUrl), cadena(item.inputUrl)]
      : [cadena(item.inputUrl), cadena(item.facebookUrl), cadena(item.postUrl)];
  for (const c of candidatos) {
    const canon = canonizarPublicacion(c.trim(), red);
    if (canon !== null && pedidas.has(canon)) return canon;
  }
  return null;
}

/** La lista blanca de un comentario de cualquiera de las tres redes. */
export function limpiarComentario(
  red: RedTermino,
  item: Record<string, unknown>,
  pedidas: ReadonlySet<string>,
): ComentarioLimpio | null {
  const post = postDe(red, item, pedidas);
  if (post === null) return null;
  const texto = cadena(item.text).trim();
  if (texto === "") return null;
  const fecha = red === "tiktok" ? cadena(item.createTimeISO) : red === "instagram" ? cadena(item.timestamp) : cadena(item.date);
  const likes = red === "tiktok" ? entero(item.diggCount) : entero(item.likesCount);
  return {
    id: idComentario(post, texto),
    texto,
    post,
    cuenta: `vivo-${red}`,
    idioma: "es",
    fecha: fecha.slice(0, 10),
    // Instagram no recorta a cero en el pipeline; las otras dos si. Un like
    // negativo no existe, pero la paridad es con el codigo, no con la idea.
    likes: red === "instagram" ? likes : Math.max(0, likes),
  };
}

/** pulso/redes.py::_sin_palabras: nada alfanumerico es una reaccion. */
export const sinPalabras = (texto: string): boolean => !/[\p{L}\p{N}]/u.test(texto);

/** pulso/redes.py::_marcar_repetidos: el mismo texto en `umbral` posts
 *  distintos de la misma fuente es una sola persona insistiendo. */
export function brigadas(comentarios: readonly ComentarioLimpio[], umbral = UMBRAL_BRIGADA): Set<string> {
  const posts = new Map<string, Set<string>>();
  for (const c of comentarios) {
    const clave = `${c.cuenta}\n${fold(c.texto)}`;
    const s = posts.get(clave) ?? new Set<string>();
    s.add(c.post);
    posts.set(clave, s);
  }
  const salida = new Set<string>();
  for (const c of comentarios) {
    if ((posts.get(`${c.cuenta}\n${fold(c.texto)}`)?.size ?? 0) >= umbral) salida.add(c.id);
  }
  return salida;
}

/** Un comentario de opinion: con palabras y no de brigada. Sobre esos se
 *  cuenta el tono, como en pulso/redes.py. */
export function esOpinion(c: ComentarioLimpio, deBrigada: ReadonlySet<string>): boolean {
  return !deBrigada.has(c.id) && !sinPalabras(c.texto);
}

/** pulso/redes.py::_ordenar_comentarios: likes, luego lo mas reciente, luego
 *  el id, que es lo que hace el orden estable. */
function ordenar(lista: ComentarioLimpio[]): ComentarioLimpio[] {
  return [...lista].sort((a, b) => b.likes - a.likes || b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
}

/**
 * pulso/redes.py::publicar_comentarios, por post: los mas votados, los
 * primeros `visibles` siempre y del siguiente al `maximo` solo con likes; sin
 * brigada, sin reacciones, sin menciones (se enmascaran; un comentario que es
 * solo una mencion no se publica) y recortados. `tono` es la etiqueta del
 * servicio por id de comentario, o nada.
 */
export function publicarComentarios(
  comentarios: readonly ComentarioLimpio[],
  urls: ReadonlySet<string>,
  tono: ReadonlyMap<string, ComentarioPublicado["sentimiento"]>,
  visibles = COMENTARIOS_VISIBLES,
  maximo = COMENTARIOS_MAXIMO,
): Record<string, ComentarioPublicado[]> {
  const deBrigada = brigadas(comentarios);
  const porPost = new Map<string, ComentarioLimpio[]>();
  for (const c of comentarios) {
    if (!urls.has(c.post) || deBrigada.has(c.id) || sinPalabras(c.texto.replace(RE_MENCION, ""))) continue;
    porPost.set(c.post, [...(porPost.get(c.post) ?? []), c]);
  }
  const salida: Record<string, ComentarioPublicado[]> = {};
  for (const url of [...porPost.keys()].sort()) {
    const lista = ordenar(porPost.get(url)!);
    const elegidos = [...lista.slice(0, visibles), ...lista.slice(visibles).filter((c) => c.likes > 0)].slice(0, maximo);
    salida[url] = elegidos.map((c) => {
      let texto = c.texto.replace(RE_MENCION, MENCION_ENMASCARADA);
      const p = puntos(texto);
      if (p.length > TEXTO_MAXIMO) texto = p.slice(0, TEXTO_MAXIMO - 1).join("").trimEnd() + "…";
      return { texto, likes: c.likes, fecha: c.fecha, sentimiento: c.idioma === "es" ? tono.get(c.id) ?? null : null };
    });
  }
  return salida;
}
