import { jsonSinCache, respuestaError } from "@/lib/acceso/http";
import { requerirAdmin } from "@/lib/acceso/sesion";
import { listarUsuarios } from "@/lib/acceso/usuarios";

/** Lista de usuarios, solo admin. Modelo de una ruta custodiada por rol. */
export async function GET() {
  try {
    await requerirAdmin();
    return jsonSinCache(await listarUsuarios());
  } catch (error) {
    return respuestaError(error);
  }
}
