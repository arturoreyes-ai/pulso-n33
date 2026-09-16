/**
 * El texto legible de una pagina de un medio, sin dependencias.
 *
 * Con las mismas reglas que el resto del repo: el HTML de un medio no es XML,
 * asi que fast-xml-parser no sirve, y no se agrega un parser de HTML por esto.
 * Lo que se necesita aqui no es un arbol: es la prosa de los parrafos, lo mas
 * corta posible, para mandarla a un modelo y tirarla.
 *
 * Nada de lo que sale de aqui se guarda. Vive en memoria el tiempo de una
 * peticion y no llega a la respuesta: lo que vuelve al lector es la lectura,
 * nunca el texto leido. Esa es la linea que mantiene cierta la promesa de
 * docs/datos.md, "no se guardan cuerpos ni resumenes".
 */

/** Suficiente para que un modelo entienda una nota; casi ninguna llega. */
export const TOPE_TEXTO = 8000;

const FUERA = /<(script|style|noscript|svg|head|nav|footer|aside|form)\b[^>]*>[\s\S]*?<\/\1>/gi;
const PARRAFO = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
const ETIQUETA = /<[^>]+>/g;

const ENTIDADES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'",
  "&apos;": "'", "&nbsp;": " ", "&mdash;": "—", "&ndash;": "–", "&hellip;": "…",
};

function desescapar(s: string): string {
  return s
    .replace(/&[a-z]+;|&#\d+;/gi, (e) => {
      const conocida = ENTIDADES[e.toLowerCase()];
      if (conocida !== undefined) return conocida;
      const n = /^&#(\d+);$/.exec(e);
      return n === null ? e : String.fromCodePoint(Number(n[1]));
    });
}

/**
 * Los parrafos de un HTML, en orden, unidos por saltos.
 *
 * Los parrafos de menos de 40 caracteres se tiran: en las plantillas de los
 * medios esos son los pies de foto, los creditos, "Compartir en Facebook" y los
 * avisos de cookies, y llenan la ventana del modelo con lo unico que no es la
 * nota.
 */
export function extraerTexto(html: string): string {
  const limpio = html.replace(FUERA, " ");
  const partes: string[] = [];
  let m: RegExpExecArray | null;
  PARRAFO.lastIndex = 0;
  while ((m = PARRAFO.exec(limpio)) !== null) {
    const texto = desescapar(m[1]!.replace(ETIQUETA, " ")).replace(/\s+/g, " ").trim();
    if (texto.length >= 40) partes.push(texto);
    if (partes.join("\n").length > TOPE_TEXTO) break;
  }
  return partes.join("\n").slice(0, TOPE_TEXTO);
}
