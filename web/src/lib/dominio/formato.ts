import type { Nota } from "@/lib/datos/tipos";

// Rango de diacriticos combinantes de Unicode. Con escapes explicitos y no
// con los caracteres literales, que son invisibles en el codigo fuente y
// cualquier reformateo los puede romper sin que se note.
const COMBINANTES = /[̀-ͯ]/g;

/**
 * Minusculas sin acentos. Espejo de `fold()` en pulso/normalizar.py, para que
 * buscar "Burgueno" encuentre "Burgueño" igual que lo hace el pipeline.
 */
export function plegar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINANTES, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Formatters a nivel de modulo: construir un Intl.DateTimeFormat es caro y
// esto corre por fila.
//
// Zona horaria fija en America/Tijuana a proposito. Es lo correcto para un
// tablero de la frontera, donde "3:24 pm" debe significar 3:24 pm en Tijuana
// y no en el huso de quien mira. Y de paso elimina toda diferencia entre el
// HTML del servidor y el del cliente, o sea el riesgo de hydration.
//
// Doce horas, a peticion del cliente (12 de septiembre de 2026): "9:36 pm" y
// no "21:36 h", en todo el tablero. Se arma con formatToParts porque es-MX
// escribe "p. m." con puntos y espacios, y eso no cabe junto a la hora en la
// columna de 4rem del muro; "pm" pegado si cabe y se lee igual.
const HORA = new Intl.DateTimeFormat("es-MX", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "America/Tijuana",
});

function hora12(d: Date): string {
  let h = "";
  let m = "";
  let periodo = "";
  for (const parte of HORA.formatToParts(d)) {
    if (parte.type === "hour") h = parte.value;
    else if (parte.type === "minute") m = parte.value;
    else if (parte.type === "dayPeriod") periodo = parte.value;
  }
  return `${h}:${m} ${/^p/i.test(periodo) ? "pm" : "am"}`;
}

const DIA_MES = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  timeZone: "America/Tijuana",
});

const FECHA_LARGA = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Tijuana",
});

const NUM = new Intl.NumberFormat("es-MX");
const NUM_EN = new Intl.NumberFormat("en-US");

export const numero = (n: number) => NUM.format(n);

export const pesos = (n: number) => "$" + NUM.format(Math.round(n));

export const dolares = (n: number) => "$" + NUM_EN.format(Math.round(n));

/** Un hueco se dice con palabras, nunca con un guion. */
export function pct(v: number | null | undefined, decimales = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "sin dato";
  return (v > 0 ? "+" : "") + v.toFixed(decimales) + "%";
}

export const fechaLarga = (iso: string) => FECHA_LARGA.format(new Date(iso));

/**
 * "6 sept" a partir de una fecha SIN hora ("2026-09-06"). Se ancla al mediodia
 * UTC a proposito: `new Date("2026-09-06")` es medianoche UTC, que en Tijuana
 * todavia es el dia 5, y el formateador la mostraria un dia atras.
 */
export function fechaCorta(fecha: string): string {
  const d = new Date(fecha.length === 10 ? fecha + "T12:00:00Z" : fecha);
  return Number.isNaN(d.getTime()) ? "s/f" : DIA_MES.format(d);
}

/** "9:36 pm", en hora de Tijuana. "s/f" si la fecha no se puede leer. */
export function hora(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "s/f" : hora12(d);
}

export const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

export const MESES_CORTOS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
] as const;

/** Indice 0 = enero. Fuera de rango devuelve el numero del mes. */
export const nombreMes = (i: number) => MESES[i] ?? String(i + 1);

export const pluralizar = (n: number, singular: string, plural: string) =>
  n === 1 ? singular : plural;

/**
 * Edad de una nota medida contra el CORTE, no contra el reloj del navegador.
 * Una pestana abierta desde ayer diria "hace 1 h" de algo de ayer si midiera
 * contra Date.now().
 */
function edad(fecha: Date, corte: number): string {
  const ms = corte - fecha.getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const h = Math.floor(ms / 3_600_000);
  if (h < 48) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 60) return `${d} d`;
  return `${Math.floor(d / 30)} me`;
}

export interface Cuando {
  principal: string;
  edad: string;
  iso: string | null;
}

export function cuando(n: Nota, corte: number): Cuando {
  const cruda = n.publicado ?? n.fecha;
  if (cruda === null) return { principal: "s/f", edad: "", iso: null };
  const d = new Date(cruda);
  if (Number.isNaN(d.getTime())) return { principal: "s/f", edad: "", iso: null };

  // Si es del mismo dia del corte y trae hora real, se muestra la hora; si no,
  // la fecha. Una nota de corpus tiene medianoche y "12:00 am" seria ruido.
  const mismoDia =
    Number.isFinite(corte) && DIA_MES.format(d) === DIA_MES.format(new Date(corte));
  const tieneHora = d.getHours() !== 0 || d.getMinutes() !== 0;

  return {
    principal: mismoDia && tieneHora ? hora12(d) : DIA_MES.format(d),
    edad: Number.isFinite(corte) ? edad(d, corte) : "",
    iso: cruda,
  };
}
