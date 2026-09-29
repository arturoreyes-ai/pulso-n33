import { json, SIN_CACHE } from "@/lib/busqueda/respuesta";
import type { Destacado, DocRedes } from "@/lib/datos/tipos";
import { FRESCURA_HORAS } from "@/lib/dominio/formato";
import {
  canonizarPublicacion,
  fuenteDePublicacion,
  intercalarPorPuesto,
  meritoDe,
  NOMBRE_RED,
  nombresDeCuentas,
  type PublicacionVisual,
  type RedVisual,
} from "@/lib/dominio/publicaciones";
import { analisisHabilitado, MODELO_GUION } from "./config";
import { PROGRAMAS_GUION } from "./contrato-guion";
import { leerDatoPublicado, type LeerDatos, type VideoGuion } from "./datos-redes";
import { decible, escribirGuion, fallo, type Plan } from "./guion";
import { planTikTok } from "./guion-tiktok";

/**
 * Guion para locucion sobre las REDES: los videos y las publicaciones de
 * TikTok, Instagram y Facebook del dia, y los videos de YouTube que de verdad
 * se vieron. Es el guion de la pestana TikTok (guion-tiktok.ts) con mas
 * material: los mismos ejes, las mismas reglas y el mismo prompt, que vive en
 * guion.ts con el origen `redes`.
 *
 * EL CASO. El 25 de septiembre de 2026 el cliente pidio en /redes el mismo
 * boton de la portada, «pero en vez de solo TikTok, para TikTok, Instagram,
 * Facebook, y YouTube solo si tiene muchas vistas». El guion vivia como una
 * tarjeta de la pestana TikTok, y leia solo tiktok.json.
 *
 * EL ORDEN ES EL INTERCALADO DE «POPULARES», no el de las cifras. Los likes de
 * Instagram, los de TikTok, las reacciones de Facebook y las vistas de YouTube
 * no son una unidad, y ordenar por el numero crudo pondria a TikTok delante de
 * todo (el razonamiento esta en publicaciones.ts::ordenarPublicaciones). Asi
 * que cada publicacion va por su puesto dentro de su red, intercaladas, y el
 * modelo las lee en ese orden. Pero el puesto es por RITMO y no por la cifra
 * (ver `ritmo`), y en eso difiere de la pagina.
 *
 * LO DE HOY, CONTADO DESDE AHORA (28 de septiembre de 2026). Medido ese dia a
 * las 3:05 pm de Tijuana: la ultima cosecha era de las 6:56 am, porque la
 * corrida de las 11:53 se cayo en el paso de gasto electoral, y las quince
 * publicaciones mas votadas de cada red tenian una mediana de 13 a 18 horas
 * AL COSECHARSE: 0 de 15 con menos de seis horas en TikTok y en YouTube. El
 * guion decia como de hoy lo de anoche, y nada lo miraba: los titulares
 * pasaban por guion-prensa.ts::reciente y las publicaciones por nada. Si las
 * cosechas se paran (del 24 al 25 de septiembre se pararon), habria leido
 * publicaciones de hace dias. Ahora:
 *  - una publicacion entra solo si salio en las ultimas `HORAS_GUION_REDES`
 *    contadas desde que se pide el guion, no desde la cosecha; sin
 *    `publicado` no se puede afirmar que sea de hoy y no entra;
 *  - una red cuya cosecha tiene mas de `FRESCURA_HORAS` (el umbral con que
 *    las tarjetas dejan de decir «hace 2 h») no se lee: va a `sinLeer`, como
 *    si su archivo faltara, en vez de rellenar con lo viejo;
 *  - `hasta` es la cosecha mas vieja de las redes leidas, y la pagina dice
 *    hasta que hora llegan las publicaciones.
 *
 * YOUTUBE, SOLO LO MUY VISTO (`MINIMO_VISTAS`), y con un umbral por formato,
 * porque las vistas de un Short y las de un video largo no cuentan lo mismo
 * (AGENTS.md: desde marzo de 2025 un Short cuenta cualquier arranque o
 * repeticion). Medido el 25 de septiembre de 2026 sobre las 104 piezas del
 * corte: videos largos con mediana de 1,760 vistas y Shorts con 8,048. Con
 * 5,000 para un video y 10,000 para un Short pasan 27 de 62 y 18 de 42, la
 * misma proporcion en los dos, y del corredor pasan las tres que se
 * movieron: el huracan Polo hacia Baja California (59,482), la familia
 * desaparecida en Tijuana de Canal 33 (11,741) y el caso de los policias de
 * Tijuana de N+ (7,059). Con un solo umbral de 5,000, un Short por debajo de
 * la mediana de los Shorts contaria como «muy visto».
 *
 * QUE LEE EL MODELO: la primera linea de cada publicacion (el titulo en
 * YouTube), numeradas. Ni la cuenta, ni la red, ni conteos, ni comentarios:
 * lo que no lee no lo puede decir, y el guion no cita fuentes. La cuenta y el
 * enlace van en cada pieza para el equipo que edita.
 *
 * `solicitar` y `leer` se inyectan; la unica salida de red es el modelo, y
 * probar-analisis.cjs lo afirma.
 */

