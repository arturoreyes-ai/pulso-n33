import { leerDatoPublicado, type LeerDatos } from "@/lib/datos/publicado";
import type {
  ComentarioPublicado,
  Destacado,
  DestacadoConsulta,
  DocRedes,
  DocRedesComentarios,
  DocRoster,
  DocTendencias,
  MedioPrensaConsulta,
  PrensaConsulta,
  ResultadoPrensaConsulta,
  TonoPrensaConsulta,
  TonoTitular,
} from "@/lib/datos/tipos";
import { plegar } from "@/lib/dominio/formato";
import type { PiezasTermino, RedTermino, TonoPie } from "@/lib/dominio/termino-vivo";
import { redesEnVivoHabilitadas } from "@/lib/redes-en-vivo/config";
import { servicioTono, type ServicioTono } from "@/lib/tono/servicio";
import { archivoPublicado, delArchivo, type LeerArchivo } from "./archivo";
import { esEnlaceOpaco } from "./enlaces";
import { ANTERIORES_MAXIMO, buscarEnMedios, nombra, robotsCon, type Robotero } from "./buscadores";
import { catalogoCon, type CatalogoBusqueda, type LeerCatalogo } from "./catalogo";
import { desdeVentana } from "./buscar";
import { nombraFigura } from "./figura";
import { traerFeed, urlDeFeed } from "./google-noticias";
import { SIN_CACHE, json } from "./respuesta";
import { TOPE_RESULTADOS, VENTANA_PRENSA_DIAS, type ResultadoExterno } from "./tipos";
import { validarConsulta } from "./validar";

/**
 * /api/termino: la mitad GRATUITA de la busqueda de un termino en Redes.
 *
 * El caso, del 23 de septiembre de 2026: la lupa de Redes solo sabia de los
 * tres terminos de config/consultas.json; cualquier otro filtraba lo que ya
 * estaba en pantalla y nada mas. Ahora responde, para cualquier termino, con
 * lo mismo que la ficha de un termino en seguimiento, de las fuentes que no
 * cuestan:
 *
 *  - Prensa de seis meses: Google Noticias con la frase entre comillas (como
 *    pulso/consultas.py::prensa), el buscador propio de los medios y el
 *    archivo del pipeline. Lo del medio va primero, como en el pipeline: un
 *    titular repetido se queda con el enlace del medio.
 *  - Lo que el panel de redes YA cosecho —Instagram, TikTok, YouTube— y
 *    nombra el termino en su pie, con el texto de sus comentarios.
 *  - Las tendencias de X que lo nombran: el ranking de X, nunca un tuit.
 *
 * El tono lo pone el MISMO modelo del pipeline (lib/tono/servicio.ts), en el
 * idioma que DECLARA cada fila, salvo en las notas del archivo, que ya traen
 * el suyo del pipeline y no se vuelven a etiquetar. Si el termino nombra a una
 * figura del roster, no se pide ningun tono (figura.ts).
 *
 * La respuesta lleva texto de comentarios, asi que nunca va al CDN: `private`.
 */

export interface DependenciasTermino {
  solicitar?: typeof fetch;
  leer?: LeerDatos;
  leerArchivo?: LeerArchivo;
  leerCatalogo?: LeerCatalogo;
  robots?: Robotero;
  tono?: ServicioTono;
  ahora?: () => Date;
  redesEnVivo?: () => boolean;
}

export interface TendenciaTermino {
  lugar: string;
  puesto: number;
  nombre: string;
  url: string;
}

export interface RespuestaTermino {
  consulta: string;
  piezas: PiezasTermino;
  textos: DocRedesComentarios;
  tendencias: TendenciaTermino[];
  /** Si el boton de la busqueda pagada se puede ofrecer. */
  redesEnVivo: boolean;
}

