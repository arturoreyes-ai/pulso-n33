// Contratos de filtros, rangos y comparaciones financieras. Todo offline.
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
  modulo.require = (id) => id.startsWith('@/') ? cargar(id.slice(2)) : id.startsWith('.')
    ? cargar(path.relative(SRC, path.resolve(path.dirname(ruta), id))) : original(id);
  modulo._compile(ts.transpileModule(fs.readFileSync(ruta, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText, ruta);
  return modulo.exports;
}
const { filtrarAnunciosMeta, sumarRangosMeta, gruposComparablesMeta, filtrarPerfilesMeta } = cargar('lib/dominio/pauta-meta');
const filtros = { texto: '', estado: 'todos', desde: '2024-01-01', hasta: '', plataforma: 'todas', formato: 'todos', region: 'Baja California', orden: 'recientes' };
const a = { id: '1', texto: 'Educación', pagador: 'Prueba', desde: '2023-12-01', hasta: '2024-01-01', estado: 'inactivo', plataformas: ['Instagram'], formato: 'video', regiones: ['Baja California'], moneda: 'MXN', gasto: { minimo: 100, maximo: 499 }, grupo: null };
const b = { ...a, id: '2', desde: '2026-09-01', hasta: null, estado: 'activo', moneda: 'USD', gasto: { minimo: 10, maximo: null } };
assert.equal(filtrarAnunciosMeta([a], filtros).length, 1, 'incluye entrega en el limite, aunque comenzara antes');
assert.equal(filtrarAnunciosMeta([{ ...a, hasta: '2023-12-31' }], filtros).length, 0);
assert.equal(filtrarAnunciosMeta([{ ...a, regiones: [] }], filtros).length, 0, 'region desconocida no es BC');
assert.equal(filtrarAnunciosMeta([a], { ...filtros, texto: 'educacion' }).length, 1);
assert.equal(filtrarAnunciosMeta([a], { ...filtros, plataforma: 'Facebook' }).length, 0);
assert.deepEqual(filtrarAnunciosMeta([a, b], filtros).map(x => x.id), ['2', '1']);
assert.deepEqual(filtrarAnunciosMeta([a, b], { ...filtros, orden: 'antiguos' }).map(x => x.id), ['1', '2']);
assert.equal(filtrarAnunciosMeta([a, b], { ...filtros, estado: 'activo' }).length, 1);
const sumas = sumarRangosMeta([a, b, { ...a, grupo: 5 }, { ...a, moneda: null }]);
assert.deepEqual(sumas, [{ moneda: 'MXN', rango: { minimo: 100, maximo: 499 }, anuncios: 1 }, { moneda: 'USD', rango: { minimo: 10, maximo: null }, anuncios: 1 }]);
const total = { desde: '2026-09-01', hasta: '2026-09-07', geografia: 'MX', moneda: 'MXN', importe: 100 };
const p = { id: 'p1', nombre: 'Prueba Uno', cargo: 'Cargo', partido: 'Partido', ambito: 'Tijuana', totales: [total] };
assert.equal(gruposComparablesMeta([p, { ...p, id: 'p2' }]).length, 1);
for (const cambio of [{ moneda: 'USD' }, { moneda: null }, { geografia: 'Baja California' }, { hasta: '2026-09-08' }]) {
  assert.equal(gruposComparablesMeta([p, { ...p, id: 'p2', totales: [{ ...total, ...cambio }] }]).length, 0);
}
assert.equal(filtrarPerfilesMeta([p], 'UNO', '', 'Tijuana').length, 1);
assert.equal(filtrarPerfilesMeta([p], '', '', 'Mexicali').length, 0);
console.log('Publicidad Meta: filtros, limites, monedas, grupos y comparaciones correctos.');
