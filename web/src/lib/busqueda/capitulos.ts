/**
 * Capitulos del recorrido de la portada: las listas en vivo, encadenadas. Puro.
 *
 * El cliente pidio el 14 de septiembre de 2026 un recorrido de titulares al
 * estilo WikiTok: una tarjeta por titular, a pantalla completa, y el gesto de
 * desplazar para pasar a la siguiente. Tres cosas del original no se copian,
 * y ninguna por gusto:
 *
 *  - La imagen no viene de aqui. El RSS de Google Noticias no trae
 *    miniatura. La primera que se intenta es la del corpus: la misma nota
 *    llegada por el feed del propio medio, con la miniatura que ese medio
 *    publica (imagenes.ts).
 *
 *    Ese cruce casi nunca empata fuera del capitulo local -- medido el 17
 *    de septiembre de 2026: de 503 notas llegadas por busqueda, CERO
 *    recuperan miniatura, y el 95% son de medios que no estan en el
 *    catalogo. Por eso, desde esa fecha, lo que el corpus no tiene se pide
 *    al og:image de la pagina del propio medio, de a una tarjeta y solo
 *    cuando el lector se detiene en ella (lib/busqueda/use-imagen-viva.ts).
 *    Hasta entonces, y si el medio no contesta, la tarjeta lleva su placa.
 *
 *    Esto NO afloja la regla del pipeline, que es sobre otra cosa: alla el
 *    token del redirector rota entre corridas y cambiaria el `url` de una
 *    nota ya guardada, ensuciando data/ (ver pulso/busquedas.py). Aqui no
 *    se guarda ninguna nota.
 *  - No hay extracto. El <description> del feed es un ancla y el nombre del
 *    medio, y el producto es titular, fuente y enlace, nunca el cuerpo.
 *  - No hay cola infinita. TOPE_ACTUALIDAD son quince por lista, decision del
 *    cliente del 12 de septiembre. En vez de pedir mas, el recorrido ENCADENA
 *    listas como capitulos: la ENTRADA elegida (un lugar, Mexico o
 *    Internacional), sus cinco rubros, y luego las otras dos secciones.
 *    Dentro de un capitulo el orden es el de Google y no se toca; entre
 *    capitulos, un titular ya mostrado no se repite.
 *
 *    Desde el 18 de septiembre de 2026 se puede empezar por un RUBRO en vez de
 *    por la seccion del lugar (`?t=`, lib/busqueda/entrada.ts). Hasta entonces
 *    los cinco rubros eran los capitulos 2 a 6 y solo se llegaba a ellos
 *    deslizando por encima de los quince titulares del capitulo local, que es
 *    otra manera de decir que no se podia pedir un tema. Reordena la cabeza y
 *    NO la alarga: la seccion del lugar pasa a segunda y sigue ahi.
 *
 * Mexico e Internacional son entradas y no solo cola desde el 14 de
 * septiembre de 2026, el mismo dia: como cola quedaban a setenta tarjetas de
 * distancia, y el cliente las pidio a la mano. Un rubro en una edicion es la
 * misma busqueda sin terminos de lugar (actualidad.ts::consultaDeRubro).
 *
 * El cruce entre capitulos va por titular plegado y no por URL, por la misma
 * razon que fusionar.ts: el redirector es distinto para la misma nota en cada
 * consulta.
 *
 * Son OCHO capitulos, escritos como tupla. Es lo que le permite a
 * use-capitulos.ts llamar a useActualidad un numero fijo de veces sin
 * condicion, con `null` en los que todavia no toca pedir.
 *
 * Desde el 24 de septiembre de 2026 hay rubros que NO son de la cadena, los
 * de la programacion del canal (rubros.ts::RUBROS_PROGRAMA). Elegir uno lo
 * pone PRIMERO y deja detras la cadena de siempre, entera y en su orden: es
 * la unica manera en que la cadena crece, y crece en uno.
 */

