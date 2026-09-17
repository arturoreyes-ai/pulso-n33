// Comprobaciones offline de /api/analizar: la lectura automatica de una nota.
// unittest invoca este archivo (tests/test_analisis_web.py) y CI tambien.
//
// Lo que esto existe para probar, en una linea: que el cuerpo de la nota NO
// sale en la respuesta. El resto del repo mantiene esa promesa no leyendo
// nunca el cuerpo; aqui se lee a proposito, por decision del cliente del 15 de
// septiembre de 2026, y lo unico que la sostiene es que no se guarda y no se
// devuelve. Eso es una prueba, no una intencion.
//
// El mismo cargador que probar-busqueda.cjs. Nunca toca la red ni gasta una
// llamada de pago: `solicitar` se inyecta.
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

const { urlSegura } = cargar('lib/analisis/url');
const { extraerTexto, TOPE_TEXTO } = cargar('lib/analisis/extraer');
const { responderAnalisis, CACHE_ANALISIS } = cargar('lib/analisis/analizar');
const { VERSION_ANALISIS } = cargar('lib/analisis/contrato');
const { SIN_CACHE } = cargar('lib/busqueda/respuesta');
const { entradaDe, rutaDeEntrada, ENTRADAS, PARAM_EDICION } = cargar('lib/busqueda/entrada');
const { indiceDeEnlaces, enlaceDelMedio, esEnlaceOpaco } = cargar('lib/busqueda/enlaces');

// Una frase larga, para superar el minimo de 40 caracteres por parrafo y el de
// 400 del cuerpo entero sin escribir una nota de verdad.
const FRASE = 'La garita de San Ysidro registro filas de mas de tres horas durante el fin de semana largo. ';
const NOTA_HTML = `<html><head><title>t</title><style>.x{color:red}</style></head><body>
  <nav><a href="/">Inicio</a></nav>
  <p>Compartir</p>
  <p>${FRASE.repeat(3)}</p>
  <p>${FRASE.repeat(3)}</p>
  <script>console.log('no')</script>
  <footer><p>Derechos reservados de un medio cualquiera para el pie de pagina.</p></footer>
</body></html>`;

const SECRETO = 'filas de mas de tres horas';

const nunca = async () => { assert.fail('no debio tocar la red'); };

function respuestaFalsa(cuerpo, ok = true) {
  return { ok, status: ok ? 200 : 500, text: async () => cuerpo, json: async () => JSON.parse(cuerpo) };
}

/** El `solicitar` inyectado: primero el medio, despues el modelo. */
function conductor({ medio = NOTA_HTML, medioOk = true, modelo, modeloOk = true }) {
  const vistas = [];
  const peticiones = [];
  const fn = async (url, opciones) => {
    vistas.push(String(url));
    peticiones.push({ url: String(url), opciones });
    if (String(url).includes('api.anthropic.com')) {
      assert.equal(opciones.method, 'POST', 'al modelo se le habla por POST');
      return respuestaFalsa(modelo, modeloOk);
    }
    return respuestaFalsa(medio, medioOk);
  };
  fn.vistas = vistas;
  fn.peticiones = peticiones;
  return fn;
}

const SALIDA_BUENA = JSON.stringify({
  content: [{
    type: 'text',
    text: JSON.stringify({
      lectura: 'La nota reporta esperas largas en el cruce durante un fin de semana.',
      puntos: ['Se reportan filas prolongadas', 'Ocurrió en un fin de semana largo', 'La nota ubica el hecho en San Ysidro'],
      salvedad: 'No establece una tendencia ni compara con otros meses.',
      sugerenciaSocial: {
        formato: 'Gráfico informativo',
        enfoque: 'Ordenar los tiempos y el lugar del cruce en una sola pieza.',
        gancho: 'Lo esencial sobre las esperas reportadas en San Ysidro.',
      },
    }),
  }],
});

