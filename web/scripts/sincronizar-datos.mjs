// Copia data/ y config/roster.json del repo a web/public/data/.
//
// El repo tiene UNA sola copia del JSON, en data/, y es la que versiona git.
// Commitear una segunda copia dentro de web/public/ duplicaria la tasa de
// crecimiento de un repo cuyo archivo mas grande cambia cada 6 horas.
//
// Falla RUIDOSAMENTE a proposito. Si esto saliera con codigo 0 cuando falta
// ../data, el build tendria exito y publicaria un tablero donde cada panel
// muestra su estado de error, que es el peor resultado posible: parece un
// problema de datos y no de configuracion.

import { access, cp, mkdir, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ORIGEN = new URL("../../data/", import.meta.url);
const ROSTER = new URL("../../config/roster.json", import.meta.url);
// El texto de los comentarios de Instagram vive fuera de git (ver .gitignore)
// y se copia solo si existe: un build desde git puro no lo tiene, y el panel
// de redes lo dice en vez de fallar.
const EFIMERO = new URL("../../efimero/", import.meta.url);
const DESTINO = new URL("../public/data/", import.meta.url);

async function existe(url) {
  try {
    await access(url);
    return true;
  } catch {
    return false;
  }
}

if (!(await existe(ORIGEN))) {
  console.error(
    "\n  No existe " + fileURLToPath(ORIGEN) + "\n" +
    "\n  En Vercel, con Root Directory = web, hay que activar\n" +
    '  "Include source files outside of the Root Directory in the Build Step".\n' +
    "\n  En local, corre primero:  python -m pulso correr --sin-red\n"
  );
  process.exit(1);
}

if (!(await existe(ROSTER))) {
  console.error("\n  No existe " + fileURLToPath(ROSTER) + "\n");
  process.exit(1);
}

await mkdir(DESTINO, { recursive: true });
await cp(ORIGEN, DESTINO, { recursive: true });
await cp(ROSTER, new URL("roster.json", DESTINO));

let efimeros = 0;
if (await existe(EFIMERO)) {
  for (const nombre of await readdir(EFIMERO)) {
    if (!nombre.endsWith(".json")) continue;
    await cp(new URL(nombre, EFIMERO), new URL(nombre, DESTINO));
    efimeros += 1;
  }
}

const copiados = await readdir(DESTINO);
console.log(
  "datos sincronizados -> public/data/ (" + copiados.filter((n) => n.endsWith(".json")).length +
  " archivos + archivo/" +
  (efimeros > 0 ? "; " + efimeros + " de efimero/, fuera de git" : "; sin efimero/") + ")"
);
