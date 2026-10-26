/**
 * El registro de herramientas del MCP y las de GASTO: cuanto ha costado y
 * cuanto cuesta cada accion. Las que leen el tablero estan en
 * herramientas-lectura.ts y las que gastan o borran en herramientas-pago.ts.
 *
 * Lo que cuestan las cosas sale de dos fuentes y nunca se inventa una
 * tercera: la cuenta de Apify (lo cobrado, lib/uso/apify.ts) y los libros
 * del tablero en Neon (de quien fue, lib/uso/libros.ts). Lo que ninguna dice
 * se publica como `sin_dato` con su razon, nunca como 0: un cero de IA antes
 * del 26 de octubre de 2026 diria «no se gasto» cuando lo cierto es «no se
 * anotaba» (regla 4 de PRODUCT.md, llevada al dinero).
 */

import { hayBaseDeDatos } from "@/lib/acceso/bd";
import { TOPE_MENSUAL_USD as TOPE_BUSQUEDA } from "@/lib/redes-en-vivo/config";
import { TOPE_MENSUAL_USD as TOPE_SEGUIMIENTO } from "@/lib/seguimiento/config";
import { cuentaApify, gastoPorActor, SinApify } from "@/lib/uso/apify";
import { accionesRecientes, gastoPorAccion, gastoPorPersona, modeloAnotadoDesde, type FilaAccion } from "@/lib/uso/libros";
import { PRECIOS } from "@/lib/uso/modelo";
import { periodoDe, PeriodoInvalido, ZONA, type Periodo } from "@/lib/uso/periodo";
import { conContexto, type CostoModelo } from "@/lib/uso/contexto";
import { TOPE_POR_BUSQUEDA } from "@/lib/redes-en-vivo/responder";
import { ErrorDeAccion, type Contexto, type Herramienta } from "./comun";
import { HERRAMIENTAS_LECTURA } from "./herramientas-lectura";
import { HERRAMIENTAS_PAGO } from "./herramientas-pago";

export type { Herramienta };

type Argumentos = Record<string, unknown>;

const PERIODO = {
  desde: { type: "string", description: "Primer día, AAAA-MM-DD, hora de Tijuana. Si falta: el día 1 del mes en curso." },
  hasta: { type: "string", description: "Último día (incluido), AAAA-MM-DD. Si falta: hoy." },
};

const SOLO_LECTURA = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const redondo = (n: number) => Math.round(n * 100) / 100;

/** Un despliegue sin algo configurado: se dice, no es un bug. */
class SinConfiguracion extends Error {}

function sinBase(): never {
  throw new SinConfiguracion("Este despliegue no tiene base de datos: los libros de gasto no se pueden leer.");
}

async function intentar<T>(f: () => Promise<T>): Promise<{ ok: true; valor: T } | { ok: false; razon: string }> {
  try {
    return { ok: true, valor: await f() };
  } catch (e) {
    return { ok: false, razon: e instanceof Error ? e.message : "Error desconocido" };
  }
}

function sumar(filas: FilaAccion[], filtro: (accion: string) => boolean): number {
  return filas.filter((f) => filtro(f.accion)).reduce((s, f) => s + f.usd_total, 0);
}

const esModelo = (a: string) => a.startsWith("modelo:");

