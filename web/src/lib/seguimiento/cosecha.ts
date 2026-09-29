import { canonizarPublicacion } from "@/lib/dominio/publicaciones";
import { ACTORES, type Actor, type Tope } from "@/lib/redes-en-vivo/apify";
import {
  desescapar,
  enmascarar,
  limpiarComentario,
  quitarEtiquetasFinales,
  soloReaccion,
  titulo as tituloDe,
} from "@/lib/redes-en-vivo/limpiar";
import type { ConteoTono, Metricas, PublicacionSeguida, RedSeguida, TonoComentario } from "./contrato";
import { REDES_SEGUIDAS } from "./contrato";

/**
 * Que se le pide a Apify para actualizar UNA publicacion, cuanto puede costar
 * y que se guarda de lo que devuelve. Funciones puras: scripts/probar-
 * seguimiento.cjs las prueba sin red.
 *
 * Es la busqueda en vivo (lib/redes-en-vivo/) con la URL ya conocida, y eso
 * cambia la forma: no hay una primera pasada que decida que publicaciones
 * pagan comentarios, asi que las dos corridas —la publicacion y sus
 * comentarios— arrancan juntas al pulsar.
 *
 * Todo lo que sale de aqui es LISTA BLANCA, como en limpiar.ts: la salida se
 * arma campo por campo y nunca resta de la entrada. Un comentario sale con su
 * texto, sus likes y su hora, y nada de quien lo escribio. El item de post de
 * Instagram trae `latestComments[]` con usuario y foto, y nada lo copia.
 */

/**
 * Los actores que el seguimiento puede llamar, cada uno con su razon. Una
 * lista CERRADA y propia: el navegador manda una URL, nunca un actor. Ninguno
 * inicia sesion, y `iniciarCorrida` pasa cada entrada por `revisarEntrada`
 * igual que en la busqueda en vivo. La busqueda por palabra de Facebook, que
 * es la excepcion que el cliente acepto para la lupa de Redes, NO esta aqui:
 * aqui no se busca nada.
 */
export const ACTORES_SEGUIMIENTO = {
  tiktokVideo: {
    id: "clockworks~tiktok-scraper",
    razon: "Los conteos y el pie de UN video por su URL, sin sesion. Cobra 0.0023 USD por el video en el nivel Silver, pero exige un tope de al menos 0.50 USD por corrida.",
  },
  tiktokComentarios: ACTORES.tiktokComentarios,
  instagram: {
    id: "apify~instagram-scraper",
    razon: "La publicacion por su URL y sus comentarios, sin sesion: el mismo actor de pulso/instagram.py. 0.0019 USD por resultado en el nivel Silver.",
  },
  facebookPublicacion: {
    id: "apify~facebook-posts-scraper",
    razon: "Los conteos y el texto de UNA publicacion por su URL, sin sesion: el mismo actor de las paginas de pulso/facebook.py. 0.0025 USD por publicacion en el nivel Silver.",
  },
  facebookComentarios: ACTORES.facebookComentarios,
} as const satisfies Record<string, Actor>;

/** Cuantos comentarios se piden por actualizacion. Los mas recientes, donde
 *  la red deja elegir el orden (Facebook e Instagram); TikTok los da en el
 *  suyo. */
export const COMENTARIOS_POR_ACTUALIZACION = 100;

/**
 * Lo mas que puede cobrar cada corrida, leido de la ficha de cada actor el 28
 * de septiembre de 2026 en el nivel Silver: TikTok 0.0023 USD por video y
 * 0.00075 por comentario; Instagram 0.0019 por resultado; Facebook 0.0025 por
 * publicacion y 0.0017 por comentario, mas 0.001 por arranque. Con 100
 * comentarios una actualizacion sale en ~0.08 USD en TikTok, ~0.19 en
 * Instagram y ~0.18 en Facebook.
 *
 * El tope del video de TikTok NO es su costo: el actor declara
 * `minimalMaxTotalChargeUsd: 0.5` y rechaza con 400 una corrida con menos
 * (redes-en-vivo/responder.ts lo aprendio el 23 de septiembre de 2026). Cobra
 * lo que produce; el tope solo acota, y el libro lo cuenta como reserva solo
 * mientras la corrida no termina.
 */
export const TOPES: Record<RedSeguida, { publicacion: Tope; comentarios: Tope }> = {
  tiktok: {
    publicacion: { usd: 0.5, items: 1, segundos: 120 },
    comentarios: { usd: 0.1, items: COMENTARIOS_POR_ACTUALIZACION, segundos: 240 },
  },
  instagram: {
    publicacion: { usd: 0.01, items: 1, segundos: 120 },
    comentarios: { usd: 0.2, items: COMENTARIOS_POR_ACTUALIZACION, segundos: 240 },
  },
  facebook: {
    publicacion: { usd: 0.02, items: 1, segundos: 120 },
    comentarios: { usd: 0.2, items: COMENTARIOS_POR_ACTUALIZACION, segundos: 240 },
  },
};

