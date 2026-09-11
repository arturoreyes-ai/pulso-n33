// Aplica db/*.sql, en orden, contra DATABASE_URL. Se corre una vez al crear la
// base y cada vez que se agrega un archivo:
//
//   pnpm migrar
//
// Lee .env.local si existe (--env-file-if-exists en package.json), asi que en
// local basta con la misma variable que usa `next dev`. Contra produccion se
// pasa a mano: DATABASE_URL="postgresql://..." pnpm migrar
//
// No hay bitacora de migraciones aplicadas a proposito: cada archivo tiene que
// ser idempotente (IF NOT EXISTS) y se ejecuta entero en cada corrida. Con una
// tabla es suficiente, y el dia que deje de serlo, ese dia se agrega la
// bitacora, no antes.
//
// El driver HTTP de Neon ejecuta UNA sentencia por peticion, de ahi el corte
// por punto y coma. Es un corte ingenuo (no entiende $$ ni cadenas con `;`),
// y basta mientras db/ sea DDL plano; una funcion en PL/pgSQL lo romperia.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { neon } from "@neondatabase/serverless";

// El mismo par que lee src/lib/acceso/bd.ts: la integracion de Vercel exporta
// la cadena como NEON_DB_DATABASE_URL, no como DATABASE_URL.
const url = process.env.DATABASE_URL || process.env.NEON_DB_DATABASE_URL;
if (!url) {
  console.error("Ni DATABASE_URL ni NEON_DB_DATABASE_URL están definidas. Ver docs/acceso.md.");
  process.exit(1);
}

const carpeta = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db");
const archivos = (await readdir(carpeta)).filter((a) => a.endsWith(".sql")).sort();
if (archivos.length === 0) {
  console.error(`No hay archivos .sql en ${carpeta}`);
  process.exit(1);
}

const sql = neon(url);

for (const archivo of archivos) {
  const texto = await readFile(path.join(carpeta, archivo), "utf8");
  const sentencias = texto
    .split("\n")
    .filter((linea) => !linea.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const sentencia of sentencias) {
    await sql.query(sentencia);
  }
  console.log(`${archivo}: ${sentencias.length} sentencia(s) aplicada(s)`);
}
