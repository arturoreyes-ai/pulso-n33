/**
 * Los formatos que la «Idea para redes» puede proponer, y cuando conviene cada
 * uno. Lista cerrada: el modelo elige un `nombre` de aqui (el esquema de la
 * API lo impone con `enum`) y la pantalla pinta el `detalle` escrito aqui, no
 * uno inventado por el modelo.
 *
 * El caso que la cerro, 24 de septiembre de 2026: con el formato en texto
 * libre, casi toda ficha salia «Infografía» o «Infografía o carrusel
 * interactivo» —«Super El Niño is coming…» de Voice of San Diego, entre
 * otras—. Es el formato por defecto de un modelo que piensa en imprenta, y no
 * es lo que mueve una nota hoy. Lo que dicen las mediciones de 2026:
 *  - El video vertical corto es lo que llega a gente que no sigue la cuenta
 *    (Buffer, 52M de posts; Socialinsider: los Reels alcanzan 36% mas que los
 *    carruseles). En noticias la gente conecta con una persona antes que con
 *    una marca (Reuters Institute, Digital News Report 2026).
 *  - La pantalla verde —quien explica, parado sobre el documento o el mapa—
 *    retiene 30-40% mas que una cabeza parlante sola.
 *  - El carrusel no murio: engancha mas por persona alcanzada (se guarda y se
 *    comparte), pero alcanza menos. Sirve cuando hay pasos o una lista, no
 *    como envoltura de cualquier nota.
 *  - Una infografia de una sola imagen no esta en la lista a proposito.
 *
 * Por eso el video a camara va primero y es el que el prompt pide cuando
 * ninguno otro encaja mejor. El orden de este arreglo es el del prompt.
 */
export interface FormatoSocial {
  /** Lo que el modelo devuelve y la pantalla muestra como formato. */
  nombre: string;
  /** Lo que se pinta debajo: la pieza, en una linea. */
  detalle: string;
  /** Solo para el prompt: cuando elegirlo. */
  cuando: string;
}

export const FORMATOS_SOCIALES: readonly FormatoSocial[] = [
  {
    nombre: "Video a cámara",
    detalle: "Vertical de 20 a 45 segundos. Alguien de la redacción cuenta la nota de frente, con subtítulos.",
    cuando: "La opción por defecto para una nota con un hecho central que se entiende contado por una persona.",
  },
  {
    nombre: "Pantalla verde",
    detalle: "Vertical de 30 a 60 segundos. Quien explica aparece sobre el titular, un mapa, un documento o una foto de la nota.",
    cuando: "Cuando la nota trae algo que señalar: un lugar concreto, un documento oficial, una cifra o una imagen del propio medio.",
  },
  {
    nombre: "Carrusel",
    detalle: "De 5 a 8 láminas con texto grande. La primera es el gancho y la última, qué sigue.",
    cuando: "Solo si la nota establece pasos, requisitos, fechas o una lista de al menos cuatro datos concretos que alguien querría guardar.",
  },
  {
    nombre: "Aviso en video corto",
    detalle: "Vertical de 10 a 15 segundos, texto grande en pantalla y sin voz, para verse sin sonido.",
    cuando: "Un aviso de servicio que cabe en una frase: un cierre, un horario, una alerta, un cambio que afecta hoy.",
  },
  {
    nombre: "Hilo",
    detalle: "De 3 a 6 publicaciones de texto en orden, para X, Threads o Facebook.",
    cuando: "Una historia en desarrollo o con cronología, o una declaración oficial que conviene desglosar sin imagen.",
  },
];

const POR_NOMBRE = new Map(FORMATOS_SOCIALES.map((f) => [f.nombre, f]));

export const NOMBRES_FORMATO = FORMATOS_SOCIALES.map((f) => f.nombre);

export function formatoSocial(nombre: string): FormatoSocial | null {
  return POR_NOMBRE.get(nombre) ?? null;
}

/** Las lineas del prompt, iguales en prensa y en publicacion. */
export const REGLA_FORMATO = [
  "- Elige UN formato de esta lista, escrito exactamente así. Si ninguno encaja mejor, elige «Video a cámara»:",
  ...FORMATOS_SOCIALES.map((f) => `  · «${f.nombre}»: ${f.cuando}`),
  "- No propongas infografías ni piezas de una sola imagen estática.",
  "- Da el enfoque y un gancho factual para los primeros dos segundos, sin escribir el post terminado.",
].join("\n");