import { textoCaidos } from "./avisos";
import { esRubroCadena, NOMBRE_RUBRO, rotuloDeRubro, RUBROS_CADENA, TITULO_RUBRO, type Rubro, type RubroCadena } from "./rubros";
import type { Idioma, ResultadoExterno } from "./tipos";
import type { PedidoActualidad } from "./use-actualidad";
import { plegar } from "@/lib/dominio/formato";
import { NOMBRE_CORTO, NOMBRE_TODA_REGION, type ZonaRuta } from "@/lib/dominio/zonas";

/** Por donde empieza el recorrido: una zona, el corredor o una edicion. */
export type Entrada = ZonaRuta | "region" | "mexico" | "internacional";

export const esEdicion = (e: Entrada): e is "mexico" | "internacional" =>
  e === "mexico" || e === "internacional";

/** `local` es el capitulo de LUGAR de la cadena, sea la entrada o la cola:
 *  cada cadena tiene uno solo, asi que el id no se repite.
 *
 *  `comunicados` solo existe en la cadena de Tecate; `busqueda` no esta en
 *  ninguna cadena —la busqueda es un modo aparte del lector— y vive aqui solo
 *  para que sus tarjetas tengan un capitulo que no sea el de nadie mas. */
export type CapituloId = "local" | Rubro | "mexico" | "internacional" | "comunicados" | "busqueda";

export interface Capitulo {
  id: CapituloId;
  /** De donde salen sus titulares. `comunicados` no se pide a la fuente en
   *  vivo, sale del documento municipal, y por eso `pedido` es null ahi. */
  fuente: "actualidad" | "comunicados";
  pedido: PedidoActualidad | null;
  /** Nombre corto, para las frases: «Tijuana», «Seguridad», «México». */
  nombre: string;
  /** Cejilla de cada tarjeta: «Tijuana · ahora», «Seguridad · últimos dos días». */
  rotulo: string;
  /** Titulo de la tarjeta divisoria: «Seguridad en el corredor». */
  titulo: string;
  /** Clase de color de la cejilla. Solo la cejilla; lo demas va en tinta. */
  acento: string;
}

/**
 * OCHO capitulos, o NUEVE en Tecate, que suma los comunicados del
 * Ayuntamiento; uno mas en cada caso cuando se eligio un rubro de la
 * programacion. Union de tuplas y no `Capitulo[]`: con
 * `noUncheckedIndexedAccess` un arreglo suelto convierte cada `capitulos[n]`
 * de use-capitulos.ts en "posiblemente undefined".
 */
export type Capitulos =
  | readonly [Capitulo, Capitulo, Capitulo, Capitulo, Capitulo, Capitulo, Capitulo, Capitulo]
  | readonly [Capitulo, Capitulo, Capitulo, Capitulo, Capitulo, Capitulo, Capitulo, Capitulo, Capitulo]
  | readonly [Capitulo, Capitulo, Capitulo, Capitulo, Capitulo, Capitulo, Capitulo, Capitulo, Capitulo, Capitulo];

/**
 * El techo, no el total. Es lo que fija cuantas ranuras de datos se abren en
 * use-capitulos.ts, que por la regla de los hooks tiene que ser una constante.
 * El largo REAL de cada cadena es `capitulos.length`, y es lo que hay que
 * pasarle a `debeActivar`: leer una constante ahi fue lo que dejaba el noveno
 * capitulo sin pedirse nunca, sin error y con la tarjeta de carga girando.
 */
export const CAPITULOS_MAXIMO = 10;

/** Solo chart-1 tiene variante `-texto`; las demas pasan AA a 12px sobre
 *  #050505. Mexico e Internacional van en tinta: son ediciones, no temas. */
const ACENTO_RUBRO: Record<Rubro, string> = {
  clima: "text-chart-3",
  seguridad: "text-chart-4",
  deportes: "text-chart-2",
  politica: "text-chart-5",
  economia: "text-chart-6",
  // Siete colores para ocho rubros: se repiten, pero nunca entre vecinos de
  // la fila de temas, y el nombre va siempre al lado.
  espectaculos: "text-chart-6",
  turismo: "text-chart-2",
  ia: "text-chart-3",
};

