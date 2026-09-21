/**
 * Trae los componentes de pdfcn (base Takumi) a src/pdfcn/.
 *
 *   node scripts/sincronizar-pdfcn.mjs
 *
 * POR QUE NO `npx shadcn add`. Se probo el 18 de septiembre de 2026 con un
 * components.json cuyos alias apuntaban a `@/pdfcn/...`, y el CLI hizo dos
 * cosas que no sirven aqui: (1) ignoro los alias para colocar los archivos,
 * porque cada item del registro trae un `target` explicito (`components/pdf/x`,
 * `lib/x`) que el CLI resuelve contra la raiz de src/, asi que los archivos
 * caian en src/components/pdf y src/lib, mezclados con los nuestros; y (2)
 * reescribio los imports `@/registry/types/pdf-themes` y
 * `@/registry/types/pdf-components` a rutas que no existen
 * (`@/pdfcn/components/pdf-themes`), porque esos dos modulos NO estan en el
 * registro: viven solo en el repositorio de pdfcn (apps/web/registry/types/).
 * El resultado no compilaba.
 *
 * Aqui se hace a mano lo que el CLI prometia: se baja cada item, se escribe
 * cada archivo bajo src/pdfcn/<target> y se reescriben los imports con la
 * tabla de abajo. Los dos modulos de tipos ausentes se bajan del repositorio
 * (rama main) y se dejan en src/pdfcn/types/.
 *
 * Los identificadores de esos archivos son los de pdfcn, en ingles, y NO se
 * traducen: es codigo de terceros bajo licencia MIT y volver a sincronizar
 * tiene que ser un `node` y un diff legible, no una traduccion. Es la unica
 * excepcion a la regla de identificadores en espanol de AGENTS.md, y esta
 * acotada a esta carpeta. Lo nuestro vive en lib/informe/ y components/informe/.
 */

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const RAIZ = path.join(import.meta.dirname, "..", "src", "pdfcn");
const REGISTRO = "https://www.pdfcn.dev/r/takumi";
const REPOSITORIO = "https://raw.githubusercontent.com/shadcn-labs/pdfcn/main/apps/web";

/** Los items que usa components/informe/informe-consulta.tsx, mas `table`,
 *  del que depende data-table. Agregar uno aqui y volver a correr. */
const ITEMS = [
  "utils", "theme-provider", "theme-professional", "table",
  "heading", "text", "section", "data-table", "key-value", "list", "badge",
  "graph", "page-header", "page-footer", "page-number", "divider", "stack",
  "keep-together", "alert",
];

/** Los dos modulos que los componentes importan y el registro no publica. */
const TIPOS = ["pdf-components.ts", "pdf-themes.ts"];

/**
 * De donde importa el codigo del registro a donde queda aqui. El orden
 * importa: el prefijo mas largo primero, para que `themes/professional` no
 * caiga en la regla de `themes`.
 *
 * `@/registry/themes` (el indice) no existe en el registro ni en el repo; lo
 * unico que se importa de el es `professionalTheme`, asi que apunta al tema.
 */
const IMPORTS = [
  ["@/registry/bases/takumi/components/", "@/pdfcn/components/pdf/"],
  ["@/registry/bases/takumi/lib/", "@/pdfcn/lib/"],
  ["@/registry/themes/professional", "@/pdfcn/components/pdf/theme-professional"],
  ["@/registry/themes", "@/pdfcn/components/pdf/theme-professional"],
  ["@/registry/types/", "@/pdfcn/types/"],
];

/**
 * Cabecera de cada archivo copiado. `@ts-nocheck` porque este codigo esta
 * escrito contra un tsconfig SIN `noUncheckedIndexedAccess` y el nuestro lo
 * tiene: la primera sincronizacion dejo veintidos errores «possibly undefined»
 * en graph.utils.ts y graph.tsx, todos de acceso por indice, ninguno nuestro
 * ni corregible sin editar a mano lo que la siguiente sincronizacion pisa. Se
 * trata como una libreria: lo que se verifica es el codigo que la usa
 * (lib/informe/, components/informe/), y probar-informe.cjs renderiza un PDF
 * de verdad con estos componentes, que es la prueba que un tipo no da.
 */
