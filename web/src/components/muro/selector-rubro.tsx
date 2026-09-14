"use client";

import { NOMBRE_RUBRO, RUBROS, type Rubro } from "@/lib/busqueda/rubros";
import { Chip } from "@/components/ui/primitivas";

/**
 * "Todo" y los cinco rubros, como pastillas. Compartido por el panel de
 * actualidad y por el muro en modo actualidad (Mexico, Internacional), para
 * que las listas en vivo de todo el tablero se filtren con la misma pastilla
 * y el mismo gesto: es la misma pregunta en cada lugar.
 *
 * `null` es "Todo": la lista tal cual llega, sin busqueda por rubro.
 */
export function SelectorRubro({
  activo,
  onElegir,
}: {
  activo: Rubro | null;
  onElegir: (rubro: Rubro | null) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Rubro"
      className="flex gap-1.5 overflow-x-auto pb-1 whitespace-nowrap"
    >
      <Chip activo={activo === null} onClick={() => onElegir(null)}>
        Todo
      </Chip>
      {RUBROS.map((r) => (
        <Chip key={r} activo={activo === r} onClick={() => onElegir(r)}>
          {NOMBRE_RUBRO[r]}
        </Chip>
      ))}
    </div>
  );
}
