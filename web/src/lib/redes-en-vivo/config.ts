import { urlBaseDeDatos } from "@/lib/acceso/bd";

/**
 * La compuerta y los topes de la busqueda PAGADA en redes. Solo servidor.
 *
 * Tres llaves, las tres necesarias, como `analisisHabilitado`: la bandera
 * explicita, el token de Apify y la base de datos. La base no es un detalle:
 * sin ella no hay libro de gasto, y sin libro el tope mensual y el diario no
 * se pueden sostener entre funciones sin estado. Una busqueda pagada sin tope
 * es exactamente lo que el cliente no autorizo.
 *
 * Los topes son los que el cliente fijo el 23 de septiembre de 2026 y estan
 * escritos en docs/PLAN.md: 50 USD al mes ENCIMA de lo que gasta la cosecha
 * programada (el libro solo suma lo de esta ruta) y diez busquedas pagadas por
 * persona al dia. Repetir un termino dentro de seis horas reusa la primera y
 * no cuenta.
 */

export const TOPE_MENSUAL_USD = 50;
export const TOPE_DIARIO_POR_PERSONA = 10;
/** Una busqueda repetida dentro de esto reusa los resultados de la primera. */
export const REUSO_HORAS = 6;
/** El dia del tope diario es el del corredor, no el de UTC. */
export const ZONA_HORARIA = "America/Tijuana";

export function tokenApify(entorno: NodeJS.ProcessEnv = process.env): string {
  // Los dos nombres, como pulso/entorno.py: la consola de Apify ofrece
  // APIFY_API_TOKEN y su documentacion dice APIFY_TOKEN.
  return (entorno.APIFY_API_TOKEN || entorno.APIFY_TOKEN || "").trim();
}

export function redesEnVivoHabilitadas(entorno: NodeJS.ProcessEnv = process.env): boolean {
  return entorno.BUSQUEDA_REDES_HABILITADA === "true"
    && tokenApify(entorno) !== ""
    && urlBaseDeDatos() !== undefined;
}
