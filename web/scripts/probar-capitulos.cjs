// Comprobaciones offline del recorrido /ahora: los capitulos se encadenan en
// orden, no se reordenan y no repiten titulares. unittest invoca este archivo
// (tests/test_capitulos_web.py) y CI tambien.
//
// El mismo cargador que probar-busqueda.cjs. lib/busqueda/capitulos importa
// use-actualidad SOLO como tipo, que transpileModule borra, asi que aqui no
// entra ni React ni SWR.
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

const {
  CAPITULOS_TOTAL, EN_VUELO_MAXIMO, UMBRAL_ACTIVACION,
  capitulosDe, debeActivar, fraseFinal, hilar,
} = cargar('lib/busqueda/capitulos');
const { RUBROS } = cargar('lib/busqueda/rubros');
const { ZONAS_RUTA } = cargar('lib/dominio/zonas');
const { TOPE_ACTUALIDAD } = cargar('lib/busqueda/tipos');
const { indiceDeImagenes, imagenPara } = cargar('lib/busqueda/imagenes');

const fila = (titulo, publicado = null, idioma = 'es') =>
  ({ titulo, url: 'https://news.google.com/rss/articles/' + encodeURIComponent(titulo), dominio: 'x.example', medio: 'X', publicado, idioma });
const listo = (resultados, extra = {}) => ({ estado: 'listo', resultados, caidos: [], truncada: false, ...extra });
const INACTIVO = { estado: 'inactivo' };
const CARGANDO = { estado: 'cargando' };
const FALLO = { estado: 'fallo' };
const lote = (prefijo, n) => Array.from({ length: n }, (_, i) => fila(`${prefijo} ${i + 1}`));

// Lo que la interfaz nunca dice: el mecanismo. Se prueba sobre cada cadena
// que llega a una tarjeta.
const MECANISMO = /google|rss|feed|api|pipeline|corpus|redirector/i;

