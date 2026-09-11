import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Conexion a Postgres (Neon) por HTTP.
 *
 * Es el UNICO cliente de base de datos del tablero y existe para una sola
 * tabla, `usuarios`. Los datos del producto siguen saliendo de data/*.json y
 * su archivo historico sigue siendo git (AGENTS.md); nada de eso pasa por
 * aqui. Si alguien quiere meter un segundo uso, que lo discuta primero.
 *
 * Por que Neon y por que este driver:
 *
 *  - Neon tiene un nivel gratuito con Postgres real, se enchufa a Vercel
 *    desde Marketplace (inyecta DATABASE_URL en el proyecto, y `vercel pull`
 *    la baja al runner del cron) y para menos de 50 usuarios ni se acerca a
 *    los limites. La tabla pesa kilobytes.
 *  - `neon()` es el driver HTTP, no un pool TCP: cada consulta es una
 *    peticion y no queda ninguna conexion abierta entre invocaciones, que es
 *    el modo de falla clasico de `pg` en serverless (agotar los slots de
 *    Postgres con conexiones huerfanas). Y corre tambien en el runtime edge,
 *    asi que auth.ts puede importarlo sin bifurcar codigo.
 *
 * Se crea perezoso: `next build` importa los modulos sin DATABASE_URL y no
 * debe fallar por eso; falla la primera consulta, con un mensaje que dice
 * donde esta la receta.
 */
// Los dos genericos son `arrayMode` y `fullResults`, ambos en falso: cada
// consulta devuelve `Record<string, any>[]`. No usar `ReturnType<typeof neon>`:
// resuelve los genericos a `boolean` y el resultado es una union de tres
// formas que no se puede indexar ni mapear.
type Cliente = NeonQueryFunction<false, false>;

let cliente: Cliente | null = null;

/**
 * `DATABASE_URL` en local y en la documentacion de Neon; `NEON_DB_DATABASE_URL`
 * es lo que la integracion de Vercel Marketplace exporta de verdad al proyecto
 * (verificado el 10 sep 2026: las 16 variables llegan con el prefijo
 * NEON_DB_, y ninguna sin el). Se aceptan las dos para que el despliegue no
 * dependa de renombrar a mano una variable que la integracion volveria a crear.
 */
export function urlBaseDeDatos(): string | undefined {
  return process.env.DATABASE_URL || process.env.NEON_DB_DATABASE_URL || undefined;
}

export function hayBaseDeDatos(): boolean {
  return Boolean(urlBaseDeDatos());
}

export function sql(): Cliente {
  if (cliente === null) {
    const url = urlBaseDeDatos();
    if (!url) {
      throw new Error("Ni DATABASE_URL ni NEON_DB_DATABASE_URL están configuradas (ver docs/acceso.md)");
    }
    cliente = neon(url);
  }
  return cliente;
}
