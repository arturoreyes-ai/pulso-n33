import type { Carril, Cruce } from "./tipos";

const RELOJ = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Tijuana", hour: "numeric", minute: "2-digit", hour12: true,
});
const FECHA = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Tijuana", day: "2-digit", month: "short",
});
export const horaLocal = (fecha: string) => RELOJ.format(new Date(fecha));
export const fechaLocal = (fecha: string) => `${FECHA.format(new Date(fecha))}, ${horaLocal(fecha)}`;
export function duracion(minutos: number, locucion = false): string {
  if (minutos < 60) return `${minutos} ${locucion ? minutos === 1 ? "minuto" : "minutos" : "min"}`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return locucion
    ? `${horas} ${horas === 1 ? "hora" : "horas"} y ${resto} ${resto === 1 ? "minuto" : "minutos"}`
    : `${horas} h ${resto.toString().padStart(2, "0")} min`;
}
export function vigente(carril: Carril, ahora: number): boolean {
  if (!carril.observado) return false;
  const edad = ahora - Date.parse(carril.observado);
  return edad >= 0 && edad <= 90 * 60_000;
}
export function resumen(cruces: Cruce[], ahora: number): string {
  return cruces.flatMap((cruce) => {
    const carril = cruce.carriles.find((c) => c.viajero === "vehiculo" && c.categoria === "general");
    if (!carril || carril.estado !== "reportado" || carril.minutos === null || !vigente(carril, ahora)) return [];
    return [`Según CBP, a las ${horaLocal(carril.observado!)}, ${cruce.nombre} reporta ${duracion(carril.minutos, true)} de espera en carriles generales hacia Estados Unidos.`];
  }).join(" ");
}
