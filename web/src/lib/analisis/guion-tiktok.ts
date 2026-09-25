import { json, SIN_CACHE } from "@/lib/busqueda/respuesta";
import { nombraAlguno, nombraRubro } from "@/lib/busqueda/tema-publicacion";
import { analisisHabilitado, MODELO_GUION } from "./config";
import { EJES_MINUTA, PROGRAMAS_GUION, type EjeMinuta } from "./contrato-guion";
import { leerDatoPublicado, videosTikTokParaGuion, type LeerDatos, type VideoGuion } from "./datos-redes";
import {
  decible,
  EJES_DEL_MODELO_N33,
  escribirGuion,
  fallo,
  huecosDe,
  nombraCalifornia,
  TERMINOS_IMPACTO,
  TERMINOS_MANANERA,
  type Plan,
} from "./guion";

export { guionFalsea, TERMINOS_CALIFORNIA, TERMINOS_MANANERA } from "./guion";

/**
 * Guion para locucion: lo que un conductor memoriza y dice sobre los videos de
 * TikTok del dia, con las reglas de extraccion de un programa del canal.
 *
 * EL CASO. El 24 de septiembre de 2026 el cliente cambio el foco del «Resumen
 * con IA» de la pestana TikTok (que vivio aqui un dia, 23 al 24 de
 * septiembre): en vez de un resumen, un guion por programa, pedido con un
 * boton. Mando la programacion y las reglas de la hora de edicion (11:00 a
 * 12:00): Noticias 33 saca exactamente cinco clips, uno de cada eje —garitas,
 * informacion de Tijuana, la mañanera de la presidenta, informacion de
 * California— y el quinto libre; De Red en Red saca un clip por cada tema de
 * espectaculos que se desarrolle. Un clip aqui es un video que el equipo
 * extrae y el texto que el conductor dice encima. El 25 de septiembre llegaron
 * Minuta Politica y Estado de Alerta; el prompt de cada uno vive en guion.ts,
 * compartido con el guion de prensa. El mismo dia el eje de garitas dejo de
 * ser un clip: la nota la arma la tarjeta con CBP (nota-garitas.ts), y
 * Noticias 33 saca cuatro clips mas esa nota, con el visto bueno del cliente.
 *
 * ES UN GUION, NO UN RESUMEN, desde la segunda version del mismo dia. La
 * primera pedia un titular y «dos a cuatro frases» por clip, y el cliente dijo
 * con razon que eso era un resumen: la forma la habia puesto el prompt, no el
 * modelo. Un guion de locucion tiene partes que un resumen no: una APERTURA
 * del segmento; por clip, la ENTRADA que el conductor dice a camara, el PASE
 * al clip y la SALIDA que remata o enlaza con el siguiente; y un CIERRE. El
 * esquema las exige una por una.
 *
 * QUE LEE EL MODELO: la primera linea del pie de cada video candidato,
 * numerados, y ya no su @ desde el 25 de septiembre de 2026, cuando el
 * cliente pidio que el guion no acreditara al creador. Ni conteos, ni
 * comentarios, ni subtitulos. Por eso lo que el guion agrega es ESTRUCTURA y
 * oficio de locucion, nunca datos: de un pie de una linea no sale una nota de
 * un minuto, y lo que un modelo rellena lo saca de su entrenamiento, no de
 * estos videos.
 *
 * LOS EJES LOS DECIDE EL CODIGO, no el modelo. Mañanera y California
 * por los terminos del titulo (tema-publicacion.ts::nombraAlguno), Tijuana por
 * la zona que el pipeline ya le puso al video, y California tambien por la de
 * San Diego. La coyuntura de Minuta Politica, por la zona: `local` es el
 * corredor y el estado, `nacional` es `nacional`. El modelo solo elige entre
 * los candidatos de cada eje y escribe; un clip que cita un video fuera de la
 * lista de su eje no se publica. Un eje sin un solo candidato se dice
 * (`faltantes`) y NO se rellena con otro: un clip de Tijuana haciendose pasar
 * por California romperia la regla del cliente de otra manera, peor.
 *
 * ES UN BOTON, y deja de ser la excepcion que era el resumen, que se pedia
 * solo al abrir la pestana. La respuesta se cachea seis horas en el CDN por
 * programa y corte, asi que pulsar dos veces en un ciclo cuesta una llamada.
 *
 * LO QUE NO PUEDE DECIR es lo del resumen: los pies son de creadores
 * cualesquiera y el guion nunca da por cierto lo que AFIRMAN. Hasta el 25 de
 * septiembre de 2026 eso lo sostenia la atribucion («segun un video publicado
 * por @cuenta»); desde entonces, sin creador, lo sostiene el registro («se
 * informa que», «circula en redes que»). Un conductor lo va a decir al aire,
 * asi que eso pesa mas aqui, no menos. Las reglas 1 y 2 las impone reglas.ts
 * sobre todo lo que escribio.
 *
 * `solicitar` y `leer` se inyectan; la unica salida de red es el modelo, y
 * probar-analisis.cjs lo afirma.
 */

/** Seis horas: el ciclo del cron. */
export const CACHE_GUION_TIKTOK = "public, max-age=0, s-maxage=21600, stale-while-revalidate=86400";

/** Candidatos por eje de Noticias 33 y de Minuta Politica: los mas vistos. */
export const CANDIDATOS_POR_EJE = 6;
/** Candidatos de los programas por tema sin ejes. */
export const CANDIDATOS_POR_TEMA = 12;

type EjeDelModelo = (typeof EJES_DEL_MODELO_N33)[number];

/** Sin garitas desde el 25 de septiembre de 2026: la nota la arma la tarjeta
 *  con /api/garitas (nota-garitas.ts), y el eje ya no saca clip. */
