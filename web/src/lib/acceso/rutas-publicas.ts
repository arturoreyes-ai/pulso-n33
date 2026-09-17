/**
 * Excepciones exactas a la puerta del tablero. No usar `startsWith`: abrir
 * `/api/garitas/lo-que-sea` convertiría futuras rutas hermanas en públicas sin
 * que quien las agregue tuviera que decidirlo.
 */
export function esRutaPublica(ruta: string): boolean {
  return ruta === "/api/garitas";
}
