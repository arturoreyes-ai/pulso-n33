/**
 * Guardia de escalas.
 *
 * Un barrido de tokens se deshace solo. Alguien con prisa escribe
 * `text-white/45` una vez, nadie lo nota en la revision porque se ve casi
 * igual, y en seis meses hay catorce pasos otra vez. Esta es la mitad
 * duradera del trabajo: el navegador prueba ESTE barrido, el script prueba
 * todos los commits que vienen.
 *
 * Corre junto a `tipos`:  pnpm tokens
 *
 * Cada regla explica QUE valor se espera en su lugar, porque un error de lint
 * que no dice como arreglarlo se termina silenciando.
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const RAIZ = path.join(import.meta.dirname, "..", "src");

/**
 * Lineas que pueden saltarse una regla, con el motivo.
 *
 * `nota` no es decorativa: una excepcion sin motivo escrito es una regla que
 * todavia no se ha entendido. Se compara por SUFIJO de ruta y por el nombre
 * de la regla, no por numero de linea, para que no caduque al editar arriba.
 */
const EXCEPCIONES = [
  {
    archivo: "components/ui/bisel.tsx",
    regla: "radio",
    nota: "Es el unico que puede nombrar un radio: es quien define los niveles.",
  },
  {
    archivo: "components/ui/primitivas.tsx",
    regla: "duracion",
    nota: "Barra anima un VALOR DE DATO al cambiar el filtro, no un hover.",
  },
  {
    archivo: "components/chrome/velo.tsx",
    regla: "rgb-crudo",
    nota: "El degradado ES --color-vanta a distintos alfas; un token por parada seria peor.",
  },
  {
    archivo: "components/chrome/malla.tsx",
    regla: "rgb-crudo",
    nota: "Los orbes se consumen como rgb(var(--color-orbe-x) / a), que es el patron correcto.",
  },
];

