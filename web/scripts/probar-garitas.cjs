// Comprobaciones offline del contrato publico; unittest invoca este archivo.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function cargar(nombre) {
  const ruta = path.resolve(__dirname, '../src/lib/garitas', nombre + '.ts');
  const modulo = new Module(ruta, module);
  modulo.paths = module.paths;
  modulo._compile(ts.transpileModule(fs.readFileSync(ruta, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText, ruta);
  return modulo.exports;
}
const { parsearCbp, fechaObservada, responderGaritas } = cargar('cbp');
const { duracion, vigente, resumen } = cargar('formato');
const ahora = '2026-09-08T23:30:00.000Z';
const carril = (valor = '0', estado = 'no delay') => `<standard_lanes><operational_status>${estado}</operational_status><update_time>At 4:00 pm PDT</update_time><delay_minutes>${valor}</delay_minutes><lanes_open>2</lanes_open></standard_lanes>`;
const puerto = (id, contenido, estado = 'Open') => `<port><port_number>${id}</port_number><date>9/8/2026</date><port_status>${estado}</port_status><passenger_vehicle_lanes>${contenido}</passenger_vehicle_lanes></port>`;
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
  assert.match(resumen(datos.cruces, Date.parse(ahora)), /0 minutos/);
  assert.equal(resumen(datos.cruces, Date.parse(ahora) + 120 * 60000), '');
  const bien = await responderGaritas(async (url, opciones) => {
    assert.equal(url, 'https://bwt.cbp.gov/xml/bwt.xml'); assert.equal(opciones.redirect, 'error'); assert.ok(opciones.signal);
    return new Response(xml);
  }, ahora);
  assert.equal(bien.status, 200); assert.match(bien.headers.get('cache-control'), /s-maxage=300/);
  for (const solicitar of [async () => new Response('error', { status: 503 }), async () => new Response('<html/>'), async () => { throw new DOMException('timeout', 'TimeoutError'); }, async () => new Response('x'.repeat(2 * 1024 * 1024 + 1))]) {
    const fallo = await responderGaritas(solicitar, ahora); assert.equal(fallo.status, 502); assert.equal(fallo.headers.get('cache-control'), 'no-store');
  }
  console.log('Garitas: contrato, fechas, frescura y API verificados offline.');
}
comprobar().catch(error => { console.error(error); process.exitCode = 1; });
