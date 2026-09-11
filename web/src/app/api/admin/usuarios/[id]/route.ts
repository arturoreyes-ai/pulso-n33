import { cuerpoJson, ErrorApi, jsonSinCache, respuestaError } from "@/lib/acceso/http";
import { esRol, puedeEditarUsuario } from "@/lib/acceso/roles";
import { actorDe, requerirAdmin } from "@/lib/acceso/sesion";
import { actualizarUsuario, buscarUsuarioPorId, type CambioUsuario } from "@/lib/acceso/usuarios";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Cambiar rol o dar de alta/baja a un usuario. Cuerpo: `{ "rol": "admin" }`,
 * `{ "activo": false }`, o ambos. Sin Zod a proposito: son dos campos y la
 * validacion a mano se lee entera.
 */
export async function PATCH(peticion: Request, { params }: Props) {
  try {
    const admin = await requerirAdmin();
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) throw new ErrorApi(404, "Usuario no encontrado");

    const objetivo = await buscarUsuarioPorId(id);
    if (!objetivo) throw new ErrorApi(404, "Usuario no encontrado");
    if (!puedeEditarUsuario(actorDe(admin), objetivo)) {
      throw new ErrorApi(403, "No puedes cambiar tu propia cuenta");
    }

    const cuerpo = await cuerpoJson(peticion);
    if (typeof cuerpo !== "object" || cuerpo === null) {
      throw new ErrorApi(422, "Se esperaba un objeto con rol y/o activo");
    }
    const { rol, activo } = cuerpo as Record<string, unknown>;
    const cambio: CambioUsuario = {};
    if (rol !== undefined) {
      if (!esRol(rol)) throw new ErrorApi(422, "Rol desconocido: usa lector o admin");
      cambio.rol = rol;
    }
    if (activo !== undefined) {
      if (typeof activo !== "boolean") throw new ErrorApi(422, "activo debe ser true o false");
      cambio.activo = activo;
    }
    if (cambio.rol === undefined && cambio.activo === undefined) {
      throw new ErrorApi(422, "Nada que cambiar: envía rol y/o activo");
    }

    return jsonSinCache(await actualizarUsuario(id, cambio));
  } catch (error) {
    return respuestaError(error);
  }
}