/** Lo que vive en `plataforma` de cada archivo del panel de redes. */
const ARCHIVOS: readonly { red: RedTermino; doc: string; textos: string | null }[] = [
  { red: "instagram", doc: "redes.json", textos: "redes-comentarios.json" },
  { red: "tiktok", doc: "tiktok.json", textos: "tiktok-comentarios.json" },
  { red: "youtube", doc: "youtube.json", textos: null },
];

/** Espejo de pulso/sentimiento.py::MODELO, el unico que atiende el servicio. */
const MODELO_TONO = "pysentimiento/robertuito-sentiment-analysis";

const TONO_DE: Record<string, TonoTitular> = { favorable: "favorable", adversa: "adversa", neutral: "neutral" };

/** La frase del termino entre comillas, sin las que la persona haya puesto:
 *  Google empareja la frase y no palabra por palabra. */
export function fraseDe(termino: string): string {
  return `"${termino.replace(/"/g, " ").replace(/\s+/g, " ").trim()}"`;
}

function aPrensa(r: ResultadoExterno, tono: TonoTitular | null): ResultadoPrensaConsulta | null {
  const fecha = r.publicado?.slice(0, 10) ?? null;
  if (fecha === null) return null;
  return {
    titulo: r.titulo,
    url: r.url,
    dominio: r.dominio,
    fuente: r.medio,
    fecha,
    // El pipeline distingue por el camino; aqui manda el enlace: una nota del
    // archivo que llego por Google trae el token opaco, no el del medio.
    origen: esEnlaceOpaco(r.url) ? "noticias" : "medio",
    tono,
  };
}

function contarTono(filas: readonly ResultadoPrensaConsulta[], sinModelo: number, metodo: "modelo" | "ninguno", modelo: string | null): TonoPrensaConsulta {
  const n = (t: TonoTitular) => filas.filter((r) => r.tono === t).length;
  const favorable = n("favorable");
  const adversa = n("adversa");
  const neutral = n("neutral");
  return {
    favorable, adversa, neutral,
    sin_modelo_idioma: sinModelo,
    sin_clasificar: filas.length - favorable - adversa - neutral - sinModelo,
    titulares: filas.length,
    metodo, modelo,
  };
}

function porMedio(filas: readonly ResultadoPrensaConsulta[]): MedioPrensaConsulta[] {
  const por = new Map<string, MedioPrensaConsulta>();
  for (const r of filas) {
    const m = por.get(r.fuente) ?? { fuente: r.fuente, dominio: r.dominio, titulares: 0, favorable: 0, adversa: 0, neutral: 0 };
    m.titulares += 1;
    if (r.tono !== null) m[r.tono] += 1;
    por.set(r.fuente, m);
  }
  return [...por.values()].sort((a, b) => b.titulares - a.titulares || a.fuente.localeCompare(b.fuente));
}

/** El idioma declarado de un titular de Google: el del medio si esta en el
 *  catalogo, si no el de la edicion que se pidio (espanol). Es la regla de
 *  pulso/consultas.py::prensa, no una adivinanza sobre el texto. */
function idiomaDeGoogle(r: ResultadoExterno, catalogo: CatalogoBusqueda | null): "es" | "en" {
  return catalogo?.medios.find((m) => m.dominio === r.dominio)?.idioma ?? r.idioma;
}

