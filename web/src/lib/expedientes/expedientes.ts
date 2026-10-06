import burgueno from "./ismael-burgueno-2026.json";
import burguenoAno from "./ismael-burgueno-2026-redes.json";

/**
 * Los expedientes: un informe editorial FIJO sobre una persona o un tema,
 * escrito a mano a pedido del cliente y con fecha de corte. No es un termino
 * en seguimiento (config/consultas.json) y no se regenera con la ingesta: es
 * la foto de un dia, y por eso vive aqui y no en data/, que escribe el bot.
 *
 * El primero se pidio el 2 de octubre de 2026: «lo mas impactante, lo mas
 * polemico, lo que mas traccion gano» de Ismael Burgueño en el ultimo ano,
 * con herramientas gratuitas ANTES de gastar en Apify. Como se armo esta en
 * la `nota` del JSON; la pantalla no lo explica (regla de «la interfaz dice
 * que, nunca como»).
 *
 * Se importa solo desde componentes de servidor: /reportes es de
 * administradores y el JSON pesa ~190 KB, asi que no debe viajar en el bundle
 * de nadie. Sin tono a proposito: un expediente sobre una figura del roster
 * cruzaria tono con figura, que es la regla 5.
 */

/** Un tramo de texto: llano, un enlace a la fuente o un arranque en negritas. */
export type Segmento = string | { t: string; url?: string; fuerte?: boolean };

/** Un momento de una historia que vino en oleadas (la FGR: nov, jun, sep). */
export interface Oleada { cuando: string; texto: Segmento[] }

/** La forma de cada bloque la dice su llave, no un `tipo` literal: asi el
 *  JSON importado se comprueba contra el tipo sin un `as`. */
export type Bloque = { parrafo: Segmento[] } | { oleadas: Oleada[] };

export interface TitularExpediente { fecha: string; titulo: string; medio: string; url: string }

export interface Historia {
  id: string;
  titulo: string;
  /** Una o dos frases: la historia en el PDF, que es un informe condensado
   *  para la direccion. La pantalla pinta `cuerpo`. */
  resumen: string;
  /** Medios distintos con al menos un titular que lo nombra en esta historia. */
  medios: number;
  /** Cuales de esos medios son de alcance nacional. Lista escrita a mano. */
  nacionales: string[];
  cuerpo: Bloque[];
  titulares: TitularExpediente[];
}

export interface PublicacionExpediente {
  red: "youtube" | "tiktok" | "facebook" | "instagram";
  /** null: la red no la dice en la URL y no se adivina (una publicacion que
   *  llego por /seguimiento y no por el catalogo). */
  cuenta: string | null;
  fecha: string;
  titulo: string;
  alcance: number;
  unidad: string;
  /** null: la red no lo trajo (YouTube no publica el conteo por feed). Nunca 0. */
  comentarios: number | null;
  url: string;
}

/** El año en redes (pulso/expediente_redes.py): sus cuentas y TikTok. */
export const REDES_DEL_ANO = ["tiktok", "instagram", "facebook"] as const;
export type RedDelAno = (typeof REDES_DEL_ANO)[number];

export interface PublicacionDelMes {
  url: string;
  /** La cuenta propia o, en TikTok, el @ de quien publicó el video. */
  cuenta: string;
  propia: boolean;
  fecha: string;
  titulo: string;
  likes: number;
  comentarios: number;
  /** Ausentes si la red no las trajo; nunca 0. */
  reproducciones?: number;
  compartidos?: number;
  /** Comentarios leídos (hasta `comentarios_por_post`). */
  cosechados: number;
  tono?: { positivo: number; negativo: number; neutral: number; sin_clasificar: number; sin_modelo_idioma: number };
}

export interface AnoEnRedes {
  desde: string;
  hasta: string;
  por_mes: number;
  comentarios_por_post: number;
  sin_dato: RedDelAno[];
  salvedad_tono: string;
  meses: { mes: string; redes: Partial<Record<RedDelAno, PublicacionDelMes[]>> }[];
}

export interface Expediente {
  nota: string;
  id: string;
  persona: string;
  cargo: string;
  desde: string;
  hasta: string;
  titulares: number;
  medios: number;
  proximo: { fecha: string; evento: string } | null;
  /** Los hallazgos, cada uno con su titulo propio: la pantalla los pinta
   *  como bloques que se recorren con la vista, no como un parrafo largo. */
  enCorto: { titulo: string; texto: Segmento[] }[];
  meses: { mes: string; titulares: number; polemica: number }[];
  historias: Historia[];
  /** Lo menor: titulares reales, con su medio y su enlace; `detalle` es la
   *  nota del expediente, o null si el titular basta. */
  otros: { fecha: string; titulo: string; medio: string; url: string; detalle: string | null }[];
  redes: { desde: string; publicaciones: PublicacionExpediente[] };
  /** null: el expediente no tiene lectura del año en redes. */
  ano: AnoEnRedes | null;
}

/** El JSON del año en redes llega con `red` y las llaves de `redes` como
 *  string; se estrecha aquí, una vez, como `publicaciones` abajo. Lo valida
 *  pulso/validador.py::validar_expediente_redes antes de escribirse. */
function anoDe(doc: typeof burguenoAno): AnoEnRedes {
  return {
    desde: doc.desde,
    hasta: doc.hasta,
    por_mes: doc.por_mes,
    comentarios_por_post: doc.comentarios_por_post,
    sin_dato: doc.sin_dato as RedDelAno[],
    salvedad_tono: doc.salvedad_tono,
    meses: doc.meses.map((m) => ({ mes: m.mes, redes: m.redes as AnoEnRedes["meses"][number]["redes"] })),
  };
}

const BURGUENO: Expediente = {
  ...burgueno,
  ano: anoDe(burguenoAno),
  redes: {
    ...burgueno.redes,
    // `red` llega del JSON como string; se estrecha aqui, una vez.
    publicaciones: burgueno.redes.publicaciones.map((p) => ({ ...p, red: p.red as PublicacionExpediente["red"] })),
  },
};

export const EXPEDIENTES: readonly Expediente[] = [BURGUENO];

export function expedientePorId(id: string): Expediente | undefined {
  return EXPEDIENTES.find((e) => e.id === id);
}

export const rutaDeExpediente = (id: string) => `/reportes/${id}`;

/** La descarga del PDF (app/api/expediente). Sin version: no se guarda en
 *  ningun cache, se arma en cada descarga. */
export const rutaDelPdf = (id: string) => `/api/expediente?e=${encodeURIComponent(id)}`;
