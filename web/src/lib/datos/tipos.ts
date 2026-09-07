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
  /** Solo las notas aceptadas por el descubrimiento web transitorio. */
  origen?: "descubrimiento_web";
  descubierta_por?: "gdelt";
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
  metodo?: "rss" | "scrapy" | "descubrimiento";
  /** Cobertura declarada del medio. Opcional porque los cortes viejos no la traen. */
  zona?: Zona | null;
  estado: "ok" | "fallo";
  obtenidas: number;
  nuevas: number;
  ms: number;
  ultima_ok: string | null;
  error: string | null;
  detalle?: {
    candidatos: number;
    publisher_pages: number;
    aceptadas: number;
    rechazadas: number;
    robots_exclusiones: number;
    fallos: number;
  };
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
