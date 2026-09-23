// Comprobaciones offline de la busqueda en vivo de un termino: /api/termino
// (la mitad gratuita) y /api/redes-en-vivo (la pagada, detras de un boton).
// unittest invoca este archivo (tests/test_redes_en_vivo_web.py) y CI tambien.
//
// Nunca toca la red, ni Apify, ni la base de datos, ni el modelo: `solicitar`,
// el libro de gasto y el servicio de tono se inyectan. Lo que esto existe para
// sostener, en el orden en que costaria no sostenerlo:
//
//  1. La identidad de quien comenta no sale de la funcion, y la copia en
//     TypeScript de los limpiadores llega al MISMO resultado que el pipeline
//     (el fixture compartido con tests/test_redes_en_vivo_paridad.py).
//  2. Los topes: con el mes o el dia llenos no sale ni una peticion a Apify.
//  3. Solo UNA peticion arranca la segunda pasada, aunque pregunten dos.
//  4. Sin la compuerta la ruta contesta `apagado` y no llama a nadie.
//  5. Un termino del roster no pide tono (regla 5).
//  6. Lo que no nombra el termino no pasa (la banda de Grupo Concordia).
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

// Sin base de datos y sin disco: el libro y la lectura se inyectan en cada
// caso. `urlBaseDeDatos` responde lo que diga la prueba, porque es una de las
// tres llaves de la compuerta.
let HAY_BD = true;
sustitutos.set('@/lib/acceso/bd', {
  sql: () => { throw new Error('la prueba no tiene base de datos'); },
  urlBaseDeDatos: () => (HAY_BD ? 'postgres://prueba' : undefined),
  hayBaseDeDatos: () => HAY_BD,
});
sustitutos.set('@/lib/datos/publicado', { leerDatoPublicado: async () => null });

const L = cargar('lib/redes-en-vivo/limpiar');
const { ACTORES, LLAVES_DE_SESION, revisarEntrada, ActorProhibido } = cargar('lib/redes-en-vivo/apify');
const { claveDe } = cargar('lib/redes-en-vivo/libro');
const R = cargar('lib/redes-en-vivo/responder');
const { responderTermino } = cargar('lib/busqueda/termino');
const { nombraFigura } = cargar('lib/busqueda/figura');
const { construirIndices } = cargar('lib/busqueda/archivo');
const { parsearRobots, puedeLeer, buscarEnMedio } = cargar('lib/busqueda/buscadores');
const V = cargar('lib/dominio/termino-vivo');
const { cifrasConsulta, reunirPublicacionesConsulta } = cargar('lib/dominio/consultas');

const FIXTURES = path.resolve(__dirname, 'fixtures/redes-en-vivo');
const CRUDOS = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'crudos.json'), 'utf8'));
const ESPERADO = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'esperado.json'), 'utf8'));
const AHORA = new Date(CRUDOS.ahora);
const TERMINO = CRUDOS.termino;

const IDENTIDAD = ['persona1', 'persona2', 'persona3', 'persona4', 'Persona Cinco', 'Persona Seis', 'Persona X', 'ownerUsername',
  'profileName', 'profilePicture', 'avatar', 'uniqueId', 'fulano_de_tal', 'maria_p', 'amigo.bueno', '"777"'];

const CAMPOS = ['url', 'creador', 'publicado', 'fecha', 'titulo', 'tipo', 'likes', 'comentarios',
  'compartidos', 'guardados', 'reproducciones', 'duracion'];
const proyectar = (d) => Object.fromEntries(CAMPOS.filter((k) => d[k] !== undefined).map((k) => [k, d[k]]));
const publicados = (porPost) => Object.fromEntries(Object.entries(porPost).map(([url, l]) => [url, l.map((c) => ({ texto: c.texto, likes: c.likes, fecha: c.fecha }))]));

const nunca = async (url) => { assert.fail(`no debio tocar la red: ${url}`); };

// La busqueda de Facebook no la leyo nunca el pipeline: su forma sale de la
// ficha del actor (scraper_one~facebook-posts-search, leida el 23 de
// septiembre de 2026), con `author`, que NO puede salir.
const FB_POSTS = [
  { url: 'https://www.facebook.com/vivelabaja/posts/pfbid0abc', postText: 'Vive la Baja anuncia sus fechas\nmas texto', timestamp: 1789977600, reactionsCount: 30, commentsCount: 2, sharesCount: 1,
    author: { name: 'Persona X', id: '777', url: 'https://www.facebook.com/personax', profilePicture: 'https://x/x.jpg' } },
  { url: 'https://www.facebook.com/permalink.php?story_fbid=123456&id=7890', postText: 'Fui a vive la baja con mi familia', timestamp: '2026-09-22T10:00:00.000Z', reactionsCount: 3, commentsCount: 1, sharesCount: 0,
    author: { name: 'Persona X', id: '777' } },
  { url: 'https://www.facebook.com/otra/posts/xyz123', postText: 'Nada que ver con el termino', timestamp: 1789977600, reactionsCount: 900, author: { name: 'Persona X' } },
];