async function resumen(a: Argumentos) {
  const p = periodoDe(a.desde, a.hasta);
  const mes = periodoDe(undefined, undefined);
  if (!hayBaseDeDatos()) sinBase();
  const [cuenta, acciones, delMes, desde] = await Promise.all([
    intentar(() => cuentaApify(p)),
    gastoPorAccion(p),
    gastoPorAccion(mes),
    modeloAnotadoDesde(),
  ]);
  const busqueda = sumar(acciones, (x) => x === "busqueda_redes");
  const seguimiento = sumar(acciones, (x) => x === "seguimiento");
  const ia = sumar(acciones, esModelo);
  const apify = cuenta.ok
    ? {
        usd_cobrado_en_el_periodo: cuenta.valor.periodo_usd,
        de_eso: {
          busqueda_en_vivo_en_redes: redondo(busqueda),
          actualizaciones_de_seguimiento: redondo(seguimiento),
          cosecha_automatica_cada_6_horas_y_reportes_a_mano: redondo(Math.max(0, cuenta.valor.periodo_usd - busqueda - seguimiento)),
        },
        ciclo_de_facturacion: cuenta.valor.ciclo,
      }
    : { sin_dato: cuenta.razon, anotado_por_el_tablero_usd: redondo(busqueda + seguimiento) };
  const iaBloque = desde === null
    ? { sin_dato: "El costo de IA se anota desde que se desplegó este registro; todavía no hay llamadas anotadas." }
    : {
        usd: redondo(ia),
        anotado_desde: desde,
        ...(desde > p.desde ? { aviso: `Antes del ${desde} no se anotaba: lo anterior a esa fecha falta, no es cero.` } : {}),
        por_accion: acciones.filter((f) => esModelo(f.accion)).map((f) => ({ accion: f.nombre, veces: f.veces, usd: f.usd_total })),
      };
  const mesBusqueda = sumar(delMes, (x) => x === "busqueda_redes");
  const mesSeguimiento = sumar(delMes, (x) => x === "seguimiento");
  return {
    periodo: { ...p, zona_horaria: ZONA },
    // Lo que se sabe, y si le falta algo, que le falta: un total sin la IA
    // no se presenta como el total.
    total_usd: cuenta.ok
      ? {
          conocido: redondo(cuenta.valor.periodo_usd + ia),
          completo: desde !== null && desde <= p.desde,
          ...(desde !== null && desde <= p.desde ? {} : { le_falta: desde === null ? "el costo de IA, que todavía no tiene llamadas anotadas" : `el costo de IA anterior al ${desde}` }),
        }
      : "sin_dato",
    apify,
    ia_anthropic: iaBloque,
    topes_del_mes: [
      { que: "Búsqueda en vivo en redes", usd_gastado: redondo(mesBusqueda), usd_tope: TOPE_BUSQUEDA, usd_disponible: redondo(TOPE_BUSQUEDA - mesBusqueda) },
      { que: "Seguimiento de publicaciones", usd_gastado: redondo(mesSeguimiento), usd_tope: TOPE_SEGUIMIENTO, usd_disponible: redondo(TOPE_SEGUIMIENTO - mesSeguimiento) },
      ...(cuenta.ok ? [{ que: "Cuenta de Apify (ciclo de facturación)", usd_gastado: cuenta.valor.ciclo.usd_gastado, usd_tope: cuenta.valor.ciclo.usd_tope, usd_disponible: cuenta.valor.ciclo.usd_disponible }] : []),
      { que: "IA (Anthropic)", usd_tope: "sin tope propio en el tablero" },
    ],
    notas: [
      "Apify reporta días en UTC y el tablero en hora de Tijuana: en el borde del periodo puede haber unas horas de diferencia.",
      "Lo que aún no termina cuenta su reserva máxima, igual que los topes.",
    ],
  };
}

async function porAccion(a: Argumentos) {
  const p = periodoDe(a.desde, a.hasta);
  if (!hayBaseDeDatos()) sinBase();
  const [acciones, desde] = await Promise.all([gastoPorAccion(p), modeloAnotadoDesde()]);
  return {
    periodo: { ...p, zona_horaria: ZONA },
    acciones: acciones.map(({ accion: _clave, ...f }) => f),
    ia_anotada_desde: desde ?? "sin_dato",
    precios_de_ia_usd_por_millon_de_tokens: PRECIOS.map((x) => ({ modelo: x.prefijo, entrada: x.entrada, salida: x.salida })),
    no_incluye: "La cosecha automática de redes cada seis horas no es una acción de una persona: su costo está en gasto_apify_por_actor y en resumen_de_gasto.",
  };
}

async function porPersona(a: Argumentos) {
  const p = periodoDe(a.desde, a.hasta);
  if (!hayBaseDeDatos()) sinBase();
  return { periodo: { ...p, zona_horaria: ZONA }, personas: await gastoPorPersona(p) };
}

async function recientes(a: Argumentos) {
  // Sin fechas, los ultimos 90 dias: «lo ultimo» no es «lo de este mes» el
  // dia 1.
  const hace90 = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const p: Periodo = periodoDe(a.desde ?? hace90, a.hasta);
  if (!hayBaseDeDatos()) sinBase();
  const limite = Math.min(200, Math.max(1, Math.trunc(Number(a.limite ?? 25)) || 25));
  const correo = typeof a.correo === "string" && a.correo.trim() !== "" ? a.correo.trim() : null;
  return { acciones: await accionesRecientes(p, limite, correo) };
}

