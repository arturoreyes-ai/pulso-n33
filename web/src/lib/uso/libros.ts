/**
 * Lo que el tablero anoto que gasto, leido de sus tres libros en Neon:
 *
 *  - `busquedas_redes` (db/0002): cada busqueda en vivo pagada en Apify.
 *  - `gasto_seguimiento` (db/0003): cada «Actualizar» de /seguimiento.
 *  - `uso_modelo` (db/0005): cada llamada a Anthropic, desde el 26 de
 *    octubre de 2026. Antes de esa fecha no hay nada que leer, y el MCP lo
 *    dice con `modelo_anotado_desde` en vez de reportar cero.
 *
 * Una fila que no ha terminado cuenta su reserva (`tope_usd`), igual que los
 * topes: es el peor caso y es lo que ya esta comprometido. Se marca
 * `en_curso` para que nadie la lea como cobro cerrado.
 *
 * Solo lectura. Nada de aqui escribe ni toca un texto: los tres libros
 * guardan cifras y una etiqueta, nunca lo buscado ni lo comentado.
 */

import { sql } from "@/lib/acceso/bd";
import { NOMBRE_PROGRAMA, type ProgramaGuion } from "@/lib/analisis/contrato-guion";
import { ZONA, type Periodo } from "./periodo";

/** Lo que dice cada etiqueta, para quien no conoce el codigo. */
const NOMBRE_ACCION: Record<string, string> = {
  busqueda_redes: "Búsqueda en vivo en redes (Apify)",
  seguimiento: "Actualizar una publicación seguida (Apify)",
  "modelo:analizar": "Analizar una nota de prensa (IA)",
  "modelo:analizar-publicacion": "Analizar una publicación de redes (IA)",
  "modelo:informe-consulta": "Lectura automática del reporte de un término (IA)",
  "modelo:resumen-seguimiento": "Resumen de comentarios de una publicación seguida (IA)",
};

export function nombreDeAccion(accion: string): string {
  const fija = NOMBRE_ACCION[accion];
  if (fija !== undefined) return fija;
  const [, tipo, programa] = accion.split(":");
  const nombre = NOMBRE_PROGRAMA[programa as ProgramaGuion] ?? programa ?? "";
  if (tipo === "guion") return `Guion para locución: ${nombre} (IA)`;
  if (tipo === "detallar") return `Detallar una nota del guion: ${nombre} (IA)`;
  return accion;
}

async function hayTablaModelo(): Promise<boolean> {
  const [fila] = (await sql()`SELECT to_regclass('uso_modelo') IS NOT NULL AS hay`) as { hay: boolean }[];
  return fila?.hay === true;
}

/** Los tres libros como una sola lista. $1 y $2 son el periodo. */
function movimientos(conModelo: boolean): string {
  const modelo = conModelo
    ? `UNION ALL
       SELECT 'modelo:' || accion, usuario_id, usd::float8, false, CASE WHEN negativa THEN 'negativa del modelo' END,
              modelo, tokens_entrada, tokens_salida, creado_en
         FROM uso_modelo`
    : "";
  return `
    WITH mov AS (
      SELECT 'busqueda_redes'::text AS accion, usuario_id,
             (CASE WHEN terminado_en IS NULL THEN tope_usd ELSE usd END)::float8 AS usd,
             (terminado_en IS NULL) AS en_curso, estado::text AS detalle,
             NULL::text AS modelo, NULL::int AS tokens_entrada, NULL::int AS tokens_salida, creado_en
        FROM busquedas_redes
      UNION ALL
      SELECT 'seguimiento', usuario_id,
             (CASE WHEN terminado_en IS NULL THEN tope_usd ELSE usd END)::float8,
             (terminado_en IS NULL), NULL, NULL, NULL, NULL, creado_en
        FROM gasto_seguimiento
      ${modelo}
    ), en_periodo AS (
      SELECT * FROM mov
       WHERE (creado_en AT TIME ZONE '${ZONA}')::date BETWEEN $1::date AND $2::date
    )`;
}

const redondo = (n: number) => Math.round(n * 10_000) / 10_000;

export type FilaAccion = {
  accion: string;
  nombre: string;
  veces: number;
  usd_total: number;
  usd_promedio: number;
  usd_minimo: number;
  usd_maximo: number;
  en_curso: number;
};

