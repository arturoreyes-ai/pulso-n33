import { CONSEJO_IA, NOMBRE_PROGRAMA, ROTULO_IA, type Guion } from "./contrato-guion";

/**
 * El guion como documento: el texto que «Copiar guion» deja en el
 * portapapeles y el Word que «Descargar» guarda, armados de UNA estructura
 * (`seccionesDelGuion`) por la razon de redes.py::zona_por_ambito: copiada dos
 * veces, una correccion llega a una sola.
 *
 * WORD Y NO .txt desde el 28 de septiembre de 2026, a pedido del cliente: los
 * conductores editan el guion con su propio giro, y en un .docx lo que se dice
 * y lo que se acota llegan ya separados por estilo, los enlaces se abren con
 * un clic y Word revisa la ortografia en español. Del 25 al 28 fue un .txt
 * con BOM, que abria en cualquier lado y en Word llegaba plano.
 *
 * SIN DEPENDENCIA. Un .docx es un zip de cinco XML, y aqui se escribe tal
 * cual, sin comprimir (`zipGuardado`): la misma postura con que pulso/ abre un
 * XLSX como el zip de XML que es en vez de cargar openpyxl. Una biblioteca de
 * Word para el navegador pesa cientos de KB por un boton; esto, unos pocos.
 * Word no exige compresion, ni docProps, ni settings: con [Content_Types],
 * las dos relaciones, el documento y los estilos abre y se edita normal.
 *
 * Puro: ni `window` ni el reloj. La fecha llega escrita y el enlace entero lo
 * resuelve quien llama, que tiene el origen.
 */

/**
 * Un renglon del guion y lo que es. `dicho` es lo que el conductor dice y
 * `pase` la frase corta que da paso al clip; `acotacion` se lee y no se dice
 * (APERTURA, CLIP, ENLACE, A LA MESA); `escaleta` encabeza cada pieza,
 * `hueco` dice lo que falto y `aviso` que lo escribio una IA. Es la
 * tipografia de la pantalla, pasada a estilos.
 */
export interface Bloque {
  tipo: "programa" | "aviso" | "escaleta" | "acotacion" | "dicho" | "pase" | "hueco";
  texto: string;
  /** Solo una acotacion: el enlace de la pieza, que en Word se abre con un clic. */
  url?: string;
}

/** Un eje sin material, en palabras: lo dicen la pantalla, el texto y el Word. */
export const VACIO_GUION: Record<Guion["origen"], string> = {
  tiktok: "Sin videos hoy",
  prensa: "Sin notas hoy",
  redes: "Sin publicaciones hoy",
  mixto: "Sin publicaciones ni notas hoy",
};

/** Una pieza propia (la de garitas) enlaza a una ruta nuestra, relativa. */
const propia = (url: string) => url.startsWith("/");

/**
 * El guion por secciones: el programa, la apertura, cada pieza, el cierre y
 * cada hueco. Recibe el guion como se ve (con la nota de garitas delante y las
 * notas ampliadas en su lugar) y `enlaceEntero`, porque «/garitas» en un
 * archivo no lleva a ninguna parte. Una pieza sin pase es una nota leida; en
 * el mixto, un clip sin nota lo dice.
 */
export function seccionesDelGuion(guion: Guion, enlaceEntero: (url: string) => string): Bloque[][] {
  const piezas = guion.clips.map((c, i): Bloque[] => {
    const clip = c.pase !== null;
    const sinNota = guion.origen === "mixto" && clip && c.nota === null;
    return [
      { tipo: "escaleta", texto: `${clip ? "CLIP" : "NOTA"} ${i + 1} · ${c.eje}${c.libre ? " · libre" : ""} · ${c.titular}` },
      ...(sinNota ? [{ tipo: "acotacion", texto: "SIN NOTA DE PRENSA" } as const] : []),
      { tipo: "dicho", texto: c.entrada },
      ...(c.pase === null ? [] : [
        { tipo: "pase", texto: c.pase } as const,
        { tipo: "acotacion", texto: `CLIP: ${c.fuente.fuente}`, url: c.fuente.url } as const,
      ]),
      { tipo: "dicho", texto: c.salida },
      ...(c.pregunta === null ? [] : [{ tipo: "acotacion", texto: "A LA MESA" } as const, { tipo: "dicho", texto: c.pregunta } as const]),
      // El enlace va sin el nombre del medio: el guion no cita fuentes, y el
      // enlace es para leer la nota, no para decirla.
      ...(!clip ? [{ tipo: "acotacion", texto: "ENLACE:", url: enlaceEntero(c.fuente.url) } as const]
        : c.nota === null ? [] : [{ tipo: "acotacion", texto: "ENLACE:", url: enlaceEntero(c.nota.url) } as const]),
    ];
  });
  return [
    [{ tipo: "programa", texto: NOMBRE_PROGRAMA[guion.programa] }, { tipo: "aviso", texto: `${ROTULO_IA}. ${CONSEJO_IA}` }],
    [{ tipo: "acotacion", texto: "APERTURA" }, { tipo: "dicho", texto: guion.apertura }],
    ...piezas,
    [{ tipo: "acotacion", texto: "CIERRE" }, { tipo: "dicho", texto: guion.cierre }],
    ...(guion.faltantes.length === 0 ? [] : [[{ tipo: "hueco", texto: `${VACIO_GUION[guion.origen]}: ${guion.faltantes.join(", ")}.` } as const]]),
    ...(guion.sinLeer.length === 0 ? [] : [[{ tipo: "hueco", texto: `No se pudieron leer: ${guion.sinLeer.join(", ")}.` } as const]]),
  ];
}

