import type {
  BloqueRedConsulta,
  ComentarioPublicado,
  Consulta,
  DestacadoConsulta,
  DocConsultas,
  DocRedesComentarios,
  PrensaConsulta,
  SaludConsulta,
  TonoConsulta,
  TonoPublicacionesConsulta,
} from "../datos/tipos";
import { canonizarPublicacion, type RedVisual } from "./publicaciones";

/**
 * La busqueda en vivo de un termino, armada con la MISMA forma que un termino
 * en seguimiento (`Consulta`), para que la ficha, el recorrido y la hoja de
 * comentarios sean los mismos componentes y no una copia que envejezca aparte.
 *
 * El 23 de septiembre de 2026 el cliente pidio que la lupa de Redes devolviera,
 * para CUALQUIER termino, noticias, publicaciones y comentarios. Hasta ese dia
 * un termino que no estaba en config/consultas.json solo filtraba lo que ya
 * estaba en pantalla. Ahora llega en dos pedazos, y este modulo los funde:
 *
 *  - `/api/termino`: la prensa (Google, el buscador propio de los medios y el
 *    archivo) y lo que el panel de redes YA cosecho que nombra el termino.
 *    Gratis, en segundos.
 *  - `/api/redes-en-vivo`: la busqueda pagada en TikTok, Instagram y Facebook,
 *    detras de un boton. Minutos.
 *
 * Por eso los conteos de tono NO viajan hechos: se cuentan aqui sobre la lista
 * FINAL de publicaciones, ya sin repetidas. Si viajaran sumados, una
 * publicacion que las dos mitades trajeran contaria dos veces.
 *
 * Puro y sin React: lo prueban scripts/probar-redes-en-vivo.cjs y el servidor.
 */

/** Las redes que pueden traer publicaciones de un termino en vivo. */
export const REDES_TERMINO = ["instagram", "tiktok", "facebook", "youtube"] as const;
export type RedTermino = (typeof REDES_TERMINO)[number];

export type TonoComentario = ComentarioPublicado["sentimiento"];

/** El tono del pie de una publicacion, con las dos formas de no tenerlo
 *  separadas como en el pipeline: `sin_modelo_idioma` es una cuenta que
 *  publica en un idioma que el modelo no lee; `sin_clasificar`, que el
 *  servicio no respondio. */
export type TonoPie = "positivo" | "negativo" | "neutral" | "sin_clasificar" | "sin_modelo_idioma";

/**
 * Un pedazo de la busqueda. `redes` sin una red es «esa red no se leyo»
 * (sin dato), no «no hubo nada»: una red leida y vacia viaja como lista vacia.
 */
export interface PiezasTermino {
  termino: string;
  generado: string;
  /** El termino nombra a una figura del roster: el tono no se muestra
   *  (regla 5 de PRODUCT.md, que la excepcion del 18 de septiembre dejo en
   *  pie para el roster). */
  figura: boolean;
  /** Solo la mitad gratuita trae prensa. */
  prensa?: PrensaConsulta;
  redes: Partial<Record<RedTermino, DestacadoConsulta[]>>;
  salud: SaludConsulta[];
  /** El tono del pie de cada publicacion, por su url, en el vocabulario de
   *  los comentarios. Una url que no esta cuenta como `sin_clasificar`. */
  pies: Record<string, TonoPie>;
  metodo: "modelo" | "ninguno";
  modelo: string | null;
}

/** Espejo EXACTO de pulso/consultas.py::SALVEDAD_TONO. El validador compara
 *  la del archivo por igualdad; esta viaja en la busqueda en vivo con la
 *  misma letra, y probar-redes-en-vivo.cjs lo fija contra el Python. */
export const SALVEDAD_TONO =
  "Conteo del tono de cada comentario según un modelo que lee frases, no posturas: "
  + "dice si el texto suena a queja, a celebración o a información, no lo que quien "
  + "escribe piensa de la persona o de la marca. Son comentarios de quien decidió "
  + "comentar, no una muestra de nadie.";