async function prensaDe(
  termino: string,
  figura: boolean,
  catalogo: CatalogoBusqueda | null,
  d: Required<Pick<DependenciasTermino, "solicitar" | "leerArchivo" | "robots" | "tono">>,
  desde: string,
): Promise<{ prensa: PrensaConsulta; completa: boolean }> {
  const [google, medios, indices] = await Promise.all([
    traerFeed(urlDeFeed(`${fraseDe(termino)} when:${VENTANA_PRENSA_DIAS}d`, "es"), "es", TOPE_RESULTADOS, d.solicitar),
    catalogo === null ? Promise.resolve([]) : buscarEnMedios(catalogo.buscadores, termino, desde, d.solicitar, d.robots),
    d.leerArchivo(),
  ]);
  // Sin filtro por titular, como pulso/consultas.py::prensa: la frase entre
  // comillas ya es la consulta, y Google empareja el cuerpo que aqui no se
  // lee. Filtrar aqui y no alla haria que un mismo termino contara distinto
  // en seguimiento y en vivo. Los buscadores de los medios si filtran, porque
  // van sin comillas (buscadores.ts).
  const deGoogle = google.resultados.map((r) => ({ ...r, idioma: idiomaDeGoogle(r, catalogo) }));
  const deArchivo = delArchivo(indices, termino, catalogo, { zona: null, desde, tope: TOPE_RESULTADOS });

  // Lo del medio primero; despues Google; despues el archivo, que ya trae tono.
  const vistos = new Set<string>();
  const unicos = <T extends { fila: ResultadoExterno }>(lista: T[]): T[] => lista.filter(({ fila }) => {
    const clave = plegar(fila.titulo);
    if (clave === "" || vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
  const propias = unicos(medios.flatMap((m) => m.resultados).map((fila) => ({ fila, tono: null as TonoTitular | null })));
  const google2 = unicos(deGoogle.map((fila) => ({ fila, tono: null as TonoTitular | null })));
  const archivo = unicos(deArchivo.map((c) => ({ fila: c.fila, tono: figura ? null : c.tono === null ? null : TONO_DE[c.tono] ?? null })));
  const vistosViejos = new Set<string>();
  const viejas = medios.flatMap((m) => m.anteriores)
    .filter((fila) => {
      const clave = plegar(fila.titulo);
      if (vistosViejos.has(clave)) return false;
      vistosViejos.add(clave);
      return true;
    })
    .sort((a, b) => (b.publicado ?? "").localeCompare(a.publicado ?? ""))
    .slice(0, ANTERIORES_MAXIMO)
    .map((fila) => ({ fila, tono: null as TonoTitular | null }));

  // Un solo paso por el modelo, solo lo que se declara en espanol y no trae
  // tono todavia. Lo demas: `sin_modelo_idioma` si es de otro idioma.
  const porEtiquetar = [...propias, ...google2, ...viejas].filter((x) => x.fila.idioma === "es");
  let metodo: "modelo" | "ninguno" = "ninguno";
  let modelo: string | null = null;
  if (!figura && porEtiquetar.length > 0) {
    const etiquetas = await d.tono.etiquetar(porEtiquetar.map((x) => x.fila.titulo), "prensa", "es");
    if (etiquetas !== null) {
      metodo = "modelo";
      modelo = MODELO_TONO;
      porEtiquetar.forEach((x, i) => { x.tono = etiquetas[i] === undefined ? null : TONO_DE[etiquetas[i] ?? ""] ?? null; });
    }
  }
  const ventana = [...propias, ...google2, ...archivo];
  const resultados = ventana
    .map((x) => aPrensa(x.fila, x.tono))
    .filter((r): r is ResultadoPrensaConsulta => r !== null)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.titulo.localeCompare(b.titulo) || a.url.localeCompare(b.url));
  const sinModelo = ventana.filter((x) => x.fila.idioma !== "es" && x.tono === null && aPrensa(x.fila, null) !== null).length;
  const anteriores = viejas.map((x) => aPrensa(x.fila, x.tono)).filter((r): r is ResultadoPrensaConsulta => r !== null);

  // Las notas del archivo ya traen tono del mismo modelo: si alguna lo trae,
  // la serie esta etiquetada aunque esta peticion no haya pedido nada.
  if (resultados.some((r) => r.tono !== null)) {
    metodo = "modelo";
    modelo = MODELO_TONO;
  }

  const buscadores = [
    { id: "noticias", nombre: "buscador de noticias", estado: google.salud.estado, titulares: deGoogle.length, anteriores: 0 },
    ...medios.map((m) => ({ id: m.salud.id, nombre: m.salud.nombre, estado: m.salud.estado, titulares: m.salud.titulares, anteriores: m.salud.anteriores })),
  ];
  const algo = google.salud.estado === "ok" || medios.some((m) => m.salud.estado === "ok") || indices !== null;
  if (!algo) return { prensa: { estado: "fallo", razon: "No se pudo leer la prensa esta vez." }, completa: false };
  return {
    prensa: {
      estado: "ok",
      ventana_dias: VENTANA_PRENSA_DIAS,
      resultados,
      anteriores,
      tono: contarTono(resultados, sinModelo, metodo, modelo),
      por_medio: porMedio(resultados),
      buscadores,
    },
    completa: google.salud.estado === "ok" && medios.every((m) => m.salud.estado !== "fallo") && indices !== null
      && (figura || porEtiquetar.length === 0 || metodo === "modelo"),
  };
}

/** Lo que el panel de redes ya cosecho y nombra el termino en su pie. */
async function cosechadoDe(
  termino: string,
  leer: LeerDatos,
): Promise<{ redes: PiezasTermino["redes"]; porPost: Record<string, ComentarioPublicado[]>; visibles: number; maximo: number }> {
  const redes: PiezasTermino["redes"] = {};
  const porPost: Record<string, ComentarioPublicado[]> = {};
  let visibles = 5;
  let maximo = 10;
  for (const a of ARCHIVOS) {
    const doc = (await leer(a.doc)) as DocRedes | null;
    if (doc === null || !Array.isArray(doc.destacados)) continue;
    const nombres = new Map((doc.cuentas ?? []).map((c) => [c.cuenta, c.nombre]));
    const textos = a.textos === null ? null : ((await leer(a.textos)) as DocRedesComentarios | null);
    if (textos !== null) {
      visibles = textos.visibles;
      maximo = textos.maximo;
    }
    const propios: DestacadoConsulta[] = [];
    for (const d of doc.destacados as Destacado[]) {
      if (!nombra(d.titulo, termino)) continue;
      propios.push({
        ...d,
        origen: a.red === "tiktok" ? "busqueda" : "cuenta",
        fuente: a.red === "tiktok" ? (d.creador ?? "") : (nombres.get(d.cuenta) ?? d.cuenta),
      });
      const lista = textos?.por_post[d.url];
      if (lista !== undefined) porPost[d.url] = lista;
    }
    redes[a.red] = propios;
  }
  return { redes, porPost, visibles, maximo };
}

/** El tono del pie de cada publicacion, en el idioma que declara su fila. */
export async function tonoDePies(
  destacados: readonly Destacado[],
  idiomaDe: (cuenta: string) => "es" | "en",
  tono: ServicioTono,
  figura: boolean,
): Promise<{ pies: Record<string, TonoPie>; metodo: "modelo" | "ninguno" }> {
  const pies: Record<string, TonoPie> = {};
  const propios = destacados.filter((d) => {
    if (idiomaDe(d.cuenta) === "es") return true;
    pies[d.url] = "sin_modelo_idioma";
    return false;
  });
  if (figura || propios.length === 0) {
    for (const d of propios) pies[d.url] = "sin_clasificar";
    return { pies, metodo: "ninguno" };
  }
  const etiquetas = await tono.etiquetar(propios.map((d) => d.titulo), "comentarios", "es");
  propios.forEach((d, i) => {
    const e = etiquetas?.[i];
    pies[d.url] = e === "positivo" || e === "negativo" || e === "neutral" ? e : "sin_clasificar";
  });
  return { pies, metodo: etiquetas === null ? "ninguno" : "modelo" };
}

function tendenciasDe(termino: string, doc: DocTendencias | null): TendenciaTermino[] {
  if (doc === null) return [];
  const aguja = plegar(termino).replace(/^#/, "");
  const salida: TendenciaTermino[] = [];
  for (const u of doc.ubicaciones ?? []) {
    if (u.estado !== "ok") continue;
    for (const t of u.tendencias) {
      const nombre = plegar(t.nombre).replace(/^#/, "");
      if (aguja.length < 3 || nombre === "") continue;
      if (nombre.includes(aguja) || aguja.replace(/\s+/g, "").includes(nombre.replace(/\s+/g, ""))) {
        salida.push({ lugar: u.nombre, puesto: t.puesto, nombre: t.nombre, url: t.url });
      }
    }
  }
  return salida.sort((a, b) => a.puesto - b.puesto || a.lugar.localeCompare(b.lugar));
}

export async function responderTermino(q: string | null, dependencias: DependenciasTermino = {}): Promise<Response> {
  const veredicto = validarConsulta(q);
  if (!veredicto.ok) return json(veredicto.error, 400, SIN_CACHE);
  const termino = veredicto.q;
  const solicitar = dependencias.solicitar ?? fetch;
  const leer = dependencias.leer ?? leerDatoPublicado;
  const d = {
    solicitar,
    leerArchivo: dependencias.leerArchivo ?? archivoPublicado,
    robots: dependencias.robots ?? robotsCon(solicitar),
    tono: dependencias.tono ?? servicioTono(),
  };
  const ahora = (dependencias.ahora ?? (() => new Date()))();
  const desde = desdeVentana(ahora);

  const [catalogo, roster, tendencias] = await Promise.all([
    (dependencias.leerCatalogo ?? catalogoCon(leer))(),
    leer("roster.json") as Promise<DocRoster | null>,
    leer("tendencias.json") as Promise<DocTendencias | null>,
  ]);
  // Sin roster no se puede saber si el termino es una figura, y la duda se
  // resuelve hacia no mostrar tono: la regla 5 no se apuesta.
  const figura = roster === null || nombraFigura(termino, roster);

  // Lo cosechado y su tono NO esperan a la prensa: medido el 23 de septiembre
  // de 2026, la prensa tarda lo que tarde el buscador de Zeta (~10 s) mas el
  // tono de ~100 titulares (~9 s), y en serie la ficha tardaba 32 s.
  const idiomas = new Map((catalogo?.cuentas ?? []).map((c) => [c.id, c.idioma]));
  const [{ prensa, completa }, { cosechado, todos, pies, metodo }] = await Promise.all([
    prensaDe(termino, figura, catalogo, d, desde),
    cosechadoDe(termino, leer).then(async (cosechado) => {
      const todos = Object.values(cosechado.redes).flat();
      return { cosechado, todos, ...(await tonoDePies(todos, (cuenta) => idiomas.get(cuenta) ?? "es", d.tono, figura)) };
    }),
  ]);

  const generado = ahora.toISOString();
  // Los comentarios cosechados ya traen su tono del pipeline, con el mismo
  // modelo; lo que etiqueta esta ruta son los pies y los titulares.
  const conModelo = metodo === "modelo" || prensa.tono?.metodo === "modelo"
    || todos.some((x) => x.sentimiento.positivo + x.sentimiento.negativo + x.sentimiento.neutral > 0);
  const cuerpo: RespuestaTermino = {
    consulta: termino,
    piezas: {
      termino,
      generado,
      figura,
      prensa,
      redes: cosechado.redes,
      salud: [],
      pies,
      metodo: conModelo ? "modelo" : "ninguno",
      modelo: conModelo ? MODELO_TONO : null,
    },
    textos: {
      esquema: 1,
      generado,
      plataforma: "consultas",
      retencion_dias: 30,
      visibles: cosechado.visibles,
      maximo: cosechado.maximo,
      por_post: cosechado.porPost,
    },
    tendencias: tendenciasDe(termino, tendencias),
    redesEnVivo: (dependencias.redesEnVivo ?? redesEnVivoHabilitadas)(),
  };
  // Privada siempre: lleva texto de comentarios. Cinco minutos en el
  // navegador solo si todo respondio, para no clavar una falla.
  return json(cuerpo, 200, completa ? "private, max-age=300" : SIN_CACHE);
}
