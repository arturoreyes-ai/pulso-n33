import { createHmac } from "node:crypto";

import { sql } from "@/lib/acceso/bd";
import { fold } from "./limpiar";

/**
 * El libro de gasto de la busqueda pagada (web/db/0002_busquedas_redes.sql).
 * Solo servidor.
 *
 * Tres trabajos que una funcion sin estado no puede hacer sola:
 *
 *  - Sostener los topes. `reservar` cuenta el mes y el dia y escribe la fila
 *    en UNA transaccion con un candado de asesoria: dos botones pulsados a la
 *    vez no pueden ver los dos el mes vacio y pasar los dos.
 *  - Que solo una peticion arranque la segunda pasada. `reclamar` es un
 *    UPDATE condicionado a la fase: el que lo gana arranca los comentarios de
 *    esa red; el otro ve cero filas y no paga dos veces.
 *  - Reusar. El mismo termino dentro de seis horas devuelve la misma fila y
 *    sus corridas, que Apify conserva; no cuesta ni cuenta en el tope diario.
 *
 * Detras de una interfaz para que scripts/probar-redes-en-vivo.cjs pruebe
 * los topes y la carrera sin base de datos.
 */

export type Red = "tiktok" | "instagram" | "facebook";
export const REDES_PAGADAS: readonly Red[] = ["tiktok", "instagram", "facebook"];

export type Fase = "publicaciones" | "comentarios" | "listo" | "fallo";

export interface Pasada {
  id: string;
  dataset: string;
  /** Lo que cobro, cuando termino. */
  usd: number | null;
}

export interface CorridaRed {
  fase: Fase;
  posts: Pasada | null;
  comentarios: Pasada | null;
  /** Las publicaciones cuyos comentarios se pidieron: las que nombran el
   *  termino, las diez de mas alcance. */
  urls: string[];
  /** Cuando se gano la segunda pasada, para soltarla si la peticion murio. */
  reclamada: string | null;
}

export type Corridas = Partial<Record<Red, CorridaRed>>;

export interface FilaBusqueda {
  id: string;
  /** El HMAC del termino. Quien pregunta por una busqueda manda el termino y
   *  se compara aqui: el id solo no basta para leerla. */
  clave: string;
  estado: "buscando" | "listo" | "fallo";
  corridas: Corridas;
  creado: string;
}

export type Reserva = { ok: true; fila: FilaBusqueda; reusada: boolean } | { ok: false; motivo: "mes" | "dia" };

export interface Libro {
  /** La fila del mismo termino dentro de `horas`, o la reserva de una nueva
   *  si caben el tope del mes y el del dia. */
  reservar(args: { clave: string; usuarioId: number; topeUsd: number; topeMensual: number; topeDiario: number; horas: number; zona: string }): Promise<Reserva>;
  leer(id: string): Promise<FilaBusqueda | null>;
  /** Escribe una red entera. */
  guardarRed(id: string, red: Red, corrida: CorridaRed): Promise<void>;
  /** Pasa una red de `publicaciones` a `comentarios` si nadie lo hizo antes.
   *  true: esta peticion la gano y arranca la segunda pasada. */
  reclamar(id: string, red: Red, ahora: string): Promise<boolean>;
  cerrar(id: string, estado: "listo" | "fallo", usd: number): Promise<void>;
}

/**
 * La clave de un termino: HMAC-SHA256 del termino plegado con AUTH_SECRET.
 * Plegado, para que «Vive la Baja» y «vive la baja» reusen la misma busqueda;
 * con secreto, para que la tabla sola no diga a quien se busco (un sha256
 * desnudo de un nombre propio se revierte probando nombres).
 */
export function claveDe(termino: string, secreto: string): string {
  return createHmac("sha256", secreto).update(`v1|${fold(termino)}`).digest("hex");
}

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const esIdBusqueda = (s: string | null): s is string => s !== null && ID.test(s);

interface FilaSql {
  id: string;
  clave: string;
  estado: FilaBusqueda["estado"];
  corridas: Corridas;
  creado_en: string | Date;
}

const deSql = (f: FilaSql): FilaBusqueda => ({
  id: f.id,
  clave: f.clave.trim(),
  estado: f.estado,
  corridas: f.corridas ?? {},
  creado: f.creado_en instanceof Date ? f.creado_en.toISOString() : String(f.creado_en),
});

/** Un numero cualquiera y fijo para el candado de asesoria de las reservas. */
const CANDADO = 23092026;

