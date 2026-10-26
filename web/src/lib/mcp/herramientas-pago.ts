/**
 * Las herramientas que GASTAN y las que cambian algo sin vuelta atras.
 *
 * Cada una dice en su descripcion lo que suele costar (medido, con la fecha
 * de la medida en AGENTS.md) y en su respuesta lo que costo de verdad:
 *  - IA: la suma exacta de las llamadas al modelo de ESA accion, que junta
 *    lib/uso/contexto.ts (las anota tambien uso_modelo, con la persona).
 *  - Apify: lo que la lectura RESERVO al empezar; lo cobrado se sabe al
 *    terminar y lo dicen ficha_de_seguimiento y estado_busqueda_en_vivo.
 *
 * Pasan por las mismas funciones que las rutas del sitio, asi que los topes
 * del mes y del dia, los interruptores y los libros aplican igual: el MCP no
 * puede gastar lo que un boton no podria. Una diferencia: la pagina del
 * guion se apoya en el cache del CDN para no pagar dos veces la misma hora, y
 * el MCP no pasa por el CDN. Cada llamada a generar_guion es una llamada al
 * modelo, y la descripcion lo dice.
 */

import { puedeEditarUsuario } from "@/lib/acceso/roles";
import { actualizarUsuario, buscarUsuarioPorId } from "@/lib/acceso/usuarios";
import { responderAmpliar } from "@/lib/analisis/ampliar";
import { analisisHabilitado } from "@/lib/analisis/config";
import { PROGRAMAS_GUION } from "@/lib/analisis/contrato-guion";
import { responderAnalisis } from "@/lib/analisis/analizar";
import { responderGuionMixto } from "@/lib/analisis/guion-mixto";
import { responderAnalisisPublicacion } from "@/lib/analisis/publicacion";
import { responderGaritas } from "@/lib/garitas/cbp";
import { TOPE_MENSUAL_USD as TOPE_BUSQUEDA } from "@/lib/redes-en-vivo/config";
import { responderInicio, TOPE_POR_BUSQUEDA } from "@/lib/redes-en-vivo/responder";
import { TOPE_MENSUAL_USD as TOPE_SEGUIMIENTO } from "@/lib/seguimiento/config";
import { responderActualizar, responderAgregar, responderBorrar, responderResumir } from "@/lib/seguimiento/responder";
import { gastoPorAccion } from "@/lib/uso/libros";
import { periodoDe } from "@/lib/uso/periodo";
import { costosDeSeguimiento } from "./herramientas-lectura";
import { DESTRUCTIVA, ErrorDeAccion, leerRespuesta, objeto, PAGO, requerido, texto, type Contexto, type Herramienta } from "./comun";

const PROGRAMA = { type: "string", enum: [...PROGRAMAS_GUION], description: "noticias33, deredenred, deportes, minutapolitica o estadodealerta." };
const ANALIZABLE = {
  url: { type: "string", description: "El «analizable.url» de una nota de noticias_en_tendencia o buscar_noticias." },
  dominio: { type: "string", description: "El «analizable.dominio» de esa nota." },
  medio: { type: "string", description: "El nombre del medio." },
};

const redondo = (n: number) => Math.round(n * 10_000) / 10_000;
const deps = (c: Contexto) => ({ usuario: async () => ({ id: c.usuarioId }) });

/** Cuanto lleva el mes en el libro de una accion de Apify y cuanto queda. */
async function topeDelMes(accion: "busqueda_redes" | "seguimiento") {
  const filas = await gastoPorAccion(periodoDe(undefined, undefined));
  const usado = filas.find((f) => f.accion === accion)?.usd_total ?? 0;
  const tope = accion === "busqueda_redes" ? TOPE_BUSQUEDA : TOPE_SEGUIMIENTO;
  return { usd_gastado_este_mes: redondo(usado), usd_tope_mensual: tope, usd_disponible: redondo(tope - usado) };
}

function exigirIa() {
  if (!analisisHabilitado()) throw new ErrorDeAccion("La lectura con IA está apagada en este despliegue.");
}