export const topeDe = (red: RedSeguida): number => TOPES[red].publicacion.usd + TOPES[red].comentarios.usd;

/**
 * La red y la URL canonica de lo que alguien pego, o null. Solo las formas
 * que `canonizarPublicacion` ya acepta en el resto del tablero: un enlace
 * corto (vm.tiktok.com, facebook.com/share/…) no dice que publicacion es sin
 * seguir una redireccion, y seguirla desde el servidor es pedirle a la red una
 * pagina por nosotros.
 */
export function publicacionDeUrl(pegado: string): { red: RedSeguida; url: string } | null {
  const limpio = pegado.trim();
  if (limpio === "" || limpio.length > 500) return null;
  for (const red of REDES_SEGUIDAS) {
    const url = canonizarPublicacion(limpio, red);
    if (url !== null) return { red, url };
  }
  return null;
}

/** La entrada de la corrida de la publicacion. Ninguna trae sesion. */
export function entradaPublicacion(red: RedSeguida, url: string): { actor: Actor; entrada: Record<string, unknown> } {
  if (red === "tiktok") {
    return {
      actor: ACTORES_SEGUIMIENTO.tiktokVideo,
      entrada: {
        postURLs: [url],
        resultsPerPage: 1,
        scrapeRelatedVideos: false,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadSlideshowImages: false,
        shouldDownloadAvatars: false,
        shouldDownloadMusicCovers: false,
      },
    };
  }
  if (red === "instagram") {
    return { actor: ACTORES_SEGUIMIENTO.instagram, entrada: { directUrls: [url], resultsType: "posts", resultsLimit: 1 } };
  }
  return { actor: ACTORES_SEGUIMIENTO.facebookPublicacion, entrada: { startUrls: [{ url }], resultsLimit: 1 } };
}

/** La entrada de la corrida de comentarios. Los mas recientes donde se puede
 *  elegir: es lo que un seguimiento viene a ver. */
export function entradaComentarios(red: RedSeguida, url: string): { actor: Actor; entrada: Record<string, unknown> } {
  if (red === "tiktok") {
    return {
      actor: ACTORES_SEGUIMIENTO.tiktokComentarios,
      entrada: { postURLs: [url], commentsPerPost: COMENTARIOS_POR_ACTUALIZACION, maxRepliesPerComment: 0 },
    };
  }
  if (red === "instagram") {
    return {
      actor: ACTORES_SEGUIMIENTO.instagram,
      entrada: { directUrls: [url], resultsType: "comments", resultsLimit: COMENTARIOS_POR_ACTUALIZACION },
    };
  }
  return {
    actor: ACTORES_SEGUIMIENTO.facebookComentarios,
    entrada: {
      startUrls: [{ url }],
      resultsLimit: COMENTARIOS_POR_ACTUALIZACION,
      viewOption: "RECENT_ACTIVITY",
      includeNestedComments: false,
    },
  };
}

// ------------------------------------------------------------ la publicacion

const cadena = (x: unknown): string => (typeof x === "string" ? x : "");

/** Un conteo que la red publico, o null. Un negativo es la marca de Instagram
 *  para «la cuenta oculta los likes»: es «sin dato», nunca cero. */
function conteo(...candidatos: unknown[]): number | null {
  for (const x of candidatos) {
    const n = typeof x === "number" ? x : typeof x === "string" && /^-?\d+$/.test(x.trim()) ? Number(x) : Number.NaN;
    if (Number.isFinite(n)) return n < 0 ? null : Math.trunc(n);
  }
  return null;
}

