import { leerDatoPublicado } from "@/lib/datos/publicado";
import type { DocNotas, Nota } from "@/lib/datos/tipos";
import { indiceDeEnlaces, enlaceParaAnalisis } from "./enlaces";
import { indiceDeImagenes, imagenPara } from "./imagenes";
import { indiceDeRelacionadas, type IndiceRelacionadas } from "./relacionadas";
import type { ResultadoExterno } from "./tipos";

/**
 * Lo que el archivo publicado sabe de una fila en vivo, resuelto EN EL
 * SERVIDOR.
 *
 * EL CASO, medido el 18 de septiembre de 2026: la portada preestrenaba
 * `notas.json` y el recorrido lo bajaba entero —4.8 MB, 917 KB comprimido,
 * 6,020 notas— para responder tres preguntas sobre quince filas. Era el 93% de
 * lo que el historial de datos pesa y ~95% de lo que el navegador descarga del
 * tablero, para un cruce que la mayoria de las tarjetas ni siquiera gana: el
 * sondeo de imagen-viva.ts ya habia medido que de 503 notas llegadas por
 * busqueda, CERO recuperan miniatura por titular plegado.
 *
 * Las tres funciones que hacen el cruce —imagenes.ts, enlaces.ts y
 * relacionadas.ts— siguen siendo puras y no cambiaron ni una linea. Lo unico
 * que cambio es quien las llama: antes el navegador con el corpus en la mano,
 * ahora el servidor que ya tiene el disco al lado. El corpus no viaja.
 *
 * SE MEMOIZA EN AMBITO DE MODULO, no por peticion: armar el indice de
 * relacionadas cuesta 56 ms y la cadena de capitulos llama a /api/actualidad
 * hasta nueve veces por lector. En produccion `public/data/notas.json` solo
 * cambia con un despliegue, y un despliegue es otro proceso, asi que no hay
 * invalidacion que escribir. En `next dev` si puede quedarse vieja despues de
 * que sincronizar-datos.mjs vuelva a copiar: reinicia el servidor.
 *
 * LA LECTURA SE INYECTA para que scripts/probar-busqueda.cjs pruebe el cruce
 * sin disco, igual que `solicitar` en actualidad.ts.
 */

export interface IndicesArchivo {
  readonly imagenes: ReadonlyMap<string, string>;
  readonly enlaces: ReadonlyMap<string, string>;
  readonly relacionadas: IndiceRelacionadas;
}

/**
 * `null` es «no se pudo mirar el archivo», que NO es «no hay nada». La
 * diferencia llega hasta la pantalla: rellenar con vacio afirmaria un hueco de
 * cobertura que nadie midio, y eso es la regla 4 de PRODUCT.md al reves.
 */
export type LeerArchivo = () => Promise<IndicesArchivo | null>;

export function construirIndices(notas: readonly Nota[]): IndicesArchivo {
  return {
    imagenes: indiceDeImagenes(notas),
    enlaces: indiceDeEnlaces(notas),
    relacionadas: indiceDeRelacionadas(notas),
  };
}

let memoria: Promise<IndicesArchivo | null> | null = null;

async function desdeDisco(): Promise<IndicesArchivo | null> {
  const doc = (await leerDatoPublicado("notas.json")) as DocNotas | null;
  // Un archivo que no esta y uno ilegible son el mismo estado; los distingue
  // `outputFileTracingIncludes` de next.config.ts, no quien llama.
  if (doc === null || !Array.isArray(doc.notas)) return null;
  return construirIndices(doc.notas);
}

export const archivoPublicado: LeerArchivo = () => {
  // Se memoiza la PROMESA, no el resultado: dos peticiones que llegan juntas a
  // un proceso frio comparten una sola lectura y un solo armado.
  memoria ??= desdeDisco();
  return memoria;
};

/**
 * La miniatura y el enlace del propio medio de una fila, o null cada uno.
 *
 * Nunca inventa: sin empate en el archivo la miniatura es `null` y la tarjeta
 * se queda con su placa, que es un estado valido. El empate de `enlaces.ts` es
 * por titular plegado Y dominio, y eso no se relaja aqui — con el titular solo
 * se elegiria la copia sindicada de otro medio y se le atribuiria a este.
 */
export function atarAlArchivo(
  r: ResultadoExterno,
  indices: IndicesArchivo | null,
): ResultadoExterno {
  if (indices === null) return r;
  return {
    ...r,
    imagen: imagenPara(r, indices.imagenes),
    referencia: enlaceParaAnalisis(r, indices.enlaces),
  };
}

export const atarTodas = (
  filas: readonly ResultadoExterno[],
  indices: IndicesArchivo | null,
): ResultadoExterno[] => filas.map((r) => atarAlArchivo(r, indices));
