/**
 * Las herramientas que leen lo que el tablero ensena, sin costo: noticias,
 * redes, X, garitas, reportes de terminos, expedientes, el seguimiento, el
 * gasto electoral y los usuarios. Cada una llama a la funcion de la ruta del
 * sitio o lee el mismo archivo publicado; lo que se recorta es solo para
 * caber en una respuesta de Claude (~150,000 caracteres).
 */

import { listarUsuarios } from "@/lib/acceso/usuarios";
import { sql } from "@/lib/acceso/bd";
import { responderActualidad } from "@/lib/busqueda/actualidad";
import { responderBusqueda } from "@/lib/busqueda/buscar";
import { responderRelacionadas } from "@/lib/busqueda/relacionadas-viva";
import { RUBROS, type Rubro } from "@/lib/busqueda/rubros";
import { publicacionNombraRubro } from "@/lib/busqueda/tema-publicacion";
import { responderTermino } from "@/lib/busqueda/termino";
import { leerDatoPublicado } from "@/lib/datos/publicado";
import type { DocRedes, DocRedesComentarios } from "@/lib/datos/tipos";
import {
  canonizarPublicacion, ordenarPublicaciones, reunirPublicaciones,
  type CubetaRegion, type DocsRedes, type RedVisual,
} from "@/lib/dominio/publicaciones";
import { SLUGS, zonaDeSlug } from "@/lib/dominio/zonas";
import { EXPEDIENTES, expedientePorId } from "@/lib/expedientes/expedientes";
import { responderGaritas } from "@/lib/garitas/cbp";
import { responderEstado } from "@/lib/redes-en-vivo/responder";
import { responderFicha, responderLista } from "@/lib/seguimiento/responder";
import { entero, ErrorDeAccion, LECTURA, leerRespuesta, objeto, requerido, texto, type Herramienta } from "./comun";

const LUGARES = ["region", "mexico", "internacional", ...SLUGS];
const LUGAR = { type: "string", enum: LUGARES, description: "«region» (todo el corredor), «mexico», «internacional» o un municipio." };
const TEMA = { type: "string", enum: [...RUBROS], description: "Un tema: política, seguridad, economía, clima, deportes, espectáculos, turismo o IA." };
const REDES: RedVisual[] = ["tiktok", "instagram", "facebook", "youtube"];
const ARCHIVO_RED: Record<RedVisual, string> = { instagram: "redes.json", tiktok: "tiktok.json", facebook: "facebook.json", youtube: "youtube.json" };
const COMENTARIOS_RED: Partial<Record<RedVisual, string>> = {
  instagram: "redes-comentarios.json", tiktok: "tiktok-comentarios.json", facebook: "facebook-comentarios.json",
};

/** Lo que Claude necesita de una nota en vivo para leerla o mandarla a
 *  analizar_nota / detallar_nota. */
function nota(r: Record<string, unknown>) {
  const ref = r.referencia as { url?: string; dominio?: string } | null | undefined;
  return {
    titulo: r.titulo, medio: r.medio, publicado: r.publicado, url: r.url,
    analizable: ref ? { url: ref.url, dominio: ref.dominio, medio: r.medio } : null,
  };
}

function notas(datos: unknown) {
  const o = datos as { resultados?: Record<string, unknown>[] } & Record<string, unknown>;
  const { resultados, ...resto } = o;
  return { ...resto, resultados: (resultados ?? []).map(nota) };
}

function dondeDe(lugar: string | null): { a: string | null; z: string | null } {
  if (lugar === null || lugar === "region") return { a: lugar === "region" ? "region" : null, z: null };
  if (lugar === "mexico" || lugar === "internacional") return { a: lugar, z: null };
  if (zonaDeSlug(lugar) === null) throw new ErrorDeAccion(`Lugar desconocido: ${lugar}. Usa uno de: ${LUGARES.join(", ")}.`);
  return { a: null, z: lugar };
}

