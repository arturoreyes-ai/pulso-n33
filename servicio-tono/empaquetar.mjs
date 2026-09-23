// Prepara la funcion de Python del servicio de tono (servicio-tono/api/tono.py).
//
// Es el `buildCommand` de su proyecto de Vercel (servicio-tono/vercel.json),
// que es OTRO proyecto que el tablero, a proposito: con la funcion dentro de
// web/, el despliegue del sitio detectaria una funcion de Python e instalaria
// torch en cada push a main, y un paquete de mas de 250 MB rompe ese build.
// Aparte, el sitio se despliega igual que siempre y solo sabe la URL del tono.
//
// Dos cosas, las dos generadas y fuera de git (.gitignore de la raiz):
//
//  1. SIEMPRE: copia pulso/tono.py, sentimiento.py y normalizar.py a
//     api/_pulso/pulso/. Es una copia y no un modulo propio: el tono en vivo
//     tiene que salir del MISMO codigo que etiqueta la cosecha (el porque, en
//     pulso/tono.py). Cuesta milisegundos.
//
//  2. Solo con TONO_EMPAQUETAR=1: baja el modelo de Hugging Face a
//     api/_modelo/ con la forma del cache de huggingface_hub, para que la
//     funcion arranque sin red (HF_HUB_OFFLINE en api/tono.py). Son ~430 MB,
//     asi que no se hace en local: solo en el proyecto que sirve el tono, donde
//     se enciende la variable.
//
// Falla ruidosamente si pide el modelo y no lo consigue: una funcion sin
// modelo contestaria 500 en cada busqueda, y el sitio diria «sin tono» en
// silencio para siempre.

import { access, copyFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const PULSO = new URL("../pulso/", import.meta.url);
const DESTINO = new URL("./api/_pulso/pulso/", import.meta.url);
const MODELO = "pysentimiento/robertuito-sentiment-analysis";
const CACHE = new URL("./api/_modelo/hub/", import.meta.url);

async function existe(url) {
  try {
    await access(url);
    return true;
  } catch {
    return false;
  }
}

// Se despliega subiendo SOLO servicio-tono/ (`vercel deploy` desde esta
// carpeta), para que del repo no viaje nada mas —cache/ guarda texto crudo de
// comentarios y no puede terminar en un tercero—. Asi que en Vercel ../pulso
// no existe: la copia se hace en local antes de subir y alla se usa tal cual.
if (await existe(new URL("tono.py", PULSO))) {
  await mkdir(DESTINO, { recursive: true });
  for (const archivo of ["tono.py", "sentimiento.py", "normalizar.py"]) {
    await copyFile(new URL(archivo, PULSO), new URL(archivo, DESTINO));
  }
  // Un __init__ vacio y no el del pipeline: aquel trae ZONAS y la version, y
  // la funcion no necesita nada de eso.
  await writeFile(new URL("__init__.py", DESTINO), '"""Copia generada por servicio-tono/empaquetar.mjs. No se edita."""\n');
  console.log("tono: pulso/{tono,sentimiento,normalizar}.py -> api/_pulso/pulso/");
} else if (await existe(new URL("tono.py", DESTINO))) {
  console.log("tono: sin ../pulso; se usa la copia subida en api/_pulso/pulso/");
} else {
  console.error(
    "\n  No existe " + fileURLToPath(new URL("tono.py", PULSO)) + " ni su copia.\n" +
    "\n  Corre `node servicio-tono/empaquetar.mjs` en el repo antes de `vercel deploy`.\n"
  );
  process.exit(1);
}

// Un proyecto sin framework y con `buildCommand` tiene que dejar una carpeta
// de salida estatica, o Vercel rechaza el despliegue («No Output Directory
// named public», el primer intento del 23 de septiembre de 2026). Aqui no hay
// sitio: solo un robots.txt que cierra todo, porque esto es un servicio.
await mkdir(new URL("./public/", import.meta.url), { recursive: true });
await writeFile(new URL("./public/robots.txt", import.meta.url), "User-agent: *\nDisallow: /\n");

if (process.env.TONO_EMPAQUETAR !== "1") process.exit(0);

// La forma del cache de huggingface_hub: models--org--nombre/snapshots/<rev>/
// con los archivos y refs/main con la revision. Es lo que from_pretrained
// busca con HF_HUB_OFFLINE, y lo unico que hace falta imitar.
const info = await fetch(`https://huggingface.co/api/models/${MODELO}`).then((r) => {
  if (!r.ok) throw new Error(`Hugging Face respondio ${r.status} para ${MODELO}`);
  return r.json();
});
const revision = info.sha;
const archivos = (info.siblings ?? []).map((s) => s.rfilename)
  .filter((n) => /\.(json|txt|model|safetensors|bin)$/.test(n) && !/^(flax_|tf_|rust_)/.test(n) && !n.includes("/"));
// Una sola copia de los pesos: safetensors si esta, si no el .bin.
const pesos = archivos.includes("model.safetensors") ? ["model.safetensors"] : archivos.filter((n) => n === "pytorch_model.bin");
const lista = [...archivos.filter((n) => !/\.(safetensors|bin)$/.test(n)), ...pesos];
if (!revision || pesos.length === 0) {
  console.error(`\n  ${MODELO}: sin revision o sin pesos en la ficha de Hugging Face\n`);
  process.exit(1);
}
const base = new URL(`models--${MODELO.replace("/", "--")}/`, CACHE);
const snapshot = new URL(`snapshots/${revision}/`, base);
await mkdir(snapshot, { recursive: true });
await mkdir(new URL("refs/", base), { recursive: true });
for (const nombre of lista) {
  const destino = new URL(nombre, snapshot);
  if (await existe(destino)) continue;
  const r = await fetch(`https://huggingface.co/${MODELO}/resolve/${revision}/${nombre}`);
  if (!r.ok) {
    console.error(`\n  ${MODELO}/${nombre}: Hugging Face respondio ${r.status}\n`);
    process.exit(1);
  }
  await writeFile(destino, Buffer.from(await r.arrayBuffer()));
}
await writeFile(new URL("refs/main", base), revision);
console.log(`tono: ${MODELO}@${revision.slice(0, 8)} -> api/_modelo/ (${lista.length} archivos)`);
