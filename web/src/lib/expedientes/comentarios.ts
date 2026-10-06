import { readFile } from "node:fs/promises";
import path from "node:path";

import type { ComentarioPublicado } from "@/lib/datos/tipos";

/**
 * El texto de los comentarios del año en redes de un expediente, y el resumen
 * de IA de cada publicacion. Vive en data/expedientes-comentarios.json, que NO
 * va a git (regla `data/*-comentarios.json`) y llega a public/data con el
 * resto de data/; lo escribe `python -m pulso expediente-redes`, y los
 * resumenes `web/scripts/resumir-expediente.cjs`.
 *
 * Se lee del disco en el servidor, como /api/analizar-publicacion: /data/
 * esta detras de la sesion y una peticion a si mismo daria 401 en
 * produccion. Sin el archivo devuelve null, y la hoja dice que el texto no
 * esta disponible en esta vista: es lo que pasa en un despliegue hecho desde
 * git, y es el panel diciendolo bien, no un error.
 *
 * Desde el 5 de octubre de 2026 la pagina no recibe el texto de todas las
 * publicaciones (eran ~3,700 comentarios en el HTML de una pagina): la hoja
 * pide el de UNA al abrirla, por /api/expediente/comentarios.
 */

/** Un tema del resumen: `comentarios` son posiciones en la lista publicada. */
export interface TemaDelAno { nombre: string; detalle: string; comentarios: number[] }

export interface ResumenDelAno { texto: string; leidos: number; fecha: string; temas: TemaDelAno[] }

export interface ComentariosDePublicacion {
  comentarios: ComentarioPublicado[];
  resumen: ResumenDelAno | null;
}

interface BloqueExpediente {
  comentarios: Record<string, ComentarioPublicado[]>;
  resumenes?: Record<string, ResumenDelAno>;
}

const RUTA = path.join(process.cwd(), "public", "data", "expedientes-comentarios.json");

/** null: no hay archivo de texto en este despliegue. */
export async function comentariosDePublicacion(id: string, url: string): Promise<ComentariosDePublicacion | null> {
  let bloque: BloqueExpediente | undefined;
  try {
    const doc = JSON.parse(await readFile(RUTA, "utf8")) as { expedientes?: Record<string, BloqueExpediente> };
    bloque = doc.expedientes?.[id];
  } catch {
    return null;
  }
  if (bloque?.comentarios === undefined) return null;
  return {
    comentarios: bloque.comentarios[url] ?? [],
    resumen: bloque.resumenes?.[url] ?? null,
  };
}

/** Los resumenes de IA de todas las publicaciones del año de un expediente,
 *  por URL, para el PDF (lib/expedientes/pdf.ts), que los pinta de las mas
 *  vistas y cuenta los temas que se repiten. null: no hay archivo de texto
 *  en este despliegue, y el PDF lo dice como «sin dato». */
export async function resumenesDelExpediente(id: string): Promise<Record<string, ResumenDelAno> | null> {
  try {
    const doc = JSON.parse(await readFile(RUTA, "utf8")) as { expedientes?: Record<string, BloqueExpediente> };
    const bloque = doc.expedientes?.[id];
    return bloque === undefined ? null : bloque.resumenes ?? {};
  } catch {
    return null;
  }
}
