/**
 * Lector minimo del RSS de Google Noticias. Solo servidor.
 *
 * Escrito a mano y sin dependencia, con una asimetria que conviene decir en
 * voz alta en vez de disimularla: en Python el mismo trabajo es gratis porque
 * la stdlib trae xml.etree, y aqui no, asi que la disciplina de
 * "sin dependencias" cuesta estas ~90 lineas de regex fina. Se pagan porque
 * la entrada es UN feed, de UN generador, con CUATRO campos que interesan.
 *
 * Regex sobre XML esta mal EN GENERAL y bien AQUI, por dos razones concretas:
 *
 *   <item> no anida en RSS 2.0, y cada campo se busca dentro de la rebanada de
 *   un solo item, nunca sobre el documento entero.
 *
 *   Nada de lo que sale de aqui toca dangerouslySetInnerHTML: React escapa
 *   cada cadena al pintarla, asi que un parseo malo es un defecto cosmetico,
 *   no una inyeccion.
 *
 * Si alguna de las dos deja de ser cierta -- aparece un segundo consumidor de
 * XML, o este texto termina en HTML crudo -- la cuenta cambia y toca un
 * parser de verdad.
 */

import type { Idioma, ResultadoExterno } from "./tipos";

/**
 * Sin la bandera /g, a proposito y no por olvido.
 *
 * Una regex global de modulo conserva `lastIndex` entre llamadas y empieza a
 * saltarse items en silencio a partir de la segunda. Es la misma familia de
 * error que ya mordio en scripts/verificar-tokens.mjs, donde una regex rota
 * dejo de vigilar y "el informe salio limpio".
 */
const ITEM = /<item\b[^>]*>([\s\S]*?)<\/item>/g;
const TITULO = /<title>([\s\S]*?)<\/title>/;
const ENLACE = /<link>([\s\S]*?)<\/link>/;
const FECHA = /<pubDate>([\s\S]*?)<\/pubDate>/;
const FUENTE = /<source\b([^>]*)>([\s\S]*?)<\/source>/;
const FUENTE_URL = /\burl\s*=\s*"([^"]*)"/;
const CDATA = /<!\[CDATA\[([\s\S]*?)\]\]>/g;

const ENTIDADES: Record<string, string> = {
  lt: "<",
  gt: ">",
  amp: "&",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const ENTIDAD = /&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g;

export function quitarCdata(s: string): string {
  return s.replace(CDATA, "$1");
}

/**
 * Entidades en UNA sola pasada. Dos pasadas convertirian `&amp;lt;` en `<`,
 * que es como se cuela una etiqueta que el autor escribio como texto.
 */
export function decodificarXml(s: string): string {
  return s.replace(ENTIDAD, (crudo, cuerpo: string) => {
    if (cuerpo.startsWith("#")) {
      const n =
        cuerpo[1] === "x" || cuerpo[1] === "X"
          ? Number.parseInt(cuerpo.slice(2), 16)
          : Number.parseInt(cuerpo.slice(1), 10);
      // fromCodePoint LANZA con un punto fuera de rango o un sustituto
      // suelto, y una excepcion aqui tumbaria la peticion entera por un item
      // mal formado. Se devuelve el texto crudo y se sigue.
      if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return crudo;
      if (n >= 0xd800 && n <= 0xdfff) return crudo;
      return String.fromCodePoint(n);
    }
    return ENTIDADES[cuerpo.toLowerCase()] ?? crudo;
  });
}

/** CDATA primero, entidades despues: dentro de CDATA el texto es literal. */
function texto(s: string | undefined): string {
  if (s === undefined) return "";
  return decodificarXml(quitarCdata(s)).replace(/\s+/g, " ").trim();
}

/**
 * Quita el " - Publicador" que Google pega al final del titular.
 *
 * Solo el sufijo EXACTO. Nunca "cortar en el ultimo guion": en este corredor
 * "Tijuana - San Diego: la garita cierra el domingo" es una forma de titular
 * normal, y un corte generico la dejaria en "Tijuana".
 *
 * toLowerCase y no `plegar`: plegar colapsa espacios, con lo que el largo del
 * texto plegado deja de indexar sobre el original. Los acentos coinciden
 * porque <title> y <source> salen del mismo registro de Google.
 */
export function quitarSufijoMedio(titulo: string, medio: string): string {
  if (medio === "") return titulo;
  for (const guion of [" - ", " — ", " | "]) {
    const sufijo = guion + medio;
    if (titulo.endsWith(sufijo)) return titulo.slice(0, -sufijo.length).trimEnd();
    if (titulo.toLowerCase().endsWith(sufijo.toLowerCase())) {
      return titulo.slice(0, -sufijo.length).trimEnd();
    }
  }
  return titulo;
}

/** Espejo de pulso/normalizar.py::dominio. */
export function dominioDe(url: string): string {
  const resto = (url.split("://", 2)[1] ?? url)
    .split("/", 1)[0]!
    .split("@")
    .pop()!
    .split(":", 1)[0]!
    .toLowerCase();
  return resto.startsWith("www.") ? resto.slice(4) : resto;
}

/**
 * pubDate es RFC 2822 y V8 lo interpreta. Se normaliza a Z, a diferencia de
 * pulso/normalizar.py::fecha_iso, que conserva el offset del medio. Da igual
 * porque `cuando()` formatea en America/Tijuana fijo, asi que el reloj de
 * pared es el mismo; no "arreglarlo" para que se parezcan.
 */
function fechaIso(cruda: string): string | null {
  if (cruda === "") return null;
  const d = new Date(cruda);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function parsearFeed(
  xml: string,
  idioma: Idioma,
  tope: number,
): ResultadoExterno[] {
  const salida: ResultadoExterno[] = [];
  // Instancia propia por llamada: ITEM lleva /g y compartir su lastIndex
  // entre peticiones concurrentes las haria saltarse items entre si.
  const items = new RegExp(ITEM.source, "g");
  let m: RegExpExecArray | null;
  while ((m = items.exec(xml)) !== null && salida.length < tope) {
    const cuerpo = m[1] ?? "";

    const fuente = FUENTE.exec(cuerpo);
    // Sin <source> no hay forma de saber de que medio es la nota, y
    // atribuirla a news.google.com seria mentir. Se descarta.
    if (fuente === null) continue;
    const medio = texto(fuente[2]);
    const fuenteUrl = texto(FUENTE_URL.exec(fuente[1] ?? "")?.[1]);
    const dominio = dominioDe(fuenteUrl);
    if (dominio === "") continue;

    const titulo = quitarSufijoMedio(texto(TITULO.exec(cuerpo)?.[1]), medio);
    const url = texto(ENLACE.exec(cuerpo)?.[1]);
    if (titulo === "" || url === "") continue;

    salida.push({
      titulo,
      url,
      dominio,
      medio: medio === "" ? dominio : medio,
      publicado: fechaIso(texto(FECHA.exec(cuerpo)?.[1])),
      idioma,
      // El feed no trae ninguna de las dos. Las resuelve el servidor cruzando
      // el titular contra el archivo, ya cortada la lista (archivo.ts).
      imagen: null,
      referencia: null,
    });
  }
  return salida;
}