/** Seis horas: el ciclo del cron, como el guion de TikTok. */
export const CACHE_GUION_REDES = "public, max-age=0, s-maxage=21600, stale-while-revalidate=86400";

/** Los archivos que lee, en el orden de desempate de «populares». */
export const ARCHIVOS_GUION_REDES: Record<RedVisual, string> = {
  tiktok: "tiktok.json",
  instagram: "redes.json",
  facebook: "facebook.json",
  youtube: "youtube.json",
};

/** YouTube entra solo con estas vistas o mas, por formato (ver arriba). */
export const MINIMO_VISTAS: Record<"short" | "video", number> = { video: 5000, short: 10000 };

/** Una publicacion es de hoy si salio en estas horas, contadas desde que se
 *  pide el guion. Las mismas 24 de los titulares (guion-prensa.ts). */
export const HORAS_GUION_REDES = 24;

/**
 * Cuanto pesa la edad en el ritmo. Los likes se acumulan: por el numero crudo,
 * lo de anoche le gana siempre a lo de esta manana. Medido sobre el corte del
 * 28 de septiembre de 2026 (14:00Z): por likes, las diez primeras de Instagram
 * tenian una mediana de 18.6 horas y una sola con menos de ocho; por
 * likes / (horas + 2)^1.5, 12.5 horas y tres, con cuatro de diez cambiadas.
 * En TikTok y en Facebook cambia una de diez: lo muy votado de anoche sigue
 * arriba si de verdad se movio. Es la gravedad de los agregadores de
 * noticias, por debajo de la de Hacker News (1.8).
 */
export const GRAVEDAD_RITMO = 1.5;

/** El merito por hora de vida AL COSECHARSE, que es cuando se contaron los
 *  likes: medir la edad contra ahora castigaria a todas por igual. Las dos
 *  horas de gracia evitan que un post de diez minutos con tres likes encabece. */
export function ritmo(merito: number, horas: number): number {
  return merito / Math.pow(Math.max(0, horas) + 2, GRAVEDAD_RITMO);
}

/** Si una cosecha es de las ultimas `FRESCURA_HORAS`. Un `generado` ilegible
 *  no se puede afirmar vigente. */
export function cosechaVigente(generado: string | undefined, ahora: string): boolean {
  const edad = Date.parse(ahora) - Date.parse(generado ?? "");
  return Number.isFinite(edad) && edad <= FRESCURA_HORAS * 3_600_000;
}

/** Si un video de YouTube tiene vistas de sobra para su formato. Sin
 *  `formato` o sin vistas no se puede afirmar que se vio mucho: no entra. */
export function muyVisto(post: Pick<Destacado, "formato" | "reproducciones">): boolean {
  if (post.formato === undefined || post.reproducciones === undefined) return false;
  return post.reproducciones >= MINIMO_VISTAS[post.formato];
}

/**
 * Las publicaciones de hoy de las cuatro redes, por ritmo e intercaladas, como
 * las lee el guion: el archivo ENTERO de cada red, no la seleccion de un lugar
 * (un programa no cambia de ejes segun la pagina, igual que en TikTok). Un
 * titulo vacio no aporta nada que decir y una URL que no se puede canonizar no
 * se puede citar. `leidas` son las redes con una cosecha vigente, y `hasta` la
 * mas vieja de ellas (null si ninguna).
 */