/** El guion como texto para la mesa de edicion y el teleprompter, con las
 *  acotaciones entre corchetes a la manera de un guion de television. */
export function textoPlano(secciones: readonly (readonly Bloque[])[]): string {
  const renglon = (b: Bloque) => (b.tipo === "acotacion" || b.tipo === "aviso" ? `[${b.texto}${b.url === undefined ? "" : ` ${b.url}`}]` : b.texto);
  return secciones.map((s) => s.map(renglon).join("\n\n")).join("\n\n---\n\n");
}

// === El Word ===============================================================

export const TIPO_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Lo que XML no admite ni escapado (los controles fuera de tab y salto), y
 *  el escape de lo demas. Un pie de redes puede traer cualquier cosa. */
const xml = (s: string) =>
  s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const CABEZA = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/**
 * Los estilos, que son la tipografia de la pantalla: lo dicho en cuerpo de
 * lectura (13 pt, para leerse de pie), el pase en cursiva, las acotaciones en
 * pequeño y en gris, la escaleta como «Título 2» para que el panel de
 * navegacion de Word liste las piezas. Idioma es-MX, para que Word revise la
 * ortografia en español y no marque cada palabra.
 */
const ESTILOS = `${CABEZA}<w:styles xmlns:w="${W}">`
  + `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="es-MX" w:eastAsia="es-MX" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>`
  + `<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>`
  + `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>`
  + `<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="60"/></w:pPr><w:rPr><w:b/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr></w:style>`
  + `<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="480" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>`
  + `<w:style w:type="paragraph" w:customStyle="1" w:styleId="Acotacion"><w:name w:val="Acotación"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/></w:pPr><w:rPr><w:color w:val="6B6B6B"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>`
  + `<w:style w:type="paragraph" w:customStyle="1" w:styleId="Pase"><w:name w:val="Pase"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:i/><w:iCs/></w:rPr></w:style>`
  + `<w:style w:type="paragraph" w:customStyle="1" w:styleId="AvisoIA"><w:name w:val="Aviso de IA"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="6B6B6B"/></w:pBdr><w:spacing w:before="120" w:after="240"/></w:pPr><w:rPr><w:b/><w:bCs/></w:rPr></w:style>`
  + `<w:style w:type="paragraph" w:customStyle="1" w:styleId="NotaEquipo"><w:name w:val="Nota del equipo"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:color w:val="6B6B6B"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>`
  + `<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>`
  + `</w:styles>`;

const TIPOS = `${CABEZA}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
  + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
  + `<Default Extension="xml" ContentType="application/xml"/>`
  + `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>`
  + `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>`
  + `</Types>`;

const RAIZ = `${CABEZA}<Relationships xmlns="${REL}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`;

const ESTILO: Record<Bloque["tipo"], string | null> = {
  programa: "Title",
  escaleta: "Heading2",
  acotacion: "Acotacion",
  dicho: null,
  pase: "Pase",
  hueco: "NotaEquipo",
  aviso: "AvisoIA",
};

/**
 * El guion como .docx: los bytes del archivo. `fecha` es la del programa ya
 * escrita («28 de septiembre de 2026»); va bajo el nombre del programa, y
 * debajo el aviso de IA en negritas y con filete, que la pantalla dice y el
 * archivo no puede callar.
 */
