// Contratos de selección y enlaces: sin peticiones a redes sociales.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const ruta = path.resolve(__dirname, '../src/lib/dominio/publicaciones.ts');
const modulo = new Module(ruta, module);
modulo.paths = module.paths;
// publicaciones.ts importa `./zonas` (NOMBRE_TODA_REGION), que tambien es TypeScript
// y solo trae imports de tipo: se transpila igual en vez de pedirselo a node.
const requerir = modulo.require.bind(modulo);
modulo.require = (id) => {
  if (!id.startsWith('./')) return requerir(id);
  const hijo = path.resolve(path.dirname(ruta), id + '.ts');
  const m = new Module(hijo, modulo);
  m.paths = module.paths;
  m._compile(ts.transpileModule(fs.readFileSync(hijo, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText, hijo);
  return m.exports;
};
modulo._compile(ts.transpileModule(fs.readFileSync(ruta, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText, ruta);
const { canonizarPublicacion, seleccionarPublicaciones, compararPublicaciones, reunirPublicaciones, ordenarPublicaciones, cubetasConFilas, cubetasDisponibles, rotuloRegion, CUBETAS, NOMBRE_CUBETA, NOMBRE_RED } = modulo.exports;
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
assert.equal(reunirPublicaciones({ instagram: undefined, tiktok: anonimo, youtube: undefined }, null)[0].fuente, 'un creador');
assert.ok(compararPublicaciones(post('a', { publicado: undefined }), post('b')) > 0);
assert.ok(compararPublicaciones(post('a', { fecha:'2026-09-13', likes:999 }), post('b')) > 0);
assert.ok(compararPublicaciones(post('a', {likes:10}), post('b')) < 0);
assert.ok(compararPublicaciones(post('a'), post('b')) < 0);
const ig = doc([post('a'), post('a', {url:'https://instagram.com/reel/a/?utm=test'}), post('b')]);
const tk = doc([post('t', {url:'https://www.tiktok.com/@medio/video/1', publicado:'2026-09-14T14:00:00Z', creador:'medio'})]);
assert.equal(reunirPublicaciones({ instagram: ig, tiktok: tk, youtube: undefined }, null).length, 3);
assert.equal(reunirPublicaciones({ instagram: ig, tiktok: tk, youtube: undefined }, null)[0].red, 'tiktok');
assert.equal(reunirPublicaciones({ instagram: ig, tiktok: undefined, youtube: undefined }, null).length, 2);
assert.equal(reunirPublicaciones({ instagram: undefined, tiktok: tk, youtube: undefined }, null).length, 1);
assert.equal(reunirPublicaciones({ instagram: undefined, tiktok: undefined, youtube: undefined }, null).length, 0);
assert.equal(reunirPublicaciones({ instagram: ig, tiktok: tk, youtube: undefined }, 'tecate').length, 0);
const antes = JSON.stringify(ig);
reunirPublicaciones({ instagram: ig, tiktok: tk, youtube: undefined }, null);
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
assert.equal(reunirPublicaciones({ instagram: ig, tiktok: tk, youtube: ytDoc }, null).length, 4);
assert.equal(reunirPublicaciones({ instagram: ig, tiktok: tk, youtube: ytDoc }, null)[0].red, 'youtube');
assert.equal(reunirPublicaciones({ instagram: undefined, tiktok: undefined, youtube: ytDoc }, null).length, 1);
// La fuente de YouTube es el canal, nunca un creador: el publicador ES la cuenta.
assert.equal(reunirPublicaciones({ instagram: undefined, tiktok: undefined, youtube: ytDoc }, null)[0].fuente, 'Un canal');
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
assert.deepEqual(CUBETAS.map((c) => c.nombre), ['Región', 'México', 'Internacional']);
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

// --- Mundo en Instagram (22 de septiembre de 2026) ------------------------
// Una cuenta con `ambito` zonifica por el pie y puede llegar a `internacional`,
// con su alcance. Antes Mundo solo existia en TikTok y el comentario de
// cubetasConFilas lo decia; ahora basta Instagram para ofrecer la pastilla.
const igMundo = doc([post('bbc', { zona: 'internacional', alcance: 'extranjero', cuenta: 'bbcmundo_ig' }),
                     post('tj', { zona: 'tijuana' })]);
assert.deepEqual(cubetasDisponibles({ instagram: igMundo, tiktok: undefined, youtube: undefined }), ['corredor', 'mundo']);
assert.deepEqual(seleccionarPublicaciones(igMundo, null, 'instagram', 'mundo').map((p) => p.url),
  [post('bbc').url]);
// `extranjero` y `nacional` caen los dos en Mundo: la cubeta junta lo verificado
// con la edicion del mundo, y la tarjeta es la que los distingue.
const mundoMixto = doc([post('v', { zona: 'internacional', alcance: 'extranjero' }),
                        post('e', { zona: 'internacional', alcance: 'nacional' })]);
assert.equal(seleccionarPublicaciones(mundoMixto, null, 'tiktok', 'mundo').length, 2);

// --- El rotulo de la vista de region --------------------------------------
// Uno solo para la barra del lector y para «De qué se habla». La hoja lo
// copiaba de antes del arreglo de la barra y seguia diciendo «Toda la región»
// bajo Mundo.
assert.equal(rotuloRegion('corredor'), 'Toda la región');
assert.equal(rotuloRegion('mexico'), 'México');
assert.equal(rotuloRegion('mundo'), 'Internacional');

// --- Populares o recientes (23 de septiembre de 2026) ---------------------
// El cliente pidio lo mas popular primero, con «Recientes» a un toque. El
// orden se aplica DESPUES de elegir: seleccionar sigue en el orden del archivo
// y reunirPublicaciones sigue devolviendo lo nuevo primero.
const fila = (red, id, extra = {}) => {
  const url = red === 'tiktok' ? `https://www.tiktok.com/@medio/video/${id}`
    : red === 'youtube' ? `https://www.youtube.com/watch?v=${id}` : `https://www.instagram.com/p/${id}/`;
  return { red, clave: `${red}:${url}`, url, fuente: 'x',
    post: { url, fecha: '2026-09-14', publicado: '2026-09-14T12:00:00Z', zona: 'tijuana', cuenta: 'medio', likes: 5, ...extra } };
};
// Recientes es exactamente el orden de antes.
const reunidas = reunirPublicaciones({ instagram: ig, tiktok: tk, youtube: ytDoc }, null);
assert.deepEqual(ordenarPublicaciones(reunidas, 'recientes').map((f) => f.clave), reunidas.map((f) => f.clave),
  'recientes = compararPublicaciones, lo que la pantalla leia');
// En una sola red, populares es su orden de merito: likes en TikTok e Instagram.
const soloTk = [fila('tiktok', '1', { likes: 10, publicado: '2026-09-14T20:00:00Z' }),
                fila('tiktok', '2', { likes: 900 }), fila('tiktok', '3', { likes: 50 })];
assert.deepEqual(ordenarPublicaciones(soloTk, 'populares').map((f) => f.post.likes), [900, 50, 10]);
assert.deepEqual(ordenarPublicaciones(soloTk, 'recientes')[0].post.likes, 10, 'el mas nuevo primero');
// YouTube por vistas: su feed no publica likes.
const soloYt = [fila('youtube', 'aaaaaaaaaaa', { likes: undefined, reproducciones: 5 }),
                fila('youtube', 'bbbbbbbbbbb', { likes: undefined, reproducciones: 5000 })];
assert.equal(ordenarPublicaciones(soloYt, 'populares')[0].post.reproducciones, 5000);
// En «Todas» NO se comparan cifras entre redes: se intercalan por puesto. Con
// el numero crudo, los dos de TikTok (miles de likes) irian antes que todo.
const todas = [fila('instagram', 'i1', { likes: 30 }), fila('instagram', 'i2', { likes: 20 }),
               fila('tiktok', '1', { likes: 90000 }), fila('tiktok', '2', { likes: 80000 }),
               fila('youtube', 'yyyyyyyyyyy', { likes: undefined, reproducciones: 400 })];
assert.deepEqual(ordenarPublicaciones(todas, 'populares').map((f) => f.red),
  ['tiktok', 'instagram', 'youtube', 'tiktok', 'instagram'], 'el primero de cada red, luego el segundo');
// El segundo de TikTok (80,000) va DETRAS del primero de Instagram (30): el
// puesto manda, no la cifra. El empate entre redes lo decide ORDEN_RED, que
// desde el 24 de septiembre de 2026 pone TikTok primero, como las pestanas.
assert.deepEqual(ordenarPublicaciones(todas, 'populares').slice(0, 4).map((f) => f.post.likes), [90000, 30, undefined, 80000]);
// Ordena una copia: `filas` sale de un useMemo que otros leen.
const antesOrden = JSON.stringify(todas);
ordenarPublicaciones(todas, 'populares');
ordenarPublicaciones(todas, 'recientes');
assert.equal(JSON.stringify(todas), antesOrden);
// Y reunirPublicaciones no cambio: lo nuevo primero.
assert.equal(reunirPublicaciones({ instagram: ig, tiktok: tk, youtube: ytDoc }, null)[0].red, 'youtube');

console.log('Publicaciones: selección, orden (populares y recientes), enlaces, deduplicación, disponibilidad parcial y nombres de cubeta verificados (cuatro plataformas) offline.');

// Facebook en el panel de medios (23 de septiembre de 2026): la cuarta red se
// reune con las otras, su fuente es la pagina del catalogo, reparte una vuelta
// por pagina como Instagram, y un permalink de pagina sin usuario se conserva.
const fbDoc = { destacados: [
  post('f1', { url: 'https://www.facebook.com/NdTijuana/posts/pfbid0aaa', cuenta: 'ndtijuana_fb', likes: 900 }),
  post('f2', { url: 'https://www.facebook.com/NdTijuana/posts/pfbid0bbb', cuenta: 'ndtijuana_fb', likes: 800 }),
  post('f3', { url: 'https://www.facebook.com/permalink.php?story_fbid=pfbid0ccc&id=100086488503408', cuenta: 'blancorojo_fb', likes: 2 }),
], destacados_maximo: 2, cuentas: [{ cuenta: 'ndtijuana_fb', nombre: 'Noticias de Tijuana' }, { cuenta: 'blancorojo_fb', nombre: 'Blanco y Rojo' }] };
const conFb = reunirPublicaciones({ facebook: fbDoc }, 'tijuana');
assert.equal(conFb.length, 2, 'dos de tope');
assert.deepEqual(conFb.map((p) => p.fuente).sort(), ['Blanco y Rojo', 'Noticias de Tijuana'],
  'Facebook reparte una vuelta por pagina antes del merito');
assert.ok(conFb.every((p) => p.red === 'facebook' && p.url !== null));
assert.equal(reunirPublicaciones({ instagram: ig, tiktok: tk, youtube: ytDoc, facebook: fbDoc }, null).length, 6);
assert.equal(canonizarPublicacion('https://www.facebook.com/reel/1576537187486560/', 'facebook'), 'https://www.facebook.com/reel/1576537187486560');
assert.deepEqual(cubetasDisponibles({ facebook: fbDoc }), ['corredor']);
assert.equal(NOMBRE_RED.facebook, 'Facebook');
