import type {
  ComentarioPublicado,
  Consulta,
  DocConsultas,
  DocRedesComentarios,
  RedConsulta,
  RedSinDatoConsulta,
  TonoConsulta,
  TonoPrensaConsulta,
  TonoTitular,
} from "@/lib/datos/tipos";
import { frasesConsulta, rotuloVentana } from "@/lib/dominio/consultas";
import { MESES_CORTOS } from "@/lib/dominio/formato";

/**
 * El modelo del informe de un termino: lo que el PDF pinta, ya decidido, sin
 * JSX ni renderizador. Puro y probado offline (scripts/probar-informe.cjs).
 *
 * Existe aparte del documento (components/informe/informe-consulta.tsx) por
 * la misma razon que lib/busqueda/capitulos.ts vive aparte de su recorrido:
 * las decisiones que importan —que una cifra ausente sea null y se lea «sin
 * dato», que nada se divida, que las semanas se cuenten sobre los destacados y
 * se rotulen como tales— se prueban sin un motor de PDF delante.
 *
 * Reglas de PRODUCT.md que este modelo hace cumplir:
 *  - Un hueco es `null`, nunca 0 (regla 4). Instagram no publica compartidos:
 *    su celda dice «sin dato».
 *  - Conteos y nunca porcentajes (regla 2): no hay una sola division aqui.
 *  - La prensa y los comentarios van uno al lado del otro (regla 3).
 *  - El tono se publica como conteos y con la salvedad que trae el dato
 *    (regla 5, con la decision del cliente del 18 de septiembre de 2026).
 */

export type LecturaInforme =
  | { estado: "lista"; lectura: string; salvedad: string }
  | { estado: "apagada" | "pocos" | "fallo" };

export const NOMBRE_RED_INFORME: Record<RedConsulta | RedSinDatoConsulta, string> = {
  instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", youtube: "YouTube", x: "X",
};
export const NOMBRE_TIPO_INFORME: Record<Consulta["tipo"], string> = {
  persona: "persona", empresa: "empresa", tema: "tema",
};

const REDES: readonly RedConsulta[] = ["instagram", "tiktok", "facebook"];
const SIN_DATO: readonly RedSinDatoConsulta[] = ["youtube", "x"];

/** Cuantas publicaciones con comentarios se citan, y cuantos comentarios de cada una. */
export const TOPE_PUBLICACIONES_CON_TEXTO = 8;
export const TOPE_COMENTARIOS_POR_PUBLICACION = 5;

/**
 * Las cinco reglas, para la ultima pagina. Son las de PRODUCT.md, abreviadas
 * para caber en una hoja y sin cambiar lo que afirman. Desde el 18 de
 * septiembre de 2026 no hay pie en el sitio que las diga: en un documento que
 * viaja solo, van dentro.
 */
export const REGLAS_PRODUCTO: readonly string[] = [
  "Mide volumen de prensa y de conversación, no opinión pública. Un titular es una decisión editorial de un medio; un comentario es de quien decidió comentar. Ninguno es una muestra de la población.",
  "Con volumen bajo, conteos y no porcentajes. Debajo de 30 comentarios o titulares un porcentaje se mueve con dos comentarios; este informe no trae ninguno.",
  "Prensa y comentarios nunca se suman en un número. Van lado a lado; la distancia entre uno y otro es la señal.",
  "Los huecos se rotulan, no se rellenan. «Sin dato» es un estado distinto de cero: donde una plataforma no se leyó o no publica una cifra, aquí dice «sin dato».",
  "El tono no es postura. Un modelo local mide si cada frase suena a queja, a celebración o a información; no mide lo que quien escribe piensa de una persona o de una marca.",
];

export const NOTA_DECISION_REGLA_5 =
  "El conteo de tono de este informe se publica también cuando el término es una persona, por decisión del cliente del 18 de septiembre de 2026. Se publica como conteos, nunca como porcentaje ni como una cifra de consenso, y siempre con la salvedad de la sección «Tono de los comentarios». La lectura automática no atribuye postura a nadie.";

