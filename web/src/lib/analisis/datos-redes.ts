import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { ComentarioPublicado, Destacado, DocRedes, DocRedesComentarios } from "@/lib/datos/tipos";
import { canonizarPublicacion, fuenteDePublicacion, nombresDeCuentas, seleccionarPublicaciones, type CubetaRegion } from "@/lib/dominio/publicaciones";
import type { RedAnalizable } from "./contrato-publicacion";

/**
 * Donde /api/analizar-publicacion encuentra la publicacion que le piden.
 *
 * ESTO ES LA FRONTERA LEGAL DEL MODULO, no una utilidad de lectura. La regla
 * de AGENTS.md es que no se abre tiktok.com ni instagram.com, y la forma de
 * hacerla cumplir no es prometerlo: es que la URL que manda el cliente sea una
 * LLAVE DE BUSQUEDA y jamas un destino. Se busca por igualdad en lo que el
 * sitio ya publica; si no esta, no hay ficha. De ahi salen dos propiedades:
 *
 *  - No hay superficie de SSRF, y por eso aqui no aparece `urlSegura` —que es
 *    la primera pregunta de quien revise esto—. No se pide ninguna URL del
 *    cliente, ni la suya ni otra.
 *  - Nadie con sesion puede usar la ruta como un proxy gratuito a Claude
 *    mandandole texto propio. El texto de los comentarios lo busca el
 *    servidor; el cliente solo dice cual.
 *
 * SE LEE DEL DISCO Y NO POR HTTP, que es el diseno obvio y el equivocado:
 *
 *  1. `proxy.ts` exige sesion tambien para `/data/`, a proposito y con el
 *     motivo escrito ahi. Una peticion del servidor a su propio sitio no lleva
 *     cookie, asi que recibiria 401 SIEMPRE, en produccion y nunca en la
 *     prueba offline, que es la peor forma de fallar.
 *  2. El origen saldria de la cabecera `Host`, que la pone quien llama. La
 *     afirmacion que sostiene esta funcion —«el modelo solo ve lo que nuestro
 *     sitio publica»— se convertiria en «el modelo ve lo que diga el host que
 *     nombre el cliente».
 *
 * El precio, y queda escrito porque es una excepcion real: `datos/config.ts`
 * dice que mover los datos a otro host es una variable y un redespliegue. Eso
 * sigue siendo cierto para TODOS los lectores menos este. Si algun dia
 * `NEXT_PUBLIC_DATOS_URL` apunta afuera, esta lectura hay que mudarla a HTTP y
 * este parrafo es el aviso.
 *
 * Y una consecuencia que falla en silencio: los cuatro archivos tienen que
 * estar en `outputFileTracingIncludes` de `next.config.ts` o no viajan al
 * bundle de la funcion. Sin eso todo funciona en `next dev` y devuelve
 * `codigo: "datos"` en produccion, sin ninguna prueba que lo atrape.
 */

// Importacion con nombre y no `import path from`: probar-analisis.cjs
// transpila sin `esModuleInterop` y un default de un modulo de Node sale
// undefined ahi.
const CARPETA = join(process.cwd(), "public", "data");

/** Un archivo publicado bajo /data, ya parseado, o `null` si no esta. */
export type LeerDatos = (nombre: string) => Promise<unknown | null>;

export const leerDatoPublicado: LeerDatos = async (nombre) => {
  try {
    // Un ENOENT y un JSON roto son el MISMO estado para quien llama: no hay
    // dato. Distinguirlos solo daria dos mensajes que dicen lo mismo.
    return JSON.parse(await readFile(join(CARPETA, nombre), "utf8")) as unknown;
  } catch {
    return null;
  }
};

const ARCHIVOS: Record<RedAnalizable, { datos: string; textos: string }> = {
  instagram: { datos: "redes.json", textos: "redes-comentarios.json" },
  tiktok: { datos: "tiktok.json", textos: "tiktok-comentarios.json" },
};

