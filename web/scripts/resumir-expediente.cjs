/*
 * El resumen de IA de los comentarios de cada publicacion del «año en redes»
 * de un expediente (5 de octubre de 2026, cliente: el «Lo que dicen los
 * comentarios» de «En redes», ahora por publicacion en «El año en redes», y
 * escrito de una vez para todas).
 *
 *   node --env-file=.env scripts/resumir-expediente.cjs ismael-burgueno-2026 [--rehacer]
 *
 * Usa el MISMO escritor que /seguimiento (lib/analisis/seguimiento.ts,
 * Sonnet 5.5, ~1 centavo por publicacion), con sus reglas en codigo: un
 * resumen con un porcentaje, «la mayoria» o «predomina» se descarta. No hay
 * copia en Python del prompt ni de las reglas: dos copias se desvian.
 *
 * Lee data/expedientes-comentarios.json (la lista publicada de cada post) y
 * escribe cache/expedientes/<id>/resumenes.json, fuera de git: un resumen
 * deriva del texto de los comentarios y vive lo mismo que el. Luego
 * `python -m pulso expediente-redes --expediente <id> --sin-cosecha` lo
 * publica. Cada resumen lleva la `firma` de la lista sobre la que se
 * escribio (la misma de pulso/expediente_redes.py::firma): si la lista cambia,
 * el resumen no se publica y esta corrida lo rehace.
 *
 * Es una corrida A MANO, como `expediente-redes`: nunca un paso del cron. Se
 * escribe el archivo despues de cada resumen, asi que cortarla a la mitad no
 * pierde lo pagado.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const SRC = path.resolve(__dirname, '../src');
const RAIZ = path.resolve(__dirname, '../..');
const cargados = new Map();

/** El mismo cargador de los probar-*.cjs: TypeScript transpilado al vuelo y
 *  el alias @/ resuelto contra src/. */
function cargar(relativo) {
  const ruta = path.join(SRC, relativo + '.ts');
  if (cargados.has(ruta)) return cargados.get(ruta).exports;
  const modulo = new Module(ruta, module);
  modulo.filename = ruta;
  modulo.paths = module.paths;
  cargados.set(ruta, modulo);
  const original = modulo.require.bind(modulo);
  modulo.require = (id) => {
    if (id.startsWith('@/')) return cargar(id.slice(2));
    if (id.startsWith('.')) return cargar(path.relative(SRC, path.resolve(path.dirname(ruta), id)));
    return original(id);
  };
  const js = ts.transpileModule(fs.readFileSync(ruta, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText;
  modulo._compile(js, ruta);
  return modulo.exports;
}

/** pulso/expediente_redes.py::firma, byte por byte. */
const firma = (lista) => crypto.createHash('sha256').update(lista.map((c) => c.texto).join('\n'), 'utf8').digest('hex').slice(0, 16);

/** La hora como la escribe el pipeline («…+00:00»), para que la comparacion
 *  de la retencion en Python sea entre cadenas del mismo formato. */
const ahora = () => new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');

const CENTAVOS_POR_RESUMEN = 1.3;   // medido en /seguimiento: ~0.013 USD con Sonnet 5.5

async function principal() {
  const id = process.argv[2];
  const rehacer = process.argv.includes('--rehacer');
  if (!id) {
    console.error('uso: node --env-file=.env scripts/resumir-expediente.cjs <id> [--rehacer]');
    process.exit(1);
  }
  const S = cargar('lib/analisis/seguimiento');
  const { MODELO_RESUMEN } = cargar('lib/analisis/config');

  const texto = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'expedientes-comentarios.json'), 'utf8'));
  const bloque = texto.expedientes?.[id];
  if (!bloque?.comentarios) {
    console.error(`no hay comentarios publicados de ${id}: corre antes python -m pulso expediente-redes --expediente ${id} --sin-cosecha`);
    process.exit(1);
  }
  const doc = JSON.parse(fs.readFileSync(path.join(SRC, 'lib', 'expedientes', `${id}-redes.json`), 'utf8'));
  const posts = doc.meses.flatMap((m) => Object.entries(m.redes).flatMap(([red, lista]) => lista.map((p) => ({ ...p, red }))));

  const rutaResumenes = path.join(RAIZ, 'cache', 'expedientes', id, 'resumenes.json');
  const resumenes = fs.existsSync(rutaResumenes) ? JSON.parse(fs.readFileSync(rutaResumenes, 'utf8')) : {};
  const guardar = () => {
    const ordenado = Object.fromEntries(Object.entries(resumenes).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(rutaResumenes, JSON.stringify(ordenado, null, 1) + '\n', 'utf8');
  };

  const pendientes = posts.filter((p) => {
    const lista = bloque.comentarios[p.url] ?? [];
    return lista.length >= S.MINIMO_COMENTARIOS_RESUMEN && (rehacer || resumenes[p.url]?.firma !== firma(lista));
  });
  console.log(`${pendientes.length} publicaciones por resumir (~${(pendientes.length * CENTAVOS_POR_RESUMEN / 100).toFixed(2)} USD); ${posts.length - pendientes.length} ya resumidas o con menos de ${S.MINIMO_COMENTARIOS_RESUMEN} comentarios`);

  const resultado = { ok: 0, fallo: 0, reglas: 0, otros: 0 };
  for (const [n, p] of pendientes.entries()) {
    const lista = bloque.comentarios[p.url];
    // Al modelo, del mas reciente al mas antiguo, como lo pide su prompt; los
    // temas vuelven en ese orden y se traducen a posiciones de la lista
    // publicada, que va de mas likes a menos.
    const orden = lista.map((c, i) => ({ c, i })).sort((a, b) => (b.c.fecha || '').localeCompare(a.c.fecha || '') || a.i - b.i);
    const r = await S.resumirComentarios({ red: p.red, titulo: p.titulo || null, comentarios: orden.map((o) => ({ texto: o.c.texto, likes: o.c.likes })) });
    if (r.estado !== 'ok') {
      resultado[r.estado in resultado ? r.estado : 'otros'] += 1;
      console.log(`  [${n + 1}/${pendientes.length}] ${r.estado}: ${p.url}`);
      if (r.estado === 'apagada') {
        console.error('el analisis esta apagado: ANALISIS_HABILITADO=true y ANTHROPIC_API_KEY en web/.env');
        process.exit(1);
      }
      continue;
    }
    resumenes[p.url] = {
      firma: firma(lista),
      texto: r.texto,
      leidos: r.leidos,
      fecha: ahora(),
      modelo: MODELO_RESUMEN,
      temas: r.temas.map((t) => ({ nombre: t.nombre, detalle: t.detalle, comentarios: t.indices.map((k) => orden[k].i).sort((a, b) => a - b) })),
    };
    guardar();
    resultado.ok += 1;
    console.log(`  [${n + 1}/${pendientes.length}] ok, ${r.temas.length} temas: ${p.titulo.slice(0, 60)}`);
  }
  console.log(`listo: ${resultado.ok} resumidas, ${resultado.fallo} fallaron, ${resultado.reglas} descartadas por las reglas, ${resultado.otros} otras. Publica con: python -m pulso expediente-redes --expediente ${id} --sin-cosecha`);
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
