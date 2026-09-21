// Contratos de la busqueda de Redes por termino, offline: como se elige un
// termino en seguimiento, como se arman sus filas y como se filtra por texto.
// unittest lo invoca (tests/test_consultas_web.py) y CI tambien.
//
// El mismo cargador que probar-busqueda.cjs: resuelve `@/` y rutas relativas
// dentro de src/ y transpila cada modulo a CommonJS al vuelo.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const SRC = path.resolve(__dirname, '../src');
const cargados = new Map();

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

const { buscarConsulta, reunirPublicacionesConsulta, filtrarPorTexto, rutaDeConsulta, rutaDeBusquedaEnVivo, rotuloVentana, frasesConsulta, SIN_FILAS_BUSQUEDA, SIN_FILAS_CONSULTA } = cargar('lib/dominio/consultas');
const { canonizarPublicacion, NOMBRE_RED } = cargar('lib/dominio/publicaciones');

const doc = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'consultas.json'), 'utf8'));
const textos = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'consultas-comentarios.json'), 'utf8'));

// --- elegir un termino: por igualdad plegada, nunca por contencion ---------
assert.equal(buscarConsulta(doc, 'Vive la Baja').id, 'cq_vivelabaja');
assert.equal(buscarConsulta(doc, '  vive la baja ').id, 'cq_vivelabaja', 'mayusculas y espacios no importan');
assert.equal(buscarConsulta(doc, 'VIVE LA BAJA').id, 'cq_vivelabaja');
assert.equal(buscarConsulta(doc, 'vive'), null, '«vive» no es el termino: eso es un filtro');
assert.equal(buscarConsulta(doc, ''), null);
assert.equal(buscarConsulta(undefined, 'Vive la Baja'), null, 'sin archivo no hay termino');

// --- las filas de un termino ------------------------------------------------
const c = buscarConsulta(doc, 'Vive la Baja');
const filas = reunirPublicacionesConsulta(c);
assert.equal(filas.length, 5, 'dos de TikTok, dos de Instagram, una de Facebook');
// Mas reciente primero, como el visor de medios.
assert.deepEqual(filas.map((f) => f.post.fecha), ['2026-09-15', '2026-09-12', '2026-09-08', '2026-09-05', '2026-09-01']);
// La fuente es la del destacado, nunca el id del termino.
for (const f of filas) assert.notEqual(f.fuente, 'cq_vivelabaja', 'el id del termino es el mecanismo');
assert.equal(filas.find((f) => f.red === 'tiktok' && f.post.likes === 345).fuente, '@vive.la.baja');
assert.equal(filas.find((f) => f.post.origen === 'hashtag').fuente, '#vivelabaja');
assert.equal(filas.find((f) => f.red === 'facebook').fuente, 'vivelabaja');
// Facebook canoniza y NOMBRE_RED lo nombra.
assert.equal(filas.find((f) => f.red === 'facebook').url, 'https://www.facebook.com/vivelabaja/posts/pfbid0abc');
assert.equal(NOMBRE_RED.facebook, 'Facebook');
// Un termino con plataformas `sin_dato` solo trae las que tienen filas.
const gc = buscarConsulta(doc, 'Grupo Concordia');
assert.deepEqual(reunirPublicacionesConsulta(gc).map((f) => f.red), ['instagram']);

// --- Facebook en canonizarPublicacion ----------------------------------------
assert.equal(canonizarPublicacion('https://m.facebook.com/vivelabaja/posts/pfbid0abc?__cft__[0]=x', 'facebook'), 'https://www.facebook.com/vivelabaja/posts/pfbid0abc');
assert.equal(canonizarPublicacion('https://web.facebook.com/permalink.php?story_fbid=1&id=2&__tn__=x', 'facebook'), 'https://www.facebook.com/permalink.php?story_fbid=1&id=2');
assert.equal(canonizarPublicacion('https://www.facebook.com/vivelabaja/videos/123/', 'facebook'), 'https://www.facebook.com/vivelabaja/videos/123');
assert.equal(canonizarPublicacion('https://www.facebook.com/reel/456?x=1', 'facebook'), 'https://www.facebook.com/reel/456');
assert.equal(canonizarPublicacion('https://www.facebook.com/watch/?v=789&ref=x', 'facebook'), 'https://www.facebook.com/watch/?v=789');
for (const url of ['https://www.facebook.com/groups/vecinos/posts/1', 'https://www.facebook.com/profile.php?id=1',
                   'https://www.facebook.com/photo.php?fbid=1', 'http://www.facebook.com/vivelabaja/posts/1',
                   'https://www.instagram.com/p/AAA/', 'https://www.facebook.com/vivelabaja/']) {
  assert.equal(canonizarPublicacion(url, 'facebook'), null, url);
}
// Y una URL de Facebook no se cuela por otra red.
assert.equal(canonizarPublicacion('https://www.facebook.com/vivelabaja/posts/1', 'instagram'), null);
assert.equal(canonizarPublicacion('https://www.facebook.com/vivelabaja/posts/1', 'tiktok'), null);