async function porActor(a: Argumentos) {
  const p = periodoDe(a.desde, a.hasta);
  // claude.ai corta una herramienta a los 240 s y Vercel la ruta a los 60
  // (maxDuration): el reparto se detiene a los 40 y lo dice.
  const { actores, completo } = await gastoPorActor(p, 40_000);
  return {
    periodo: { ...p, zona_horaria: ZONA },
    actores,
    usd_total: redondo(actores.reduce((s, x) => s + x.usd_total, 0)),
    ...(completo ? {} : { aviso: "El periodo tiene más corridas de las que se leen en una consulta: los totales cubren solo las más recientes. Pide un periodo más corto." }),
    nota: "Es el costo de cada corrida; el almacenamiento de la cuenta se cobra aparte y está en resumen_de_gasto.",
  };
}

/** Lo que suele costar cada accion pagada, medido (AGENTS.md lleva las
 *  fechas de cada medida). Es la cifra de antes de hacerla; la de despues la
 *  dice la respuesta de la herramienta, y el promedio real, los libros. */
const REFERENCIA: { accion: string; herramienta: string; tipico: string; reserva_maxima_usd?: number; tope?: string }[] = [
  { accion: "busqueda_redes", herramienta: "busqueda_en_vivo_en_redes", tipico: "US$0.17 medido; hasta ~US$0.60", reserva_maxima_usd: TOPE_POR_BUSQUEDA, tope: `US$${TOPE_BUSQUEDA} al mes, 10 al día por persona` },
  { accion: "seguimiento", herramienta: "seguir_publicacion / actualizar_seguimiento", tipico: "US$0.07 en promedio por lectura", reserva_maxima_usd: 0.6, tope: `US$${TOPE_SEGUIMIENTO} al mes, 10 al día por persona` },
  { accion: "modelo:guion", herramienta: "generar_guion", tipico: "US$0.02–0.04 por guion" },
  { accion: "modelo:detallar", herramienta: "detallar_nota", tipico: "US$0.01–0.02 por nota" },
  { accion: "modelo:analizar", herramienta: "analizar_nota", tipico: "menos de US$0.01" },
  { accion: "modelo:analizar-publicacion", herramienta: "analizar_publicacion", tipico: "menos de US$0.01" },
  { accion: "modelo:resumen-seguimiento", herramienta: "resumir_comentarios_seguidos", tipico: "US$0.01–0.02" },
];

async function cuantoCuesta() {
  const p = periodoDe(new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10), undefined);
  const filas = hayBaseDeDatos() ? await gastoPorAccion(p) : [];
  return {
    acciones: REFERENCIA.map((r) => {
      // «modelo:analizar» no debe sumar «modelo:analizar-publicacion».
      const propias = filas.filter((f) => f.accion === r.accion || f.accion.startsWith(`${r.accion}:`));
      const veces = propias.reduce((n, f) => n + f.veces, 0);
      const total = propias.reduce((n, f) => n + f.usd_total, 0);
      return {
        ...r,
        ultimos_90_dias: veces > 0 ? { veces, usd_total: redondo(total), usd_promedio: Math.round((total / veces) * 10_000) / 10_000 } : "sin_dato",
      };
    }),
    gratis: "Leer noticias, redes, X, garitas, reportes, expedientes, el seguimiento, el gasto electoral y los usuarios no cuesta.",
    automatico: "La cosecha de redes cada seis horas cuesta aunque nadie pulse nada; está en resumen_de_gasto y gasto_apify_por_actor.",
  };
}