interface Seccion {
  id: "local" | "mexico" | "internacional";
  donde: { ambito: "region" | "mexico" | "internacional" } | { zona: ZonaRuta };
  nombre: string;
  /** Como se dice «en ese lugar» en el titulo de un rubro. */
  en: string;
  titulo: string;
  acento: string;
}

function seccionDe(entrada: Entrada): Seccion {
  if (entrada === "mexico") {
    return { id: "mexico", donde: { ambito: "mexico" }, nombre: "México", en: "en México", titulo: "Lo que destaca ahora en México", acento: "text-tinta-dato" };
  }
  if (entrada === "internacional") {
    return { id: "internacional", donde: { ambito: "internacional" }, nombre: "Internacional", en: "en el mundo", titulo: "Lo que destaca ahora en el mundo", acento: "text-tinta-dato" };
  }
  // El corredor NO es «toda la región»: son sus dos polos, Tijuana y San
  // Diego, que es lo unico que trae `ambito: "region"` (ver actualidad.ts).
  // La cejilla decia «Tijuana y San Diego» mientras la barra decia «Toda la
  // región», o sea que la misma eleccion se llamaba de dos maneras y ninguna
  // era la otra. Se nombra por lo que es, en los dos sitios.
  if (entrada === "region") {
    return {
      id: "local",
      donde: { ambito: "region" },
      // El nombre de la barra (nombre-ahora.ts, zonas.ts::NOMBRE_TODA_REGION).
      nombre: NOMBRE_TODA_REGION,
      en: "en el corredor",
      titulo: "Lo que destaca ahora en el corredor",
      acento: "text-chart-1-texto",
    };
  }
  const lugar = NOMBRE_CORTO[entrada];
  return {
    id: "local",
    donde: { zona: entrada },
    nombre: lugar,
    en: `sobre ${lugar}`,
    titulo: `Lo que destaca ahora sobre ${lugar}`,
    acento: "text-chart-1-texto",
  };
}

const capituloDeSeccion = (sec: Seccion): Capitulo => ({
  id: sec.id,
  fuente: "actualidad",
  pedido: { ...sec.donde, rubro: null },
  nombre: sec.nombre,
  rotulo: `${sec.nombre} · ahora`,
  titulo: sec.titulo,
  acento: sec.acento,
});

/** Las otras dos secciones, en el orden en que siguen a la entrada: desde un
 *  lugar, Mexico y luego el mundo; desde una edicion, la otra edicion y luego
 *  el corredor, que es la casa del tablero. */
function colaDe(entrada: Entrada): [Seccion, Seccion] {
  if (entrada === "mexico") return [seccionDe("internacional"), seccionDe("region")];
  if (entrada === "internacional") return [seccionDe("mexico"), seccionDe("region")];
  return [seccionDe("mexico"), seccionDe("internacional")];
}

/** Los seis capitulos de cabeza: la seccion del lugar y sus cinco rubros. */
type Cabeza = readonly [Capitulo, Capitulo, Capitulo, Capitulo, Capitulo, Capitulo];

/**
 * El orden de la cabeza segun el rubro elegido: el elegido primero, la seccion
 * del lugar detras, y los otros cuatro en el orden de RUBROS.
 *
 * Es una tabla escrita a mano, y no un `filter`, porque `Cabeza` es una TUPLA.
 * Filtrar devuelve `Capitulo[]`, y con eso la cadena deja de ser de largo
 * conocido: se cae la union de `Capitulos`, y con ella la garantia de que
 * use-capitulos.ts tiene una ranura por capitulo. Indexar una tupla con un
 * literal si esta bien tipado —`noUncheckedIndexedAccess` no aplica ahi— asi
 * que esto no lleva ni una asercion.
 *
 * Que sea exhaustiva sobre `Rubro | null` es parte del trato: agregar un rubro
 * tiene que romper aqui en compilacion, igual que rompe en ACENTO_RUBRO.
 *
 * La seccion del lugar va SEGUNDA y no se pierde. Elegir un tema acota por
 * donde se empieza, no lo que hay: pasado el rubro el recorrido sigue con el
 * lugar y con los otros cuatro, como siempre.
 */
