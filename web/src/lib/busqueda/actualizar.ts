import type { ResultadoExterno } from "./tipos";

export interface LoteVivo {
  resultados: readonly ResultadoExterno[];
  fuentes: readonly { estado: string }[];
}

/** Un 200 con todos los feeds caidos no debe borrar los titulares anteriores. */
export function comprobarActualizacion<T extends LoteVivo>(anterior: T | undefined, nuevo: T) {
  if (nuevo.fuentes.length === 0 || nuevo.fuentes.every((fuente) => fuente.estado === "fallo")) {
    throw new Error("No se pudo actualizar. Inténtalo de nuevo.");
  }
  const parcial = nuevo.fuentes.some((fuente) => fuente.estado === "fallo");
  return parcial
    ? "Actualización parcial. Algunos titulares no están disponibles."
    : JSON.stringify(anterior?.resultados) === JSON.stringify(nuevo.resultados)
      ? "No hay titulares nuevos."
      : "Titulares actualizados.";
}