/** La salvedad de la lectura automatica es de la pagina, no del modelo:
 *  ver components/paneles/conversacion-redes.tsx para el caso que lo decidio. */
export const SALVEDAD_FIJA_INFORME =
  "Son los comentarios más votados de las publicaciones destacadas de los últimos 30 días, no una muestra de nadie.";

/** Una fuente y si se leyo. Sin `razon`: donde no se leyo el documento dice
 *  solo «sin dato» (pedido del cliente del 18 de septiembre de 2026). */
export interface FuenteInforme {
  red: RedConsulta | RedSinDatoConsulta;
  nombre: string;
  estado: "ok" | "fallo" | "sin_token" | "sin_dato";
}

export interface TitularInforme {
  titulo: string;
  fuente: string;
  /** null = sin fecha. Un post de Facebook no publica una legible sin sesión,
   *  y se pinta «sin fecha» antes que inventarla. */
  fecha: string | null;
  url: string;
  /** null se pinta «sin tono», nunca «neutral». */
  tono: TonoTitular | null;
}

export interface CifraInforme {
  red: RedConsulta;
  nombre: string;
  /** null = sin dato (la plataforma no se leyo), nunca 0. */
  publicaciones: number | null;
  comentariosLeidos: number | null;
}

export interface FilaDestacadoInforme {
  fecha: string;
  fuente: string;
  primeraLinea: string;
  likes: number | null;
  comentarios: number | null;
  compartidos: number | null;
  url: string;
}

export interface PublicacionConTextoInforme {
  red: RedConsulta;
  nombre: string;
  fuente: string;
  titulo: string;
  comentarios: ComentarioPublicado[];
}

export interface PuntoGrafica {
  label: string;
  value: number;
}

export interface SerieGrafica {
  name: string;
  data: PuntoGrafica[];
}

export interface DocumentoInforme {
  termino: string;
  tipo: string;
  /** Redes: 30 dias. */
  ventanaDias: number;
  /** Prensa: seis meses. Dos ventanas, dichas las dos. */
  ventanaPrensaDias: number;
  corte: string;
  /** Las frases de lib/dominio/consultas.ts::frasesConsulta: conteos y fechas,
   *  nunca «la mayoria» ni un porcentaje. Abren el informe. */
  resumen: string[];
  /** Los enlaces señalados a mano: fuera de los conteos de prensa y dichos
   *  como lo que son. Vacío cuando nadie agregó nada. */
  agregados: TitularInforme[];
  fuentes: FuenteInforme[];
  cifras: CifraInforme[];
  /** Publicaciones destacadas por plataforma: son las que el archivo trae con
   *  fecha, no todas las cosechadas. El rotulo lo dice. */
  destacadosPorRed: PuntoGrafica[];
  destacadosPorSemana: SerieGrafica[];
  tono: TonoConsulta;
  temas: { termino: string; n: number }[];
  temasMinimo: number;
  lectura: LecturaInforme;
  destacados: { red: RedConsulta; nombre: string; filas: FilaDestacadoInforme[] }[];
  conTexto: PublicacionConTextoInforme[];
  hayArchivoDeTexto: boolean;
  prensa: {
    estado: "ok" | "fallo" | "sin_dato";
    resultados: TitularInforme[];
    /** Los que nombran el termino antes de la ventana, con fecha: aparte,
     *  fuera del conteo de tono y de la tabla por medio. */
    anteriores: TitularInforme[];
    /** null cuando el bloque no es `ok`. Cinco cubetas sobre la ventana. */
    tono: TonoPrensaConsulta | null;
    porMedio: { fuente: string; titulares: number; favorable: number; adversa: number; neutral: number }[];
    muestra: string | null;
    archivo: { coincidencias: number; muestra: string } | null;
  };
}

