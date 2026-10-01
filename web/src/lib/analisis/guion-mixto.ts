import { archivoPublicado, type IndicesArchivo, type LeerArchivo } from "@/lib/busqueda/archivo";
import { catalogoPublicado, type CatalogoBusqueda, type LeerCatalogo } from "@/lib/busqueda/catalogo";
import { terminos, TERMINOS_MINIMOS, UMBRAL_PUNTAJE, type IndiceRelacionadas } from "@/lib/busqueda/relacionadas";
import { json, SIN_CACHE } from "@/lib/busqueda/respuesta";
import { plegar } from "@/lib/dominio/formato";
import { NOMBRE_RED, type RedVisual } from "@/lib/dominio/publicaciones";
import type { Nota } from "@/lib/datos/tipos";
import { analisisHabilitado, MODELO_GUION } from "./config";
import { PROGRAMAS_GUION, type ProgramaGuion } from "./contrato-guion";
import { leerDatoPublicado, type LeerDatos } from "./datos-redes";
import { decible, EJES_DE, escribirGuion, fallo, type Pieza, type Plan } from "./guion";
import { planPrensa } from "./guion-prensa";
import { ARCHIVOS_GUION_REDES, planRedes, publicacionesParaGuion } from "./guion-redes";

/**
 * El guion MIXTO: lo mas popular de las cuatro redes con los titulares de
 * prensa que cuentan lo mismo, en un solo guion por programa. Es el unico que
 * pide la pantalla (paneles/guion-locucion.tsx).
 *
 * EL CASO. El 28 de septiembre de 2026 el cliente pidio juntar las noticias y
 * las redes: «lo que es tendencia en las redes, corroborado con noticias de
 * verdad sobre eso, en vez de hacer que el usuario pulse dos veces». Habia un
 * guion por material (guion-prensa.ts y guion-redes.ts) y hacian falta dos
 * para un programa.
 *
 * LO MEDIDO ese dia, sobre el corte real (321 publicaciones del guion de
 * redes, 670 titulares del archivo en 48 horas): 199 publicaciones comparten
 * al menos dos palabras raras con un titular (relacionadas.ts), 15 de 18
 * candidatos de Noticias 33, 9 de 10 de Minuta Politica, 7 de 12 de Estado de
 * Alerta y 4 de 12 de De Red en Red. Pero de los pares de las 30 mas
 * populares solo ~8 de ~20 eran EL MISMO HECHO: «Cristiano Ronaldo» juntaba
 * una foto con unas niñas y un partido de la NFL, con 16.5 puntos, por encima
 * del par verdadero del tiroteo en Macro Plaza, con 12.7. Ningun umbral los
 * separa. Asi que:
 *
 *  - EL CODIGO PROPONE Y EL MODELO DECIDE. `parejasDe` da hasta tres
 *    titulares posibles por publicacion, por rareza de las palabras en comun,
 *    y el modelo dice cual cuenta el mismo hecho, o ninguno. El codigo
 *    rechaza un par que no estaba propuesto (guion.ts::resolverDe).
 *  - LA ENTRADA SALE DEL TITULAR, y el pie solo pone el clip (guion.ts,
 *    marcoMixto): si el par estuviera mal, al aire se dice lo que la prensa
 *    publico.
 *  - UNA TENDENCIA SIN NOTA ENTRA, marcada (cliente, el mismo dia): se dice
 *    como lo que circula en redes, y el equipo ve «Sin nota de prensa». Una
 *    nota sin publicacion entra como nota leida.
 *
 * DE DONDE SALE CADA COSA. Las publicaciones y sus ejes, de las reglas del
 * guion de redes (planRedes); los titulares que pueden ir solos, de las del
 * guion de prensa (planPrensa), en vivo. Los titulares POSIBLES de cada
 * publicacion, de todo lo que paso las rejas de prensa y del archivo de las
 * ultimas `HORAS_PAREJA` horas: la seccion en vivo corta en seis por eje, y
 * el titular de un video de Tijuana puede ser el septimo, o de un medio
 * propio que Google no indexa.
 *
 * `solicitar`, `leer`, `leerArchivo` y `leerCatalogo` se inyectan: las salidas
 * de red son los feeds de Google y el modelo, y ninguna otra.
 */

/** Una hora, como prensa: la parte en vivo cambia cada hora. Sin
 *  stale-while-revalidate, que pagaria en segundo plano un guion que nadie
 *  pidio. */
export const CACHE_GUION_MIXTO = "public, max-age=0, s-maxage=3600";

/** Titulares posibles por publicacion. Tres alcanzan: el par verdadero, cuando
 *  lo habia, salio primero o segundo en todos los casos medidos. */
export const PAREJAS_POR_PUBLICACION = 3;

/** Cuanto hacia atras cuenta un titular del archivo como cobertura. El pie es
 *  de las ultimas 24 horas, pero un video se hace viral despues de la nota:
 *  la de la prision domiciliaria de Ruffo Appel salio antes que el video de
 *  su casa. Es la ventana con que se midio. */
export const HORAS_PAREJA = 48;

/** Cuantas notas traen cada termino, para pesar la rareza. */
export interface Frecuencias {
  total: number;
  df: (termino: string) => number;
}