/** Las razones de un bloque sin dato. Viajan en el dato; la pantalla solo
 *  dice «sin dato» (pedido del cliente del 18 de septiembre de 2026). */
export const RAZON_SIN_LEER = "Todavía no se buscó en esta red.";
export const RAZON_X = "De X solo se leen tendencias, no publicaciones.";

const CERO = { positivo: 0, negativo: 0, neutral: 0, sin_clasificar: 0, sin_modelo_idioma: 0 };

const claveDe = (red: RedTermino, url: string) => `${red}:${canonizarPublicacion(url, red as RedVisual) ?? url}`;

/**
 * Las dos mitades en una: primero lo que ya se habia cosechado, despues lo de
 * la busqueda pagada, sin repetir una publicacion por su url canonica (un
 * video que el panel de TikTok ya tenia puede volver en la busqueda). Una red
 * que cualquiera de las dos leyo queda leida.
 */
export function fundirPiezas(base: PiezasTermino, vivo: PiezasTermino | null): PiezasTermino {
  if (vivo === null) return base;
  const redes: Partial<Record<RedTermino, DestacadoConsulta[]>> = {};
  for (const red of REDES_TERMINO) {
    const a = base.redes[red];
    const b = vivo.redes[red];
    if (a === undefined && b === undefined) continue;
    const vistos = new Set<string>();
    const lista: DestacadoConsulta[] = [];
    for (const d of [...(a ?? []), ...(b ?? [])]) {
      const clave = claveDe(red, d.url);
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      lista.push(d);
    }
    redes[red] = lista;
  }
  return {
    ...base,
    figura: base.figura || vivo.figura,
    redes,
    salud: [...base.salud, ...vivo.salud],
    pies: { ...vivo.pies, ...base.pies },
    metodo: base.metodo === "modelo" || vivo.metodo === "modelo" ? "modelo" : "ninguno",
    modelo: base.modelo ?? vivo.modelo,
  };
}

function bloque(destacados: DestacadoConsulta[] | undefined, salud: SaludConsulta[], red: RedTermino): BloqueRedConsulta {
  if (destacados === undefined) return { estado: "sin_dato", razon: RAZON_SIN_LEER };
  return {
    estado: "ok",
    publicaciones: destacados.length,
    comentarios_cosechados: destacados.reduce((n, d) => n + d.cosechados, 0),
    opinion: destacados.reduce((n, d) => n + d.opinion, 0),
    destacados,
    salud: salud.filter((s) => s.plataforma === red),
  };
}

/** Todo el tono a `sin_clasificar`: lo que se hace con un termino del roster.
 *  Se mueve, no se borra, para que las cubetas sigan sumando el total. */
function sinTono<T extends typeof CERO>(n: T): T {
  return { ...n, positivo: 0, negativo: 0, neutral: 0, sin_clasificar: n.positivo + n.negativo + n.neutral + n.sin_clasificar };
}

/** Un termino en vivo como `Consulta`, con los conteos hechos sobre la lista
 *  final. Las cinco cubetas suman su total, como exige el validador de
 *  data/consultas.json, aunque esto no pase por el. */
