import { json, SIN_CACHE } from "@/lib/busqueda/respuesta";
import type { ResumenDelAno } from "./comentarios";
import { expedientePorId, REDES_DEL_ANO, type AnoEnRedes, type Expediente, type PublicacionDelMes, type RedDelAno } from "./expedientes";

/**
 * /api/expediente?e=<id>: el expediente de /reportes en PDF (cliente, 2 de
 * octubre de 2026). Hermano de lib/informe/informe.ts, el PDF de un termino:
 * mismo motor (pdfcn sobre Takumi), mismas fuentes, mismo tema.
 *
 * Lo que trae y de donde:
 *  - El expediente y su año en redes, del modulo (lib/expedientes/): ya estan
 *    en el bundle del servidor.
 *  - Los resumenes de IA de lo que dicen los comentarios de cada publicacion
 *    del año, del archivo de texto (lib/expedientes/comentarios.ts), que no
 *    va a git. Ningun comentario va al papel (cliente, 2 de octubre de 2026:
 *    un informe condensado para la direccion). Solo lectura: nada se cobra
 *    ni se pide.
 *
 * Hasta el 5 de octubre de 2026 la seccion de redes eran las publicaciones de
 * septiembre en seguimiento, leidas de la base; ese dia la pantalla cambio
 * «En redes» por el año entero (cliente: «muestra el reporte de redes del año
 * completo») y el PDF la sigue, porque el PDF es la pantalla condensada.
 *
 * Sin cache: lleva resumenes derivados del texto de los comentarios, que
 * vence a los 30 dias con el, y es de administradores, como /reportes.
 *
 * Sin archivo de texto el PDF sale igual y los resumenes dicen «sin dato»,
 * nunca un vacio que se lea como «nadie comento». El motor que falla es 503,
 * nunca un PDF a medias.
 */

/** Cuantas publicaciones por red llevan su resumen en el papel: las mas
 *  vistas del año. La pantalla las tiene todas, detras de un toque. */
export const RESUMIDAS_POR_RED = 3;

/** Un resumen listo para el papel: los temas con cuantos comentarios tratan. */
export interface ResumenPdf { texto: string; leidos: number; temas: { nombre: string; n: number }[] }

/** null: no hay archivo de texto en este despliegue. */
export type ResumenesPdf = Record<string, ResumenPdf> | null;

/** Lo que la ruta necesita fuera del modulo. Se inyecta para probar sin disco. */
export interface FuenteResumenes {
  resumenes(id: string): Promise<Record<string, ResumenDelAno> | null>;
}

export type RenderizarExpediente = (e: Expediente, resumenes: ResumenesPdf, generado: string) => Promise<Uint8Array>;

export const fuenteArchivo: FuenteResumenes = {
  async resumenes(id) {
    const { resumenesDelExpediente } = await import("./comentarios");
    return resumenesDelExpediente(id);
  },
};

const aPdf = (r: ResumenDelAno): ResumenPdf => ({
  texto: r.texto,
  leidos: r.leidos,
  temas: r.temas.map((t) => ({ nombre: t.nombre, n: t.comentarios.length })).filter((t) => t.n > 0),
});

/** La cifra con que se ordena cada red, la misma que la pantalla
 *  (reportes/reporte-redes.tsx): vistas en TikTok, likes en Instagram,
 *  reacciones en Facebook. Un TikTok sin vistas se mide en likes. */
export function cifraDelAno(red: RedDelAno, p: PublicacionDelMes): number {
  return red === "tiktok" ? (p.reproducciones ?? p.likes) : p.likes;
}

export interface PublicacionDelAno { red: RedDelAno; mes: string; p: PublicacionDelMes }

/** Las publicaciones de una red en todo el año, de la mas vista a la menos. */
export function delAnoPorRed(ano: AnoEnRedes, red: RedDelAno): PublicacionDelAno[] {
  return ano.meses
    .flatMap((m) => (m.redes[red] ?? []).map((p) => ({ red, mes: m.mes, p })))
    .sort((a, b) => cifraDelAno(red, b.p) - cifraDelAno(red, a.p) || a.p.url.localeCompare(b.p.url));
}

