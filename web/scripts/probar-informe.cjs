// Contratos del informe en PDF de un termino, offline. unittest lo invoca
// (tests/test_informe_web.py) y CI tambien.
//
// Dos etapas. La primera es pura y prueba lo que importa sin motor: que una
// cifra ausente siga siendo null y salga «sin dato», que no haya un solo «%»
// en ninguna cadena, que la lectura automatica no llame a nadie debajo del
// piso y llame UNA vez por encima, y los codigos y cabeceras de la ruta con un
// motor de mentira. La segunda arranca el motor de verdad desde su entrada de
// Node —la de Next importa el WASM con `?module`, que Node no entiende— y
// exige un PDF de verdad.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const SRC = path.resolve(__dirname, '../src');
const cargados = new Map();
const sustitutos = new Map();

function cargar(relativo) {
  // .tsx si existe; si no, .ts. El documento del informe es JSX.
  let ruta = path.join(SRC, relativo + '.ts');
  if (!fs.existsSync(ruta)) ruta = path.join(SRC, relativo + '.tsx');
  if (cargados.has(ruta)) return cargados.get(ruta).exports;
  const modulo = new Module(ruta, module);
  modulo.filename = ruta;
  modulo.paths = module.paths;
  cargados.set(ruta, modulo);
  const original = modulo.require.bind(modulo);
  modulo.require = (id) => {
    if (sustitutos.has(id)) return sustitutos.get(id);
    if (id.startsWith('@/')) return cargar(id.slice(2));
    if (id.startsWith('.')) return cargar(path.relative(SRC, path.resolve(path.dirname(ruta), id)));
    return original(id);
  };
  const js = ts.transpileModule(fs.readFileSync(ruta, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  modulo._compile(js, ruta);
  return modulo.exports;
}

// El motor: la entrada de Node en vez de la de Next.
sustitutos.set('takumi-pdf/next', require('takumi-pdf'));

const doc = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'consultas.json'), 'utf8'));
const textos = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'consultas-comentarios.json'), 'utf8'));
const vlb = doc.consultas.find((c) => c.id === 'cq_vivelabaja');
const gc = doc.consultas.find((c) => c.id === 'cq_grupo_concordia');

const { armarDocumentoInforme, nombreArchivoInforme, lunesDe, rotuloSemana, cifra, limpiarParaFuente, REGLAS_PRODUCTO } = cargar('lib/informe/modelo');
const { leerConsulta, reunirTextoConsulta, CACHE_INFORME } = cargar('lib/analisis/consulta');
const { responderInformeConsulta } = cargar('lib/informe/informe');
const { MODELO_ANALISIS } = cargar('lib/analisis/config');
const { SIN_CACHE } = cargar('lib/busqueda/respuesta');

