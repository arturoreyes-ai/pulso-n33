/**
 * La fecha que un titular dice de si mismo, entre parentesis. Pura.
 *
 * Existe porque la fecha de Google no es la de la nota. ESPN titula sus
 * paginas de partido con la fecha del partido y las sigue actualizando, y
 * Google las fecha el dia en que las volvio a leer: el 25 de septiembre de
 * 2026 el rubro Deportes de Tijuana, con `when:2d`, traia "Atl. San Luis 0-0
 * Tijuana (31 de Jul., 2026) Resultado Final", "Guadalajara 5-2 Tijuana (22
 * de Ago., 2026)" y "Tijuana 2-1 Cruz Azul (Aug 16, 2026) Final Score", las
 * tres con hora del 24 o el 25, y la tarjeta imprimia esa hora. El titular es
 * la unica evidencia que se tiene, y aqui dice julio.
 *
 * Solo entre parentesis y con la fecha completa, dia, mes y el numero del
 * calendario, que es la gramatica de esas paginas: "(25 Sep., 2026)
 * Resultados en Vivo" es la de hoy y se queda. Una fecha en la prosa NO
 * cuenta: "Recuerdan el sismo del 19 de septiembre de 1985" es nota de hoy.
 */

import { plegar } from "@/lib/dominio/formato";

const MESES: Record<string, number> = {
  ene: 0, enero: 0, jan: 0, january: 0,
  feb: 1, febrero: 1, february: 1,
  mar: 2, marzo: 2, march: 2,
  abr: 3, abril: 3, apr: 3, april: 3,
  may: 4, mayo: 4,
  jun: 5, junio: 5, june: 5,
  jul: 6, julio: 6, july: 6,
  ago: 7, agosto: 7, aug: 7, august: 7,
  sep: 8, sept: 8, set: 8, septiembre: 8, setiembre: 8, september: 8,
  oct: 9, octubre: 9, october: 9,
  nov: 10, noviembre: 10, november: 10,
  dic: 11, diciembre: 11, dec: 11, december: 11,
};

// "(31 de jul., 2026)", "(25 sep., 2026)" y "(aug 16, 2026)", ya plegados.
const DIA_MES = /\((\d{1,2})\s+(?:de\s+)?([a-z]+)\.?,?\s+(?:de\s+)?(\d{4})\)/;
const MES_DIA = /\(([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})\)/;

/** La fecha entre parentesis del titular, a medianoche UTC, o null. */
export function fechaDelTitular(titulo: string): Date | null {
  const t = plegar(titulo);
  let dia: string | undefined, mes: string | undefined, anio: string | undefined;
  const a = DIA_MES.exec(t);
  if (a) [, dia, mes, anio] = a;
  else {
    const b = MES_DIA.exec(t);
    if (b) [, mes, dia, anio] = b;
  }
  if (dia === undefined || mes === undefined || anio === undefined) return null;
  const m = MESES[mes];
  const d = Number(dia);
  if (m === undefined || d < 1 || d > 31) return null;
  return new Date(Date.UTC(Number(anio), m, d));
}

/**
 * Tres dias: la ventana del rubro (dos) mas uno por la zona horaria, porque
 * la fecha del titular es la del lugar del partido y `ahora` es UTC.
 */
export const DIAS_VIGENCIA_TITULAR = 3;

/** Si el titular dice, entre parentesis, una fecha mas vieja que la vigencia. */
export function titularVencido(titulo: string, ahora: string): boolean {
  const f = fechaDelTitular(titulo);
  if (f === null) return false;
  return Date.parse(ahora) - f.getTime() > DIAS_VIGENCIA_TITULAR * 86_400_000;
}
