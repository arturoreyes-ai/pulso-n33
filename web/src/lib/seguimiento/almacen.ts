import { sql } from "@/lib/acceso/bd";
import type { ConteoTono, IdiomaSeguido, Metricas, PublicacionSeguida, RedSeguida, TonoComentario } from "./contrato";

/**
 * Lo que el seguimiento guarda en Neon (web/db/0003_seguimiento.sql). Solo
 * servidor.
 *
 * Tres trabajos que una funcion sin estado no puede hacer sola, los mismos
 * que el libro de la busqueda en vivo (redes-en-vivo/libro.ts):
 *
 *  - Sostener el tope. `reservar` cuenta el mes y el dia y escribe la fila en
 *    UNA transaccion con un candado de asesoria: dos personas que pulsan a la
 *    vez no pueden ver las dos el mes vacio.
 *  - Que solo una peticion guarde. `reclamar` es un UPDATE condicionado al
 *    estado; si la que gano murio a la mitad, otra lo retoma a los dos
 *    minutos.
 *  - No pagar dos veces lo mismo. Pulsar otra vez mientras una lectura corre
 *    devuelve esa lectura, y pulsar dentro de la media hora de la ultima no
 *    arranca nada.
 *
 * Detras de una interfaz para que scripts/probar-seguimiento.cjs pruebe la
 * logica sin base de datos.
 */

export interface Pasada {
  id: string;
  dataset: string;
  usd: number | null;
}

export interface Corridas {
  publicacion?: Pasada | null;
  comentarios?: Pasada | null;
}

export interface FilaSeguimiento {
  id: string;
  red: RedSeguida;
  url: string;
  idioma: IdiomaSeguido;
  titulo: string | null;
  creador: string | null;
  publicado: string | null;
  tipo: PublicacionSeguida["tipo"];
  usuarioId: number;
  creado: string;
}

export interface FilaActualizacion {
  id: string;
  seguimientoId: string;
  gastoId: string;
  topeUsd: number;
  estado: "leyendo" | "guardando" | "listo" | "fallo";
  corridas: Corridas;
  reclamada: string | null;
  metricas: Metricas | null;
  leidos: number | null;
  nuevos: number | null;
  tono: ConteoTono | null;
  creado: string;
  terminado: string | null;
}

export interface FilaComentario {
  huella: string;
  texto: string;
  likes: number;
  escrito: string | null;
  sentimiento: TonoComentario | null;
  primeraVez: string;
}

export interface FilaLista extends FilaSeguimiento {
  ultima: { fecha: string; metricas: Metricas | null } | null;
  enCurso: boolean;
  comentarios: number;
}

export type Reserva =
  | { ok: true; actualizacion: FilaActualizacion; enCurso: boolean }
  | { ok: false; motivo: "mes" | "dia" | "no_existe" }
  | { ok: false; motivo: "reciente"; fecha: string };

export interface ComentarioNuevo {
  huella: string;
  texto: string;
  likes: number;
  escrito: string | null;
  sentimiento: TonoComentario | null;
}

export interface Guardado {
  actualizacion: FilaActualizacion;
  publicacion: { titulo: string; creador: string | null; publicado: string | null; tipo: NonNullable<PublicacionSeguida["tipo"]> } | null;
  metricas: Metricas | null;
  comentarios: ComentarioNuevo[];
  nuevos: number;
  tono: ConteoTono | null;
  usd: number;
}

