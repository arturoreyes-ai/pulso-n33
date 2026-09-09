"use client";

import { useState, type ReactNode } from "react";
import { preload } from "swr";

import { clasesChip } from "@/components/ui/clases";
import { RUTAS } from "@/lib/datos/config";
import { leerJson } from "@/lib/datos/fetcher";

/**
 * El selector de plataforma de la pagina de redes.
 *
 * POR QUE EXISTE. Instagram, TikTok y YouTube eran tres secciones seguidas de
 * la pagina unica, y TikTok ademas tenia su propia pastilla en la nav, como
 * si fuera un tema del producto y no una fuente mas. Son la misma pregunta
 * —que se comenta— medida en tres lugares, asi que se eligen como una faceta,
 * igual que se elige una zona: mismas pastillas (`clasesChip`), mismo gesto.
 *
 * SE PINTA UNA SOLA. No es un detalle de estilo: cada panel es una isla que
 * pide su propio par de JSON, asi que montarlas las tres para esconder dos
 * cuesta cinco peticiones para mostrar dos. Con `preload` al pasar el puntero
 * o al enfocar, la que sigue ya esta en el cache de SWR antes de que el clic
 * se resuelva, y cambiar de plataforma no muestra esqueleto.
 *
 * Los paneles llegan COMO NODOS DE SERVIDOR, no como componentes que este
 * archivo importe. Cada uno viene con su prosa —el encabezado de la
 * plataforma y su "cómo leer este dato"—, y esa prosa es la honestidad del
 * producto: tiene que renderizar como HTML aunque el bundle nunca llegue.
 * Importarlos aqui la meteria en el JavaScript del cliente.
 *
 * Grupo de `aria-pressed` y no un `tablist`: es el mismo patron que ya usa
 * `Alternar` (lista/grafica) y no inventa un manejo de flechas propio.
 */

const REDES = [
  { id: "instagram", nombre: "Instagram", datos: [RUTAS.redes, RUTAS.redesComentarios] },
  { id: "tiktok", nombre: "TikTok", datos: [RUTAS.tiktok, RUTAS.tiktokComentarios] },
  { id: "youtube", nombre: "YouTube", datos: [RUTAS.conversacion] },
] as const;

export type Red = (typeof REDES)[number]["id"];

/** Instagram primero: es la plataforma que el cliente autorizo con nombre y
 *  apellido, y la unica con cuentas verificadas una por una. */
const INICIAL: Red = "instagram";

export function SelectorRed({ paneles }: { paneles: Record<Red, ReactNode> }) {
  const [red, setRed] = useState<Red>(INICIAL);

  return (
    <>
      <div role="group" aria-label="Plataforma" className="flex flex-wrap gap-1.5">
        {REDES.map((r) => {
          const activa = r.id === red;
          const calentar = () => {
            for (const ruta of r.datos) preload(ruta, leerJson);
          };
          return (
            <button
              key={r.id}
              type="button"
              aria-pressed={activa}
              onClick={() => setRed(r.id)}
              onPointerEnter={calentar}
              onFocus={calentar}
              className={clasesChip(activa)}
            >
              {r.nombre}
            </button>
          );
        })}
      </div>

      <div className="mt-8">{paneles[red]}</div>
    </>
  );
}
