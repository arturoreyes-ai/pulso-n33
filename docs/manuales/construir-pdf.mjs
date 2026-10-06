// Genera docs/manuales/pdf/*.pdf a partir de los Markdown de esta carpeta.
//
// Sin dependencias: exporta los diagramas de draw.io a PNG, arma un HTML por
// documento que dibuja el Markdown con marked (cdn.jsdelivr.net) y lo imprime
// con Chrome o Edge en modo headless. Necesita red para marked y el visor.
//
//   node docs/manuales/construir-pdf.mjs
//
// Los enlaces entre manuales apuntan a los .md; en el PDF quedan como texto
// subrayado, que es lo que se quiere al imprimir.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const aqui = dirname(fileURLToPath(import.meta.url));
const salida = join(aqui, "pdf");
const temporal = join(tmpdir(), "pulso-manuales");
mkdirSync(salida, { recursive: true });
mkdirSync(temporal, { recursive: true });

const navegadores = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const navegador = navegadores.find((r) => existsSync(r));
if (!navegador) {
  console.error("No encontré Chrome ni Edge. Define CHROME con la ruta.");
  process.exit(1);
}

const estilo = `
  @page { size: Letter; margin: 18mm 16mm 20mm; }
  body { font: 10.5pt/1.5 "Segoe UI", system-ui, sans-serif; color: #1b1b1b; max-width: 100%; }
  h1 { font-size: 22pt; margin: 0 0 4pt; letter-spacing: -0.01em; }
  h2 { font-size: 14pt; margin: 20pt 0 6pt; border-bottom: 1px solid #ddd; padding-bottom: 3pt; break-after: avoid; }
  h3 { font-size: 11.5pt; margin: 14pt 0 4pt; break-after: avoid; }
  p, li { orphans: 3; widows: 3; }
  a { color: inherit; }
  code { font: 9pt Consolas, monospace; background: #f2f2f2; padding: 0 3px; border-radius: 3px; }
  pre { background: #f5f5f5; padding: 8pt 10pt; border-radius: 4px; overflow-wrap: anywhere; white-space: pre-wrap; break-inside: avoid; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 6pt 0 10pt; font-size: 9.5pt; break-inside: auto; }
  tr { break-inside: avoid; }
  th, td { border: 1px solid #d6d6d6; padding: 4pt 6pt; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; }
  blockquote { margin: 8pt 0; padding: 6pt 10pt; border-left: 3px solid #c0392b; background: #fbf3f2; }
  blockquote p { margin: 0; }
  hr { border: 0; border-top: 1px solid #ddd; margin: 16pt 0; }
  img { max-width: 100%; height: auto; display: block; margin: 10pt auto; break-inside: avoid; }
`;

// Los diagramas son archivos de draw.io (diagramas/*.drawio), editables en
// diagrams.net. Aqui se exportan a PNG con el visor oficial de draw.io, para
// que el Markdown y el PDF muestren exactamente lo que abre draw.io.
const carpetaDiagramas = join(aqui, "diagramas");
for (const archivo of readdirSync(carpetaDiagramas).filter((a) => a.endsWith(".drawio"))) {
  const xml = readFileSync(join(carpetaDiagramas, archivo), "utf8");
  const ancho = Number(xml.match(/pageWidth="(\d+)"/)?.[1] ?? 1100);
  const alto = Number(xml.match(/pageHeight="(\d+)"/)?.[1] ?? 800);
  const config = JSON.stringify({ xml, toolbar: "", lightbox: false, nav: false, resize: false, border: 0 });
  const html = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#fff}</style></head><body>
<div class="mxgraph" data-mxgraph="${config.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"></div>
<script src="https://viewer.diagrams.net/js/viewer-static.min.js"></script></body></html>`;
  const temporalHtml = join(temporal, basename(archivo, ".drawio") + "-diagrama.html");
  writeFileSync(temporalHtml, html);
  const png = join(carpetaDiagramas, basename(archivo, ".drawio") + ".png");
  execFileSync(navegador, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
    `--window-size=${ancho},${alto}`, "--virtual-time-budget=20000", `--screenshot=${png}`,
    pathToFileURL(temporalHtml).href,
  ], { stdio: "ignore" });
  console.log("escrito", png);
}

const documentos = readdirSync(aqui).filter((a) => /^\d\d-.*\.md$/.test(a)).sort();

for (const archivo of documentos) {
  const md = readFileSync(join(aqui, archivo), "utf8");
  const titulo = (md.match(/^# (.+)$/m)?.[1] ?? archivo).trim();
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${titulo}</title><base href="${pathToFileURL(aqui).href}/"><style>${estilo}</style>
<script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"></script>
</head><body><main id="c"></main>
<script>
  const md = ${JSON.stringify(md)};
  document.getElementById("c").innerHTML = marked.parse(md, { gfm: true });
</script></body></html>`;
  const temporalHtml = join(temporal, basename(archivo, ".md") + ".html");
  writeFileSync(temporalHtml, html);
  const pdf = join(salida, basename(archivo, ".md") + ".pdf");
  execFileSync(navegador, [
    "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
    "--virtual-time-budget=20000", `--print-to-pdf=${pdf}`,
    pathToFileURL(temporalHtml).href,
  ], { stdio: "ignore" });
  console.log("escrito", pdf);
}