export interface Almacen {
  listar(retencionDias: number): Promise<FilaLista[]>;
  leer(id: string): Promise<FilaSeguimiento | null>;
  /** La publicacion con esa URL, nueva o la que ya estaba. */
  agregar(args: { red: RedSeguida; url: string; idioma: IdiomaSeguido; usuarioId: number }): Promise<{ fila: FilaSeguimiento; nueva: boolean }>;
  actualizaciones(id: string, limite: number): Promise<FilaActualizacion[]>;
  comentarios(id: string, retencionDias: number, limite: number): Promise<{ filas: FilaComentario[]; conteo: ConteoTono }>;
  /** De estas huellas, las que ya estan guardadas, con su etiqueta. */
  conocidas(id: string, huellas: readonly string[]): Promise<Map<string, TonoComentario | null>>;
  reservar(args: { seguimientoId: string; usuarioId: number; topeUsd: number; topeMensual: number; topeDiario: number; minutos: number; zona: string }): Promise<Reserva>;
  guardarCorridas(actualizacionId: string, corridas: Corridas): Promise<void>;
  /** true: esta peticion gano el derecho a guardar. */
  reclamar(actualizacionId: string, ahora: string): Promise<boolean>;
  guardar(g: Guardado): Promise<void>;
  fallar(actualizacionId: string, gastoId: string, usd: number): Promise<void>;
  /** Borra la publicacion con su historia y su texto. Devuelve las lecturas
   *  que no habian terminado, para cerrar su gasto. */
  borrar(id: string): Promise<{ abiertas: FilaActualizacion[] } | null>;
  cerrarGasto(gastoId: string, usd: number): Promise<void>;
  /** Borra el texto vencido. Devuelve cuantos comentarios se fueron. */
  purgar(retencionDias: number): Promise<number>;
}

/** Una lectura sin cerrar deja de bloquear otra a los 20 minutos: sus
 *  corridas se cortan solas a los 4. */
export const MINUTOS_EN_CURSO = 20;
/** Un reclamo sin guardado en este tiempo es de una peticion que murio. */
export const RECLAMO_VENCE_MS = 120_000;

const iso = (x: unknown): string => (x instanceof Date ? x.toISOString() : String(x));
const isoONulo = (x: unknown): string | null => (x === null || x === undefined ? null : iso(x));
const num = (x: unknown): number => (typeof x === "number" ? x : Number(x));

interface SqlSeguimiento {
  id: string; red: RedSeguida; url: string; idioma: string; titulo: string | null; creador: string | null;
  publicado: string | Date | null; tipo: string | null; usuario_id: number; creado_en: string | Date;
}

const deSeguimiento = (f: SqlSeguimiento): FilaSeguimiento => ({
  id: f.id,
  red: f.red,
  url: f.url,
  idioma: f.idioma.trim() === "en" ? "en" : "es",
  titulo: f.titulo,
  creador: f.creador,
  publicado: isoONulo(f.publicado),
  tipo: (f.tipo as PublicacionSeguida["tipo"]) ?? null,
  usuarioId: f.usuario_id,
  creado: iso(f.creado_en),
});

interface SqlActualizacion {
  id: string; seguimiento_id: string; gasto_id: string; tope_usd: string | number; estado: FilaActualizacion["estado"];
  corridas: Corridas | null; reclamada_en: string | Date | null; metricas: Metricas | null; leidos: number | null;
  nuevos: number | null; tono: ConteoTono | null; creado_en: string | Date; terminado_en: string | Date | null;
}

const deActualizacion = (f: SqlActualizacion): FilaActualizacion => ({
  id: f.id,
  seguimientoId: f.seguimiento_id,
  gastoId: f.gasto_id,
  topeUsd: num(f.tope_usd),
  estado: f.estado,
  corridas: f.corridas ?? {},
  reclamada: isoONulo(f.reclamada_en),
  metricas: f.metricas,
  leidos: f.leidos,
  nuevos: f.nuevos,
  tono: f.tono,
  creado: iso(f.creado_en),
  terminado: isoONulo(f.terminado_en),
});

const COLUMNAS_SEGUIMIENTO = "s.id, s.red, s.url, s.idioma, s.titulo, s.creador, s.publicado, s.tipo, s.usuario_id, s.creado_en";

type Valores = Record<string, [unknown, string]>;

/**
 * `$nombre` a `$n::tipo`, y los valores en ese orden. Cada sentencia manda
 * SOLO los parametros que nombra: Postgres rechaza un parametro que la
 * sentencia no usa («could not determine data type of parameter»), y las seis
 * de `reservar` comparten siete valores.
 */
