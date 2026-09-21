import type { Consulta, DocConsultas, DocRedesComentarios, TonoTitular } from "../datos/tipos";
import { fechaConAnio, numero, plegar, pluralizar } from "./formato";
import {
  canonizarPublicacion,
  compararPublicaciones,
  type PublicacionVisual,
  type RedVisual,
} from "./publicaciones";
import { ruta } from "./secciones";
import { PARAM_CONSULTA } from "../busqueda/entrada";

/**
 * La busqueda de Redes: un TERMINO en seguimiento o un filtro sobre lo que ya
 * esta en pantalla.
 *
 * El 18 de septiembre de 2026 el cliente pidio saber que dicen las redes de
 * tres terminos —dos empresas y una persona— y poder bajarlo en PDF. La lupa
 * de Redes abre esto: si lo escrito es uno de los terminos de
 * data/consultas.json (`buscarConsulta`, por igualdad plegada, asi que «vive
 * la baja» y «Vive la Baja» son lo mismo), se muestra su cosecha de 30 dias en
 * el mismo visor de una publicacion por pantalla, con la ficha del termino
 * como primera tarjeta. Si no, lo escrito filtra las publicaciones que el
 * lector ya tiene delante (`filtrarPorTexto`): pies y comentarios que lo
 * nombran. Ninguna de las dos cosas pide nada a ninguna red.
 *
 * Puro y sin React: lo prueba scripts/probar-consultas.cjs.
 */

/** Las plataformas de una consulta que caen en el visor. YouTube y X vienen
 *  como `sin_dato` con su razon y se pintan como hoja de prosa. */
export const REDES_CONSULTA_VISUALES = ["instagram", "tiktok", "facebook"] as const;

/** El termino cuyo nombre plegado es el de la consulta, o null. */
export function buscarConsulta(doc: DocConsultas | undefined, q: string): Consulta | null {
  const aguja = plegar(q.trim());
  if (aguja === "") return null;
  return doc?.consultas.find((c) => plegar(c.termino) === aguja) ?? null;
}

/**
 * Las publicaciones de un termino como filas del visor, de las tres redes,
 * en el orden de lectura del visor (mas reciente primero).
 *
 * `fuente` es la del destacado —el @handle, la etiqueta, el slug de la
 * pagina o el creador de TikTok—, nunca el id del termino: ese es el
 * mecanismo, y el mecanismo no se le ensena al lector.
 */
export function reunirPublicacionesConsulta(c: Consulta): PublicacionVisual[] {
  const salida: PublicacionVisual[] = [];
  const vistos = new Set<string>();
  for (const red of REDES_CONSULTA_VISUALES) {
    const bloque = c.plataformas[red];
    if (bloque.estado === "sin_dato") continue;
    for (const post of bloque.destacados) {
      const url = canonizarPublicacion(post.url, red);
      const clave = `${red}:${url ?? post.url}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      const fuente = red === "tiktok"
        ? (post.creador === undefined ? "un creador" : `@${post.creador.replace(/^@/, "")}`)
        : post.origen === "hashtag" ? `#${post.fuente}` : post.fuente;
      salida.push({ post, red, clave, url, fuente });
    }
  }
  return salida.sort((a, b) => compararPublicaciones(a.post, b.post) || a.clave.localeCompare(b.clave));
}

/**
 * Las filas cuyo pie o cuyos comentarios publicados nombran `q`, plegado.
 *
 * Compara texto, no sentido: «agua» encuentra «aguacate». Se ofrece como
 * filtro de lo que hay, no como busqueda de nada, y por eso el hueco se dice
 * con SIN_FILAS_BUSQUEDA y no con un cero.
 */
export function filtrarPorTexto(
  filas: readonly PublicacionVisual[],
  textos: Partial<Record<RedVisual, DocRedesComentarios | undefined>>,
  q: string,
): PublicacionVisual[] {
  const aguja = plegar(q.trim());
  if (aguja === "") return [...filas];
  return filas.filter((fila) => {
    if (plegar(fila.post.titulo).includes(aguja)) return true;
    const comentarios = textos[fila.red]?.por_post[fila.post.url] ?? [];
    return comentarios.some((c) => plegar(c.texto).includes(aguja));
  });
}

/** A donde lleva elegir un termino en seguimiento. Siempre la vista de
 *  region: un termino no es un lugar, y /tijuana/redes?q= no significa nada. */
export function rutaDeConsulta(termino: string): string {
  const params = new URLSearchParams();
  params.set(PARAM_CONSULTA, termino);
  return `${ruta(null, "redes")}?${params.toString()}`;
}

/** El hueco del filtro, dicho como hueco. No dice «corte» ni «corrida»: la
 *  interfaz dice que falta, nunca como se obtiene. */
export const SIN_FILAS_BUSQUEDA = (q: string): string =>
  `No hay publicaciones que nombren «${q}» entre las que se muestran ahora.`;

/** El hueco de un termino en seguimiento sin publicaciones en su ventana. */
export const SIN_FILAS_CONSULTA = (termino: string, dias: number): string =>
  `No hay publicaciones que nombren «${termino}» en los últimos ${rotuloVentana(dias)}.`;

/** Lo que se pinta junto a un titular con tono. El vocabulario de la prensa,
 *  nunca el de los comentarios. */
export const NOMBRE_TONO_TITULAR: Record<TonoTitular, string> = {
  favorable: "favorable", adversa: "adversa", neutral: "neutral",
};

/** «6 meses» para 180 dias, «30 días» para 30: la ventana como la lee una
 *  persona, sin inventar precision (un mes son 30 dias aqui). */
