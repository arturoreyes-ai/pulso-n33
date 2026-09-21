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
const { canonizarPublicacion, seleccionarPublicaciones, compararPublicaciones, reunirPublicaciones, cubetasConFilas, CUBETAS, NOMBRE_CUBETA, NOMBRE_RED } = modulo.exports;
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
assert.equal(reunirPublicaciones(undefined, anonimo, undefined, null)[0].fuente, 'un creador');
assert.ok(compararPublicaciones(post('a', { publicado: undefined }), post('b')) > 0);
assert.ok(compararPublicaciones(post('a', { fecha:'2026-09-13', likes:999 }), post('b')) > 0);
assert.ok(compararPublicaciones(post('a', {likes:10}), post('b')) < 0);
assert.ok(compararPublicaciones(post('a'), post('b')) < 0);
const ig = doc([post('a'), post('a', {url:'https://instagram.com/reel/a/?utm=test'}), post('b')]);
const tk = doc([post('t', {url:'https://www.tiktok.com/@medio/video/1', publicado:'2026-09-14T14:00:00Z', creador:'medio'})]);
assert.equal(reunirPublicaciones(ig, tk, undefined, null).length, 3);
assert.equal(reunirPublicaciones(ig, tk, undefined, null)[0].red, 'tiktok');
assert.equal(reunirPublicaciones(ig, undefined, undefined, null).length, 2);
assert.equal(reunirPublicaciones(undefined, tk, undefined, null).length, 1);
assert.equal(reunirPublicaciones(undefined, undefined, undefined, null).length, 0);
assert.equal(reunirPublicaciones(ig, tk, undefined, 'tecate').length, 0);
const antes = JSON.stringify(ig);
reunirPublicaciones(ig, tk, undefined, null);
assert.equal(JSON.stringify(ig), antes);

// --- YouTube: dos formatos, tres formas de URL y el reparto por canal ---
// Las tres formas son el MISMO video y se canonizan a una sola, para que el
// visor no monte dos veces la misma pieza.
const ytCanon = 'https://www.youtube.com/watch?v=9QuOPcqgpFw';
for (const url of ['https://www.youtube.com/shorts/9QuOPcqgpFw',
                   'https://m.youtube.com/shorts/9QuOPcqgpFw/',
                   'https://www.youtube.com/watch?v=9QuOPcqgpFw&t=5',
                   'https://youtu.be/9QuOPcqgpFw']) {
  assert.equal(canonizarPublicacion(url, 'youtube'), ytCanon, url);
}
for (const url of ['http://www.youtube.com/watch?v=abcdefghijk', 'https://youtube.com.evil/shorts/abcdefghijk',
                   'https://www.youtube.com/playlist?list=abcdefghijk', 'https://www.youtube.com/watch?v=x',
                   'https://www.youtube.com/@canal']) {
  assert.equal(canonizarPublicacion(url, 'youtube'), null, url);
}
// Una URL de YouTube NO puede colarse por la rama de otra red, ni al reves.
assert.equal(canonizarPublicacion(ytCanon, 'tiktok'), null);
assert.equal(canonizarPublicacion('https://www.tiktok.com/@medio/video/1', 'youtube'), null);

// YouTube ordena por vistas: su feed publico no trae likes ni comentarios, y
// rellenarlos con cero seria «nadie», no «no lo medimos».
const yt = (id, extra = {}) => ({ url: `https://www.youtube.com/watch?v=${id}`, fecha: '2026-09-14',
  publicado: '2026-09-14T12:00:00Z', zona: 'tijuana', cuenta: 'canal', formato: 'short',
  reproducciones: 100, valoraciones: 1, ...extra });
const docYt = (posts, maximo = 15) => ({ destacados: posts, destacados_maximo: maximo,
  cosecha_comentarios: false, cuentas: [{ cuenta: 'canal', nombre: 'Un canal' },
                                        { cuenta: 'otro', nombre: 'Otro canal' }] });
// Dos cuentas distintas, las dos en su primera vuelta, asi que el desempate es
// el merito: con likes gana la primera y con vistas la segunda. Es lo que
// distingue el orden de YouTube del de las otras dos.
const porVistas = docYt([yt('aaaaaaaaaaa', { likes: 999, reproducciones: 10 }),
                         yt('bbbbbbbbbbb', { cuenta: 'otro', likes: 0, reproducciones: 900 })], 1);
assert.deepEqual(seleccionarPublicaciones(porVistas, 'tijuana', 'youtube').map(p => p.url),
  [yt('bbbbbbbbbbb').url], 'el corte de YouTube se decide por reproducciones');
assert.deepEqual(seleccionarPublicaciones(porVistas, 'tijuana', 'instagram').map(p => p.url),
  [yt('aaaaaaaaaaa').url], 'el de Instagram sigue decidiendose por likes');

