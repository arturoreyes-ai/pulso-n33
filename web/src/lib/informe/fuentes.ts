import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Las fuentes del informe, leidas del disco una vez.
 *
 * Takumi no lee las fuentes del sistema y, por omision, un glifo que ninguna
 * fuente registrada cubre HACE FALLAR el render entero. Asi que se registra
 * Geist —la del tablero— desde el paquete `geist` que ya esta instalado, en
 * sus cuatro pesos, y el render se pide con `uncoveredText: "blank"`: un
 * comentario con un emoji deja un hueco en vez de tumbar el informe.
 *
 * NUNCA `googleFonts()` de @takumi-rs/helpers: seria una peticion de red en
 * cada render, desde el servidor, a un tercero, para una fuente que ya
 * tenemos en node_modules.
 *
 * Los archivos viajan a la funcion de produccion por
 * `outputFileTracingIncludes` en next.config.ts, como los JSON que la ruta
 * lee del disco. Sin eso el render falla solo en produccion.
 */

const CARPETA = join(process.cwd(), "node_modules", "geist", "dist", "fonts", "geist-sans");

const PESOS: readonly [string, number][] = [
  ["Geist-Regular.woff2", 400],
  ["Geist-Medium.woff2", 500],
  ["Geist-SemiBold.woff2", 600],
  ["Geist-Bold.woff2", 700],
];

export interface FuenteInforme {
  name: string;
  data: Uint8Array;
  weight: number;
}

let promesa: Promise<FuenteInforme[]> | null = null;

/** Las cuatro caras de Geist. Memoizada: el disco se lee una vez por proceso. */
export function cargarFuentesInforme(): Promise<FuenteInforme[]> {
  promesa ??= Promise.all(PESOS.map(async ([archivo, weight]) => ({
    name: "Geist",
    data: new Uint8Array(await readFile(join(CARPETA, archivo))),
    weight,
  })));
  return promesa;
}
