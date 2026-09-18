import type { Destacado, DocRedes } from "../datos/tipos";

/** La vista visual conserva la selección de la lista: primero el límite por
 * plataforma y zona, después el orden de lectura. Mezclar antes del límite
 * dejaría a la plataforma más numerosa ocupar toda la selección. */
export type RedVisual = "instagram" | "tiktok" | "youtube";
/** Como se nombra cada red al lector. */
export const NOMBRE_RED: Record<RedVisual, string> = {
  instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube",
};
export interface PublicacionVisual {
  post: Destacado;
  red: RedVisual;
  fuente: string;
  clave: string;
  url: string | null;
}

export function compararPublicaciones(a: Destacado, b: Destacado): number {
  return b.fecha.localeCompare(a.fecha) ||
    (b.publicado ?? "").localeCompare(a.publicado ?? "") ||
    (b.likes ?? b.reproducciones ?? 0) - (a.likes ?? a.reproducciones ?? 0) ||
    a.url.localeCompare(b.url);
}

/**
 * Las tres cubetas de la vista de región. En una página de zona no aplican:
 * ahí el filtro es la zona y ya.
 *
 * Existen porque `internacional` y `nacional` no tienen página propia y antes
 * caían en la misma lista que el corredor, ordenada por likes. Un video del
 * mundo trae órdenes de magnitud más likes que uno de Tecate, así que sin
 * separarlos el corredor desaparecía de su propia portada de redes.
 */
export type CubetaRegion = "corredor" | "mexico" | "mundo";

const EN_CUBETA: Record<CubetaRegion, (zona: string) => boolean> = {
  corredor: (z) => z !== "nacional" && z !== "internacional",
  mexico: (z) => z === "nacional",
  mundo: (z) => z === "internacional",
};

/** Solo las cubetas que TIENEN filas. Una pastilla que siempre sale vacía no
 *  informa de un hueco, estorba: Instagram, por ejemplo, nunca tiene `mundo`
 *  porque la zona de una cuenta es su sede declarada. */
export function cubetasConFilas(datos: DocRedes): CubetaRegion[] {
  const posts = datos.destacados ?? [];
  return (["corredor", "mexico", "mundo"] as const).filter((c) =>
    posts.some((post) => EN_CUBETA[c](post.zona)));
}

/**
 * Los nombres de las cubetas, para quien las pinte. «Corredor» no es un
 * tecnicismo: es lo que este tablero mide.
 *
 * Un `Record` exhaustivo y no un arreglo de pares, por lo mismo que
 * ACENTO_RUBRO y NOMBRE_RUBRO: agregar una cubeta tiene que romper en
 * compilacion en todos los sitios que la nombran, en vez de llegar a la barra
 * sin nombre. Ademas la barra lo lee por render, y un `find` ahi era una
 * busqueda lineal para algo que es un acceso directo.
 */
export const NOMBRE_CUBETA: Record<CubetaRegion, string> = {
  corredor: "Corredor",
  mexico: "México",
  mundo: "Mundo",
};

/** Las mismas, en el orden en que se ofrecen. Deriva de NOMBRE_CUBETA para que
 *  los nombres vivan en un solo sitio. */
export const CUBETAS: { id: CubetaRegion; nombre: string }[] = (
  ["corredor", "mexico", "mundo"] as const
).map((id) => ({ id, nombre: NOMBRE_CUBETA[id] }));

/** La union de las dos plataformas. El visor del lector las recorre juntas,
 *  asi que una cubeta que solo tiene filas en TikTok tambien se ofrece:
 *  preguntarle a un solo documento escondia Mundo, que solo existe ahi. */
export function cubetasDisponibles(
  instagram: DocRedes | undefined,
  tiktok: DocRedes | undefined,
  youtube: DocRedes | undefined,
): CubetaRegion[] {
  const juntas = new Set<CubetaRegion>();
  for (const datos of [instagram, tiktok, youtube]) {
    if (datos) for (const c of cubetasConFilas(datos)) juntas.add(c);
  }
  return CUBETAS.map((c) => c.id).filter((c) => juntas.has(c));
}

/** Cuantas publicaciones de una misma cuenta entran antes de que las demas
 *  tengan la suya. Mismo numero y misma regla que el pipeline
 *  (pulso/redes.py::VUELTAS_GARANTIZADAS): si divergieran, la pagina de una
 *  zona y la de region repartirian distinto sobre los mismos datos. */
const VUELTAS_GARANTIZADAS = 1;

/** El orden del archivo, para desempatar dentro de una misma vuelta. */
/**
 * El orden del corte, por plataforma. TIENE que coincidir con
 * `PLATAFORMAS_REDES[red].orden` del validador y con `ORDEN` de
 * `pulso/youtube.py`: si divergen, la página de una zona y la de región
 * reparten distinto sobre los mismos datos.
 *
 * YouTube ordena por vistas porque su feed público no publica likes ni conteo
 * de comentarios. No se rellenan con cero —eso sería «nadie», no «no lo
 * medimos»—, así que aquí se leen como ausentes.
 */
