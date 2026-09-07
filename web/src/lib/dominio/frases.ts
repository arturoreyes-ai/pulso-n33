import type {
  PanelEnsu,
  PanelPredial,
  PanelSanDiego,
  PanelSesnsp,
  PanelShf,
  Tema,
} from "@/lib/datos/tipos";
import { dolares, nombreMes, numero, pesos, pluralizar } from "./formato";
import { periodoLegible } from "./indicadores";

/**
 * Todas las frases del tablero salen de aqui. Funciones puras, sin React, para
 * que se puedan leer de corrido y probar sin montar nada.
 *
 * Tres reglas que vienen de docs/PLAN.md y se imponen aqui, no se sugieren:
 *
 *  1. Debajo de UMBRAL_PORCENTAJE se dicen conteos, nunca porcentajes. Con
 *     doce comentarios un porcentaje se mueve con dos.
 *  2. Prensa y comentarios no se suman en un numero. `fraseBrecha` los pone
 *     lado a lado y en palabras, nada mas.
 *  3. Un hueco se dice con palabras ("sin dato", "fuera de muestra"), nunca
 *     con un cero ni con un guion.
 */

export const UMBRAL_PORCENTAJE = 30;

export interface Sentimiento {
  positivo: number;
  negativo: number;
  neutral: number;
}

export interface Tono {
  favorable: number;
  neutral: number;
  adversa: number;
}

export type SerieShf = PanelShf["series"][string];
export type MunicipioPredial = PanelPredial["municipios"][string];
export type MunicipioSesnsp = PanelSesnsp["municipios"][string];
export type CiudadEnsu = PanelEnsu["ciudades"][string];

const DECIMAL = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });

export const decimal = (v: number) => DECIMAL.format(v);

export const totalSentimiento = (s: Sentimiento) => s.positivo + s.negativo + s.neutral;
export const totalTono = (t: Tono) => t.favorable + t.neutral + t.adversa;

export function porcentaje(n: number, base: number): string {
  return base <= 0 ? "0%" : `${Math.round((n / base) * 100)}%`;
}

export function variacionPct(
  actual: number | undefined,
  previo: number | undefined,
): number | null {
  if (actual === undefined || previo === undefined || previo <= 0) return null;
  return ((actual - previo) / previo) * 100;
}

/** "4.5% más que en junio", "igual que en junio", "sin dato para comparar con junio". */
export function comparado(v: number | null, contra: string): string {
  if (v === null || Number.isNaN(v)) return `sin dato para comparar con ${contra}`;
  const abs = Math.abs(v);
  if (abs < 0.05) return `igual que ${contra}`;
  return `${decimal(abs)}% ${v > 0 ? "más" : "menos"} que ${contra}`;
}

