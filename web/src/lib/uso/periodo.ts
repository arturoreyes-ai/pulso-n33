/**
 * El periodo de una pregunta de gasto: dos fechas, inclusivas, en la hora
 * del corredor. Los topes del tablero cuentan el mes de America/Tijuana
 * (redes-en-vivo/libro.ts, seguimiento/almacen.ts), asi que el MCP cuenta
 * igual: si contara en UTC, «este mes» del presidente y el tope que ve el
 * equipo no sumarian lo mismo las ultimas horas de cada mes.
 */

export const ZONA = "America/Tijuana";

/** Mas de esto no es una pregunta de gasto, es un respaldo de la base. */
const DIAS_MAXIMO = 400;

export type Periodo = { desde: string; hasta: string };

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function hoyEnZona(ahora: Date = new Date()): string {
  // en-CA escribe AAAA-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
}

export class PeriodoInvalido extends Error {}

function fechaValida(v: string): boolean {
  if (!FECHA.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Sin fechas: del dia 1 del mes en curso a hoy. */
export function periodoDe(desde: unknown, hasta: unknown, ahora: Date = new Date()): Periodo {
  const hoy = hoyEnZona(ahora);
  const d = typeof desde === "string" && desde !== "" ? desde : `${hoy.slice(0, 8)}01`;
  const h = typeof hasta === "string" && hasta !== "" ? hasta : hoy;
  if (!fechaValida(d) || !fechaValida(h)) throw new PeriodoInvalido("Las fechas van como AAAA-MM-DD.");
  if (d > h) throw new PeriodoInvalido("«desde» es posterior a «hasta».");
  const dias = (Date.parse(h) - Date.parse(d)) / 86_400_000;
  if (dias > DIAS_MAXIMO) throw new PeriodoInvalido(`El periodo no puede pasar de ${DIAS_MAXIMO} días.`);
  return { desde: d, hasta: h };
}

/** La medianoche de `fecha` en Tijuana, como instante UTC. El desfase es de
 *  7 u 8 horas segun el horario de verano; se mide en vez de suponerlo. */
export function medianocheEnZona(fecha: string): Date {
  const utc = Date.parse(`${fecha}T00:00:00Z`);
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(utc + 12 * 3_600_000));
  const v = (t: string) => Number(partes.find((p) => p.type === t)?.value);
  const pared = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"));
  const desfase = pared - (utc + 12 * 3_600_000);
  return new Date(utc - desfase);
}

/** El dia siguiente, para cerrar un intervalo `[desde, hasta + 1)`. */
export function diaSiguiente(fecha: string): string {
  return new Date(Date.parse(`${fecha}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}
