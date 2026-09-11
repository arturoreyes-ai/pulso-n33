/**
 * A donde volver despues de entrar. Solo rutas del mismo origen: `volver`
 * viene de la URL y sin esta criba la puerta del tablero seria una redireccion
 * abierta a cualquier sitio que la enlace.
 */
export function rutaDeRegreso(valor: unknown): string {
  if (typeof valor !== "string") return "/";
  if (!valor.startsWith("/") || valor.startsWith("//") || valor.includes("\\")) return "/";
  if (valor === "/entrar" || valor.startsWith("/entrar?") || valor.startsWith("/entrar/")) return "/";
  return valor;
}
