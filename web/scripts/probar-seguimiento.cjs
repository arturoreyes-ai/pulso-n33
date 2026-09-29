// Comprobaciones offline del seguimiento de publicaciones (/seguimiento,
// lib/seguimiento/). CI las corre junto a las de la busqueda en vivo.
//
// Nunca toca la red, ni Apify, ni la base de datos, ni el modelo: `solicitar`,
// el almacen y el servicio de tono se inyectan. Lo que esto existe para
// sostener, en el orden en que costaria no sostenerlo:
//
//  1. La identidad de quien comenta no llega a lo que se guarda, y las
//     menciones salen enmascaradas.
//  2. Los topes: con el dia o el mes llenos no sale ni una peticion a Apify.
//  3. Solo UNA peticion guarda una lectura, aunque pregunten dos.
//  4. El conjunto crudo se borra de Apify en cuanto se guardo.
//  5. Una figura del roster en el titulo no pide tono (regla 5), y el ingles
//     tampoco: el modelo solo habla espanol.
//  6. Sin la compuerta no se paga nada; la purga sin CRON_SECRET no abre.
//  7. «Sin dato» es null, nunca cero (los likes ocultos de Instagram).
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

let HAY_BD = true;
sustitutos.set('@/lib/acceso/bd', {
  sql: () => { throw new Error('la prueba no tiene base de datos'); },
  urlBaseDeDatos: () => (HAY_BD ? 'postgres://prueba' : undefined),
  hayBaseDeDatos: () => HAY_BD,
});
sustitutos.set('@/lib/datos/publicado', { leerDatoPublicado: async () => null });

const C = cargar('lib/seguimiento/cosecha');
const R = cargar('lib/seguimiento/responder');
const { conNombres } = cargar('lib/seguimiento/almacen');
const { LLAVES_DE_SESION, ACTORES, revisarEntrada } = cargar('lib/redes-en-vivo/apify');
const F = cargar('lib/seguimiento/formato');

const AHORA = new Date('2026-09-28T18:00:00Z');
const ENTORNO = { SEGUIMIENTO_HABILITADO: 'true', APIFY_API_TOKEN: 'token-de-prueba', CRON_SECRET: 'cron-de-prueba' };
const ROSTER = {
  verificado: '2026-09-01', nota: '',
  figuras: [
    { id: 'mpao', nombre: 'Marina del Pilar Ávila Olmeda', cargo: '', partido: '', ambito: '', desde: '2021-11-01', hasta: null, alias: ['Marina del Pilar', 'Ávila Olmeda'], alias_cargo: ['gobernadora de Baja California'] },
  ],
};

const URL_TK = 'https://www.tiktok.com/@noticias_tj/video/7555000000000000001';
const URL_IG = 'https://www.instagram.com/p/DAbc123xyz/';

// Lo que devuelve cada actor, con la identidad que NO debe llegar a ningun lado.
const IDENTIDAD = ['fulano_de_tal', 'Persona Cinco', 'https://p16.tiktokcdn/avatar.jpg', '777000111', 'ownerUsername', 'uniqueId', 'profilePicture', 'maria_p'];
const VIDEO_TK = {
  webVideoUrl: URL_TK, text: 'Choque en el bulevar Agua Caliente\nmas detalles #tijuana #viral', createTime: 1790000000,
  authorMeta: { name: 'noticias_tj', avatar: 'https://p16.tiktokcdn/avatar.jpg' },
  diggCount: 1200, commentCount: 88, playCount: 40000, shareCount: 31, collectCount: 12,
};
const COMENTARIOS_TK = [
  { videoWebUrl: URL_TK, text: 'Qué bueno que no hubo heridos', diggCount: 5, createTimeISO: '2026-09-28T16:00:00.000Z', uniqueId: 'fulano_de_tal', avatarThumbnail: 'https://p16.tiktokcdn/avatar.jpg', cid: '777000111' },
  { videoWebUrl: URL_TK, text: '@maria_p mira esto, qué caro está todo', diggCount: 2, createTimeISO: '2026-09-28T17:00:00.000Z', uniqueId: 'otra' },
  { videoWebUrl: URL_TK, text: '😮😮😮', diggCount: 9, createTimeISO: '2026-09-28T17:10:00.000Z' },
  { videoWebUrl: URL_TK, text: 'Qué bueno que no hubo heridos', diggCount: 11, createTimeISO: '2026-09-28T17:20:00.000Z', uniqueId: 'repetido' },
  { videoWebUrl: 'https://www.tiktok.com/@otra/video/1', text: 'de otro video', diggCount: 1 },
];