export const HERRAMIENTAS_PAGO: Herramienta[] = [
  {
    name: "generar_guion",
    title: "Generar un guion para locución (cuesta)",
    description: "Escribe el guion de un programa con lo más popular de redes de las últimas 24 horas y los titulares que cuentan lo mismo, como /guion. CUESTA: una llamada de IA, normalmente US$0.02–0.04 (a veces dos si la primera no pasa la revisión). La respuesta dice lo que costó.",
    inputSchema: objeto({ programa: PROGRAMA }, ["programa"]),
    annotations: PAGO,
    correr: async (a) => {
      exigirIa();
      const programa = requerido(a, "programa");
      const guion = await leerRespuesta(await responderGuionMixto({ p: programa }));
      // La nota de garitas la arma la pagina con el dato de CBP del momento;
      // aqui va el dato, gratis.
      const garitas = programa === "noticias33" ? await leerRespuesta(await responderGaritas()).catch(() => "sin_dato") : undefined;
      return { guion, ...(garitas === undefined ? {} : { garitas }) };
    },
  },
  {
    name: "detallar_nota",
    title: "Detallar una nota del guion (cuesta)",
    description: "Lee el artículo de una nota y reescribe su entrada con más detalle, con las reglas del programa. CUESTA: una llamada de IA, normalmente US$0.01–0.02.",
    inputSchema: objeto({ programa: PROGRAMA, titular: { type: "string" }, ...ANALIZABLE }, ["programa", "titular", "url", "dominio"]),
    annotations: PAGO,
    correr: async (a) => {
      exigirIa();
      return leerRespuesta(await responderAmpliar({
        p: requerido(a, "programa"), t: requerido(a, "titular"), u: requerido(a, "url"), d: requerido(a, "dominio"), m: texto(a, "medio"),
      }));
    },
  },
  {
    name: "analizar_nota",
    title: "Analizar una nota (cuesta)",
    description: "Lee el artículo enlazado y devuelve una ficha para cabina y una idea para redes, como el botón Analizar. CUESTA: una llamada de IA (Haiku), normalmente menos de US$0.01.",
    inputSchema: objeto(ANALIZABLE, ["url", "dominio"]),
    annotations: PAGO,
    correr: async (a) => {
      exigirIa();
      return leerRespuesta(await responderAnalisis({ u: requerido(a, "url"), d: requerido(a, "dominio"), m: texto(a, "medio") }));
    },
  },
  {
    name: "analizar_publicacion",
    title: "Analizar una publicación de redes (cuesta)",
    description: "Lectura con IA de una publicación de Instagram o TikTok ya cosechada: su texto y los comentarios más votados. CUESTA: una llamada de IA (Haiku), normalmente menos de US$0.01.",
    inputSchema: objeto({ url: { type: "string" }, red: { type: "string", enum: ["instagram", "tiktok"] } }, ["url", "red"]),
    annotations: PAGO,
    correr: async (a) => {
      exigirIa();
      return leerRespuesta(await responderAnalisisPublicacion({ u: requerido(a, "url"), r: requerido(a, "red") }));
    },
  },
  {
    name: "seguir_publicacion",
    title: "Seguir una publicación (cuesta)",
    description: `Agrega una publicación de Instagram, TikTok o Facebook a la lista del equipo en /seguimiento y hace su primera lectura: cifras y los 100 comentarios más recientes. CUESTA (Apify): en promedio US$0.07 por lectura, hasta US$0.60 reservados; tope del mes US$${TOPE_SEGUIMIENTO} y 10 lecturas por persona al día. Si ya se sigue, no se vuelve a pagar.`,
    inputSchema: objeto({
      url: { type: "string", description: "La URL de la publicación (no un enlace corto)." },
      idioma: { type: "string", enum: ["es", "en"], description: "El idioma de los comentarios; en inglés no se mide el tono." },
    }, ["url", "idioma"]),
    annotations: PAGO,
    correr: async (a, c) => {
      const r = (await leerRespuesta(await responderAgregar({ url: requerido(a, "url"), idioma: requerido(a, "idioma") }, deps(c)))) as { id?: string };
      return { ...r, costo: r.id ? await costosDeSeguimiento(r.id) : "sin_dato", tope: await topeDelMes("seguimiento") };
    },
  },
  {
    name: "actualizar_seguimiento",
    title: "Volver a leer una publicación seguida (cuesta)",
    description: `Una lectura nueva de una publicación seguida (botón Actualizar). CUESTA (Apify): en promedio US$0.07, hasta US$0.60 reservados; no se puede repetir antes de 30 minutos. Tope del mes US$${TOPE_SEGUIMIENTO}.`,
    inputSchema: objeto({ id: { type: "string" } }, ["id"]),
    annotations: PAGO,
    correr: async (a, c) => {
      const id = requerido(a, "id");
      const r = await leerRespuesta(await responderActualizar(id, deps(c)));
      return {
        ...(r as object),
        costo_de_cada_lectura: await costosDeSeguimiento(id),
        tope: await topeDelMes("seguimiento"),
        nota: "La lectura sigue en curso unos segundos; ficha_de_seguimiento la termina y dice lo cobrado.",
      };
    },
  },
  {
    name: "resumir_comentarios_seguidos",
    title: "Resumir los comentarios de una publicación seguida (cuesta)",
    description: "Escribe «Lo que dicen los comentarios» de una publicación seguida, con sus temas. Pide al menos 10 comentarios. CUESTA: una llamada de IA (Sonnet), normalmente US$0.01–0.02.",
    inputSchema: objeto({ id: { type: "string" } }, ["id"]),
    annotations: PAGO,
    correr: async (a, c) => leerRespuesta(await responderResumir(requerido(a, "id"), deps(c))),
  },
  {
    name: "busqueda_en_vivo_en_redes",
    title: "Buscar un término en redes en vivo (cuesta)",
    description: `Busca un término en TikTok, Instagram y Facebook en este momento y trae publicaciones que lo nombran con sus comentarios. CUESTA (Apify): medido US$0.17 una búsqueda, hasta US$${TOPE_POR_BUSQUEDA.toFixed(2)} reservados; tope del mes US$${TOPE_BUSQUEDA}, 10 por persona al día; la misma búsqueda en 6 horas se reusa sin costo. Devuelve un id: los resultados se leen con estado_busqueda_en_vivo.`,
    inputSchema: objeto({ q: { type: "string" } }, ["q"]),
    annotations: PAGO,
    correr: async (a, c) => {
      const r = await leerRespuesta(await responderInicio({ q: requerido(a, "q") }, deps(c)));
      return { ...(r as object), reservado_usd: TOPE_POR_BUSQUEDA, tope: await topeDelMes("busqueda_redes") };
    },
  },
  {
    name: "dejar_de_seguir",
    title: "Dejar de seguir una publicación (borra)",
    description: "Quita una publicación de /seguimiento y BORRA para siempre su historia de lecturas y el texto de sus comentarios. Lo ya gastado sigue contando en el tope. Sin costo.",
    inputSchema: objeto({ id: { type: "string" } }, ["id"]),
    annotations: DESTRUCTIVA,
    correr: async (a, c) => leerRespuesta(await responderBorrar(requerido(a, "id"), deps(c))),
  },
  {
    name: "cambiar_usuario",
    title: "Cambiar el acceso de un usuario",
    description: "Aprueba a un usuario, le cambia el rol (lector o admin) o lo activa o desactiva. Un administrador no puede cambiarse a sí mismo. Sin costo.",
    inputSchema: objeto({
      id: { type: "integer", description: "El id de la herramienta usuarios." },
      rol: { type: "string", enum: ["lector", "admin"] },
      activo: { type: "boolean" },
      aprobado: { type: "boolean" },
    }, ["id"]),
    annotations: { ...DESTRUCTIVA, idempotentHint: true },
    correr: async (a, c) => {
      const id = Number(a.id);
      const [yo, objetivo] = await Promise.all([buscarUsuarioPorId(c.usuarioId), buscarUsuarioPorId(id)]);
      if (!yo || yo.rol !== "admin") throw new ErrorDeAccion("Solo un administrador cambia usuarios.");
      if (!objetivo) throw new ErrorDeAccion(`No hay un usuario con id ${id}.`);
      if (!puedeEditarUsuario({ id: yo.id, rol: yo.rol }, objetivo)) throw new ErrorDeAccion("No puedes cambiar tu propia cuenta.");
      const cambio: { rol?: "lector" | "admin"; activo?: boolean; aprobado?: boolean } = {};
      if (a.rol === "lector" || a.rol === "admin") cambio.rol = a.rol;
      if (typeof a.activo === "boolean") cambio.activo = a.activo;
      if (typeof a.aprobado === "boolean") cambio.aprobado = a.aprobado;
      if (Object.keys(cambio).length === 0) throw new ErrorDeAccion("No dijiste qué cambiar: rol, activo o aprobado.");
      const u = await actualizarUsuario(id, cambio);
      return { usuario: { id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol, activo: u.activo, aprobado: u.aprobado } };
    },
  },
];