// Y REPARTE por canal, como Instagram: TikTok es la excepcion porque alli
// `cuenta` es el id de una busqueda. Medido el 18 de septiembre de 2026: los
// quince primeros por vistas salieron de cinco canales de los ocho que
// publicaron, con uno solo llevandose seis lugares.
const dosCanales = docYt([yt('g0000000000', { reproducciones: 900 }), yt('g1111111111', { reproducciones: 800 }),
                          yt('c0000000000', { cuenta: 'otro', reproducciones: 10 })], 2);
assert.deepEqual(seleccionarPublicaciones(dosCanales, 'tijuana', 'youtube').map(p => p.cuenta).sort(),
  ['canal', 'otro'], 'YouTube reparte una vuelta por canal');
assert.deepEqual(seleccionarPublicaciones(dosCanales, 'tijuana', 'tiktok').map(p => p.cuenta),
  ['canal', 'canal'], 'TikTok sigue sin repartir');

// Las tres plataformas se reunen, y una ausente no tumba a las otras.
const ytDoc = docYt([yt('yyyyyyyyyyy', { publicado: '2026-09-14T15:00:00Z' })]);
assert.equal(reunirPublicaciones(ig, tk, ytDoc, null).length, 4);
assert.equal(reunirPublicaciones(ig, tk, ytDoc, null)[0].red, 'youtube');
assert.equal(reunirPublicaciones(undefined, undefined, ytDoc, null).length, 1);
// La fuente de YouTube es el canal, nunca un creador: el publicador ES la cuenta.
assert.equal(reunirPublicaciones(undefined, undefined, ytDoc, null)[0].fuente, 'Un canal');
// Y las cubetas lo ven: sin preguntarle, Mexico saldria sin las filas nacionales.
assert.deepEqual(cubetasConFilas(docYt([yt('n0000000000', { zona: 'nacional' })])), ['mexico']);

// --- Los nombres de las cubetas --------------------------------------------
// La barra del lector los lee para decir que se esta viendo (lector-redes.tsx).
// Antes salian solo de CUBETAS y la barra no los miraba: elegir Mexico dejaba
// «Toda la región» escrito y el cambio parecia no haber ocurrido. Ahora el
// rotulo depende de esta tabla, asi que una cubeta sin nombre llega a pantalla.
for (const c of ['corredor', 'mexico', 'mundo']) {
  assert.equal(typeof NOMBRE_CUBETA[c], 'string', `${c}: tiene nombre`);
  assert.ok(NOMBRE_CUBETA[c].length > 0, `${c}: el nombre no va vacio`);
}
assert.equal(Object.keys(NOMBRE_CUBETA).length, 3, 'ni una cubeta de mas');
// CUBETAS deriva de la tabla: un solo sitio para los nombres, y el orden en que
// se ofrecen es el de la lista.
assert.deepEqual(CUBETAS.map((c) => c.id), ['corredor', 'mexico', 'mundo']);
assert.deepEqual(CUBETAS.map((c) => c.nombre), ['Corredor', 'México', 'Mundo']);
for (const c of CUBETAS) assert.equal(c.nombre, NOMBRE_CUBETA[c.id], `${c.id}: un solo nombre`);
// Y toda cubeta que cubetasConFilas puede devolver es nombrable.
assert.deepEqual(cubetasConFilas(mezcla).filter((c) => NOMBRE_CUBETA[c] === undefined), []);

// --- Facebook: solo publicaciones de pagina, canonizadas como en pulso/facebook.py ---
// Aparece solo en las consultas por termino (lib/dominio/consultas.ts), pero
// la canonizacion vive aqui con las otras tres.
assert.equal(canonizarPublicacion('https://m.facebook.com/vivelabaja/posts/pfbid0abc?__cft__[0]=x', 'facebook'),
  'https://www.facebook.com/vivelabaja/posts/pfbid0abc');
assert.equal(canonizarPublicacion('https://www.facebook.com/permalink.php?story_fbid=1&id=2', 'facebook'),
  'https://www.facebook.com/permalink.php?story_fbid=1&id=2');
for (const url of ['https://www.facebook.com/groups/g/posts/1', 'https://www.facebook.com/profile.php?id=1',
                   'https://www.facebook.com/vivelabaja/', 'http://www.facebook.com/vivelabaja/posts/1']) {
  assert.equal(canonizarPublicacion(url, 'facebook'), null, url);
}
assert.equal(canonizarPublicacion('https://www.facebook.com/vivelabaja/posts/1', 'instagram'), null);
assert.equal(Object.keys(NOMBRE_RED).length, 4, 'cuatro redes con nombre');

console.log('Publicaciones: selección, orden, enlaces, deduplicación, disponibilidad parcial y nombres de cubeta verificados (cuatro plataformas) offline.');