/** Las reglas. `patron` debe traer la bandera global. */
const REGLAS = [
  {
    nombre: "tinta",
    patron:
      /(?:^|[\s"'`:])(?:group-hover:|hover:|focus:|placeholder:|md:|sm:|lg:|max-sm:)*(?:text|fill|stroke|decoration)-white(?:\/(?:\[[\d.]+\]|\d+))?/g,
    dice: "Usa la escala de tinta: text-tinta-titulo | -dato | -prosa | -meta | -inerte.",
  },
  {
    nombre: "superficie",
    patron:
      /(?:^|[\s"'`:])(?:group-hover:|hover:|focus:|md:|sm:|lg:|max-sm:)*(?:bg|border|divide|ring)-white(?:\/(?:\[[\d.]+\]|\d+))?/g,
    // `bg-white` a secas es una INVERSION deliberada (el salto al contenido),
    // no un paso de una escala translucida. Solo se vigilan los que traen alfa.
    exento: (m) => /-white$/.test(m.trim()),
    dice: "Usa la escala de superficie: vela (pelo) | filo (borde) | realce (activo).",
  },
  {
    nombre: "tamano",
    patron: /(?:^|[\s"'`:])(?:md:|sm:|lg:|max-sm:)*text-(?:\[\d+px\]|2xs|xs|sm|base|lg|[2-9]xl)\b/g,
    dice: "Usa la escala de texto: text-meta | -cuerpo | -lectura | -rotulo | -cifra | -seccion | -hero.",
  },
  {
    nombre: "radio",
    patron: /(?:^|[\s"'`:])(?:md:|sm:|lg:)*rounded(?:-\[[^\]]+\]|-(?:sm|md|lg|xl|[2-4]xl))?(?=[\s"'`]|$)/g,
    // rounded-full es una CATEGORIA ("esto se pulsa"), no un paso. Se permite.
    exento: (m) => /rounded-(?:full|none)/.test(m),
    dice: "Usa la escala de radio: rounded-marco | -panel | -nucleo | -etiqueta, o rounded-full si se pulsa.",
  },
  {
    nombre: "duracion",
    patron: /(?:^|[\s"'`:])duration-(?:\d+|\[\d+m?s\])/g,
    dice: "Usa duration-[var(--dur-toque)] | (--dur-cambio) | (--dur-entrada).",
  },
  {
    nombre: "metrica",
    // El final va con lookahead y no con \b: despues de un ']' no hay
    // frontera de palabra, asi que `leading-[0.95]` se colaba entero.
    patron: /(?:^|[\s"'`:])(?:md:|sm:|lg:)*(?:tracking|leading)-(?:\[[^\]]+\]|tight|tighter|snug|normal|relaxed|loose|none)(?=[\s"'`]|$)/g,
    dice: "El interlineado y el tracking van horneados en el paso de texto; si hace falta otro, el paso esta mal elegido.",
  },
  {
    nombre: "rgb-crudo",
    patron: /rgba?\(\s*255[\s,]+255[\s,]+255\s*[/,]/g,
    dice: "Un alfa de blanco en JS no lo ve ningun grep de clases. Usa var(--color-tinta-*) o var(--color-vela).",
  },
  {
    nombre: "rojo-de-texto",
    patron: /\btext-chart-1(?:\/\d+)?(?=[\s"'`]|$)/g,
    dice: "#E0342B mide 4.42:1 sobre carta: no pasa AA a tamano de cuerpo. Usa text-chart-1-texto.",
  },
  {
    nombre: "alfa-sobre-token",
    patron: /\b(?:text|bg|border|fill|stroke|decoration)-(?:tinta-\w+|vela|filo|realce)\/\d+/g,
    dice: "PROHIBIDO: el token ya trae alfa y Tailwind lo compone con color-mix, dando un valor fuera de escala en silencio.",
  },
];


/**
 * Autoprueba. Una guardia que deja de vigilar EN SILENCIO es peor que no
 * tenerla: da luz verde. Ya paso una vez —un \b de una regex acabo
 * escrito como el caracter de retroceso 0x08, la regla dejo de casar con
 * nada y el informe salio limpio—, asi que cada regla trae aqui un ejemplo
 * que TIENE que marcar. Corre antes del analisis de verdad.
 */
const MUESTRAS = {
  tinta: "className=\"text-white/45\"",
  superficie: "className=\"bg-white/[0.04]\"",
  tamano: "className=\"text-xs\"",
  radio: "className=\"rounded-2xl\"",
  duracion: "className=\"duration-700\"",
  metrica: "className=\"leading-snug\"",
  "rgb-crudo": "const c = \"rgb(255 255 255 / 0.5)\";",
  "rojo-de-texto": "className=\"text-chart-1\"",
  "alfa-sobre-token": "className=\"text-tinta-prosa/80\"",
};

const rotas = REGLAS.filter((r) => {
  const m = MUESTRAS[r.nombre];
  if (m === undefined) return true;
  r.patron.lastIndex = 0;
  return ![...m.matchAll(r.patron)].some((x) => !r.exento?.(x[0].trim()));
}).map((r) => r.nombre);

if (rotas.length > 0) {
  console.error(
    `verificar-tokens: ${rotas.length} regla(s) no marcan su propia muestra y por tanto no vigilan nada: ${rotas.join(", ")}.`,
  );
  process.exit(2);
}

const EXTS = new Set([".ts", ".tsx", ".css"]);

async function* archivos(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* archivos(p);
    else if (EXTS.has(path.extname(e.name))) yield p;
  }
}

const exento = (rel, regla) =>
  EXCEPCIONES.some((x) => rel.endsWith(x.archivo) && x.regla === regla);

const hallazgos = [];

for await (const abs of archivos(RAIZ)) {
  const rel = path.relative(RAIZ, abs).split(path.sep).join("/");
  const texto = await readFile(abs, "utf8");
  // globals.css es donde VIVEN las escalas; se salta entero.
  if (rel === "app/globals.css") continue;
  // src/pdfcn/ es codigo de terceros (pdfcn, MIT) copiado tal cual por
  // scripts/sincronizar-pdfcn.mjs para armar el PDF del informe. Sus clases
  // son las de un documento impreso, no las del tablero, y una sincronizacion
  // las vuelve a escribir: vigilarlas seria pelear con el proveedor en cada
  // actualizacion. Lo nuestro (lib/informe/, components/informe/) si se vigila.
  if (rel.startsWith("pdfcn/")) continue;

  const lineas = texto.split(/\r?\n/);
  for (const regla of REGLAS) {
    if (exento(rel, regla.nombre)) continue;
    lineas.forEach((linea, i) => {
      if (/^\s*(?:\*|\/\/|\/\*)/.test(linea)) return; // comentarios: son prosa
      for (const m of linea.matchAll(regla.patron)) {
        const hit = m[0].trim();
        if (regla.exento?.(hit)) continue;
        hallazgos.push({ archivo: rel, linea: i + 1, regla: regla.nombre, hit, dice: regla.dice });
      }
    });
  }
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(hallazgos, null, 2));
} else if (hallazgos.length === 0) {
  console.log("tokens ok — ningun valor fuera de escala.");
} else {
  const porRegla = new Map();
  const porArchivo = new Map();
  for (const h of hallazgos) {
    porRegla.set(h.regla, (porRegla.get(h.regla) ?? 0) + 1);
    porArchivo.set(h.archivo, (porArchivo.get(h.archivo) ?? 0) + 1);
  }
  console.log(`${hallazgos.length} valores fuera de escala.\n`);
  console.log("por regla:");
  for (const [r, n] of [...porRegla].sort((a, b) => b[1] - a[1])) {
    const dice = REGLAS.find((x) => x.nombre === r).dice;
    console.log(`  ${String(n).padStart(4)}  ${r.padEnd(18)} ${dice}`);
  }
  console.log("\npor archivo:");
  for (const [f, n] of [...porArchivo].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${f}`);
  }
  if (process.argv.includes("--detalle")) {
    console.log("");
    for (const h of hallazgos) console.log(`  ${h.archivo}:${h.linea}  [${h.regla}]  ${h.hit}`);
  }
}

process.exit(hallazgos.length === 0 || process.argv.includes("--informe") ? 0 : 1);
