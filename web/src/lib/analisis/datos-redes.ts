import { leerDatoPublicado, type LeerDatos } from "@/lib/datos/publicado";
import type { ComentarioPublicado, Destacado, DocRedes, DocRedesComentarios } from "@/lib/datos/tipos";
import { canonizarPublicacion, fuenteDePublicacion, nombresDeCuentas } from "@/lib/dominio/publicaciones";
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
 * SE LEE DEL DISCO Y NO POR HTTP. El porque —`proxy.ts` daria 401 a una
 * peticion del servidor a su propio sitio, y el origen saldria de la cabecera
 * `Host` que pone quien llama— esta en lib/datos/publicado.ts, que es de donde
 * sale el lector desde que /api/actualidad necesito lo mismo. Aqui importa una
 * consecuencia que es de este modulo y no de aquel: la afirmacion que sostiene
 * esta funcion es «el modelo solo ve lo que nuestro sitio publica», y por HTTP
 * se convertiria en «el modelo ve lo que diga el host que nombre el cliente».
 *
 * Y la que falla en silencio: los cuatro archivos tienen que estar en
 * `outputFileTracingIncludes` de `next.config.ts` o no viajan al bundle de la
 * funcion. Sin eso todo funciona en `next dev` y devuelve `codigo: "datos"` en
 * produccion, sin ninguna prueba que lo atrape.
 */

// Se reexporta porque publicacion.ts y conversacion.ts lo inyectan por aqui.
export { leerDatoPublicado, type LeerDatos };

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

export interface VideoGuion {
  /** Canonica: la llave con la que el visor arma `clave`. */
  url: string;
  fuente: string;
  titulo: string;
  zona: string;
}

/**
 * Los videos de TikTok que el guion de locucion lee: el ARCHIVO ENTERO, no la
 * seleccion de un lugar. Un programa del canal no cambia de ejes segun la
 * pantalla desde la que se pida: Noticias 33 lleva California y la mañanera
 * aunque se pulse desde /tecate/redes. Del mas popular al menos, por likes y
 * luego por URL para que el orden no dependa del archivo.
 *
 * Solo `tiktok.json`: el guion no lee comentarios. Un pie vacio no aporta
 * nada que decir y se salta; un video sin URL canonica no se podria citar.
 * Una URL repetida (la misma nota por dos busquedas) entra una vez.
 */
export async function videosTikTokParaGuion(leer: LeerDatos): Promise<VideoGuion[] | "sin-datos"> {
  const crudo = await leer(ARCHIVOS.tiktok.datos);
  if (crudo === null || typeof crudo !== "object") return "sin-datos";
  const datos = crudo as DocRedes;
  const nombres = nombresDeCuentas(datos);
  const vistos = new Set<string>();
  const posts = [...(datos.destacados ?? [])].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0) || a.url.localeCompare(b.url));
  const salida: VideoGuion[] = [];
  for (const post of posts) {
    const url = canonizarPublicacion(post.url, "tiktok");
    const titulo = (post.titulo ?? "").trim();
    if (url === null || titulo === "" || vistos.has(url)) continue;
    vistos.add(url);
    salida.push({ url, titulo, fuente: fuenteDePublicacion(post, "tiktok", nombres), zona: post.zona });
  }
  return salida;
}