// ---------------------------------------------------------------- el modelo
const modelo = armarDocumentoInforme(doc, vlb, textos, { estado: 'apagada' });
assert.equal(modelo.termino, 'Vive la Baja');
assert.equal(modelo.ventanaDias, 30);
assert.equal(modelo.ventanaPrensaDias, 180, 'la prensa mide su propia ventana');
// Cinco fuentes, tres leidas y dos sin dato. Sin razon: la pantalla y el PDF
// dicen solo «sin dato» (pedido del cliente del 18 de septiembre de 2026).
assert.deepEqual(modelo.fuentes.map((f) => f.estado), ['ok', 'ok', 'ok', 'sin_dato', 'sin_dato']);
assert.ok(!('razon' in modelo.fuentes[3]), 'ninguna fuente lleva razon al documento');
// El resumen: frases con conteos, nunca «la mayoria» ni la gente.
assert.ok(modelo.resumen.length >= 2, 'hay resumen');
assert.match(modelo.resumen[0], /^3 titulares nombran Vive la Baja en los últimos 6 meses: 1 adverso, 1 favorable, 0 neutrales, 1 sin tono\.$/);
assert.match(modelo.resumen[1], /^Lo adverso viene de Zeta \(1\)\.$/);
for (const frase of modelo.resumen) {
  for (const prohibida of ['mayoría', 'la gente', 'opinión pública', '%']) assert.ok(!frase.includes(prohibida), `${frase} · ${prohibida}`);
}
// Cifras por plataforma, lado a lado y sin dividir.
assert.deepEqual(modelo.cifras.map((c) => [c.publicaciones, c.comentariosLeidos]), [[4, 9], [3, 12], [1, 2]]);
// Instagram no publica compartidos: null, que se pinta «sin dato», nunca 0.
const ig = modelo.destacados.find((d) => d.red === 'instagram');
assert.ok(ig.filas.every((f) => f.compartidos === null), 'Instagram sin compartidos');
const fb = modelo.destacados.find((d) => d.red === 'facebook');
assert.equal(fb.filas[0].compartidos, 0, 'Facebook si los publica: 0 es cero medido');
assert.equal(cifra(null), 'sin dato');
assert.equal(cifra(0), '0');
assert.equal(cifra(12000), '12,000');
// La fuente de TikTok es el creador; la de un hashtag lleva #.
assert.equal(modelo.destacados.find((d) => d.red === 'tiktok').filas[0].fuente, '@vive.la.baja');
assert.ok(ig.filas.some((f) => f.fuente === '#vivelabaja'));
// Semanas: lunes y rotulo.
assert.equal(lunesDe('2026-09-17'), '2026-09-14');
assert.equal(lunesDe('2026-09-14'), '2026-09-14');
assert.equal(rotuloSemana('2026-09-14'), '14–20 sep');
assert.equal(rotuloSemana('2026-08-31'), '31 ago–6 sep');
assert.equal(modelo.destacadosPorSemana.length, 3, 'una serie por red leida');
const semanas = modelo.destacadosPorSemana[0].data.map((p) => p.label);
assert.deepEqual(semanas, ['31 ago–6 sep', '7–13 sep', '14–20 sep']);
const total = modelo.destacadosPorSemana.flatMap((s) => s.data).reduce((a, p) => a + p.value, 0);
assert.equal(total, 5, 'las cinco destacadas caen en alguna semana');
assert.deepEqual(modelo.destacadosPorRed.map((p) => p.value), [2, 2, 1]);
// Comentarios: las publicaciones con mas likes primero, hasta cinco cada una.
assert.equal(modelo.conTexto[0].fuente, '@vive.la.baja', 'la de 345 likes abre');
assert.ok(modelo.conTexto.every((p) => p.comentarios.length <= 5));
assert.equal(modelo.hayArchivoDeTexto, true);
assert.equal(armarDocumentoInforme(doc, vlb, null, { estado: 'apagada' }).hayArchivoDeTexto, false);
assert.equal(armarDocumentoInforme(doc, vlb, null, { estado: 'apagada' }).conTexto.length, 0);
// La prensa y el archivo: seis meses, tono por titular, dos caminos.
assert.equal(modelo.prensa.resultados[0].url, 'https://news.google.com/rss/articles/CBMiXabc?oc=5', 'el enlace opaco tal cual');
assert.equal(modelo.prensa.resultados[1].url, 'https://zetatijuana.com/2026/07/vecinos-reclaman-vive-la-baja', 'el del medio es el del medio');
assert.deepEqual(modelo.prensa.resultados.map((r) => r.tono), ['favorable', 'adversa', null], 'null es sin tono, nunca neutral');
assert.deepEqual([modelo.prensa.tono.adversa, modelo.prensa.tono.favorable, modelo.prensa.tono.sin_modelo_idioma, modelo.prensa.tono.titulares], [1, 1, 1, 3]);
assert.deepEqual(modelo.prensa.porMedio.map((m) => m.fuente), ['El Vigía', 'KPBS', 'Zeta']);
assert.equal(modelo.prensa.anteriores.length, 0);
assert.match(modelo.prensa.muestra, /180 días/);
assert.equal(modelo.prensa.archivo.coincidencias, 0);
assert.match(modelo.prensa.archivo.muestra, /18 medios/);
assert.ok(!('razon' in modelo.prensa), 'la prensa tampoco lleva razon');
// Lo agregado a mano: lista propia, fuera de la prensa y de sus conteos.
assert.equal(modelo.agregados.length, 2);
assert.deepEqual(modelo.agregados.map((a) => a.fecha), ['2026-05-18', null], 'sin fecha se publica como null');
assert.deepEqual(modelo.agregados.map((a) => a.tono), ['neutral', 'adversa']);
assert.equal(modelo.prensa.tono.titulares, 3, 'los agregados no entran al conteo de prensa');
for (const a of modelo.agregados) {
  assert.ok(!modelo.prensa.resultados.some((r) => r.url === a.url), 'no se cuenta dos veces');
}
assert.match(modelo.resumen.at(-1), /^Además, 2 publicaciones agregadas a mano, 1 adversa\.$/);
assert.equal(armarDocumentoInforme(doc, gc, textos, { estado: 'apagada' }).agregados.length, 0, 'sin agregados, lista vacia');
// Sin un solo porcentaje en ninguna cadena del modelo ni de las reglas.
const texto = JSON.stringify(modelo) + REGLAS_PRODUCTO.join(' ');
assert.ok(!/\d\s?%/.test(texto), 'ningun porcentaje');
// Ni mecanismo en lo que se pinta.
for (const palabra of ['Apify', 'pipeline', 'cron', 'actor']) assert.ok(!JSON.stringify(modelo).includes(palabra), palabra);
// Nombre del archivo: la fecha del corte, no la de hoy.
assert.equal(nombreArchivoInforme(vlb, doc), 'pulso-n33-cq_vivelabaja-2026-09-18.pdf');
// Los emoji se quitan antes de la fuente.
assert.equal(limpiarParaFuente('Excelente ubicación, felicidades 🔥'), 'Excelente ubicación, felicidades');
assert.equal(limpiarParaFuente('Hola 👍🏽 mundo'), 'Hola mundo');
// Un termino con dos plataformas sin dato.
const modeloGc = armarDocumentoInforme(doc, gc, textos, { estado: 'pocos' });
assert.deepEqual(modeloGc.cifras.map((c) => c.publicaciones), [1, null, null]);
// Su prensa: un titular en la ventana y dos anteriores, adversos, aparte y con fecha.
assert.equal(modeloGc.prensa.estado, 'ok');
assert.equal(modeloGc.prensa.resultados.length, 1);
assert.deepEqual(modeloGc.prensa.anteriores.map((r) => [r.fecha, r.tono]), [['2026-03-11', 'adversa'], ['2026-03-11', 'adversa']]);
assert.equal(modeloGc.prensa.tono.titulares, 1, 'los anteriores no entran al conteo');
assert.match(modeloGc.resumen[0], /^1 titular nombra Grupo Concordia en los últimos 6 meses: 0 adversos, 0 favorables, 1 neutral\.$/);
assert.match(modeloGc.resumen[1], /^Y hay 2 titulares anteriores a ese periodo, del 11 mar 2026, 2 adversos\.$/);
assert.equal(modeloGc.destacadosPorRed.length, 1);

