// El servidor MCP de gasto y el registro de costo de IA, sin red ni base.
//
//   node scripts/probar-mcp.cjs
//
// Fija lo que no se ve al usarlo: que sin MCP_LLAVE la ruta no existe, que
// la llave se acepta por las dos vias y no por otra, la negociacion de
// version, que una notificacion no se contesta, los precios por prefijo mas
// largo, la medianoche de Tijuana con y sin horario de verano, y que anotar
// sin base no hace nada ni rompe.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const SRC = path.resolve(__dirname, '../src');
const cargados = new Map();

function cargar(relativo) {
  // Un JSON importado (los expedientes) se lee tal cual; una carpeta, por su index.
  if (relativo.endsWith('.json')) {
    const datos = JSON.parse(fs.readFileSync(path.join(SRC, relativo), 'utf8'));
    return { __esModule: true, default: datos };
  }
  if (!fs.existsSync(path.join(SRC, relativo + '.ts')) && fs.existsSync(path.join(SRC, relativo, 'index.ts'))) relativo = path.join(relativo, 'index');
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

for (const v of ['DATABASE_URL', 'NEON_DB_DATABASE_URL', 'NEON_DATABASE_URL', 'MCP_HABILITADO']) delete process.env[v];

const { costoDe, precioDe, anotarUsoModelo } = cargar('lib/uso/modelo');
const { periodoDe, medianocheEnZona, PeriodoInvalido } = cargar('lib/uso/periodo');
const { responderMcp } = cargar('lib/mcp/servidor');
const { correrHerramienta, HERRAMIENTAS } = cargar('lib/mcp/herramientas');
const { esRutaPublica } = cargar('lib/acceso/rutas-publicas');
const oauth = cargar('lib/mcp/oauth/servidor');
const claves = cargar('lib/mcp/oauth/claves');
const { leerCliente, redirectPermitido, CLIENTES } = cargar('lib/mcp/oauth/clientes');
const { revisarSolicitud, firmarSolicitud, leerSolicitud } = cargar('lib/mcp/oauth/autorizacion');
const { conContexto } = cargar('lib/uso/contexto');
const registro = cargar('lib/mcp/oauth/registro');
const { leerRespuesta, ErrorDeAccion } = cargar('lib/mcp/comun');

const SECRETO = 's'.repeat(40);
const ORIGEN = 'https://x.test';
const RECURSO = `${ORIGEN}/api/mcp`;
const CTX = { usuarioId: 7, origen: ORIGEN };
const encendido = { MCP_HABILITADO: 'true', AUTH_SECRET: SECRETO };
// El usuario 7 es administrador; el 8, no. Sin base: se sustituye la consulta.
oauth.puedeConectar = async (id) => id === 7;
const TOKEN = claves.emitirAcceso(7, RECURSO, ORIGEN, 'https://claude.ai/oauth/mcp-oauth-client-metadata', SECRETO);

function pedido(cuerpo, { metodo = 'POST', cabeceras = {}, token = TOKEN } = {}) {
  return new Request(`${ORIGEN}/api/mcp`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      'x-forwarded-host': 'x.test',
      'x-forwarded-proto': 'https',
      ...(token === null ? {} : { authorization: `Bearer ${token}` }),
      ...cabeceras,
    },
    body: metodo === 'POST' ? JSON.stringify(cuerpo) : undefined,
  });
}

