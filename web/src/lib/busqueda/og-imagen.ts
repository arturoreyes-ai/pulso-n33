/**
 * La imagen que el propio medio declara para su articulo. Puro.
 *
 * Lee `og:image` del `<head>` de una nota. Es la MISMA fuente que usa el
 * buscador para pintar su miniatura, y por eso una fila en vivo puede tener
 * figura aunque el RSS no la traiga: el feed la omite, la pagina no.
 *
 * LA REGLA DE HOST AQUI ES OTRA, a proposito, y no contradice al pipeline:
 *
 *  - `pulso/normalizar.py::imagen_del_medio` exige que la miniatura este en el
 *    dominio del medio o en un CDN que su fila declara. Existe porque alla se
 *    saca un `<img>` del CUERPO de un feed, donde se cuelan fotos de stock, el
 *    sprite de emoji de WordPress y fotos de OTRO medio. Guardar una de esas
 *    acreditaria al medio una imagen que no hizo. Esa funcion no se toca y
 *    sigue rigiendo todo lo que entra a data/.
 *  - `og:image` no es eso. Es la imagen que el medio ELIGIO y DECLARO para ese
 *    articulo, en su propia pagina; si publica una de stock, esa es la que
 *    publica. Por eso aqui se acepta cualquier host (decision del cliente del
 *    17 de septiembre de 2026) y lo que queda son los limites de forma: https,
 *    sin espacios y con tope de largo, los mismos que `pulso/fetch.py`.
 *
 * Nada de esto se guarda: lo consume la tarjeta del recorrido y se va.
 */

/** El mismo tope que `IMAGEN_LARGO_MAXIMO` en el pipeline. */
const LARGO_MAXIMO = 500;

/**
 * En orden de preferencia. `secure_url` primero porque cuando existe es la
 * variante https de la misma foto; `twitter:*` al final porque varios medios
 * de la region solo publican esa.
 */
const ETIQUETAS = [
  "og:image:secure_url",
  "og:image:url",
  "og:image",
  "twitter:image:src",
  "twitter:image",
];

const META = /<meta\b[^>]*>/gi;
const ATRIBUTO = /([a-zA-Z][a-zA-Z0-9:_-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

/**
 * Las cinco entidades de XML mas la forma numerica. No es un decodificador de
 * HTML completo y no debe serlo: esto se aplica a un atributo `content` que ya
 * viene delimitado, y en la practica lo unico que aparece en una URL es `&amp;`
 * separando parametros de un CDN.
 */
export function decodificar(texto: string): string {
  return texto
    .replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6}));/g, (todo, dec: string | undefined, hex: string | undefined) => {
      const punto = dec !== undefined ? Number.parseInt(dec, 10) : Number.parseInt(hex ?? "", 16);
      return Number.isFinite(punto) && punto > 0 && punto <= 0x10ffff ? String.fromCodePoint(punto) : todo;
    })
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function atributosDe(etiqueta: string): Map<string, string> {
  const attrs = new Map<string, string>();
  ATRIBUTO.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATRIBUTO.exec(etiqueta)) !== null) {
    const nombre = (m[1] ?? "").toLowerCase();
    const valor = m[2] ?? m[3] ?? m[4] ?? "";
    if (nombre !== "" && !attrs.has(nombre)) attrs.set(nombre, valor);
  }
  return attrs;
}

/**
 * Solo el `<head>`. Un `og:image` vive ahi; recorrer el cuerpo entero de una
 * nota larga no encuentra nada nuevo y cuesta.
 */
function cabeza(html: string): string {
  const fin = html.search(/<\/head\s*>|<body\b/i);
  return fin === -1 ? html : html.slice(0, fin);
}

/**
 * La URL absoluta de la imagen declarada, o `null`.
 *
 * `base` es la pagina ya resuelta: un medio puede declarar `/img/foo.jpg` y sin
 * base eso no es una direccion. Una relativa sobre un `base` http no sube a
 * https sola; se descarta, como cualquier otra que no sea https.
 */
export function imagenDeHtml(html: string, base: string | URL): string | null {
  const encontradas = new Map<string, string>();
  const texto = cabeza(html);
  META.lastIndex = 0;
  let etiqueta: RegExpExecArray | null;
  while ((etiqueta = META.exec(texto)) !== null) {
    const attrs = atributosDe(etiqueta[0]);
    const clave = (attrs.get("property") ?? attrs.get("name") ?? "").trim().toLowerCase();
    const contenido = attrs.get("content");
    if (clave === "" || contenido === undefined) continue;
    if (!ETIQUETAS.includes(clave) || encontradas.has(clave)) continue;
    encontradas.set(clave, contenido);
  }
  for (const etq of ETIQUETAS) {
    const crudo = encontradas.get(etq);
    if (crudo === undefined) continue;
    const url = imagenAbsoluta(decodificar(crudo).trim(), base);
    if (url !== null) return url;
  }
  return null;
}

/** Los limites de forma de una URL de imagen, compartidos con la destacada
 *  que devuelve WordPress (enlace-medio.ts). */
export function imagenAbsoluta(crudo: string, base: string | URL): string | null {
  if (crudo === "" || crudo.length > LARGO_MAXIMO) return null;
  let u: URL;
  try {
    u = new URL(crudo, base);
  } catch {
    return null;
  }
  // https y nada mas: un `data:` seria copiar la imagen en vez de enlazarla, y
  // un `http:` lo bloquea el navegador en una pagina https.
  if (u.protocol !== "https:") return null;
  if (u.username !== "" || u.password !== "") return null;
  const final = u.toString();
  if (final.length > LARGO_MAXIMO) return null;
  if (/\s/.test(final)) return null;
  return final;
}