function cabezaDe(elegido: RubroCadena | null, t: Cabeza): Cabeza {
  switch (elegido) {
    case null: return [t[0], t[1], t[2], t[3], t[4], t[5]];
    case "politica": return [t[1], t[0], t[2], t[3], t[4], t[5]];
    case "seguridad": return [t[2], t[0], t[1], t[3], t[4], t[5]];
    case "economia": return [t[3], t[0], t[1], t[2], t[4], t[5]];
    case "clima": return [t[4], t[0], t[1], t[2], t[3], t[5]];
    case "deportes": return [t[5], t[0], t[1], t[2], t[3], t[4]];
  }
}

/**
 * La cadena de una entrada, opcionalmente empezando por un rubro.
 *
 * Sin rubro devuelve exactamente la cadena de siempre; el parametro por omision
 * es lo que deja intactas las cadenas ya fijadas en probar-capitulos.cjs. Con
 * rubro se REORDENA la cabeza, nunca se agrega ni se quita: la cadena sigue
 * midiendo ocho (nueve en Tecate).
 *
 * Un rubro de la programacion es lo unico que alarga: va delante de la cadena
 * sin tema, que sigue entera detras. No sustituye a nadie porque ninguno de
 * los de la cadena es menos que el: quitar Deportes para meter Turismo diria
 * que en ese recorrido no hay deportes.
 */
export function capitulosDe(entrada: Entrada, elegido: Rubro | null = null): Capitulos {
  const principal = seccionDe(entrada);
  const rubro = (r: Rubro): Capitulo => ({
    id: r,
    fuente: "actualidad",
    pedido: { ...principal.donde, rubro: r },
    nombre: NOMBRE_RUBRO[r],
    rotulo: `${NOMBRE_RUBRO[r]} · ${rotuloDeRubro(r, "ambito" in principal.donde ? principal.donde.ambito : "zona")}`,
    titulo: `${TITULO_RUBRO[r]} ${principal.en}`,
    acento: ACENTO_RUBRO[r],
  });
  const [politica, seguridad, economia, clima, deportes] = RUBROS_CADENA;
  const [segunda, tercera] = colaDe(entrada);
  const cabeza = cabezaDe(elegido !== null && esRubroCadena(elegido) ? elegido : null, [
    capituloDeSeccion(principal),
    rubro(politica),
    rubro(seguridad),
    rubro(economia),
    rubro(clima),
    rubro(deportes),
  ]);
  // Los comunicados van DESPUES de los rubros y antes de las otras ediciones:
  // siguen siendo de Tecate, pero son boletines publicados y no lo que esta
  // pasando, asi que no se adelantan a ningun titular reciente.
  const cola = [capituloDeSeccion(segunda), capituloDeSeccion(tercera)] as const;
  if (elegido === null || esRubroCadena(elegido)) {
    return entrada === "Tecate" ? [...cabeza, CAPITULO_COMUNICADOS, ...cola] : [...cabeza, ...cola];
  }
  const delante = rubro(elegido);
  return entrada === "Tecate"
    ? [delante, ...cabeza, CAPITULO_COMUNICADOS, ...cola]
    : [delante, ...cabeza, ...cola];
}

/**
 * Los boletines del Ayuntamiento de Tecate.
 *
 * Es el unico capitulo que no sale de la lectura en vivo: viene del documento
 * municipal, que es independiente de la prensa a proposito (ver
 * pulso/comunicados.py). Vivio en una seccion propia de la pagina del muro
 * hasta que el cliente quito esa pagina el 15 de septiembre de 2026, y entro
 * aqui para no perderse con ella.
 */