(async () => {
  // Precios: el prefijo mas largo gana, y el id con fecha encuentra su fila.
  assert.equal(precioDe('claude-sonnet-5-5').entrada, 2);
  assert.equal(precioDe('claude-haiku-4-5-20251001').salida, 5);
  assert.equal(precioDe('claude-opus-5-5').entrada, 4, 'opus-5-5 no puede cobrarse como opus-5');
  assert.equal(precioDe('gpt-algo'), null);
  assert.equal(costoDe('claude-haiku-4-5-20251001', { input_tokens: 1000, output_tokens: 1000 }), 0.006);
  assert.equal(costoDe('claude-sonnet-5-5', { cache_read_input_tokens: 1_000_000 }), 0.2);
  assert.equal(costoDe('claude-sonnet-5-5', { cache_creation_input_tokens: 1_000_000 }), 2.5);
  assert.equal(costoDe('claude-sonnet-5', { input_tokens: -5, output_tokens: 'x' }), 0, 'basura no suma');

  // Sin base, anotar regresa sin tocar nada.
  await anotarUsoModelo('analizar', 'claude-haiku-4-5', { usage: { input_tokens: 10 } });

  // Periodo y medianoche de Tijuana (PDT -7 en octubre, PST -8 en diciembre).
  const ahora = new Date('2026-10-26T18:00:00Z');
  assert.deepEqual(periodoDe(undefined, undefined, ahora), { desde: '2026-10-01', hasta: '2026-10-26' });
  assert.deepEqual(periodoDe(undefined, undefined, new Date('2026-11-01T05:00:00Z')), { desde: '2026-10-01', hasta: '2026-10-31' }, 'en Tijuana todavia es 31');
  assert.throws(() => periodoDe('2026-02-30', undefined, ahora), PeriodoInvalido);
  assert.throws(() => periodoDe('2026-10-20', '2026-10-01', ahora), PeriodoInvalido);
  assert.throws(() => periodoDe('2024-01-01', '2026-10-01', ahora), PeriodoInvalido);
  assert.equal(medianocheEnZona('2026-10-26').toISOString(), '2026-10-26T07:00:00.000Z');
  assert.equal(medianocheEnZona('2026-12-01').toISOString(), '2026-12-01T08:00:00.000Z');

  // Los errores de la pregunta, sin base: antes de fingir una.
  const sinBase = await correrHerramienta('resumen_de_gasto', {}, CTX);
  assert.equal(sinBase.isError, true);
  assert.match(sinBase.content[0].text, /base de datos/);

  // De aqui en adelante hay «base»: una URL que nunca se consulta, porque
  // ninguna ruta probada llega a la consulta.
  process.env.DATABASE_URL = 'postgres://u:p@base.invalid/db';

  // La puerta: rutas publicas exactas, y /mcp/autorizar NO.
  for (const r of ['/api/mcp', '/api/mcp/token', '/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/api/mcp', '/.well-known/oauth-authorization-server']) {
    assert.equal(esRutaPublica(r), true, r);
  }
  assert.equal(esRutaPublica('/api/mcp/otra'), false, 'exacta, no prefijo');
  assert.equal(esRutaPublica('/mcp/autorizar'), false, 'la autorizacion pide sesion');

  const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } };
  assert.equal((await responderMcp(pedido(init), {})).status, 404, 'apagado no existe');
  assert.equal((await responderMcp(pedido(init), { MCP_HABILITADO: 'true', AUTH_SECRET: 'corto' })).status, 404, 'secreto corto tampoco');

  // Sin token: 401 con el desafio que hace a Claude abrir la entrada.
  const sinToken = await responderMcp(pedido(init, { token: null }), encendido);
  assert.equal(sinToken.status, 401);
  const desafio = sinToken.headers.get('www-authenticate');
  assert.match(desafio, /^Bearer /);
  assert.match(desafio, /resource_metadata="https:\/\/x\.test\/\.well-known\/oauth-protected-resource\/api\/mcp"/);
  assert.match(desafio, /scope="pulso"/);
  // Tokens que no valen: otra audiencia, otro emisor, vencido, firma ajena,
  // una solicitud firmada presentada como token, y la llave vieja en la URL.
  const malos = [
    claves.emitirAcceso(7, 'https://otro.test/api/mcp', ORIGEN, 'c', SECRETO),
    claves.emitirAcceso(7, RECURSO, 'https://otro.test', 'c', SECRETO),
    claves.emitirAcceso(7, RECURSO, ORIGEN, 'c', SECRETO, Date.now() - 2 * 3600_000),
    claves.emitirAcceso(7, RECURSO, ORIGEN, 'c', 'o'.repeat(40)),
    claves.firmar({ sub: 7, aud: RECURSO, iss: ORIGEN, scp: 'pulso', exp: 9e9 }, SECRETO, 'solicitud'),
    'cualquiera',
  ];
  for (const t of malos) assert.equal((await responderMcp(pedido(init, { token: t }), encendido)).status, 401, t.slice(0, 30));
  const pedidoConLlaveVieja = new Request(`${ORIGEN}/api/mcp?llave=${SECRETO}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-host': 'x.test' }, body: JSON.stringify(init) });
  assert.equal((await responderMcp(pedidoConLlaveVieja, encendido)).status, 401, 'la query ya no autoriza');
  // Token bueno de quien ya no es administrador: 403, sin desafio.
  const deOtro = claves.emitirAcceso(8, RECURSO, ORIGEN, 'c', SECRETO);
  const r403 = await responderMcp(pedido(init, { token: deOtro }), encendido);
  assert.equal(r403.status, 403);
  assert.equal(r403.headers.get('www-authenticate'), null);
  assert.equal((await responderMcp(pedido(init), encendido)).status, 200);

  // Negociacion de version.
  const r1 = await (await responderMcp(pedido(init), encendido)).json();
  assert.equal(r1.result.protocolVersion, '2025-06-18');
  assert.equal(r1.result.capabilities.tools.listChanged, false);
  const r2 = await (await responderMcp(pedido({ ...init, params: { protocolVersion: '1999-01-01' } }), encendido)).json();
  assert.equal(r2.result.protocolVersion, '2025-11-25');

  // Una notificacion no se contesta; GET no abre flujo.
  assert.equal((await responderMcp(pedido({ jsonrpc: '2.0', method: 'notifications/initialized' }), encendido)).status, 202);
  assert.equal((await responderMcp(pedido(null, { metodo: 'GET' }), encendido)).status, 405);

  // tools/list: todas, sin la funcion adentro (las anotaciones, abajo).
  const lista = await (await responderMcp(pedido({ jsonrpc: '2.0', id: 2, method: 'tools/list' }), encendido)).json();
  assert.equal(lista.result.tools.length, HERRAMIENTAS.length);
  for (const t of lista.result.tools) {
    assert.equal(t.correr, undefined);
    assert.match(t.name, /^[a-z_]+$/);
  }

  // Lotes, metodo desconocido.
  const lote = await (await responderMcp(pedido([{ jsonrpc: '2.0', id: 3, method: 'ping' }, { jsonrpc: '2.0', id: 4, method: 'nada' }]), encendido)).json();
  assert.deepEqual(lote[0], { jsonrpc: '2.0', id: 3, result: {} });
  assert.equal(lote[1].error.code, -32601);

  // Requisitos del transporte (especificacion 2025-11-25, Streamable HTTP).
  const ping = { jsonrpc: '2.0', id: 5, method: 'ping' };
  assert.equal((await responderMcp(pedido(ping, { cabeceras: { origin: 'https://malo.example' } }), encendido)).status, 403, 'Origin ajeno: 403');
  assert.equal((await responderMcp(pedido(ping, { cabeceras: { origin: ORIGEN } }), encendido)).status, 200, 'el propio origen pasa');
  assert.equal((await responderMcp(pedido(ping, { cabeceras: { 'mcp-protocol-version': '1999-01-01' } }), encendido)).status, 400, 'version desconocida: 400');
  assert.equal((await responderMcp(pedido(ping, { cabeceras: { 'mcp-protocol-version': '2025-06-18' } }), encendido)).status, 200);
  assert.equal((await responderMcp(pedido([ping], { cabeceras: { 'mcp-protocol-version': '2025-06-18' } }), encendido)).status, 400, 'sin lotes desde 2025-06-18');
  assert.equal((await responderMcp(pedido({ jsonrpc: '2.0', id: 9, result: {} }), encendido)).status, 202, 'una respuesta del cliente: 202');

  // Errores de la pregunta vuelven como isError, no como error del protocolo.
  const mala = await correrHerramienta('costo_por_accion', { desde: 'ayer' }, CTX);
  assert.equal(mala.isError, true);
  assert.match(mala.content[0].text, /AAAA-MM-DD/);
  assert.equal((await correrHerramienta('inventada', {}, CTX)).isError, true);

  // === OAuth ================================================================
  // PKCE S256, con el vector del apendice B de RFC 7636.
  assert.equal(claves.pkceValido('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk', 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'), true);
  assert.equal(claves.pkceValido('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXX', 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'), false);
  assert.equal(claves.pkceValido('corto', 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'), false, 'verificador de menos de 43');

  // Redirect: exacto, y en loopback sin puerto (Claude Code).
  const declarados = ['https://claude.ai/api/mcp/auth_callback', 'http://localhost/callback', 'http://127.0.0.1/callback'];
  assert.equal(redirectPermitido('https://claude.ai/api/mcp/auth_callback', declarados), true);
  assert.equal(redirectPermitido('http://localhost:53122/callback', declarados), true);
  assert.equal(redirectPermitido('http://127.0.0.1:4000/callback', declarados), true);
  assert.equal(redirectPermitido('https://claude.ai/api/mcp/auth_callback?x=1', declarados), false);
  assert.equal(redirectPermitido('https://evil.test/api/mcp/auth_callback', declarados), false);
  assert.equal(redirectPermitido('http://localhost:53122/otra', declarados), false);
  assert.equal(redirectPermitido('https://localhost:53122/callback', declarados), false, 'loopback es http');

  // CIMD: solo las dos URLs de Anthropic, sin descargar las demas.
  let descargas = 0;
  const docClaude = { client_id: 'https://claude.ai/oauth/mcp-oauth-client-metadata', client_name: 'Claude', redirect_uris: ['https://claude.ai/api/mcp/auth_callback'] };
  const falso = async (url) => { descargas++; return new Response(JSON.stringify(url === docClaude.client_id ? docClaude : { client_id: 'otro', redirect_uris: [] })); };
  assert.equal(await leerCliente('https://evil.test/cliente.json', falso), null);
  assert.equal(descargas, 0, 'una URL ajena no se descarga (SSRF)');
  assert.equal(CLIENTES.size, 2);
  assert.equal((await leerCliente(docClaude.client_id, falso)).client_name, 'Claude');
  assert.equal(await leerCliente('https://claude.ai/oauth/claude-code-client-metadata', falso), null, 'el documento tiene que decir su propia URL');

  // La solicitud de autorizacion.
  const base = {
    response_type: 'code', client_id: docClaude.client_id, redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
    code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM', code_challenge_method: 'S256', state: 'abc', resource: RECURSO,
  };
  assert.equal((await revisarSolicitud({ ...base, client_id: 'https://evil.test/c' }, ORIGEN, falso)).tipo, 'pantalla');
  assert.equal((await revisarSolicitud({ ...base, redirect_uri: 'https://evil.test/cb' }, ORIGEN, falso)).tipo, 'pantalla', 'destino malo: no se redirige');
  const sinPkce = await revisarSolicitud({ ...base, code_challenge_method: 'plain' }, ORIGEN, falso);
  assert.equal(sinPkce.tipo, 'regreso');
  const u = new URL(sinPkce.url);
  assert.equal(u.searchParams.get('error'), 'invalid_request');
  assert.equal(u.searchParams.get('state'), 'abc');
  assert.equal(u.searchParams.get('iss'), ORIGEN);
  assert.equal(new URL((await revisarSolicitud({ ...base, resource: 'https://otro.test/mcp' }, ORIGEN, falso)).url).searchParams.get('error'), 'invalid_target');
  assert.equal((await revisarSolicitud({ ...base, resource: `${RECURSO}/` }, ORIGEN, falso)).tipo, 'ok', 'la barra final no cuenta');
  const ok = await revisarSolicitud(base, ORIGEN, falso);
  assert.equal(ok.tipo, 'ok');
  assert.equal(ok.solicitud.clienteHost, 'claude.ai');

  // La solicitud firmada: de quien la vio, sin vencer, y no vale como token.
  const firmada = firmarSolicitud(ok.solicitud, 7, SECRETO);
  assert.deepEqual(leerSolicitud(firmada, 7, SECRETO), ok.solicitud);
  assert.equal(leerSolicitud(firmada, 8, SECRETO), null, 'otra persona');
  assert.equal(leerSolicitud(firmarSolicitud(ok.solicitud, 7, SECRETO, Date.now() - 11 * 60_000), 7, SECRETO), null, 'vencida');
  assert.equal(leerSolicitud(TOKEN, 7, SECRETO), null, 'un token no es una solicitud');
  assert.equal(claves.verificarAcceso(firmada, RECURSO, ORIGEN, SECRETO), null, 'una solicitud no es un token');

  // Descubrimiento: lo que Claude mira para elegir CIMD y PKCE.
  const as = oauth.metadatosServidor(ORIGEN);
  assert.equal(as.issuer, ORIGEN);
  assert.equal(as.client_id_metadata_document_supported, true);
  assert.deepEqual(as.token_endpoint_auth_methods_supported, ['none']);
  assert.deepEqual(as.code_challenge_methods_supported, ['S256']);
  assert.equal(as.authorization_endpoint, `${ORIGEN}/mcp/autorizar`);
  const rs = oauth.metadatosRecurso(ORIGEN);
  assert.equal(rs.resource, RECURSO);
  assert.deepEqual(rs.authorization_servers, [ORIGEN]);
  assert.equal(oauth.origenPublico(new Headers({ host: 'PULSO-N33.vercel.app', 'x-forwarded-proto': 'https' })), 'https://pulso-n33.vercel.app');
  assert.equal(oauth.origenPublico(new Headers({ host: 'localhost:3002' })), 'http://localhost:3002');

  // El token: lo que se rechaza antes de tocar la base.
  const token = (cuerpo, tipo = 'application/x-www-form-urlencoded') => oauth.responderToken(new Request(`${ORIGEN}/api/mcp/token`, {
    method: 'POST', headers: { 'content-type': tipo, 'x-forwarded-host': 'x.test', 'x-forwarded-proto': 'https' }, body: cuerpo,
  }), encendido);
  assert.equal((await oauth.responderToken(new Request(`${ORIGEN}/api/mcp/token`, { method: 'POST' }), {})).status, 404);
  const tj = await token('{}', 'application/json');
  assert.equal(tj.status, 400);
  assert.equal((await tj.json()).error, 'invalid_request');
  assert.equal((await (await token('grant_type=password')).json()).error, 'unsupported_grant_type');
  assert.equal((await (await token(`grant_type=authorization_code&resource=${encodeURIComponent('https://otro.test/mcp')}`)).json()).error, 'invalid_target');
  assert.equal((await (await token('grant_type=authorization_code&code=x')).json()).error, 'invalid_request', 'sin code_verifier');
  assert.equal((await token('grant_type=password')).headers.get('cache-control'), 'no-store');

  delete process.env.DATABASE_URL;

  // === Todo el tablero ======================================================
  // Cada herramienta: nombre corto y unico, titulo, y la anotacion que decide
  // si Claude pide permiso. Las que cuestan lo dicen en el titulo y en la
  // descripcion, y NUNCA son de solo lectura (Claude las correria sin preguntar).
  const nombres = new Set();
  for (const h of HERRAMIENTAS) {
    assert.ok(!nombres.has(h.name), `repetida: ${h.name}`);
    nombres.add(h.name);
    assert.ok(h.name.length <= 64 && /^[a-z_]+$/.test(h.name), h.name);
    assert.ok(h.title && h.description, h.name);
    const cuesta = h.title.includes('(cuesta)');
    assert.equal(cuesta, /CUESTA/.test(h.description), `titulo y descripcion de ${h.name} dicen lo mismo del costo`);
    if (cuesta) assert.equal(h.annotations.readOnlyHint, false, `${h.name} cuesta y no puede ser de solo lectura`);
    if (h.annotations.destructiveHint) assert.equal(h.annotations.readOnlyHint, false, h.name);
  }
  for (const n of ['generar_guion', 'detallar_nota', 'analizar_nota', 'analizar_publicacion', 'seguir_publicacion',
    'actualizar_seguimiento', 'resumir_comentarios_seguidos', 'busqueda_en_vivo_en_redes']) {
    assert.ok(HERRAMIENTAS.find((h) => h.name === n).title.includes('(cuesta)'), n);
  }
  for (const n of ['dejar_de_seguir', 'cambiar_usuario']) assert.equal(HERRAMIENTAS.find((h) => h.name === n).annotations.destructiveHint, true, n);
  for (const n of ['noticias_en_tendencia', 'publicaciones_en_redes', 'garitas', 'usuarios', 'cuanto_cuesta_cada_accion']) {
    assert.equal(HERRAMIENTAS.find((h) => h.name === n).annotations.readOnlyHint, true, n);
  }

  // El costo de la IA llega a la herramienta que la llamo, sin base.
  const uso = { usuarioId: 7, costos: [] };
  await conContexto(uso, () => anotarUsoModelo('guion:noticias33', 'claude-sonnet-5-5', { model: 'claude-sonnet-5-5', usage: { input_tokens: 1000, output_tokens: 100 } }));
  assert.equal(uso.costos.length, 1);
  assert.equal(uso.costos[0].usd, 0.003);
  assert.equal(uso.costos[0].accion, 'guion:noticias33');

  // Una respuesta del sitio con {codigo, mensaje} es un error aunque sea 200.
  await assert.rejects(leerRespuesta(Response.json({ codigo: 'modelo', mensaje: 'No se pudo preparar el guion.' })), ErrorDeAccion);
  await assert.rejects(leerRespuesta(Response.json({ detalle: 'Prohibido' }, { status: 403 })), /Prohibido/);
  assert.deepEqual(await leerRespuesta(Response.json({ codigo: 'x', mensaje: 'y', apertura: 'a', clips: [] })), { codigo: 'x', mensaje: 'y', apertura: 'a', clips: [] });

  // Con la IA apagada, una herramienta que cuesta no gasta y lo dice.
  delete process.env.ANALISIS_HABILITADO;
  const apagada = await correrHerramienta('generar_guion', { programa: 'noticias33' }, CTX);
  assert.equal(apagada.isError, true);
  assert.match(apagada.content[0].text, /apagada/);

  // Leer del disco: las redes publicadas, filtradas y cortadas.
  const redes = await correrHerramienta('publicaciones_en_redes', { red: 'tiktok', limite: 3 }, CTX);
  assert.equal(redes.isError, undefined, redes.content?.[0]?.text);
  assert.ok(redes.structuredContent.publicaciones.length <= 3);
  for (const pub of redes.structuredContent.publicaciones) assert.equal(pub.red, 'tiktok');
  assert.equal((await correrHerramienta('noticias_en_tendencia', { lugar: 'marte' }, CTX)).isError, true, 'lugar desconocido');
  const listaExp = await correrHerramienta('expedientes', {}, CTX);
  assert.ok(listaExp.structuredContent.expedientes.length >= 1);
  const exp = await correrHerramienta('expedientes', { id: listaExp.structuredContent.expedientes[0].id }, CTX);
  assert.ok(exp.structuredContent.pdf_en_el_navegador.startsWith(ORIGEN));
  assert.ok(exp.content[0].text.length < 140_000, 'el expediente cabe en una respuesta');

  // === Registro dinamico (n8n, 30 de octubre de 2026) ======================
  assert.equal(esRutaPublica('/api/mcp/registro'), true);
  assert.equal(oauth.metadatosServidor(ORIGEN).registration_endpoint, `${ORIGEN}/api/mcp/registro`);
  assert.deepEqual(oauth.metadatosServidor(ORIGEN).token_endpoint_auth_methods_supported, ['none'], 'Claude sigue eligiendo CIMD');
  const N8N = 'https://n8n.viveenlabaja.mx/rest/oauth2-credential/callback';
  const registrar = (cuerpo, entorno = {}) => registro.responderRegistro(new Request(`${ORIGEN}/api/mcp/registro`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
  }), SECRETO, entorno);
  const ajeno = await registrar({ redirect_uris: ['https://evil.test/cb'], client_name: 'x' });
  assert.equal(ajeno.status, 400);
  assert.equal((await ajeno.json()).error, 'invalid_redirect_uri');
  assert.equal((await registrar({ redirect_uris: ['http://n8n.viveenlabaja.mx/rest/oauth2-credential/callback'] })).status, 400, 'solo https');
  assert.equal((await registrar({ redirect_uris: [] })).status, 400);
  const bueno = await registrar({ redirect_uris: [N8N], client_name: 'n8n', token_endpoint_auth_method: 'client_secret_post' });
  assert.equal(bueno.status, 201);
  const reg = await bueno.json();
  assert.ok(reg.client_id.startsWith('pdcr:'));
  assert.equal(reg.token_endpoint_auth_method, 'none');
  assert.equal(reg.client_secret, undefined, 'cliente publico: sin secreto');
  // El client_id ES el registro: se lee de su firma, y alterado no vale.
  assert.deepEqual(registro.clienteRegistrado(reg.client_id, SECRETO).redirect_uris, [N8N]);
  assert.equal(registro.clienteRegistrado(reg.client_id.slice(0, -2) + 'xx', SECRETO), null, 'firma rota');
  assert.equal(registro.clienteRegistrado(reg.client_id, 'o'.repeat(40)), null, 'otro secreto');
  assert.equal(registro.clienteRegistrado(reg.client_id, SECRETO, { MCP_DESTINOS_PERMITIDOS: 'https://otro.test' }), null, 'quitar el origen de la lista lo desconecta');
  assert.equal(registro.clienteRegistrado(claves.firmar({ r: [N8N], n: 'x', t: 1 }, SECRETO, 'solicitud'), SECRETO), null);

  // La autorizacion de un cliente registrado: sin descargar nada, y la
  // pantalla nombra el host al que vuelve.
  process.env.MCP_HABILITADO = 'true';
  process.env.AUTH_SECRET = SECRETO;
  process.env.DATABASE_URL = 'postgres://u:p@base.invalid/db';
  let descargasN8n = 0;
  const nada = async () => { descargasN8n++; return new Response('{}'); };
  const okN8n = await revisarSolicitud({ ...base, client_id: reg.client_id, redirect_uri: N8N }, ORIGEN, nada);
  assert.equal(okN8n.tipo, 'ok', JSON.stringify(okN8n));
  assert.equal(okN8n.solicitud.clienteHost, 'n8n.viveenlabaja.mx');
  assert.equal(descargasN8n, 0);
  assert.equal((await revisarSolicitud({ ...base, client_id: reg.client_id, redirect_uri: 'https://n8n.viveenlabaja.mx/otra' }, ORIGEN, nada)).tipo, 'pantalla', 'otro destino del mismo origen no estaba registrado');
  // El client_id en Basic tambien cuenta: sin codigo, el error es del codigo, no del cliente.
  const conBasic = await oauth.responderToken(new Request(`${ORIGEN}/api/mcp/token`, {
    method: 'POST',
    headers: { 'x-forwarded-host': 'x.test', 'content-type': 'application/x-www-form-urlencoded', authorization: 'Basic ' + Buffer.from(encodeURIComponent(reg.client_id) + ':x').toString('base64') },
    body: 'grant_type=authorization_code&code_verifier=' + 'v'.repeat(43),
  }), encendido);
  assert.equal((await conBasic.json()).error, 'invalid_request', 'falta el code, no el cliente');
  delete process.env.MCP_HABILITADO;
  delete process.env.AUTH_SECRET;
  delete process.env.DATABASE_URL;

  console.log('probar-mcp: ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
