import { sql } from "./bd";
import { acceso } from "./config";
import { ErrorApi } from "./http";
import { ROL_POR_OMISION, esRol, type Rol } from "./roles";

/**
 * La tabla `usuarios`, en SQL plano. Sin ORM: son cuatro consultas sobre una
 * tabla, y un ORM aqui seria mas codigo que el que ahorra. El DDL vive en
 * web/db/0001_usuarios.sql y se aplica con `pnpm migrar`.
 *
 * Cada fila se convierte con `aUsuario`, que valida tipo por tipo en vez de
 * confiar en un generico: el driver devuelve `Record<string, unknown>` y un
 * `as Usuario` escondia la primera columna renombrada hasta produccion.
 */
export interface Usuario {
  id: number;
  entraOid: string | null;
  correo: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  creadoEn: string;
  ultimoAccesoEn: string | null;
}

export interface Identidad {
  /** Ya en minusculas y sin espacios; lo garantiza quien la construye. */
  correo: string;
  nombre: string;
  /** `oid` de Entra. Null solo en el modo sin Entra de desarrollo. */
  entraOid: string | null;
}

function texto(fila: Record<string, unknown>, columna: string): string {
  const v = fila[columna];
  if (typeof v !== "string") throw new Error(`usuarios.${columna}: se esperaba texto`);
  return v;
}

function textoOpcional(fila: Record<string, unknown>, columna: string): string | null {
  const v = fila[columna];
  if (v === null || v === undefined) return null;
  return typeof v === "string" ? v : String(v);
}

function fecha(fila: Record<string, unknown>, columna: string): string | null {
  const v = fila[columna];
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new Error(`usuarios.${columna}: fecha ilegible`);
  return d.toISOString();
}

function aUsuario(fila: Record<string, unknown>): Usuario {
  const id = Number(fila.id);
  if (!Number.isInteger(id)) throw new Error("usuarios.id: se esperaba un entero");
  const rol = fila.rol;
  if (!esRol(rol)) throw new Error(`usuarios.rol: valor fuera del CHECK (${String(rol)})`);
  const creadoEn = fecha(fila, "creado_en");
  if (creadoEn === null) throw new Error("usuarios.creado_en: no puede ser nulo");
  return {
    id,
    entraOid: textoOpcional(fila, "entra_oid"),
    correo: texto(fila, "correo"),
    nombre: texto(fila, "nombre"),
    rol,
    activo: fila.activo === true,
    creadoEn,
    ultimoAccesoEn: fecha(fila, "ultimo_acceso_en"),
  };
}

export async function buscarUsuarioPorCorreo(correo: string): Promise<Usuario | null> {
  const filas = await sql()`
    SELECT id, entra_oid, correo, nombre, rol, activo, creado_en, ultimo_acceso_en
    FROM usuarios WHERE correo = ${correo}`;
  const fila = filas[0];
  return fila ? aUsuario(fila) : null;
}

export async function buscarUsuarioPorId(id: number): Promise<Usuario | null> {
  const filas = await sql()`
    SELECT id, entra_oid, correo, nombre, rol, activo, creado_en, ultimo_acceso_en
    FROM usuarios WHERE id = ${id}`;
  const fila = filas[0];
  return fila ? aUsuario(fila) : null;
}

/**
 * Alta o refresco al entrar. Es lo que corre `callbacks.signIn` en auth.ts,
 * una vez por inicio de sesion, y lo que `usuarioActual` usa de red de
 * seguridad si la fila desaparecio con la sesion viva.
 *
 * Dos pasos y no uno, por el `oid`:
 *
 *  1. Si ya hay una fila con este `oid`, es la misma persona aunque el correo
 *     haya cambiado (Entra permite renombrar el UPN). Se actualiza esa fila,
 *     correo incluido. Para eso existe la columna.
 *  2. Si no, INSERT ... ON CONFLICT (correo) DO UPDATE. El upsert no es
 *     opcional: dos pestanas que entran a la vez son dos primeras peticiones
 *     concurrentes, y sin el conflicto ambas insertan y una revienta.
 *
 * El rol solo se fija al insertar (`lector`, o `admin` para
 * ACCESO_PRIMER_ADMIN) y se respeta despues... salvo para ese correo, que
 * vuelve a admin y activo en cada entrada: es la puerta de emergencia
 * documentada en roles.ts.
 */
export async function registrarAcceso(identidad: Identidad): Promise<Usuario> {
  const esPrimerAdmin = acceso.primerAdmin !== "" && identidad.correo === acceso.primerAdmin;
  const rolInicial: Rol = esPrimerAdmin ? "admin" : ROL_POR_OMISION;
  const bd = sql();

  if (identidad.entraOid) {
    const porOid = await bd`
      UPDATE usuarios SET
        correo = ${identidad.correo},
        nombre = ${identidad.nombre},
        rol = CASE WHEN ${esPrimerAdmin} THEN 'admin' ELSE rol END,
        activo = CASE WHEN ${esPrimerAdmin} THEN true ELSE activo END,
        ultimo_acceso_en = now()
      WHERE entra_oid = ${identidad.entraOid}
      RETURNING id, entra_oid, correo, nombre, rol, activo, creado_en, ultimo_acceso_en`;
    const fila = porOid[0];
    if (fila) return aUsuario(fila);
  }

  const filas = await bd`
    INSERT INTO usuarios (correo, nombre, entra_oid, rol, activo, ultimo_acceso_en)
    VALUES (${identidad.correo}, ${identidad.nombre}, ${identidad.entraOid}, ${rolInicial}, true, now())
    ON CONFLICT (correo) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      entra_oid = COALESCE(EXCLUDED.entra_oid, usuarios.entra_oid),
      rol = CASE WHEN ${esPrimerAdmin} THEN 'admin' ELSE usuarios.rol END,
      activo = CASE WHEN ${esPrimerAdmin} THEN true ELSE usuarios.activo END,
      ultimo_acceso_en = now()
    RETURNING id, entra_oid, correo, nombre, rol, activo, creado_en, ultimo_acceso_en`;
  const fila = filas[0];
  if (!fila) throw new Error("usuarios: el upsert no devolvió fila");
  return aUsuario(fila);
}

export async function listarUsuarios(): Promise<Usuario[]> {
  const filas = await sql()`
    SELECT id, entra_oid, correo, nombre, rol, activo, creado_en, ultimo_acceso_en
    FROM usuarios ORDER BY (rol = 'admin') DESC, correo ASC`;
  return filas.map(aUsuario);
}

export interface CambioUsuario {
  rol?: Rol;
  activo?: boolean;
}

export async function actualizarUsuario(id: number, cambio: CambioUsuario): Promise<Usuario> {
  const filas = await sql()`
    UPDATE usuarios SET
      rol = COALESCE(${cambio.rol ?? null}, rol),
      activo = COALESCE(${cambio.activo ?? null}, activo)
    WHERE id = ${id}
    RETURNING id, entra_oid, correo, nombre, rol, activo, creado_en, ultimo_acceso_en`;
  const fila = filas[0];
  if (!fila) throw new ErrorApi(404, "Usuario no encontrado");
  return aUsuario(fila);
}
