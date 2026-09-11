"use server";

import { signIn, signOut } from "@/auth";

import { rutaDeRegreso } from "./regreso";

/**
 * Entrar y salir son acciones de servidor, no llamadas desde el cliente: no
 * hay SessionProvider ni useSession en el tablero. Toda la autenticacion es
 * de servidor, y el unico JavaScript que esto agrega al navegador es el de
 * un <form>.
 */
export async function entrarConMicrosoft(datos: FormData): Promise<void> {
  await signIn("microsoft-entra-id", { redirectTo: rutaDeRegreso(datos.get("volver")) });
}

export async function cerrarSesion(): Promise<void> {
  await signOut({ redirectTo: "/entrar?salida=1" });
}
