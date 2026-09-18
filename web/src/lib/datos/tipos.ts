// Espejo de los contratos de docs/datos.md. La ley es pulso/validador.py.

/** Las nueve zonas. Igual que ZONAS en pulso/__init__.py. */
export type Zona =
  | "estatal"
  | "Tijuana"
  | "Mexicali"
  | "Ensenada"
  | "Playas de Rosarito"
  | "Tecate"
  | "San Quintín"
  | "San Felipe"
  | "San Diego";

export type Alcance = "zona" | "estatal" | "nacional" | "fuera";

/** Las nueve delegaciones de Tijuana. Igual que DELEGACIONES_TIJUANA en
 *  pulso/__init__.py. Ninguna otra zona se subdivide. */
export type Delegacion =
  | "Centro"
  | "Cerro Colorado"
  | "La Mesa"
  | "La Presa A.L.R."
  | "La Presa Este"
  | "Otay Centenario"
  | "Playas de Tijuana"
  | "San Antonio de los Buenos"
  | "Sánchez Taboada";

export interface FiguraEnNota {
  id: string;
  /** 'nominal' = nombrada en el titular. 'cargo' = resuelta por el puesto que
   *  ocupaba ESA fecha, que es lo que hace falta cuando hay un relevo. */
  via: "nominal" | "cargo";
  /** El alias plegado que empato. Va en el tooltip del chip. */
  clave: string;
}

export type Etiqueta = "favorable" | "neutral" | "adversa";

/**
 * TONO del titular, no postura hacia una persona.
 *
 * Con `metodo: "modelo"` la asigna pysentimiento en local (pulso/sentimiento.py),
 * un modelo entrenado en texto de redes: sabe si la frase suena a queja, a
 * celebracion o a informacion, y nada mas. Por eso el tablero nunca la cruza
 * con figuras. `diccionario` es la linea base lexica, no publicable.
 */
export type Postura =
  | { etiqueta: Etiqueta; puntaje: number; metodo: "diccionario"; version: string }
  | {
      etiqueta: Etiqueta;
      /** 0..1, la probabilidad de la etiqueta ganadora. */
      confianza: number;
      metodo: "modelo";
      modelo: string;
      version: string;
    };

export interface Nota {
  id: string;
  titulo: string;
  url: string;
  dominio: string;
  fuente: string;
  /** De donde es el MEDIO. No de que habla la nota. */
  zona_medio: Zona;
  /** De que habla la nota. Puede venir vacio y puede traer varias. */
  zonas: Zona[];
  /** Delegaciones de Tijuana que nombra el TITULAR. Solo trae algo si zonas
   *  incluye Tijuana. Opcional porque los cortes anteriores no la traen. */
  delegaciones?: Delegacion[];
  alcance: Alcance;
  fecha: string | null;
  publicado: string | null;
  /** Cuando lo vio el pipeline la primera vez. Se conserva entre corridas. */
  capturado: string;
  /** Notas que no llegaron por el feed de un medio del catalogo:
   *  `descubrimiento_web` es GDELT, `busqueda_web` es Google Noticias. */
  origen?: "descubrimiento_web" | "busqueda_web";
  /** "gdelt" para el descubrimiento; el id de la busqueda (bq_...) para
   *  Google Noticias. En ese caso la `url` es el redirector de Google y el
   *  `dominio` es el del medio que publico, tomado de su <source>. */
  descubierta_por?: string;
  /** Miniatura que el medio publica en SU PROPIO feed, enlazada (nunca
   *  copiada) y solo si su host es del medio o de un CDN que su fila del
   *  catalogo declara. Se conserva la primera vista, como `capturado`.
   *  Ausente cuando el medio no la publica: cinco de quince feeds no la
   *  traen, y las notas de busqueda nunca. No es un hueco que rellenar. */
  imagen?: string;
  figuras: FiguraEnNota[];
  postura: Postura | null;
}

/**
 * La ventana reciente, no el historico. `ventana_dias` dice cuanto abarca; lo
 * mas viejo esta en archivo/.
 *
 * No hay campo `generado` y eso sostiene algo: si lo hubiera, cada corrida del
 * cron produciria un commit y el guarda `git diff --quiet` de pulso.yml
 * dejaria de servir. No agregarlo.
 */