export function armarConsulta(p: PiezasTermino): Consulta {
  const todos = REDES_TERMINO.flatMap((red) => p.redes[red] ?? []);

  let comentarios = todos.reduce((n, d) => ({
    positivo: n.positivo + d.sentimiento.positivo,
    negativo: n.negativo + d.sentimiento.negativo,
    neutral: n.neutral + d.sentimiento.neutral,
    sin_clasificar: n.sin_clasificar + d.sentimiento.sin_clasificar,
    sin_modelo_idioma: n.sin_modelo_idioma + d.sentimiento.sin_modelo_idioma,
  }), { ...CERO });
  let pies = { ...CERO };
  for (const d of todos) pies[p.pies[d.url] ?? "sin_clasificar"] += 1;
  if (p.figura) {
    comentarios = sinTono(comentarios);
    pies = sinTono(pies);
  }
  const tono: TonoConsulta = {
    ...comentarios,
    comentarios: comentarios.positivo + comentarios.negativo + comentarios.neutral + comentarios.sin_clasificar + comentarios.sin_modelo_idioma,
    metodo: p.figura ? "ninguno" : p.metodo,
    modelo: p.figura ? null : p.modelo,
    salvedad_tono: SALVEDAD_TONO,
  };
  const tonoPies: TonoPublicacionesConsulta = {
    ...pies,
    publicaciones: todos.length,
    metodo: p.figura ? "ninguno" : p.metodo,
    modelo: p.figura ? null : p.modelo,
  };

  return {
    id: "vivo",
    termino: p.termino,
    tipo: "tema",
    idioma: "es",
    plataformas: {
      instagram: bloque(p.redes.instagram, p.salud, "instagram"),
      tiktok: bloque(p.redes.tiktok, p.salud, "tiktok"),
      facebook: bloque(p.redes.facebook, p.salud, "facebook"),
      youtube: bloque(p.redes.youtube, p.salud, "youtube"),
      x: { estado: "sin_dato", razon: RAZON_X },
    },
    prensa: p.prensa === undefined ? { estado: "sin_dato", razon: RAZON_SIN_LEER } : sinTonoPrensa(p.prensa, p.figura),
    tono,
    tono_publicaciones: tonoPies,
    temas: { minimo: 0, comentarios: 0, temas: [] },
  };
}

function sinTonoPrensa(prensa: PrensaConsulta, figura: boolean): PrensaConsulta {
  if (!figura) return prensa;
  const sinFila = <T extends { tono: unknown }>(r: T): T => ({ ...r, tono: null });
  return {
    ...prensa,
    resultados: prensa.resultados?.map(sinFila),
    anteriores: prensa.anteriores?.map(sinFila),
    por_medio: prensa.por_medio?.map((m) => ({ ...m, favorable: 0, adversa: 0, neutral: 0 })),
    tono: prensa.tono === undefined ? undefined : {
      ...prensa.tono,
      favorable: 0, adversa: 0, neutral: 0,
      sin_clasificar: prensa.tono.favorable + prensa.tono.adversa + prensa.tono.neutral + prensa.tono.sin_clasificar,
      metodo: "ninguno", modelo: null,
    },
  };
}

/** El texto de los comentarios de las dos mitades, en un documento. Con un
 *  termino del roster, cada comentario pierde su etiqueta: la hoja pinta el
 *  tono de cada uno, y eso tambien es cruzar tono con la figura. */
export function fundirTextos(
  base: DocRedesComentarios | null,
  vivo: DocRedesComentarios | null,
  figura: boolean,
  generado: string,
): DocRedesComentarios {
  const por_post: Record<string, ComentarioPublicado[]> = { ...(base?.por_post ?? {}) };
  for (const [url, lista] of Object.entries(vivo?.por_post ?? {})) {
    por_post[url] ??= lista;
  }
  if (figura) {
    for (const url of Object.keys(por_post)) {
      por_post[url] = por_post[url]!.map((c) => ({ ...c, sentimiento: null }));
    }
  }
  return {
    esquema: 1,
    generado,
    plataforma: "consultas",
    retencion_dias: 30,
    visibles: base?.visibles ?? vivo?.visibles ?? 5,
    maximo: base?.maximo ?? vivo?.maximo ?? 10,
    por_post,
  };
}

/** El documento de una sola consulta que piden la ficha y el visor. */
export function documentoDe(c: Consulta, generado: string): DocConsultas {
  return {
    esquema: 1,
    generado,
    ventana_dias: 30,
    ventana_prensa_dias: c.prensa.ventana_dias ?? 180,
    retencion_dias: 30,
    destacados_maximo: 10,
    consultas: [c],
    gasto: { resultados: 0, gastado: 0, por_concepto: {} },
  };
}
