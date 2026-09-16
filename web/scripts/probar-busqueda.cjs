// Comprobaciones offline del contrato de busqueda en vivo y de /api/actualidad;
// unittest invoca este archivo (tests/test_busqueda_web.py) y CI tambien.
//
// El cargador resuelve `@/` y los imports relativos .ts porque, a diferencia
// de lib/garitas, los modulos de lib/busqueda se importan entre si y traen
// lib/dominio/formato y lib/dominio/zonas. Los `import type` los borra
// transpileModule solo; el mapa de cargados va ANTES de compilar para que un
// ciclo no recompile el mismo archivo dos veces.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const SRC = path.resolve(__dirname, '../src');
const cargados = new Map();
const sustitutos = new Map();

function cargar(relativo) {
  const ruta = path.join(SRC, relativo + '.ts');
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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText;
  modulo._compile(js, ruta);
  return modulo.exports;
}

const { parsearFeed, quitarSufijoMedio } = cargar('lib/busqueda/rss');
const { fusionarLocales } = cargar('lib/busqueda/fusionar');
const { esDeFuera, soloDeLaRegion, esRedSocial } = cargar('lib/busqueda/region');
const { urlDeFeed, urlDeActualidad, urlDeLugar, esUrlDeGoogle } = cargar('lib/busqueda/google-noticias');
const { responderActualidad, consultaDeRubro } = cargar('lib/busqueda/actualidad');
const { RUBROS, NOMBRE_RUBRO, TERMINOS_RUBRO, VENTANA_RUBRO } = cargar('lib/busqueda/rubros');
const { AMBITOS, esAmbitoActualidad, usaCorpus } = cargar('lib/busqueda/ambito');
const { TOPE_ACTUALIDAD } = cargar('lib/busqueda/tipos');

// El MISMO fixture que tests/test_busquedas.py lee en Python: seis items, uno
// sin <source>, uno con ' - ' a la mitad del titular. Dos lectores, un XML.
const XML = fs.readFileSync(path.resolve(__dirname, '../../tests/fixtures/google-noticias.xml'), 'utf8');
const AHORA = '2026-09-11T18:00:00.000Z';

// Constructores minimos para los casos que el fixture no puede probar: el
// fixture ya viene en orden de fecha, asi que no demuestra "no se reordena".
const item = (titulo, fecha, medio = 'Medio', dominio = 'medio.example') =>
  `<item><title>${titulo} - ${medio}</title><link>https://news.google.com/rss/articles/${encodeURIComponent(titulo)}?oc=5</link><pubDate>${fecha}</pubDate><source url="https://${dominio}">${medio}</source></item>`;
const feed = (...items) => `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>x</title>${items.join('')}</channel></rss>`;
const fila = (titulo, idioma, publicado = null) => ({ titulo, url: 'https://news.google.com/rss/articles/' + titulo, dominio: 'x.example', medio: 'X', publicado, idioma });

// `url` y `redirected` son getters del prototipo en undici, asi que en la
// instancia se pueden sombrear. Una Response sintetica sin esto trae url "".
function redirigida(cuerpo, urlFinal) {
  const r = new Response(cuerpo);
  Object.defineProperty(r, 'url', { value: urlFinal });
  Object.defineProperty(r, 'redirected', { value: true });
  return r;
}

const VIEJO = 'Mon, 01 Sep 2026 10:00:00 GMT';
const NUEVO = 'Thu, 10 Sep 2026 10:00:00 GMT';