export interface DocNotas {
  esquema: 1;
  ventana_dias: number;
  total: number;
  notas: Nota[];
}

export interface MesArchivado {
  mes: string;
  notas: number;
  desde: string | null;
  hasta: string | null;
  archivo: string;
}

export interface DocArchivoIndice {
  esquema: 1;
  total: number;
  meses: MesArchivado[];
}

export interface Tema {
  termino: string;
  n: number;
  n_previo: number;
  momento: number;
  zonas: Record<string, number>;
  fuentes: Record<string, number>;
  /** Un tema que sostiene un solo medio es la agenda de ese medio. Se
   *  publica, pero rotulado. */
  un_solo_medio: boolean;
  notas: string[];
  ejemplos: string[];
}

/** Los temas de UNA zona: las notas que la mencionan, con su propio minimo. */
export interface TemasZona {
  notas_ventana: number;
  /** 3 con prensa abundante, 2 donde hay poca. El tablero lo dice. */
  minimo: number;
  temas: Tema[];
}

export interface DocTemas {
  origen: "prensa" | "comentarios";
  /** SOLO FECHA ("2026-09-04"), a diferencia de todos los demas `generado`
   *  del conjunto, que son ISO completo. Formatearlo con el mismo helper que
   *  los otros es un error. */
  generado: string;
  ventana_dias: number;
  minimo: number;
  notas_ventana: number;
  notas_previas: number;
  temas: Tema[];
  descartados: { termino: string; n: number; porque: string }[];
  /** Solo las zonas con notas en la ventana: clave ausente, no lista vacia. */
  por_zona?: Record<string, TemasZona>;
}

export interface Fuente {
  id: string;
  nombre: string;
  url: string;
  metodo?: "rss" | "scrapy" | "descubrimiento" | "busqueda";
  /** Cobertura declarada del medio. Opcional porque los cortes viejos no la traen. */
  zona?: Zona | null;
  estado: "ok" | "fallo";
  obtenidas: number;
  nuevas: number;
  ms: number;
  ultima_ok: string | null;
  error: string | null;
  detalle?: DetalleDescubrimiento | DetalleBusqueda;
}

export interface DetalleDescubrimiento {
  candidatos: number;
  publisher_pages: number;
  aceptadas: number;
  rechazadas: number;
  robots_exclusiones: number;
  fallos: number;
}

/**
 * Conteos de una busqueda de Google Noticias. `notas` y `sin_zona` son los que
 * importan al leer la banda de salud: `sin_zona` dice cuantas de las que trajo
 * no llegan al muro porque su titular no nombra ningun lugar, que es la unica
 * forma de saber si una consulta esta bien escrita sin abrir el archivo.
 */
export interface DetalleBusqueda {
  items: number;
  sin_publicador: number;
  sin_fecha: number;
  fuera_de_ventana: number;
  sin_sufijo: number;
  resueltas: number;
  sinteticas: number;
  recortadas: number;
  notas: number;
  sin_zona: number;
}

export interface DocFuentes {
  esquema: 1;
  generado: string;
  fuentes: Fuente[];
}

// ------------------------------------------------------------- indicadores

interface MetaPanel {
  fuente: string;
  url: string;
  cadencia: "mensual" | "trimestral" | "anual";
  periodo: string | null;
  /** La salvedad metodologica. Se renderiza como texto visible, nunca como
   *  tooltip: es lo que impide leer mal la cifra. */
  aviso: string;
  familia: "vivienda" | "suelo" | "crimen" | "percepcion";
  obtenido: string;
}

export interface PanelShf extends MetaPanel {
  universo: string;
  /** Municipios que la SHF no publica. Se rotulan como huecos, nunca como cero. */
  sin_cobertura: string[];
  series: Record<
    string,
    {
      ambito: "estado" | "municipio" | "global";
      periodo: string;
      /** Rebaseado POR SERIE: los niveles NO son comparables entre
       *  geografias. Por eso no se grafican, solo las variaciones. */
      indice: number;
      variacion_anual_pct: number | null;
      trimestres: number;
    }
  >;
}

