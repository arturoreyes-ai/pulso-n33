-- Usuarios del tablero. Fue la UNICA tabla de la base hasta el 23 de
-- septiembre de 2026, cuando llego 0002_busquedas_redes.sql, el libro de
-- gasto de la busqueda pagada en redes. Ninguna de las dos guarda dato del
-- producto: esos viven en data/*.json y su historial es git (AGENTS.md). Se
-- aplica con `pnpm migrar` (scripts/migrar.mjs) o pegandolo en el editor SQL
-- de Neon.
--
-- Cada archivo de db/ tiene que ser idempotente (IF NOT EXISTS, ADD COLUMN IF
-- NOT EXISTS): el runner los ejecuta todos, en orden, en cada corrida. Con
-- una tabla, una bitacora de migraciones seria mas mecanismo que esquema.

CREATE TABLE IF NOT EXISTS usuarios (
  id               serial PRIMARY KEY,
  -- `oid` de Entra: la identidad estable. El correo puede cambiar (Entra
  -- permite renombrar el UPN); el oid no, y por el se reconoce a la persona.
  entra_oid        varchar(64) UNIQUE,
  -- Siempre en minusculas; lo normaliza el servidor antes de escribir, y por
  -- eso puede ser UNIQUE sin un indice sobre lower().
  correo           varchar(320) NOT NULL UNIQUE,
  nombre           varchar(200) NOT NULL,
  rol              varchar(20) NOT NULL DEFAULT 'lector',
  -- false = de baja: no puede volver a entrar (auth.ts) y la API responde 403.
  activo           boolean NOT NULL DEFAULT true,
  creado_en        timestamptz NOT NULL DEFAULT now(),
  ultimo_acceso_en timestamptz,
  -- CHECK y no un tipo enum: agregar un rol es ampliar esta lista en una
  -- migracion (DROP CONSTRAINT + ADD CONSTRAINT), no un ALTER TYPE que no se
  -- puede deshacer dentro de una transaccion. La lista es espejo de ROLES en
  -- web/src/lib/acceso/roles.ts.
  CONSTRAINT usuarios_rol_check CHECK (rol IN ('lector', 'admin'))
);
