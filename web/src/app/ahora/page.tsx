import { permanentRedirect } from "next/navigation";

/**
 * /ahora fue el recorrido de titulares en vivo del 14 al 15 de septiembre de
 * 2026. Ese dia paso a ser la PORTADA, renombrado «En Tendencia», y esta ruta
 * se quedo como redirect permanente: los enlaces que el cliente ya habia
 * repartido siguen llegando a donde esperaban.
 *
 * El archivo no se borra a proposito. `permanentRedirect` responde 308, y el
 * segmento literal sigue existiendo y sigue compitiendo con `[zona]`, por eso
 * "ahora" esta en la union `SegmentoLiteral` de lib/dominio/secciones.ts. La
 * alternativa era `redirects()` en next.config.ts, que resuelve antes y sin
 * payload, pero saca la regla del sitio donde vive el resto del ruteo y la
 * deja fuera del alcance de esa guardia de tipos.
 */
export default function PaginaAhora() {
  permanentRedirect("/");
}
