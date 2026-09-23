import type { AgregadoConsulta, Consulta, Destacado, DocConsultas, DocRedesComentarios, RedConsulta, RedSinDatoConsulta, ResultadoPrensaConsulta, TonoTitular } from "../datos/tipos";
import { fechaConAnio, numero, plegar, pluralizar } from "./formato";
import {
  canonizarPublicacion,
  compararPublicaciones,
  NOMBRE_RED,
  type PublicacionVisual,
  type RedVisual,
} from "./publicaciones";
import { ruta } from "./secciones";
import { PARAM_CONSULTA } from "../busqueda/entrada";

/**
 * La busqueda de Redes: un TERMINO en seguimiento o un filtro sobre lo que ya
 * esta en pantalla.
 *
 * El 18 de septiembre de 2026 el cliente pidio saber que dicen las redes de
 * tres terminos —dos empresas y una persona— y poder bajarlo en PDF. La lupa
 * de Redes abre esto: si lo escrito es uno de los terminos de
 * data/consultas.json (`buscarConsulta`, por igualdad plegada, asi que «vive
 * la baja» y «Vive la Baja» son lo mismo), se muestra su cosecha de 30 dias en
 * el mismo visor de una publicacion por pantalla, con la ficha del termino
 * como primera tarjeta. Si no, lo escrito filtra las publicaciones que el
 * lector ya tiene delante (`filtrarPorTexto`): pies y comentarios que lo
 * nombran. Ninguna de las dos cosas pide nada a ninguna red.
 *
 * Puro y sin React: lo prueba scripts/probar-consultas.cjs.
 */

/** Las plataformas de una consulta que caen en el visor. YouTube y X vienen
 *  como `sin_dato` con su razon y se pintan como hoja de prosa. */
export const REDES_CONSULTA_VISUALES = ["instagram", "tiktok", "facebook"] as const;

/** Donde se BUSCAN publicaciones de un termino: las tres de arriba y YouTube,
 *  que en data/ siempre es `sin_dato` y en la busqueda en vivo trae los videos
 *  de los canales del panel (lib/dominio/termino-vivo.ts). Un enlace agregado
 *  a mano sigue decidiendose con REDES_CONSULTA_VISUALES: un video de YouTube
 *  señalado a mano era y sigue siendo una noticia. */
export const REDES_CON_PUBLICACIONES = [...REDES_CONSULTA_VISUALES, "youtube"] as const;

/** El termino cuyo nombre plegado es el de la consulta, o null. */
export function buscarConsulta(doc: DocConsultas | undefined, q: string): Consulta | null {
  const aguja = plegar(q.trim());
  if (aguja === "") return null;
  return doc?.consultas.find((c) => plegar(c.termino) === aguja) ?? null;
}

/**
 * La red de un enlace agregado a mano, si es un post de red social; null si
 * es prensa. La decide `canonizarPublicacion`, la misma que acepta o no un
 * destacado: un enlace que no canoniza no se podria embeber y se queda como
 * noticia. El caso: el post de Tijuana Linea Roja, que el 23 de septiembre de
 * 2026 el cliente pidio contar como publicacion de Facebook y no como noticia.
 */
export function redDeAgregado(a: AgregadoConsulta): (typeof REDES_CONSULTA_VISUALES)[number] | null {
  return REDES_CONSULTA_VISUALES.find((red) => canonizarPublicacion(a.url, red) !== null) ?? null;
}

/**
 * Las publicaciones de un termino como filas del visor, de las tres redes,
 * en el orden de lectura del visor (mas reciente primero).
 *
 * `fuente` es la del destacado —el @handle, la etiqueta, el slug de la
 * pagina o el creador de TikTok—, nunca el id del termino: ese es el
 * mecanismo, y el mecanismo no se le ensena al lector.
 */
