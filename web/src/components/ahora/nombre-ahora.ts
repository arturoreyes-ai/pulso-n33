import type { Entrada } from "@/lib/busqueda/capitulos";
import { NOMBRE_CORTO } from "@/lib/dominio/zonas";

/** El nombre visible del alcance actual del recorrido. */
export function nombreDe(entrada: Entrada): string {
  // «El corredor» y no «Toda la región»: esta entrada trae Tijuana y San
  // Diego, no las nueve zonas. El segmento de arriba sí se llama Región,
  // porque ese sí agrupa el corredor y los ocho municipios.
  if (entrada === "region") return "El corredor";
  if (entrada === "mexico") return "México";
  if (entrada === "internacional") return "Internacional";
  return NOMBRE_CORTO[entrada];
}
