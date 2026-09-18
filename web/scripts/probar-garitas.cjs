// Comprobaciones offline del contrato publico; unittest invoca este archivo.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function cargar(nombre) {
  const ruta = path.resolve(__dirname, '../src/lib', nombre + '.ts');
  const modulo = new Module(ruta, module);
  modulo.paths = module.paths;
  modulo._compile(ts.transpileModule(fs.readFileSync(ruta, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText, ruta);
  return modulo.exports;
}
const { parsearCbp, fechaObservada, responderGaritas } = cargar('garitas/cbp');
const { duracion, vigente, guion, horaHablada, duracionHablada, duracionFicha } = cargar('garitas/formato');
const { esRutaPublica } = cargar('acceso/rutas-publicas');
const ahora = '2026-09-08T23:30:00.000Z';
const carril = (valor = '0', estado = 'no delay', hora = 'At 4:00 pm PDT') => `<standard_lanes><operational_status>${estado}</operational_status><update_time>${hora}</update_time><delay_minutes>${valor}</delay_minutes><lanes_open>2</lanes_open></standard_lanes>`;
const puerto = (id, contenido, estado = 'Open', pie = '') => `<port><port_number>${id}</port_number><date>9/8/2026</date><port_status>${estado}</port_status><passenger_vehicle_lanes>${contenido}</passenger_vehicle_lanes>${pie ? `<pedestrian_lanes>${pie}</pedestrian_lanes>` : ''}</port>`;
const envolver = contenido => `<border_wait_time>${contenido}</border_wait_time>`;
const xml = envolver(puerto('250401', carril()) + puerto('250601', carril('100', 'delay')));
async function comprobar() {
  for (const [minutos, esperado] of [[0, '0 min'], [59, '59 min'], [60, '1 h 00 min'], [61, '1 h 01 min'], [130, '2 h 10 min']]) assert.equal(duracion(minutos), esperado);
  assert.equal(duracion(61, true), '1 hora y 1 minuto');
  const datos = parsearCbp(xml, ahora);
  const fila = datos.cruces[0].carriles[0];
  assert.equal(fila.minutos, 0);
  assert.equal(fila.abiertos, 2);
  assert.equal(fila.observado, '2026-09-08T23:00:00.000Z');
  for (const vacio of ['', 'N/A', '-1', '1.5']) assert.equal(parsearCbp(envolver(puerto('250401', carril(vacio))), ahora).cruces[0].carriles[0].minutos, null);
  assert.equal(parsearCbp(envolver(puerto('250401', carril('5'))), ahora).cruces[0].carriles[0].minutos, 5);
  const cerrado = parsearCbp(envolver(puerto('250401', carril('50'), 'Closed')), ahora).cruces[0].carriles[0];
  assert.equal(cerrado.estado, 'cerrado'); assert.equal(cerrado.minutos, null);
  const parcial = parsearCbp(envolver(puerto('250401', carril('', 'Update Pending'))), ahora);
  assert.equal(parcial.cruces[0].carriles[0].estado, 'pendiente');
  assert.equal(parcial.cruces[1].carriles[0].estado, 'no_disponible');
  for (const roto of ['<html>fallo</html>', '<border_wait_time><port></border_wait_time>', '<!DOCTYPE x><x/>', envolver(puerto('250609', carril())), envolver(puerto('250401', carril()) + puerto('250401', carril()))]) assert.throws(() => parsearCbp(roto, ahora));
  assert.equal(fechaObservada('9/8/2026', 'At Noon PDT'), '2026-09-08T19:00:00.000Z');
  assert.equal(fechaObservada('1/8/2026', 'At Midnight PST'), '2026-01-08T08:00:00.000Z');
  assert.equal(fechaObservada('2/30/2026', 'At 1:00 pm PST'), null);
  assert.equal(fechaObservada('9/8/2026', 'At 16:00 pm PDT'), null);
  assert.equal(vigente(fila, Date.parse(fila.observado) + 90 * 60000), true);
  assert.equal(vigente(fila, Date.parse(fila.observado) + 90 * 60000 + 1), false);
  assert.equal(vigente(fila, Date.parse(fila.observado) - 1), false);
  // El guion. Redondeo: la hora en punto tolera 10 minutos y la media solo 5,
  // porque «casi dos horas» por 1h50 se dice y «poco mas de dos y media» por
  // 2h40 no; fuera de eso, la cifra exacta.
  for (const [minutos, hablado, ficha] of [
    [25, '25 minutos', '25 min'], [35, 'poco más de media hora', '~30 min'],
    [55, 'casi una hora', '~1 h'], [110, 'casi dos horas', '~2 h'],
    [160, '2 horas y 40 minutos', '2 h 40 min'], [175, 'casi tres horas', '~3 h'],
    [145, 'casi dos horas y media', '~2 h 30 min'], [180, 'tres horas', '3 h 00 min'],
  ]) { assert.equal(duracionHablada(minutos), hablado); assert.equal(duracionFicha(minutos), ficha); }
  assert.equal(horaHablada('2026-09-08T19:00:00.000Z'), '12:00 de la tarde');
  assert.equal(horaHablada('2026-09-09T05:00:00.000Z'), '10:00 de la noche');
  const leido = guion(datos.cruces, Date.parse(ahora));
  assert.equal(leido.atribucion, 'Fuente oficial');
  assert.equal(leido.cierre, '');
  assert.equal(leido.cues[0].modos[0].linea, 'San Ysidro: 0 minutos en carril general.');
  assert.equal(leido.cues[1].modos[0].linea, 'Otay Mesa: 1 hora y 40 minutos en carril general.');
  // La ficha muestra los tres carriles de coche: los que no reportan tambien.
  assert.deepEqual(leido.cues[0].modos[0].renglones.map(r => [r.nombre, r.figura, r.hayCifra, r.alDia]),
    [['General', '0 min', true, true], ['Ready Lane', 'sin dato', false, false], ['SENTRI', 'sin dato', false, false]]);
  // Peatones: San Ysidro tiene dos accesos y PedWest se rotula aparte; Otay
  // uno solo, y ahi el Ready Lane peatonal no entra porque repite al general.
  const ready = (valor, hora) => carril(valor, 'delay', hora).replace(/standard_lanes/g, 'ready_lanes');
  const aPie = parsearCbp(envolver(
    puerto('250401', carril(), 'Open', carril('30', 'delay') + ready('10')) +
    puerto('250407', carril(), 'Open', carril('20', 'delay') + ready('20')) +
    puerto('250601', carril('100', 'delay'), 'Open', carril('15', 'delay') + ready('15'))), ahora);
  const caminando = guion(aPie.cruces, Date.parse(ahora));
  assert.deepEqual(caminando.cues[0].modos[1].renglones.map(r => r.nombre),
    ['General', 'Ready Lane', 'PedWest · General', 'PedWest · Ready Lane']);
  // Los cuatro se dicen, y el Ready Lane de PedWest lleva su acceso o se
  // confundiria con el de la garita principal, que es otra fila.
  assert.equal(caminando.cues[0].modos[1].linea,
    'San Ysidro a pie: media hora por la garita principal; 10 minutos en Ready Lane; 20 minutos por PedWest y en Ready Lane de PedWest.');
  assert.deepEqual(caminando.cues[1].modos[1].renglones.map(r => r.nombre), ['General']);
  assert.equal(caminando.cues[1].modos[1].linea, 'Otay Mesa a pie: 15 minutos.');
  const vacio = guion(datos.cruces, Date.parse(ahora) + 120 * 60000);
  assert.equal(vacio.cierre, '');
  // Aunque el reporte tenga mas de 90 minutos, el tiempo sigue visible y
  // listo para leer. El estado de frescura vive aparte en la pagina.
  assert.equal(vacio.cues[0].modos[0].linea, 'San Ysidro: 0 minutos en carril general.');
  assert.equal(vacio.cues[0].modos[0].sinLinea, '');
  assert.ok(vacio.cues.every((c) => c.modos.every((m) => m.linea !== '' || m.sinLinea !== '')),
    'ningun modo se queda sin linea y sin explicacion');
  // Pasada la ventana de 90 minutos la cifra NO desaparece: sigue siendo un
  // dato real. La etiqueta superior conserva la actualizacion mas reciente.
  assert.equal(vacio.hayCifras, true, 'el bloque se sigue dibujando');
  assert.deepEqual(vacio.cues[0].modos[0].renglones.map(r => [r.figura, r.hayCifra, r.alDia]),
    [['0 min', true, false], ['sin dato', false, false], ['sin dato', false, false]]);
  // La hora se muestra una sola vez en la cabecera, no en cada linea.
  const dispar = guion(parsearCbp(envolver(puerto('250401', carril()) + puerto('250601', carril('100', 'delay', 'At 3:30 pm PDT'))), ahora).cruces, Date.parse(ahora));
  assert.equal(dispar.atribucion, 'Fuente oficial');
  assert.equal(dispar.cues[0].modos[0].linea, 'San Ysidro: 0 minutos en carril general.');
  assert.equal(dispar.cues[1].modos[0].linea, 'Otay Mesa: 1 hora y 40 minutos en carril general.');
  // Horas distintas dentro de un modo tampoco cambian el apuntador.
  const revuelto = guion(parsearCbp(envolver(puerto('250401', carril() + carril('40', 'delay', 'At 3:30 pm PDT').replace(/standard_lanes/g, 'ready_lanes'))), ahora).cruces, Date.parse(ahora));
  assert.equal(revuelto.cues[0].modos[0].linea,
    'San Ysidro: 0 minutos en carril general; 40 minutos en Ready Lane.');
  // Misma espera se dice junta, una sola vez.
  const gemelos = guion(parsearCbp(envolver(puerto('250401', carril('115', 'delay') + carril('115', 'delay').replace(/standard_lanes/g, 'ready_lanes') + carril('30', 'delay').replace(/standard_lanes/g, 'NEXUS_SENTRI_lanes'))), ahora).cruces, Date.parse(ahora));
  assert.equal(gemelos.cues[0].modos[0].linea,
    'San Ysidro: casi dos horas en carril general y en Ready Lane; media hora por SENTRI.');
  assert.equal(revuelto.cues[0].modos[0].sinLinea, '');
  // Una cifra fuera de ventana al lado de una fresca: ambas se leen y la hora
  // de cada reporte queda en el detalle, no en la locucion.
  const rezagado = guion(parsearCbp(envolver(puerto('250401', carril('40', 'delay') + carril('55', 'delay', 'At 2:00 pm PDT').replace(/standard_lanes/g, 'ready_lanes'))), ahora).cruces, Date.parse(ahora));
  assert.equal(rezagado.atribucion, 'Fuente oficial');
  assert.equal(rezagado.cierre, '');
  assert.equal(rezagado.cues[0].modos[0].linea,
    'San Ysidro: 40 minutos en carril general; casi una hora en Ready Lane.');
  assert.deepEqual(rezagado.cues[0].modos[0].renglones.map(r => [r.figura, r.alDia]),
    [['40 min', true], ['~1 h', false], ['sin dato', false]]);
  const bien = await responderGaritas(async (url, opciones) => {
    assert.equal(url, 'https://bwt.cbp.gov/xml/bwt.xml'); assert.equal(opciones.redirect, 'error'); assert.ok(opciones.signal);
    return new Response(xml);
  }, ahora);
  assert.equal(bien.status, 200); assert.match(bien.headers.get('cache-control'), /s-maxage=300/);
  assert.equal(bien.headers.get('access-control-allow-origin'), '*');
  assert.equal(bien.headers.get('access-control-allow-methods'), 'GET, HEAD, OPTIONS');
  for (const solicitar of [async () => new Response('error', { status: 503 }), async () => new Response('<html/>'), async () => { throw new DOMException('timeout', 'TimeoutError'); }, async () => new Response('x'.repeat(2 * 1024 * 1024 + 1))]) {
    const fallo = await responderGaritas(solicitar, ahora); assert.equal(fallo.status, 502); assert.equal(fallo.headers.get('cache-control'), 'no-store'); assert.equal(fallo.headers.get('access-control-allow-origin'), '*');
  }
  // La excepcion de acceso es exacta: no abre rutas hermanas por accidente.
  assert.equal(esRutaPublica('/api/garitas'), true);
  for (const ruta of ['/api/garitas/', '/api/garitas/admin', '/api/buscar', '/data/notas.json']) {
    assert.equal(esRutaPublica(ruta), false);
  }
  console.log('Garitas: contrato, fechas, frescura, guion y API pública verificados offline.');
}
comprobar().catch(error => { console.error(error); process.exitCode = 1; });