/** Un Apify de mentira: arranca corridas, las deja correr hasta `terminar` y
 *  sirve sus conjuntos de datos segun el actor y la entrada. */
function apifyFalso() {
  const corridas = new Map();
  const arranques = [];
  let n = 0;
  const datosDe = (c) => {
    if (c.actor === ACTORES.tiktokBusqueda.id) return CRUDOS.tiktok.videos;
    if (c.actor === ACTORES.tiktokComentarios.id) return CRUDOS.tiktok.comentarios;
    if (c.actor === ACTORES.instagram.id) return c.entrada.resultsType === 'comments' ? CRUDOS.instagram.comentarios : CRUDOS.instagram.posts;
    if (c.actor === ACTORES.facebookBusqueda.id) return FB_POSTS;
    if (c.actor === ACTORES.facebookComentarios.id) return CRUDOS.facebook.comentarios;
    assert.fail(`actor inesperado ${c.actor}`);
  };
  const fn = async (url, init = {}) => {
    const u = new URL(url);
    assert.equal(u.hostname, 'api.apify.com', 'solo Apify');
    assert.equal(init.headers?.Authorization, 'Bearer token-de-prueba');
    let m;
    if ((m = /^\/v2\/acts\/([^/]+)\/runs$/.exec(u.pathname)) && init.method === 'POST') {
      n += 1;
      const id = `corrida${String(n).padStart(4, '0')}`;
      const dataset = `datos${String(n).padStart(6, '0')}`;
      const entrada = JSON.parse(init.body);
      const c = { actor: decodeURIComponent(m[1]), entrada, estado: 'RUNNING', dataset, usd: 0.05, tope: Number(u.searchParams.get('maxTotalChargeUsd')) };
      corridas.set(id, c);
      arranques.push(c);
      return Response.json({ data: { id, defaultDatasetId: dataset, status: 'READY' } });
    }
    if ((m = /^\/v2\/actor-runs\/([^/]+)$/.exec(u.pathname))) {
      const c = corridas.get(m[1]);
      return Response.json({ data: { id: m[1], defaultDatasetId: c.dataset, status: c.estado, ...(c.estado === 'SUCCEEDED' ? { usageTotalUsd: c.usd } : {}) } });
    }
    if ((m = /^\/v2\/datasets\/([^/]+)\/items$/.exec(u.pathname))) {
      const c = [...corridas.values()].find((x) => x.dataset === m[1]);
      return Response.json(datosDe(c));
    }
    assert.fail(`peticion inesperada a Apify: ${url}`);
  };
  fn.arranques = arranques;
  fn.terminar = () => { for (const c of corridas.values()) c.estado = 'SUCCEEDED'; };
  return fn;
}