const compararPorMerito = (red: RedVisual) => (a: Destacado, b: Destacado): number =>
  red === "youtube"
    ? (b.reproducciones ?? 0) - (a.reproducciones ?? 0) ||
      (b.valoraciones ?? 0) - (a.valoraciones ?? 0) ||
      a.url.localeCompare(b.url)
    : (b.likes ?? 0) - (a.likes ?? 0) ||
      (b.comentarios ?? 0) - (a.comentarios ?? 0) ||
      a.url.localeCompare(b.url);

/**
 * Una vuelta por cuenta antes del merito.
 *
 * El caso, medido el 17 de septiembre de 2026 sobre la vista de region: de las
 * quince tarjetas del corredor, DOCE eran de Tijuana, dos de San Diego y una de
 * Mexicali, repartidas entre ocho cuentas. Ensenada, Tecate y el estado se
 * quedaban en cero habiendo publicado, porque el corte eran las quince de mas
 * likes sobre sesenta y cuatro filas y las cuentas de Tijuana tienen ordenes de
 * magnitud mas seguidores. Con el reparto son quince cuentas y las seis zonas.
 *
 * Es la misma falla que ya obligo a separar las cubetas aqui arriba, y la que
 * busqueda/fusionar.ts documenta en su capa: al cortar al tope se quedaba un
 * solo grupo y ninguno de los demas. Mismo reparto, sin importarlo: dominio no
 * depende de busqueda, y este archivo no puede ganar un import en tiempo de
 * ejecucion sin romper scripts/probar-publicaciones.cjs.
 *
 * Reparte por CUENTA, nunca por zona. Por zona pondria las filas de Ensenada
 * -- mediana de un like -- delante de las de mil ochocientos de Tijuana, y eso
 * afirma una paridad que el material no tiene. Por cuenta sale solo, porque la
 * zona de una cuenta de Instagram es su sede declarada: cada lugar pesa lo que
 * pesan los medios que tiene.
 *
 * Pasada la primera vuelta todos compiten por likes otra vez (`min`), que es
 * lo que lo separa de una cuota: una cuota sentaria los tres posts de un medio
 * de diez likes por delante de tres de nueve mil. Y no agrega filas: donde
 * publica una sola cuenta la salida es identica a la de antes.
 */
function porTurnos(posts: readonly Destacado[], tope: number,
                   red: RedVisual = "instagram"): Destacado[] {
  if (posts.length <= tope) return [...posts];
  const turno = new Map<string, number>();
  const vistos = new Map<string, number>();
  for (const post of posts) {
    const n = vistos.get(post.cuenta) ?? 0;
    turno.set(post.url, n);
    vistos.set(post.cuenta, n + 1);
  }
  const vuelta = (post: Destacado) => Math.min(turno.get(post.url) ?? 0, VUELTAS_GARANTIZADAS);
  // Copia antes de ordenar: `posts` sale de `datos.destacados`, el documento
  // que SWR comparte entre el visor, los conteos y la ruta de analisis en el
  // mismo render. Ordenarlo en sitio se lo cambiaria a los tres.
  const elegidos = new Set([...posts]
    .sort((a, b) => vuelta(a) - vuelta(b) || compararPorMerito(red)(a, b))
    .slice(0, tope)
    .map((post) => post.url));
  // Se devuelve en el ORDEN DEL ARCHIVO, no en el del reparto: esto elige, no
  // ordena. Quien pinta ordena por fecha y quien suma no mira el orden.
  return posts.filter((post) => elegidos.has(post.url));
}

/**
 * `red` es OBLIGATORIO y no tiene omision a proposito. El otro consumidor de
 * esta funcion es analisis/datos-redes.ts::reunirConversacion, que la usa para
 * que «de que se habla» hable exactamente de lo que se puede desplazar en
 * pantalla; si divergieran, la lectura afirmaria cosas sobre publicaciones que
 * el lector no tiene manera de comprobar. Con omision divergirian en silencio;
 * asi es un error de compilacion.
 *
 * Reparten Instagram y YouTube; TikTok es la EXCEPCION, no la regla. Alli
 * `cuenta` es el id de una busqueda y no una voz: repartirla seria repartir el
 * mecanismo, y su equivalente honesto seria `creador`. En las otras dos
 * `cuenta` es un medio con nombre impreso. Medido en YouTube el 18 de
 * septiembre de 2026: los quince primeros por vistas salieron de cinco canales
 * de los ocho que publicaron, con uno solo llevandose seis lugares.
 */