export interface PanelPredial extends MetaPanel {
  municipios: Record<
    string,
    {
      ciclo: number;
      /** Recaudacion, no valuacion. Contaminado por diferencias de tasa y de
       *  eficiencia de cobro entre municipios. */
      por_cuenta_mxn: number;
      cuentas_pagadas: number;
      variacion_anual_pct: number | null;
      ciclos: number;
    }
  >;
}

export interface PanelSesnsp extends MetaPanel {
  rezago?: string;
  archivo?: string;
  municipios: Record<
    string,
    {
      cve: string;
      cvegeo: string;
      total: number;
      ultimo_mes: string | null;
      /** La unica serie de tiempo real del conjunto: 7 puntos mensuales. */
      por_mes: number[];
      delitos_clave: Record<string, number>;
    }
  >;
}

export interface PanelEnsu extends MetaPanel {
  archivo?: string;
  /** Nunca inferir las cinco ciudades no muestreadas desde estas dos. */
  cobertura: string;
  ciudades: Record<string, { pct_inseguro: number | null; poblacion_18mas: number }>;
  nacional: { pct_inseguro: number | null };
}

export interface PanelSanDiego extends MetaPanel {
  faltantes: string;
  zips: Record<string, { mediana_usd: number; parcelas: number }>;
}

/**
 * La union se llavea por ID DE PANEL, no por `familia`: `familia` colisiona,
 * porque `shf` y `san_diego` son las dos "vivienda".
 */
export interface DocIndicadores {
  esquema: 1;
  generado: string;
  indicadores: {
    shf?: PanelShf;
    predial?: PanelPredial;
    sesnsp?: PanelSesnsp;
    ensu?: PanelEnsu;
    san_diego?: PanelSanDiego;
  };
  salud: {
    id: string;
    estado: "ok" | "fallo";
    ms: number;
    error: string | null;
    periodo: string | null;
  }[];
}

// ------------------------------------------------------------- conversacion

/**
 * NO es `Tema`: `derivar()` en pulso/youtube.py le quita `ejemplos` y `notas`
 * porque son texto literal de comentarios, y eso no se puede almacenar mas de
 * 30 dias ni, por tanto, commitear.
 */
export interface TemaConversacion {
  termino: string;
  n: number;
  n_previo: number;
  momento: number;
  zonas: Record<string, number>;
  fuentes: Record<string, number>;
  un_solo_medio: boolean;
}

/** Conteos de sentimiento. Nunca porcentajes: el tablero decide si los dice. */
export interface Sentimiento {
  positivo: number;
  negativo: number;
  neutral: number;
}

export interface SentimientoGlobal extends Sentimiento {
  metodo: "modelo" | "ninguno";
  modelo: string | null;
  sin_clasificar: number;
}

export interface ConversacionPorTema {
  tema: string;
  comentarios: number;
  videos: number;
  interacciones: number;
  preguntas: number;
  zonas: Record<string, number>;
  subtemas: { termino: string; n: number }[];
  sentimiento?: Sentimiento;
}

/** Lo que se comenta sobre UNA zona. Conteos, nunca texto. */
export interface ConversacionZona {
  comentarios: number;
  interacciones: number;
  preguntas: number;
  sentimiento: Sentimiento;
  por_tema: { tema: string; comentarios: number; sentimiento: Sentimiento }[];
}

export interface DocConversacion {
  esquema: 1;
  generado: string;
  aviso: string;
  retencion_dias: number;
  comentarios_vigentes: number;
  por_zona: Record<string, number>;
  por_canal: Record<string, number>;
  por_figura: Record<string, number>;
  por_tema?: ConversacionPorTema[];
  sentimiento?: SentimientoGlobal;
  por_zona_detalle?: Record<string, ConversacionZona>;
  temas: TemaConversacion[];
  canales: {
    id: string;
    nombre: string;
    canal: string | null;
    zona: string | null;
    estado: "ok" | "sin_llave" | "cuota" | "omitido" | "fallo";
    videos: number;
    comentarios: number;
    ultima_ok: string | null;
    error: string | null;
  }[];
  cuentas: {
    presupuesto: { tope: number; gastado: number; cuota_diaria: number; reserva: number };
    busqueda?: {
      presupuesto: { tope: number; gastado: number; cuota_diaria: number; reserva: number };
      temas: {
        tema: string;
        estado: "ok" | "cuota" | "fallo";
        videos: number;
        comentarios: number;
        error: string | null;
      }[];
    };
    cache: { archivos_vivos: number; archivos_borrados: number; retencion_dias: number };
  };
}

