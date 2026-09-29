/**
 * Excepciones exactas a la puerta del tablero. No usar `startsWith`: abrir
 * `/api/garitas/lo-que-sea` convertiría futuras rutas hermanas en públicas sin
 * que quien las agregue tuviera que decidirlo.
 *
 * `/api/seguimiento/purgar` es la otra, desde el 28 de septiembre de 2026: la
 * llama el cron diario de Vercel, que no trae sesion. No publica nada —borra
 * el texto vencido y contesta cuantos— y sin `CRON_SECRET` contesta 401
 * siempre (lib/seguimiento/responder.ts::responderPurga).
 */
export function esRutaPublica(ruta: string): boolean {
  return ruta === "/api/garitas" || ruta === "/api/seguimiento/purgar";
}