export function documentoWord(secciones: readonly (readonly Bloque[])[], fecha: string): Uint8Array<ArrayBuffer> {
  const enlaces: string[] = [];
  const texto = (t: string) => `<w:r><w:t xml:space="preserve">${xml(t)}</w:t></w:r>`;
  const parrafo = (b: Bloque) => {
    const estilo = ESTILO[b.tipo];
    const pPr = estilo === null ? "" : `<w:pPr><w:pStyle w:val="${estilo}"/></w:pPr>`;
    if (b.tipo !== "acotacion") return `<w:p>${pPr}${texto(b.texto)}</w:p>`;
    if (b.url === undefined) return `<w:p>${pPr}${texto(`[${b.texto}]`)}</w:p>`;
    enlaces.push(b.url);
    const id = `rIdEnlace${enlaces.length}`;
    const vinculo = `<w:hyperlink r:id="${id}" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr><w:t xml:space="preserve">${xml(b.url)}</w:t></w:r></w:hyperlink>`;
    return `<w:p>${pPr}${texto(`[${b.texto} `)}${vinculo}${texto("]")}</w:p>`;
  };
  const subtitulo = `<w:p><w:pPr><w:pStyle w:val="NotaEquipo"/></w:pPr>${texto(`Guion para locución · ${fecha}`)}</w:p>`;
  const cuerpo = secciones.flatMap((s) => s.flatMap((b) => (b.tipo === "programa" ? [parrafo(b), subtitulo] : [parrafo(b)]))).join("");
  // Carta, que es el papel de Mexico, con una pulgada de margen.
  const documento = `${CABEZA}<w:document xmlns:w="${W}" xmlns:r="${R}"><w:body>${cuerpo}`
    + `<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`
    + `</w:body></w:document>`;
  const relaciones = `${CABEZA}<Relationships xmlns="${REL}"><Relationship Id="rIdEstilos" Type="${R}/styles" Target="styles.xml"/>`
    + enlaces.map((u, i) => `<Relationship Id="rIdEnlace${i + 1}" Type="${R}/hyperlink" Target="${xml(u)}" TargetMode="External"/>`).join("")
    + `</Relationships>`;
  return zipGuardado([
    ["[Content_Types].xml", TIPOS],
    ["_rels/.rels", RAIZ],
    ["word/document.xml", documento],
    ["word/_rels/document.xml.rels", relaciones],
    ["word/styles.xml", ESTILOS],
  ]);
}

// === El zip ================================================================

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of datos) c = TABLA_CRC[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Un zip sin comprimir («stored», metodo 0): cabecera local y datos por
 * archivo, el directorio central y su fin, como los describe la APPNOTE de
 * PKWARE. Fecha fija, el 1 de enero de 1980, la primera que el formato puede
 * escribir: la misma entrada da los mismos bytes, y probar-analisis.cjs lo
 * aprovecha. Nombres ASCII, asi que no hace falta la bandera de UTF-8.
 */
function zipGuardado(archivos: readonly (readonly [string, string])[]): Uint8Array<ArrayBuffer> {
  const utf8 = new TextEncoder();
  const FECHA_DOS = (0 << 9) | (1 << 5) | 1;
  const partes = archivos.map(([nombre, contenido]) => ({ nombre: utf8.encode(nombre), datos: utf8.encode(contenido) }));
  const locales = partes.reduce((n, p) => n + 30 + p.nombre.length + p.datos.length, 0);
  const central = partes.reduce((n, p) => n + 46 + p.nombre.length, 0);
  const salida = new Uint8Array(locales + central + 22);
  const vista = new DataView(salida.buffer);
  let i = 0;
  const u16 = (v: number) => { vista.setUint16(i, v, true); i += 2; };
  const u32 = (v: number) => { vista.setUint32(i, v, true); i += 4; };
  const bytes = (b: Uint8Array) => { salida.set(b, i); i += b.length; };
  const desplazamientos: number[] = [];
  const crcs = partes.map((p) => crc32(p.datos));
  partes.forEach((p, n) => {
    desplazamientos.push(i);
    u32(0x04034b50); u16(20); u16(0); u16(0); u16(0); u16(FECHA_DOS);
    u32(crcs[n]!); u32(p.datos.length); u32(p.datos.length); u16(p.nombre.length); u16(0);
    bytes(p.nombre); bytes(p.datos);
  });
  const inicioCentral = i;
  partes.forEach((p, n) => {
    u32(0x02014b50); u16(20); u16(20); u16(0); u16(0); u16(0); u16(FECHA_DOS);
    u32(crcs[n]!); u32(p.datos.length); u32(p.datos.length); u16(p.nombre.length); u16(0); u16(0);
    u16(0); u16(0); u32(0); u32(desplazamientos[n]!);
    bytes(p.nombre);
  });
  const largoCentral = i - inicioCentral;
  u32(0x06054b50); u16(0); u16(0); u16(partes.length); u16(partes.length); u32(largoCentral); u32(inicioCentral); u16(0);
  return salida;
}