export function rotuloVentana(dias: number): string {
  if (dias >= 60 && dias % 30 === 0) return `${dias / 30} meses`;
  return `${dias} ${dias === 1 ? "día" : "días"}`;
}

/** A donde lleva «ver en la prensa en vivo»: la busqueda de En Tendencia,
 *  que es la misma pregunta hecha al buscador de noticias de los ultimos dias.
 *  El texto que devuelve no entra a este documento ni se suma con nada. */
export function rutaDeBusquedaEnVivo(termino: string): string {
  const params = new URLSearchParams();
  params.set(PARAM_CONSULTA, termino);
  return `/?${params.toString()}`;
}

/**
 * Lo que las cifras de un termino dicen, en frases: el resumen que encabeza
 * la ficha y el informe. Solo conteos y fechas, sacados del documento; nunca
 * «la mayoría», «la gente» ni un porcentaje (PRODUCT.md reglas 1 y 2: son
 * titulares de medios y comentarios de quien decidio comentar, y con menos de
 * 30 un porcentaje se mueve con dos). Donde no se leyo, dice «sin dato».
 *
 * El caso que decidio la forma: el cliente pidio que el informe dijera que la
 * prensa sobre Grupo Concordia es negativa y que de Valente Marquez casi no
 * hay nada reciente. Las dos cosas caben como conteos —«3 titulares, 2
 * adversos, los adversos vienen de Blanco y Negro Noticias» y «ningun titular
 * en 6 meses; 1 anterior, de marzo de 2024»— y asi es como se afirman.
 */
export function frasesConsulta(c: Consulta, doc: DocConsultas): string[] {
  const frases: string[] = [];
  const t = c.termino;
  const p = c.prensa;
  if (p.estado !== "ok") {
    frases.push("Prensa: sin dato.");
  } else {
    const ventana = rotuloVentana(p.ventana_dias ?? doc.ventana_prensa_dias);
    const filas = p.resultados ?? [];
    const viejos = p.anteriores ?? [];
    const tono = p.tono;
    if (filas.length === 0) {
      frases.push(`Ningún titular de los últimos ${ventana} nombra «${t}» en las fuentes revisadas.`);
    } else {
      const partes: string[] = [];
      if (tono) {
        partes.push(`${numero(tono.adversa)} ${pluralizar(tono.adversa, "adverso", "adversos")}`);
        partes.push(`${numero(tono.favorable)} ${pluralizar(tono.favorable, "favorable", "favorables")}`);
        partes.push(`${numero(tono.neutral)} ${pluralizar(tono.neutral, "neutral", "neutrales")}`);
        const sinTono = tono.sin_clasificar + tono.sin_modelo_idioma;
        if (sinTono > 0) partes.push(`${numero(sinTono)} sin tono`);
      }
      frases.push(
        `${numero(filas.length)} ${pluralizar(filas.length, "titular nombra", "titulares nombran")} «${t}» en los últimos ${ventana}`
        + (partes.length > 0 ? `: ${partes.join(", ")}.` : "."),
      );
      const adversos = (p.por_medio ?? []).filter((m) => m.adversa > 0).sort((a, b) => b.adversa - a.adversa || a.fuente.localeCompare(b.fuente));
      if (adversos.length > 0) {
        frases.push(`Lo adverso viene de ${adversos.map((m) => `${m.fuente} (${numero(m.adversa)})`).join(", ")}.`);
      }
    }
    if (viejos.length > 0) {
      const reciente = viejos[0];
      const antiguo = viejos[viejos.length - 1];
      const cuando = reciente !== undefined && antiguo !== undefined && reciente.fecha !== antiguo.fecha
        ? `entre el ${fechaConAnio(antiguo.fecha)} y el ${fechaConAnio(reciente.fecha)}`
        : reciente !== undefined ? `del ${fechaConAnio(reciente.fecha)}` : "";
      const adversosViejos = viejos.filter((r) => r.tono === "adversa").length;
      frases.push(
        `${filas.length === 0 ? "Sí hay" : "Y hay"} ${numero(viejos.length)} ${pluralizar(viejos.length, "titular anterior", "titulares anteriores")} a ese periodo${cuando ? `, ${cuando}` : ""}`
        + (adversosViejos > 0 ? `, ${numero(adversosViejos)} ${pluralizar(adversosViejos, "adverso", "adversos")}.` : "."),
      );
    }
  }

  const redes = REDES_CONSULTA_VISUALES.map((red) => c.plataformas[red]);
  const leidas = redes.filter((b) => b.estado !== "sin_dato");
  if (leidas.length === 0) {
    frases.push("Redes: sin dato.");
  } else {
    const publicaciones = leidas.reduce((n, b) => n + b.publicaciones, 0);
    const ventana = rotuloVentana(doc.ventana_dias);
    if (publicaciones === 0) {
      frases.push(`Ninguna publicación en redes nombra «${t}» en los últimos ${ventana}.`);
    } else {
      const k = c.tono;
      frases.push(
        `${numero(publicaciones)} ${pluralizar(publicaciones, "publicación", "publicaciones")} en redes en los últimos ${ventana}; `
        + `${numero(k.comentarios)} ${pluralizar(k.comentarios, "comentario leído", "comentarios leídos")}`
        + (k.comentarios > 0 ? `: ${numero(k.positivo)} positivos, ${numero(k.negativo)} negativos, ${numero(k.neutral)} neutrales.` : "."),
      );
    }
    const sinDato = redes.filter((b) => b.estado === "sin_dato").length;
    if (sinDato > 0) {
      frases.push(`${numero(sinDato)} de las tres redes sin dato.`);
    }
  }
  return frases;
}