const HERRAMIENTAS_GASTO: Herramienta[] = [
  {
    name: "cuanto_cuesta_cada_accion",
    title: "Cuánto cuesta cada acción",
    description: "Antes de hacer algo que cuesta: lo que suele costar cada acción pagada del tablero, su reserva máxima, su tope, y lo que costó de verdad en promedio los últimos 90 días.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: SOLO_LECTURA,
    correr: cuantoCuesta,
  },
  {
    name: "resumen_de_gasto",
    title: "Resumen de gasto",
    description: "Cuánto ha costado Pulso N33 en un periodo: lo que cobró Apify (y qué parte fue búsqueda en vivo, seguimiento o la cosecha automática) más lo que costó la IA de Anthropic, con los topes del mes y lo que queda. Es la vista general; las demás herramientas detallan una parte.",
    inputSchema: { type: "object", properties: PERIODO, additionalProperties: false },
    annotations: SOLO_LECTURA,
    correr: resumen,
  },
  {
    name: "costo_por_accion",
    title: "Costo por acción",
    description: "Cuánto cuesta cada tipo de acción del tablero (una búsqueda en vivo, actualizar una publicación seguida, un guion de cada programa, Analizar, Detallar…): cuántas veces se hizo, el total y el costo promedio, mínimo y máximo de una vez.",
    inputSchema: { type: "object", properties: PERIODO, additionalProperties: false },
    annotations: SOLO_LECTURA,
    correr: porAccion,
  },
  {
    name: "gasto_por_persona",
    title: "Gasto por persona",
    description: "Cuánto generó cada persona del equipo en el periodo, con el desglose por tipo de acción.",
    inputSchema: { type: "object", properties: PERIODO, additionalProperties: false },
    annotations: SOLO_LECTURA,
    correr: porPersona,
  },
  {
    name: "acciones_recientes",
    title: "Acciones recientes",
    description: "Las últimas acciones con costo, una por fila: cuándo, quién, qué y cuánto costó. Opcionalmente de una sola persona por su correo.",
    inputSchema: {
      type: "object",
      properties: {
        limite: { type: "integer", minimum: 1, maximum: 200, description: "Cuántas filas (25 si falta)." },
        correo: { type: "string", description: "Solo las de esta persona." },
        desde: { type: "string", description: "Primer día, AAAA-MM-DD, hora de Tijuana. Si falta: hace 90 días." },
        hasta: PERIODO.hasta,
      },
      additionalProperties: false,
    },
    annotations: SOLO_LECTURA,
    correr: recientes,
  },
  {
    name: "gasto_apify_por_actor",
    title: "Gasto de Apify por actor",
    description: "Lo que cobró Apify en el periodo repartido por actor (Instagram, TikTok, Facebook, X…), con número de corridas y costo por corrida. Incluye la cosecha automática cada seis horas.",
    inputSchema: { type: "object", properties: PERIODO, additionalProperties: false },
    annotations: SOLO_LECTURA,
    correr: porActor,
  },
];

export const HERRAMIENTAS: Herramienta[] = [...HERRAMIENTAS_GASTO, ...HERRAMIENTAS_LECTURA, ...HERRAMIENTAS_PAGO];

/** Lo que vuelve a Claude cabe en ~150,000 caracteres en claude.ai. */
const TOPE_CARACTERES = 140_000;

const micro = (n: number) => Math.round(n * 1_000_000) / 1_000_000;

function costoIa(costos: CostoModelo[]) {
  return { usd: micro(costos.reduce((n, c) => n + c.usd, 0)), llamadas: costos.map((c) => ({ ...c, usd: micro(c.usd) })) };
}

/**
 * El resultado de `tools/call`. Corre dentro del contexto de uso (quien
 * llama y lo que cuesta); si la accion llamo al modelo, la respuesta lleva
 * `costo_ia` con la suma exacta. Un error de la pregunta vuelve al modelo como
 * `isError` para que corrija; no es un error del protocolo.
 */
export async function correrHerramienta(nombre: string, argumentos: Argumentos, contexto: Contexto) {
  const h = HERRAMIENTAS.find((x) => x.name === nombre);
  if (h === undefined) return { isError: true, content: [{ type: "text", text: `No existe la herramienta «${nombre}».` }] };
  const uso = { usuarioId: contexto.usuarioId, costos: [] as CostoModelo[] };
  try {
    let valor = await conContexto(uso, () => h.correr(argumentos, contexto));
    if (uso.costos.length > 0) {
      valor = valor !== null && typeof valor === "object" && !Array.isArray(valor)
        ? { ...(valor as object), costo_ia: costoIa(uso.costos) }
        : { resultado: valor, costo_ia: costoIa(uso.costos) };
    }
    const texto = JSON.stringify(valor, null, 1);
    if (texto.length > TOPE_CARACTERES) {
      return { content: [{ type: "text", text: `${texto.slice(0, TOPE_CARACTERES)}\n… (recortado: no cabe completo; pide menos con los filtros de la herramienta)` }] };
    }
    return { content: [{ type: "text", text: texto }], structuredContent: valor };
  } catch (e) {
    const esperado = e instanceof PeriodoInvalido || e instanceof SinConfiguracion || e instanceof SinApify || e instanceof ErrorDeAccion;
    if (!esperado) console.error(e);
    const texto = e instanceof Error ? e.message : "Error desconocido";
    // Si la accion alcanzo a llamar al modelo y luego fallo, eso tambien se cobro.
    const cobrado = uso.costos.length > 0 ? `\n(La IA alcanzó a cobrar US$${costoIa(uso.costos).usd}.)` : "";
    return { isError: true, content: [{ type: "text", text: `${texto}${cobrado}` }] };
  }
}
