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

const { buscarConsulta, reunirPublicacionesConsulta, filtrarPorTexto, rutaDeConsulta, rutaDeBusquedaEnVivo, rotuloVentana, frasesConsulta, cifrasConsulta, noticiasDeConsulta, redDeAgregado, tramosDeMedio, SIN_FILAS_BUSQUEDA, SIN_FILAS_CONSULTA } = cargar('lib/dominio/consultas');
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
assert.equal(filas.length, 6, 'dos de TikTok, dos de Instagram, una de Facebook y el post de Facebook agregado a mano');
// Mas reciente primero, como el visor de medios; el agregado sin fecha al final.
assert.deepEqual(filas.map((f) => f.post.fecha), ['2026-09-15', '2026-09-12', '2026-09-08', '2026-09-05', '2026-09-01', '']);
assert.equal(filas.at(-1).red, 'facebook');
assert.equal(filas.at(-1).url, 'https://www.facebook.com/TijuanaLineaRoja/posts/1493856925630886', 'canonizado, para que embeba');
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
assert.match(SIN_FILAS_BUSQUEDA('garita'), /garita/);
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
assert.equal(frasesVlb[0], '3 noticias mencionan a Vive la Baja en los últimos 6 meses: 1 positiva, 1 negativa, 0 neutrales, 1 sin tono.');
assert.equal(frasesVlb[1], 'Lo negativo viene de Zeta (1).');
assert.equal(frasesVlb[2], '8 publicaciones en redes en los últimos 30 días: 3 positivas, 1 negativa, 4 neutrales.');
assert.equal(frasesVlb[3], '21 comentarios: 11 positivos, 4 negativos, 6 neutrales.', 'los comentarios en su propia frase, sin sumarse a las publicaciones');
// Lo agregado a mano se cuenta aparte y se dice que lo es.
assert.equal(frasesVlb.at(-1), 'Además, 2 publicaciones agregadas a mano, 1 negativa.');
const frasesGc = frasesConsulta(gc, doc);
assert.ok(!frasesGc.some((f) => f.includes('a mano')), 'sin agregados no se menciona');
assert.equal(frasesGc[0], '1 noticia menciona a Grupo Concordia en los últimos 6 meses: 0 positivas, 0 negativas, 1 neutral.');
assert.equal(frasesGc[1], 'Y hay 2 noticias anteriores a ese periodo, del 11 mar 2026, 2 negativas.', 'los anteriores se dicen con fecha y ano');
assert.equal(frasesGc[2], '1 publicación en redes en los últimos 30 días.', 'un corte sin tono de publicaciones no inventa ceros');
// Un termino sin un solo titular ni red leida dice el hueco, no un cero disfrazado.
const vacio = {
  ...gc,
  termino: 'Nadie',
  plataformas: { ...gc.plataformas, instagram: { estado: 'sin_dato', razon: 'x' } },
  prensa: { ...gc.prensa, resultados: [], anteriores: [], tono: { ...gc.prensa.tono, titulares: 0, neutral: 0 }, por_medio: [] },
  tono: { ...gc.tono, positivo: 0, negativo: 0, neutral: 0, sin_clasificar: 0, sin_modelo_idioma: 0, comentarios: 0 },
};
assert.deepEqual(frasesConsulta(vacio, doc), [
  'Ninguna noticia de los últimos 6 meses menciona a Nadie.',
  'Redes: sin dato.',
]);
// Un solo vocabulario desde el 23 de septiembre de 2026: la direccion lee
// positivo/negativo, nunca «adverso» ni «favorable».
for (const frase of [...frasesVlb, ...frasesGc]) {
  for (const prohibida of ['mayoría', 'la gente', 'opinión pública', '%', 'corte', 'pipeline', 'advers', 'favorabl']) assert.ok(!frase.includes(prohibida), `${frase} · ${prohibida}`);
}

// --- las cifras que abren la ficha (22 y 23 de septiembre de 2026) ----------
// Las mismas cuentas que las frases, en otro lugar: si una cifra y su frase
// dijeran numeros distintos, la ficha se contradiria en la misma pantalla.
const tramosComo = (tramos) => Object.fromEntries(tramos.map((t) => [t.clase, t.n]));
const cuatro = (s) => [s.positivo, s.negativo, s.neutral, s.sinTono, s.total];
const cVlb = cifrasConsulta(vlb);
assert.equal(cVlb.prensa.estado, 'ok');
// 23 de septiembre de 2026: la tarjeta de noticias es UN total, con las
// anteriores y las agregadas que no son post de red. Aqui: las tres de la
// busqueda (1 positiva, 1 negativa, 1 sin tono) y la de Zeta, neutral. El post
// de Facebook agregado a mano NO es noticia: va a publicaciones.
assert.deepEqual(cuatro(cVlb.prensa.tono), [1, 1, 1, 1, 4]);
const nVlb = noticiasDeConsulta(vlb);
assert.equal(nVlb.length, 4);
assert.ok(!nVlb.some((r) => r.url.includes('facebook.com')), 'el post de red no sale en noticias');
const fechas = nVlb.filter((r) => r.fecha !== null).map((r) => r.fecha);
assert.deepEqual(fechas, [...fechas].sort().reverse(), 'fecha descendente');
assert.equal(redDeAgregado(vlb.agregados[1]), 'facebook');
assert.equal(redDeAgregado(vlb.agregados[0]), null, 'Zeta es prensa');
// Sin prensa leida pero con agregadas de prensa, la tarjeta las cuenta.
assert.equal(cifrasConsulta({ ...vlb, prensa: { estado: 'sin_dato', razon: 'x' } }).prensa.tono.total, 1);
assert.deepEqual(cVlb.prensa.tono.tramos.map((t) => [t.clase, t.etiqueta]),
  [['positivo', 'positiva'], ['negativo', 'negativa'], ['neutral', 'neutral'], ['sin_tono', 'sin tono']],
  'mismo orden en todas las series, y la palabra concuerda con su numero y su genero');