function isoDe(x: unknown): string | null {
  if (typeof x === "number" && x > 0) {
    // Segundos o milisegundos: los dos llegan (Facebook manda segundos,
    // algun actor milisegundos).
    const ms = x > 1e11 ? x : x * 1000;
    return new Date(Math.floor(ms / 1000) * 1000).toISOString();
  }
  const t = cadena(x).trim();
  if (t === "") return null;
  const conZona = /(?:Z|[+-]\d{2}:?\d{2})$/.test(t) ? t : `${t}Z`;
  const ms = Date.parse(conZona);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

export interface LecturaPublicacion {
  titulo: string;
  creador: string | null;
  publicado: string | null;
  tipo: NonNullable<PublicacionSeguida["tipo"]>;
  metricas: Metricas;
}

const TIPOS_INSTAGRAM: Record<string, LecturaPublicacion["tipo"]> = { Image: "imagen", Video: "video", Sidecar: "carrusel" };

/**
 * Lo que se guarda del item de la publicacion: la primera linea del pie, el @
 * de TikTok, la fecha, el tipo y los conteos. Null si el item no es una
 * publicacion (un error del actor llega como item con `error`).
 *
 * Instagram no publica compartidos ni guardados de cuentas ajenas, y Facebook
 * no publica guardados: salen null, que la pantalla dice «sin dato».
 */
export function leerPublicacion(red: RedSeguida, item: Record<string, unknown>): LecturaPublicacion | null {
  if (typeof item.error === "string" || typeof item.errorDescription === "string") return null;
  if (red === "tiktok") {
    const autor = (item.authorMeta ?? {}) as Record<string, unknown>;
    const handle = cadena(autor.name).trim().replace(/^@+/, "").toLowerCase();
    const pie = desescapar(cadena(item.text));
    return {
      titulo: tituloDe(quitarEtiquetasFinales(pie)),
      creador: handle === "" ? null : `@${handle}`,
      publicado: isoDe(item.createTime) ?? isoDe(item.createTimeISO),
      tipo: item.isSlideshow ? "carrusel" : "video",
      metricas: {
        likes: conteo(item.diggCount),
        comentarios: conteo(item.commentCount),
        reproducciones: conteo(item.playCount),
        compartidos: conteo(item.shareCount),
        guardados: conteo(item.collectCount),
      },
    };
  }
  if (red === "instagram") {
    const tipo = TIPOS_INSTAGRAM[cadena(item.type)] ?? "otro";
    return {
      titulo: tituloDe(cadena(item.caption)),
      creador: null,
      publicado: isoDe(item.timestamp),
      tipo,
      metricas: {
        likes: conteo(item.likesCount),
        comentarios: conteo(item.commentsCount),
        reproducciones: tipo === "video" ? conteo(item.videoViewCount, item.videoPlayCount) : null,
        compartidos: null,
        guardados: null,
      },
    };
  }
  const texto = cadena(item.text) || cadena(item.message) || cadena(item.postText);
  const url = cadena(item.url) || cadena(item.topLevelUrl);
  return {
    titulo: tituloDe(texto),
    creador: null,
    publicado: isoDe(item.time) ?? isoDe(item.timestamp),
    tipo: item.isVideo || /\/(?:videos|reel)\/|\/watch/.test(url) ? "video" : "otro",
    metricas: {
      likes: conteo(item.likes, item.reactionsCount, item.reactionCount),
      comentarios: conteo(item.comments, item.commentsCount, item.commentCount),
      reproducciones: conteo(item.viewsCount, item.videoViewCount),
      compartidos: conteo(item.shares, item.sharesCount, item.shareCount),
      guardados: null,
    },
  };
}

// ------------------------------------------------------------ los comentarios

export interface ComentarioLeido {
  huella: string;
  /** El texto limpio, para el modelo de tono. No se guarda asi. */
  crudo: string;
  /** Lo que se guarda y se muestra: menciones enmascaradas, recortado. */
  texto: string;
  likes: number;
  escrito: string | null;
}

/** La hora del comentario: cada actor la dice con otra llave. */
function escritoDe(red: RedSeguida, item: Record<string, unknown>): string | null {
  if (red === "tiktok") return isoDe(item.createTimeISO) ?? isoDe(item.createTime);
  if (red === "instagram") return isoDe(item.timestamp);
  return isoDe(item.date);
}

/**
 * Los comentarios de una corrida, limpios y sin repetir. `limpiarComentario`
 * es el de la busqueda en vivo, y con el viene la regla de paridad con el
 * pipeline: la identidad se tira ahi. Aqui solo se agrega la hora exacta, se
 * enmascaran las menciones y se quita lo que no tiene palabras, que no se
 * publica en ninguna red (pulso/redes.py::publicar_comentarios).
 *
 * Un comentario que no dice de que publicacion es se tira, como alla, aunque
 * aqui se pidio una sola: si el actor cambia su salida, se nota en un conteo
 * de cero y no en texto ajeno debajo de la publicacion.
 */
export function leerComentarios(red: RedSeguida, items: readonly Record<string, unknown>[], url: string): ComentarioLeido[] {
  const pedidas = new Set([url]);
  const vistos = new Map<string, ComentarioLeido>();
  for (const item of items) {
    const c = limpiarComentario(red, item, pedidas);
    if (c === null || soloReaccion(c.texto)) continue;
    const leido: ComentarioLeido = { huella: c.id, crudo: c.texto, texto: enmascarar(c.texto), likes: Math.max(0, c.likes), escrito: escritoDe(red, item) };
    const previo = vistos.get(c.id);
    // Dos personas que escriben lo mismo son una huella: se queda la de mas
    // likes, como en el pipeline.
    if (previo === undefined || leido.likes > previo.likes) vistos.set(c.id, leido);
  }
  return [...vistos.values()];
}

export const CONTEO_CERO: ConteoTono = { positivo: 0, negativo: 0, neutral: 0, sinTono: 0 };

export function contarTono(etiquetas: readonly (TonoComentario | null)[]): ConteoTono {
  const n = { ...CONTEO_CERO };
  for (const e of etiquetas) {
    if (e === null) n.sinTono += 1;
    else n[e] += 1;
  }
  return n;
}

export const esTono = (e: unknown): e is TonoComentario => e === "positivo" || e === "negativo" || e === "neutral";
