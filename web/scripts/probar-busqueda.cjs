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

// El cruce contra el archivo lee public/data/notas.json del disco. Aqui NO:
// se sustituye el lector por uno que dice "no hay", que deja las filas tal
// como salieron del feed y mantiene validas las comprobaciones de siempre. Los
// casos que si quieren archivo lo inyectan por el cuarto parametro.
sustitutos.set('@/lib/datos/publicado', { leerDatoPublicado: async () => null });

const { parsearFeed, quitarSufijoMedio } = cargar('lib/busqueda/rss');
const { DOMINIOS_ALTERNOS, normalizarDominio, dominioDeUrl } = cargar('lib/analisis/dominio');
const { fusionarLocales } = cargar('lib/busqueda/fusionar');
const { esDeFuera, soloDeLaRegion, esRedSocial } = cargar('lib/busqueda/region');
const { urlDeFeed, urlDeActualidad, urlDeLugar, esUrlDeGoogle } = cargar('lib/busqueda/google-noticias');
const { responderActualidad, consultaDeRubro } = cargar('lib/busqueda/actualidad');
const { RUBROS, NOMBRE_RUBRO, TERMINOS_RUBRO, VENTANA_RUBRO, PALABRAS_MAXIMAS_GOOGLE, SECCION_DE_RUBRO, consultaDeTerminos, nombraRubro } = cargar('lib/busqueda/rubros');
const { EXTRANJERO, NO_ES_EXTRANJERO, MARCAS_MEXICO, esDeOtroPais, nombraExtranjero, nombraMexico, soloDeMexico } = cargar('lib/busqueda/extranjero');
const { ZONAS_RUTA } = cargar('lib/dominio/zonas');
const { fechaDelTitular, titularVencido } = cargar('lib/busqueda/fecha-titular');
const { AMBITOS, esAmbitoActualidad, usaCorpus } = cargar('lib/busqueda/ambito');
const { TOPE_ACTUALIDAD, TOPE_RELACIONADAS } = cargar('lib/busqueda/tipos');
const { construirIndices } = cargar('lib/busqueda/archivo');
const { responderRelacionadas } = cargar('lib/busqueda/relacionadas-viva');
const { responderBusqueda, CABEZA_GOOGLE } = cargar('lib/busqueda/buscar');
const { SIN_CACHE: SIN_CACHE_BUSQUEDA } = cargar('lib/busqueda/respuesta');

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

