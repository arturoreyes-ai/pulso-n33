import type { Destacado } from "@/lib/datos/tipos";
import { fechaCorta, hora } from "@/lib/dominio/formato";
import type { PublicacionVisual } from "@/lib/dominio/publicaciones";
import type { Metricas, PublicacionSeguida } from "./contrato";

/**
 * Lo que la pagina de seguimiento dice de las cifras, en funciones puras.
 * Archivo `.ts` y no dentro de los componentes: un `.tsx` que exporta algo
 * que no es componente rompe el limite de Fast Refresh (ver ui/clases.ts).
 */

/** «28 sept, 9:36 pm», en hora de Tijuana. */
export const momento = (iso: string) => `${fechaCorta(iso)}, ${hora(iso)}`;

export type ClaveMetrica = keyof Metricas;

/**
 * Las cifras que CADA red publica de una publicacion ajena, en el orden en que
 * se dicen. Lo que una red no publica no se pinta ni como «sin dato»:
 * Instagram no da compartidos de nadie, y una fila de «compartidos sin dato» en
 * cada actualizacion diria que falta algo que nunca existio. Lo que la red SI
 * publica y no llego (una cuenta que oculta sus likes) se dice «sin dato».
 * Las reproducciones, solo en video.
 */
export function metricasDe(p: Pick<PublicacionSeguida, "red" | "tipo">): { clave: ClaveMetrica; nombre: [string, string] }[] {
  const video = p.tipo === "video";
  const likes = { clave: "likes" as const, nombre: p.red === "facebook" ? ["reacción", "reacciones"] as [string, string] : ["like", "likes"] as [string, string] };
  const comentarios = { clave: "comentarios" as const, nombre: ["comentario", "comentarios"] as [string, string] };
  const vistas = { clave: "reproducciones" as const, nombre: ["reproducción", "reproducciones"] as [string, string] };
  const compartidos = { clave: "compartidos" as const, nombre: ["compartido", "compartidos"] as [string, string] };
  const guardados = { clave: "guardados" as const, nombre: ["guardado", "guardados"] as [string, string] };
  if (p.red === "tiktok") return [likes, comentarios, vistas, compartidos, guardados];
  if (p.red === "instagram") return video ? [likes, comentarios, vistas] : [likes, comentarios];
  return video ? [likes, comentarios, vistas, compartidos] : [likes, comentarios, compartidos];
}

/** Lo que cambio una cifra desde la lectura anterior, o null si alguna de las
 *  dos no la trae: sin dato de un lado no hay diferencia que decir. */
export function diferencia(actual: Metricas | null, previa: Metricas | null, clave: ClaveMetrica): number | null {
  const a = actual?.[clave];
  const b = previa?.[clave];
  return a === null || a === undefined || b === null || b === undefined ? null : a - b;
}

/**
 * La publicacion en la forma que el embed del lector ya sabe pintar
 * (paneles/medio-social.tsx). Solo lee la URL, la red y el tipo; los conteos
 * van en cero porque el embed no los pinta y este objeto no sale de aqui.
 */
export function publicacionVisual(p: PublicacionSeguida): PublicacionVisual {
  const post: Destacado = {
    url: p.url,
    cuenta: "seguimiento",
    zona: "nacional",
    fecha: (p.publicado ?? p.creado).slice(0, 10),
    titulo: p.titulo ?? "",
    tipo: p.tipo ?? (p.red === "tiktok" ? "video" : "otro"),
    cosechados: 0,
    opinion: 0,
    sentimiento: { positivo: 0, negativo: 0, neutral: 0, sin_clasificar: 0, sin_modelo_idioma: 0 },
    temas: [],
  };
  return { post, red: p.red, fuente: p.creador ?? "", clave: p.id, url: p.url };
}