async function comprobar() {
  // --- Parseo del fixture real -------------------------------------------
  const filas = parsearFeed(XML, 'es', 40);
  assert.equal(filas.length, 5, 'seis items menos el huerfano sin <source>');
  assert.deepEqual(filas[0], {
    titulo: 'Reportan apagon en la zona centro',
    url: 'https://news.google.com/rss/articles/CBMiUNO?oc=5',
    dominio: 'zetatijuana.com',
    medio: 'Zeta Tijuana',
    publicado: '2026-09-02T14:00:00.000Z',
    idioma: 'es',
  });
  // Diario de grupo: Google rotula con el dominio del grupo. El web no tiene
  // el mapa 'publicadores' de config/busquedas.json, asi que el sufijo NO
  // empata y se queda; la fila dice oem.com.mx. Es lo que hay, dicho aqui.
  assert.equal(filas[1].medio, 'oem.com.mx');
  assert.equal(filas[1].titulo, 'Obras en el bulevar avanzan al 60 por ciento - El Sol de Tijuana');
  // La trampa del guion: solo se quita el sufijo EXACTO del publicador.
  assert.equal(filas[3].titulo, 'Tijuana - San Diego: la garita cierra el domingo');
  // El lector web no filtra por fecha (eso lo hace el pipeline); la nota
  // vieja entra y la fila muestra su fecha.
  assert.equal(filas[4].titulo, 'Nota vieja que no debe entrar');
  assert.ok(!filas.some((f) => /huerfano/.test(f.titulo)));
  const dos = parsearFeed(XML, 'en', 2);
  assert.equal(dos.length, 2);
  assert.equal(dos[0].idioma, 'en', 'idioma es el locale que lo devolvio, no el del texto');

  // --- Sufijo del publicador ---------------------------------------------
  assert.equal(quitarSufijoMedio('A - Zeta', 'Zeta'), 'A');
  assert.equal(quitarSufijoMedio('A — Zeta', 'Zeta'), 'A');
  assert.equal(quitarSufijoMedio('A | Zeta', 'Zeta'), 'A');
  assert.equal(quitarSufijoMedio('A - zeta', 'Zeta'), 'A', 'sufijo sin distinguir mayusculas');
  assert.equal(quitarSufijoMedio('Tijuana - San Diego: x - Zeta', 'Zeta'), 'Tijuana - San Diego: x');
  assert.equal(quitarSufijoMedio('A - Otro', 'Zeta'), 'A - Otro');
  assert.equal(quitarSufijoMedio('A - Zeta', ''), 'A - Zeta');

  // --- Fusion por turnos ---------------------------------------------------
  const fusion = fusionarLocales([
    [fila('a1', 'es'), fila('a2', 'es'), fila('a3', 'es')],
    [fila('b1', 'en'), fila('b2', 'en')],
  ]);
  assert.deepEqual(fusion.map((f) => f.titulo), ['a1', 'b1', 'a2', 'b2', 'a3']);
  const repetida = fusionarLocales([[fila('Título', 'es')], [fila('titulo', 'en')]]);
  assert.equal(repetida.length, 1);
  assert.equal(repetida[0].idioma, 'es', 'gana el espanol: el tablero esta en espanol');
  assert.equal(fusionarLocales([[fila('', 'es')]]).length, 0);

  // --- la reja de region ---------------------------------------------------
  // Fixtures REALES del capitulo de seguridad de San Felipe, 16 de septiembre
  // de 2026: siete de trece filas eran de otro pais porque hay un San Felipe
  // en Chile y otro en Guanajuato, y el buscador relaja el ancla
  // `"Baja California"` cuando el match estricto da poco.
  const fila2 = (titulo, dominio, medio = 'X') => ({ titulo, url: 'https://x/', dominio, medio, publicado: null, idioma: 'es' });

  // Otro pais, por dominio: la senal mas limpia.
  for (const d of ['publimetro.cl', 'g5noticias.cl', 'canal9.cl', 'lateja.cr', 'fmplus.cl']) {
    assert.equal(esDeFuera(fila2('Detienen a dos adolescentes por crimen', d)), true, d);
  }
  // Otro estado, por titular.
  assert.equal(esDeFuera(fila2('Clima en Guanajuato: cielo nublado', 'lasillarota.com')), true);
  assert.equal(esDeFuera(fila2('Detienen en Coahuila a "El Pantera"', 'zonanorte.mx')), true);
  assert.equal(esDeFuera(fila2('Michoacán refuerza estrategia contra la extorsión', 'tusbuenasnoticias.com')), true);
  assert.equal(esDeFuera(fila2('Morena Puebla respalda a Armenta', 'sucesospuebla.com')), true);
  assert.equal(esDeFuera(fila2('Gobernadora destaca a Dolores Hidalgo', 'nwnoticias.com')), true);
  assert.equal(esDeFuera(fila2('Carabineros detiene a dos menores', 'latercera.com')), true, 'Carabineros no existe en Mexico');

  // El toponimo compartido: un medio chileno que nombra «San Felipe» habla del
  // suyo. El pais del medio manda sobre el nombre del lugar.
  assert.equal(esDeFuera(fila2('Crimen en Colina: presunto autor huyó hasta San Felipe', 'publimetro.cl')), true);
  // Y un titular que nombra un lugar de fuera PERO tambien uno de aqui se
  // queda: «Detienen en Coahuila a El Pantera y a un policía de Ensenada» es
  // una nota de Ensenada, no de Coahuila.
  assert.equal(esDeFuera(fila2('Detienen en Coahuila a "El Pantera" y a un policía de Ensenada', 'zonanorte.mx')), false);

  // Lo de aqui se queda, y MANDA sobre el marcador de fuera: un titular que
  // nombra los dos lugares es noticia de aqui.
  assert.equal(esDeFuera(fila2('Cierran puertos en Sonora y Baja California por temporal', 'tvazteca.com')), false);
  assert.equal(esDeFuera(fila2('Rescatan a tres personas varadas en San Felipe, BC', 'nmas.com.mx')), false);
  assert.equal(esDeFuera(fila2('Localizan restos humanos en Mexicali', 'nmas.com.mx')), false);
  assert.equal(esDeFuera(fila2('Chula Vista School Board Candidate Scrubbed ICE', 'voiceofsandiego.org')), false, 'San Diego es zona del producto');
  // Baja California Sur es otro estado y lleva dentro el nombre del nuestro.
  assert.equal(esDeFuera(fila2('Huracán se acerca a Baja California Sur', 'x.mx')), true);

  // Sin lugar se CONSERVA: no se puede probar que sea de fuera, y descartar
  // por sospecha seria rellenar al reves (decision del cliente, 16 sep 2026).
  assert.equal(esDeFuera(fila2('Se viene la tormenta negra de la semana', 'cronista.com.ar')), true, 'el dominio si lo prueba');
  assert.equal(esDeFuera(fila2('Se viene la tormenta negra de la semana', 'cronista.com')), false, 'sin dominio ni lugar, se queda');

  // Una red social no es un medio.
  assert.equal(esRedSocial('facebook.com'), true);
  assert.equal(esRedSocial('www.facebook.com'), true);
  assert.equal(esRedSocial('zetatijuana.com'), false);
  assert.equal(esDeFuera(fila2('MILENIO. Claudia Tacoronte, de 21 años', 'facebook.com')), true);

  assert.equal(soloDeLaRegion([fila2('Clima en Guanajuato', 'a.mx'), fila2('Clima en Tijuana', 'b.mx')]).length, 1);

  // --- URLs: URLSearchParams, nunca concatenacion --------------------------
  const u = urlDeFeed('x&hl=en-US', 'es');
  assert.ok(u.startsWith('https://news.google.com/rss/search?'));
  assert.match(u, /q=x%26hl%3Den-US/);
  assert.match(u, /hl=es-419&gl=MX&ceid=MX%3Aes-419/);
  assert.equal(urlDeActualidad('NATION', 'es'), 'https://news.google.com/rss/headlines/section/topic/NATION?hl=es-419&gl=MX&ceid=MX%3Aes-419');
  assert.equal(urlDeActualidad('WORLD', 'en'), 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US%3Aen');
  assert.equal(esUrlDeGoogle('https://news.google.com/rss/topics/CAAq?hl=es-419'), true);
  for (const mala of ['http://news.google.com/rss', 'https://news.google.com.evil.example/rss', 'https://evil.example/', 'no es url', '']) {
    assert.equal(esUrlDeGoogle(mala), false, mala);
  }

  // --- Ambitos: los dos sin corpus son exactamente los de actualidad ------
  for (const a of AMBITOS) assert.equal(esAmbitoActualidad(a), !usaCorpus(a), a);
  assert.equal(esAmbitoActualidad(null), false);

  // --- /api/actualidad: Mexico -----------------------------------------------
  const llamadas = [];
  const bien = await responderActualidad({ a: 'mexico', z: null, t: null }, async (url, opciones) => {
    llamadas.push(url);
    assert.equal(opciones.cache, 'no-store');
    assert.ok(opciones.signal);
    assert.match(opciones.headers['User-Agent'], /PulsoN33/);
    return new Response(XML);
  }, AHORA);
  assert.deepEqual(llamadas, [urlDeActualidad('NATION', 'es')], 'Mexico es UNA seccion en espanol');
  assert.equal(bien.status, 200);
  assert.match(bien.headers.get('cache-control'), /s-maxage=300/);
  assert.equal(bien.headers.get('x-robots-tag'), 'noindex');
  assert.equal(bien.headers.get('x-content-type-options'), 'nosniff');
  const cuerpo = await bien.json();
  assert.equal(cuerpo.seccion, 'mexico');
  assert.equal(cuerpo.zona, null);
  assert.equal(cuerpo.rubro, null);
  assert.equal(cuerpo.consultado, AHORA);
  assert.deepEqual(cuerpo.resultados.map((r) => r.titulo), filas.map((r) => r.titulo), 'en el orden del feed');
  assert.equal(cuerpo.fuentes.length, 1);
  assert.equal(cuerpo.fuentes[0].idioma, 'es');
  assert.equal(cuerpo.fuentes[0].estado, 'ok');
  assert.equal(cuerpo.fuentes[0].obtenidas, 5);
  assert.equal(cuerpo.fuentes[0].error, null);
  assert.equal(cuerpo.truncada, false);

  // --- Internacional: dos ediciones intercaladas y SIN reordenar por fecha ---
  const porLocale = (url) => (url.includes('hl=es-419') ? 'es' : url.includes('hl=en-US') ? 'en' : assert.fail('locale desconocido: ' + url));
  const inter = await responderActualidad({ a: 'internacional', z: null, t: null }, async (url) => {
    assert.ok(url.includes('/topic/WORLD?'), url);
    return new Response(porLocale(url) === 'es'
      ? feed(item('Viejo primero', VIEJO), item('Nuevo segundo', NUEVO))
      : feed(item('Old first', VIEJO), item('New second', NUEVO)));
  }, AHORA);
  const ci = await inter.json();
  assert.deepEqual(ci.resultados.map((r) => r.titulo), ['Viejo primero', 'Old first', 'Nuevo segundo', 'New second'],
    'por turnos y en el orden de Google, aunque el mas nuevo venga segundo');
  assert.deepEqual(ci.resultados.map((r) => r.idioma), ['es', 'en', 'es', 'en']);
  assert.deepEqual(ci.fuentes.map((f) => f.idioma), ['es', 'en']);
  assert.match(inter.headers.get('cache-control'), /s-maxage=300/);

  // --- Fallas rio arriba: siempre 200, la salud dentro, y NUNCA al CDN ------
  const html = await responderActualidad({ a: 'mexico', z: null, t: null }, async () => new Response('<!doctype html><html><body>consent</body></html>'), AHORA);
  assert.equal(html.status, 200);
  const ch = await html.json();
  assert.equal(ch.fuentes[0].estado, 'fallo');
  assert.match(ch.fuentes[0].error, /HTML/);
  assert.deepEqual(ch.resultados, []);
  assert.equal(html.headers.get('cache-control'), 'private, no-store');

  const tarde = await responderActualidad({ a: 'mexico', z: null, t: null }, async () => { throw new DOMException('timeout', 'TimeoutError'); }, AHORA);
  assert.match((await tarde.json()).fuentes[0].error, /no respondio en 6 s/);
  assert.equal(tarde.headers.get('cache-control'), 'private, no-store');

  const caido = await responderActualidad({ a: 'mexico', z: null, t: null }, async () => new Response('x', { status: 503 }), AHORA);
  assert.match((await caido.json()).fuentes[0].error, /503/);
  assert.equal(caido.headers.get('cache-control'), 'private, no-store');

  // Redireccion: la seccion contesta 302 al id opaco y fetch lo sigue solo.
  // Al mismo host, bien; a otro host, ni un byte.
  const mismoHost = await responderActualidad({ a: 'mexico', z: null, t: null },
    async () => redirigida(XML, 'https://news.google.com/rss/topics/CAAqKAgKIiJDQkFT?hl=es-419&gl=MX&ceid=MX:es-419'), AHORA);
  assert.equal((await mismoHost.json()).fuentes[0].estado, 'ok');
  assert.match(mismoHost.headers.get('cache-control'), /s-maxage=300/);
  const otroHost = await responderActualidad({ a: 'mexico', z: null, t: null }, async () => redirigida(XML, 'https://evil.example/rss'), AHORA);
  const co = await otroHost.json();
  assert.equal(co.fuentes[0].estado, 'fallo');
  assert.match(co.fuentes[0].error, /fuera de news\.google\.com: evil\.example/);
  assert.deepEqual(co.resultados, []);
  assert.equal(otroHost.headers.get('cache-control'), 'private, no-store');

  // Un locale caido no tumba el otro, pero si le quita el cache al conjunto.
  const parcial = await responderActualidad({ a: 'internacional', z: null, t: null }, async (url) =>
    porLocale(url) === 'en' ? new Response('x', { status: 503 }) : new Response(feed(item('Solo español', NUEVO))), AHORA);
  const cp = await parcial.json();
  assert.equal(parcial.status, 200);
  assert.deepEqual(cp.resultados.map((r) => r.titulo), ['Solo español']);
  assert.equal(cp.fuentes[0].estado, 'ok');
  assert.equal(cp.fuentes[1].estado, 'fallo');
  assert.equal(cp.fuentes[1].error, 'Google respondio 503');
  assert.equal(parcial.headers.get('cache-control'), 'private, no-store');

  // Tope: dos ediciones de 25 pasan de los 15 de la actualidad y se dice.
  const muchos = (prefijo) => feed(...Array.from({ length: 25 }, (_, i) => item(`${prefijo} ${i}`, NUEVO)));
  const largo = await responderActualidad({ a: 'internacional', z: null, t: null }, async (url) => new Response(muchos(porLocale(url))), AHORA);
  const cl = await largo.json();
  assert.equal(cl.resultados.length, TOPE_ACTUALIDAD);
  assert.equal(TOPE_ACTUALIDAD, 15, 'el cliente pidio quince');
  assert.equal(cl.truncada, true);

  // Ambito con corpus o inventado: 400 y NO se toca la red.
  for (const malo of ['zona', 'mundo', null]) {
    const r = await responderActualidad({ a: malo, z: null, t: null }, async () => assert.fail('no debia consultar a Google'), AHORA);
    assert.equal(r.status, 400, String(malo));
    assert.equal(r.headers.get('cache-control'), 'private, no-store');
    assert.equal((await r.json()).codigo, 'ambito');
  }

  // --- Secciones LOCALES: la zona por z=, el corredor por a=region ------------
  // El nombre es un segmento de ruta: va con encodeURIComponent, acento incluido.
  assert.equal(urlDeLugar('San Quintín', 'es'), 'https://news.google.com/rss/headlines/section/geo/San%20Quint%C3%ADn?hl=es-419&gl=MX&ceid=MX%3Aes-419');
  assert.equal(urlDeLugar('San Diego', 'en'), 'https://news.google.com/rss/headlines/section/geo/San%20Diego?hl=en-US&gl=US&ceid=US%3Aen');

  const pedidasTj = [];
  const tj = await responderActualidad({ a: null, z: 'tijuana', t: null }, async (url) => {
    pedidasTj.push(url);
    return new Response(feed(item(porLocale(url) === 'es' ? 'Local en español' : 'Local in English', NUEVO)));
  }, AHORA);
  // La SECCION de Tijuana, solo en espanol. La de ingles devolvia local del
  // condado de San Diego sin relacion con Tijuana —Chula Vista, Imperial
  // Beach, South Bay—, medido el 16 de septiembre de 2026. La BUSQUEDA en
  // ingles se conserva (mas abajo): lleva los terminos de lugar pegados y si
  // trae cobertura fronteriza de verdad.
  assert.deepEqual(pedidasTj, [urlDeLugar('Tijuana', 'es')], 'la seccion de Tijuana, solo en espanol');
  const ctj = await tj.json();
  assert.equal(ctj.seccion, 'zona');
  assert.equal(ctj.zona, 'tijuana');
  assert.deepEqual(ctj.resultados.map((r) => r.idioma), ['es']);
  assert.match(tj.headers.get('cache-control'), /s-maxage=300/);

  const pedidasSd = [];
  await responderActualidad({ a: null, z: 'san-diego', t: null }, async (url) => { pedidasSd.push(url); return new Response(feed()); }, AHORA);
  assert.deepEqual(pedidasSd, [urlDeLugar('San Diego', 'en')], 'San Diego solo en ingles');

  const pedidasReg = [];
  const reg = await responderActualidad({ a: 'region', z: null, t: null }, async (url) => { pedidasReg.push(url); return new Response(feed()); }, AHORA);
  assert.deepEqual(pedidasReg, [urlDeLugar('Tijuana', 'es'), urlDeLugar('San Diego', 'en')],
    'el corredor son sus dos polos, no la seccion "Baja California", que llega vacia');
  const creg = await reg.json();
  assert.equal(creg.seccion, 'region');
  assert.equal(creg.zona, null);
  assert.deepEqual(creg.resultados, []);
  assert.deepEqual(creg.fuentes.map((f) => [f.idioma, f.estado, f.obtenidas]), [['es', 'ok', 0], ['en', 'ok', 0]]);

  // z= manda: una zona inventada es 400 sin tocar la red, aunque a= sea valido.
  const zonaMala = await responderActualidad({ a: 'mexico', z: 'nada', t: null }, async () => assert.fail('no debia consultar a Google'), AHORA);
  assert.equal(zonaMala.status, 400);
  assert.equal((await zonaMala.json()).codigo, 'zona');
  assert.equal(zonaMala.headers.get('cache-control'), 'private, no-store');

  // --- Rubros: una BUSQUEDA de terminos + lugar, en el idioma de la edicion -----
  for (const r of RUBROS) {
    assert.ok(NOMBRE_RUBRO[r], r);
    for (const idioma of ['es', 'en']) {
      const t = TERMINOS_RUBRO[r][idioma];
      assert.ok(t.startsWith('(') && t.endsWith(')'), `${r}/${idioma} entre parentesis, o el OR se come el lugar`);
    }
  }
  const qClima = consultaDeRubro('clima', 'es', 'zona', 'Tijuana');
  assert.ok(qClima.includes(TERMINOS_RUBRO.clima.es), 'terminos del rubro');
  assert.ok(qClima.includes(VENTANA_RUBRO), 'ventana');
  assert.ok(qClima.includes('Tijuana'), 'terminos de lugar de la zona');
  assert.ok(consultaDeRubro('clima', 'es', 'region', null).includes('Baja California'), 'la region pega sus terminos');
  assert.equal(consultaDeRubro('clima', 'es', 'mexico', null), `${TERMINOS_RUBRO.clima.es} ${VENTANA_RUBRO}`, 'una edicion no acota por lugar');

  const pedidasRubro = [];
  const rubroTj = await responderActualidad({ a: null, z: 'tijuana', t: 'clima' }, async (url) => {
    pedidasRubro.push(url);
    return new Response(feed(item(porLocale(url) === 'es' ? 'Lluvia en Tijuana' : 'Rain in Tijuana', NUEVO)));
  }, AHORA);
  assert.deepEqual(pedidasRubro, [
    urlDeFeed(consultaDeRubro('clima', 'es', 'zona', 'Tijuana'), 'es'),
    urlDeFeed(consultaDeRubro('clima', 'en', 'zona', 'Tijuana'), 'en'),
  ], 'un rubro en Tijuana son dos busquedas, una por edicion');
  assert.ok(pedidasRubro[0].startsWith('https://news.google.com/rss/search?'), 'busqueda, no seccion');
  const cr = await rubroTj.json();
  assert.equal(cr.seccion, 'zona');
  assert.equal(cr.zona, 'tijuana');
  assert.equal(cr.rubro, 'clima');
  assert.deepEqual(cr.resultados.map((x) => x.titulo), ['Lluvia en Tijuana', 'Rain in Tijuana']);

  const pedidasReg2 = [];
  await responderActualidad({ a: 'region', z: null, t: 'deportes' }, async (url) => { pedidasReg2.push(url); return new Response(feed()); }, AHORA);
  assert.equal(pedidasReg2.length, 2);
  assert.ok(pedidasReg2.every((u) => new URL(u).searchParams.get('q').includes('Baja California')), 'el corredor busca con sus terminos de region');

  // Rubro inventado: 400 sin tocar la red. La zona se valida antes que el rubro.
  const rubroMalo = await responderActualidad({ a: null, z: 'tijuana', t: 'nada' }, async () => assert.fail('no debia consultar a Google'), AHORA);
  assert.equal(rubroMalo.status, 400);
  assert.equal((await rubroMalo.json()).codigo, 'rubro');
  const ambosMalos = await responderActualidad({ a: null, z: 'nada', t: 'nada' }, async () => assert.fail('no debia consultar a Google'), AHORA);
  assert.equal((await ambosMalos.json()).codigo, 'zona');

  // La lectura manual llega al origen, con los mismos filtros y sin cache.
  const manual = await responderActualidad({ a: null, z: 'tijuana', t: 'clima', actualizar: true }, async (url, opciones) => {
    assert.equal(opciones.cache, 'no-store');
    assert.match(new URL(url).searchParams.get('q'), /Tijuana/);
    return new Response(feed(item('Lluvia en Tijuana', NUEVO)));
  }, AHORA);
  assert.equal(manual.headers.get('cache-control'), 'private, no-store');
  assert.equal((await manual.json()).rubro, 'clima');

  const { GET: buscar } = cargar('app/api/buscar/route');
  const pedirOriginal = global.fetch;
  try {
    global.fetch = async (url, opciones) => {
      assert.equal(opciones.cache, 'no-store');
      assert.match(new URL(url).searchParams.get('q'), /lluvia/);
      return new Response(feed(item('Lluvia en Tijuana', NUEVO)));
    };
    for (const actualizar of ['', '&actualizar=1']) {
      const respuesta = await buscar({ nextUrl: new URL('http://localhost/api/buscar?q=lluvia&z=tijuana' + actualizar) });
      assert.equal(respuesta.headers.get('cache-control'), actualizar ? 'private, no-store' : 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
      assert.equal((await respuesta.json()).consulta, 'lluvia');
    }
  } finally { global.fetch = pedirOriginal; }

  const { comprobarActualizacion } = cargar('lib/busqueda/actualizar');
  const anterior = { resultados: [fila('Uno', 'es'), fila('Dos', 'es')], fuentes: [{ estado: 'ok' }], consultado: AHORA };
  assert.equal(comprobarActualizacion(anterior, { ...anterior, consultado: 'otra hora' }), 'No hay titulares nuevos.');
  assert.equal(comprobarActualizacion(anterior, { ...anterior, resultados: [...anterior.resultados].reverse() }), 'Titulares actualizados.');
  assert.match(comprobarActualizacion(anterior, { ...anterior, fuentes: [{ estado: 'ok' }, { estado: 'fallo' }] }), /parcial/);
  assert.throws(() => comprobarActualizacion(anterior, { resultados: [], fuentes: [{ estado: 'fallo' }] }));
  assert.equal(comprobarActualizacion(anterior, { resultados: [], fuentes: [{ estado: 'ok' }] }), 'Titulares actualizados.');

  // El hook usa el mutador real de SWR; solo sustituimos sus lectores React.
  // Dos islas con la misma llave no duplican la peticion y cambiar de filtro
  // durante la espera no lleva los titulares viejos al filtro nuevo.
  const { initCache, SWRGlobalState } = require('swr/_internal');
  const almacen = new Map();
  const [cache, mutar] = initCache(almacen);
  sustitutos.set('swr', {
    __esModule: true,
    default: (llave, lector, opciones) => ({ data: almacen.get(llave)?.data ?? opciones.fallbackData }),
    useSWRConfig: () => ({ cache, mutate: mutar }),
  });
  const { useActualizar } = cargar('lib/busqueda/use-actualizar');
  const llave = '/api/actualidad?z=tijuana&t=clima';
  const otra = '/api/actualidad?z=mexicali&t=clima';
  await mutar(llave, anterior, { revalidate: false });
  await mutar(otra, anterior, { revalidate: false });
  let resolver;
  let llamadasManuales = 0;
  global.fetch = async (url, opciones) => {
    llamadasManuales++;
    assert.equal(url, llave + '&actualizar=1');
    assert.equal(opciones.cache, 'no-store');
    return await new Promise((terminar) => { resolver = terminar; });
  };
  try {
    const primera = useActualizar(llave).actualizar();
    await useActualizar(llave).actualizar();
    await new Promise(setImmediate);
    assert.equal(llamadasManuales, 1);
    assert.equal(useActualizar(llave).actualizando, true);
    assert.equal(useActualizar(otra).actualizando, false);
    assert.deepEqual(almacen.get(llave).data, anterior, 'la lista sigue visible');
    // SWR registra la mutacion pendiente para descartar revalidaciones anteriores.
    const mutacion = SWRGlobalState.get(cache)[1][llave];
    assert.ok(mutacion[0] > 0);
    assert.equal(mutacion[1], 0);
    const nuevo = { ...anterior, resultados: [fila('Tres', 'es')] };
    resolver(Response.json(nuevo));
    await primera;
    assert.deepEqual(almacen.get(llave).data, nuevo);
    assert.deepEqual(almacen.get(otra).data, anterior);
    assert.equal(useActualizar(llave).actualizando, false);
    assert.equal(useActualizar(llave).avisoActualizacion, 'Titulares actualizados.');
    global.fetch = async () => Response.json({ resultados: [], fuentes: [{ estado: 'fallo' }] });
    await useActualizar(llave).actualizar();
    assert.deepEqual(almacen.get(llave).data, nuevo, 'un 200 fallido conserva la lista');
    assert.match(useActualizar(llave).avisoActualizacion, /No se pudo/);
    global.fetch = async () => { throw new Error('sin red'); };
    await useActualizar(llave).actualizar();
    assert.deepEqual(almacen.get(llave).data, nuevo);
    assert.equal(useActualizar(llave).actualizando, false);
    global.fetch = async () => Response.json(nuevo);
    await useActualizar(llave).actualizar();
    assert.equal(useActualizar(llave).avisoActualizacion, 'No hay titulares nuevos.');
  } finally { global.fetch = pedirOriginal; sustitutos.clear(); }

  console.log('Búsqueda: parseo, fusión, URLs, /api/actualidad, secciones locales y rubros verificados offline.');
}

comprobar().catch((error) => { console.error(error); process.exitCode = 1; });