/** El tono de los comentarios leidos de UNA red en el año. Por red y sin
 *  total: los de sus cuentas son su audiencia y los de TikTok cualquiera, y
 *  sumarlos mezclaria dos publicos en una cifra. */
export function tonoDeRed(ano: AnoEnRedes, red: RedDelAno): { publicaciones: number; positivo: number; negativo: number; neutral: number; sinTono: number } {
  const salida = { publicaciones: 0, positivo: 0, negativo: 0, neutral: 0, sinTono: 0 };
  for (const m of ano.meses) {
    for (const p of m.redes[red] ?? []) {
      if (p.tono === undefined) continue;
      salida.publicaciones += 1;
      salida.positivo += p.tono.positivo;
      salida.negativo += p.tono.negativo;
      salida.neutral += p.tono.neutral;
      salida.sinTono += p.tono.sin_clasificar + p.tono.sin_modelo_idioma;
    }
  }
  return salida;
}

/** Los temas que reaparecen entre publicaciones del año con el MISMO nombre,
 *  con cuantos comentarios suman y en cuantas publicaciones salen. Solo
 *  nombres identicos: juntar «Rechazo a su regreso» con «Rechazo a otro
 *  periodo» seria una lectura nuestra encima de la del modelo. */
export function temasRepetidos(resumenes: readonly ResumenPdf[]): { nombre: string; n: number; publicaciones: number }[] {
  const por = new Map<string, { n: number; publicaciones: number }>();
  for (const r of resumenes) {
    for (const t of r.temas) {
      const a = por.get(t.nombre) ?? { n: 0, publicaciones: 0 };
      por.set(t.nombre, { n: a.n + t.n, publicaciones: a.publicaciones + 1 });
    }
  }
  return [...por.entries()]
    .filter(([, v]) => v.publicaciones > 1)
    .map(([nombre, v]) => ({ nombre, ...v }))
    .sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre));
}

/** Los resumenes de las publicaciones del año, por URL, listos para el papel. */
export async function resumenesDelAno(e: Expediente, fuente: FuenteResumenes): Promise<ResumenesPdf> {
  if (e.ano === null) return null;
  let crudos: Record<string, ResumenDelAno> | null = null;
  try {
    crudos = await fuente.resumenes(e.id);
  } catch {
    // Sin archivo: los resumenes salen «sin dato».
  }
  if (crudos === null) return null;
  const urls = new Set(REDES_DEL_ANO.flatMap((red) => delAnoPorRed(e.ano as AnoEnRedes, red).map((x) => x.p.url)));
  return Object.fromEntries(Object.entries(crudos).filter(([url]) => urls.has(url)).map(([url, r]) => [url, aPdf(r)]));
}

/** El dia en Tijuana, no en UTC: a las 6 pm del 2 de octubre UTC ya es 3, y
 *  el archivo y el pie decian una fecha que el equipo todavia no vivia. */
export const diaEnTijuana = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tijuana" }).format(new Date(iso));

export const nombreArchivoExpediente = (e: Expediente, generado: string) => `pulso-expediente-${e.id}-${diaEnTijuana(generado)}.pdf`;

export async function responderExpedientePdf(
  params: { e: string | null },
  fuente: FuenteResumenes = fuenteArchivo,
  renderizar: RenderizarExpediente | null = null,
  ahora: () => Date = () => new Date(),
): Promise<Response> {
  const e = expedientePorId(params.e ?? "");
  if (e === undefined) return json({ codigo: "expediente", mensaje: "No hay un expediente con ese nombre." }, 404, SIN_CACHE);
  const generado = ahora().toISOString();
  const resumenes = await resumenesDelAno(e, fuente);
  let bytes: Uint8Array;
  try {
    const motor = renderizar ?? (await import("./render-pdf")).renderizarExpediente;
    bytes = await motor(e, resumenes, generado);
  } catch {
    return json({ codigo: "informe", mensaje: "El PDF no se pudo armar esta vez." }, 503, SIN_CACHE);
  }
  return new Response(new Uint8Array(bytes).buffer, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${nombreArchivoExpediente(e, generado)}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex",
    },
  });
}