async function comprobar() {
  // --- urlSegura: el filtro de SSRF ---------------------------------------
  assert.ok(urlSegura('https://zeta.example.com/nota') !== null);
  for (const mala of [
    null, '', 'no-es-una-url', 'http://zeta.example.com/nota',
    'https://localhost/x', 'https://127.0.0.1/x', 'https://10.0.0.5/x',
    'https://192.168.1.1/x', 'https://169.254.169.254/latest/meta-data/',
    'https://172.16.0.1/x', 'https://172.31.255.255/x',
    'https://algo.internal/x', 'https://caja.local/x', 'https://sinpunto/x',
    'https://usuario:clave@zeta.example.com/x',
  ]) {
    assert.equal(urlSegura(mala), null, `debio rechazar: ${mala}`);
  }
  // 172.15 y 172.32 quedan FUERA del rango privado: no se rechazan de mas.
  assert.ok(urlSegura('https://172.15.0.1/x') !== null);
  assert.ok(urlSegura('https://172.32.0.1/x') !== null);

  // --- extraerTexto -------------------------------------------------------
  const texto = extraerTexto(NOTA_HTML);
  assert.ok(texto.includes(SECRETO), 'saca los parrafos de la nota');
  assert.doesNotMatch(texto, /console\.log/, 'tira los <script>');
  assert.doesNotMatch(texto, /color:red/, 'tira los <style>');
  assert.doesNotMatch(texto, /Compartir/, 'tira los parrafos cortos de plantilla');
  assert.doesNotMatch(texto, /Derechos reservados/, 'tira el pie de pagina');
  assert.ok(extraerTexto('<p>' + 'a'.repeat(50000) + '</p>').length <= TOPE_TEXTO, 'corta al tope');

  // --- el interruptor apagado no llama a nadie ----------------------------
  delete process.env.ANALISIS_HABILITADO;
  process.env.ANTHROPIC_API_KEY = 'prueba';
  let r = await responderAnalisis({ u: 'https://zeta.example.com/n', m: 'Zeta' }, nunca);
  assert.equal(r.status, 400);
  assert.equal((await r.json()).codigo, 'apagado');
  assert.equal(r.headers.get('cache-control'), SIN_CACHE);

  // Encendido pero sin clave: tampoco se pinta ni se llama.
  process.env.ANALISIS_HABILITADO = 'true';
  process.env.ANTHROPIC_API_KEY = '';
  r = await responderAnalisis({ u: 'https://zeta.example.com/n', m: 'Zeta' }, nunca);
  assert.equal((await r.json()).codigo, 'apagado');

  process.env.ANTHROPIC_API_KEY = 'prueba';

  // --- una URL que no se puede leer no toca la red ------------------------
  for (const mala of [null, 'https://169.254.169.254/latest/meta-data/', 'http://zeta.example.com/n']) {
    const mal = await responderAnalisis({ u: mala, m: 'Zeta' }, nunca);
    assert.equal(mal.status, 400);
    assert.equal((await mal.json()).codigo, 'url');
    assert.equal(mal.headers.get('cache-control'), SIN_CACHE);
  }

  // --- el camino bueno ----------------------------------------------------
  const ok = conductor({ modelo: SALIDA_BUENA });
  r = await responderAnalisis({ u: 'https://zeta.example.com/n', m: 'Zeta' }, ok);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), CACHE_ANALISIS);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-robots-tag'), 'noindex');
  const cuerpo = await r.json();
  assert.match(cuerpo.lectura, /esperas largas/);
  assert.equal(cuerpo.puntos.length, 3);
  assert.equal(cuerpo.sugerenciaSocial.formato, 'Gráfico informativo');
  assert.match(cuerpo.sugerenciaSocial.enfoque, /tiempos/);
  assert.match(cuerpo.sugerenciaSocial.gancho, /San Ysidro/);
  assert.equal(cuerpo.medio, 'Zeta');
  assert.equal(ok.vistas.length, 2, 'una al medio y una al modelo');

  const llamadaModelo = ok.peticiones.find((p) => p.url.includes('api.anthropic.com'));
  assert.ok(llamadaModelo, 'se hizo la llamada al modelo');
  const pedidoModelo = JSON.parse(llamadaModelo.opciones.body);
  assert.equal(pedidoModelo.model, 'claude-haiku-4-5-20251001');
  assert.match(pedidoModelo.system, /Entre 3 y 5 puntos/);
  assert.match(pedidoModelo.system, /UN solo formato/);
  assert.match(pedidoModelo.system, /sin escribir el post terminado/);
  assert.match(pedidoModelo.system, /lenguaje sensacionalista/);
  assert.match(pedidoModelo.system, /No inventes citas, imágenes, video, reacciones del público/);

  // LO IMPORTANTE: el cuerpo de la nota no vuelve al lector.
  const serializado = JSON.stringify(cuerpo);
  assert.doesNotMatch(serializado, new RegExp(SECRETO), 'la respuesta no trae el texto de la nota');
  assert.ok(!serializado.includes(FRASE.trim()), 'ni una frase del original');
  assert.doesNotMatch(JSON.stringify(cuerpo.sugerenciaSocial), new RegExp(SECRETO), 'la sugerencia tampoco trae el cuerpo');

  // --- el medio caido es un estado, nunca un 502 --------------------------
  r = await responderAnalisis({ u: 'https://zeta.example.com/n', m: 'Zeta' }, conductor({ medioOk: false, modelo: SALIDA_BUENA }));
  assert.equal(r.status, 200, 'nunca un 502');
  assert.equal((await r.json()).codigo, 'medio');
  assert.equal(r.headers.get('cache-control'), SIN_CACHE, 'un fallo no se cachea');

  // --- una pagina sin nota (muro de pago, consentimiento) -----------------
  r = await responderAnalisis({ u: 'https://zeta.example.com/n', m: 'Zeta' }, conductor({ medio: '<html><body><p>Suscribete para seguir leyendo esta nota completa.</p></body></html>', modelo: SALIDA_BUENA }));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).codigo, 'corta');

  // --- el modelo caido, y el modelo devolviendo basura --------------------
  r = await responderAnalisis({ u: 'https://zeta.example.com/n', m: 'Zeta' }, conductor({ modelo: '{}', modeloOk: false }));
  assert.equal((await r.json()).codigo, 'modelo');
  r = await responderAnalisis({ u: 'https://zeta.example.com/n', m: 'Zeta' }, conductor({ modelo: JSON.stringify({ content: [{ type: 'text', text: 'lo siento, no puedo' }] }) }));
  assert.equal((await r.json()).codigo, 'modelo');

  // El resumen viejo, sin la recomendacion completa, ya no cumple el contrato.
  r = await responderAnalisis({ u: 'https://zeta.example.com/n', m: 'Zeta' }, conductor({
    modelo: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({
      lectura: 'Trata de la garita.',
      puntos: ['Uno', 'Dos', 'Tres'],
      salvedad: 'No compara periodos.',
      sugerenciaSocial: { formato: 'Carrusel', enfoque: '', gancho: 'Tres datos.' },
    }) }] }),
  }));
  assert.equal((await r.json()).codigo, 'modelo');

  // El modelo envolviendo el JSON en una valla si se acepta.
  r = await responderAnalisis({ u: 'https://zeta.example.com/n', m: 'Zeta' }, conductor({
    modelo: JSON.stringify({ content: [{ type: 'text', text: '```json\n{"lectura":"Trata de la garita.","puntos":["Uno","Dos","Tres"],"salvedad":"No compara periodos.","sugerenciaSocial":{"formato":"Carrusel","enfoque":"Tres claves del reporte.","gancho":"Qué cambió en la garita."}}\n```' }] }),
  }));
  assert.equal((await r.json()).lectura, 'Trata de la garita.');

  // La version viaja en la URL del cliente para no recibir del CDN el
  // contrato anterior durante el primer dia del despliegue.
  assert.equal(VERSION_ANALISIS, '2');
  const componente = fs.readFileSync(path.join(SRC, 'components/ahora/analisis-titular.tsx'), 'utf8');
  assert.match(componente, /new URLSearchParams\(\{ v: VERSION_ANALISIS, u: url, m: medio \}\)/);
  const apertura = componente.match(/function abrir\(\) \{([\s\S]*?)\n  \}\n\n  async function analizar/)?.[1];
  assert.ok(apertura, 'el cliente separa abrir de confirmar el análisis');
  assert.match(apertura, /fase: "confirmar"/);
  assert.doesNotMatch(apertura, /fetch\(/, 'abrir el diálogo no debe iniciar la llamada de pago');
  assert.match(componente, /async function analizar\(\)[\s\S]*?fetch\(`/);

  // --- el enlace del propio medio ------------------------------------------
  // El caso real: la url de una fila en vivo es un token del buscador que no
  // redirige por HTTP, asi que pedirla trae la pagina del buscador y no la
  // nota. El enlace bueno sale del corpus, por titular plegado.
  const TOKEN = 'https://news.google.com/rss/articles/CBMiabc?oc=5';
  assert.ok(esEnlaceOpaco(TOKEN));
  assert.ok(!esEnlaceOpaco('https://zetatijuana.com/nota'));
  const corpus = [
    { titulo: 'Cabildo de Tijuana rechaza la iniciativa', url: 'https://zetatijuana.com/cabildo', imagen: null },
    { titulo: 'Solo en el buscador', url: TOKEN, imagen: null },
    { titulo: 'Cabildo de Tijuana rechaza la iniciativa', url: 'https://otro.example/tarde', imagen: null },
  ];
  const indice = indiceDeEnlaces(corpus);
  assert.equal(indice.size, 1, 'la nota que solo trae token no entra al indice');
  // Gana la primera del archivo, como en imagenes.ts: indice determinista.
  assert.equal(indice.get('cabildo de tijuana rechaza la iniciativa'), 'https://zetatijuana.com/cabildo');
  // Una fila cuyo titular empata recupera el enlace del medio.
  assert.equal(enlaceDelMedio({ titulo: 'CABILDO DE TIJUANA RECHAZA LA INICIATIVA', url: TOKEN }, indice), 'https://zetatijuana.com/cabildo');
  // Sin empate no hay enlace, y NUNCA se toma el de otra nota.
  assert.equal(enlaceDelMedio({ titulo: 'Un titular que no esta', url: TOKEN }, indice), null);
  assert.equal(enlaceDelMedio({ titulo: 'Solo en el buscador', url: TOKEN }, indice), null);
  // Una fila que ya trae enlace del medio se queda con el suyo.
  assert.equal(enlaceDelMedio({ titulo: 'Cualquiera', url: 'https://elsol.example/n' }, indice), 'https://elsol.example/n');

  // --- la entrada del recorrido: ruta y faceta ----------------------------
  assert.equal(entradaDe(null, null), 'region');
  assert.equal(entradaDe(null, 'mexico'), 'mexico');
  assert.equal(entradaDe(null, 'internacional'), 'internacional');
  assert.equal(entradaDe(null, 'inventado'), 'region', 'un valor raro cae en la region');
  assert.equal(entradaDe('Tijuana', null), 'Tijuana');
  assert.equal(entradaDe('Tijuana', 'mexico'), 'Tijuana', 'la zona manda sobre la faceta');
  assert.equal(rutaDeEntrada('region'), '/');
  assert.equal(rutaDeEntrada('mexico'), `/?${PARAM_EDICION}=mexico`);
  assert.equal(rutaDeEntrada('Tijuana'), '/tijuana');
  assert.equal(ENTRADAS.length, 11, 'el corredor, ocho zonas y dos ediciones');
  // Ida y vuelta: toda entrada se recupera de su propia ruta. Es lo que hace
  // que la eleccion sea compartible y sobreviva a una recarga.
  for (const e of ENTRADAS) {
    const u = new URL(rutaDeEntrada(e), 'https://pulso.example');
    // En `/` no hay zona y la entrada sale de la faceta; con segmento, el
    // segmento ES la zona y la faceta no pinta nada.
    const zona = u.pathname === '/' ? null : e;
    assert.equal(entradaDe(zona, u.searchParams.get(PARAM_EDICION)), e, `ida y vuelta de ${e}`);
  }
}

comprobar()
  .then(() => console.log('Análisis: ficha para cabina y redes, privacidad, URL, interruptor, fallos y enlace del medio verificados offline.'))
  .catch((err) => { console.error(err); process.exitCode = 1; });
