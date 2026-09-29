import { urlBaseDeDatos } from "@/lib/acceso/bd";
import { tokenApify } from "@/lib/redes-en-vivo/config";

/**
 * La compuerta, los topes y la retencion del seguimiento de publicaciones.
 * Solo servidor.
 *
 * Tres llaves, como la busqueda en vivo (redes-en-vivo/config.ts): la bandera
 * explicita, el token de Apify y la base de datos. Sin base no hay lista ni
 * libro de gasto, y un boton que paga sin libro es lo que el cliente no
 * autorizo.
 *
 * Lo decidio el cliente el 28 de septiembre de 2026 y esta en docs/PLAN.md:
 * cada actualizacion se paga al pulsar un boton, con un tope PROPIO, separado
 * de los 50 USD de la busqueda en vivo, y el texto se borra a los 15 dias. El
 * monto lo fijo el mismo dia: 20 USD al mes «para empezar»; las diez por
 * persona al dia son las de la busqueda en vivo. Una actualizacion completa cuesta entre
 * 0.08 USD (TikTok) y 0.20 (Instagram) a los precios Silver de ese dia, asi
 * que 20 USD son de 100 a 250 actualizaciones al mes.
 */

export const TOPE_MENSUAL_USD = 20;
export const TOPE_DIARIO_POR_PERSONA = 10;
/** Pulsar otra vez dentro de esto no vuelve a pagar: se ve la ultima. */
export const MINUTOS_ENTRE_ACTUALIZACIONES = 30;
/** Cuantos dias vive el texto de un comentario desde la ultima lectura que lo
 *  trajo. Lo decidio el cliente; el pipeline guarda 30 en cache/. */
export const RETENCION_DIAS = 15;
/** El dia del tope diario es el del corredor, no el de UTC. */
export const ZONA_HORARIA = "America/Tijuana";

export function seguimientoHabilitado(entorno: NodeJS.ProcessEnv = process.env): boolean {
  return entorno.SEGUIMIENTO_HABILITADO === "true"
    && tokenApify(entorno) !== ""
    && urlBaseDeDatos() !== undefined;
}
