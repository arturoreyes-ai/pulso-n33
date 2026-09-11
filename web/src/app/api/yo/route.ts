import { jsonSinCache, respuestaError } from "@/lib/acceso/http";
import { requerirUsuario } from "@/lib/acceso/sesion";

/**
 * Quien soy. Es la unica forma que tiene un componente cliente de saber el
 * rol: no hay SessionProvider. `no-store` porque la respuesta depende de la
 * cookie y un cache compartido la mezclaria entre personas.
 */
export async function GET() {
  try {
    const usuario = await requerirUsuario();
    return jsonSinCache({ nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol });
  } catch (error) {
    return respuestaError(error);
  }
}
