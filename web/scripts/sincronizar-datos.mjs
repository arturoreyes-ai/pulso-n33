// Copia data/ y config/roster.json del repo a web/public/data/, y arma
// catalogo-busqueda.json con lo que la busqueda en vivo lee del config.
//
// El repo tiene UNA sola copia del JSON, en data/, y es la que versiona git.
// Commitear una segunda copia dentro de web/public/ duplicaria la tasa de
// crecimiento de un repo cuyo archivo mas grande cambia cada 6 horas.
//
// Falla RUIDOSAMENTE a proposito. Si esto saliera con codigo 0 cuando falta
// ../data, el build tendria exito y publicaria un tablero donde cada panel
// muestra su estado de error, que es el peor resultado posible: parece un
// problema de datos y no de configuracion.

import { access, cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ORIGEN = new URL("../../data/", import.meta.url);
const ROSTER = new URL("../../config/roster.json", import.meta.url);
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

// Lo que la busqueda en vivo necesita del config (lib/busqueda/catalogo.ts):
// los buscadores propios de los medios, SOLO los encendidos y sondeados, y el
// nombre y el idioma declarado de cada medio. Una proyeccion de cuatro campos
// y no una copia: las notas de sondeo se quedan en config/. Si alguno de los
// dos archivos no esta, la busqueda sigue con Google y el archivo, y se dice
// aqui en vez de fallar el build: la lupa no depende de esto para funcionar.
const CONSULTAS = new URL("../../config/consultas.json", import.meta.url);
const MEDIOS = new URL("../../config/medios.json", import.meta.url);
const dominio = (url) => {
  const host = (url.split("://", 2)[1] ?? url).split("/", 1)[0].split("@").pop().split(":", 1)[0].toLowerCase();
  return host.startsWith("www.") ? host.slice(4) : host;
};
if ((await existe(CONSULTAS)) && (await existe(MEDIOS))) {
  const consultas = JSON.parse(await readFile(CONSULTAS, "utf8"));
  const medios = JSON.parse(await readFile(MEDIOS, "utf8"));
  const catalogo = {
    nota: "Generado por web/scripts/sincronizar-datos.mjs desde config/consultas.json (buscadores activos y verificados) y config/medios.json. No se edita a mano.",
    buscadores: (consultas.buscadores ?? [])
      .filter((b) => b.activo && b.verificado)
      .map((b) => ({ id: b.id, nombre: b.nombre, url: b.url, idioma: b.idioma ?? "es" }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    medios: (medios.medios ?? [])
      .filter((m) => typeof m.url === "string" && m.url !== "")
      .map((m) => ({ id: m.id, nombre: m.nombre, dominio: dominio(m.url), idioma: m.idioma ?? "es" })),
    // El idioma DECLARADO de cada fila de redes (cuenta de Instagram,
    // busqueda o perfil de TikTok, canal de YouTube), por su id, que es el
    // `cuenta` de cada destacado. Decide que pies pasan por el modelo de tono.
    cuentas: [],
  };
  const REDES = [
    ["instagram.json", ["cuentas"]],
    ["tiktok.json", ["busquedas", "perfiles"]],
    ["youtube.json", ["canales"]],
  ];
  for (const [archivo, listas] of REDES) {
    const ruta = new URL("../../config/" + archivo, import.meta.url);
    if (!(await existe(ruta))) continue;
    const doc = JSON.parse(await readFile(ruta, "utf8"));
    for (const lista of listas) {
      for (const fila of doc[lista] ?? []) {
        if (typeof fila.id === "string") catalogo.cuentas.push({ id: fila.id, idioma: fila.idioma ?? "es" });
      }
    }
  }
  await writeFile(new URL("catalogo-busqueda.json", DESTINO), JSON.stringify(catalogo, null, 1) + "\n");
} else {
  console.warn("  sin config/consultas.json o config/medios.json: la busqueda no leera los buscadores de los medios");
}

// El texto de los comentarios viaja con el resto de data/ desde el 17 de
// septiembre de 2026; antes vivia en efimero/ y necesitaba su propio bucle
// aqui. Sigue fuera de git (ver .gitignore), asi que un build desde git puro
// no lo tiene y el panel de redes lo dice en vez de fallar.
const copiados = await readdir(DESTINO);
const conTexto = copiados.filter((n) => n.endsWith("-comentarios.json")).length;
console.log(
  "datos sincronizados -> public/data/ (" + copiados.filter((n) => n.endsWith(".json")).length +
  " archivos + archivo/" +
  (conTexto > 0 ? "; " + conTexto + " con texto de comentarios, fuera de git" : "; sin texto de comentarios") + ")"
);