export const CAPITULO_COMUNICADOS: Capitulo = {
  id: "comunicados",
  fuente: "comunicados",
  pedido: null,
  nombre: "Comunicados",
  rotulo: "Gobierno de Tecate · comunicado",
  titulo: "Comunicados del Ayuntamiento",
  acento: "text-tinta-dato",
};

/** Lo que se sabe de un capitulo en un instante. `inactivo` es que aun no se
 *  pidio; `fallo` es fallo sin ningun titular. */
export type EstadoCapitulo =
  | { estado: "inactivo" }
  | { estado: "cargando" }
  | { estado: "fallo" }
  | {
      estado: "listo";
      resultados: readonly ResultadoExterno[];
      caidos: readonly Idioma[];
      truncada: boolean;
    };

export type Tarjeta =
  | {
      tipo: "divisor";
      capitulo: CapituloId;
      rotulo: string;
      titulo: string;
      acento: string;
      /** Titulares del capitulo ya sin repetidos: lo que sigue de verdad. */
      n: number;
      /** Como se llama uno: «titular», salvo en comunicados. */
      sustantivo: string;
      /** Y varios. Escrito y no armado con una «s»: «15 titulars» salio al
       *  aire el 25 de septiembre de 2026, que es lo que da «titular» + s. */
      plural: string;
      nota: string | null;
    }
  | { tipo: "hueco"; capitulo: CapituloId; rotulo: string; titulo: string; acento: string }
  | {
      tipo: "titular";
      capitulo: CapituloId;
      rotulo: string;
      acento: string;
      r: ResultadoExterno;
      /** Titular plegado. Llave de React: la URL del redirector rota. */
      clave: string;
      /** 1-based, solo sobre titulares: la n de «n de M». */
      orden: number;
    };

export interface Hilado {
  /** En orden; el indice es el data-indice de la tarjeta. */
  tarjetas: Tarjeta[];
  /** Cuantas tarjetas son titulares: la M de «n de M». */
  titulares: number;
  /** Capitulos que fallaron. Se dicen, no se esconden. */
  faltantes: CapituloId[];
  /** Capitulos sin titulares tras quitar repetidos. Se saltan sin divisor. */
  vacios: CapituloId[];
  /** Capitulos pidiendose ahora mismo. */
  enVuelo: number;
  /** Capitulos ya recorridos: asentados Y antes del corte. Un capitulo
   *  adelantado que llego antes que el anterior no cuenta todavia. */
  emitidos: number;
  /** Todos los de la cadena asentados (listo o fallo). */
  completo: boolean;
}

/**
 * Hila los capitulos en tarjetas.
 *
 * Se recorre en orden y se PARA en el primer capitulo que no asento, aunque
 * uno posterior ya haya llegado: el orden del recorrido no se negocia, y un
 * capitulo adelantado espera su turno. Un fallo deja una tarjeta que lo dice y
 * el recorrido sigue; un capitulo que se queda sin titulares al quitar los
 * repetidos no deja nada, ni divisor.
 */