export function conNombres(texto: string, valores: Valores): [string, unknown[]] {
  const orden: string[] = [];
  const salida = texto.replace(/\$([a-z]+)/g, (_, nombre: string) => {
    const par = valores[nombre];
    if (par === undefined) throw new Error(`parametro sin valor: ${nombre}`);
    if (!orden.includes(nombre)) orden.push(nombre);
    return `$${orden.indexOf(nombre) + 1}::${par[1]}`;
  });
  return [salida, orden.map((n) => valores[n]![0])];
}

/** Un numero cualquiera y fijo para el candado; distinto del de 0002. */
const CANDADO = 28092026;

export const almacenNeon: Almacen = {
  async listar(retencionDias) {
    const filas = (await sql().query(`
      SELECT ${COLUMNAS_SEGUIMIENTO},
        (SELECT json_build_object('fecha', a.creado_en, 'metricas', a.metricas)
           FROM seguimiento_actualizaciones a
          WHERE a.seguimiento_id = s.id AND a.estado = 'listo'
          ORDER BY a.creado_en DESC LIMIT 1) AS ultima,
        EXISTS (SELECT 1 FROM seguimiento_actualizaciones a
                 WHERE a.seguimiento_id = s.id AND a.estado IN ('leyendo', 'guardando')
                   AND a.creado_en > now() - make_interval(mins => $2::int)) AS en_curso,
        (SELECT COUNT(*)::int FROM seguimiento_comentarios c
          WHERE c.seguimiento_id = s.id AND c.cosechado_en >= now() - make_interval(days => $1::int)) AS comentarios,
        COALESCE((SELECT MAX(a.creado_en) FROM seguimiento_actualizaciones a WHERE a.seguimiento_id = s.id), s.creado_en) AS movido
      FROM seguimientos s
      ORDER BY movido DESC, s.id
      LIMIT 200
    `, [retencionDias, MINUTOS_EN_CURSO])) as (SqlSeguimiento & { ultima: { fecha: string; metricas: Metricas | null } | null; en_curso: boolean; comentarios: number })[];
    return filas.map((f) => ({
      ...deSeguimiento(f),
      ultima: f.ultima === null ? null : { fecha: iso(f.ultima.fecha), metricas: f.ultima.metricas },
      enCurso: f.en_curso,
      comentarios: f.comentarios,
    }));
  },

  async leer(id) {
    const filas = (await sql().query(`SELECT ${COLUMNAS_SEGUIMIENTO} FROM seguimientos s WHERE s.id = $1`, [id])) as SqlSeguimiento[];
    return filas[0] === undefined ? null : deSeguimiento(filas[0]);
  },

  async agregar({ red, url, idioma, usuarioId }) {
    // Dos personas que pegan la misma publicacion a la vez: una la inserta y
    // la otra la encuentra. Nunca dos filas, por el UNIQUE de url.
    const nuevas = (await sql().query(`
      INSERT INTO seguimientos AS s (red, url, idioma, usuario_id) VALUES ($1, $2, $3, $4)
      ON CONFLICT (url) DO NOTHING
      RETURNING ${COLUMNAS_SEGUIMIENTO}
    `, [red, url, idioma, usuarioId])) as SqlSeguimiento[];
    if (nuevas[0] !== undefined) return { fila: deSeguimiento(nuevas[0]), nueva: true };
    const previas = (await sql().query(`SELECT ${COLUMNAS_SEGUIMIENTO} FROM seguimientos s WHERE s.url = $1`, [url])) as SqlSeguimiento[];
    if (previas[0] === undefined) throw new Error("la publicacion no se pudo agregar");
    return { fila: deSeguimiento(previas[0]), nueva: false };
  },

  async actualizaciones(id, limite) {
    const filas = (await sql().query(`
      SELECT a.id, a.seguimiento_id, a.gasto_id, g.tope_usd, a.estado, a.corridas, a.reclamada_en, a.metricas,
             a.leidos, a.nuevos, a.tono, a.creado_en, a.terminado_en
        FROM seguimiento_actualizaciones a JOIN gasto_seguimiento g ON g.id = a.gasto_id
       WHERE a.seguimiento_id = $1
       ORDER BY a.creado_en DESC
       LIMIT $2
    `, [id, limite])) as SqlActualizacion[];
    return filas.map(deActualizacion);
  },

  async comentarios(id, retencionDias, limite) {
    const bd = sql();
    const [crudas, crudasCuentas] = await Promise.all([
      bd.query(`
        SELECT huella, texto, likes, escrito_en, sentimiento, primera_vez
          FROM seguimiento_comentarios
         WHERE seguimiento_id = $1 AND cosechado_en >= now() - make_interval(days => $2::int)
         ORDER BY escrito_en DESC NULLS LAST, primera_vez DESC, huella
         LIMIT $3
      `, [id, retencionDias, limite]),
      // El tono general cuenta TODO lo guardado, no solo lo que se muestra.
      bd.query(`
        SELECT sentimiento, COUNT(*)::int AS n
          FROM seguimiento_comentarios
         WHERE seguimiento_id = $1 AND cosechado_en >= now() - make_interval(days => $2::int)
         GROUP BY sentimiento
      `, [id, retencionDias]),
    ]);
    const filas = crudas as { huella: string; texto: string; likes: number; escrito_en: string | Date | null; sentimiento: TonoComentario | null; primera_vez: string | Date }[];
    const cuentas = crudasCuentas as { sentimiento: TonoComentario | null; n: number }[];
    const conteo: ConteoTono = { positivo: 0, negativo: 0, neutral: 0, sinTono: 0 };
    for (const c of cuentas) {
      if (c.sentimiento === null) conteo.sinTono += c.n;
      else conteo[c.sentimiento] += c.n;
    }
    return {
      filas: filas.map((f) => ({
        huella: f.huella.trim(),
        texto: f.texto,
        likes: f.likes,
        escrito: isoONulo(f.escrito_en),
        sentimiento: f.sentimiento,
        primeraVez: iso(f.primera_vez),
      })),
      conteo,
    };
  },

  async conocidas(id, huellas) {
    if (huellas.length === 0) return new Map();
    const filas = (await sql().query(
      `SELECT huella, sentimiento FROM seguimiento_comentarios WHERE seguimiento_id = $1 AND huella = ANY($2::text[])`,
      [id, [...huellas]],
    )) as { huella: string; sentimiento: TonoComentario | null }[];
    return new Map(filas.map((f) => [f.huella.trim(), f.sentimiento]));
  },

  async reservar({ seguimientoId, usuarioId, topeUsd, topeMensual, topeDiario, minutos, zona }) {
    const bd = sql();
    const valores: Valores = {
      seguimiento: [seguimientoId, "uuid"],
      usuario: [usuarioId, "int"],
      tope: [topeUsd, "numeric"],
      mensual: [topeMensual, "numeric"],
      diario: [topeDiario, "int"],
      minutos: [minutos, "int"],
      zona: [zona, "text"],
    };
    const q = (texto: string) => bd.query(...conNombres(texto, valores));
    // Todo dentro del candado. El INSERT se condiciona a que la publicacion
    // exista, a que no haya una lectura en curso ni una reciente, y a los dos
    // topes; las consultas previas solo dicen por que no se inserto. Mientras
    // una lectura no termina, el mes cuenta su reserva y no lo que lleva
    // gastado: es el peor caso, y es el que el tope tiene que cubrir.
    const mes = `
      SELECT COALESCE(SUM(CASE WHEN terminado_en IS NULL THEN tope_usd ELSE usd END), 0)
        FROM gasto_seguimiento
       WHERE (creado_en AT TIME ZONE $zona) >= date_trunc('month', now() AT TIME ZONE $zona)`;
    const dia = `
      SELECT COUNT(*) FROM gasto_seguimiento
       WHERE usuario_id = $usuario
         AND (creado_en AT TIME ZONE $zona) >= date_trunc('day', now() AT TIME ZONE $zona)`;
    const enCurso = `
      SELECT 1 FROM seguimiento_actualizaciones
       WHERE seguimiento_id = $seguimiento AND estado IN ('leyendo', 'guardando')
         AND creado_en > now() - make_interval(mins => ${MINUTOS_EN_CURSO})`;
    const reciente = `
      SELECT 1 FROM seguimiento_actualizaciones
       WHERE seguimiento_id = $seguimiento AND estado = 'listo'
         AND creado_en > now() - make_interval(mins => $minutos)`;
    const [, existe, previa, ultima, cuentas, nueva] = (await bd.transaction([
      bd.query(`SELECT pg_advisory_xact_lock(${CANDADO})`),
      q(`SELECT EXISTS (SELECT 1 FROM seguimientos WHERE id = $seguimiento) AS existe`),
      q(`
        SELECT a.id, a.seguimiento_id, a.gasto_id, g.tope_usd, a.estado, a.corridas, a.reclamada_en, a.metricas,
               a.leidos, a.nuevos, a.tono, a.creado_en, a.terminado_en
          FROM seguimiento_actualizaciones a JOIN gasto_seguimiento g ON g.id = a.gasto_id
         WHERE a.seguimiento_id = $seguimiento AND a.estado IN ('leyendo', 'guardando')
           AND a.creado_en > now() - make_interval(mins => ${MINUTOS_EN_CURSO})
         ORDER BY a.creado_en DESC LIMIT 1`),
      q(`
        SELECT creado_en FROM seguimiento_actualizaciones
         WHERE seguimiento_id = $seguimiento AND estado = 'listo'
           AND creado_en > now() - make_interval(mins => $minutos)
         ORDER BY creado_en DESC LIMIT 1`),
      q(`SELECT (${mes})::float8 AS mes, (${dia})::int AS dia`),
      q(`
        WITH permitido AS (
          SELECT 1 WHERE EXISTS (SELECT 1 FROM seguimientos WHERE id = $seguimiento)
            AND NOT EXISTS (${enCurso})
            AND NOT EXISTS (${reciente})
            AND (${mes}) + $tope <= $mensual
            AND (${dia}) < $diario
        ), gasto AS (
          INSERT INTO gasto_seguimiento (usuario_id, tope_usd) SELECT $usuario, $tope FROM permitido RETURNING id, tope_usd
        ), nueva AS (
          INSERT INTO seguimiento_actualizaciones (seguimiento_id, gasto_id) SELECT $seguimiento, gasto.id FROM gasto
          RETURNING id, seguimiento_id, gasto_id, estado, corridas, reclamada_en, metricas, leidos, nuevos, tono, creado_en, terminado_en
        )
        SELECT nueva.*, gasto.tope_usd FROM nueva JOIN gasto ON gasto.id = nueva.gasto_id`),
    ])) as [unknown, { existe: boolean }[], SqlActualizacion[], { creado_en: string | Date }[], { mes: number; dia: number }[], SqlActualizacion[]];
    if (!existe[0]?.existe) return { ok: false, motivo: "no_existe" };
    if (previa[0] !== undefined) return { ok: true, actualizacion: deActualizacion(previa[0]), enCurso: true };
    if (ultima[0] !== undefined) return { ok: false, motivo: "reciente", fecha: iso(ultima[0].creado_en) };
    if (nueva[0] !== undefined) return { ok: true, actualizacion: deActualizacion(nueva[0]), enCurso: false };
    return { ok: false, motivo: (cuentas[0]?.dia ?? 0) >= topeDiario ? "dia" : "mes" };
  },

  async guardarCorridas(actualizacionId, corridas) {
    await sql().query(`UPDATE seguimiento_actualizaciones SET corridas = $2::jsonb WHERE id = $1`, [actualizacionId, JSON.stringify(corridas)]);
  },

  async reclamar(actualizacionId, ahora) {
    const filas = (await sql().query(`
      UPDATE seguimiento_actualizaciones SET estado = 'guardando', reclamada_en = $2::timestamptz
       WHERE id = $1 AND terminado_en IS NULL
         AND (estado = 'leyendo' OR (estado = 'guardando' AND reclamada_en < $2::timestamptz - make_interval(secs => $3::int)))
      RETURNING id
    `, [actualizacionId, ahora, RECLAMO_VENCE_MS / 1000])) as { id: string }[];
    return filas.length === 1;
  },

  async guardar({ actualizacion: a, publicacion: p, metricas, comentarios, nuevos, tono, usd }) {
    const bd = sql();
    // Una transaccion: o queda la lectura entera —la publicacion, su texto,
    // sus cuentas y su gasto— o no queda nada y otra peticion la retoma.
    await bd.transaction([
      bd.query(`
        UPDATE seguimientos SET
          titulo = COALESCE($2, titulo), creador = COALESCE($3, creador),
          publicado = COALESCE($4::timestamptz, publicado), tipo = COALESCE($5, tipo)
        WHERE id = $1
      `, [a.seguimientoId, p?.titulo || null, p?.creador ?? null, p?.publicado ?? null, p?.tipo ?? null]),
      bd.query(`
        INSERT INTO seguimiento_comentarios AS c (seguimiento_id, huella, texto, likes, escrito_en, sentimiento)
        SELECT $1::uuid, x.huella, x.texto, x.likes, x.escrito, x.sentimiento
          FROM jsonb_to_recordset($2::jsonb) AS x(huella text, texto text, likes int, escrito timestamptz, sentimiento text)
        ON CONFLICT (seguimiento_id, huella) DO UPDATE SET
          texto = EXCLUDED.texto,
          likes = EXCLUDED.likes,
          escrito_en = COALESCE(EXCLUDED.escrito_en, c.escrito_en),
          sentimiento = COALESCE(EXCLUDED.sentimiento, c.sentimiento),
          cosechado_en = now()
      `, [a.seguimientoId, JSON.stringify(comentarios)]),
      bd.query(`
        UPDATE seguimiento_actualizaciones SET
          estado = 'listo', metricas = $2::jsonb, leidos = $3, nuevos = $4, tono = $5::jsonb, terminado_en = now()
        WHERE id = $1
      `, [a.id, metricas === null ? null : JSON.stringify(metricas), comentarios.length, nuevos, tono === null ? null : JSON.stringify(tono)]),
      bd.query(`UPDATE gasto_seguimiento SET usd = $2, terminado_en = now() WHERE id = $1 AND terminado_en IS NULL`, [a.gastoId, usd]),
    ]);
  },

  async fallar(actualizacionId, gastoId, usd) {
    const bd = sql();
    await bd.transaction([
      bd.query(`UPDATE seguimiento_actualizaciones SET estado = 'fallo', terminado_en = now() WHERE id = $1 AND terminado_en IS NULL`, [actualizacionId]),
      bd.query(`UPDATE gasto_seguimiento SET usd = $2, terminado_en = now() WHERE id = $1 AND terminado_en IS NULL`, [gastoId, usd]),
    ]);
  },

  async borrar(id) {
    const bd = sql();
    // El gasto NO se borra: vive en su propia tabla precisamente para que
    // borrar y volver a agregar no libere el tope del mes.
    const [abiertas, borradas] = (await bd.transaction([
      bd.query(`
        SELECT a.id, a.seguimiento_id, a.gasto_id, g.tope_usd, a.estado, a.corridas, a.reclamada_en, a.metricas,
               a.leidos, a.nuevos, a.tono, a.creado_en, a.terminado_en
          FROM seguimiento_actualizaciones a JOIN gasto_seguimiento g ON g.id = a.gasto_id
         WHERE a.seguimiento_id = $1 AND a.terminado_en IS NULL
      `, [id]),
      bd.query(`DELETE FROM seguimientos WHERE id = $1 RETURNING id`, [id]),
    ])) as [SqlActualizacion[], { id: string }[]];
    if (borradas.length === 0) return null;
    return { abiertas: abiertas.map(deActualizacion) };
  },

  async cerrarGasto(gastoId, usd) {
    await sql().query(`UPDATE gasto_seguimiento SET usd = $2, terminado_en = now() WHERE id = $1 AND terminado_en IS NULL`, [gastoId, usd]);
  },

  async purgar(retencionDias) {
    const filas = (await sql().query(
      `DELETE FROM seguimiento_comentarios WHERE cosechado_en < now() - make_interval(days => $1::int) RETURNING 1`,
      [retencionDias],
    )) as unknown[];
    return filas.length;
  },
};