// ------------------------------------------------------- la lectura del modelo
const nunca = async () => { assert.fail('no debio tocar la red'); };
process.env.ANALISIS_HABILITADO = 'false';
(async () => {
  assert.deepEqual(await leerConsulta(vlb, textos, nunca), { estado: 'apagada' });
  process.env.ANALISIS_HABILITADO = 'true';
  process.env.ANTHROPIC_API_KEY = 'prueba';
  // Debajo del piso no hay llamada.
  assert.equal(reunirTextoConsulta(gc, textos).leidos, 3);
  assert.deepEqual(await leerConsulta(gc, textos, nunca), { estado: 'pocos' });
  assert.deepEqual(await leerConsulta(vlb, null, nunca), { estado: 'pocos' }, 'sin archivo de texto no hay nada que leer');
  // Encima del piso: UNA llamada, al modelo, con el termino nombrado.
  assert.equal(reunirTextoConsulta(vlb, textos).leidos, 13, 'cinco de TikTok, seis de Instagram, dos de Facebook');
  const vistas = [];
  const modeloFalso = (salida) => async (url, opciones) => {
    vistas.push(String(url));
    assert.equal(opciones.method, 'POST');
    const pedido = JSON.parse(opciones.body);
    assert.equal(pedido.model, MODELO_ANALISIS);
    assert.match(pedido.messages[0].content, /«Vive la Baja»/);
    assert.match(pedido.system, /Prohibido todo porcentaje/, 'el prompt prohibe porcentajes');
    return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: salida }] }) };
  };
  const buena = JSON.stringify({ lectura: 'Los comentarios vuelven sobre el Valle de Guadalupe y sobre los precios de la zona.', salvedad: 'No se sabe cuántas personas comentaron ni desde dónde.' });
  const lista = await leerConsulta(vlb, textos, modeloFalso(buena));
  assert.equal(lista.estado, 'lista');
  assert.deepEqual(vistas, ['https://api.anthropic.com/v1/messages'], 'UNA salida de red, y es el modelo');
  // Una salida que rompe las reglas se descarta entera.
  const rota = JSON.stringify({ lectura: 'La mayoría de los comentarios celebra el proyecto.', salvedad: 'x' });
  assert.deepEqual(await leerConsulta(vlb, textos, modeloFalso(rota)), { estado: 'fallo' });
  const conPorcentaje = JSON.stringify({ lectura: 'El 60% habla de precios.', salvedad: 'x' });
  assert.deepEqual(await leerConsulta(vlb, textos, modeloFalso(conPorcentaje)), { estado: 'fallo' });
  const caido = async () => ({ ok: false, status: 500, json: async () => ({}) });
  assert.deepEqual(await leerConsulta(vlb, textos, caido), { estado: 'fallo' });

  // ------------------------------------------------------------- la ruta
  const leerFalso = (con = { 'consultas.json': doc, 'consultas-comentarios.json': textos }) => async (nombre) => con[nombre] ?? null;
  const motorFalso = async () => new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
  process.env.ANALISIS_HABILITADO = 'false';
  let r = await responderInformeConsulta({ c: 'cq_vivelabaja' }, nunca, leerFalso(), motorFalso);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/pdf');
  assert.equal(r.headers.get('content-disposition'), 'attachment; filename="pulso-n33-cq_vivelabaja-2026-09-18.pdf"');
  assert.equal(r.headers.get('cache-control'), CACHE_INFORME);
  assert.equal(r.headers.get('x-robots-tag'), 'noindex');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  r = await responderInformeConsulta({ c: 'no existe' }, nunca, leerFalso(), motorFalso);
  assert.equal(r.status, 400);
  assert.equal(r.headers.get('cache-control'), SIN_CACHE);
  r = await responderInformeConsulta({ c: 'cq_nadie' }, nunca, leerFalso(), motorFalso);
  assert.equal(r.status, 404);
  assert.equal((await r.json()).codigo, 'consulta');
  r = await responderInformeConsulta({ c: 'cq_vivelabaja' }, nunca, leerFalso({}), motorFalso);
  assert.equal(r.status, 503, 'sin archivo no hay informe vacio: es la regla 4 al reves');
  assert.equal((await r.json()).codigo, 'datos');
  r = await responderInformeConsulta({ c: 'cq_vivelabaja' }, nunca, leerFalso({ 'consultas.json': doc }), motorFalso);
  assert.equal(r.status, 200, 'sin el archivo de texto el informe se arma igual');
  const roto = async () => { throw new Error('motor'); };
  r = await responderInformeConsulta({ c: 'cq_vivelabaja' }, nunca, leerFalso(), roto);
  assert.equal(r.status, 503);
  assert.equal((await r.json()).codigo, 'informe');

  // ------------------------------------------------- el motor de verdad
  const { renderizarInforme } = cargar('lib/informe/render');
  const t0 = Date.now();
  const bytes = await renderizarInforme(armarDocumentoInforme(doc, vlb, textos, lista));
  const ms = Date.now() - t0;
  assert.ok(bytes instanceof Uint8Array, 'bytes');
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString('latin1'), '%PDF-', 'es un PDF');
  assert.ok(bytes.length > 20000, `un informe con fuentes incrustadas pesa mas de 20 KB (${bytes.length})`);
  // Al temporal del sistema, no a fixtures/: es salida, no entrada, y no va a git.
  const salida = path.join(require('node:os').tmpdir(), 'pulso-n33-informe-prueba.pdf');
  fs.writeFileSync(salida, bytes);
  // El de dos plataformas sin dato y sin lectura tambien se arma.
  const bytesGc = await renderizarInforme(modeloGc);
  assert.equal(Buffer.from(bytesGc.subarray(0, 5)).toString('latin1'), '%PDF-');

  console.log(`Informe: modelo puro, lectura con una sola salida de red, codigos y cabeceras de la ruta, y un PDF real de ${bytes.length} bytes en ${ms} ms verificados offline (${salida}).`);
})().catch((e) => { console.error(e); process.exit(1); });
