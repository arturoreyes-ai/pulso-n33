import type { NextRequest } from "next/server";

import { ErrorApi, jsonSinCache, respuestaError } from "@/lib/acceso/http";
import { requerirAdmin } from "@/lib/acceso/sesion";
import { comentariosDePublicacion } from "@/lib/expedientes/comentarios";
import { expedientePorId } from "@/lib/expedientes/expedientes";

/**
 * Los comentarios y el resumen de UNA publicacion del año en redes de un
 * expediente, para la hoja que la abre (reportes/hoja-comentarios-ano.tsx).
 * Solo administradores, como la pagina, y sin cache: es texto de comentarios,
 * que vive fuera de git y caduca a los 30 dias.
 *
 * La `u` es una llave de busqueda contra las publicaciones del expediente,
 * nunca una direccion que el servidor visite: aqui no sale ninguna peticion.
 */
export async function GET(peticion: NextRequest): Promise<Response> {
  try {
    await requerirAdmin();
    const parametros = peticion.nextUrl.searchParams;
    const e = expedientePorId(parametros.get("e") ?? "");
    const url = parametros.get("u") ?? "";
    const conocida = e?.ano?.meses.some((m) => Object.values(m.redes).some((l) => l?.some((p) => p.url === url))) ?? false;
    if (e === undefined || !conocida) throw new ErrorApi(404, "No existe esa publicación en el expediente");
    const datos = await comentariosDePublicacion(e.id, url);
    return jsonSinCache(datos === null ? { disponible: false } : { disponible: true, ...datos });
  } catch (error) {
    return respuestaError(error);
  }
}