export async function publicacionesParaGuion(leer: LeerDatos, ahora: string): Promise<{ videos: VideoGuion[]; leidas: RedVisual[]; hasta: string | null }> {
  const filas: PublicacionVisual[] = [];
  const leidas: RedVisual[] = [];
  const cosechas: string[] = [];
  const ritmos = new Map<string, number>();
  const vistos = new Set<string>();
  const desde = Date.parse(ahora) - HORAS_GUION_REDES * 3_600_000;
  for (const red of Object.keys(ARCHIVOS_GUION_REDES) as RedVisual[]) {
    const crudo = await leer(ARCHIVOS_GUION_REDES[red]);
    if (crudo === null || typeof crudo !== "object") continue;
    const datos = crudo as DocRedes;
    if (!cosechaVigente(datos.generado, ahora)) continue;
    leidas.push(red);
    cosechas.push(datos.generado);
    const cosechado = Date.parse(datos.generado);
    const nombres = nombresDeCuentas(datos);
    for (const post of datos.destacados ?? []) {
      if (red === "youtube" && !muyVisto(post)) continue;
      const salio = Date.parse(post.publicado ?? "");
      if (!Number.isFinite(salio) || salio < desde) continue;
      const url = canonizarPublicacion(post.url, red);
      const clave = `${red}:${url}`;
      if (url === null || (post.titulo ?? "").trim() === "" || vistos.has(clave)) continue;
      vistos.add(clave);
      ritmos.set(clave, ritmo(meritoDe(post, red), (cosechado - salio) / 3_600_000));
      filas.push({ post, red, clave, url, fuente: fuenteDePublicacion(post, red, nombres) });
    }
  }
  const porRitmo = () => (a: PublicacionVisual, b: PublicacionVisual) => (ritmos.get(b.clave) ?? 0) - (ritmos.get(a.clave) ?? 0);
  const videos = intercalarPorPuesto(filas, porRitmo).map((f) => ({
    url: f.url!, fuente: f.fuente, titulo: f.post.titulo.trim(), zona: f.post.zona,
  }));
  const hasta = cosechas.length === 0 ? null : cosechas.reduce((a, b) => (Date.parse(b) < Date.parse(a) ? b : a));
  return { videos, leidas, hasta };
}

const MENSAJE_POCOS: Record<(typeof PROGRAMAS_GUION)[number], string> = {
  noticias33: "No hay publicaciones de hoy para los ejes de Noticias 33.",
  deredenred: "No hay publicaciones de entretenimiento de hoy.",
  minutapolitica: "No hay publicaciones de política de hoy.",
  estadodealerta: "No hay publicaciones de nota roja de hoy.",
};

/**
 * El plan: las reglas de candidatos de TikTok sobre las cuatro redes. Una red
 * que no se pudo leer va a `sinLeer` con su nombre («No se pudieron leer:
 * Facebook»): sin eso, un eje vacio por falta de ese archivo se diria «sin
 * publicaciones hoy», que es afirmar un hueco que nadie midio.
 */
export function planRedes(programa: (typeof PROGRAMAS_GUION)[number], videos: readonly VideoGuion[], leidas: readonly RedVisual[] = Object.keys(ARCHIVOS_GUION_REDES) as RedVisual[], hasta: string | null = null): Plan | null {
  const plan = planTikTok(programa, videos);
  if (plan === null) return null;
  const sinLeer = (Object.keys(ARCHIVOS_GUION_REDES) as RedVisual[]).filter((r) => !leidas.includes(r)).map((r) => NOMBRE_RED[r]);
  return { ...plan, origen: "redes", sinLeer, hasta };
}

export async function responderGuionRedes(
  params: { p: string | null },
  solicitar: typeof fetch = fetch,
  ahora: string = new Date().toISOString(),
  leer: LeerDatos = leerDatoPublicado,
  /** Solo para comparar modelos a mano; la ruta usa siempre MODELO_GUION. */
  modelo: string = MODELO_GUION,
): Promise<Response> {
  if (!analisisHabilitado()) {
    return json({ codigo: "apagado", mensaje: "El guion automático no está disponible." }, 400, SIN_CACHE);
  }
  const programa = PROGRAMAS_GUION.find((p) => p === params.p);
  if (programa === undefined) return json({ codigo: "programa", mensaje: "Programa desconocido." }, 400, SIN_CACHE);

  const { videos, leidas, hasta } = await publicacionesParaGuion(leer, ahora);
  if (leidas.length === 0) return fallo("Las publicaciones no están disponibles en esta vista.", "datos");

  const plan = planRedes(programa, videos.filter(decible), leidas, hasta);
  if (plan === null) return fallo(MENSAJE_POCOS[programa], "pocos");
  // Una red que no se pudo leer no deja el guion en blanco, pero la copia no
  // se guarda seis horas: la siguiente pulsacion la vuelve a intentar.
  const completa = leidas.length === Object.keys(ARCHIVOS_GUION_REDES).length;
  return escribirGuion(plan, { solicitar, modelo, cache: completa ? CACHE_GUION_REDES : SIN_CACHE });
}