const CABECERA = [
  "// @ts-nocheck -- copia de pdfcn (MIT), escrita por scripts/sincronizar-pdfcn.mjs.",
  "// No se edita a mano: la siguiente sincronizacion la pisa. Ver src/pdfcn/README.md.",
  "",
].join("\n");

function reescribir(contenido) {
  const conImports = contenido.replace(/from "(@\/registry\/[^"]+)"/g, (todo, origen) => {
    for (const [de, a] of IMPORTS) {
      if (origen.startsWith(de)) return `from "${a}${origen.slice(de.length)}"`;
    }
    throw new Error(`import sin regla: ${origen}`);
  });
  return CABECERA + conImports;
}

async function bajar(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r;
}

// Se borra y se reescribe entero: una sincronizacion tiene que dejar
// exactamente lo que el registro publica hoy, sin restos de un item que se
// dejo de usar. El README se vuelve a escribir tambien, desde aqui.
await rm(RAIZ, { recursive: true, force: true });

const escritos = new Map();
for (const nombre of ITEMS) {
  const item = await (await bajar(`${REGISTRO}/${nombre}.json`)).json();
  for (const archivo of item.files) {
    const destino = path.join(RAIZ, archivo.target);
    if (escritos.has(destino) && escritos.get(destino) !== archivo.content) {
      throw new Error(`${archivo.target} llega distinto desde dos items`);
    }
    escritos.set(destino, archivo.content);
  }
}
for (const tipo of TIPOS) {
  const contenido = await (await bajar(`${REPOSITORIO}/registry/types/${tipo}`)).text();
  escritos.set(path.join(RAIZ, "types", tipo), contenido);
}

for (const [destino, contenido] of escritos) {
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, reescribir(contenido), "utf8");
}

const LEEME = `# pdfcn (base Takumi)

Copia de los componentes de [pdfcn](https://www.pdfcn.dev), un registro de
shadcn para armar PDFs con JSX sobre \`takumi-pdf\`. Licencia MIT (Shadcn
Labs). Los trae \`scripts/sincronizar-pdfcn.mjs\`, que explica por que no se
usa el CLI de shadcn.

**No se edita a mano.** Una sincronizacion borra esta carpeta entera y la
vuelve a escribir con lo que el registro publica ese dia; lo que se cambie
aqui se pierde. Los identificadores son los de pdfcn, en ingles, y no se
traducen: es la unica excepcion a la regla de identificadores en espanol de
AGENTS.md, acotada a esta carpeta. Cada archivo abre con \`@ts-nocheck\`: pdfcn
compila sin \`noUncheckedIndexedAccess\` y este repo con el, y se trata como una
libreria; lo que se tipa es el codigo que la usa.

Lo nuestro vive fuera: el tema propio (Geist, los colores del tablero) en
\`src/lib/informe/tema.ts\`, las fuentes en \`src/lib/informe/fuentes.ts\` y el
documento en \`src/components/informe/\`. Esos archivos importan de aqui; nada
de aqui importa de ellos.

Para volver a sincronizar: \`node scripts/sincronizar-pdfcn.mjs\` desde \`web/\`,
luego \`pnpm tipos\` y \`node scripts/probar-informe.cjs\`. Los items que se
bajan estan listados en el script; \`types/\` son dos modulos que el registro
no publica y se bajan del repositorio de pdfcn.

Version de referencia: takumi-pdf 0.14.3, sincronizado el ${new Date().toISOString().slice(0, 10)}.
`;
await writeFile(path.join(RAIZ, "README.md"), LEEME, "utf8");

console.log(`pdfcn: ${escritos.size} archivos en src/pdfcn/ (${ITEMS.length} items + ${TIPOS.length} tipos).`);