export function reunirPublicacionesConsulta(c: Consulta): PublicacionVisual[] {
  const salida: PublicacionVisual[] = [];
  const vistos = new Set<string>();
  for (const red of REDES_CON_PUBLICACIONES) {
    const bloque = c.plataformas[red];
    if (bloque.estado === "sin_dato") continue;
    for (const post of bloque.destacados) {
      const url = canonizarPublicacion(post.url, red);
      const clave = `${red}:${url ?? post.url}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      const fuente = red === "tiktok"
        ? (post.creador === undefined ? "un creador" : `@${post.creador.replace(/^@/, "")}`)
        : post.origen === "hashtag" ? `#${post.fuente}` : post.fuente;
      salida.push({ post, red, clave, url, fuente });
    }
  }
  // Los posts agregados a mano entran al mismo recorrido, con su embed. Un
  // destacado minimo: la tarjeta no pinta cifras (17 de septiembre de 2026),
  // asi que los conteos en cero no se leen en ningun lado. Sin fecha se ordena
  // al final.
  for (const a of c.agregados ?? []) {
    const red = redDeAgregado(a);
    if (red === null) continue;
    const url = canonizarPublicacion(a.url, red);
    const clave = `${red}:${url ?? a.url}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    const post: Destacado = {
      url: a.url, cuenta: c.id, zona: "nacional", fecha: a.fecha ?? "", titulo: a.titulo, tipo: "otro",
      cosechados: 0, opinion: 0, sentimiento: { positivo: 0, negativo: 0, neutral: 0, sin_clasificar: 0, sin_modelo_idioma: 0 },
      temas: [],
    };
    salida.push({ post, red, clave, url, fuente: a.fuente });
  }
  return salida.sort((a, b) => compararPublicaciones(a.post, b.post) || a.clave.localeCompare(b.clave));
}

/**
 * Las filas cuyo pie o cuyos comentarios publicados nombran `q`, plegado.
 *
 * Compara texto, no sentido: «agua» encuentra «aguacate». Se ofrece como
 * filtro de lo que hay, no como busqueda de nada, y por eso el hueco se dice
 * con SIN_FILAS_BUSQUEDA y no con un cero.
 */
export function filtrarPorTexto(
  filas: readonly PublicacionVisual[],
  textos: Partial<Record<RedVisual, DocRedesComentarios | undefined>>,
  q: string,
): PublicacionVisual[] {
  const aguja = plegar(q.trim());
  if (aguja === "") return [...filas];
  return filas.filter((fila) => {
    if (plegar(fila.post.titulo).includes(aguja)) return true;
    const comentarios = textos[fila.red]?.por_post[fila.post.url] ?? [];
    return comentarios.some((c) => plegar(c.texto).includes(aguja));
  });
}

/** A donde lleva elegir un termino en seguimiento. Siempre la vista de
 *  region: un termino no es un lugar, y /tijuana/redes?q= no significa nada. */
export function rutaDeConsulta(termino: string): string {
  const params = new URLSearchParams();
  params.set(PARAM_CONSULTA, termino);
  return `${ruta(null, "redes")}?${params.toString()}`;
}

/** El hueco del filtro, dicho como hueco. No dice «corte» ni «corrida»: la
 *  interfaz dice que falta, nunca como se obtiene. */
export const SIN_FILAS_BUSQUEDA = (q: string): string =>
  `No hay publicaciones que nombren ${q} entre las que se muestran ahora.`;

/** El hueco de un termino en seguimiento sin publicaciones en su ventana. */
export const SIN_FILAS_CONSULTA = (termino: string, dias: number): string =>
  `No hay publicaciones que nombren ${termino} en los últimos ${rotuloVentana(dias)}.`;

/** Lo que se pinta junto a un titular con tono. El DATO dice
 *  favorable|adversa y asi sigue (el validador lo exige); la pantalla y el
 *  PDF dicen positiva|negativa desde el 23 de septiembre de 2026, a pedido
 *  del cliente: la direccion lee un solo vocabulario. */
export const NOMBRE_TONO_TITULAR: Record<TonoTitular, string> = {
  favorable: "positiva", adversa: "negativa", neutral: "neutral",
};

/** «6 meses» para 180 dias, «30 días» para 30: la ventana como la lee una
 *  persona, sin inventar precision (un mes son 30 dias aqui). */
export function rotuloVentana(dias: number): string {
  if (dias >= 60 && dias % 30 === 0) return `${dias / 30} meses`;
  return `${dias} ${dias === 1 ? "día" : "días"}`;
}

/** A donde lleva «ver en la prensa en vivo»: la busqueda de En Tendencia,
 *  que es la misma pregunta hecha al buscador de noticias de los ultimos dias.
 *  El texto que devuelve no entra a este documento ni se suma con nada. */
export function rutaDeBusquedaEnVivo(termino: string): string {
  const params = new URLSearchParams();
  params.set(PARAM_CONSULTA, termino);
  return `/?${params.toString()}`;
}

/**
 * Lo que las cifras de un termino dicen, en frases: el resumen que sigue a las
 * tarjetas de la ficha y abre el informe. Solo conteos y fechas, sacados del
 * documento; nunca «la mayoría», «la gente» ni un porcentaje (PRODUCT.md
 * reglas 1 y 2: son titulares de medios y comentarios de quien decidio
 * comentar, y con menos de 30 un porcentaje se mueve con dos). Donde no se
 * leyo, dice «sin dato».
 *
 * El caso que decidio la forma: el cliente pidio que el informe dijera que la
 * prensa sobre Grupo Concordia es negativa y que de Valente Marquez casi no
 * hay nada reciente. Las dos cosas caben como conteos —«3 noticias, 2
 * negativas, lo negativo viene de Blanco y Negro Noticias» y «ninguna noticia
 * en 6 meses; 1 anterior, de marzo de 2024»— y asi es como se afirman.
 *
 * Un solo vocabulario, positivo/negativo, desde el 23 de septiembre de 2026:
 * la direccion del cliente no lee «adverso» ni «favorable». El dato de la
 * prensa sigue diciendo favorable|adversa; lo que cambia es la palabra en
 * pantalla y en el PDF, y cada serie sigue en su frase, sin sumarse (regla 3).
 */
export function frasesConsulta(c: Consulta, doc: DocConsultas): string[] {
  const frases: string[] = [];
  const t = c.termino;
  const p = c.prensa;
  if (p.estado !== "ok") {
    frases.push("Noticias: sin dato.");
  } else {
    const ventana = rotuloVentana(p.ventana_dias ?? doc.ventana_prensa_dias);
    const filas = p.resultados ?? [];
    const viejos = p.anteriores ?? [];
    const tono = p.tono;
    if (filas.length === 0) {
      frases.push(`Ninguna noticia de los últimos ${ventana} menciona a ${t}.`);
    } else {
      const partes = tono === undefined ? "" : `: ${frasePartes(
        { positivo: tono.favorable, negativo: tono.adversa, neutral: tono.neutral, sinTono: tono.sin_clasificar + tono.sin_modelo_idioma },
        "f",
      )}`;
      frases.push(`${numero(filas.length)} ${pluralizar(filas.length, "noticia menciona", "noticias mencionan")} a ${t} en los últimos ${ventana}${partes}.`);
      const negativos = (p.por_medio ?? []).filter((m) => m.adversa > 0).sort((a, b) => b.adversa - a.adversa || a.fuente.localeCompare(b.fuente));
      if (negativos.length > 0) {
        frases.push(`Lo negativo viene de ${negativos.map((m) => `${m.fuente} (${numero(m.adversa)})`).join(", ")}.`);
      }
    }
    if (viejos.length > 0) {
      const reciente = viejos[0];
      const antiguo = viejos[viejos.length - 1];
      const cuando = reciente !== undefined && antiguo !== undefined && reciente.fecha !== antiguo.fecha
        ? `entre el ${fechaConAnio(antiguo.fecha)} y el ${fechaConAnio(reciente.fecha)}`
        : reciente !== undefined ? `del ${fechaConAnio(reciente.fecha)}` : "";
      const negativasViejas = viejos.filter((r) => r.tono === "adversa").length;
      frases.push(
        `${filas.length === 0 ? "Sí hay" : "Y hay"} ${numero(viejos.length)} ${pluralizar(viejos.length, "noticia anterior", "noticias anteriores")} a ese periodo${cuando ? `, ${cuando}` : ""}`
        + (negativasViejas > 0 ? `, ${numero(negativasViejas)} ${pluralizar(negativasViejas, "negativa", "negativas")}.` : "."),
      );
    }
  }

  const leidas = REDES_CON_PUBLICACIONES.filter((red) => c.plataformas[red].estado !== "sin_dato");
  if (leidas.length === 0) {
    frases.push("Redes: sin dato.");
  } else {
    const publicaciones = leidas.reduce((n, red) => {
      const b = c.plataformas[red];
      return b.estado === "sin_dato" ? n : n + b.publicaciones;
    }, 0);
    const ventana = rotuloVentana(doc.ventana_dias);
    if (publicaciones === 0) {
      frases.push(`Ninguna publicación en redes menciona a ${t} en los últimos ${ventana}.`);
    } else {
      const tp = c.tono_publicaciones;
      const partes = tp === undefined ? "" : `: ${frasePartes(
        { positivo: tp.positivo, negativo: tp.negativo, neutral: tp.neutral, sinTono: tp.sin_clasificar + tp.sin_modelo_idioma },
        "f",
      )}`;
      frases.push(`${numero(publicaciones)} ${pluralizar(publicaciones, "publicación", "publicaciones")} en redes en los últimos ${ventana}${partes}.`);
    }
    const k = c.tono;
    frases.push(
      `${numero(k.comentarios)} ${pluralizar(k.comentarios, "comentario", "comentarios")}`
      + (k.comentarios > 0
        ? `: ${frasePartes({ positivo: k.positivo, negativo: k.negativo, neutral: k.neutral, sinTono: k.sin_clasificar + k.sin_modelo_idioma }, "m")}.`
        : "."),
    );
  }

  // Lo agregado a mano se cuenta aparte y se dice que lo es: son enlaces que
  // alguien señaló, no lo que devolvió una búsqueda, y mezclarlos con las
  // cifras de arriba diría que la búsqueda los encontró.
  const agregados = c.agregados ?? [];
  if (agregados.length > 0) {
    const negativas = agregados.filter((a) => a.tono === "adversa").length;
    const positivas = agregados.filter((a) => a.tono === "favorable").length;
    const partes = [
      negativas > 0 ? `${numero(negativas)} ${pluralizar(negativas, "negativa", "negativas")}` : null,
      positivas > 0 ? `${numero(positivas)} ${pluralizar(positivas, "positiva", "positivas")}` : null,
    ].filter((x): x is string => x !== null);
    frases.push(
      `Además, ${numero(agregados.length)} ${pluralizar(agregados.length, "publicación agregada", "publicaciones agregadas")} a mano`
      + (partes.length > 0 ? `, ${partes.join(", ")}.` : "."),
    );
  }
  return frases;
}

/** El genero gramatical de una serie: noticias y publicaciones son
 *  femeninas, comentarios masculino. «2 noticias positivas», «2 comentarios
 *  positivos». */
export type Genero = "f" | "m";

const PALABRAS: Record<Genero, Record<Exclude<ClaseTono, "sin_tono">, [string, string]>> = {
  f: { positivo: ["positiva", "positivas"], negativo: ["negativa", "negativas"], neutral: ["neutral", "neutrales"] },
  m: { positivo: ["positivo", "positivos"], negativo: ["negativo", "negativos"], neutral: ["neutral", "neutrales"] },
};

/** La palabra de una clase, concordada con `n` y con el genero de la serie. */
export function palabraTono(clase: ClaseTono, n: number, genero: Genero): string {
  if (clase === "sin_tono") return "sin tono";
  return pluralizar(n, ...PALABRAS[genero][clase]);
}

interface Conteo { positivo: number; negativo: number; neutral: number; sinTono: number }

function frasePartes(n: Conteo, genero: Genero): string {
  const partes = (["positivo", "negativo", "neutral"] as const).map((clase) => `${numero(n[clase])} ${palabraTono(clase, n[clase], genero)}`);
  if (n.sinTono > 0) partes.push(`${numero(n.sinTono)} sin tono`);
  return partes.join(", ");
}

/** La clase de un cuadro de la tira de tono. Decide solo el color; la
 *  palabra la pone `palabraTono` con el genero de cada serie. Un vocabulario
 *  para todas desde el 23 de septiembre de 2026 (ver frasesConsulta). */
export type ClaseTono = "positivo" | "negativo" | "neutral" | "sin_tono";

/** De la clave de prensa del DATO a la clase de pantalla. */
export const CLASE_DE_TITULAR: Record<TonoTitular, ClaseTono> = {
  favorable: "positivo", adversa: "negativo", neutral: "neutral",
};

export interface TramoTono {
  clase: ClaseTono;
  /** La palabra, ya concordada con `n` y con el genero de su serie. */
  etiqueta: string;
  n: number;
}

/** Una serie contada: lo que dice una tarjeta. `total` es la cifra de la
 *  serie (titulares, publicaciones, comentarios), que las cuatro cubetas
 *  suman exactamente. */
export interface TonoSerie extends Conteo {
  total: number;
  tramos: TramoTono[];
}

export type CifraPrensa =
  | { estado: "sin_dato" }
  | { estado: "ok"; tono: TonoSerie };

export type CifraPublicaciones =
  | { estado: "sin_dato" }
  | {
    estado: "ok";
    total: number;
    /** Las redes que se leyeron, para decir «en Instagram» y no una fila de
     *  «sin dato» por cada una. */
    leidas: RedVisual[];
    /** null: un corte anterior al 23 de septiembre de 2026, sin tono de los
     *  pies. Se pinta «sin dato», nunca cero. */
    tono: TonoSerie | null;
  };

export type CifraComentarios =
  | { estado: "sin_dato" }
  | { estado: "ok"; tono: TonoSerie };

export interface CifrasConsulta {
  prensa: CifraPrensa;
  publicaciones: CifraPublicaciones;
  comentarios: CifraComentarios;
}

/** Una noticia de la ficha: la que devolvio la busqueda o la que se agrego a
 *  mano. En pantalla no se distinguen (ver noticiasDeConsulta). */
export type NoticiaConsulta = ResultadoPrensaConsulta | AgregadoConsulta;

/**
 * Las noticias de la ficha, en UNA lista: las de la busqueda en los seis
 * meses, las anteriores y las agregadas a mano que no son un post de red.
 *
 * Dos pedidos del cliente del 23 de septiembre de 2026. Primero, quitar la
 * seccion «Agregadas a mano»: la direccion quiere las noticias del termino,
 * no como llego cada una. Despues, contar todas juntas en vez de separar los
 * seis meses de lo anterior: las tres noticias negativas de Grupo Concordia
 * son de marzo, una semana fuera de la ventana, y partirlas en dos cifras
 * escondia lo que se buscaba. En el DATO siguen aparte (`resultados`,
 * `anteriores`, `agregados`) y el PDF las sigue separando; aqui se juntan.
 * Un agregado que es post de red va a publicaciones (redDeAgregado).
 * Orden: fecha descendente, las sin fecha al final.
 */
export function noticiasDeConsulta(c: Consulta): NoticiaConsulta[] {
  const p = c.prensa;
  const lista: NoticiaConsulta[] = p.estado === "ok" ? [...(p.resultados ?? []), ...(p.anteriores ?? [])] : [];
  for (const a of c.agregados ?? []) {
    if (redDeAgregado(a) === null) lista.push(a);
  }
  return lista.sort((x, y) =>
    x.fecha === y.fecha ? x.url.localeCompare(y.url)
      : x.fecha === null ? 1 : y.fecha === null ? -1 : y.fecha.localeCompare(x.fecha));
}

/** Una serie, en el MISMO orden para todas: positivo, negativo, neutral y lo
 *  que quedo sin tono. Los tres primeros van aunque midan cero —«0 negativas»
 *  es una medida, y es justo la que se pregunta—; «sin tono» solo si hay. */
function serie(n: Conteo, genero: Genero): TonoSerie {
  const total = n.positivo + n.negativo + n.neutral + n.sinTono;
  const tramos: TramoTono[] = total === 0 ? [] : (["positivo", "negativo", "neutral"] as const).map((clase) => ({
    clase, n: n[clase], etiqueta: palabraTono(clase, n[clase], genero),
  }));
  if (n.sinTono > 0) tramos.push({ clase: "sin_tono", n: n.sinTono, etiqueta: "sin tono" });
  return { ...n, total, tramos };
}

function contarTitulares(filas: readonly { tono: TonoTitular | null }[]): Conteo {
  return {
    positivo: filas.filter((r) => r.tono === "favorable").length,
    negativo: filas.filter((r) => r.tono === "adversa").length,
    neutral: filas.filter((r) => r.tono === "neutral").length,
    sinTono: filas.filter((r) => r.tono === null).length,
  };
}

/** El tono de los titulares de un medio. `por_medio` no trae
 *  `sin_clasificar`: lo que falta para llegar a `titulares` es lo que quedo
 *  sin tono (KPBS publica en ingles y el modelo no lo lee). */
export function tramosDeMedio(m: { titulares: number; adversa: number; favorable: number; neutral: number }): TramoTono[] {
  return serie(
    { positivo: m.favorable, negativo: m.adversa, neutral: m.neutral, sinTono: Math.max(0, m.titulares - m.adversa - m.favorable - m.neutral) },
    "f",
  ).tramos;
}

/**
 * Las cifras que abren la ficha: cuantas noticias, publicaciones y
 * comentarios son positivos y cuantos negativos, cada serie por su lado.
 *
 * Dos pedidos del cliente. El 22 de septiembre de 2026: que lo primero al
 * entrar a un termino fueran los numeros. El 23: que esos numeros fueran
 * «cuantos positivos y cuantos negativos», sin tecnicismos, porque es lo que
 * la direccion lee. Son las mismas cuentas que `frasesConsulta` —la prueba lo
 * fija—; cambia donde y con que peso se leen.
 *
 * Tres posturas que la forma sostiene:
 *  - «sin dato» es un estado, no un cero: una serie que no se leyo sale
 *    `{ estado: "sin_dato" }` y no trae un solo numero que pintar.
 *  - Noticias, publicaciones y comentarios no se suman entre si. No hay total.
 *  - Ningun numero es una fraccion; la tira pinta un cuadro por pieza.
 */
export function cifrasConsulta(c: Consulta): CifrasConsulta {
  // Las noticias se cuentan fila por fila sobre la misma lista que la ficha
  // pinta: la tarjeta y la lista de abajo dicen lo mismo.
  const noticias = noticiasDeConsulta(c);
  const prensa: CifraPrensa = c.prensa.estado !== "ok" && noticias.length === 0
    ? { estado: "sin_dato" }
    : { estado: "ok", tono: serie(contarTitulares(noticias), "f") };

  // Los posts agregados a mano (redDeAgregado) se cuentan con las
  // publicaciones, con su tono de prensa pasado a positivo/negativo.
  const sociales = (c.agregados ?? []).filter((a) => redDeAgregado(a) !== null);
  const deSociales = contarTitulares(sociales);
  const leidas = REDES_CON_PUBLICACIONES.filter((red) =>
    c.plataformas[red].estado !== "sin_dato" || sociales.some((a) => redDeAgregado(a) === red));
  let publicaciones: CifraPublicaciones;
  const leidasCosecha = REDES_CON_PUBLICACIONES.filter((red) => c.plataformas[red].estado !== "sin_dato");
  if (leidas.length === 0) {
    publicaciones = { estado: "sin_dato" };
  } else {
    const cosechadas = leidasCosecha.reduce((n, red) => {
      const b = c.plataformas[red];
      return b.estado === "sin_dato" ? n : n + b.publicaciones;
    }, 0);
    const tp = c.tono_publicaciones;
    // Sin tono de las cosechadas (corte viejo) y con cosechadas que contar,
    // el tono es «sin dato»; si solo hay agregadas, su tono si se sabe.
    const tonoDesconocido = tp === undefined && cosechadas > 0;
    publicaciones = {
      estado: "ok",
      total: cosechadas + sociales.length,
      leidas: [...leidas],
      tono: tonoDesconocido
        ? null
        : serie({
          positivo: (tp?.positivo ?? 0) + deSociales.positivo,
          negativo: (tp?.negativo ?? 0) + deSociales.negativo,
          neutral: (tp?.neutral ?? 0) + deSociales.neutral,
          sinTono: (tp ? tp.sin_clasificar + tp.sin_modelo_idioma : 0) + deSociales.sinTono,
        }, "f"),
    };
  }

  // Una fila sin redes cosechadas puede traer comentarios importados a mano
  // del post agregado (pulso/consultas.py::importar_comentarios): entonces
  // hay comentarios que contar, y decir «sin dato» los esconderia.
  const k = c.tono;
  const comentarios: CifraComentarios = leidasCosecha.length === 0 && k.comentarios === 0
    ? { estado: "sin_dato" }
    : { estado: "ok", tono: serie({ positivo: k.positivo, negativo: k.negativo, neutral: k.neutral, sinTono: k.sin_clasificar + k.sin_modelo_idioma }, "m") };

  return { prensa, publicaciones, comentarios };
}

/** «Instagram», «Instagram y Facebook», «Instagram, TikTok y Facebook»: las
 *  redes de una tarjeta, como las lee una persona. */
export function nombresDeRedes(redes: readonly RedVisual[]): string {
  const nombres = [...new Set(redes)].map((r) => NOMBRE_RED[r]);
  if (nombres.length <= 1) return nombres.join("");
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

/** Las publicaciones de un termino que traen texto de comentarios publicado,
 *  en el orden del recorrido. La tarjeta de comentarios, su hoja y el PDF
 *  salen de aqui, asi que dicen lo mismo. */
export function publicacionesConComentarios(c: Consulta, textos: DocRedesComentarios | undefined): PublicacionVisual[] {
  return reunirPublicacionesConsulta(c).filter((f) => (textos?.por_post[f.post.url] ?? []).length > 0);
}

/** El titulo de los comentarios: «en todas las publicaciones» cuando vienen de
 *  mas de una (pedido del cliente del 23 de septiembre de 2026). */
export function tituloComentarios(publicaciones: number): string {
  return publicaciones > 1 ? "Comentarios en todas las publicaciones" : "Comentarios";
}

/** Los rotulos de las tarjetas y el titulo de la hoja de comentarios, para
 *  la ficha y para el PDF: las dos superficies los dicen igual. Publicaciones
 *  y comentarios llevan la misma forma, «· en Instagram y Facebook». */
export function rotulosConsulta(c: Consulta, textos: DocRedesComentarios | undefined): {
  publicaciones: string;
  comentarios: string;
  hoja: string;
} {
  const cifras = cifrasConsulta(c);
  const conTexto = publicacionesConComentarios(c, textos);
  return {
    publicaciones: cifras.publicaciones.estado === "ok" && cifras.publicaciones.leidas.length > 0
      ? `Publicaciones · en ${nombresDeRedes(cifras.publicaciones.leidas)}`
      : "Publicaciones",
    comentarios: conTexto.length > 0 ? `Comentarios · en ${nombresDeRedes(conTexto.map((f) => f.red))}` : "Comentarios",
    hoja: tituloComentarios(conTexto.length),
  };
}
