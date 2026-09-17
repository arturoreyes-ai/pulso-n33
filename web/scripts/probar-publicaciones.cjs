// Contratos de selección y enlaces: sin peticiones a redes sociales.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const ruta = path.resolve(__dirname, '../src/lib/dominio/publicaciones.ts');
const modulo = new Module(ruta, module);
modulo.paths = module.paths;
modulo._compile(ts.transpileModule(fs.readFileSync(ruta, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText, ruta);
const { canonizarPublicacion, seleccionarPublicaciones, compararPublicaciones, reunirPublicaciones, cubetasConFilas } = modulo.exports;
const post = (id, extra = {}) => ({ url: `https://www.instagram.com/p/${id}/`, fecha: '2026-09-14', publicado: '2026-09-14T12:00:00Z', zona: 'tijuana', cuenta: 'medio', likes: 5, ...extra });
const doc = (posts, maximo = 15) => ({ destacados: posts, destacados_maximo: maximo, cuentas: [{ cuenta: 'medio', nombre: 'El medio' }] });
assert.equal(canonizarPublicacion('https://instagram.com/reel/ABC_-/??x=1', 'instagram'), 'https://www.instagram.com/p/ABC_-/');
for (const url of ['http://instagram.com/p/a/', 'https://instagram.com.evil/p/a/', 'https://x:pass@instagram.com/p/a/', 'https://instagram.com:444/p/a/', 'javascript:alert(1)', 'https://instagram.com/cuenta/', 'https://instagram.com/p/a/extra']) assert.equal(canonizarPublicacion(url, 'instagram'), null);
assert.equal(canonizarPublicacion('https://www.tiktok.com/@Medio/video/123?x=1', 'tiktok'), 'https://www.tiktok.com/@medio/video/123');
assert.equal(canonizarPublicacion('https://www.tiktok.com/@medio/video/no', 'tiktok'), null);
const datos = doc([post('a', {zona:'tecate'}), post('b'), post('c')], 1);
assert.deepEqual(seleccionarPublicaciones(datos, 'tijuana', 'instagram').map(p=>p.url), [post('b').url]);
assert.deepEqual(seleccionarPublicaciones(datos, null, 'instagram').map(p=>p.url), [post('a').url]);
assert.equal(seleccionarPublicaciones({}, null, 'instagram').length, 0);
// Cubetas de la vista de region. `nacional` e `internacional` no tienen pagina
// de zona y antes caian en la misma lista que el corredor, ordenada por likes:
// un video del mundo trae ordenes de magnitud mas likes que uno de Tecate.
const mezcla = doc([post('r', {zona:'tijuana'}), post('m', {zona:'nacional'}), post('w', {zona:'internacional'}), post('e', {zona:'estatal'})]);
assert.deepEqual(cubetasConFilas(mezcla), ['corredor', 'mexico', 'mundo']);
assert.deepEqual(seleccionarPublicaciones(mezcla, null, 'instagram').map(p=>p.url), [post('r').url, post('e').url]);
assert.deepEqual(seleccionarPublicaciones(mezcla, null, 'instagram', 'mexico').map(p=>p.url), [post('m').url]);
assert.deepEqual(seleccionarPublicaciones(mezcla, null, 'instagram', 'mundo').map(p=>p.url), [post('w').url]);
// `estatal` es corredor: es Baja California sin bajar a municipio, no residuo.
assert.deepEqual(cubetasConFilas(doc([post('e', {zona:'estatal'})])), ['corredor']);
// En una pagina de zona la cubeta no aplica: el filtro es la zona.
assert.deepEqual(seleccionarPublicaciones(mezcla, 'tijuana', 'instagram', 'mundo').map(p=>p.url), [post('r').url]);
// Una vuelta por cuenta antes del merito. El caso, del 17 de septiembre de
// 2026: de las quince tarjetas del corredor DOCE eran de Tijuana, dos de San
// Diego y una de Mexicali, en ocho cuentas; Ensenada, Tecate y el estatal
// salian en cero habiendo publicado.
const grande = [10, 9, 8].map((l, i) => post(`G${i}`, { cuenta: 'grande', likes: l }));
const chica = [2, 1].map((l, i) => post(`C${i}`, { cuenta: 'chica', likes: l }));
const dos = doc([...grande, ...chica], 3);
assert.deepEqual(seleccionarPublicaciones(dos, 'tijuana', 'instagram').map(p => p.cuenta),
  ['grande', 'grande', 'chica']);
// El que suena no se castiga: su mejor post sigue abriendo la seleccion.
assert.equal(seleccionarPublicaciones(dos, 'tijuana', 'instagram')[0].url, post('G0').url);
// Pasada la primera vuelta se compite por likes otra vez: la chica entra UNA
// vez, no tres. Una cuota sentaria sus dos de 2 y 1 like sobre los de 9 y 8.
assert.equal(seleccionarPublicaciones(dos, 'tijuana', 'instagram').filter(p => p.cuenta === 'chica').length, 1);
// TikTok NO reparte: ahi `cuenta` es el id de una busqueda, no una voz.
assert.deepEqual(seleccionarPublicaciones(dos, 'tijuana', 'tiktok').map(p => p.cuenta),
  ['grande', 'grande', 'grande']);
// No agrega filas ni recorta, y un lugar de un solo medio sale identico.
assert.equal(seleccionarPublicaciones(dos, 'tijuana', 'instagram').length,
  seleccionarPublicaciones(dos, 'tijuana', 'tiktok').length);
const unica = doc(grande, 2);
assert.deepEqual(seleccionarPublicaciones(unica, 'tijuana', 'instagram').map(p => p.url),
  seleccionarPublicaciones(unica, 'tijuana', 'tiktok').map(p => p.url));
// Elige, no ordena: lo devuelto sigue el orden del archivo, que es lo que el
// visor ordena por fecha despues y lo que los dos paneles de conteos suman.
const posiciones = seleccionarPublicaciones(dos, 'tijuana', 'instagram')
  .map((p) => dos.destacados.indexOf(p));
assert.deepEqual(posiciones, [...posiciones].sort((a, b) => a - b));
// Y no toca el documento: `datos.destacados` lo comparte SWR entre el visor,
// los conteos y la ruta de analisis en el mismo render.
const intacto = JSON.stringify(dos);
seleccionarPublicaciones(dos, 'tijuana', 'instagram');
assert.equal(JSON.stringify(dos), intacto);
// Sin `creador`, la fuente NUNCA cae al id de la busqueda: es el mecanismo.
const anonimo = doc([post('t', {url:'https://www.tiktok.com/@medio/video/9', cuenta:'tk_mexicali_noticias'})]);
assert.equal(reunirPublicaciones(undefined, anonimo, null)[0].fuente, 'un creador');
assert.ok(compararPublicaciones(post('a', { publicado: undefined }), post('b')) > 0);
assert.ok(compararPublicaciones(post('a', { fecha:'2026-09-13', likes:999 }), post('b')) > 0);
assert.ok(compararPublicaciones(post('a', {likes:10}), post('b')) < 0);
assert.ok(compararPublicaciones(post('a'), post('b')) < 0);
const ig = doc([post('a'), post('a', {url:'https://instagram.com/reel/a/?utm=test'}), post('b')]);
const tk = doc([post('t', {url:'https://www.tiktok.com/@medio/video/1', publicado:'2026-09-14T14:00:00Z', creador:'medio'})]);
assert.equal(reunirPublicaciones(ig, tk, null).length, 3);
assert.equal(reunirPublicaciones(ig, tk, null)[0].red, 'tiktok');
assert.equal(reunirPublicaciones(ig, undefined, null).length, 2);
assert.equal(reunirPublicaciones(undefined, tk, null).length, 1);
assert.equal(reunirPublicaciones(undefined, undefined, null).length, 0);
assert.equal(reunirPublicaciones(ig, tk, 'tecate').length, 0);
const antes = JSON.stringify(ig);
reunirPublicaciones(ig, tk, null);
assert.equal(JSON.stringify(ig), antes);
console.log('Publicaciones: selección, orden, enlaces, deduplicación y disponibilidad parcial verificados offline.');