function respuestaCorrida(id, dataset, status, usd) {
  return new Response(JSON.stringify({ data: { id, defaultDatasetId: dataset, status, usageTotalUsd: usd } }), { headers: { 'content-type': 'application/json' } });
}

/** Apify en memoria: arranca corridas, dice su estado, da sus items, borra. */
function apifyFalso({ items = {}, estado = 'SUCCEEDED' } = {}) {
  const a = { arranques: [], borrados: [], abortadas: [], lecturas: 0, estado, n: 0 };
  a.solicitar = async (url, init = {}) => {
    const u = new URL(url);
    assert.equal(u.hostname, 'api.apify.com', `salio una peticion a ${u.hostname}`);
    const metodo = init.method ?? 'GET';
    let m = /^\/v2\/acts\/([^/]+)\/runs$/.exec(u.pathname);
    if (m && metodo === 'POST') {
      a.n += 1;
      const id = `corrida${String(a.n).padStart(4, '0')}`;
      a.arranques.push({ actor: m[1], entrada: JSON.parse(init.body), params: Object.fromEntries(u.searchParams) });
      return respuestaCorrida(id, `datos${id}`, 'RUNNING', null);
    }
    m = /^\/v2\/actor-runs\/([^/]+)\/abort$/.exec(u.pathname);
    if (m) { a.abortadas.push(m[1]); return respuestaCorrida(m[1], `datos${m[1]}`, 'ABORTED', 0.01); }
    m = /^\/v2\/actor-runs\/([^/]+)$/.exec(u.pathname);
    if (m) return respuestaCorrida(m[1], `datos${m[1]}`, a.estado, a.estado === 'SUCCEEDED' ? 0.04 : null);
    m = /^\/v2\/datasets\/([^/]+)(\/items)?$/.exec(u.pathname);
    if (m && metodo === 'DELETE') { a.borrados.push(m[1]); return new Response(null, { status: 204 }); }
    if (m && m[2]) {
      a.lecturas += 1;
      return new Response(JSON.stringify(items[m[1]] ?? []), { headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`peticion inesperada ${metodo} ${url}`);
  };
  return a;
}

/** El almacen en memoria, con la semantica de almacen.ts. */
function almacenFalso({ dia = 0, mes = 0, reciente = null } = {}) {
  const s = { seguimientos: new Map(), acts: [], comentarios: new Map(), guardados: 0, gastos: new Map(), purgas: 0, n: 0 };
  const uuid = () => { s.n += 1; return `${String(s.n).padStart(8, '0')}-0000-4000-8000-000000000000`; };
  const copia = (x) => JSON.parse(JSON.stringify(x));
  s.api = {
    async listar() { return [...s.seguimientos.values()].map((f) => ({ ...copia(f), ultima: null, enCurso: false, comentarios: 0 })); },
    async leer(id) { return s.seguimientos.has(id) ? copia(s.seguimientos.get(id)) : null; },
    async agregar({ red, url, idioma, usuarioId }) {
      const previa = [...s.seguimientos.values()].find((f) => f.url === url);
      if (previa) return { fila: copia(previa), nueva: false };
      const f = { id: uuid(), red, url, idioma, titulo: null, creador: null, publicado: null, tipo: null, usuarioId, creado: AHORA.toISOString() };
      s.seguimientos.set(f.id, f);
      return { fila: copia(f), nueva: true };
    },
    async actualizaciones(id) { return copia(s.acts.filter((a) => a.seguimientoId === id).reverse()); },
    async comentarios(id) {
      const filas = [...(s.comentarios.get(id)?.values() ?? [])];
      const conteo = { positivo: 0, negativo: 0, neutral: 0, sinTono: 0 };
      for (const c of filas) { if (c.sentimiento === null) conteo.sinTono += 1; else conteo[c.sentimiento] += 1; }
      return { filas: copia(filas.map((c) => ({ ...c, primeraVez: c.primeraVez ?? AHORA.toISOString() }))), conteo };
    },
    async conocidas(id, huellas) {
      const m = s.comentarios.get(id) ?? new Map();
      return new Map(huellas.filter((h) => m.has(h)).map((h) => [h, m.get(h).sentimiento]));
    },
    async reservar({ seguimientoId, usuarioId, topeUsd, topeDiario, topeMensual }) {
      if (!s.seguimientos.has(seguimientoId)) return { ok: false, motivo: 'no_existe' };
      const abierta = s.acts.find((a) => a.seguimientoId === seguimientoId && (a.estado === 'leyendo' || a.estado === 'guardando'));
      if (abierta) return { ok: true, actualizacion: copia(abierta), enCurso: true };
      if (reciente) return { ok: false, motivo: 'reciente', fecha: reciente };
      if (dia >= topeDiario) return { ok: false, motivo: 'dia' };
      if (mes + topeUsd > topeMensual) return { ok: false, motivo: 'mes' };
      const gastoId = uuid();
      s.gastos.set(gastoId, { usuarioId, tope: topeUsd, usd: 0, terminado: false });
      const a = { id: uuid(), seguimientoId, gastoId, topeUsd, estado: 'leyendo', corridas: {}, reclamada: null, metricas: null, leidos: null, nuevos: null, tono: null, creado: AHORA.toISOString(), terminado: null };
      s.acts.push(a);
      return { ok: true, actualizacion: copia(a), enCurso: false };
    },
    async guardarCorridas(id, corridas) { s.acts.find((a) => a.id === id).corridas = copia(corridas); },
    async reclamar(id, ahora) {
      const a = s.acts.find((x) => x.id === id);
      if (a.estado !== 'leyendo') return false;
      a.estado = 'guardando';
      a.reclamada = ahora;
      return true;
    },
    async guardar(g) {
      s.guardados += 1;
      const seg = s.seguimientos.get(g.actualizacion.seguimientoId);
      if (g.publicacion) Object.assign(seg, { titulo: g.publicacion.titulo || seg.titulo, creador: g.publicacion.creador ?? seg.creador, publicado: g.publicacion.publicado ?? seg.publicado, tipo: g.publicacion.tipo });
      const m = s.comentarios.get(seg.id) ?? new Map();
      for (const c of g.comentarios) m.set(c.huella, { ...c, primeraVez: m.get(c.huella)?.primeraVez ?? AHORA.toISOString(), sentimiento: c.sentimiento ?? m.get(c.huella)?.sentimiento ?? null });
      s.comentarios.set(seg.id, m);
      Object.assign(s.acts.find((a) => a.id === g.actualizacion.id), { estado: 'listo', metricas: g.metricas, leidos: g.comentarios.length, nuevos: g.nuevos, tono: g.tono, terminado: AHORA.toISOString() });
      Object.assign(s.gastos.get(g.actualizacion.gastoId), { usd: g.usd, terminado: true });
      s.ultimoGuardado = copia(g);
    },
    async fallar(id, gastoId, usd) {
      Object.assign(s.acts.find((a) => a.id === id), { estado: 'fallo', terminado: AHORA.toISOString() });
      Object.assign(s.gastos.get(gastoId), { usd, terminado: true });
    },
    async borrar(id) {
      if (!s.seguimientos.has(id)) return null;
      const abiertas = copia(s.acts.filter((a) => a.seguimientoId === id && a.terminado === null));
      s.seguimientos.delete(id);
      s.comentarios.delete(id);
      s.acts = s.acts.filter((a) => a.seguimientoId !== id);
      return { abiertas };
    },
    async cerrarGasto(gastoId, usd) { Object.assign(s.gastos.get(gastoId), { usd, terminado: true }); },
    async purgar() { s.purgas += 1; return 3; },
  };
  return s;
}

function tonoFalso() {
  const t = {
    llamadas: 0, textos: [],
    async etiquetar(textos) {
      t.llamadas += 1;
      t.textos.push(...textos);
      return textos.map((x) => (/caro/i.test(x) ? 'negativo' : 'positivo'));
    },
    calentar() {},
  };
  return t;
}

const USUARIO = async () => ({ id: 7 });

function deps(almacen, apify, tono, extra = {}) {
  return { almacen: almacen.api, solicitar: apify.solicitar, tono, entorno: ENTORNO, usuario: USUARIO, ahora: () => AHORA, leer: async (n) => (n === 'roster.json' ? ROSTER : null), hayBase: () => true, ...extra };
}

async function comprobar() {
  // --- Las URLs que se aceptan -------------------------------------------
  assert.deepEqual(C.publicacionDeUrl('https://www.instagram.com/reel/DAbc123xyz/?igsh=abc'), { red: 'instagram', url: URL_IG });
  assert.deepEqual(C.publicacionDeUrl(`${URL_TK}?is_from_webapp=1&sender_device=pc`), { red: 'tiktok', url: URL_TK });
  assert.equal(C.publicacionDeUrl('https://vm.tiktok.com/ZMabc123/'), null, 'un enlace corto no dice que publicacion es');
  assert.equal(C.publicacionDeUrl('https://www.facebook.com/share/p/abc123/'), null);
  assert.equal(C.publicacionDeUrl('https://www.instagram.com/noticias_tj/'), null, 'un perfil no es una publicacion');
  assert.equal(C.publicacionDeUrl('javascript:alert(1)'), null);
  assert.equal(C.publicacionDeUrl('x'.repeat(600)), null);

  // --- La frontera de sesion ---------------------------------------------
  const ids = Object.values(C.ACTORES_SEGUIMIENTO).map((a) => a.id);
  assert.ok(!ids.includes(ACTORES.facebookBusqueda.id), 'la busqueda por palabra de Facebook no es de aqui');
  for (const a of Object.values(C.ACTORES_SEGUIMIENTO)) assert.ok(a.razon.length > 20, `${a.id} sin razon escrita`);
  for (const red of ['tiktok', 'instagram', 'facebook']) {
    for (const pedido of [C.entradaPublicacion(red, 'https://x'), C.entradaComentarios(red, 'https://x')]) {
      revisarEntrada(pedido.entrada, pedido.actor.id);
      for (const k of Object.keys(pedido.entrada)) assert.ok(!LLAVES_DE_SESION.has(k.toLowerCase()));
    }
    assert.ok(C.topeDe(red) <= 0.6, `${red}: una actualizacion no puede reservar mas de 0.60 USD`);
  }
  assert.equal(C.entradaComentarios('facebook', 'https://x').entrada.viewOption, 'RECENT_ACTIVITY', 'lo mas reciente');
  assert.equal(C.TOPES.tiktok.publicacion.usd, 0.5, 'el minimo que el actor de TikTok acepta');

  // --- La publicacion: lista blanca y «sin dato» ---------------------------
  const tk = C.leerPublicacion('tiktok', VIDEO_TK);
  assert.equal(tk.titulo, 'Choque en el bulevar Agua Caliente');
  assert.equal(tk.creador, '@noticias_tj');
  assert.deepEqual(tk.metricas, { likes: 1200, comentarios: 88, reproducciones: 40000, compartidos: 31, guardados: 12 });
  assert.ok(!JSON.stringify(tk).includes('avatar'), 'el avatar del creador no se copia');
  const ig = C.leerPublicacion('instagram', {
    url: URL_IG, caption: 'Titular del medio\nel resto del pie', type: 'Image', likesCount: -1, commentsCount: 40, timestamp: '2026-09-27T10:00:00.000Z',
    ownerUsername: 'fulano_de_tal', latestComments: [{ text: 'hola', ownerUsername: 'maria_p', ownerProfilePicUrl: 'profilePicture' }],
  });
  assert.equal(ig.metricas.likes, null, 'likes ocultos: sin dato, nunca cero');
  assert.equal(ig.metricas.compartidos, null, 'Instagram no publica compartidos ajenos');
  assert.equal(ig.metricas.comentarios, 40);
  assert.equal(ig.titulo, 'Titular del medio');
  for (const d of IDENTIDAD) assert.ok(!JSON.stringify(ig).includes(d), `Instagram deja salir ${d}`);
  const fb = C.leerPublicacion('facebook', { url: 'https://www.facebook.com/reel/123', text: 'Reel del medio', likes: 50, comments: 4, shares: 2, viewsCount: 900, time: '2026-09-27T10:00:00.000Z', user: { name: 'Persona Cinco' } });
  assert.equal(fb.tipo, 'video');
  assert.equal(fb.metricas.reproducciones, 900);
  assert.equal(fb.metricas.guardados, null);
  assert.equal(C.leerPublicacion('instagram', { error: 'not_found', errorDescription: 'x' }), null);

  // --- Los comentarios: sin identidad, enmascarados, sin reacciones --------
  const leidos = C.leerComentarios('tiktok', COMENTARIOS_TK, URL_TK);
  assert.equal(leidos.length, 2, 'la reaccion y el de otro video no pasan; el repetido es una huella');
  const repetido = leidos.find((c) => c.crudo.startsWith('Qué bueno'));
  assert.equal(repetido.likes, 11, 'de dos iguales se queda el de mas likes');
  const mencion = leidos.find((c) => c.crudo.includes('caro'));
  assert.equal(mencion.texto, '@… mira esto, qué caro está todo');
  assert.equal(mencion.escrito, '2026-09-28T17:00:00.000Z');
  for (const d of IDENTIDAD) assert.ok(!JSON.stringify(leidos.map(({ crudo, ...resto }) => resto)).includes(d), `un comentario guardado deja salir ${d}`);

  // --- Parametros con nombre ----------------------------------------------
  assert.deepEqual(conNombres('a = $x AND b = $y OR c = $x', { x: [1, 'int'], y: ['z', 'text'], w: [9, 'int'] }), ['a = $1::int AND b = $2::text OR c = $1::int', [1, 'z']]);
  assert.throws(() => conNombres('$falta', {}));

  // --- Sin compuerta no se paga nada --------------------------------------
  {
    const alm = almacenFalso();
    const api = apifyFalso();
    const r = await R.responderAgregar({ url: URL_TK }, deps(alm, api, tonoFalso(), { entorno: { APIFY_API_TOKEN: 'x' } }));
    assert.equal(r.status, 400);
    assert.equal((await r.json()).codigo, 'apagado');
    const r2 = await R.responderAgregar({ url: 'https://example.com/x' }, deps(alm, api, tonoFalso()));
    assert.equal((await r2.json()).codigo, 'url');
    assert.equal(api.arranques.length, 0);
    assert.equal(alm.seguimientos.size, 0);
  }

  // --- Los topes cortan antes de pedir nada --------------------------------
  for (const [opciones, codigo] of [[{ dia: 10 }, 'limite_dia'], [{ mes: 19.9 }, 'limite_mes'], [{ reciente: AHORA.toISOString() }, 'reciente']]) {
    const alm = almacenFalso(opciones);
    const api = apifyFalso();
    const r = await (await R.responderAgregar({ url: URL_TK }, deps(alm, api, tonoFalso()))).json();
    assert.equal(r.lectura, codigo, `${codigo}: la publicacion se agrega aunque no se lea`);
    assert.equal(api.arranques.length, 0, `${codigo}: salio una peticion a Apify`);
    const r2 = await R.responderActualizar(r.id, deps(alm, api, tonoFalso()));
    assert.equal((await r2.json()).codigo, codigo);
    assert.equal(api.arranques.length, 0);
  }

  // --- El ciclo entero -----------------------------------------------------
  const alm = almacenFalso();
  const api = apifyFalso({ estado: 'RUNNING' });
  const tono = tonoFalso();
  const d = deps(alm, api, tono);
  const alta = await R.responderAgregar({ url: `${URL_TK}?lang=es` }, d);
  assert.equal(alta.status, 201);
  const { id, lectura } = await alta.json();
  assert.equal(lectura, 'leyendo');
  assert.equal(api.arranques.length, 2, 'la publicacion y sus comentarios arrancan juntas');
  assert.deepEqual(api.arranques.map((a) => a.actor), ['clockworks~tiktok-scraper', 'clockworks~tiktok-comments-scraper']);
  for (const a of api.arranques) assert.ok(Number(a.params.maxTotalChargeUsd) > 0, 'cada corrida lleva su tope en dolares');
  assert.deepEqual(api.arranques[0].entrada.postURLs, [URL_TK], 'se pide la URL canonica');

  // Pulsar otra vez mientras lee devuelve la misma lectura y no paga otra.
  const otra = await (await R.responderActualizar(id, d)).json();
  assert.equal(otra.id, alm.acts[0].id);
  assert.equal(api.arranques.length, 2);

  // Mientras las corridas corren, la ficha no guarda nada.
  let ficha = await (await R.responderFicha(id, d)).json();
  assert.equal(ficha.enCurso, true);
  assert.equal(alm.guardados, 0);

  // Terminadas: una pregunta guarda y la que llega a la vez no.
  api.estado = 'SUCCEEDED';
  const corr = alm.acts[0].corridas;
  const itemsDe = { [corr.publicacion.dataset]: [VIDEO_TK], [corr.comentarios.dataset]: COMENTARIOS_TK };
  api.solicitar = apifyFalso({ items: itemsDe }).solicitar;
  const api2 = apifyFalso({ items: itemsDe });
  const d2 = { ...d, solicitar: api2.solicitar };
  const [f1, f2] = await Promise.all([R.responderFicha(id, d2), R.responderFicha(id, d2)]);
  assert.equal(alm.guardados, 1, 'dos preguntas a la vez guardan UNA vez');
  ficha = await f1.json();
  await f2.json();
  assert.equal(ficha.enCurso, false);
  assert.equal(ficha.publicacion.titulo, 'Choque en el bulevar Agua Caliente');
  assert.equal(ficha.publicacion.creador, '@noticias_tj');
  assert.equal(ficha.actualizaciones[0].estado, 'listo');
  assert.equal(ficha.actualizaciones[0].metricas.likes, 1200);
  assert.deepEqual(ficha.tono, { mostrado: true, conteo: { positivo: 1, negativo: 1, neutral: 0, sinTono: 0 } });
  assert.deepEqual(ficha.comentarios.map((c) => c.texto), ['Qué bueno que no hubo heridos', '@… mira esto, qué caro está todo'], 'lo mas reciente primero');
  assert.ok(ficha.comentarios.every((c) => c.nuevo === false), 'en la primera lectura no se marca nada como nuevo');
  assert.deepEqual(api2.borrados.sort(), [corr.publicacion.dataset, corr.comentarios.dataset].sort(), 'el crudo se borra de Apify');
  const guardado = JSON.stringify(alm.ultimoGuardado);
  for (const x of IDENTIDAD) assert.ok(!guardado.includes(x), `lo guardado deja salir ${x}`);
  assert.ok(!guardado.includes('@maria_p'), 'la mencion se guarda enmascarada');
  assert.equal(alm.gastos.get(alm.acts[0].gastoId).usd, 0.08, 'el gasto es lo que cobraron las dos corridas');
  assert.equal(ficha.proxima, '2026-09-28T18:30:00.000Z', 'media hora hasta la siguiente');
  assert.equal(tono.textos.some((x) => x.includes('@…')), false, 'el modelo lee el texto sin mascara, como el pipeline');

  // Una segunda lectura no vuelve a etiquetar lo ya etiquetado.
  const llamadasAntes = tono.textos.length;
  alm.acts.push({ ...alm.acts[0], id: 'aaaaaaaa-0000-4000-8000-000000000000', estado: 'leyendo', terminado: null, creado: '2026-09-28T19:00:00.000Z' });
  await R.responderFicha(id, { ...d2, ahora: () => new Date('2026-09-28T19:05:00Z') });
  assert.equal(tono.textos.length, llamadasAntes, 'lo que ya tiene etiqueta la conserva');

  // --- Regla 5 y el idioma -------------------------------------------------
  {
    const almF = almacenFalso();
    const tonoF = tonoFalso();
    const apiF = apifyFalso({ estado: 'RUNNING' });
    const dF = deps(almF, apiF, tonoF);
    const { id: idF } = await (await R.responderAgregar({ url: URL_TK }, dF)).json();
    const c = almF.acts[0].corridas;
    const figura = { ...VIDEO_TK, text: 'Marina del Pilar inaugura el puente' };
    const apiF2 = apifyFalso({ items: { [c.publicacion.dataset]: [figura], [c.comentarios.dataset]: COMENTARIOS_TK } });
    const fichaF = await (await R.responderFicha(idF, { ...dF, solicitar: apiF2.solicitar })).json();
    assert.equal(tonoF.llamadas, 0, 'con una figura en el titulo no se pide tono');
    assert.equal(fichaF.tono.mostrado, false);
    assert.ok(fichaF.comentarios.every((x) => x.sentimiento === null));
    assert.equal(fichaF.actualizaciones[0].tono, null);
  }
  {
    const almE = almacenFalso();
    const tonoE = tonoFalso();
    const apiE = apifyFalso({ estado: 'RUNNING' });
    const dE = deps(almE, apiE, tonoE);
    const { id: idE } = await (await R.responderAgregar({ url: URL_TK, idioma: 'en' }, dE)).json();
    const c = almE.acts[0].corridas;
    const apiE2 = apifyFalso({ items: { [c.publicacion.dataset]: [VIDEO_TK], [c.comentarios.dataset]: COMENTARIOS_TK } });
    const fichaE = await (await R.responderFicha(idE, { ...dE, solicitar: apiE2.solicitar })).json();
    assert.equal(tonoE.llamadas, 0, 'en ingles no se pide tono');
    assert.equal(fichaE.tono.conteo.sinTono, 2);
    assert.equal(fichaE.publicacion.idioma, 'en');
  }

  // --- Una publicacion borrada o privada no es «cero comentarios» ---------
  {
    const almV = almacenFalso();
    const apiV = apifyFalso({ estado: 'RUNNING' });
    const dV = deps(almV, apiV, tonoFalso());
    const { id: idV } = await (await R.responderAgregar({ url: URL_TK }, dV)).json();
    const fichaV = await (await R.responderFicha(idV, { ...dV, solicitar: apifyFalso({}).solicitar })).json();
    assert.equal(fichaV.actualizaciones[0].estado, 'fallo');
    assert.equal(fichaV.actualizaciones[0].metricas, null);
  }

  // --- Dejar de seguir -----------------------------------------------------
  {
    const almB = almacenFalso();
    const apiB = apifyFalso({ estado: 'RUNNING' });
    const dB = deps(almB, apiB, tonoFalso());
    const { id: idB } = await (await R.responderAgregar({ url: URL_TK }, dB)).json();
    const gastoId = almB.acts[0].gastoId;
    const r = await R.responderBorrar(idB, dB);
    assert.equal(r.status, 200);
    assert.equal(almB.seguimientos.size, 0);
    assert.equal(apiB.abortadas.length, 2, 'lo que seguia corriendo se detiene');
    assert.equal(almB.gastos.get(gastoId).terminado, true, 'el gasto se cierra, y se queda');
    assert.equal(almB.gastos.get(gastoId).usd, 0.02);
    const r404 = await R.responderFicha(idB, dB);
    assert.equal(r404.status, 404);
    assert.equal((await R.responderBorrar('no-es-un-id', dB)).status, 404);
  }

  // --- La purga ------------------------------------------------------------
  {
    const almP = almacenFalso();
    const dP = deps(almP, apifyFalso(), tonoFalso());
    assert.equal((await R.responderPurga(null, dP)).status, 401);
    assert.equal((await R.responderPurga('Bearer otro', dP)).status, 401);
    assert.equal((await R.responderPurga('Bearer cron-de-prueba', { ...dP, entorno: { ...ENTORNO, CRON_SECRET: '' } })).status, 401, 'sin secreto no abre nunca');
    const ok = await R.responderPurga('Bearer cron-de-prueba', dP);
    assert.deepEqual(await ok.json(), { borrados: 3 });
    // Y cada visita purga tambien, por si el cron no corre.
    await R.responderLista(dP);
    assert.equal(almP.purgas, 2);
  }

  // --- Lo que la pantalla dice de las cifras --------------------------------
  assert.deepEqual(F.metricasDe({ red: 'instagram', tipo: 'imagen' }).map((m) => m.clave), ['likes', 'comentarios']);
  assert.deepEqual(F.metricasDe({ red: 'tiktok', tipo: 'video' }).map((m) => m.clave), ['likes', 'comentarios', 'reproducciones', 'compartidos', 'guardados']);
  assert.equal(F.metricasDe({ red: 'facebook', tipo: 'otro' })[0].nombre[1], 'reacciones');
  assert.equal(F.diferencia({ likes: 10 }, { likes: 4 }, 'likes'), 6);
  assert.equal(F.diferencia({ likes: null }, { likes: 4 }, 'likes'), null, 'sin dato de un lado no hay diferencia');

  console.log('probar-seguimiento: ok');
}

comprobar().catch((error) => { console.error(error); process.exitCode = 1; });