export interface Hallado {
  post: Destacado;
  /** Vacia cuando el archivo de texto no esta o no trae este post. Las dos
   *  cosas se dicen igual en pantalla, asi que no se distinguen aqui. */
  comentarios: ComentarioPublicado[];
  fuente: string;
}

/**
 * La publicacion y su texto, o por que no hay ficha.
 *
 * OJO CON LAS DOS FORMAS DE LA URL, que es el error que este codigo existe
 * para no cometer: `por_post` esta indexado por el `url` CRUDO del registro,
 * mientras que la tarjeta —y por tanto el cliente— manda el canonico de
 * `canonizarPublicacion`. Se busca el registro comparando canonicos y se leen
 * los comentarios con `post.url`. Es exactamente lo que ya hace
 * visor-redes.tsx (`por_post[fila.post.url]` con `fila.url` canonico al lado).
 */
export async function ubicarPublicacion(
  red: RedAnalizable,
  urlCanonica: string,
  leer: LeerDatos,
): Promise<Hallado | "sin-datos" | "sin-publicacion"> {
  const crudo = await leer(ARCHIVOS[red].datos);
  if (crudo === null || typeof crudo !== "object") return "sin-datos";
  const datos = crudo as DocRedes;
  const destacados = datos.destacados ?? [];
  const post = destacados.find((d) => canonizarPublicacion(d.url, red) === urlCanonica);
  if (post === undefined) return "sin-publicacion";

  const textos = await leer(ARCHIVOS[red].textos);
  const porPost = textos !== null && typeof textos === "object"
    ? (textos as DocRedesComentarios).por_post
    : undefined;

  return {
    post,
    comentarios: porPost?.[post.url] ?? [],
    fuente: fuenteDePublicacion(post, red, nombresDeCuentas(datos)),
  };
}

export interface Conversacion {
  /** Una entrada por publicacion con texto, en el orden en que se leen. */
  bloques: { red: RedAnalizable; titulo: string; comentarios: string[] }[];
  /** Publicaciones de la seleccion, tengan texto o no. */
  publicaciones: number;
  leidos: number;
  /** Lo que las plataformas reportan en esas mismas publicaciones. */
  reportados: number;
}

/**
 * Los comentarios de TODA la seleccion que el lector tiene delante.
 *
 * Misma seleccion que pinta el visor —`seleccionarPublicaciones`, con su tope
 * por documento— para que «de que se habla» hable exactamente de lo que se
 * puede desplazar en pantalla y no de un conjunto distinto que nadie ve. Si
 * divergieran, la lectura afirmaria cosas sobre publicaciones que el lector no
 * tiene manera de comprobar.
 */
export async function reunirConversacion(
  zona: string | null,
  cubeta: CubetaRegion,
  leer: LeerDatos,
): Promise<Conversacion | "sin-datos"> {
  const salida: Conversacion = { bloques: [], publicaciones: 0, leidos: 0, reportados: 0 };
  const lecturas = await Promise.all((["instagram", "tiktok"] as const).map(async (red) => {
    const crudo = await leer(ARCHIVOS[red].datos);
    if (crudo === null || typeof crudo !== "object") return { red, datos: null, porPost: undefined };
    const datos = crudo as DocRedes;
    const textos = await leer(ARCHIVOS[red].textos);
    const porPost = textos !== null && typeof textos === "object"
      ? (textos as DocRedesComentarios).por_post
      : undefined;
    return { red, datos, porPost };
  }));

  for (const { red, datos, porPost } of lecturas) {
    if (datos === null) continue;
    for (const post of seleccionarPublicaciones(datos, zona, red, cubeta)) {
      salida.publicaciones += 1;
      salida.reportados += post.comentarios;
      const comentarios = (porPost?.[post.url] ?? []).map((c) => c.texto);
      if (comentarios.length === 0) continue;
      salida.leidos += comentarios.length;
      salida.bloques.push({ red, titulo: post.titulo, comentarios });
    }
  }
  return lecturas.some(({ datos }) => datos !== null) ? salida : "sin-datos";
}