export function hilar(capitulos: Capitulos, estados: readonly EstadoCapitulo[]): Hilado {
  const tarjetas: Tarjeta[] = [];
  const vistos = new Set<string>();
  const faltantes: CapituloId[] = [];
  const vacios: CapituloId[] = [];
  let titulares = 0;
  let enVuelo = 0;
  let asentados = 0;
  let emitidos = 0;
  let cortado = false;

  for (const [i, c] of capitulos.entries()) {
    const e = estados[i] ?? { estado: "inactivo" };
    if (e.estado === "cargando") enVuelo++;
    if (e.estado === "listo" || e.estado === "fallo") asentados++;
    if (cortado) continue;
    if (e.estado === "inactivo" || e.estado === "cargando") {
      cortado = true;
      continue;
    }
    emitidos++;
    if (e.estado === "fallo") {
      tarjetas.push({ tipo: "hueco", capitulo: c.id, rotulo: c.rotulo, titulo: c.titulo, acento: c.acento });
      faltantes.push(c.id);
      continue;
    }
    const propios: { r: ResultadoExterno; clave: string }[] = [];
    for (const r of e.resultados) {
      const clave = plegar(r.titulo);
      if (clave === "" || vistos.has(clave)) continue;
      vistos.add(clave);
      propios.push({ r, clave });
    }
    if (propios.length === 0) {
      vacios.push(c.id);
      continue;
    }
    // El primer capitulo con titulares no lleva divisor: el encabezado de la
    // pagina ya lo presenta. Los demas si, para que el cambio de tema se vea.
    if (titulares > 0) {
      const partes: string[] = [];
      const caidos = textoCaidos(e.caidos);
      if (caidos !== null) partes.push(caidos);
      // Sin numero: `n` cuenta DESPUES de quitar lo que otro capitulo ya
      // mostro y la lista trae los quince de antes, y el 25 de septiembre de
      // 2026 la tarjeta decia «14 titulares · Se muestran los primeros 15».
      if (e.truncada) partes.push("Hay más; se muestran los primeros.");
      tarjetas.push({
        tipo: "divisor",
        capitulo: c.id,
        rotulo: c.rotulo,
        titulo: c.titulo,
        acento: c.acento,
        n: propios.length,
        sustantivo: c.fuente === "comunicados" ? "comunicado" : "titular",
        plural: c.fuente === "comunicados" ? "comunicados" : "titulares",
        nota: partes.length === 0 ? null : partes.join(" "),
      });
    }
    for (const { r, clave } of propios) {
      titulares++;
      tarjetas.push({ tipo: "titular", capitulo: c.id, rotulo: c.rotulo, acento: c.acento, r, clave, orden: titulares });
    }
  }

  return { tarjetas, titulares, faltantes, vacios, enVuelo, emitidos, completo: asentados === capitulos.length };
}

/** Tarjetas antes del final a las que se pide el siguiente capitulo. Es el
 *  `rootMargin` de WikiTok, medido en tarjetas y no en pixeles. */
export const UMBRAL_ACTIVACION = 3;

/** Capitulos pedidos por delante de lo que se muestra: el que se lee y uno
 *  adelantado. Mas no adelanta nada al lector y si le pega ocho veces al
 *  servidor al abrir. Se cuenta contra `emitidos` y no contra `enVuelo`: un
 *  capitulo adelantado que responde ANTES que el anterior ya no esta en vuelo
 *  pero tampoco se muestra, y contarlo como libre pedia un tercero al abrir
 *  (visto el 14 de septiembre de 2026: clima llego antes que lo local). */
export const EN_VUELO_MAXIMO = 2;

export function debeActivar(h: Hilado, actual: number, activados: number, total: number): boolean {
  return (
    activados < total &&
    activados - h.emitidos < EN_VUELO_MAXIMO &&
    actual >= h.tarjetas.length - 1 - UMBRAL_ACTIVACION
  );
}

const nombres = (capitulos: Capitulos, ids: readonly CapituloId[]): string =>
  ids.map((id) => capitulos.find((c) => c.id === id)?.nombre ?? id).join(", ");

/** La tarjeta final: cuanto se recorrio y que falto, sin mecanismo. */
export function fraseFinal(capitulos: Capitulos, h: Hilado): string {
  const partes = [
    h.titulares === 1 ? "Un titular en este recorrido." : `${h.titulares} titulares en este recorrido.`,
  ];
  if (h.faltantes.length > 0) partes.push(`No se pudo traer: ${nombres(capitulos, h.faltantes)}.`);
  if (h.vacios.length > 0) partes.push(`Sin titulares nuevos en: ${nombres(capitulos, h.vacios)}.`);
  return partes.join(" ");
}