// --- filtrar por texto: pies y comentarios, plegado ------------------------
const porRed = { instagram: textos, tiktok: textos, facebook: textos };
assert.equal(filtrarPorTexto(filas, porRed, 'valle').length, 1, 'el pie del video del valle');
assert.equal(filtrarPorTexto(filas, porRed, 'TELÉFONO').length, 1, 'un comentario de Facebook, sin importar acentos ni mayusculas');
assert.equal(filtrarPorTexto(filas, porRed, 'telefono').length, 1);
assert.equal(filtrarPorTexto(filas, porRed, 'zzzz').length, 0);
assert.equal(filtrarPorTexto(filas, porRed, '  ').length, filas.length, 'sin texto no filtra');
assert.equal(filtrarPorTexto(filas, {}, 'valle').length, 1, 'sin archivo de texto se filtra solo por pie');

// --- la ruta y los huecos ----------------------------------------------------
assert.equal(rutaDeConsulta('Vive la Baja'), '/redes?q=Vive+la+Baja');
assert.equal(rutaDeConsulta('Valente Márquez'), '/redes?q=Valente+M%C3%A1rquez');
assert.match(SIN_FILAS_BUSQUEDA('garita'), /«garita»/);
for (const frase of [SIN_FILAS_BUSQUEDA('x'), SIN_FILAS_CONSULTA('x', 30)]) {
  for (const mecanismo of ['corte', 'corrida', 'pipeline', 'cosech']) assert.ok(!frase.includes(mecanismo), `${frase} nombra el mecanismo`);
}
assert.match(SIN_FILAS_CONSULTA('Vive la Baja', 30), /30 días/);
assert.equal(rutaDeBusquedaEnVivo('Grupo Concordia'), '/?q=Grupo+Concordia', 'la busqueda de En Tendencia');

// --- las ventanas y el resumen ----------------------------------------------
assert.equal(rotuloVentana(180), '6 meses');
assert.equal(rotuloVentana(30), '30 días');
assert.equal(rotuloVentana(1), '1 día');
assert.equal(rotuloVentana(45), '45 días', 'sin inventar meses que no son enteros');
// Las frases salen de los conteos y no dicen «la mayoria», «la gente» ni un porcentaje.
const vlb = buscarConsulta(doc, 'Vive la Baja');
const frasesVlb = frasesConsulta(vlb, doc);
assert.match(frasesVlb[0], /^3 titulares nombran «Vive la Baja» en los últimos 6 meses: 1 adverso, 1 favorable, 0 neutrales, 1 sin tono\.$/);
assert.match(frasesVlb[1], /^Lo adverso viene de Zeta \(1\)\.$/);
assert.match(frasesVlb[2], /^8 publicaciones en redes en los últimos 30 días; 21 comentarios leídos: /);
const frasesGc = frasesConsulta(gc, doc);
assert.match(frasesGc[1], /^Y hay 2 titulares anteriores a ese periodo, del 11 mar 2026, 2 adversos\.$/, 'los anteriores se dicen con fecha y ano');
assert.match(frasesGc.at(-1), /^2 de las tres redes sin dato\.$/);
// Un termino sin un solo titular ni red leida dice el hueco, no un cero disfrazado.
const vacio = {
  ...gc,
  termino: 'Nadie',
  plataformas: { ...gc.plataformas, instagram: { estado: 'sin_dato', razon: 'x' } },
  prensa: { ...gc.prensa, resultados: [], anteriores: [], tono: { ...gc.prensa.tono, titulares: 0, neutral: 0 }, por_medio: [] },
};
assert.deepEqual(frasesConsulta(vacio, doc), [
  'Ningún titular de los últimos 6 meses nombra «Nadie» en las fuentes revisadas.',
  'Redes: sin dato.',
]);
for (const frase of [...frasesVlb, ...frasesGc]) {
  for (const prohibida of ['mayoría', 'la gente', 'opinión pública', '%', 'corte', 'pipeline']) assert.ok(!frase.includes(prohibida), `${frase} · ${prohibida}`);
}

console.log('Consultas: elección del término, filas de las tres redes, Facebook canonizado, filtro por texto y rutas verificados offline.');
