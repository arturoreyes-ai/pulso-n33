/**
 * El buscador PROPIO de los medios, en vivo. Solo servidor.
 *
 * Espejo de pulso/consultas.py::_buscar_en_medio, y existe por el mismo caso:
 * Blanco y Negro Noticias publico tres titulares adversos sobre Grupo
 * Concordia entre marzo y abril de 2026 y el RSS de Google Noticias no trae
 * ninguno. La consulta del pipeline ya los leia desde el 18 de septiembre; la
 * busqueda del sitio no, asi que la lupa decia menos de lo que el archivo de
 * consultas sabia. Desde el 23 de septiembre de 2026 la lupa lee los mismos
 * buscadores, con las mismas cuatro reglas:
 *
 *  - El termino va SIN comillas: WordPress manda las comillas al LIKE tal
 *    cual y solo encuentra las notas que traen comillas en el cuerpo (medido
 *    en Sintesis).
 *  - Solo entran los titulares que NOMBRAN el termino (`nombra`): el buscador
 *    del medio empareja contra el cuerpo, que aqui no se lee, y «Concordia»
 *    trae la Concordia de Sinaloa.
 *  - El enlace tiene que ser https y del propio medio.
 *  - robots.txt con nuestro agente, y uno ilegible se lee como PROHIBIDO: es
 *    la postura de ROBOTSTXT_OBEY, y cuatro de estos sitios devuelven 403 a
 *    un agente generico y 200 al nuestro.
 *
 * Las filas vienen del config por `scripts/sincronizar-datos.mjs`, que copia
 * SOLO las que tienen `activo` y `verificado`: un buscador sin sondear es la
 * fila de Uniradio, que devolvia su portada entera ignorando el termino.
 */

import { plegar } from "@/lib/dominio/formato";
import { AGENTE } from "./google-noticias";
import { dominioDe, parsearFeedMedio } from "./rss";
import type { Idioma, ResultadoExterno, SaludBuscador } from "./tipos";

export interface BuscadorMedio {
  id: string;
  nombre: string;
  /** Con `{q}` donde va el termino. */
  url: string;
  idioma: Idioma;
}

/** Espejo de PAGINAS_BUSCADOR, TITULARES_POR_PAGINA y ANTERIORES_MAXIMO. */
export const PAGINAS_BUSCADOR = 2;
export const TITULARES_POR_PAGINA = 10;
export const ANTERIORES_MAXIMO = 10;

/**
 * Doce segundos por pagina y no los seis de Google: medido el 23 de septiembre
 * de 2026, el buscador de Zeta tarda 10.4 s en contestar su RSS de busqueda
 * (con cualquier agente), y con seis salia `fallo` siempre. El pipeline le da
 * quince. La portada pide menos (buscar.ts) y no espera a nadie de mas.
 */
export const MS_LIMITE_MEDIO = 12_000;
const MS_LIMITE = 6_000;
const MAX_BYTES = 2 * 1024 * 1024;
const ACEPTA = "application/rss+xml, application/xml, text/xml";

/** La URL de una pagina del buscador. Espejo de `url_buscador`. */
export function urlBuscador(b: BuscadorMedio, termino: string, pagina = 1): string {
  let url = b.url.replace("{q}", encodeURIComponent(termino));
  if (pagina > 1) url += `${url.includes("?") ? "&" : "?"}paged=${pagina}`;
  return url;
}

/** Si el titular nombra el termino, plegados los dos. Espejo de `_nombra`. */
export function nombra(titulo: string, termino: string): boolean {
  const aguja = plegar(termino);
  return aguja !== "" && plegar(titulo).includes(aguja);
}

// ------------------------------------------------------------------ robots

/**
 * Un robots.txt leido, con la semantica de urllib.robotparser de Python y NO
 * la del RFC 9309: la primera regla que empareja gana (no la mas larga), un
 * `*` dentro de la ruta no es comodin, y el agente empareja por subcadena de
 * su primer token. El pipeline decide con esa semantica, y dos lectores que
 * dieran veredictos distintos sobre el mismo sitio serian dos politicas.
 */
interface Regla { ruta: string; permitida: boolean }
interface Entrada { agentes: string[]; reglas: Regla[] }
export interface Robots { entradas: Entrada[]; omision: Entrada | null }

/** urllib.parse.quote con safe='/': lo que JS deja sin escapar y Python no. */
function citar(s: string): string {
  return encodeURIComponent(s)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%2F/g, "/");
}

