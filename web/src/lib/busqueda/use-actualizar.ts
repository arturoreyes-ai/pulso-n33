"use client";

import useSWR, { useSWRConfig } from "swr";
import { comprobarActualizacion, type LoteVivo } from "./actualizar";
import { leerApi } from "./disponible";

export interface ActualizacionViva {
  actualizar: () => Promise<void>;
  actualizando: boolean;
  avisoActualizacion: string;
}

const REPOSO = { actualizando: false, avisoActualizacion: "" };
// El bloqueo comparte el mismo alcance que SWR, incluso entre dos islas.
const pendientes = new WeakMap<object, Set<string>>();

export function useActualizar<T extends LoteVivo>(llave: string | null): ActualizacionViva {
  const { mutate: mutar, cache: almacen } = useSWRConfig();
  const estado = llave === null ? null : `actualizacion:${llave}`;
  const { data: progreso } = useSWR(estado, null, { fallbackData: REPOSO });

  async function actualizar() {
    if (llave === null || estado === null) return;
    let bloqueos = pendientes.get(almacen);
    if (!bloqueos) {
      bloqueos = new Set();
      pendientes.set(almacen, bloqueos);
    }
    if (bloqueos.has(llave)) return;
    bloqueos.add(llave);
    let avisoActualizacion = "";
    try {
      await mutar(estado, { actualizando: true, avisoActualizacion: "" }, { revalidate: false });
      // SWR descarta las revalidaciones que empezaron antes de esta mutacion.
      // La llave capturada pertenece al filtro original, aunque el lector cambie.
      await mutar<T>(llave, async (anterior: T | undefined) => {
        const nuevo = await leerApi<T>(`${llave}&actualizar=1`, { cache: "no-store" });
        avisoActualizacion = comprobarActualizacion(anterior, nuevo);
        return nuevo;
      }, { revalidate: false, rollbackOnError: true, throwOnError: true });
    } catch {
      avisoActualizacion = "No se pudo actualizar. Inténtalo de nuevo.";
    } finally {
      await mutar(estado, { actualizando: false, avisoActualizacion }, { revalidate: false });
      bloqueos.delete(llave);
    }
  }

  return { actualizar, ...progreso };
}