export async function gastoPorAccion(p: Periodo): Promise<FilaAccion[]> {
  const filas = (await sql().query(`${movimientos(await hayTablaModelo())}
    SELECT accion, COUNT(*)::int AS veces, SUM(usd)::float8 AS total, AVG(usd)::float8 AS promedio,
           MIN(usd)::float8 AS minimo, MAX(usd)::float8 AS maximo, COUNT(*) FILTER (WHERE en_curso)::int AS en_curso
      FROM en_periodo GROUP BY accion ORDER BY total DESC`, [p.desde, p.hasta])) as {
    accion: string; veces: number; total: number; promedio: number; minimo: number; maximo: number; en_curso: number;
  }[];
  return filas.map((f) => ({
    accion: f.accion,
    nombre: nombreDeAccion(f.accion),
    veces: f.veces,
    usd_total: redondo(f.total),
    usd_promedio: redondo(f.promedio),
    usd_minimo: redondo(f.minimo),
    usd_maximo: redondo(f.maximo),
    en_curso: f.en_curso,
  }));
}

export type FilaPersona = {
  usuario_id: number | null;
  nombre: string;
  correo: string | null;
  veces: number;
  usd_total: number;
  por_accion: { nombre: string; veces: number; usd: number }[];
};

export async function gastoPorPersona(p: Periodo): Promise<FilaPersona[]> {
  const filas = (await sql().query(`${movimientos(await hayTablaModelo())}
    SELECT e.usuario_id, u.nombre, u.correo, e.accion, COUNT(*)::int AS veces, SUM(e.usd)::float8 AS total
      FROM en_periodo e LEFT JOIN usuarios u ON u.id = e.usuario_id
     GROUP BY e.usuario_id, u.nombre, u.correo, e.accion`, [p.desde, p.hasta])) as {
    usuario_id: number | null; nombre: string | null; correo: string | null; accion: string; veces: number; total: number;
  }[];
  const personas = new Map<string, FilaPersona>();
  for (const f of filas) {
    const llave = String(f.usuario_id);
    let persona = personas.get(llave);
    if (persona === undefined) {
      persona = {
        usuario_id: f.usuario_id,
        // El id 0 es el usuario sintetico del modo sin Entra; nulo, una
        // llamada que no vino de una sesion (un script a mano).
        nombre: f.nombre ?? (f.usuario_id === 0 ? "Desarrollo local" : f.usuario_id === null ? "Sin sesión (script o tarea)" : `Usuario ${f.usuario_id}`),
        correo: f.correo,
        veces: 0,
        usd_total: 0,
        por_accion: [],
      };
      personas.set(llave, persona);
    }
    persona.veces += f.veces;
    persona.usd_total += f.total;
    persona.por_accion.push({ nombre: nombreDeAccion(f.accion), veces: f.veces, usd: redondo(f.total) });
  }
  return [...personas.values()]
    .map((x) => ({ ...x, usd_total: redondo(x.usd_total), por_accion: x.por_accion.toSorted((a, b) => b.usd - a.usd) }))
    .toSorted((a, b) => b.usd_total - a.usd_total);
}

export type FilaReciente = {
  cuando: string;
  accion: string;
  persona: string;
  usd: number;
  en_curso: boolean;
  detalle: string | null;
  modelo: string | null;
  tokens_entrada: number | null;
  tokens_salida: number | null;
};

export async function accionesRecientes(p: Periodo, limite: number, correo: string | null): Promise<FilaReciente[]> {
  const filtro = correo === null ? "" : "WHERE lower(u.correo) = lower($4)";
  const params: unknown[] = [p.desde, p.hasta, limite];
  if (correo !== null) params.push(correo);
  const filas = (await sql().query(`${movimientos(await hayTablaModelo())}
    SELECT e.*, u.nombre, u.correo
      FROM en_periodo e LEFT JOIN usuarios u ON u.id = e.usuario_id
      ${filtro}
     ORDER BY e.creado_en DESC LIMIT $3`, params)) as {
    accion: string; usuario_id: number | null; usd: number; en_curso: boolean; detalle: string | null; modelo: string | null;
    tokens_entrada: number | null; tokens_salida: number | null; creado_en: string | Date; nombre: string | null; correo: string | null;
  }[];
  return filas.map((f) => ({
    cuando: new Date(f.creado_en).toLocaleString("es-MX", { timeZone: ZONA, dateStyle: "medium", timeStyle: "short" }),
    accion: nombreDeAccion(f.accion),
    persona: f.nombre ?? (f.usuario_id === null ? "Sin sesión" : `Usuario ${f.usuario_id}`),
    usd: redondo(f.usd),
    en_curso: f.en_curso,
    detalle: f.detalle,
    modelo: f.modelo,
    tokens_entrada: f.tokens_entrada,
    tokens_salida: f.tokens_salida,
  }));
}

/** Desde cuando hay costo de IA anotado; null si todavia nada. */
export async function modeloAnotadoDesde(): Promise<string | null> {
  if (!(await hayTablaModelo())) return null;
  const [fila] = (await sql()`SELECT MIN(creado_en) AS desde FROM uso_modelo`) as { desde: string | Date | null }[];
  return fila?.desde ? new Date(fila.desde).toISOString().slice(0, 10) : null;
}