// ------------------------------------------------------------------- estado

export interface DocEstado {
  esquema: 1;
  pulso_version: string;
  /** EL RELOJ. Toda edad del muro se mide contra esto, no contra Date.now(),
   *  para que una pestana abierta desde ayer no mienta. */
  generado: string;
  modo: "red" | "corpus";
  metodo_postura: "ninguno" | "diccionario" | "modelo";
  commit: string | null;
  corrida: string | null;
  fuentes_ok: number;
  fuentes_fallo: number;
  notas_total: number;
  notas_ventana: number;
  notas_archivadas: number;
  ventana_dias: number;
  archivos: number;
  notas_nuevas: number;
  notas_region: number;
  /** Notas sin postura por no haber modelo de su idioma. El hueco se publica
   *  en vez de rellenarse con una etiqueta que el modelo no puede sostener. */
  notas_sin_modelo_idioma?: number;
  /** Suma MAS que notas_total: una nota puede contar en varias zonas.
   *  Normalizar al maximo, nunca a un total. */
  por_zona: Record<string, number>;
  por_alcance: Partial<Record<Alcance, number>>;
  roster_figuras: number;
  roster_vigentes: number;
  descubrimiento?: {
    estado?: "ok" | "fallo";
    ultima_ok?: string | null;
    candidatos?: number;
    publisher_pages?: number;
    aceptadas?: number;
    rechazadas?: number;
    robots_exclusiones?: number;
    fallos?: number;
  };
}

// -------------------------------------------------------------------- redes

/**
 * `data/redes.json` — comentarios públicos de Instagram, cosechados por Apify
 * sin iniciar sesión.
 *
 * Deliberadamente más pobre que `DocConversacion`, en dos sentidos que el
 * tablero tiene que respetar:
 *
 * - **No hay identidad de quien comenta, en ningún nivel.** No es que se
 *   omita al publicar: se tira al ingerir, así que no existe ni en el caché.
 *   Ver el encabezado de `pulso/instagram.py`.
 * - **No hay porcentajes, y no se deben calcular en el cliente.** Los planes
 *   gratuitos de Apify devuelven ~15 comentarios por post, o sea debajo del
 *   mínimo de 30 que fija PRODUCT.md. Un `n / total` en un componente vuelve
 *   a meter por la puerta de atrás justo lo que el pipeline se negó a emitir.
 *
 * Va **al lado** del panel de prensa y del de YouTube, nunca sumado con
 * ellos: la distancia entre lo que publica la prensa y lo que responde la
 * gente es la señal, y promediarlos la borra.
 */
export interface RedesSalud {
  cuenta: string;
  estado: "ok" | "fallo" | "sin_token";
  posts?: number;
  /** Comentarios realmente ingeridos. */
  comentarios?: number;
  /** Items facturados por Apify. Mayor que `comentarios` cuando un post no
   *  tiene comentarios: el actor devuelve un item de relleno y lo cobra. */
  crudos?: number;
  /** Solo TikTok: de cuántos videos de esa búsqueda TikTok ya había generado
   *  subtítulos. Es un conteo; el texto no se guarda en ninguna parte. */
  con_subtitulos?: number;
  nota?: string;
  error?: string;
}

/** Las dos plataformas comparten contrato; ver `PLATAFORMAS_REDES` en el validador. */
export type PlataformaRedes = "instagram" | "tiktok";