const esEje: Record<EjeDelModelo, (v: VideoGuion) => boolean> = {
  tijuana: (v) => v.zona === "Tijuana",
  mananera: (v) => nombraAlguno(v.titulo, TERMINOS_MANANERA),
  california: (v) => v.zona === "San Diego" || nombraCalifornia(v.titulo),
};

/**
 * Lo local, para Minuta Politica y Estado de Alerta: cualquier zona del
 * corredor o el estado. `nacional` e `internacional` quedan fuera de lo local.
 */
const esLocal = (v: VideoGuion) => v.zona !== "nacional" && v.zona !== "internacional";

/** Los candidatos de cada eje, del mas visto al menos. Puro y exportado. */
export function candidatosNoticias33(videos: readonly VideoGuion[]): Record<EjeDelModelo, VideoGuion[]> {
  const salida = {} as Record<EjeDelModelo, VideoGuion[]>;
  for (const eje of EJES_DEL_MODELO_N33) salida[eje] = videos.filter(esEje[eje]).slice(0, CANDIDATOS_POR_EJE);
  return salida;
}

export function candidatosDeRedEnRed(videos: readonly VideoGuion[]): VideoGuion[] {
  return videos.filter((v) => nombraRubro(v.titulo, "espectaculos")).slice(0, CANDIDATOS_POR_TEMA);
}

/**
 * Los terminos de Politica de la fila de temas, sobre el pie, repartidos por
 * zona. Lo internacional no entra: medido el 24 de septiembre de 2026, dos de
 * los seis videos que nombraban Politica eran de Venezuela y de Alemania, y el
 * cliente pidio coyuntura «local y nacional».
 */
export function candidatosMinuta(videos: readonly VideoGuion[]): Record<EjeMinuta, VideoGuion[]> {
  const politicos = videos.filter((v) => nombraRubro(v.titulo, "politica"));
  const salida = {} as Record<EjeMinuta, VideoGuion[]>;
  for (const eje of EJES_MINUTA) {
    salida[eje] = politicos.filter((v) => (eje === "local" ? esLocal(v) : v.zona === "nacional")).slice(0, CANDIDATOS_POR_EJE);
  }
  return salida;
}

/**
 * Seguridad (la lista de la fila de temas) o un hecho de impacto, y solo lo
 * local. Estado de Alerta es la nota roja de un canal de Tijuana: medido el 24
 * de septiembre de 2026, cuatro de los trece videos de Seguridad eran de fuera
 * (fosas en Michoacan, una emboscada en Guanajuato), y la nota roja de todo el
 * pais es justo la que satura cualquier lista.
 */
export function candidatosAlerta(videos: readonly VideoGuion[]): VideoGuion[] {
  return videos
    .filter((v) => esLocal(v) && (nombraRubro(v.titulo, "seguridad") || nombraAlguno(v.titulo, TERMINOS_IMPACTO)))
    .slice(0, CANDIDATOS_POR_TEMA);
}

/** La lista numerada que lee el modelo: cada video una vez, del mas visto al
 *  menos, con el numero que el modelo cita. */
function numerar(videos: readonly VideoGuion[], usados: ReadonlySet<string>): VideoGuion[] {
  return videos.filter((v) => usados.has(v.url));
}

const MENSAJE_POCOS: Record<(typeof PROGRAMAS_GUION)[number], string> = {
  noticias33: "No hay videos de hoy para los ejes de Noticias 33.",
  deredenred: "No hay videos de entretenimiento de hoy.",
  minutapolitica: "No hay videos de política de hoy.",
  estadodealerta: "No hay videos de nota roja de hoy.",
};

/** El plan de un programa sobre los videos del archivo, o null si no hay de
 *  que escribir. Puro y exportado. */
export function planTikTok(programa: (typeof PROGRAMAS_GUION)[number], videos: readonly VideoGuion[]): Plan | null {
  const base = { origen: "tiktok" as const, programa, sinLeer: [] };
  if (programa === "noticias33" || programa === "minutapolitica") {
    const candidatos: Record<string, VideoGuion[]> = programa === "noticias33" ? candidatosNoticias33(videos) : candidatosMinuta(videos);
    const todos = Object.values(candidatos).flat();
    if (todos.length === 0) return null;
    const lista = numerar(videos, new Set(todos.map((v) => v.url)));
    return { ...base, lista, candidatos, faltantes: huecosDe(programa, candidatos).faltantes };
  }
  const lista = programa === "deredenred" ? candidatosDeRedEnRed(videos) : candidatosAlerta(videos);
  return lista.length === 0 ? null : { ...base, lista, candidatos: null, faltantes: [] };
}

export async function responderGuionTikTok(
  params: { p: string | null },
  solicitar: typeof fetch = fetch,
  leer: LeerDatos = leerDatoPublicado,
  /** Solo para comparar modelos a mano; la ruta usa siempre MODELO_GUION. */
  modelo: string = MODELO_GUION,
): Promise<Response> {
  if (!analisisHabilitado()) {
    return json({ codigo: "apagado", mensaje: "El guion automático no está disponible." }, 400, SIN_CACHE);
  }
  const programa = PROGRAMAS_GUION.find((p) => p === params.p);
  if (programa === undefined) return json({ codigo: "programa", mensaje: "Programa desconocido." }, 400, SIN_CACHE);

  const videos = await videosTikTokParaGuion(leer);
  if (videos === "sin-datos") return fallo("Los videos no están disponibles en esta vista.", "datos");

  const plan = planTikTok(programa, videos.filter(decible));
  if (plan === null) return fallo(MENSAJE_POCOS[programa], "pocos");
  return escribirGuion(plan, { solicitar, modelo, cache: CACHE_GUION_TIKTOK });
}