/** El lunes de la semana de una fecha ISO (YYYY-MM-DD), como fecha ISO. */
export function lunesDe(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  const dia = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((dia + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** «15–21 sep»: el rotulo de una semana a partir de su lunes. */
export function rotuloSemana(lunes: string): string {
  const inicio = new Date(`${lunes}T00:00:00Z`);
  const fin = new Date(inicio);
  fin.setUTCDate(fin.getUTCDate() + 6);
  // En minusculas: en español los meses no van con mayuscula inicial.
  const mes = (d: Date) => (MESES_CORTOS[d.getUTCMonth()] ?? "").toLowerCase();
  return inicio.getUTCMonth() === fin.getUTCMonth()
    ? `${inicio.getUTCDate()}–${fin.getUTCDate()} ${mes(fin)}`
    : `${inicio.getUTCDate()} ${mes(inicio)}–${fin.getUTCDate()} ${mes(fin)}`;
}

function fuenteDe(red: RedConsulta, post: { fuente: string; origen: string; creador?: string }): string {
  if (red === "tiktok") return post.creador === undefined ? "un creador" : `@${post.creador.replace(/^@/, "")}`;
  return post.origen === "hashtag" ? `#${post.fuente}` : post.fuente;
}

export function armarDocumentoInforme(
  doc: DocConsultas,
  c: Consulta,
  textos: DocRedesComentarios | null,
  lectura: LecturaInforme,
): DocumentoInforme {
  const fuentes: FuenteInforme[] = [
    ...REDES.map((red) => ({ red, nombre: NOMBRE_RED_INFORME[red], estado: c.plataformas[red].estado })),
    ...SIN_DATO.map((red) => ({ red, nombre: NOMBRE_RED_INFORME[red], estado: "sin_dato" as const })),
  ];

  const cifras: CifraInforme[] = REDES.map((red) => {
    const b = c.plataformas[red];
    return b.estado === "sin_dato"
      ? { red, nombre: NOMBRE_RED_INFORME[red], publicaciones: null, comentariosLeidos: null }
      : { red, nombre: NOMBRE_RED_INFORME[red], publicaciones: b.publicaciones, comentariosLeidos: b.comentarios_cosechados };
  });

  const destacadosPorRed: PuntoGrafica[] = [];
  const semanas = new Map<string, Map<RedConsulta, number>>();
  const destacados: DocumentoInforme["destacados"] = [];
  const candidatos: { red: RedConsulta; likes: number; url: string; fuente: string; titulo: string }[] = [];
  for (const red of REDES) {
    const b = c.plataformas[red];
    if (b.estado === "sin_dato") continue;
    destacadosPorRed.push({ label: NOMBRE_RED_INFORME[red], value: b.destacados.length });
    const filas: FilaDestacadoInforme[] = [];
    for (const d of b.destacados) {
      const lunes = lunesDe(d.fecha);
      const porRed = semanas.get(lunes) ?? new Map<RedConsulta, number>();
      porRed.set(red, (porRed.get(red) ?? 0) + 1);
      semanas.set(lunes, porRed);
      const fuente = fuenteDe(red, d);
      filas.push({
        fecha: d.fecha,
        fuente,
        primeraLinea: d.titulo,
        likes: d.likes ?? null,
        comentarios: d.comentarios ?? null,
        // Instagram no publica compartidos: ausente es «sin dato», no 0.
        compartidos: d.compartidos ?? null,
        url: d.url,
      });
      candidatos.push({ red, likes: d.likes ?? 0, url: d.url, fuente, titulo: d.titulo });
    }
    destacados.push({ red, nombre: NOMBRE_RED_INFORME[red], filas });
  }

  const lunesOrdenados = [...semanas.keys()].sort();
  const destacadosPorSemana: SerieGrafica[] = REDES
    .filter((red) => c.plataformas[red].estado !== "sin_dato")
    .map((red) => ({
      name: NOMBRE_RED_INFORME[red],
      data: lunesOrdenados.map((lunes) => ({ label: rotuloSemana(lunes), value: semanas.get(lunes)?.get(red) ?? 0 })),
    }));

  const conTexto: PublicacionConTextoInforme[] = [];
  if (textos !== null) {
    candidatos.sort((a, b) => b.likes - a.likes || a.url.localeCompare(b.url));
    for (const cand of candidatos) {
      const lista = textos.por_post[cand.url];
      if (!lista || lista.length === 0) continue;
      conTexto.push({
        red: cand.red,
        nombre: NOMBRE_RED_INFORME[cand.red],
        fuente: cand.fuente,
        titulo: cand.titulo,
        comentarios: lista.slice(0, TOPE_COMENTARIOS_POR_PUBLICACION),
      });
      if (conTexto.length >= TOPE_PUBLICACIONES_CON_TEXTO) break;
    }
  }

  const prensa = c.prensa;
  const titular = (r: { titulo: string; fuente: string; fecha: string | null; url: string; tono: TonoTitular | null }): TitularInforme => ({
    titulo: r.titulo, fuente: r.fuente, fecha: r.fecha, url: r.url, tono: r.tono,
  });
  return {
    termino: c.termino,
    tipo: NOMBRE_TIPO_INFORME[c.tipo],
    ventanaDias: doc.ventana_dias,
    ventanaPrensaDias: prensa.estado === "ok" ? (prensa.ventana_dias ?? doc.ventana_prensa_dias) : doc.ventana_prensa_dias,
    corte: doc.generado,
    resumen: frasesConsulta(c, doc),
    agregados: (c.agregados ?? []).map(titular),
    fuentes,
    cifras,
    destacadosPorRed,
    destacadosPorSemana,
    tono: c.tono,
    temas: c.temas.temas,
    temasMinimo: c.temas.minimo,
    lectura,
    destacados,
    conTexto,
    hayArchivoDeTexto: textos !== null,
    prensa: {
      estado: prensa.estado,
      resultados: (prensa.estado === "ok" ? prensa.resultados ?? [] : []).map(titular),
      anteriores: (prensa.estado === "ok" ? prensa.anteriores ?? [] : []).map(titular),
      tono: prensa.estado === "ok" ? prensa.tono ?? null : null,
      porMedio: (prensa.estado === "ok" ? prensa.por_medio ?? [] : []).map((m) => ({
        fuente: m.fuente, titulares: m.titulares, favorable: m.favorable, adversa: m.adversa, neutral: m.neutral,
      })),
      muestra: prensa.estado === "ok" ? prensa.muestra ?? null : null,
      archivo: prensa.archivo ? { coincidencias: prensa.archivo.coincidencias, muestra: prensa.archivo.muestra } : null,
    },
  };
}

/** «6 meses» / «30 días», para los rotulos del documento. */
export const ventana = rotuloVentana;

/** `pulso-n33-<id>-<fecha del corte>.pdf`. La fecha es la del dato, no la de
 *  la descarga: dos personas que bajen el mismo corte reciben el mismo nombre. */
export function nombreArchivoInforme(c: Consulta, doc: DocConsultas): string {
  return `pulso-n33-${c.id}-${doc.generado.slice(0, 10)}.pdf`;
}

/** Una cifra o «sin dato». Nunca un cero inventado. */
export const cifra = (n: number | null): string => (n === null ? "sin dato" : new Intl.NumberFormat("es-MX").format(n));

/**
 * Quita lo que Geist no cubre: emoji, pictogramas y sus selectores. El motor
 * de PDF falla el render entero ante un glifo sin fuente, y un comentario de
 * Instagram con un 🔥 no puede tumbar el informe. Se quita, no se sustituye:
 * un cuadro vacio diria algo que no esta en el texto.
 */
export const limpiarParaFuente = (texto: string): string =>
  texto.replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u{FE0F}\u{200D}\u{20E3}]/gu, "").replace(/\s{2,}/g, " ").trim();
