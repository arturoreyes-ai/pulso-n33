"use client";

import { useEstado } from "@/lib/datos/hooks";
import { numero } from "@/lib/dominio/formato";
import type { ZonaRuta } from "@/lib/dominio/zonas";

/**
 * El numero de notas junto a cada zona del selector. Mejora progresiva: el
 * enlace funciona sin esto, y esto aparece cuando estado.json (600 bytes, ya
 * sondeado por la banda) llega. Para quien lee prensa, el conteo ES la senal
 * de cuanta cobertura tiene cada lugar.
 */
export function ConteoZona({ zona }: { zona: ZonaRuta | null }) {
  const { data: estado } = useEstado();
  if (estado === undefined) return null;
  const n = zona === null ? estado.notas_ventana : (estado.por_zona[zona] ?? 0);
  return <span className="text-2xs tabular-nums text-tinta-meta">{numero(n)}</span>;
}