export interface DocRedes {
  esquema: 1;
  generado: string;
  plataforma: PlataformaRedes;
  retencion_dias: 30;
  comentarios_vigentes: number;
  posts_vigentes: number;
  /** Comentarios con palabras y no repetidos. Lo único sobre lo que se
   *  cuentan temas. */
  opinion: number;
  /** Mismo texto en 3+ posts distintos de la misma cuenta: una persona
   *  insistiendo, no conversación. Se publica aparte, no se resta en el UI. */
  repetidos: number;
  /** Sólo emoji o puntuación: reacción sin tema. */
  reacciones: number;
  por_zona: Record<string, number>;
  por_cuenta: Record<string, number>;
  por_idioma: Record<"es" | "en", number>;
  /** `posts` es cuántos posts distintos lo sostienen. Un tema con posts:1 es
   *  un post, no la ciudad — no pintarlo como tendencia. */
  por_tema: { tema: string; comentarios: number; posts: number }[];
  /** Tono contado SOLO sobre `opinion`. Nunca se cruza con figuras: el
   *  modelo puntúa el tono de la frase, no la postura hacia una persona. */
  sentimiento: {
    metodo: "modelo" | "ninguno";
    modelo: string | null;
    positivo: number;
    negativo: number;
    neutral: number;
    sin_clasificar: number;
    /** En un idioma que el modelo no habla. Sin etiqueta, nunca inventada. */
    sin_modelo_idioma: number;
  };
  salud: RedesSalud[];
  gasto: {
    resultados: number;
    gastado: number;
    por_concepto: Record<string, number>;
  };
  /** Ventana de los destacados, en horas sobre `publicado` en las dos
   *  plataformas desde el 10 de septiembre de 2026. Exactamente una de las dos
   *  claves por archivo: `ventana_dias` (sobre `fecha`) solo llega en un corte
   *  de Instagram anterior a esa fecha, y el panel lo describe como días. La
   *  calcula el pipeline con su propio reloj; el cliente nunca la recalcula.
   *  Ausentes en cortes viejos. */
  ventana_dias?: number;
  ventana_horas?: number;
  destacados_maximo?: number;
  /** Catálogo de cuentas, sin handle. Las apagadas viajan también: son el
   *  registro deliberado de un hueco (Mexicali, San Quintín) y permiten
   *  rotular «sin cuenta» en vez de un cero. */
  cuentas?: RedesCuenta[];
  /** Unión del top general y del top por zona, ordenada por (-likes,
   *  -comentarios, url). Cada uno de esos dos cortes reparte una vuelta por
   *  cuenta antes de volver al mérito, para que una cuenta con más seguidores
   *  no se lleve los quince de su ciudad. Filtrar por zona y cortar a
   *  `destacados_maximo` con `seleccionarPublicaciones`, que aplica la misma
   *  regla al corte de región: un `slice` crudo devuelve doce de Tijuana. */
  destacados?: Destacado[];
}

export interface RedesCuenta {
  cuenta: string;
  nombre: string;
  zona: string;
  activa: boolean;
}

/**
 * Un post destacado. `titulo` es la primera línea del pie del MEDIO, no un
 * comentario: es la regla «titular, fuente y liga» aplicada a Instagram.
 *
 * En Instagram la `zona` es la sede de la cuenta, no el tema del post. En
 * TikTok sale del pie del video con el gacetero, y puede valer también
 * `nacional` (el pie no nombró lugar) o `internacional` (residuo de la
 * edición del mundo, desde el 15 de septiembre de 2026). Ninguna de las dos
 * tiene página propia: solo se ven en la vista de región.
 */
