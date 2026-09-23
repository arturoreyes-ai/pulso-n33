import type { Entrada } from "@/lib/busqueda/capitulos";
import { NOMBRE_CORTO, NOMBRE_TODA_REGION } from "@/lib/dominio/zonas";

/** El nombre visible del alcance actual del recorrido. */
export function nombreDe(entrada: Entrada): string {
  // «Toda la región» (zonas.ts::NOMBRE_TODA_REGION): la opción que no acota a
  // un municipio. Decía «El corredor», que era exacto (trae Tijuana y San
  // Diego, no las nueve zonas) pero no se leía como opción.
  if (entrada === "region") return NOMBRE_TODA_REGION;
  if (entrada === "mexico") return "México";
  if (entrada === "internacional") return "Internacional";
  return NOMBRE_CORTO[entrada];
}