function enumerar(partes: readonly string[]): string {
  if (partes.length === 0) return "";
  if (partes.length === 1) return partes[0] ?? "";
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1] ?? ""}`;
}

const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// ------------------------------------------------------------ sentimiento

export function fraseSentimiento(
  s: Sentimiento | undefined,
  sujeto: string,
  dias = 30,
  umbral = UMBRAL_PORCENTAJE,
): string {
  const total = s === undefined ? 0 : totalSentimiento(s);
  if (s === undefined || total === 0) {
    return `Sin comentarios clasificados sobre ${sujeto} en los últimos ${dias} días.`;
  }
  if (total === 1) {
    const cual = s.negativo === 1 ? "negativo" : s.positivo === 1 ? "positivo" : "neutral";
    return `Un solo comentario sobre ${sujeto} en ${dias} días, y fue ${cual}.`;
  }
  if (total < umbral) {
    return (
      `De ${numero(total)} comentarios sobre ${sujeto}, ` +
      `${numero(s.negativo)} ${s.negativo === 1 ? "fue" : "fueron"} ` +
      `${pluralizar(s.negativo, "negativo", "negativos")}, ` +
      `${numero(s.neutral)} ${pluralizar(s.neutral, "neutral", "neutrales")} y ` +
      `${numero(s.positivo)} ${pluralizar(s.positivo, "positivo", "positivos")}.`
    );
  }
  return (
    `De ${numero(total)} comentarios sobre ${sujeto}, ` +
    `${porcentaje(s.negativo, total)} fueron negativos, ` +
    `${porcentaje(s.neutral, total)} neutrales y ${porcentaje(s.positivo, total)} positivos.`
  );
}

export function fraseTono(
  t: Tono | undefined,
  sujeto: string,
  dias: number,
  umbral = UMBRAL_PORCENTAJE,
): string {
  const total = t === undefined ? 0 : totalTono(t);
  if (t === undefined || total === 0) {
    return `Sin clasificación de tono para los titulares sobre ${sujeto}.`;
  }
  if (total === 1) {
    const cual = t.adversa === 1 ? "adverso" : t.favorable === 1 ? "favorable" : "neutral";
    return `Un solo titular sobre ${sujeto} en ${dias} días, con tono ${cual}.`;
  }
  if (total < umbral) {
    return (
      `De ${numero(total)} titulares sobre ${sujeto} en ${dias} días, ` +
      `${numero(t.neutral)} ${t.neutral === 1 ? "tuvo" : "tuvieron"} tono neutral, ` +
      `${numero(t.adversa)} adverso y ${numero(t.favorable)} favorable.`
    );
  }
  return (
    `De ${numero(total)} titulares sobre ${sujeto} en ${dias} días, ` +
    `${porcentaje(t.neutral, total)} tuvieron tono neutral, ` +
    `${porcentaje(t.adversa, total)} adverso y ${porcentaje(t.favorable, total)} favorable.`
  );
}

function predominio<K extends string>(pares: readonly (readonly [K, number])[]): K | null {
  const orden = pares.toSorted((a, b) => b[1] - a[1]);
  const primero = orden[0];
  const segundo = orden[1];
  if (primero === undefined) return null;
  if (segundo !== undefined && segundo[1] === primero[1]) return null;
  return primero[0];
}

/**
 * La brecha entre lo que escribe la prensa y lo que comenta la gente. Solo
 * cuando los dos lados tienen volumen, y siempre en palabras: nunca un
 * numero que los mezcle (docs/PLAN.md seccion 6, regla 3).
 */
export function fraseBrecha(
  t: Tono | undefined,
  s: Sentimiento | undefined,
  sujeto: string,
  umbral = UMBRAL_PORCENTAJE,
): string | null {
  if (t === undefined || s === undefined) return null;
  if (totalTono(t) < umbral || totalSentimiento(s) < umbral) return null;
  const prensa = predominio([
    ["neutral", t.neutral],
    ["adverso", t.adversa],
    ["favorable", t.favorable],
  ] as const);
  const gente = predominio([
    ["neutral", s.neutral],
    ["negativo", s.negativo],
    ["positivo", s.positivo],
  ] as const);
  const p = prensa === null ? "sin un tono predominante" : `en tono mayormente ${prensa}`;
  const g = gente === null ? "sin un sentimiento predominante" : `en tono mayormente ${gente}`;
  return `La prensa escribe sobre ${sujeto} ${p}; quien comenta lo hace ${g}.`;
}

// ------------------------------------------------------------------ crimen

export function fraseCrimen(m: MunicipioSesnsp, nombre: string): string {
  const n = m.por_mes.length;
  const ultimo = m.por_mes[n - 1];
  const previo = m.por_mes[n - 2];
  if (ultimo === undefined) {
    return `${nombre} no tiene serie mensual de delitos en este corte.`;
  }
  if (previo === undefined) {
    return `${nombre} reportó ${numero(ultimo)} delitos en ${nombreMes(n - 1)}; sin mes anterior para comparar.`;
  }
  return (
    `${nombre} reportó ${numero(ultimo)} delitos en ${nombreMes(n - 1)}, ` +
    `${comparado(variacionPct(ultimo, previo), `en ${nombreMes(n - 2)}`)}; ` +
    `${numero(m.total)} en lo que va del año.`
  );
}

export function fraseCrimenRegion(
  panel: PanelSesnsp,
  municipios: readonly string[],
): string {
  const series = municipios
    .map((z) => panel.municipios[z])
    .filter((m): m is MunicipioSesnsp => m !== undefined && m.por_mes.length > 0);
  if (series.length === 0) return "Sin serie mensual de delitos en este corte.";
  const n = Math.min(...series.map((m) => m.por_mes.length));
  const suma = (i: number) => series.reduce((acc, m) => acc + (m.por_mes[i] ?? 0), 0);
  const ultimo = suma(n - 1);
  const total = series.reduce((acc, m) => acc + m.total, 0);
  const cuantos = `${series.length === 7 ? "Los siete" : `Los ${series.length}`} municipios`;
  if (n < 2) {
    return `${cuantos} reportaron ${numero(ultimo)} delitos en ${nombreMes(n - 1)}; ${numero(total)} en lo que va del año.`;
  }
  return (
    `${cuantos} reportaron ${numero(ultimo)} delitos en ${nombreMes(n - 1)}, ` +
    `${comparado(variacionPct(ultimo, suma(n - 2)), `en ${nombreMes(n - 2)}`)}; ` +
    `${numero(total)} en lo que va del año.`
  );
}

export function fraseDelitosClave(m: MunicipioSesnsp): string {
  const top = Object.entries(m.delitos_clave)
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (top.length === 0) return "Sin desglose por tipo de delito en este corte.";
  return `Los más frecuentes en el año: ${enumerar(
    top.map(([d, n]) => `${minuscula(d)} (${numero(n)})`),
  )}.`;
}

// ---------------------------------------------------------------- vivienda

export function fraseVivienda(
  s: SerieShf | undefined,
  nombre: string,
  periodo: string | null,
): string {
  if (s === undefined) {
    return `La SHF no publica índice de precios de vivienda para ${nombre}: no hay precio de vivienda medido para esta zona.`;
  }
  const v = s.variacion_anual_pct;
  if (v === null) {
    return `La SHF publica índice para ${nombre}, pero sin variación anual en este corte.`;
  }
  const cuando = periodoLegible(periodo ?? s.periodo);
  if (Math.abs(v) < 0.05) {
    return `En ${nombre}, la vivienda comprada con crédito hipotecario no cambió de precio en un año (SHF, ${cuando}).`;
  }
  return `En ${nombre}, la vivienda comprada con crédito hipotecario ${v > 0 ? "subió" : "bajó"} ${decimal(Math.abs(v))}% en un año (SHF, ${cuando}).`;
}

export function fraseViviendaRegion(
  estado: SerieShf | undefined,
  nacional: SerieShf | undefined,
  periodo: string | null,
): string {
  if (estado === undefined || estado.variacion_anual_pct === null) {
    return "Sin variación anual del índice de vivienda para Baja California en este corte.";
  }
  const v = estado.variacion_anual_pct;
  const dir = v > 0 ? "subió" : v < 0 ? "bajó" : "no cambió";
  const pais =
    nacional === undefined || nacional.variacion_anual_pct === null
      ? ""
      : `; en el país, ${decimal(Math.abs(nacional.variacion_anual_pct))}%`;
  return `En Baja California, la vivienda con crédito hipotecario ${dir} ${decimal(Math.abs(v))}% en un año${pais} (SHF, ${periodoLegible(periodo ?? estado.periodo)}).`;
}

export function frasePredial(m: MunicipioPredial, nombre: string): string {
  return (
    `En ${nombre} se pagaron ${pesos(m.por_cuenta_mxn)} de predial por cuenta en ${m.ciclo}, ` +
    `${comparado(m.variacion_anual_pct, "el ciclo anterior")}.`
  );
}

// -------------------------------------------------------------- percepcion

export function frasePercepcion(
  c: CiudadEnsu | undefined,
  nombre: string,
  nacional: number | null,
  periodo: string | null,
): string {
  if (c === undefined || c.pct_inseguro === null) {
    return `La ENSU nunca ha muestreado ${nombre}: no hay medición de percepción de inseguridad, y no se infiere de otras ciudades.`;
  }
  const pais = nacional === null ? "" : ` El promedio nacional es ${decimal(nacional)}%.`;
  return `En ${nombre}, ${decimal(c.pct_inseguro)}% de las personas de 18 años y más se sienten inseguras (ENSU, ${periodoLegible(periodo)}).${pais}`;
}

// ------------------------------------------------------------------ prensa

export function frasePrensa(n: number, dias: number, nombre: string): string {
  if (n === 0) return `Ninguna nota mencionó ${nombre} en los últimos ${dias} días.`;
  if (n === 1) return `Una sola nota mencionó ${nombre} en los últimos ${dias} días.`;
  return `${numero(n)} notas mencionaron ${nombre} en los últimos ${dias} días.`;
}

export function fraseTemaPrincipal(t: Tema | undefined, nombre: string, dias: number): string {
  if (t === undefined) {
    return `Ningún tema alcanzó el mínimo de notas sobre ${nombre} en ${dias} días.`;
  }
  return `El tema con más notas sobre ${nombre} fue «${t.termino}», con ${numero(t.n)} ${pluralizar(t.n, "nota", "notas")} en ${dias} días.`;
}

// --------------------------------------------------------------- san diego

export function fraseSanDiego(
  zips: PanelSanDiego["zips"],
  codigos: readonly string[],
): string {
  const presentes = codigos
    .map((c) => [c, zips[c]] as const)
    .filter((par): par is readonly [string, { mediana_usd: number; parcelas: number }] =>
      par[1] !== undefined,
    );
  if (presentes.length === 0) {
    return "Sin datos catastrales para los códigos postales fronterizos en este corte.";
  }
  const orden = presentes.toSorted((a, b) => a[1].mediana_usd - b[1].mediana_usd);
  const min = orden[0];
  const max = orden[orden.length - 1];
  if (min === undefined || max === undefined) return "";
  return (
    `La mediana del valor catastral en los ${orden.length} códigos postales fronterizos va de ` +
    `${dolares(min[1].mediana_usd)} (${min[0]}) a ${dolares(max[1].mediana_usd)} (${max[0]}). ` +
    `Es valor catastral, no de venta.`
  );
}