/** La rareza del archivo entero cuando se puede leer (miles de titulares, la
 *  misma de «Notas relacionadas»); si no, la de los titulares a mano. */
export function frecuenciasDe(indice: IndiceRelacionadas | null, titulos: readonly string[]): Frecuencias {
  if (indice !== null && indice.total > 0) return { total: indice.total, df: (t) => indice.porTermino.get(t)?.length ?? 0 };
  const cuenta = new Map<string, number>();
  for (const titulo of titulos) for (const t of terminos(titulo)) cuenta.set(t, (cuenta.get(t) ?? 0) + 1);
  return { total: Math.max(1, titulos.length), df: (t) => cuenta.get(t) ?? 0 };
}

/**
 * Por publicacion, los titulares que PODRIAN contar lo mismo, del mas al
 * menos parecido: dos terminos en comun y el umbral de «Notas relacionadas»
 * (relacionadas.ts), que ahi se ofrece como sugerencia por la misma razon
 * que aqui es solo una propuesta. Puro y determinista: a igual puntaje, la
 * URL.
 */
export function parejasDe(publicaciones: readonly Pieza[], pool: readonly Pieza[], f: Frecuencias, tope = PAREJAS_POR_PUBLICACION): Record<string, string[]> {
  const conTerminos = pool.map((p) => ({ p, ts: new Set(terminos(p.titulo)) }));
  const peso = (t: string) => Math.log(f.total / Math.max(1, f.df(t)));
  const salida: Record<string, string[]> = {};
  for (const v of publicaciones) {
    const propios = terminos(v.titulo);
    const puntuados: { url: string; puntos: number }[] = [];
    if (propios.length >= TERMINOS_MINIMOS) {
      for (const { p, ts } of conTerminos) {
        const comunes = propios.filter((t) => ts.has(t));
        if (comunes.length < TERMINOS_MINIMOS) continue;
        const puntos = comunes.reduce((s, t) => s + peso(t), 0);
        if (puntos >= UMBRAL_PUNTAJE) puntuados.push({ url: p.url, puntos });
      }
    }
    puntuados.sort((a, b) => b.puntos - a.puntos || a.url.localeCompare(b.url));
    salida[v.url] = puntuados.slice(0, tope).map((x) => x.url);
  }
  return salida;
}

/** El nombre del medio de una nota del archivo: el del catalogo por el id de
 *  la fuente; una fuente sintetica (`gn-…`) no tiene fila y va con su
 *  dominio, como en archivo.ts. No se dice al aire: es para el equipo. */
const nombreDeFuente = (n: Nota, catalogo: CatalogoBusqueda | null) =>
  catalogo?.medios.find((m) => m.id === n.fuente)?.nombre ?? n.dominio;

/** Las notas del archivo de las ultimas `horas`, como piezas. `notas` del
 *  indice de relacionadas ya dejo fuera lo que el gacetero marco `fuera`. */
export function archivoReciente(indices: IndicesArchivo | null, catalogo: CatalogoBusqueda | null, ahora: string, horas = HORAS_PAREJA): Pieza[] {
  if (indices === null) return [];
  const hasta = Date.parse(ahora);
  const desde = hasta - horas * 3_600_000;
  return indices.relacionadas.notas
    .filter((n) => {
      const f = Date.parse(n.publicado ?? n.fecha ?? "");
      return Number.isFinite(f) && f >= desde && f <= hasta + 3_600_000 && decible(n);
    })
    .map((n) => ({ url: n.url, fuente: nombreDeFuente(n, catalogo), titulo: n.titulo, ampliable: { url: n.url, dominio: n.dominio, titulo: n.titulo } }));
}

/** Una pieza por titular plegado, la primera: en vivo antes que el archivo,
 *  que es el orden en que llegan. */
function unaPorTitulo(piezas: readonly Pieza[]): Pieza[] {
  const vistos = new Set<string>();
  const urls = new Set<string>();
  return piezas.filter((p) => {
    const clave = plegar(p.titulo);
    if (vistos.has(clave) || urls.has(p.url)) return false;
    vistos.add(clave);
    urls.add(p.url);
    return true;
  });
}

/**
 * El plan mixto, puro: las publicaciones (y sus ejes) del plan de redes, los
 * titulares que pueden ir solos del de prensa, y los pares. Null si no hay
 * nada que escribir.
 */