assert.ok(!('agregados' in cVlb) && !('anteriores' in cVlb.prensa), 'ni tarjeta de agregadas ni corte por ventana');
// Publicaciones: las 8 cosechadas (3 positivas, 1 negativa, 4 neutrales) mas
// el post de Facebook agregado, negativo.
assert.equal(cVlb.publicaciones.total, 9);
assert.deepEqual(cVlb.publicaciones.leidas, ['instagram', 'tiktok', 'facebook']);
assert.deepEqual(cuatro(cVlb.publicaciones.tono), [3, 2, 4, 0, 9], 'el tono suma el total de publicaciones');
assert.deepEqual(cuatro(cVlb.comentarios.tono), [11, 4, 6, 0, 21], 'la de «21 comentarios»');
assert.deepEqual(cVlb.comentarios.tono.tramos.map((t) => t.etiqueta), ['positivos', 'negativos', 'neutrales'], 'comentarios en masculino, sin «sin tono» cuando no hay');
const cGc = cifrasConsulta(gc);
assert.deepEqual(cuatro(cGc.prensa.tono), [0, 2, 1, 0, 3], 'la de la ventana y las dos negativas anteriores, juntas');
assert.equal(cGc.publicaciones.total, 1);
assert.equal(cGc.publicaciones.tono, null, 'un corte sin tono_publicaciones es «sin dato», no cero');
assert.deepEqual(cGc.publicaciones.leidas, ['instagram']);
// Una persona sin redes pero con un post de Facebook agregado: la tarjeta de
// publicaciones lo cuenta en vez de decir «sin dato» (el caso de Valente
// Marquez); los comentarios siguen sin dato, no se leyo ninguno.
const soloPost = {
  ...gc,
  plataformas: { ...gc.plataformas, instagram: { estado: 'sin_dato', razon: 'x' } },
  agregados: [vlb.agregados[1]],
  tono: { ...gc.tono, positivo: 0, negativo: 0, neutral: 0, sin_clasificar: 0, sin_modelo_idioma: 0, comentarios: 0 },
};
const cSoloPost = cifrasConsulta(soloPost);
assert.equal(cSoloPost.publicaciones.estado, 'ok');
assert.deepEqual(cSoloPost.publicaciones.leidas, ['facebook']);
assert.deepEqual(cuatro(cSoloPost.publicaciones.tono), [0, 1, 0, 0, 1]);
assert.deepEqual(cSoloPost.comentarios, { estado: 'sin_dato' });
// Con comentarios importados a mano de ese post, la tarjeta los cuenta.
const conImportados = cifrasConsulta({ ...soloPost, tono: { ...soloPost.tono, negativo: 3, positivo: 1, neutral: 0, sin_clasificar: 0, sin_modelo_idioma: 0, comentarios: 4 } });
assert.deepEqual(cuatro(conImportados.comentarios.tono), [1, 3, 0, 0, 4]);
assert.equal(reunirPublicacionesConsulta(soloPost).length, 1, 'y sale en el recorrido');
// Por medio: lo que falta para llegar a `titulares` es lo que quedo sin tono.
const kpbs = vlb.prensa.por_medio.find((m) => m.fuente === 'KPBS');
assert.deepEqual(tramosComo(tramosDeMedio(kpbs)), { positivo: 0, negativo: 0, neutral: 0, sin_tono: 1 });
// Lo que no se leyo es un estado, sin un solo numero que pintar como cero.
const cVacio = cifrasConsulta(vacio);
assert.deepEqual(cVacio.publicaciones, { estado: 'sin_dato' });
assert.deepEqual(cVacio.comentarios, { estado: 'sin_dato' });
assert.equal(cVacio.prensa.tono.total, 0, 'la prensa si se leyo: su cero es una medida');
assert.deepEqual(cVacio.prensa.tono.tramos, [], 'sin noticias no hay tira');
assert.deepEqual(cifrasConsulta({ ...gc, prensa: { estado: 'sin_dato', razon: 'x', anteriores: [] } }).prensa, { estado: 'sin_dato' });
// Ninguna cifra trae una fraccion, un porcentaje ni el vocabulario viejo.
const plano = JSON.stringify([cVlb, cGc, cVacio]);
for (const prohibida of ['%', 'pct', 'porcentaje', 'fraccion', 'proporcion', 'advers', 'favorabl']) assert.ok(!plano.includes(prohibida), `las cifras no traen ${prohibida}`);

console.log('Consultas: elección del término, filas de las tres redes, Facebook canonizado, filtro por texto, rutas y cifras de la ficha verificados offline.');