export interface Destacado {
  url: string;
  cuenta: string;
  zona: string;
  /** Solo TikTok. El veredicto CRUDO del gacetero sobre el pie, al lado de
   *  `zona` y no en su lugar: con `ambito` los dos dejaron de coincidir, y un
   *  video de Guadalajara en la edición de México queda `zona: "nacional"`
   *  igual que uno que no nombró lugar. De aquí sale la etiqueta: `fuera`
   *  es «fuera del corredor» y `nacional` es «sin lugar». Puede faltar
   *  en un corte anterior al 15 de septiembre de 2026. */
  alcance?: "zona" | "estatal" | "fuera" | "nacional";
  fecha: string;
  titulo: string;
  tipo: "imagen" | "video" | "carrusel" | "otro";
  likes: number;
  /** Total que reporta el actor. */
  comentarios: number;
  /** Solo en video, y solo si es mayor que 0. */
  reproducciones?: number;
  /** Solo TikTok. El @handle de quien publicó el video: la única identidad
   *  que cruza a data/, por decisión del cliente (8 sep 2026). La URL ya lo
   *  trae. Quien comenta nunca. */
  creador?: string;
  /** Fecha-hora exacta de publicación (ISO, UTC); `fecha` es su día. TikTok
   *  siempre; Instagram desde el corte del 10 de septiembre de 2026 (un corte
   *  anterior no la trae y la fila sale sin hora). */
  publicado?: string;
  /** Solo TikTok, que sí los publica: un 0 es cero medido. Instagram no los
   *  expone y su ausencia es «sin dato». */
  compartidos?: number;
  guardados?: number;
  /**
   * Segundos del video. Solo TikTok, y opcional: un corte anterior al 17 de
   * septiembre de 2026 no la trae. Nunca 0 —eso se leería como «video de
   * duración cero» y no como «no la trae»—.
   *
   * No es un dato de pantalla: existe para poder presupuestar lo que Apify
   * cobra por segundo de video (`aiVideoSummary`, `aiVideoDescription`) o por
   * minuto empezado (`transcription-minute`). La tarjeta no la pinta, como no
   * pinta ninguna otra cifra desde ese mismo día.
   */
  duracion?: number;
  /** Comentarios en el caché para este post (≤ comentarios_por_post). */
  cosechados: number;
  /** Con palabras y no repetidos. Lo único sobre lo que hay tono y temas. */
  opinion: number;
  sentimiento: {
    positivo: number;
    negativo: number;
    neutral: number;
    sin_clasificar: number;
    sin_modelo_idioma: number;
  };
  temas: { tema: string; comentarios: number }[];
}

/**
 * `redes-comentarios.json` — el TEXTO de los comentarios más votados por post.
 *
 * Sale a `data/` pero queda fuera de git, y se regenera en cada corrida desde el
 * caché de 30 días (decisión del cliente del 8 de septiembre de 2026; ver el
 * encabezado de `pulso/instagram.py`). Puede faltar en un despliegue hecho
 * desde git puro, y eso no es un error del panel: se dice.
 *
 * Sin identidad: ni usuario, ni id de comentario. Por post, los primeros
 * `visibles` van siempre; del siguiente a `maximo` solo con likes > 0.
 */
export interface ComentarioPublicado {
  texto: string;
  likes: number;
  fecha: string;
  sentimiento: "positivo" | "negativo" | "neutral" | null;
}

export interface DocRedesComentarios {
  esquema: 1;
  generado: string;
  plataforma: PlataformaRedes;
  retencion_dias: 30;
  visibles: number;
  maximo: number;
  por_post: Record<string, ComentarioPublicado[]>;
}

// ------------------------------------------------------------------- roster

export interface Figura {
  id: string;
  nombre: string;
  cargo: string;
  partido: string;
  ambito: string;
  desde: string;
  hasta: string | null;
  alias: string[];
  alias_cargo: string[];
}

export interface DocRoster {
  verificado: string;
  nota: string;
  figuras: Figura[];
}
/** Boletines municipales aislados de las métricas de prensa. */
export interface DocComunicados {
  esquema: 1;
  fuente: { id: "gobtecate"; nombre: "Gobierno de Tecate"; url: string };
  zona: "Tecate";
  modo: "red" | "sin_red";
  consultado: string;
  ultimo_exito: string | null;
  estado: "ok" | "fallo";
  error: string | null;
  comunicados: { id: string; titulo: string; url: string; fecha: string | null }[];
}

// ----------------------------------------------------------- tendencias

/** Una tendencia de X: el puesto que X le dio, el nombre y la liga a su
 *  búsqueda. `volumen` solo cuando X lo publica y es mayor que 0; ausente es
 *  «sin dato», nunca cero (X lo retiró para casi todas en enero de 2026). */
export interface Tendencia {
  puesto: number;
  nombre: string;
  url: string;
  volumen?: number;
}

export type AmbitoTendencias = "zona" | "nacional" | "mundial";
export type EstadoTendencias = "ok" | "fallo" | "sin_token" | "sin_dato" | "sin_lista";

