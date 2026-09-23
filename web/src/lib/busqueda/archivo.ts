import { leerDatoPublicado } from "@/lib/datos/publicado";
import type { DocNotas, Etiqueta, Nota } from "@/lib/datos/tipos";
import { plegar } from "@/lib/dominio/formato";
import type { ZonaRuta } from "@/lib/dominio/zonas";
import type { CatalogoBusqueda } from "./catalogo";
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
  /** Cada nota con su titular ya plegado, para `delArchivo`. Plegar 6,000
   *  titulares en cada busqueda costaria mas que la busqueda. */
  readonly titulares: readonly { plegado: string; nota: Nota }[];
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
    titulares: notas.map((nota) => ({ plegado: plegar(nota.titulo), nota })),
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

/** Una nota del archivo que nombra el termino, con su tono de pipeline. El
 *  tono NO viaja en `ResultadoExterno`: lo lee solo la ficha de Redes, y solo
 *  cuando el termino no es una figura del roster (regla 5). */
export interface CoincidenciaArchivo {
  fila: ResultadoExterno;
  tono: Etiqueta | null;
}

/**
 * Las notas del archivo cuyo titular nombra el termino, mas reciente primero.
 *
 * Existe porque la lupa solo le preguntaba a Google, y el archivo tiene quince
 * feeds propios que Google no siempre indexa: una nota de Zeta que ya estaba
 * en notas.json no salia al buscarla. `nombre` y `idioma` salen del catalogo
 * por el id de la fuente; una nota llegada por busqueda (`gn-…`) no tiene
 * fila y se rotula con su dominio, como la fila de Google que la trajo. Con
 * zona, solo las notas que HABLAN de esa zona (`zonas`), no las de un medio
 * de ahi: es la misma distincion que el muro hacia entre `zona_medio` y
 * `zonas`.
 */
export function delArchivo(
  indices: IndicesArchivo | null,
  termino: string,
  catalogo: CatalogoBusqueda | null,
  opciones: { zona: ZonaRuta | null; desde: string; tope: number },
): CoincidenciaArchivo[] {
  if (indices === null) return [];
  const aguja = plegar(termino);
  if (aguja === "") return [];
  const porId = new Map((catalogo?.medios ?? []).map((m) => [m.id, m]));
  const salida: CoincidenciaArchivo[] = [];
  for (const { plegado, nota } of indices.titulares) {
    if (!plegado.includes(aguja)) continue;
    if (opciones.zona !== null && !nota.zonas.includes(opciones.zona)) continue;
    const fecha = nota.fecha ?? nota.publicado?.slice(0, 10) ?? null;
    if (fecha === null || fecha < opciones.desde) continue;
    const medio = porId.get(nota.fuente);
    salida.push({
      fila: {
        titulo: nota.titulo,
        url: nota.url,
        dominio: nota.dominio,
        medio: medio?.nombre ?? nota.dominio,
        publicado: nota.publicado ?? nota.fecha,
        idioma: medio?.idioma ?? "es",
        imagen: nota.imagen ?? null,
        referencia: null,
        origen: "archivo",
      },
      tono: nota.postura?.etiqueta ?? null,
    });
  }
  salida.sort((a, b) => (b.fila.publicado ?? "").localeCompare(a.fila.publicado ?? "") || a.fila.url.localeCompare(b.fila.url));
  return salida.slice(0, opciones.tope);
}
