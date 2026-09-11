import { auth } from "@/auth";

import { hayBaseDeDatos } from "./bd";
import { acceso } from "./config";
import { ErrorApi } from "./http";
import { type Actor, type Rol } from "./roles";
import {
  buscarUsuarioPorCorreo,
  registrarAcceso,
  type Identidad,
  type Usuario,
} from "./usuarios";

/**
 * Quien esta detras de la peticion, y que se le permite.
 *
 * Aqui se decide el ROL; que haya sesion lo decide antes proxy.ts, que es
 * quien cubre tambien las paginas prerrenderizadas y los JSON de /data. Estas
 * funciones son para las rutas de la API y para cualquier componente de
 * servidor que necesite saber quien mira, y cada una lanza `ErrorApi` con el
 * estado correcto: 401 sin identidad, 403 con identidad pero sin permiso.
 *
 * Patron de una ruta protegida:
 *
 *   export async function GET() {
 *     try {
 *       const usuario = await requerirAdmin();
 *       ...
 *     } catch (error) {
 *       return respuestaError(error);
 *     }
 *   }
 */

interface IdentidadDeSesion extends Identidad {
  dev: boolean;
}

async function identidadDeSesion(): Promise<IdentidadDeSesion> {
  const sesion = await auth();
  const dev = acceso.sinEntra;
  const correo = (sesion?.user?.email || (dev ? acceso.devCorreo : "")).trim().toLowerCase();
  if (!correo) throw new ErrorApi(401, "Inicia sesión con Microsoft Entra");
  const nombre = sesion?.user?.name?.trim() || (dev ? "Usuario de desarrollo" : correo);
  const usuario = sesion?.user as { entraOid?: unknown } | undefined;
  const entraOid = typeof usuario?.entraOid === "string" ? usuario.entraOid : null;
  return { correo, nombre, entraOid, dev: dev && !sesion?.user };
}

function usuarioSintetico(identidad: Identidad): Usuario {
  return {
    id: 0,
    entraOid: null,
    correo: identidad.correo,
    nombre: identidad.nombre,
    rol: acceso.devRol,
    activo: true,
    creadoEn: "1970-01-01T00:00:00.000Z",
    ultimoAccesoEn: null,
  };
}

/**
 * La fila de `usuarios` de quien pregunta. La escribio `callbacks.signIn` al
 * entrar; si no esta (alguien la borro con la sesion viva), se vuelve a dar
 * de alta con lo que dice la sesion, que es la misma alta del primer dia.
 *
 * En el modo sin Entra se devuelve la fila de ACCESO_DEV_CORREO con el rol
 * pisado por ACCESO_DEV_ROL, y si tampoco hay DATABASE_URL, un usuario
 * sintetico: asi `next dev` levanta con cero servicios externos.
 */
export async function usuarioActual(): Promise<Usuario> {
  const identidad = await identidadDeSesion();
  if (identidad.dev) {
    const fila = hayBaseDeDatos()
      ? await registrarAcceso(identidad)
      : usuarioSintetico(identidad);
    return { ...fila, rol: acceso.devRol, activo: true };
  }
  return (await buscarUsuarioPorCorreo(identidad.correo)) ?? registrarAcceso(identidad);
}

export async function requerirUsuario(): Promise<Usuario> {
  const usuario = await usuarioActual();
  if (!usuario.activo) throw new ErrorApi(403, "Tu cuenta está desactivada");
  return usuario;
}

export async function requerirRol(...roles: Rol[]): Promise<Usuario> {
  const usuario = await requerirUsuario();
  if (!roles.includes(usuario.rol)) {
    throw new ErrorApi(403, "No tienes permiso para esta acción");
  }
  return usuario;
}

export async function requerirAdmin(): Promise<Usuario> {
  const usuario = await requerirUsuario();
  if (usuario.rol !== "admin") throw new ErrorApi(403, "Se requiere rol administrador");
  return usuario;
}

export const actorDe = (usuario: Usuario): Actor => ({ id: usuario.id, rol: usuario.rol });