async function costosDeSeguimiento(id: string) {
  const filas = (await sql()`
    SELECT a.creado_en, a.estado, g.tope_usd::float8 AS reservado, g.usd::float8 AS cobrado, g.terminado_en
      FROM seguimiento_actualizaciones a JOIN gasto_seguimiento g ON g.id = a.gasto_id
     WHERE a.seguimiento_id = ${id}::uuid ORDER BY a.creado_en DESC`) as {
    creado_en: string; estado: string; reservado: number; cobrado: number; terminado_en: string | null;
  }[];
  return filas.map((f) => ({
    cuando: f.creado_en, estado: f.estado,
    usd: f.terminado_en === null ? f.reservado : f.cobrado,
    medida: f.terminado_en === null ? "reservado (aún en curso)" : "cobrado",
  }));
}

export { costosDeSeguimiento };

export const HERRAMIENTAS_LECTURA: Herramienta[] = [
  {
    name: "noticias_en_tendencia",
    title: "Noticias en tendencia",
    description: "Los titulares en vivo de la portada «En Tendencia» para un lugar y, opcionalmente, un tema. Cada nota trae «analizable», lo que piden analizar_nota y detallar_nota. Sin costo.",
    inputSchema: objeto({ lugar: LUGAR, tema: TEMA }),
    annotations: LECTURA,
    correr: async (a) => {
      const { a: ambito, z } = dondeDe(texto(a, "lugar"));
      return notas(await leerRespuesta(await responderActualidad({ a: ambito, z, t: texto(a, "tema") })));
    },
  },
  {
    name: "buscar_noticias",
    title: "Buscar noticias",
    description: "Busca un término en las noticias en vivo, los buscadores de los medios del corredor y el archivo del tablero. Sin costo.",
    inputSchema: objeto({ q: { type: "string", description: "Lo que se busca." }, lugar: LUGAR }, ["q"]),
    annotations: LECTURA,
    correr: async (a) => {
      const { a: ambito, z } = dondeDe(texto(a, "lugar"));
      return notas(await leerRespuesta(await responderBusqueda({ q: requerido(a, "q"), a: ambito, z, actualizar: false })));
    },
  },
  {
    name: "notas_relacionadas",
    title: "Notas relacionadas",
    description: "Notas del archivo que comparten palabras poco comunes con un titular. Es una sugerencia por palabras, no «la cobertura del tema». Sin costo.",
    inputSchema: objeto({ titular: { type: "string" } }, ["titular"]),
    annotations: LECTURA,
    correr: async (a) => leerRespuesta(await responderRelacionadas({ t: requerido(a, "titular") })),
  },
  {
    name: "publicaciones_en_redes",
    title: "Publicaciones en redes",
    description: "Las publicaciones destacadas de TikTok, Instagram, Facebook y YouTube que muestra «Redes», con sus cifras al momento de la última cosecha. Filtra por red, lugar y tema; «populares» o «recientes». Sin costo.",
    inputSchema: objeto({
      red: { type: "string", enum: ["todas", ...REDES] },
      lugar: LUGAR,
      tema: TEMA,
      orden: { type: "string", enum: ["populares", "recientes"] },
      limite: { type: "integer", minimum: 1, maximum: 60, description: "20 si falta." },
    }),
    annotations: LECTURA,
    correr: async (a) => {
      const docs: DocsRedes = {};
      const generado: Record<string, string> = {};
      await Promise.all(REDES.map(async (red) => {
        const d = (await leerDatoPublicado(ARCHIVO_RED[red])) as DocRedes | null;
        if (d) {
          docs[red] = d;
          generado[red] = d.generado;
        }
      }));
      const lugar = texto(a, "lugar");
      const cubeta: CubetaRegion = lugar === "mexico" ? "mexico" : lugar === "internacional" ? "mundo" : "corredor";
      const zona = lugar && lugar !== "region" && cubeta === "corredor" ? zonaDeSlug(lugar) : null;
      const tema = texto(a, "tema") as Rubro | null;
      const filas = reunirPublicaciones(docs, zona, cubeta, tema ? (p) => publicacionNombraRubro(p, tema) : null);
      const red = texto(a, "red");
      const orden = texto(a, "orden") === "recientes" ? "recientes" : "populares";
      const elegidas = ordenarPublicaciones(filas.filter((f) => !red || red === "todas" || f.red === red), orden)
        .slice(0, entero(a, "limite", 20, 60));
      return {
        cosechado: generado,
        publicaciones: elegidas.map(({ post, red: r, url, fuente }) => ({
          red: r, fuente, titulo: post.titulo, url: url ?? post.url, zona: post.zona,
          publicado: post.publicado ?? post.fecha, likes: post.likes, comentarios: post.comentarios,
          reproducciones: post.reproducciones,
        })),
      };
    },
  },
  {
    name: "comentarios_de_publicacion",
    title: "Comentarios de una publicación",
    description: "Los comentarios más votados que el tablero cosechó de una publicación de Instagram, TikTok o Facebook (sin el nombre de quien comentó). Sin costo.",
    inputSchema: objeto({ url: { type: "string", description: "La URL de la publicación." } }, ["url"]),
    annotations: LECTURA,
    correr: async (a) => {
      const url = requerido(a, "url");
      for (const [red, archivo] of Object.entries(COMENTARIOS_RED) as [RedVisual, string][]) {
        const doc = (await leerDatoPublicado(archivo)) as DocRedesComentarios | null;
        const clave = canonizarPublicacion(url, red) ?? url;
        const lista = doc?.por_post[clave] ?? doc?.por_post[url];
        if (lista) return { red, comentarios: lista.map(({ texto: t, likes, fecha }) => ({ texto: t, likes, fecha })) };
      }
      return { comentarios: [], nota: "El tablero no tiene comentarios cosechados de esa publicación." };
    },
  },
  {
    name: "tendencias_en_x",
    title: "Tendencias en X",
    description: "Lo que es tendencia en X en Tijuana, Mexicali, San Diego, México y el mundo, con el puesto que da X. Es el ranking de X, no una medida de la ciudad. Sin costo.",
    inputSchema: objeto({ lugar: { type: "string", description: "Opcional: el nombre o id de una ubicación." } }),
    annotations: LECTURA,
    correr: async (a) => {
      const d = (await leerDatoPublicado("tendencias.json")) as { generado: string; ubicaciones: Record<string, unknown>[] } | null;
      if (!d) throw new ErrorDeAccion("Las tendencias no están disponibles.");
      const lugar = texto(a, "lugar")?.toLowerCase() ?? null;
      const ubicaciones = d.ubicaciones
        .filter((u) => u.activa !== false)
        .filter((u) => !lugar || String(u.id).toLowerCase() === lugar || String(u.nombre).toLowerCase().includes(lugar))
        .map((u) => ({ id: u.id, nombre: u.nombre, corte: u.corte, tendencias: u.tendencias }));
      return { generado: d.generado, ubicaciones };
    },
  },
  {
    name: "garitas",
    title: "Tiempos de espera en las garitas",
    description: "Los tiempos de espera de CBP en San Ysidro y Otay Mesa, por carril, con la hora del reporte. Sin costo.",
    inputSchema: objeto({}),
    annotations: LECTURA,
    correr: async () => leerRespuesta(await responderGaritas()),
  },
  {
    name: "buscar_termino",
    title: "Qué se dice de un término",
    description: "La parte gratuita de buscar un término: seis meses de titulares que lo nombran con su tono, las publicaciones ya cosechadas que lo nombran con sus comentarios, y las tendencias de X. Sin costo (la búsqueda pagada en redes es busqueda_en_vivo_en_redes).",
    inputSchema: objeto({ q: { type: "string" } }, ["q"]),
    annotations: LECTURA,
    correr: async (a) => leerRespuesta(await responderTermino(requerido(a, "q"))),
  },
  {
    name: "reportes_de_terminos",
    title: "Reportes de términos seguidos",
    description: "Los términos que el tablero sigue en /reportes (marcas y personas), con su prensa, publicaciones, tono y comentarios. Sin «id», la lista; con «id», el reporte completo. Sin costo.",
    inputSchema: objeto({ id: { type: "string" } }),
    annotations: LECTURA,
    correr: async (a) => {
      const d = (await leerDatoPublicado("consultas.json")) as { generado: string; consultas: Record<string, unknown>[] } | null;
      if (!d) throw new ErrorDeAccion("Los reportes no están disponibles.");
      const id = texto(a, "id");
      if (id === null) return { generado: d.generado, terminos: d.consultas.map((c) => ({ id: c.id, termino: c.termino, tipo: c.tipo })) };
      const c = d.consultas.find((x) => x.id === id);
      if (!c) throw new ErrorDeAccion(`No hay un reporte con id «${id}».`);
      // El archivo de texto va por URL de publicacion, no por termino: se
      // toman las de las publicaciones que este reporte nombra.
      const textos = (await leerDatoPublicado("consultas-comentarios.json")) as DocRedesComentarios | null;
      const propio = JSON.stringify(c);
      const comentarios = Object.fromEntries(Object.entries(textos?.por_post ?? {})
        .filter(([url]) => propio.includes(url))
        .map(([url, lista]) => [url, lista.map(({ texto: t, likes, fecha }) => ({ texto: t, likes, fecha }))]));
      return { generado: d.generado, reporte: c, comentarios };
    },
  },
  {
    name: "expedientes",
    title: "Expedientes",
    description: "Los expedientes fijos de /reportes (por ejemplo, el año de una figura pública en prensa y redes). Sin «id», la lista; con «id», sus historias, meses y lo más visto en redes. Sin costo.",
    inputSchema: objeto({ id: { type: "string" } }),
    annotations: LECTURA,
    correr: async (a, ctx) => {
      const id = texto(a, "id");
      if (id === null) return { expedientes: EXPEDIENTES.map((e) => ({ id: e.id, persona: e.persona, cargo: e.cargo, desde: e.desde, hasta: e.hasta })) };
      const e = expedientePorId(id);
      if (!e) throw new ErrorDeAccion(`No hay un expediente con id «${id}».`);
      const { historias, ...resto } = e as unknown as { historias: Record<string, unknown>[] } & Record<string, unknown>;
      return {
        ...resto,
        // El cuerpo y la lista de titulares de cada historia no caben enteros.
        historias: historias.map(({ cuerpo: _c, titulares, ...h }) => ({ ...h, titulares: Array.isArray(titulares) ? titulares.length : titulares })),
        // Se abre en el navegador con la sesion del tablero; Claude no la tiene.
        pdf_en_el_navegador: `${ctx.origen}/api/expediente?e=${encodeURIComponent(id)}`,
      };
    },
  },
  {
    name: "publicaciones_seguidas",
    title: "Publicaciones seguidas",
    description: "La lista del equipo en /seguimiento: cada publicación seguida con su última lectura. Sin costo.",
    inputSchema: objeto({}),
    annotations: LECTURA,
    correr: async (_a, c) => leerRespuesta(await responderLista({ usuario: async () => ({ id: c.usuarioId }) })),
  },
  {
    name: "ficha_de_seguimiento",
    title: "Ficha de una publicación seguida",
    description: "Una publicación seguida: sus cifras en cada lectura, el tono de sus comentarios, los comentarios, el resumen y lo que costó cada lectura. Si hay una lectura en curso, la avanza (ya está pagada). Sin costo nuevo.",
    inputSchema: objeto({ id: { type: "string", description: "El id de publicaciones_seguidas." } }, ["id"]),
    annotations: LECTURA,
    correr: async (a, c) => {
      const id = requerido(a, "id");
      const ficha = await leerRespuesta(await responderFicha(id, { usuario: async () => ({ id: c.usuarioId }) }));
      return { ...(ficha as object), costo_de_cada_lectura: await costosDeSeguimiento(id) };
    },
  },
  {
    name: "estado_busqueda_en_vivo",
    title: "Estado de una búsqueda en vivo",
    description: "El avance y los resultados de una búsqueda pagada en redes iniciada con busqueda_en_vivo_en_redes. Pide el mismo «q». No inicia nada nuevo.",
    inputSchema: objeto({ id: { type: "string" }, q: { type: "string" } }, ["id", "q"]),
    annotations: LECTURA,
    correr: async (a) => {
      const id = requerido(a, "id");
      const estado = await leerRespuesta(await responderEstado(id, requerido(a, "q")));
      const [fila] = (await sql()`SELECT usd::float8 AS usd, tope_usd::float8 AS tope, terminado_en FROM busquedas_redes WHERE id = ${id}::uuid`) as {
        usd: number; tope: number; terminado_en: string | null;
      }[];
      return {
        ...(estado as object),
        costo: fila ? (fila.terminado_en ? { usd: fila.usd, medida: "cobrado" } : { usd: fila.tope, medida: "reservado (aún en curso)" }) : "sin_dato",
      };
    },
  },
  {
    name: "gasto_electoral",
    title: "Gasto electoral",
    description: "El gasto de campaña reportado al INE por candidatura (pesos mexicanos), filtrable por cargo, partido o nombre, ordenado de mayor a menor, y la pauta política en Meta de las figuras seguidas. Sin costo.",
    inputSchema: objeto({
      buscar: { type: "string", description: "Parte del nombre, cargo, partido o contienda." },
      limite: { type: "integer", minimum: 1, maximum: 100, description: "25 si falta." },
    }),
    annotations: LECTURA,
    correr: async (a) => {
      const [d, meta] = await Promise.all([leerDatoPublicado("gasto-electoral.json"), leerDatoPublicado("pauta-meta.json")]);
      const g = d as { moneda: string; proceso_actual: unknown; resumen: unknown; candidaturas: Record<string, unknown>[] } | null;
      if (!g) throw new ErrorDeAccion("El gasto electoral no está disponible.");
      const buscar = texto(a, "buscar")?.toLowerCase() ?? null;
      const filas = g.candidaturas
        .filter((c) => !buscar || ["nombre", "cargo", "partido", "contienda"].some((k) => String(c[k] ?? "").toLowerCase().includes(buscar)))
        .toSorted((x, y) => Number(y.gasto_reportado ?? 0) - Number(x.gasto_reportado ?? 0))
        .slice(0, entero(a, "limite", 25, 100))
        .map(({ nombre, cargo, partido, contienda, gasto_reportado, proceso }) => ({ nombre, cargo, partido, contienda, gasto_reportado, proceso }));
      const m = meta as { actualizado?: string; perfiles?: Record<string, unknown>[] } | null;
      return {
        moneda: g.moneda, proceso_actual: g.proceso_actual, resumen: g.resumen, candidaturas: filas,
        pauta_meta: m ? { actualizado: m.actualizado, perfiles: (m.perfiles ?? []).map(({ nombre, cargo, partido, estado, totales }) => ({ nombre, cargo, partido, estado, totales })) } : "sin_dato",
      };
    },
  },
  {
    name: "usuarios",
    title: "Usuarios del tablero",
    description: "Quién tiene acceso al tablero: nombre, correo, rol, si está activo y aprobado, y su último acceso. Sin costo.",
    inputSchema: objeto({}),
    annotations: LECTURA,
    correr: async () => ({
      usuarios: (await listarUsuarios()).map((u) => ({
        id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol, activo: u.activo, aprobado: u.aprobado, ultimo_acceso: u.ultimoAccesoEn,
      })),
    }),
  },
];