/** El libro de gasto en memoria, con la misma semantica que el de Neon. */
function libroFalso({ gastado = 0, hoy = 0 } = {}) {
  const filas = new Map();
  let n = 0;
  const copia = (f) => JSON.parse(JSON.stringify({ id: f.id, clave: f.clave, estado: f.estado, corridas: f.corridas, creado: f.creado }));
  return {
    filas,
    async reservar({ clave, usuarioId, topeUsd, topeMensual, topeDiario }) {
      const previa = [...filas.values()].find((f) => f.clave === clave && f.estado !== 'fallo');
      if (previa) return { ok: true, fila: copia(previa), reusada: true };
      const mes = gastado + [...filas.values()].reduce((s, f) => s + (f.terminado ? f.usd : f.tope), 0);
      const dia = hoy + [...filas.values()].filter((f) => f.usuario === usuarioId).length;
      if (dia >= topeDiario) return { ok: false, motivo: 'dia' };
      if (mes + topeUsd > topeMensual) return { ok: false, motivo: 'mes' };
      n += 1;
      const id = `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
      const f = { id, clave, usuario: usuarioId, estado: 'buscando', corridas: {}, creado: AHORA.toISOString(), tope: topeUsd, usd: 0, terminado: false };
      filas.set(id, f);
      return { ok: true, fila: copia(f), reusada: false };
    },
    async leer(id) { const f = filas.get(id); return f ? copia(f) : null; },
    async guardarRed(id, red, corrida) { filas.get(id).corridas[red] = JSON.parse(JSON.stringify(corrida)); },
    async reclamar(id, red, ahora) {
      const c = filas.get(id).corridas[red];
      if (c?.fase !== 'publicaciones') return false;
      c.fase = 'comentarios';
      c.reclamada = ahora;
      return true;
    },
    async cerrar(id, estado, usd) {
      const f = filas.get(id);
      if (f.terminado) return;
      Object.assign(f, { estado, usd, terminado: true });
    },
  };
}

function tonoFalso() {
  const t = {
    llamadas: 0,
    calentado: 0,
    async etiquetar(textos, vocabulario) {
      t.llamadas += 1;
      return textos.map((x) => {
        const malo = /caro|no hubo|falsa|denuncian/i.test(x);
        return vocabulario === 'prensa' ? (malo ? 'adversa' : 'favorable') : (malo ? 'negativo' : 'positivo');
      });
    },
    calentar() { t.calentado += 1; },
  };
  return t;
}

const ENTORNO = { BUSQUEDA_REDES_HABILITADA: 'true', APIFY_API_TOKEN: 'token-de-prueba', AUTH_SECRET: 'secreto-de-prueba' };
const ROSTER = {
  verificado: '2026-09-01', nota: '',
  figuras: [
    { id: 'mpao', nombre: 'Marina del Pilar Ávila Olmeda', cargo: '', partido: '', ambito: '', desde: '2021-11-01', hasta: null, alias: ['Marina del Pilar', 'Ávila Olmeda'], alias_cargo: ['gobernadora de Baja California'] },
    { id: 'rcm', nombre: 'Román Cota Muñoz', cargo: '', partido: '', ambito: '', desde: '2024-10-01', hasta: null, alias: ['Román Cota', 'Cota Muñoz'], alias_cargo: ['alcalde de Tecate'] },
  ],
};

async function comprobar() {
  // --- 1. Paridad de los limpiadores con el pipeline --------------------
  const posts = CRUDOS.tiktok.videos.map((item) => {
    const p = L.limpiarVideoTiktok(item, TERMINO, AHORA, 30);
    return typeof p === 'string' ? { descarte: p } : proyectar(p.destacado);
  });
  assert.deepEqual(posts, ESPERADO.tiktok.posts, 'TikTok: publicaciones');
  const urlsTk = new Set(posts.filter((p) => p.url).map((p) => p.url));
  const comTk = CRUDOS.tiktok.comentarios.map((c) => L.limpiarComentario('tiktok', c, urlsTk)).filter(Boolean);
  assert.deepEqual(publicados(L.publicarComentarios(comTk, urlsTk, new Map())), ESPERADO.tiktok.comentarios, 'TikTok: comentarios');

  const postsIg = CRUDOS.instagram.posts.map((item) => proyectar(L.limpiarPostInstagram(item, L.etiquetaDe(TERMINO), AHORA, 30).destacado));
  assert.deepEqual(postsIg, ESPERADO.instagram.posts, 'Instagram: publicaciones');
  const urlsIg = new Set(postsIg.map((p) => p.url));
  const comIg = CRUDOS.instagram.comentarios.map((c) => L.limpiarComentario('instagram', c, urlsIg)).filter(Boolean);
  assert.deepEqual(publicados(L.publicarComentarios(comIg, urlsIg, new Map())), ESPERADO.instagram.comentarios, 'Instagram: comentarios');

  const urlsFb = new Set(CRUDOS.facebook.comentarios.map((c) => c.inputUrl));
  const comFb = CRUDOS.facebook.comentarios.map((c) => L.limpiarComentario('facebook', c, urlsFb)).filter(Boolean);
  assert.deepEqual(publicados(L.publicarComentarios(comFb, urlsFb, new Map())), ESPERADO.facebook.comentarios, 'Facebook: comentarios');

  // Un comentario que no dice de que post es se TIRA, a diferencia del
  // pipeline, que lo atribuye al primero pedido: aqui eso pondria el texto de
  // una publicacion debajo de otra en la pantalla.
  assert.equal(L.limpiarComentario('tiktok', { text: 'huerfano', diggCount: 1 }, urlsTk), null);

  // La busqueda de Facebook: sin `author` en la salida, y la fuente es la
  // pagina del enlace o «Facebook», nunca el nombre de quien publico.
  const fb = FB_POSTS.map((item) => L.limpiarPostFacebook(item, AHORA, 30));
  assert.equal(fb[0].destacado.fuente, 'vivelabaja');
  assert.equal(fb[1].destacado.fuente, 'Facebook');
  assert.equal(fb[0].destacado.likes, 30);
  assert.equal(fb[0].destacado.titulo, 'Vive la Baja anuncia sus fechas');
  for (const d of IDENTIDAD) assert.ok(!JSON.stringify(fb).includes(d), `Facebook deja salir ${d}`);

  // Puntos de codigo, no unidades UTF-16: el recorte no parte un emoji.
  assert.equal(L.titulo('😀'.repeat(200)), '😀'.repeat(159) + '…');
  assert.equal(L.desescapar('semaforo \\ud83d\\udea6'), 'semaforo 🚦');
  assert.equal(L.desescapar('suelto \\ud83d'), 'suelto \\ud83d', 'un sustituto suelto se deja');

  // --- 6. Lo que no nombra el termino no pasa ---------------------------
  assert.equal(L.nombraEnPie('El grupo musical Concordia en concierto', 'Grupo Concordia'), false, 'la banda de Gran Poder');
  assert.equal(L.nombraEnPie('Obras de GRUPO CONCORDIA en Tijuana', 'Grupo Concordia'), true);
  assert.equal(L.nombraEnPie('Fin de semana #GrupoConcordia', 'Grupo Concordia'), true, 'por su etiqueta');
  assert.equal(L.etiquetaDe('Vive la Baja'), 'vivelabaja');
  const { quedan, descartes } = R.quedarse('facebook', FB_POSTS, TERMINO, AHORA);
  assert.deepEqual(quedan.map((p) => p.destacado.url), [FB_POSTS[0].url, FB_POSTS[1].url]);
  assert.equal(descartes.no_nombra, 1);

  // --- La frontera de sesion ---------------------------------------------
  assert.throws(() => revisarEntrada({ query: 'x', cookies: [] }, 'actor'), ActorProhibido);
  assert.throws(() => revisarEntrada({ SessionCookie: 'x' }, 'actor'), ActorProhibido);
  for (const red of ['tiktok', 'instagram', 'facebook']) {
    const pedido = R.entradaPosts(red, TERMINO, AHORA);
    revisarEntrada(pedido.entrada, pedido.actor.id);
    revisarEntrada(R.entradaComentarios(red, ['https://x']).entrada, 'c');
    for (const k of Object.keys(pedido.entrada)) assert.ok(!LLAVES_DE_SESION.has(k.toLowerCase()));
  }
  // Espejo exacto de pulso/apify.py::LLAVES_DE_SESION.
  const py = fs.readFileSync(path.resolve(__dirname, '../../pulso/apify.py'), 'utf8');
  const bloque = /LLAVES_DE_SESION = frozenset\(\{([\s\S]*?)\}\)/.exec(py)[1];
  assert.deepEqual([...LLAVES_DE_SESION].sort(), [...bloque.matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort());
  // La salvedad viaja con la letra de pulso/consultas.py.
  const consultasPy = fs.readFileSync(path.resolve(__dirname, '../../pulso/consultas.py'), 'utf8');
  const salvedad = /SALVEDAD_TONO = \(([\s\S]*?)\n\)/.exec(consultasPy)[1];
  assert.equal(V.SALVEDAD_TONO, [...salvedad.matchAll(/"([^"]*)"/g)].map((m) => m[1]).join(''));

  // --- 5. La figura del roster -------------------------------------------
  assert.equal(nombraFigura('Marina del Pilar', ROSTER), true);
  assert.equal(nombraFigura('marina del pilar avila', ROSTER), true);
  assert.equal(nombraFigura('Burgueño', { ...ROSTER, figuras: [{ ...ROSTER.figuras[0], nombre: 'Ismael Burgueño Ruiz', alias: ['Burgueño'] }] }), true);
  assert.equal(nombraFigura('Cota', ROSTER), true, 'un apellido del roster, hacia no mostrar');
  assert.equal(nombraFigura('alcalde de Tecate', ROSTER), true);
  assert.equal(nombraFigura('Tecate', ROSTER), false, 'el cargo nombra la ciudad, y la ciudad no es una figura');
  assert.equal(nombraFigura('Vive la Baja', ROSTER), false);
  assert.equal(nombraFigura('Baja California', ROSTER), false);

  // --- 4. Sin compuerta, apagado y sin red -------------------------------
  for (const entorno of [{}, { ...ENTORNO, BUSQUEDA_REDES_HABILITADA: 'false' }, { ...ENTORNO, APIFY_API_TOKEN: '' }, { ...ENTORNO, AUTH_SECRET: '' }]) {
    const r = await R.responderInicio({ q: TERMINO }, { entorno, solicitar: nunca, libro: libroFalso(), tono: tonoFalso(), usuario: async () => ({ id: 1 }) });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).codigo, 'apagado');
  }
  HAY_BD = false;
  const sinBd = await R.responderInicio({ q: TERMINO }, { entorno: ENTORNO, solicitar: nunca, libro: libroFalso(), tono: tonoFalso(), usuario: async () => ({ id: 1 }) });
  assert.equal((await sinBd.json()).codigo, 'apagado', 'sin libro no hay topes, y sin topes no hay busqueda');
  HAY_BD = true;

  // --- 2. Los topes, antes de cualquier peticion -------------------------
  const mes = await R.responderInicio({ q: TERMINO }, { entorno: ENTORNO, solicitar: nunca, libro: libroFalso({ gastado: 49 }), tono: tonoFalso(), usuario: async () => ({ id: 1 }) });
  assert.equal(mes.status, 429);
  assert.equal((await mes.json()).codigo, 'limite_mes');
  const dia = await R.responderInicio({ q: TERMINO }, { entorno: ENTORNO, solicitar: nunca, libro: libroFalso({ hoy: 10 }), tono: tonoFalso(), usuario: async () => ({ id: 1 }) });
  assert.equal(dia.status, 429);
  assert.equal((await dia.json()).codigo, 'limite_dia');
  const mensajeDia = (await (await R.responderInicio({ q: TERMINO }, { entorno: ENTORNO, solicitar: nunca, libro: libroFalso({ hoy: 10 }), tono: tonoFalso(), usuario: async () => ({ id: 1 }) })).json()).mensaje;
  assert.ok(!/apify|usd|d[oó]lar|tope|libro|actor/i.test(mensajeDia), 'la pantalla no nombra el mecanismo');
  assert.ok(R.TOPE_POR_BUSQUEDA <= 2, 'el peor caso por busqueda');

  // --- El camino completo, con dos preguntas a la vez ---------------------
  const apify = apifyFalso();
  const libro = libroFalso();
  const tono = tonoFalso();
  const deps = { entorno: ENTORNO, solicitar: apify, libro, tono, usuario: async () => ({ id: 7 }), leer: async (n) => (n === 'roster.json' ? ROSTER : null), ahora: () => AHORA };
  const inicio = await R.responderInicio({ q: TERMINO }, deps);
  assert.equal(inicio.status, 202);
  const { id } = await inicio.json();
  assert.equal(apify.arranques.length, 3, 'una busqueda por red');
  assert.equal(tono.calentado, 1, 'el modelo arranca mientras las redes tardan');
  for (const c of apify.arranques) assert.ok(c.tope > 0 && c.tope <= 1, 'cada corrida lleva su tope en dolares');
  // Reusar: el mismo termino, plegado, no arranca nada ni cuenta.
  const otra = await R.responderInicio({ q: 'VIVE LA BAJA' }, deps);
  assert.equal(otra.status, 200);
  assert.equal((await otra.json()).id, id);
  assert.equal(apify.arranques.length, 3);

  const q = TERMINO;
  const antes = await (await R.responderEstado(id, q, deps)).json();
  assert.equal(antes.estado, 'buscando');
  assert.deepEqual(antes.redes, { tiktok: 'buscando', instagram: 'buscando', facebook: 'buscando' });

  // El id solo no abre una busqueda.
  assert.equal((await R.responderEstado(id, 'otro termino', deps)).status, 404);

  apify.terminar();
  // --- 3. Dos preguntas llegan juntas: una sola segunda pasada por red ----
  const [a, b] = await Promise.all([R.responderEstado(id, q, deps), R.responderEstado(id, q, deps)]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  const segundas = apify.arranques.filter((c) => [ACTORES.tiktokComentarios.id, ACTORES.facebookComentarios.id].includes(c.actor)
    || (c.actor === ACTORES.instagram.id && c.entrada.resultsType === 'comments'));
  assert.equal(segundas.length, 3, 'una segunda pasada por red, no dos');
  const pedidasTk = segundas.find((c) => c.actor === ACTORES.tiktokComentarios.id).entrada.postURLs;
  assert.deepEqual(pedidasTk.sort(), [...urlsTk].sort(), 'solo lo que nombra el termino se paga dos veces');

  apify.terminar();
  const r = await R.responderEstado(id, q, deps);
  assert.equal(r.headers.get('Cache-Control'), 'private, no-store');
  const fin = await r.json();
  assert.equal(fin.estado, 'listo');
  assert.equal(libro.filas.get(id).terminado, true, 'el libro registra lo que costo');
  assert.ok(libro.filas.get(id).usd > 0);
  const texto = JSON.stringify(fin);
  for (const d of IDENTIDAD) assert.ok(!texto.includes(d), `la respuesta deja salir ${d}`);
  assert.deepEqual(publicados(Object.fromEntries(Object.entries(fin.textos.por_post).filter(([u]) => urlsTk.has(u)))), ESPERADO.tiktok.comentarios);
  // El tono de cada comentario llega del servicio, y lo que es brigada no
  // cuenta en las cubetas.
  const tk = fin.piezas.redes.tiktok;
  assert.equal(tk.length, 3);
  const uno = tk.find((d) => d.url.endsWith('0001'));
  assert.equal(uno.cosechados, 6);
  // Opinion es lo que pulso/redes.py cuenta como tal: sin la reaccion ni la
  // brigada. La mencion sola SI es opinion ahi (tiene letras); lo que no hace
  // es publicarse, que es otra regla.
  assert.equal(uno.opinion, 4, 'sin la reaccion ni la brigada');
  assert.deepEqual(uno.sentimiento, { positivo: 3, negativo: 1, neutral: 0, sin_clasificar: 0, sin_modelo_idioma: 0 });
  // La ficha que se arma con esto: los conteos suman, sin porcentajes.
  const c = V.armarConsulta(fin.piezas);
  const cifras = cifrasConsulta(c);
  assert.equal(cifras.publicaciones.estado, 'ok');
  assert.equal(cifras.publicaciones.total, tk.length + fin.piezas.redes.instagram.length + fin.piezas.redes.facebook.length);
  const tp = c.tono_publicaciones;
  assert.equal(tp.positivo + tp.negativo + tp.neutral + tp.sin_clasificar + tp.sin_modelo_idioma, tp.publicaciones);
  assert.equal(c.tono.positivo + c.tono.negativo + c.tono.neutral + c.tono.sin_clasificar + c.tono.sin_modelo_idioma, c.tono.comentarios);
  assert.equal(c.plataformas.x.estado, 'sin_dato');
  assert.equal(c.plataformas.youtube.estado, 'sin_dato', 'la pasada pagada no lee YouTube');
  assert.equal(reunirPublicacionesConsulta(c).length, cifras.publicaciones.total);

  // --- 5 otra vez: con un termino del roster no se pide tono --------------
  const tonoRoster = tonoFalso();
  const depsRoster = { ...deps, solicitar: apifyFalso(), libro: libroFalso(), tono: tonoRoster };
  const idRoster = (await (await R.responderInicio({ q: 'Marina del Pilar' }, depsRoster)).json()).id;
  depsRoster.solicitar.terminar();
  await R.responderEstado(idRoster, 'Marina del Pilar', depsRoster);
  depsRoster.solicitar.terminar();
  const roster = await (await R.responderEstado(idRoster, 'Marina del Pilar', depsRoster)).json();
  assert.equal(tonoRoster.llamadas, 0, 'un termino del roster no pasa por el modelo');
  assert.equal(roster.piezas.figura, true);
  for (const lista of Object.values(roster.textos.por_post)) for (const x of lista) assert.equal(x.sentimiento, null);

  // --- La mitad gratuita: /api/termino -----------------------------------
  const feedGoogle = `<?xml version="1.0"?><rss><channel>
    <item><title>Vive la Baja trae el festival - Zeta Tijuana</title><link>https://news.google.com/rss/articles/AAA</link><pubDate>Mon, 21 Sep 2026 10:00:00 GMT</pubDate><source url="https://zetatijuana.com">Zeta Tijuana</source></item>
    <item><title>Denuncian cobros en Vive la Baja - KPBS</title><link>https://news.google.com/rss/articles/BBB</link><pubDate>Mon, 21 Sep 2026 11:00:00 GMT</pubDate><source url="https://www.kpbs.org">KPBS</source></item>
  </channel></rss>`;
  const wp = (items) => `<?xml version="1.0"?><rss version="2.0"><channel>${items.map(([t, l, f]) => `<item><title>${t}</title><link>${l}</link><pubDate>${f}</pubDate></item>`).join('')}</channel></rss>`;
  const feedBlanco = wp([
    ['Vive la Baja: denuncian cobros indebidos', 'https://blancoynegro.mx/2026/09/cobros/', 'Sun, 20 Sep 2026 10:00:00 GMT'],
    ['La Concordia de Sinaloa', 'https://blancoynegro.mx/2026/09/sinaloa/', 'Sun, 20 Sep 2026 09:00:00 GMT'],
    ['Vive la Baja copia en otro dominio', 'https://otro.example/nota', 'Sun, 20 Sep 2026 08:00:00 GMT'],
    ['Vive la Baja en 2024', 'https://blancoynegro.mx/2024/03/vieja/', 'Fri, 08 Mar 2024 10:00:00 GMT'],
  ]);
  const pedidasTermino = [];
  const solicitarTermino = async (url) => {
    pedidasTermino.push(url);
    const u = new URL(url);
    if (u.hostname === 'news.google.com') {
      assert.equal(u.searchParams.get('q'), '"vive la baja" when:180d', 'la frase entre comillas, seis meses');
      return new Response(feedGoogle);
    }
    if (u.hostname === 'blancoynegro.mx') return new Response(feedBlanco);
    if (u.hostname === 'zetatijuana.com') return new Response('<html><body>portada</body></html>');
    assert.fail(`peticion inesperada: ${url}`);
  };
  const catalogo = {
    buscadores: [
      { id: 'blancoynegro', nombre: 'Blanco y Negro Noticias', url: 'https://blancoynegro.mx/?s={q}&feed=rss2', idioma: 'es' },
      { id: 'zeta', nombre: 'Zeta', url: 'https://zetatijuana.com/?s={q}&feed=rss2', idioma: 'es' },
      { id: 'cerrado', nombre: 'Cerrado', url: 'https://cerrado.example/?s={q}&feed=rss2', idioma: 'es' },
    ],
    medios: [{ id: 'kpbs', nombre: 'KPBS', dominio: 'kpbs.org', idioma: 'en' }, { id: 'zeta', nombre: 'Zeta Tijuana', dominio: 'zetatijuana.com', idioma: 'es' }],
    cuentas: [{ id: 'nbc7_ig', idioma: 'en' }],
  };
  const docRedes = {
    cuentas: [{ cuenta: 'tj_ig', nombre: 'Tijuana Noticias', zona: 'Tijuana', activa: true }, { cuenta: 'nbc7_ig', nombre: 'NBC 7', zona: 'San Diego', activa: true }],
    destacados: [
      { url: 'https://www.instagram.com/p/AAA111/', cuenta: 'tj_ig', zona: 'Tijuana', fecha: '2026-09-23', titulo: 'Arranca Vive la Baja en el Valle', tipo: 'imagen', cosechados: 4, opinion: 3, sentimiento: { positivo: 2, negativo: 1, neutral: 0, sin_clasificar: 0, sin_modelo_idioma: 0 }, temas: [] },
      { url: 'https://www.instagram.com/p/BBB222/', cuenta: 'nbc7_ig', zona: 'San Diego', fecha: '2026-09-23', titulo: 'Vive la Baja festival this weekend', tipo: 'imagen', cosechados: 1, opinion: 1, sentimiento: { positivo: 0, negativo: 0, neutral: 0, sin_clasificar: 0, sin_modelo_idioma: 1 }, temas: [] },
      { url: 'https://www.instagram.com/p/CCC333/', cuenta: 'tj_ig', zona: 'Tijuana', fecha: '2026-09-23', titulo: 'Otra cosa', tipo: 'imagen', cosechados: 9, opinion: 9, sentimiento: { positivo: 9, negativo: 0, neutral: 0, sin_clasificar: 0, sin_modelo_idioma: 0 }, temas: [] },
    ],
  };
  const docYoutube = { cuentas: [{ cuenta: 'yt_zeta', nombre: 'Zeta', zona: 'Tijuana', activa: true }], destacados: [
    { url: 'https://www.youtube.com/watch?v=abcdef123', cuenta: 'yt_zeta', zona: 'Tijuana', fecha: '2026-09-22', titulo: 'Así se vivió Vive la Baja', tipo: 'video', cosechados: 0, opinion: 0, sentimiento: { positivo: 0, negativo: 0, neutral: 0, sin_clasificar: 0, sin_modelo_idioma: 0 }, temas: [] },
  ] };
  const archivos = {
    'redes.json': docRedes,
    'redes-comentarios.json': { esquema: 1, generado: '', plataforma: 'instagram', retencion_dias: 30, visibles: 5, maximo: 10, por_post: {
      'https://www.instagram.com/p/AAA111/': [{ texto: 'Qué padre', likes: 3, fecha: '2026-09-23', sentimiento: 'positivo' }],
      'https://www.instagram.com/p/CCC333/': [{ texto: 'No es de esto', likes: 1, fecha: '2026-09-23', sentimiento: 'positivo' }],
    } },
    'youtube.json': docYoutube,
    'tendencias.json': { ubicaciones: [{ id: 'tj', nombre: 'Tijuana', estado: 'ok', tendencias: [{ puesto: 3, nombre: '#ViveLaBaja', url: 'https://x.com/search?q=%23ViveLaBaja' }, { puesto: 1, nombre: 'Otra', url: 'https://x.com/x' }] }] },
    'roster.json': ROSTER,
  };
  const indices = construirIndices([{
    id: 'n1', titulo: 'VIVE LA BAJA ROMPE RECORD', url: 'https://zetatijuana.com/2026/09/record/', dominio: 'zetatijuana.com', fuente: 'zeta',
    zona_medio: 'Tijuana', zonas: ['Tijuana'], alcance: 'zona', fecha: '2026-09-10', publicado: '2026-09-10T10:00:00+00:00', capturado: '', figuras: [],
    postura: { etiqueta: 'favorable', confianza: 0.9, metodo: 'modelo', modelo: 'm' },
  }]);
  const tonoT = tonoFalso();
  const depsT = {
    solicitar: solicitarTermino,
    leer: async (n) => archivos[n] ?? null,
    leerArchivo: async () => indices,
    leerCatalogo: async () => catalogo,
    robots: async (url) => !url.includes('cerrado.example'),
    tono: tonoT,
    ahora: () => AHORA,
    redesEnVivo: () => true,
  };
  const rt = await responderTermino(TERMINO, depsT);
  assert.equal(rt.status, 200);
  assert.match(rt.headers.get('Cache-Control'), /^private/, 'lleva texto de comentarios: nunca al CDN');
  const t = await rt.json();
  const prensa = t.piezas.prensa;
  assert.equal(prensa.estado, 'ok');
  const titulos = prensa.resultados.map((x) => x.titulo);
  assert.ok(titulos.includes('Vive la Baja: denuncian cobros indebidos'), 'el buscador del medio');
  assert.ok(!titulos.includes('La Concordia de Sinaloa'), 'el medio empareja el cuerpo; aqui solo lo que nombra');
  assert.ok(!titulos.includes('Vive la Baja copia en otro dominio'), 'el enlace tiene que ser del medio');
  assert.ok(titulos.includes('VIVE LA BAJA ROMPE RECORD'), 'el archivo');
  assert.deepEqual(prensa.anteriores.map((x) => x.titulo), ['Vive la Baja en 2024'], 'lo anterior va aparte, con fecha');
  const porTitulo = Object.fromEntries(prensa.resultados.map((x) => [x.titulo, x]));
  assert.equal(porTitulo['Vive la Baja: denuncian cobros indebidos'].tono, 'adversa');
  assert.equal(porTitulo['VIVE LA BAJA ROMPE RECORD'].tono, 'favorable', 'el archivo trae su tono del pipeline');
  assert.equal(porTitulo['Denuncian cobros en Vive la Baja'].tono, null, 'KPBS publica en ingles: sin modelo');
  assert.equal(prensa.tono.sin_modelo_idioma, 1);
  assert.equal(prensa.tono.favorable + prensa.tono.adversa + prensa.tono.neutral + prensa.tono.sin_clasificar + prensa.tono.sin_modelo_idioma, prensa.tono.titulares);
  assert.deepEqual(prensa.buscadores.map((x) => [x.id, x.estado]), [['noticias', 'ok'], ['blancoynegro', 'ok'], ['zeta', 'fallo'], ['cerrado', 'robots']]);
  assert.ok(!pedidasTermino.some((u) => u.includes('cerrado.example')), 'robots dijo que no: ni una peticion');
  // Lo que ya se cosecho y NOMBRA el termino, con su texto.
  assert.deepEqual(t.piezas.redes.instagram.map((d) => d.url), ['https://www.instagram.com/p/AAA111/', 'https://www.instagram.com/p/BBB222/']);
  assert.equal(t.piezas.redes.instagram[0].fuente, 'Tijuana Noticias');
  assert.equal(t.piezas.redes.tiktok, undefined, 'sin tiktok.json no se leyo: sin dato, no cero');
  assert.equal(t.piezas.redes.youtube.length, 1);
  assert.deepEqual(Object.keys(t.textos.por_post), ['https://www.instagram.com/p/AAA111/']);
  assert.equal(t.piezas.pies['https://www.instagram.com/p/BBB222/'], 'sin_modelo_idioma', 'la cuenta declara ingles');
  assert.equal(t.piezas.pies['https://www.instagram.com/p/AAA111/'], 'positivo');
  assert.deepEqual(t.tendencias, [{ lugar: 'Tijuana', puesto: 3, nombre: '#ViveLaBaja', url: 'https://x.com/search?q=%23ViveLaBaja' }]);
  assert.equal(t.redesEnVivo, true);
  // Y la ficha que se arma: YouTube leido, X sin dato, conteos que suman.
  const cv = V.armarConsulta(t.piezas);
  assert.equal(cv.plataformas.youtube.estado, 'ok');
  assert.equal(cv.plataformas.tiktok.estado, 'sin_dato');
  assert.equal(cv.tono.comentarios, 4, 'las cubetas de los dos posts que nombran el termino');
  const cfv = cifrasConsulta(cv);
  assert.deepEqual(cfv.publicaciones.leidas, ['instagram', 'youtube']);
  // Las dos mitades juntas no cuentan dos veces una publicacion repetida.
  const doble = V.fundirPiezas(t.piezas, { ...t.piezas, prensa: undefined, redes: { instagram: [t.piezas.redes.instagram[0]] } });
  assert.equal(doble.redes.instagram.length, 2);

  // Con un termino del roster, la mitad gratuita tampoco pide tono.
  const tonoR = tonoFalso();
  const rr = await (await responderTermino('Marina del Pilar', { ...depsT, tono: tonoR, solicitar: async (url) => (new URL(url).hostname === 'news.google.com' ? new Response(feedGoogle.replaceAll('Vive la Baja', 'Marina del Pilar')) : new Response(wp([]))) })).json();
  assert.equal(tonoR.llamadas, 0);
  assert.equal(rr.piezas.figura, true);
  const cr = V.armarConsulta(rr.piezas);
  assert.equal(cr.prensa.tono.favorable + cr.prensa.tono.adversa + cr.prensa.tono.neutral, 0);
  // Sin roster legible, tampoco: la duda se resuelve hacia no mostrar.
  const sinRoster = await (await responderTermino(TERMINO, { ...depsT, tono: tonoFalso(), leer: async (n) => (n === 'roster.json' ? null : archivos[n] ?? null) })).json();
  assert.equal(sinRoster.piezas.figura, true);

  // --- robots.txt con la semantica de urllib.robotparser ------------------
  const robots = parsearRobots('User-agent: *\nDisallow: /search/\n\nUser-agent: PulsoN33\nDisallow: /privado\n');
  assert.equal(puedeLeer(robots, 'PulsoN33/web (+x)', 'https://m.example/?s=hola&feed=rss2'), true);
  assert.equal(puedeLeer(robots, 'PulsoN33/web (+x)', 'https://m.example/privado/x'), false);
  assert.equal(puedeLeer(robots, 'PulsoN33/web (+x)', 'https://m.example/search/x'), true, 'su grupo propio manda sobre *');
  assert.equal(puedeLeer(robots, 'OtroBot/1', 'https://m.example/search/x'), false);
  const cerradoQ = parsearRobots('User-agent: *\nDisallow: /?s=\n');
  assert.equal(puedeLeer(cerradoQ, 'PulsoN33/web', 'https://m.example/?s=grupo%20concordia&feed=rss2'), false);
  assert.equal(puedeLeer(parsearRobots('User-agent: *\nDisallow:\n'), 'PulsoN33/web', 'https://m.example/?s=x'), true, 'Disallow vacio es todo');
  const medio = await buscarEnMedio(catalogo.buscadores[0], TERMINO, '2026-03-27', async () => new Response(feedBlanco), async () => false);
  assert.equal(medio.salud.estado, 'robots');

  // La clave del libro es del termino plegado y con secreto.
  assert.equal(claveDe('Vive la Baja', 's'), claveDe('vive  la baja', 's'));
  assert.notEqual(claveDe('Vive la Baja', 's'), claveDe('Vive la Baja', 'otro'));
  assert.match(claveDe('x', 's'), /^[0-9a-f]{64}$/);

  console.log('probar-redes-en-vivo: ok');
}

comprobar().catch((error) => { console.error(error); process.exitCode = 1; });