export function armarPlanMixto(programa: ProgramaGuion, material: {
  /** El plan de redes, o null si ningun eje tuvo publicaciones. */
  social: Plan | null;
  leidas: readonly RedVisual[];
  prensa: { plan: Plan | null; todas: readonly Pieza[]; noLeidos: ReadonlySet<string>; todoCaido: boolean };
  archivo: readonly Pieza[];
  frecuencias: Frecuencias;
}): Plan | null {
  const { social, leidas, prensa } = material;
  const ejes = EJES_DE[programa];
  const lista = social?.lista ?? [];
  const candidatos = ejes === undefined ? null : social?.candidatos ?? {};
  const candidatosTitulares: Record<string, readonly Pieza[]> = ejes === undefined
    ? { temas: prensa.plan?.lista ?? [] }
    : { ...(prensa.plan?.candidatos ?? {}) };
  const solos = Object.values(candidatosTitulares).flat();
  if (lista.length === 0 && solos.length === 0) return null;

  const pool = unaPorTitulo([...prensa.todas, ...material.archivo]);
  const pares = parejasDe(lista, pool, material.frecuencias);
  const porUrl = new Map(pool.map((p) => [p.url, p]));
  // Los que pueden ir solos primero, en el orden de sus ejes; despues, los
  // que solo acompanan, en el orden de sus publicaciones.
  const acompanan = lista.flatMap((v) => (pares[v.url] ?? []).map((u) => porUrl.get(u)).filter((p): p is Pieza => p !== undefined));
  const titulares = unaPorTitulo([...solos, ...acompanan]);
  // Un titular que se cayo por repetido deja su par apuntando a la copia que
  // quedo: mismo titular plegado, otra URL.
  const deTitulo = new Map(titulares.map((p) => [plegar(p.titulo), p.url]));
  const paresFinales = Object.fromEntries(Object.entries(pares).map(([v, us]) =>
    [v, [...new Set(us.map((u) => deTitulo.get(plegar(porUrl.get(u)?.titulo ?? "")) ?? u))]]));

  const sinRedes = (Object.keys(ARCHIVOS_GUION_REDES) as RedVisual[]).filter((r) => !leidas.includes(r)).map((r) => NOMBRE_RED[r]);
  const sinTitulares = prensa.todoCaido || (ejes === undefined && prensa.noLeidos.has("temas"))
    ? ["los titulares"]
    : (ejes ?? []).filter((e) => prensa.noLeidos.has(e.id)).map((e) => `los titulares de ${e.nombre}`);
  const faltantes = (ejes ?? [])
    .filter((e) => (candidatos?.[e.id] ?? []).length === 0 && (candidatosTitulares[e.id] ?? []).length === 0 && !prensa.noLeidos.has(e.id) && !prensa.todoCaido)
    .map((e) => e.nombre);

  return {
    origen: "mixto",
    programa,
    lista,
    candidatos,
    faltantes,
    sinLeer: [...sinRedes, ...sinTitulares],
    titulares,
    pares: paresFinales,
    candidatosTitulares,
    hasta: social?.hasta ?? null,
  };
}

const MENSAJE_POCOS: Record<ProgramaGuion, string> = {
  noticias33: "No hay publicaciones ni notas de hoy para los ejes de Noticias 33.",
  deredenred: "No hay publicaciones ni notas de entretenimiento de hoy.",
  deportes: "No hay publicaciones ni notas de deportes de hoy.",
  minutapolitica: "No hay publicaciones ni notas de política de hoy.",
  estadodealerta: "No hay publicaciones ni notas de nota roja de hoy.",
};

const NO_DISPONIBLE = "Las publicaciones y los titulares no están disponibles en esta vista.";

export async function responderGuionMixto(
  params: { p: string | null },
  solicitar: typeof fetch = fetch,
  ahora: string = new Date().toISOString(),
  leer: LeerDatos = leerDatoPublicado,
  leerArchivo: LeerArchivo = archivoPublicado,
  leerCatalogo: LeerCatalogo = catalogoPublicado,
  /** Solo para comparar modelos a mano; la ruta usa siempre MODELO_GUION. */
  modelo: string = MODELO_GUION,
): Promise<Response> {
  if (!analisisHabilitado()) {
    return json({ codigo: "apagado", mensaje: "El guion automático no está disponible." }, 400, SIN_CACHE);
  }
  const programa = PROGRAMAS_GUION.find((p) => p === params.p);
  if (programa === undefined) return json({ codigo: "programa", mensaje: "Programa desconocido." }, 400, SIN_CACHE);

  const [{ videos, leidas, hasta }, prensa, indices, catalogo] = await Promise.all([
    publicacionesParaGuion(leer, ahora),
    planPrensa(programa, solicitar, ahora, leerArchivo, leerCatalogo),
    leerArchivo(),
    leerCatalogo(),
  ]);
  if (leidas.length === 0 && prensa.todoCaido) return fallo(NO_DISPONIBLE, "datos");

  const social = planRedes(programa, videos.filter(decible), leidas, hasta);
  const archivo = archivoReciente(indices, catalogo, ahora);
  const frecuencias = frecuenciasDe(indices?.relacionadas ?? null, [...prensa.todas, ...archivo].map((p) => p.titulo));
  const plan = armarPlanMixto(programa, { social, leidas, prensa, archivo, frecuencias });
  const completo = leidas.length === Object.keys(ARCHIVOS_GUION_REDES).length && !prensa.caido && indices !== null;
  // Sin nada que escribir y con algo sin leer no se puede afirmar que no hubo
  // material: se dice que no se pudo leer.
  if (plan === null) return completo ? fallo(MENSAJE_POCOS[programa], "pocos") : fallo(NO_DISPONIBLE, "datos");
  return escribirGuion(plan, { solicitar, modelo, cache: completo ? CACHE_GUION_MIXTO : SIN_CACHE });
}
