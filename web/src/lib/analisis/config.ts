/**
 * El interruptor de la lectura automatica, apagado por omision.
 *
 * Mismo trato que YOUTUBE_HABILITADO, APIFY_HABILITADO y DESPLEGAR_TABLERO, y
 * por la misma clase de razon: cada pulsacion del boton es una llamada de pago
 * a un modelo, y el encargo del cliente dice "fully automated, without needing
 * AI APIs" (docs/PLAN.md). El interruptor es lo que mantiene esa frase cierta
 * mientras nadie lo encienda, y lo que evita que una clave olvidada en el
 * entorno de un preview gaste sin que nadie lo haya decidido.
 *
 * Se piden las DOS: el interruptor declara la intencion y la clave declara que
 * hay con que. Con el interruptor encendido y sin clave, el boton se pintaria
 * para fallar en cada pulsacion.
 *
 * Esto se llama SOLO desde componentes de servidor y desde la ruta. No lleva
 * el paquete `server-only` porque no es una dependencia del proyecto y no se
 * va a agregar una por una guarda; lo que protege de verdad es que
 * ANTHROPIC_API_KEY no lleva prefijo NEXT_PUBLIC_, asi que vale "" en cliente y
 * esta funcion devolveria false alli en vez de filtrar nada. Quien necesita
 * saber si el boton se pinta lo recibe como prop desde el servidor.
 */
export function analisisHabilitado(): boolean {
  return process.env.ANALISIS_HABILITADO === "true" && (process.env.ANTHROPIC_API_KEY ?? "") !== "";
}

/**
 * El modelo de las DOS fichas, aqui y no en cada modulo, para que no puedan
 * derivar a dos ids distintos sin que nadie lo note. probar-analisis.cjs fija
 * su valor, asi que cambiarlo rompe CI a proposito: es una decision de costo,
 * no un detalle de implementacion.
 */
export const MODELO_ANALISIS = "claude-haiku-4-5-20251001";

/**
 * El modelo del guion de locucion (lib/analisis/guion-tiktok.ts), aparte de
 * las fichas desde el 24 de septiembre de 2026. El guion se dice al aire y es
 * escritura, no lectura, asi que el cliente puede querer otro modelo solo para
 * el; separado, cambiarlo no mueve el costo de ninguna otra ruta. Igual que
 * MODELO_ANALISIS, probar-analisis.cjs lo fija.
 *
 * Sonnet 5 desde el mismo dia, por decision del cliente, despues de comparar
 * los dos modelos dos veces sobre el mismo tiktok.json: Haiku 4.5 le
 * acredito a Latinus un video de @elheraldodemexico; Sonnet 5 atribuyo bien
 * todos los clips. Cuesta ~$0.017 por guion contra ~$0.005, unos $4 al mes en
 * el peor caso (dos programas, cuatro ciclos al dia).
 */
export const MODELO_GUION = "claude-sonnet-5";