export const libroNeon: Libro = {
  async reservar({ clave, usuarioId, topeUsd, topeMensual, topeDiario, horas, zona }) {
    const bd = sql();
    // Todo dentro del candado, la busqueda previa incluida: dos personas que
    // buscan lo mismo al mismo tiempo tienen que reusar UNA corrida, no pagar
    // dos. El INSERT se condiciona a que no haya previa y a los dos topes.
    // Mientras una busqueda no termina, el mes cuenta su reserva y no lo que
    // lleva gastado: es el peor caso, y es el que el tope tiene que cubrir.
    const [, previa, cuentas, nueva] = (await bd.transaction([
      bd`SELECT pg_advisory_xact_lock(${CANDADO})`,
      bd`
        SELECT id, clave, estado, corridas, creado_en FROM busquedas_redes
        WHERE clave = ${clave} AND estado <> 'fallo' AND creado_en > now() - make_interval(hours => ${horas}::int)
        ORDER BY creado_en DESC LIMIT 1
      `,
      bd`
        SELECT
          COALESCE(SUM(CASE WHEN terminado_en IS NULL THEN tope_usd ELSE usd END), 0)::float8 AS mes,
          COUNT(*) FILTER (WHERE usuario_id = ${usuarioId}
            AND (creado_en AT TIME ZONE ${zona}) >= date_trunc('day', now() AT TIME ZONE ${zona}))::int AS dia
        FROM busquedas_redes
        WHERE (creado_en AT TIME ZONE ${zona}) >= date_trunc('month', now() AT TIME ZONE ${zona})
      `,
      bd`
        INSERT INTO busquedas_redes (clave, usuario_id, tope_usd)
        SELECT ${clave}, ${usuarioId}, ${topeUsd}
        WHERE NOT EXISTS (
          SELECT 1 FROM busquedas_redes
          WHERE clave = ${clave} AND estado <> 'fallo' AND creado_en > now() - make_interval(hours => ${horas}::int)
        )
        AND (
          SELECT COALESCE(SUM(CASE WHEN terminado_en IS NULL THEN tope_usd ELSE usd END), 0)
          FROM busquedas_redes
          WHERE (creado_en AT TIME ZONE ${zona}) >= date_trunc('month', now() AT TIME ZONE ${zona})
        ) + ${topeUsd} <= ${topeMensual}
        AND (
          SELECT COUNT(*) FROM busquedas_redes
          WHERE usuario_id = ${usuarioId}
            AND (creado_en AT TIME ZONE ${zona}) >= date_trunc('day', now() AT TIME ZONE ${zona})
        ) < ${topeDiario}
        RETURNING id, clave, estado, corridas, creado_en
      `,
    ])) as [unknown, FilaSql[], { mes: number; dia: number }[], FilaSql[]];
    if (previa[0] !== undefined) return { ok: true, fila: deSql(previa[0]), reusada: true };
    if (nueva[0] !== undefined) return { ok: true, fila: deSql(nueva[0]), reusada: false };
    return { ok: false, motivo: (cuentas[0]?.dia ?? 0) >= topeDiario ? "dia" : "mes" };
  },

  async leer(id) {
    const filas = (await sql()`SELECT id, clave, estado, corridas, creado_en FROM busquedas_redes WHERE id = ${id}`) as FilaSql[];
    return filas[0] === undefined ? null : deSql(filas[0]);
  },

  async guardarRed(id, red, corrida) {
    await sql()`
      UPDATE busquedas_redes SET corridas = jsonb_set(corridas, ARRAY[${red}]::text[], ${JSON.stringify(corrida)}::jsonb, true)
      WHERE id = ${id}
    `;
  },

  async reclamar(id, red, ahora) {
    const filas = (await sql()`
      UPDATE busquedas_redes
      SET corridas = jsonb_set(
        jsonb_set(corridas, ARRAY[${red}, 'fase']::text[], '"comentarios"'::jsonb),
        ARRAY[${red}, 'reclamada']::text[], to_jsonb(${ahora}::text))
      WHERE id = ${id} AND corridas -> ${red} ->> 'fase' = 'publicaciones'
      RETURNING id
    `) as { id: string }[];
    return filas.length === 1;
  },

  async cerrar(id, estado, usd) {
    await sql()`
      UPDATE busquedas_redes SET estado = ${estado}, usd = ${usd}, terminado_en = now()
      WHERE id = ${id} AND terminado_en IS NULL
    `;
  },
};