function descitar(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function nuevaRegla(ruta: string, permitida: boolean): Regla {
  // Un `Disallow:` vacio es «todo permitido» (robotparser.RuleLine).
  return { ruta: citar(ruta), permitida: ruta === "" && !permitida ? true : permitida };
}

export function parsearRobots(texto: string): Robots {
  const robots: Robots = { entradas: [], omision: null };
  let estado = 0;
  let entrada: Entrada = { agentes: [], reglas: [] };
  const agregar = (e: Entrada) => {
    if (e.agentes.includes("*")) {
      robots.omision ??= e;
    } else {
      robots.entradas.push(e);
    }
  };
  for (const cruda of texto.split(/\r\n|\r|\n/)) {
    const linea = cruda.split("#", 1)[0]!.trim();
    if (linea === "") {
      if (estado === 1) {
        entrada = { agentes: [], reglas: [] };
        estado = 0;
      } else if (estado === 2) {
        agregar(entrada);
        entrada = { agentes: [], reglas: [] };
        estado = 0;
      }
      continue;
    }
    const dos = linea.indexOf(":");
    if (dos < 0) continue;
    const clave = linea.slice(0, dos).trim().toLowerCase();
    const valor = descitar(linea.slice(dos + 1).trim());
    if (clave === "user-agent") {
      if (estado === 2) {
        agregar(entrada);
        entrada = { agentes: [], reglas: [] };
      }
      entrada.agentes.push(valor);
      estado = 1;
    } else if (clave === "disallow" || clave === "allow") {
      if (estado !== 0) {
        entrada.reglas.push(nuevaRegla(valor, clave === "allow"));
        estado = 2;
      }
    }
  }
  if (estado === 2) agregar(entrada);
  return robots;
}

function aplicaAgente(e: Entrada, agente: string): boolean {
  const token = agente.split("/", 1)[0]!.toLowerCase();
  return e.agentes.some((a) => a === "*" || token.includes(a.toLowerCase()));
}

function permite(e: Entrada, ruta: string): boolean {
  for (const r of e.reglas) {
    if (r.ruta === "*" || ruta.startsWith(r.ruta)) return r.permitida;
  }
  return true;
}

export function puedeLeer(robots: Robots, agente: string, url: string): boolean {
  let ruta: string;
  try {
    const u = new URL(url);
    ruta = citar(descitar(u.pathname + u.search)) || "/";
  } catch {
    return false;
  }
  for (const e of robots.entradas) {
    if (aplicaAgente(e, agente)) return permite(e, ruta);
  }
  return robots.omision === null ? true : permite(robots.omision, ruta);
}

/** robots.txt de un sitio: el texto, «no hay» (404: todo permitido) o
 *  «ilegible» (cualquier otra cosa: nada permitido). */
type EstadoRobots = { tipo: "texto"; robots: Robots } | { tipo: "libre" } | { tipo: "cerrado" };

async function leerRobots(origen: string, solicitar: typeof fetch): Promise<EstadoRobots> {
  try {
    const r = await solicitar(`${origen}/robots.txt`, {
      headers: { "User-Agent": AGENTE },
      cache: "no-store",
      signal: AbortSignal.timeout(MS_LIMITE),
    });
    if (r.status === 404) return { tipo: "libre" };
    if (!r.ok) return { tipo: "cerrado" };
    return { tipo: "texto", robots: parsearRobots((await r.text()).slice(0, MAX_BYTES)) };
  } catch {
    return { tipo: "cerrado" };
  }
}

/**
 * Una hora por proceso. El pipeline lo relee en cada corrida, cuatro al dia;
 * aqui cada busqueda pediria seis robots.txt antes de seis feeds, y un sitio
 * que cambia su robots no lo hace de un minuto a otro. Se memoiza la PROMESA,
 * como en archivo.ts, para que dos busquedas en frio compartan una lectura.
 */
const VIGENCIA_ROBOTS_MS = 60 * 60 * 1000;
const memoriaRobots = new Map<string, { vence: number; estado: Promise<EstadoRobots> }>();

export type Robotero = (url: string) => Promise<boolean>;

export function robotsCon(solicitar: typeof fetch = fetch, ahora: () => number = Date.now): Robotero {
  return async (url) => {
    let origen: string;
    try {
      origen = new URL(url).origin;
    } catch {
      return false;
    }
    const t = ahora();
    let memo = memoriaRobots.get(origen);
    if (memo === undefined || memo.vence <= t) {
      memo = { vence: t + VIGENCIA_ROBOTS_MS, estado: leerRobots(origen, solicitar) };
      memoriaRobots.set(origen, memo);
    }
    const estado = await memo.estado;
    if (estado.tipo === "libre") return true;
    if (estado.tipo === "cerrado") return false;
    return puedeLeer(estado.robots, AGENTE, url);
  };
}

// --------------------------------------------------------------- busqueda

export interface CosechaMedio {
  resultados: ResultadoExterno[];
  anteriores: ResultadoExterno[];
  salud: SaludBuscador;
}

/**
 * Un buscador de un medio para un termino. `desde` es la fecha (AAAA-MM-DD)
 * que abre la ventana: lo que nombra el termino y es anterior va a
 * `anteriores`, que la busqueda del sitio publica aparte y con fecha.
 */
export async function buscarEnMedio(
  b: BuscadorMedio,
  termino: string,
  desde: string,
  solicitar: typeof fetch = fetch,
  robots: Robotero = robotsCon(solicitar),
  msLimite: number = MS_LIMITE_MEDIO,
): Promise<CosechaMedio> {
  const t0 = Date.now();
  const salud = (estado: SaludBuscador["estado"], titulares = 0, anteriores = 0, error: string | null = null): SaludBuscador => ({
    id: b.id, nombre: b.nombre, estado, titulares, anteriores, ms: Date.now() - t0, error,
  });
  // `dominioDe` y no el host: Sintesis enlaza sus notas con `www.` y su
  // buscador vive sin el (medido el 18 de septiembre de 2026).
  const host = dominioDe(b.url.replace("{q}", "x"));
  const primera = urlBuscador(b, termino);
  if (!(await robots(primera))) return { resultados: [], anteriores: [], salud: salud("robots") };

  const resultados: ResultadoExterno[] = [];
  const anteriores: ResultadoExterno[] = [];
  for (let pagina = 1; pagina <= PAGINAS_BUSCADOR; pagina++) {
    let items;
    try {
      const r = await solicitar(urlBuscador(b, termino, pagina), {
        headers: { "User-Agent": AGENTE, Accept: ACEPTA },
        cache: "no-store",
        signal: AbortSignal.timeout(msLimite),
      });
      if (!r.ok) throw new Error(`${b.nombre} respondio ${r.status}`);
      const crudo = (await r.text()).slice(0, MAX_BYTES);
      const cabeza = crudo.slice(0, 1024).trimStart().toLowerCase();
      if (cabeza.startsWith("<!doctype html") || cabeza.startsWith("<html")) {
        throw new Error("respuesta HTML, no RSS");
      }
      items = parsearFeedMedio(crudo, 100);
    } catch (e) {
      // Lo que trajo la primera pagina vale.
      if (pagina > 1) break;
      const nombre = e instanceof Error ? e.name : "Error";
      const mensaje = e instanceof Error ? e.message : String(e);
      return {
        resultados: [], anteriores: [],
        salud: salud("fallo", 0, 0, nombre === "TimeoutError" ? `sin respuesta en ${msLimite / 1000} s` : mensaje.slice(0, 300)),
      };
    }
    let ultima = "";
    for (const it of items) {
      const fecha = it.publicado?.slice(0, 10) ?? null;
      if (fecha === null) continue;
      if (ultima === "" || fecha < ultima) ultima = fecha;
      if (!nombra(it.titulo, termino)) continue;
      let https = false;
      try {
        https = new URL(it.url).protocol === "https:";
      } catch {
        https = false;
      }
      // El enlace tiene que ser del propio medio.
      if (!https || dominioDe(it.url) !== host) continue;
      const fila: ResultadoExterno = {
        titulo: it.titulo,
        url: it.url,
        dominio: dominioDe(it.url) || host,
        medio: b.nombre,
        publicado: it.publicado,
        idioma: b.idioma,
        imagen: null,
        referencia: null,
        origen: "medio",
      };
      (fecha < desde ? anteriores : resultados).push(fila);
    }
    // Una pagina llena cuya ultima fecha sigue dentro de la ventana puede
    // seguir; una corta o ya fuera de la ventana, no.
    if (items.length < TITULARES_POR_PAGINA || ultima === "" || ultima < desde) break;
  }
  return { resultados, anteriores, salud: salud("ok", resultados.length, anteriores.length) };
}

/** Todos los buscadores en paralelo; que se caiga uno no tumba los demas. */
export async function buscarEnMedios(
  buscadores: readonly BuscadorMedio[],
  termino: string,
  desde: string,
  solicitar: typeof fetch = fetch,
  robots: Robotero = robotsCon(solicitar),
  msLimite: number = MS_LIMITE_MEDIO,
): Promise<CosechaMedio[]> {
  const acuerdos = await Promise.allSettled(buscadores.map((b) => buscarEnMedio(b, termino, desde, solicitar, robots, msLimite)));
  return acuerdos.map((a, i) =>
    a.status === "fulfilled"
      ? a.value
      : {
          resultados: [], anteriores: [],
          salud: {
            id: buscadores[i]!.id, nombre: buscadores[i]!.nombre, estado: "fallo" as const,
            titulares: 0, anteriores: 0, ms: 0, error: String(a.reason).slice(0, 300),
          },
        },
  );
}
