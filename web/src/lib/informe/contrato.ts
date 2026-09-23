/**
 * Lo que la pagina y la ruta del informe comparten, y nada mas.
 *
 * Aparte de lib/informe/modelo.ts a proposito: la ficha del termino
 * (components/paneles/ficha-consulta.tsx) es codigo de cliente y solo necesita
 * la version para armar el enlace de descarga. Importar el modelo desde ahi
 * arrastraria al bundle del navegador un modulo que existe para el servidor.
 */

/** Version del informe. Va en el enlace de descarga solo para separar copias
 *  en el CDN cuando cambie el documento; la ruta no la lee. */
export const VERSION_INFORME = "2"; // 23 sep 2026: el PDF pasa a ser igual a la pantalla

/** La ruta de descarga de un termino. */
export function rutaDeInforme(id: string): string {
  const params = new URLSearchParams({ c: id, v: VERSION_INFORME });
  return `/api/informe-consulta?${params.toString()}`;
}
