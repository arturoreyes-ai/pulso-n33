"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { usuarioActual } from "@/lib/acceso/sesion";
import { leerSolicitud, urlDeRegreso } from "./autorizacion";
import { guardarCodigo, origenPublico, secretoMcp } from "./servidor";

/**
 * Permitir o cancelar en /mcp/autorizar. Es una accion de servidor y no un
 * POST a mano por lo que ya trae: Next comprueba el origen de la peticion, y
 * la cookie de sesion de Auth.js es SameSite=Lax, asi que otro sitio no puede
 * aprobar por quien tiene la sesion abierta.
 *
 * La solicitud llega firmada con el id de quien la vio (autorizacion.ts); se
 * vuelve a leer la persona y se vuelve a exigir administrador: el rol pudo
 * cambiar entre ver la pantalla y pulsar.
 */
export async function decidirAutorizacion(datos: FormData): Promise<void> {
  const secreto = secretoMcp();
  if (secreto === null) redirect("/");
  const usuario = await usuarioActual();
  const solicitud = leerSolicitud(String(datos.get("solicitud") ?? ""), usuario.id, secreto);
  if (solicitud === null) redirect("/mcp/autorizar?vencida=1");
  const origen = origenPublico(await headers());
  const esAdmin = usuario.activo && usuario.aprobado && usuario.rol === "admin";
  if (datos.get("decision") !== "permitir" || !esAdmin) {
    redirect(urlDeRegreso(solicitud.redirectUri, {
      error: "access_denied",
      error_description: esAdmin ? "La persona canceló la conexión." : "Solo un administrador del tablero puede conectarlo.",
      state: solicitud.estado,
    }, origen));
  }
  const codigo = await guardarCodigo({
    usuarioId: usuario.id,
    clienteId: solicitud.clienteId,
    redirectUri: solicitud.redirectUri,
    desafio: solicitud.desafio,
    recurso: solicitud.recurso,
  });
  redirect(urlDeRegreso(solicitud.redirectUri, { code: codigo, state: solicitud.estado }, origen));
}