/**
 * Una ubicación para la que X publica (o no) lista de tendencias. Las
 * apagadas viajan también, con `estado: "sin_lista"`: son el registro
 * deliberado de que X no tiene lista para Ensenada, Rosarito, Tecate, San
 * Quintín ni San Felipe, y permiten rotular el hueco en vez de mostrar la
 * lista nacional como si fuera local. `zona` es la del producto cuando
 * `ambito` es «zona»; null para México (`nacional`) y el mundo (`mundial`).
 */
export interface UbicacionTendencias {
  id: string;
  nombre: string;
  woeid: number | null;
  zona: Zona | null;
  ambito: AmbitoTendencias;
  activa: boolean;
  estado: EstadoTendencias;
  /** Hora en que X refrescó la lista (ISO, UTC); null si no llegó. */
  corte: string | null;
  tendencias: Tendencia[];
}

export interface SaludTendencias {
  ubicacion: string;
  estado: Exclude<EstadoTendencias, "sin_lista">;
  tendencias: number;
  /** Anuncios descartados: X marca las tendencias promocionadas. */
  promocionadas: number;
  error?: string;
  nota?: string;
}

/** Tendencias de X por ubicación, leídas sin iniciar sesión (guest token).
 *  Es el ranking de X, no una medida de la ciudad. Ver docs/datos.md. */
export interface DocTendencias {
  esquema: 1;
  generado: string;
  plataforma: "x";
  acceso: "sin_sesion";
  maximo_por_ubicacion: number;
  ubicaciones: UbicacionTendencias[];
  salud: SaludTendencias[];
  gasto: { resultados: number; gastado: number; por_concepto: Record<string, number> };
}

// ------------------------------------------------------- gasto electoral

export interface ProcesoGastoElectoral {
  id: string;
  nombre: string;
  ambito: "local" | "federal";
  estado: "auditado";
  eleccion: string;
  dictamen: string;
  dictamen_url: string;
  corte: string;
}

export interface ProcesoElectoralActual {
  id: string;
  nombre: string;
  estado: string;
  inicio_federal: string;
  inicio_local: string;
  precampana_desde: string;
  campana_desde: string;
  campana_hasta: string;
  eleccion: string;
  fuente: string;
}

export interface CandidaturaGasto {
  id: string;
  proceso: string;
  id_contabilidad: string;
  nombre: string;
  ambito: "local" | "federal";
  cargo: string;
  contienda_id: string;
  contienda: string;
  partido: string;
  sujeto_obligado: string;
  tipo_asociacion: string;
  gasto_reportado: number;
  desglose_reportado: Record<
    | "financieros"
    | "operativos"
    | "radio_tv"
    | "propaganda"
    | "impresos"
    | "via_publica"
    | "cine"
    | "utilitaria"
    | "internet",
    number | null
  >;
  diferencia_prorrateo: number | null;
  auditoria: {
    no_reportado: number | null;
    ajustes_reclasificaciones: number | null;
    quejas: number | null;
    determinado: number;
  };
  gasto_auditado: number;
  tope: number | null;
}

export interface DocGastoElectoral {
  esquema: 1;
  moneda: "MXN";
  procesos: ProcesoGastoElectoral[];
  proceso_actual: ProcesoElectoralActual;
  resumen: {
    filas_origen: number;
    candidaturas: number;
    sin_conciliar: number;
    incidencias: number;
  };
  candidaturas: CandidaturaGasto[];
  incidencias: {
    proceso: string;
    id_contabilidad: string;
    nombre: string;
    razon: string;
  }[];
  fuentes: {
    tipo: "anexo_auditoria" | "reporte_candidaturas" | "reporte_desglose";
    ambito: "local" | "federal";
    url: string;
    archivo?: string;
  }[];
}

export interface FinanciamientoPartido {
  id: string;
  nombre: string;
  ordinario_original: number;
  ordinario_vigente: number;
  especifico: number;
  total_asignado: number;
  ministrado_enero_mayo?: number;
  excedente_ministrado?: number;
}

export interface DocFinanciamientoPartidos {
  esquema: 1;
  ejercicio: number;
  moneda: "MXN";
  corte: string;
  aviso: string;
  acuerdos: { id: string; fecha: string; url: string }[];
  partidos: FinanciamientoPartido[];
  totales: { ordinario_vigente: number; especifico: number; asignado: number };
  fuentes: string[];
}
