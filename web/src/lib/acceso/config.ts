import { esRol, type Rol } from "./roles";

/**
 * La rebanada de entorno que le importa al acceso. Las variables de Auth.js
 * (AUTH_SECRET, AUTH_MICROSOFT_ENTRA_ID_*) las lee la libreria por su
 * cuenta y no aparecen aqui; DATABASE_URL la lee bd.ts.
 *
 * `sinEntra` es el modo de desarrollo sin Azure ni sesion: el servidor se
 * comporta como si hubiera entrado ACCESO_DEV_CORREO con rol ACCESO_DEV_ROL,
 * lo que permite probar la matriz lector/admin sin inquilino.
 *
 * NUNCA se honra fuera de `next dev`. La condicion es NODE_ENV y no una
 * variable propia porque `next build` y `next start` la fijan a "production"
 * solos: no hay forma de que un despliegue en Vercel quede abierto por
 * arrastrar un `.env` de desarrollo. Aun asi, en Vercel no se define.
 */
const enDesarrollo = process.env.NODE_ENV !== "production";
const rolDevPedido = process.env.ACCESO_DEV_ROL;

export const acceso = {
  sinEntra: process.env.ACCESO_SIN_ENTRA === "true" && enDesarrollo,
  devCorreo: (process.env.ACCESO_DEV_CORREO || "dev@pulso.local").trim().toLowerCase(),
  devRol: (esRol(rolDevPedido) ? rolDevPedido : "admin") as Rol,
  // Correo que entra como admin SIEMPRE, no solo la primera vez: es tambien la
  // puerta de emergencia si el ultimo admin se pierde.
  primerAdmin: (process.env.ACCESO_PRIMER_ADMIN || "").trim().toLowerCase(),
} as const;