// Un rubro de zona suma el archivo (actualidad.ts). Las pruebas que miden lo
// que hace Google con las filas lo apagan: si no, leerian public/data del
// disco y su resultado dependeria de la ultima ingesta.
const SIN_ARCHIVO = async () => null;

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
    // El feed no las trae; las resuelve el servidor contra el archivo.
    imagen: null,
    referencia: null,
    origen: 'google',
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

  // --- Un host que ES otro medio --------------------------------------------
  // 25 de septiembre de 2026: Google rotulo una nota de El Imparcial con el
  // origen de Arc XP, en la url y en el nombre, y la tarjeta decia «Abrir en
  // elimparcial-elimparcial-prod.web.arc-cdn.net».
  const ARC = 'elimparcial-elimparcial-prod.web.arc-cdn.net';
  const itemArc = (rotulo) => `<item><title>Inteligencia artificial comienza a utilizarse en Tijuana - ${rotulo}</title><link>https://news.google.com/rss/articles/CBMarc?oc=5</link><pubDate>Thu, 24 Sep 2026 20:00:00 GMT</pubDate><source url="https://${ARC}">${rotulo}</source></item>`;
  const [arc] = parsearFeed(`<rss><channel>${itemArc(ARC)}</channel></rss>`, 'es', 5);
  assert.deepEqual([arc.titulo, arc.dominio, arc.medio], ['Inteligencia artificial comienza a utilizarse en Tijuana', 'elimparcial.com', 'El Imparcial']);
  // Si Google SI dio un nombre, se queda el suyo; el dominio se corrige igual.
  const [conNombre] = parsearFeed(`<rss><channel>${itemArc('El Imparcial de Sonora')}</channel></rss>`, 'es', 5);
  assert.deepEqual([conNombre.titulo, conNombre.dominio, conNombre.medio], ['Inteligencia artificial comienza a utilizarse en Tijuana', 'elimparcial.com', 'El Imparcial de Sonora']);
  // Todas las comparaciones de host lo ven como elimparcial.com: el resolvedor
  // de Analizar, la foto y el cruce con el archivo.
  assert.equal(normalizarDominio(ARC), 'elimparcial.com');
  assert.equal(dominioDeUrl(`https://${ARC}/tij/tijuana/2026/09/24/x/`), 'elimparcial.com');
  assert.equal(normalizarDominio('constructor'), 'constructor', 'una llave heredada no es un alterno');
  assert.equal(normalizarDominio('evil-elimparcial-prod.web.arc-cdn.net'), 'evil-elimparcial-prod.web.arc-cdn.net', 'exacto, nunca por parecido');
  // La tabla, el pipeline y el catalogo dicen lo mismo.
  const publicadores = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../config/busquedas.json'), 'utf8')).publicadores;
  const catalogoMedios = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../config/medios.json'), 'utf8')).medios;
  for (const [host, { dominio, medio }] of Object.entries(DOMINIOS_ALTERNOS)) {
    const fila = catalogoMedios.find((m) => m.id === publicadores[host]);
    assert.ok(fila, `${host}: sin llave en publicadores de config/busquedas.json`);
    assert.equal(normalizarDominio(new URL(fila.url).hostname), dominio, `${host}: el dominio de ${fila.id}`);
    assert.equal(fila.nombre, medio, `${host}: el nombre de ${fila.id}`);
  }

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
  assert.equal(esDeFuera(fila2('Presunta Falla Mecánica Provoca Incendio de Tráiler en Apodaca, NL', 'nmas.com.mx')), true, 'NL no dice Nuevo León');
  assert.equal(esDeFuera(fila2('Padres clinch the NL West in San Diego', 'fox5sandiego.com')), false, 'la Liga Nacional no es Nuevo León');

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
      const t = consultaDeTerminos(r, idioma);
      assert.ok(t.startsWith('(') && t.endsWith(')'), `${r}/${idioma} entre parentesis, o el OR se come el lugar`);
      for (const termino of TERMINOS_RUBRO[r][idioma]) {
        assert.ok(t.includes(/\s/.test(termino) ? `"${termino}"` : termino), `${r}/${idioma}: ${termino}`);
      }
      // Google lee 32 palabras contando cada OR y tira el resto sin avisar:
      // el lugar y la ventana van al final y serian lo primero en caerse.
      for (const [ambito, zona] of [['region', null], ['mexico', null], ['internacional', null], ...ZONAS_RUTA.map((z) => ['zona', z])]) {
        const q = consultaDeRubro(r, idioma, ambito, zona);
        const palabras = q.split(/\s+/).length;
        assert.ok(palabras <= PALABRAS_MAXIMAS_GOOGLE, `${r}/${idioma}/${zona ?? ambito}: ${palabras} palabras, Google lee ${PALABRAS_MAXIMAS_GOOGLE}: ${q}`);
      }
    }
  }
  const qClima = consultaDeRubro('clima', 'es', 'zona', 'Tijuana');
  assert.ok(qClima.includes(consultaDeTerminos('clima', 'es')), 'terminos del rubro');
  assert.ok(qClima.includes('"frente frío"'), 'una frase va entre comillas');
  assert.ok(qClima.includes(VENTANA_RUBRO), 'ventana');
  assert.ok(qClima.includes('Tijuana'), 'terminos de lugar de la zona');
  assert.ok(consultaDeRubro('clima', 'es', 'region', null).includes('Baja California'), 'la region pega sus terminos');
  assert.equal(consultaDeRubro('clima', 'es', 'mexico', null), `${consultaDeTerminos('clima', 'es')} ${VENTANA_RUBRO}`, 'una edicion no acota por lugar');

  // --- El titular tiene que nombrar lo que se busco -----------------------------
  // Casos del 25 de septiembre de 2026. `intitle:` de Google ve el titulo con
  // el sufijo del medio, y rss.ts ya lo quito: aqui llega sin el.
  for (const [titulo, rubro, idioma, esperado] of [
    ['Hurricane Polo Heading To Baja California Region Of Mexico', 'deportes', 'en', false], // - FOX Sports Radio
    ['San Diego Tijuana International Jazz Festival to celebrate third year with four concerts, three of them free', 'deportes', 'en', false],
    ['Heat wave hits San Diego County', 'deportes', 'en', false],
    ['Padres de familia protestan frente a escuela de Tijuana', 'deportes', 'es', false],
    ['Tijuana vs Atlas: Pronóstico y posibles alineaciones del partido de la Liga MX', 'clima', 'es', false],
    ['Realizan Congreso Internacional de Bomberos de Tijuana', 'politica', 'es', false],
    ['Venden pan de muerto en Tijuana', 'politica', 'es', false],
    ['Xolos de Tijuana enfrenta hoy al Atlas', 'deportes', 'es', true],
    ['Justin Turner, campeón con TOROS de Tijuana, quiere seguir en LMB', 'deportes', 'es', true],
    ['Padres Homestand Release #14 (September 25-27)', 'deportes', 'en', true],
    ['Clima en Tijuana: viernes 25 de septiembre con calor persistente', 'clima', 'es', true],
    ['Warning issued for American travelers near Hurricane Polo', 'clima', 'en', true],
    ['Hallan sin vida a hombre de familia desaparecida en Tijuana', 'seguridad', 'es', true],
    ['Aprueban diputados reforma en el Congreso del Estado', 'politica', 'es', true],
    ['Balean a dos mujeres en Playas de Tijuana', 'seguridad', 'es', true],
  ]) {
    assert.equal(nombraRubro(titulo, rubro, idioma), esperado, `${rubro}/${idioma}: ${titulo}`);
  }

  // --- Un titular que dice, entre parentesis, una fecha vieja --------------------
  const HOY = '2026-09-25T15:00:00.000Z';
  for (const titulo of [
    'Atl. San Luis 0-0 Tijuana (31 de Jul., 2026) Resultado Final',
    'Guadalajara 5-2 Tijuana (22 de Ago., 2026) Resultado Final',
    'Tijuana 2-1 Cruz Azul (Aug 16, 2026) Final Score',
  ]) {
    assert.ok(titularVencido(titulo, HOY), titulo);
  }
  assert.equal(fechaDelTitular('Tijuana 2-1 Cruz Azul (Aug 16, 2026) Final Score').toISOString(), '2026-08-16T00:00:00.000Z');
  for (const titulo of [
    'Tijuana vs. Atlas (25 Sep., 2026) Resultados en Vivo', // la de hoy
    'Recuerdan el sismo del 19 de septiembre de 1985', // fecha en la prosa
    'Resumen de la semana (del 1 al 7)', // sin fecha completa
    'Garita de San Ysidro se satura (Datos actualizados a las 8:00 AM PDT)',
    'Posada (20 de diciembre, 2026)', // futura
  ]) {
    assert.equal(titularVencido(titulo, HOY), false, titulo);
  }

  // Las dos rejas en la respuesta: el rubro quita lo que no lo nombra y la
  // pagina vieja; la seccion, solo la pagina vieja.
  const rejas = await responderActualidad({ a: null, z: 'tijuana', t: 'deportes' }, async (url) => new Response(porLocale(url) === 'es'
    ? feed(item('Xolos de Tijuana enfrenta hoy al Atlas', NUEVO), item('Atl. San Luis 0-0 Tijuana (31 de Jul., 2026) Resultado Final', NUEVO, 'ESPN México'))
    : feed(item('San Diego Tijuana International Jazz Festival to celebrate third year', NUEVO), item('Hurricane Polo Heading To Baja California', NUEVO, 'FOX Sports Radio'), item('Padres beat Dodgers in Tijuana exhibition', NUEVO))), HOY, SIN_ARCHIVO);
  assert.deepEqual((await rejas.json()).resultados.map((x) => x.titulo), ['Xolos de Tijuana enfrenta hoy al Atlas', 'Padres beat Dodgers in Tijuana exhibition']);
  const seccionVieja = await responderActualidad({ a: null, z: 'tijuana', t: null }, async () => new Response(feed(
    item('Guadalajara 5-2 Tijuana (22 de Ago., 2026) Resultado Final', NUEVO, 'ESPN México'), item('Cierran la garita de Tijuana', NUEVO))), HOY);
  assert.deepEqual((await seccionVieja.json()).resultados.map((x) => x.titulo), ['Cierran la garita de Tijuana']);

  const pedidasRubro = [];
  const rubroTj = await responderActualidad({ a: null, z: 'tijuana', t: 'clima' }, async (url) => {
    pedidasRubro.push(url);
    return new Response(feed(item(porLocale(url) === 'es' ? 'Lluvia en Tijuana' : 'Rain in Tijuana', NUEVO)));
  }, AHORA, SIN_ARCHIVO);
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

  // --- Mexico: la seccion de Google para lo que Google clasifica ------------
  // 25 de septiembre de 2026. Espectaculos con la entrada Mexico abria con
  // «Soda Stereo en Madrid» y «Susan Sarandon es arrestada en Nueva York»: una
  // busqueda sin lugar trae cualquier medio en espanol del mundo.
  assert.equal(NOMBRE_RUBRO.espectaculos, 'Entretenimiento', 'el nombre del cliente; la llave no cambia');
  assert.deepEqual(SECCION_DE_RUBRO, { espectaculos: 'ENTERTAINMENT', deportes: 'SPORTS', economia: 'BUSINESS' });
  const pedidasTema = [];
  const entretenimiento = await responderActualidad({ a: 'mexico', z: null, t: 'espectaculos' }, async (url) => {
    pedidasTema.push(url);
    return new Response(feed(
      item('Aleks Syntek arremete contra la prensa de espectáculos', NUEVO, 'El Informador'),
      item('Soda Stereo en Madrid: el concierto del holograma consigue emocionar a casi todos', NUEVO, 'EL PAÍS', 'elpais.com'),
      item('Susan Sarandon es arrestada en Nueva York: esto hizo la actriz de 79 años', NUEVO, 'Univision'),
      item('Bad Bunny anuncia gira por México y España', NUEVO, 'Infobae'),
      item('Cultura', NUEVO, 'jornada.com.mx'),
      item('Luto en Televisa: muere actor de telenovelas', NUEVO, 'Infobae'),
    ));
  }, AHORA);
  assert.deepEqual(pedidasTema, [urlDeActualidad('ENTERTAINMENT', 'es')], 'la seccion de la edicion MX, una sola, no una busqueda');
  assert.deepEqual((await entretenimiento.json()).resultados.map((x) => x.titulo), [
    'Aleks Syntek arremete contra la prensa de espectáculos',
    'Bad Bunny anuncia gira por México y España',
    'Luto en Televisa: muere actor de telenovelas',
  ], 'sin reja de terminos (la clasifico Google), con la reja de Mexico, y sin la pagina de seccion «Cultura»');
  // Un lugar no tiene seccion por tema, y el mundo tampoco: siguen buscando.
  const pedidasOtro = [];
  await responderActualidad({ a: 'internacional', z: null, t: 'espectaculos' }, async (url) => { pedidasOtro.push(url); return new Response(feed()); }, AHORA);
  await responderActualidad({ a: null, z: 'tijuana', t: 'espectaculos' }, async (url) => { pedidasOtro.push(url); return new Response(feed()); }, AHORA);
  assert.ok(pedidasOtro.every((u) => u.startsWith('https://news.google.com/rss/search?')), 'Internacional y una zona: busqueda');
  // Un rubro sin seccion sigue siendo busqueda en Mexico, y pasa la reja.
  const seguridadMx = await responderActualidad({ a: 'mexico', z: null, t: 'seguridad' }, async (url) => {
    assert.ok(url.startsWith('https://news.google.com/rss/search?'), url);
    return new Response(feed(
      item('Detienen a ocho presuntos integrantes del Cártel de Sinaloa', NUEVO),
      item('Detienen a líderes de fraternidad en Nueva York', NUEVO, 'Univision'),
    ));
  }, AHORA);
  assert.deepEqual((await seguridadMx.json()).resultados.map((x) => x.titulo), ['Detienen a ocho presuntos integrantes del Cártel de Sinaloa']);
  // La seccion NATION sin rubro no pasa la reja: es la nacional de Google.
  const nation = await responderActualidad({ a: 'mexico', z: null, t: null }, async () => new Response(feed(item('Trump recibe a Xi Jinping en Washington', NUEVO))), AHORA);
  assert.equal((await nation.json()).resultados.length, 1);

  // --- La reja de Mexico: la lista del pipeline, copiada y vigilada ---------
  // pulso/zonas.py se midio sobre 6,699 titulares; esta es su copia. Si alla
  // cambia, aqui se rompe.
  const zonasPy = fs.readFileSync(path.resolve(__dirname, '../../pulso/zonas.py'), 'utf8');
  const listaPy = (nombre) => {
    const cuerpo = zonasPy.slice(zonasPy.indexOf(`\n${nombre} = [`) + nombre.length + 5);
    return [...cuerpo.slice(0, cuerpo.indexOf('\n]')).replace(/#.*$/gm, '').matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  };
  assert.deepEqual([...EXTRANJERO], listaPy('EXTRANJERO'), 'EXTRANJERO es la copia de pulso/zonas.py');
  assert.deepEqual([...NO_ES_EXTRANJERO], listaPy('_NO_ES_EXTRANJERO'));
  assert.deepEqual([...MARCAS_MEXICO], listaPy('_MARCAS_MEXICO'));
  assert.ok(EXTRANJERO.length > 150, 'la lectura del .py no puede pasar por vacia');
  const filaMx = (titulo, dominio = 'medio.example') => ({ titulo, dominio });
  for (const [titulo, fuera, porque] of [
    ['Soda Stereo en Madrid: el concierto del holograma', true, 'el caso'],
    ['Susan Sarandon es arrestada en Nueva York', true, 'el caso'],
    ['Bad Bunny anuncia gira por México y España', false, 'nombrar a Mexico gana'],
    ['Balacera en Culiacán deja a un cantante herido; lo trasladan a Houston', false, 'un lugar de Mexico gana'],
    ['Festival del Chile en Nogada en Rosarito', false, 'el platillo no es el pais'],
    ['Van a la Colonia Roma a comer', false, 'la colonia no es Roma'],
    ['Los alumnos irán a clases el lunes', false, 'el verbo, no Iran'],
    ['Sheinbaum habla de aranceles con Washington', false, 'una institucion federal es Mexico'],
    ['Maribel Guardia demanda a Imelda', false, 'sin lugar no se puede probar que sea de fuera'],
    ['Detienen a sospechoso en la cañada del arroyo', false, 'la cañada no es Canada'],
    ['Taylor Swift llena el estadio de Londres', true, 'Londres'],
  ]) {
    assert.equal(esDeOtroPais(filaMx(titulo)), fuera, `${porque}: ${titulo}`);
  }
  assert.equal(esDeOtroPais(filaMx('Concierto en el Zócalo', 'lanacion.com.ar')), true, 'un medio de otro pais');
  assert.equal(esDeOtroPais(filaMx('Concierto en el Zócalo', 'facebook.com')), true, 'una red social no es un medio');
  assert.equal(nombraMexico('Llueve en Nuevo México'), false, 'Nuevo Mexico es de Estados Unidos');
  assert.equal(nombraExtranjero('Llueve en Nuevo México'), true);
  assert.deepEqual(soloDeMexico([filaMx('Uno en Madrid'), filaMx('Otro en Tijuana')]).map((x) => x.titulo), ['Otro en Tijuana']);

  // --- La busqueda: Google tal cual a la cabeza, y la entrada manda ---------
  // 25 de septiembre de 2026: «mañanera» salia como
  // `mañanera ("Baja California" OR Tijuana ...)` y no daba lo que Google
  // Noticias. Sin lugar, en la edicion MX, daba exactamente eso.
  const cabezaGoogle = Array.from({ length: 12 }, (_, i) => item(`Mañanera nacional ${i + 1}`, NUEVO, `Medio ${i}`));
  const pedidasQ = [];
  const enCorredor = await (await responderBusqueda({ q: 'mañanera', z: null, a: null, actualizar: false }, async (url) => {
    pedidasQ.push(url);
    const q = new URL(url).searchParams.get('q');
    if (q === 'mañanera') return new Response(feed(...cabezaGoogle));
    return new Response(feed(item(porLocale(url) === 'es' ? 'Mañanera sobre Tijuana' : 'Mañanera in San Diego', NUEVO)));
  }, async () => null, { leerCatalogo: async () => null })).json();
  assert.equal(new URL(pedidasQ[0]).searchParams.get('q'), 'mañanera', 'primero, la palabra tal cual');
  assert.equal(new URL(pedidasQ[0]).searchParams.get('hl'), 'es-419', 'en la edicion mexicana');
  assert.equal(CABEZA_GOOGLE, 10);
  assert.deepEqual(enCorredor.resultados.slice(0, 10).map((x) => x.titulo), cabezaGoogle.slice(0, 10).map((_, i) => `Mañanera nacional ${i + 1}`),
    'la primera pagina de Google, en su orden y sin turnos');
  assert.ok(enCorredor.resultados.slice(10).some((x) => x.titulo === 'Mañanera sobre Tijuana'), 'lo del corredor sigue, debajo');
  assert.ok(pedidasQ.some((u) => new URL(u).searchParams.get('q').includes('Baja California')), 'y se sigue buscando en el corredor');
  // Desde Mexico: una sola busqueda, sin lugar, sin medios del corredor.
  const pedidasMx = [];
  await responderBusqueda({ q: 'mañanera', z: null, a: 'mexico', actualizar: false }, async (url) => { pedidasMx.push(url); return new Response(feed()); },
    async () => null, { leerCatalogo: async () => ({ buscadores: [{ id: 'bn', nombre: 'BN', url: 'https://blancoynegro.mx/?s={q}&feed=rss2', idioma: 'es' }], medios: [], cuentas: [] }), robots: async () => true });
  assert.deepEqual(pedidasMx.map((u) => new URL(u).searchParams.get('q')), ['mañanera'], 'una busqueda, sin lugar, y ningun medio del corredor');
  // Una zona sigue acotada y sin la consulta tal cual.
  const pedidasZona = [];
  await responderBusqueda({ q: 'bacheo', z: 'tijuana', a: null, actualizar: false }, async (url) => { pedidasZona.push(url); return new Response(feed()); },
    async () => null, { leerCatalogo: async () => null });
  assert.ok(pedidasZona.every((u) => new URL(u).searchParams.get('q').includes('Tijuana')), '/tijuana busca en Tijuana');
  // Y el cliente manda la entrada: el campo oculto y el parametro.
  const buscador = fs.readFileSync(path.resolve(__dirname, '../src/components/ahora/buscador-ahora.tsx'), 'utf8');
  assert.match(buscador, /ocultos=\{esEdicion\(entrada\) \? \{ \[PARAM_EDICION\]: entrada \} : \{\}\}/);
  const gancho = fs.readFileSync(path.resolve(__dirname, '../src/lib/busqueda/use-busqueda.ts'), 'utf8');
  assert.match(gancho, /if \(esEdicion\(entrada\)\) partes\.push\(`a=\$\{entrada\}`\)/);

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

  // --- Cruce contra el archivo publicado ---------------------------------
  //
  // Lo que antes hacia el navegador con las 6,020 notas descargadas y ahora
  // resuelve el servidor sobre las filas que de verdad salen.
  const nota = (titulo, extra = {}) => ({
    id: 'n:' + titulo, titulo,
    url: 'https://zetatijuana.com/' + encodeURIComponent(titulo),
    dominio: 'zetatijuana.com', fuente: 'zeta',
    zona_medio: 'Tijuana', zonas: ['Tijuana'], alcance: 'zona',
    fecha: '2026-09-10', publicado: null, capturado: '2026-09-10T00:00:00+00:00',
    postura: 'negativa', figuras: ['Alguien'],
    ...extra,
  });
  const APAGON = 'Reportan apagon en la zona centro';
  const conArchivo = (notas) => async () => construirIndices(notas);
  const soloEs = async (url) => new Response(/hl=en/.test(url) ? feed() : XML);

  // 1. Empata por titular plegado Y dominio: llegan miniatura y enlace propio.
  const atado = await responderActualidad({ a: 'mexico', z: null, t: null }, soloEs, AHORA,
    conArchivo([nota(APAGON, { imagen: 'https://zetatijuana.com/foto.jpg' })]));
  const filaAtada = (await atado.json()).resultados.find((r) => r.titulo === APAGON);
  assert.equal(filaAtada.imagen, 'https://zetatijuana.com/foto.jpg');
  assert.equal(filaAtada.referencia.dominio, 'zetatijuana.com');
  assert.ok(!esUrlDeGoogle(filaAtada.referencia.url), 'con empate manda el enlace del medio');

  // 2. El MISMO titular publicado por otro medio no presta su enlace. Es la
  //    copia sindicada: leerla y atribuirla a Zeta seria una atribucion falsa.
  const ajeno = await responderActualidad({ a: 'mexico', z: null, t: null }, soloEs, AHORA,
    conArchivo([nota(APAGON, {
      url: 'https://otromedio.example/' + encodeURIComponent(APAGON),
      imagen: 'https://otromedio.example/foto.jpg',
    })]));
  const filaAjena = (await ajeno.json()).resultados.find((r) => r.titulo === APAGON);
  assert.ok(esUrlDeGoogle(filaAjena.referencia.url), 'sin empate de dominio se conserva el token');
  // La miniatura SI cruza solo por titular (imagenes.ts lo dice y lo razona):
  // es la foto de la misma nota, no el cuerpo de otra.
  assert.equal(filaAjena.imagen, 'https://otromedio.example/foto.jpg');

  // 3. Sin archivo legible las filas salen como del feed. Mismo estado que una
  //    fila sin empate, no uno nuevo: la tarjeta no tiene que distinguirlo.
  const sinArchivo = await responderActualidad({ a: 'mexico', z: null, t: null }, soloEs, AHORA,
    async () => null);
  const filaSuelta = (await sinArchivo.json()).resultados.find((r) => r.titulo === APAGON);
  assert.equal(filaSuelta.imagen, null);
  assert.equal(filaSuelta.referencia, null);

  // 4. /api/buscar ata igual que /api/actualidad: el mismo cruce, un solo sitio.
  const buscada = await responderBusqueda({ q: 'apagon', z: null, a: null, actualizar: false },
    soloEs, conArchivo([nota(APAGON, { imagen: 'https://zetatijuana.com/foto.jpg' })]));
  const filaBuscada = (await buscada.json()).resultados.find((r) => r.titulo === APAGON);
  assert.equal(filaBuscada.imagen, 'https://zetatijuana.com/foto.jpg');

  // 5. Desde el 23 de septiembre de 2026 la busqueda de region lee tambien el
  //    buscador propio de los medios y el archivo, por turnos con Google.
  const wp = (...items) => `<?xml version="1.0"?><rss version="2.0"><channel>${items.map(([t, l, f]) =>
    `<item><title>${t}</title><link>${l}</link><pubDate>${f}</pubDate></item>`).join('')}</channel></rss>`;
  const FEED_MEDIO = wp(
    ['Otro apagon en la colonia Libertad', 'https://blancoynegro.mx/2026/09/apagon/', 'Wed, 09 Sep 2026 10:00:00 GMT'],
    ['Sin luz, sin nombrar la palabra', 'https://blancoynegro.mx/2026/09/luz/', 'Wed, 09 Sep 2026 09:00:00 GMT'],
    ['Apagon copiado en otro sitio', 'https://agregador.example/apagon', 'Wed, 09 Sep 2026 08:00:00 GMT'],
  );
  const CATALOGO = { buscadores: [{ id: 'blancoynegro', nombre: 'Blanco y Negro Noticias', url: 'https://blancoynegro.mx/?s={q}&feed=rss2', idioma: 'es' }], medios: [], cuentas: [] };
  const pedidas = [];
  const conMedio = async (url) => {
    pedidas.push(url);
    return new URL(url).hostname === 'blancoynegro.mx' ? new Response(FEED_MEDIO) : soloEs(url);
  };
  const dependencias = { leerCatalogo: async () => CATALOGO, robots: async () => true, ahora: () => new Date(AHORA) };
  const ARCHIVO_APAGON = conArchivo([nota('El apagon de agosto, un mes despues'), nota('Nota que no nombra nada')]);
  const region = await (await responderBusqueda({ q: 'apagon', z: null, a: null, actualizar: false },
    conMedio, ARCHIVO_APAGON, dependencias)).json();
  const delMedio = region.resultados.filter((r) => r.origen === 'medio');
  assert.deepEqual(delMedio.map((r) => r.titulo), ['Otro apagon en la colonia Libertad'],
    'solo lo que NOMBRA el termino y enlaza al propio medio');
  assert.equal(delMedio[0].medio, 'Blanco y Negro Noticias');
  assert.equal(delMedio[0].referencia.url, 'https://blancoynegro.mx/2026/09/apagon/', 'Analizar abre la nota del medio');
  assert.deepEqual(region.resultados.filter((r) => r.origen === 'archivo').map((r) => r.titulo), ['El apagon de agosto, un mes despues']);
  assert.deepEqual(region.medios.map((m) => m.estado), ['ok']);
  const url = new URL(pedidas.find((u) => u.includes('blancoynegro')));
  assert.equal(url.searchParams.get('s'), 'apagon', 'el termino va sin comillas');

  // En la zona no se leen los medios: no son de una zona, y le acreditarian a
  // Tijuana lo que publico uno de Ensenada. El archivo si, filtrado por zona.
  pedidas.length = 0;
  const zona = await (await responderBusqueda({ q: 'apagon', z: 'mexicali', a: null, actualizar: false },
    conMedio, ARCHIVO_APAGON, dependencias)).json();
  assert.ok(!pedidas.some((u) => u.includes('blancoynegro')));
  assert.deepEqual(zona.medios, []);
  assert.ok(!zona.resultados.some((r) => r.origen === 'archivo'), 'la nota habla de Tijuana, no de Mexicali');

  // Un robots.txt que dice que no es su respuesta, no una falla: se cachea.
  pedidas.length = 0;
  const robotsNo = await responderBusqueda({ q: 'apagon', z: null, a: null, actualizar: false },
    conMedio, ARCHIVO_APAGON, { ...dependencias, robots: async () => false });
  assert.deepEqual((await robotsNo.clone().json()).medios.map((m) => m.estado), ['robots']);
  assert.ok(!pedidas.some((u) => u.includes('blancoynegro')), 'ni una peticion al medio');
  assert.notEqual(robotsNo.headers.get('Cache-Control'), SIN_CACHE_BUSQUEDA);
  // Un medio que contesta HTML si es una falla y se dice; pero en la portada
  // no le quita el cache a lo de Google: ahi los medios son de mejor esfuerzo.
  const medioHtml = await responderBusqueda({ q: 'apagon', z: null, a: null, actualizar: false },
    async (u) => (new URL(u).hostname === 'blancoynegro.mx' ? new Response('<!doctype html><html></html>') : soloEs(u)),
    ARCHIVO_APAGON, dependencias);
  assert.deepEqual((await medioHtml.clone().json()).medios.map((m) => m.estado), ['fallo']);
  assert.notEqual(medioHtml.headers.get('Cache-Control'), SIN_CACHE_BUSQUEDA);

  // 6. Un capitulo de rubro de una zona suma, por turnos con Google, el
  //    archivo de ese rubro y ese lugar (25 de septiembre de 2026). El caso es
  //    real: la semana del 18 al 25, 18 de las 19 notas de Deportes de Mexicali
  //    eran de la seccion de La Voz, y solo tres titulares decian el rubro.
  const VOZ = (slug) => ({ fuente: 'lavoz', dominio: 'oem.com.mx', url: `https://oem.com.mx/lavozdelafrontera/deportes/${slug}` });
  const HACE_UN_DIA = '2026-09-10T20:00:00+00:00';
  const CAT_RUBRO = { buscadores: [], cuentas: [], medios: [
    { id: 'lavoz', nombre: 'La Voz de la Frontera', dominio: 'oem.com.mx', idioma: 'es', activo: true },
    { id: 'notiens', nombre: 'Noticias Ensenada', dominio: 'noticiasensenada.com', idioma: 'es', activo: false },
  ] };
  const ARCHIVO_RUBRO = conArchivo([
    nota('Tavo Vildósola no correrá la BAJA 1000', { ...VOZ('tavo'), zonas: ['Mexicali'], publicado: HACE_UN_DIA, rubros: ['deportes'] }),
    nota('Se termina la racha de Soles en casa', { ...VOZ('soles'), zonas: ['Mexicali'], publicado: '2026-09-01T10:00:00+00:00', rubros: ['deportes'] }),
    nota('Cabildo de Mexicali aprueba presupuesto', { ...VOZ('cabildo'), zonas: ['Mexicali'], publicado: HACE_UN_DIA, rubros: ['politica'] }),
    nota('Xolos gana en casa ante el Atlas', { zonas: ['Tijuana'], publicado: HACE_UN_DIA, rubros: ['deportes'] }),
    nota('Torneo de pesca en la bahía', { fuente: 'notiens', zonas: ['Mexicali'], publicado: HACE_UN_DIA, rubros: ['deportes'] }),
    nota('Nota de un corte sin el campo', { zonas: ['Mexicali'], publicado: HACE_UN_DIA }),
  ]);
  const googleMxl = async () => new Response(feed(item('Águilas de Mexicali gana la serie de la Liga MX', NUEVO)));
  const mxl = await (await responderActualidad({ a: null, z: 'mexicali', t: 'deportes' }, googleMxl, AHORA,
    ARCHIVO_RUBRO, async () => CAT_RUBRO)).json();
  assert.deepEqual(mxl.resultados.map((r) => r.titulo),
    ['Águilas de Mexicali gana la serie de la Liga MX', 'Tavo Vildósola no correrá la BAJA 1000'],
    'por turnos, Google primero; fuera lo viejo, otro rubro, otro lugar, un medio apagado y un corte sin rubros');
  const delArchivoMxl = mxl.resultados[1];
  assert.equal(delArchivoMxl.origen, 'archivo', 'la tarjeta no la rotula «en tendencia»');
  assert.equal(delArchivoMxl.medio, 'La Voz de la Frontera');
  assert.equal(delArchivoMxl.referencia.url, 'https://oem.com.mx/lavozdelafrontera/deportes/tavo', 'Analizar abre la nota del medio');
  assert.ok(!('tono' in delArchivoMxl) && !('postura' in delArchivoMxl), 'sin tono, como cualquier fila');
  // Scrapy fecha por la URL y deja medianoche sin zona: viaja solo el dia.
  const afn = await (await responderActualidad({ a: null, z: 'tijuana', t: 'seguridad' }, async () => new Response(feed()), AHORA,
    conArchivo([nota('Lesionan a balazos a un hombre en Jardín Dorado', { fuente: 'afn', dominio: 'afntijuana.info', url: 'https://afntijuana.info/seguridad/1_x',
      fecha: '2026-09-11', publicado: '2026-09-11T00:00:00', rubros: ['seguridad'] })]), async () => CAT_RUBRO)).json();
  assert.equal(afn.resultados[0].publicado, '2026-09-11', 'sin hora conocida no se inventa medianoche');
  // La region es cualquier zona del producto; Mexico no lee el archivo.
  const regionRubro = await (await responderActualidad({ a: 'region', z: null, t: 'deportes' }, async () => new Response(feed()), AHORA,
    ARCHIVO_RUBRO, async () => CAT_RUBRO)).json();
  assert.deepEqual(regionRubro.resultados.map((r) => r.titulo).sort(),
    ['Tavo Vildósola no correrá la BAJA 1000', 'Xolos gana en casa ante el Atlas']);
  const mxRubro = await (await responderActualidad({ a: 'mexico', z: null, t: 'seguridad' }, async () => new Response(feed()), AHORA,
    conArchivo([nota('Detienen a dos en Mexicali', { zonas: ['Mexicali'], publicado: HACE_UN_DIA, rubros: ['seguridad'] })]),
    async () => assert.fail('Mexico no lee el catalogo para el archivo'))).json();
  assert.deepEqual(mxRubro.resultados, []);
  // Un archivo publicado viejo no da filas viejas: da ninguna.
  const viejo = await (await responderActualidad({ a: null, z: 'mexicali', t: 'deportes' }, async () => new Response(feed()), '2026-09-20T18:00:00.000Z',
    ARCHIVO_RUBRO, async () => CAT_RUBRO)).json();
  assert.deepEqual(viejo.resultados, []);

  // --- /api/relacionadas -------------------------------------------------
  const CONSULTA = 'Detienen a Los Rusos en Mexicali por homicidio del joyero';
  const ARCHIVO_REL = [
    nota('Homicidio del joyero de Mexicali sigue sin detenidos'),
    nota('El joyero de Mexicali y el homicidio que nadie esclarece'),
    nota(CONSULTA), // la MISMA nota no es una nota relacionada
    nota('Clima templado en la frontera durante el fin de semana'),
    nota('Obras del bulevar avanzan segun el Ayuntamiento'),
    nota('Partido de la jornada en el estadio municipal'),
    nota('Turistas cruzan la garita sin demoras'),
    nota('Feria del libro abre sus puertas'),
    // Relleno: la rareza se mide contra el tamano del archivo, asi que con
    // ocho notas «homicidio» no es raro y nada pasa el umbral. Con treinta y
    // tres si, que es la escala a la que esto corre de verdad (6,020).
    ...Array.from({ length: 25 }, (_, i) =>
      nota(`Tramite municipal ordinario ${i} del expediente ${i}`)),
  ];

  const rel = await responderRelacionadas({ t: CONSULTA }, conArchivo(ARCHIVO_REL));
  assert.equal(rel.status, 200);
  const cuerpoRel = await rel.json();
  assert.ok(cuerpoRel.relacionadas.length > 0, 'tres terminos raros compartidos alcanzan');
  assert.ok(cuerpoRel.relacionadas.length <= TOPE_RELACIONADAS);
  assert.ok(!cuerpoRel.relacionadas.some((n) => n.titulo === CONSULTA),
    'la misma nota no es una nota relacionada');
  // Regla 5 de PRODUCT.md hecha tipo: el tono NO viaja, ni las figuras, ni las
  // zonas. Antes la hoja recibia el Nota entero y solo se abstenia de pintarlo.
  for (const clave of ['postura', 'figuras', 'zonas', 'alcance', 'zona_medio']) {
    assert.ok(!(clave in cuerpoRel.relacionadas[0]), `no viaja ${clave}`);
  }
  assert.deepEqual(Object.keys(cuerpoRel.relacionadas[0]).sort(),
    ['dominio', 'fecha', 'id', 'titulo', 'url']);

  // Sin coincidencias: lista vacia y 200. Es una respuesta, no un fallo.
  const vacia = await responderRelacionadas({ t: 'Algo completamente distinto y ajeno' },
    conArchivo(ARCHIVO_REL));
  assert.equal(vacia.status, 200);
  assert.deepEqual((await vacia.json()).relacionadas, []);

  // SIN ARCHIVO NO SE CONTESTA VACIO. La hoja dice «no encontramos notas
  // anteriores; la cobertura no es pareja en el corredor» ante una lista
  // vacia, y eso afirmaria un hueco que nadie midio (regla 4 al reves).
  const relSinDatos = await responderRelacionadas({ t: CONSULTA }, async () => null);
  assert.equal(relSinDatos.status, 503);
  assert.equal((await relSinDatos.json()).codigo, 'datos');

  const relSinTitulo = await responderRelacionadas({ t: '  ' }, conArchivo(ARCHIVO_REL));
  assert.equal(relSinTitulo.status, 400);
  assert.equal((await relSinTitulo.json()).codigo, 'titulo');
  // Un pegado accidental no se consulta.
  const relLargo = await responderRelacionadas({ t: 'x'.repeat(301) }, conArchivo(ARCHIVO_REL));
  assert.equal(relLargo.status, 400);

  // --- Una cosecha atrasada no dice «hace 2 h» ---------------------------
  // 25 de septiembre de 2026: TikTok del jueves se leia como de hoy el viernes.
  const { corteVigente, hace, FRESCURA_HORAS } = cargar('lib/dominio/formato');
  const CORRIDA = '2026-09-25T23:01:00+00:00';
  assert.equal(FRESCURA_HORAS, 12, 'igual que pulso/validador.py::FRESCURA_HORAS');
  assert.equal(corteVigente('2026-09-25T22:58:00+00:00', CORRIDA), true);
  assert.equal(corteVigente('2026-09-25T11:01:00+00:00', CORRIDA), true, '12 h exactas todavia sirven');
  assert.equal(corteVigente('2026-09-24T17:49:28+00:00', CORRIDA), false);
  assert.equal(corteVigente('2026-09-24T17:49:28+00:00', undefined), true, 'sin corrida, como antes');
  assert.equal(hace('2026-09-24T15:49:28+00:00', '2026-09-24T17:49:28+00:00'), '2 h', 'la cuenta de siempre, contra el corte');

  console.log('Búsqueda: parseo, fusión, URLs, /api/actualidad, secciones locales y rubros verificados offline.');
}

comprobar().catch((error) => { console.error(error); process.exitCode = 1; });