export function seleccionarPublicaciones(
  datos: DocRedes,
  zona: string | null,
  red: RedVisual,
  cubeta: CubetaRegion = "corredor",
): Destacado[] {
  const posts = datos.destacados ?? [];
  const dentro = zona === null ? EN_CUBETA[cubeta] : (z: string) => z === zona;
  const suyos = posts.filter((post) => dentro(post.zona));
  const tope = datos.destacados_maximo ?? 15;
  return red === "tiktok" ? suyos.slice(0, tope) : porTurnos(suyos, tope, red);
}

/** Solo enlaces de publicaciones, nunca perfiles, redirecciones ni HTML. */
export function canonizarPublicacion(valor: string, red: RedVisual): string | null {
  try {
    const url = new URL(valor);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    // Tres ramas EXPLICITAS. TikTok era el caso por defecto, y dejarlo asi
    // haria que una URL de YouTube cayera en su validador y volviera null sin
    // decir por que.
    if (red === "instagram") {
      if (!["instagram.com", "www.instagram.com"].includes(url.hostname)) return null;
      const partes = /^\/(p|reel)\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname);
      return partes ? `https://www.instagram.com/p/${partes[2]}/` : null;
    }
    if (red === "tiktok") {
      if (!["tiktok.com", "www.tiktok.com"].includes(url.hostname)) return null;
      const partes = /^\/@([A-Za-z0-9_.]+)\/video\/(\d+)\/?$/.exec(url.pathname);
      return partes ? `https://www.tiktok.com/@${partes[1]!.toLowerCase()}/video/${partes[2]}` : null;
    }
    // YouTube llega en tres formas -- /shorts/, /watch?v= y youtu.be/ -- y las
    // tres son el mismo video. Se canoniza por id para que el visor no monte
    // dos veces la misma pieza y para que la clave de busqueda sea una sola.
    if (["youtu.be"].includes(url.hostname)) {
      const corto = /^\/([A-Za-z0-9_-]{6,20})$/.exec(url.pathname);
      return corto ? `https://www.youtube.com/watch?v=${corto[1]}` : null;
    }
    if (!["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) return null;
    const corto = /^\/shorts\/([A-Za-z0-9_-]{6,20})\/?$/.exec(url.pathname);
    if (corto) return `https://www.youtube.com/watch?v=${corto[1]}`;
    if (url.pathname !== "/watch") return null;
    const v = url.searchParams.get("v") ?? "";
    return /^[A-Za-z0-9_-]{6,20}$/.test(v) ? `https://www.youtube.com/watch?v=${v}` : null;
  } catch { return null; }
}

/** El nombre de cada cuenta del catalogo, para etiquetar un post de Instagram. */
export function nombresDeCuentas(datos: DocRedes): Map<string, string> {
  return new Map(datos.cuentas?.map((cuenta) => [cuenta.cuenta, cuenta.nombre]));
}

/**
 * Como se le nombra al lector quien publico. Vivia dentro de
 * `reunirPublicaciones` y salio de ahi cuando /api/analizar-publicacion tuvo
 * que rotular la misma publicacion en el servidor: dos implementaciones de una
 * etiqueta divergen el dia que falte un `creador`, y la ficha diria «un
 * creador» donde la tarjeta dice «@n.mas».
 *
 * Sin `creador` NO se cae al id de la busqueda: `tk_mexicali_noticias` es el
 * mecanismo, y el mecanismo no se le ensena al lector. El validador exige
 * `creador` en TikTok, asi que esto no deberia pasar nunca; con once busquedas
 * la superficie es once veces mas grande.
 */
export function fuenteDePublicacion(post: Destacado, red: RedVisual, nombres: Map<string, string>): string {
  if (red === "tiktok") {
    return post.creador === undefined ? "un creador" : `@${post.creador.replace(/^@/, "")}`;
  }
  // En Instagram y en YouTube el publicador ES la cuenta: una fila del
  // catalogo, con nombre impreso. No hay `creador` que publicar.
  return nombres.get(post.cuenta) ?? post.cuenta;
}

export function reunirPublicaciones(instagram: DocRedes | undefined, tiktok: DocRedes | undefined, youtube: DocRedes | undefined, zona: string | null, cubeta: CubetaRegion = "corredor"): PublicacionVisual[] {
  const salida: PublicacionVisual[] = [];
  const vistos = new Set<string>();
  for (const [red, datos] of [["instagram", instagram], ["tiktok", tiktok],
                              ["youtube", youtube]] as const) {
    if (!datos) continue;
    const nombres = nombresDeCuentas(datos);
    for (const post of seleccionarPublicaciones(datos, zona, red, cubeta)) {
      const url = canonizarPublicacion(post.url, red);
      const clave = `${red}:${url ?? post.url}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      salida.push({ post, red, clave, url, fuente: fuenteDePublicacion(post, red, nombres) });
    }
  }
  return salida.sort((a, b) => compararPublicaciones(a.post, b.post) || a.clave.localeCompare(b.clave));
}