function comprobar() {
  // --- capitulosDe -------------------------------------------------------
  const region = capitulosDe('region');
  assert.equal(region.length, CAPITULOS_TOTAL);
  assert.equal(CAPITULOS_TOTAL, 8);
  assert.deepEqual(region.map((c) => c.id), ['local', ...RUBROS, 'mexico', 'internacional']);
  assert.deepEqual(region[0].pedido, { ambito: 'region', rubro: null });
  assert.deepEqual(region[2].pedido, { ambito: 'region', rubro: 'seguridad' });
  assert.deepEqual(region[6].pedido, { ambito: 'mexico', rubro: null });
  assert.deepEqual(region[7].pedido, { ambito: 'internacional', rubro: null });
  assert.equal(region[0].rotulo, 'Tijuana y San Diego · ahora');
  assert.equal(region[2].rotulo, 'Seguridad · últimos dos días');
  assert.equal(region[2].titulo, 'Seguridad en el corredor');
  assert.equal(region[6].rotulo, 'México · ahora');
  assert.equal(region[7].rotulo, 'Internacional · ahora');
  assert.equal(region[6].id, 'mexico');
  assert.equal(region[7].id, 'internacional');

  const tijuana = capitulosDe('Tijuana');
  assert.deepEqual(tijuana[0].pedido, { zona: 'Tijuana', rubro: null });
  assert.deepEqual(tijuana[1].pedido, { zona: 'Tijuana', rubro: 'clima' });
  assert.equal(tijuana[0].rotulo, 'Tijuana · ahora');
  assert.equal(tijuana[1].titulo, 'Clima sobre Tijuana');
  // Mexico e Internacional no dependen del lugar elegido.
  assert.deepEqual(tijuana[6].pedido, region[6].pedido);
  assert.deepEqual(tijuana[7].pedido, region[7].pedido);
  // Mexico e Internacional como ENTRADA: la edicion, sus rubros sin terminos
  // de lugar, la otra edicion y el corredor al final.
  const mexico = capitulosDe('mexico');
  assert.deepEqual(mexico.map((c) => c.id), ['mexico', ...RUBROS, 'internacional', 'local']);
  assert.deepEqual(mexico[0].pedido, { ambito: 'mexico', rubro: null });
  assert.deepEqual(mexico[2].pedido, { ambito: 'mexico', rubro: 'seguridad' });
  assert.deepEqual(mexico[6].pedido, { ambito: 'internacional', rubro: null });
  assert.deepEqual(mexico[7].pedido, { ambito: 'region', rubro: null });
  assert.equal(mexico[0].rotulo, 'México · ahora');
  assert.equal(mexico[2].titulo, 'Seguridad en México');
  assert.equal(mexico[7].rotulo, 'Tijuana y San Diego · ahora');
  const mundo = capitulosDe('internacional');
  assert.deepEqual(mundo.map((c) => c.id), ['internacional', ...RUBROS, 'mexico', 'local']);
  assert.deepEqual(mundo[1].pedido, { ambito: 'internacional', rubro: 'clima' });
  assert.equal(mundo[1].titulo, 'Clima en el mundo');
  assert.deepEqual(mundo[7].pedido, { ambito: 'region', rubro: null });

  for (const e of ['region', ...ZONAS_RUTA, 'mexico', 'internacional']) {
    const cs = capitulosDe(e);
    assert.equal(cs.length, 8, e);
    assert.equal(new Set(cs.map((c) => c.id)).size, 8, `${e}: ids sin repetir`);
    for (const c of cs) {
      assert.ok(c.acento.startsWith('text-'), `${e}/${c.id}: acento es una clase de texto`);
      for (const texto of [c.nombre, c.rotulo, c.titulo]) assert.doesNotMatch(texto, MECANISMO, `${e}/${c.id}: «${texto}»`);
    }
  }

  // --- hilar: orden y corte ---------------------------------------------
  // Se para en el primer capitulo no asentado, aunque uno posterior ya llego.
  let h = hilar(region, [listo(lote('A', 3)), CARGANDO, listo(lote('C', 2)), INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO]);
  assert.equal(h.tarjetas.length, 3, 'el capitulo 2 espera al 1');
  assert.equal(h.enVuelo, 1);
  assert.equal(h.completo, false);
  assert.ok(h.tarjetas.every((t) => t.tipo === 'titular'), 'el primer capitulo no lleva divisor');

  // Divisor antes del segundo capitulo con titulares, con su cuenta.
  h = hilar(region, [listo(lote('A', 3)), listo(lote('B', 2)), INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO]);
  assert.deepEqual(h.tarjetas.map((t) => t.tipo), ['titular', 'titular', 'titular', 'divisor', 'titular', 'titular']);
  assert.equal(h.tarjetas[3].capitulo, 'clima');
  assert.equal(h.tarjetas[3].n, 2);
  assert.equal(h.tarjetas[3].nota, null);
  assert.deepEqual(h.tarjetas.filter((t) => t.tipo === 'titular').map((t) => t.orden), [1, 2, 3, 4, 5]);
  assert.equal(h.titulares, 5);

  // El orden de Google se conserva: fechas fuera de orden, posiciones intactas.
  const desordenado = [fila('Viejo', '2026-09-01T10:00:00Z'), fila('Nuevo', '2026-09-10T10:00:00Z'), fila('Medio', '2026-09-05T10:00:00Z')];
  h = hilar(region, [listo(desordenado), INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO]);
  assert.deepEqual(h.tarjetas.map((t) => t.r.titulo), ['Viejo', 'Nuevo', 'Medio']);

  // --- hilar: repetidos y vacios ------------------------------------------
  // Entre capitulos, por titular plegado: acentos y mayusculas no separan.
  h = hilar(region, [listo([fila('Garita de San Ysidro cierra')]), listo([fila('GARITA DE SAN YSIDRO CIERRA'), fila('Otra')]), INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO]);
  assert.deepEqual(h.tarjetas.map((t) => t.tipo === 'titular' ? t.r.titulo : t.tipo), ['Garita de San Ysidro cierra', 'divisor', 'Otra']);
  assert.equal(h.tarjetas[1].n, 1, 'la cuenta del divisor es tras quitar repetidos');
  // Dentro del mismo capitulo tambien, y el titulo vacio se descarta.
  h = hilar(region, [listo([fila('Uno'), fila('uno'), fila('   '), fila('Dos')]), INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO]);
  assert.deepEqual(h.tarjetas.map((t) => t.r.titulo), ['Uno', 'Dos']);
  // Un capitulo que queda en cero no deja divisor y se anota en vacios.
  h = hilar(region, [listo([fila('Uno')]), listo([fila('UNO')]), listo([fila('Dos')]), INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO]);
  assert.deepEqual(h.tarjetas.map((t) => t.tipo), ['titular', 'divisor', 'titular']);
  assert.equal(h.tarjetas[1].capitulo, 'seguridad');
  assert.deepEqual(h.vacios, ['clima']);

  // --- hilar: fallos -----------------------------------------------------
  h = hilar(region, [FALLO, listo(lote('B', 2)), INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO]);
  assert.deepEqual(h.tarjetas.map((t) => t.tipo), ['hueco', 'titular', 'titular'], 'el hueco se dice y el recorrido sigue');
  assert.deepEqual(h.faltantes, ['local']);
  assert.equal(h.tarjetas[0].capitulo, 'local');

  // --- hilar: nota del divisor y completo --------------------------------
  const todos = [listo(lote('A', 1)), listo(lote('B', TOPE_ACTUALIDAD), { caidos: ['en'], truncada: true }), listo([]), listo(lote('D', 1)), FALLO, listo(lote('F', 1)), listo(lote('G', 1)), listo(lote('H', 1))];
  h = hilar(region, todos);
  assert.equal(h.completo, true);
  assert.equal(h.enVuelo, 0);
  const divisor = h.tarjetas.find((t) => t.tipo === 'divisor' && t.capitulo === 'clima');
  assert.equal(divisor.nota, `Faltan los titulares en inglés. Se muestran los primeros ${TOPE_ACTUALIDAD}.`);
  assert.deepEqual(h.vacios, ['seguridad']);
  assert.deepEqual(h.faltantes, ['politica']);
  assert.equal(h.titulares, 1 + TOPE_ACTUALIDAD + 1 + 1 + 1 + 1);
  h = hilar(region, [...todos.slice(0, 7), CARGANDO]);
  assert.equal(h.completo, false, 'completo solo con los ocho asentados');

  // --- fraseFinal ----------------------------------------------------------
  const frase = fraseFinal(region, hilar(region, todos));
  assert.equal(frase, `${1 + TOPE_ACTUALIDAD + 4} titulares en este recorrido. No se pudo traer: Política. Sin titulares nuevos en: Seguridad.`);
  assert.doesNotMatch(frase, MECANISMO);
  assert.equal(fraseFinal(region, hilar(region, [listo(lote('A', 1)), ...Array(7).fill(listo([]))])), 'Un titular en este recorrido. Sin titulares nuevos en: Clima, Seguridad, Deportes, Política, Economía, México, Internacional.');

  // --- debeActivar ---------------------------------------------------------
  assert.equal(UMBRAL_ACTIVACION, 3);
  assert.equal(EN_VUELO_MAXIMO, 2);
  const soloCargando = hilar(region, [CARGANDO, ...Array(7).fill(INACTIVO)]);
  assert.equal(debeActivar(soloCargando, 0, 1), true, 'al montar se adelanta el segundo capitulo');
  const dosEnVuelo = hilar(region, [CARGANDO, CARGANDO, ...Array(6).fill(INACTIVO)]);
  assert.equal(debeActivar(dosEnVuelo, 0, 2), false, 'nunca mas de dos por delante');
  // El adelantado llego primero: sigue sin mostrarse, asi que no libera lugar.
  const adelantado = hilar(region, [CARGANDO, listo(lote('B', 5)), ...Array(6).fill(INACTIVO)]);
  assert.equal(adelantado.emitidos, 0);
  assert.equal(adelantado.tarjetas.length, 0);
  assert.equal(debeActivar(adelantado, 0, 2), false, 'un capitulo adelantado no cuenta como recorrido');
  const ambos = hilar(region, [listo(lote('A', 2)), listo(lote('B', 5)), ...Array(6).fill(INACTIVO)]);
  assert.equal(ambos.emitidos, 2);
  assert.equal(debeActivar(ambos, 0, 2), false, 'al principio de ocho tarjetas no se pide');
  assert.equal(debeActivar(ambos, 4, 2), true, 'a tres del final si');
  const quince = hilar(region, [listo(lote('A', TOPE_ACTUALIDAD)), ...Array(7).fill(INACTIVO)]);
  assert.equal(debeActivar(quince, 0, 1), false, 'al principio de quince no se pide');
  assert.equal(debeActivar(quince, TOPE_ACTUALIDAD - 1 - UMBRAL_ACTIVACION, 1), true, 'a tres del final si');
  assert.equal(debeActivar(quince, TOPE_ACTUALIDAD - 2 - UMBRAL_ACTIVACION, 1), false);
  const vacio = hilar(region, [listo([]), ...Array(7).fill(INACTIVO)]);
  assert.equal(debeActivar(vacio, 0, 1), true, 'un capitulo vacio no detiene la cadena');
  const completo = hilar(region, todos);
  assert.equal(debeActivar(completo, completo.tarjetas.length - 1, 8), false, 'con los ocho pedidos no hay mas');

  // --- imagenes: del corpus, por titular plegado, nunca de otra nota --------
  const nota = (titulo, imagen) => ({ id: 'x', titulo, url: 'https://medio.example/n', dominio: 'medio.example', fuente: 'medio', zona_medio: 'Tijuana', zonas: [], alcance: 'zona', fecha: null, publicado: null, capturado: '2026-09-14T00:00:00Z', figuras: [], postura: null, ...(imagen ? { imagen } : {}) });
  const indice = indiceDeImagenes([
    nota('Garita de San Ysidro cierra', 'https://medio.example/a.jpg'),
    nota('GARITA DE SAN YSIDRO CIERRA', 'https://medio.example/b.jpg'),
    nota('Sin imagen'),
    nota('   ', 'https://medio.example/vacio.jpg'),
  ]);
  assert.equal(indice.size, 1, 'una por titular plegado; el titulo vacio no entra');
  assert.equal(imagenPara(fila('garita de san ysidro cierra'), indice), 'https://medio.example/a.jpg', 'gana la primera del archivo');
  assert.equal(imagenPara(fila('Sin imagen'), indice), null, 'una nota sin imagen no toma la de otra');
  assert.equal(imagenPara(fila('Otro titular'), indice), null);

  console.log(`Capítulos: ${CAPITULOS_TOTAL} capítulos, orden, repetidos, fallos, activación e imágenes verificados offline.`);
}

comprobar();
