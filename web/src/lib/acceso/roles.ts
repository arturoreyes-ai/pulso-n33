/**
 * Reglas de acceso puras: quien es que y quien puede hacer que.
 *
 * Sin imports de `@/` a proposito. Las mismas funciones custodian las rutas
 * en el servidor y pueden pintar o esconder un control en un componente
 * cliente, y se prueban sin base de datos ni sesion.
 *
 * Dos roles, y no un tercero hasta que haga falta:
 *
 *  - `lector`: ve el tablero completo. Es el rol con el que entra todo el
 *    mundo; el tablero no tiene nada que un lector no deba ver.
 *  - `admin`: ademas administra usuarios (rol, alta y baja).
 *
 * El primer admin no se nombra aqui sino por entorno (ACCESO_PRIMER_ADMIN,
 * ver config.ts): con la base recien creada nadie tiene rol para nombrar a
 * nadie.
 */
export type Rol = "lector" | "admin";

export const ROLES: readonly Rol[] = ["lector", "admin"];

export const ROL_POR_OMISION: Rol = "lector";

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === "string" && (ROLES as readonly string[]).includes(valor);
}

export function etiquetaRol(rol: Rol): string {
  return rol === "admin" ? "Administrador" : "Lector";
}

export type Actor = { id: number; rol: Rol };

export function puedeAdministrarUsuarios(actor: Actor): boolean {
  return actor.rol === "admin";
}

/**
 * Nadie se edita a si mismo. Un admin que se rebaja a lector o se desactiva
 * deja al tablero sin quien lo revierta, y con menos de 50 usuarios es la
 * forma mas probable de quedarse fuera. Es la unica salvaguarda: no hay
 * conteo de "ultimo admin" (SmartNote lo tiene), porque la puerta de
 * emergencia aqui es ACCESO_PRIMER_ADMIN, que vuelve admin a ese correo en
 * cada entrada.
 */
export function puedeEditarUsuario(actor: Actor, objetivo: { id: number }): boolean {
  return puedeAdministrarUsuarios(actor) && actor.id !== objetivo.id;
}
