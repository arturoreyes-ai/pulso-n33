// Frontera de acceso: sin red, sin credenciales ni cambios en una base real.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const SRC = path.resolve(__dirname, '../src');
function cargar(rel, mocks = {}, cache = new Map()) {
  if (Object.hasOwn(mocks, rel)) return mocks[rel];
  if (cache.has(rel)) return cache.get(rel).exports;
  const ruta = path.join(SRC, rel + '.ts');
  const mod = new Module(ruta, module);
  cache.set(rel, mod);
  mod.paths = module.paths;
  const original = mod.require.bind(mod);
  mod.require = (id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith('@/')) return cargar(id.slice(2), mocks, cache);
    if (id.startsWith('.')) return cargar(path.relative(SRC, path.resolve(path.dirname(ruta), id)).replaceAll('\\', '/'), mocks, cache);
    return original(id);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(ruta, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText, ruta);
  return mod.exports;
}
async function main() {
  const http = cargar('lib/acceso/http');
  let usuario = { id: 1, correo: 'persona@example.test', activo: true, aprobado: false, rol: 'lector' };
  let fallo = false;
  const acceso = { sinEntra: false, primerAdmin: 'admin@example.test' };
  const buscar = async () => { if (fallo) throw new Error('offline'); return usuario; };
  const mocks = {
    'lib/acceso/http': http,
    auth: { auth: (callback) => callback },
    'lib/acceso/config': { acceso },
    'lib/acceso/usuarios': { buscarUsuarioPorCorreo: buscar },
    'next/server': { NextResponse: {
      next: () => new Response(null, { status: 200 }),
      json: (body, init) => Response.json(body, init),
      redirect: (url) => Response.redirect(url, 307),
    } },
  };
  const { proxy } = cargar('proxy', mocks);
  const pedir = (ruta, sesion = true) => proxy({ nextUrl: new URL(ruta, 'https://pulso.test'), auth: sesion ? { user: { email: usuario?.correo || 'missing@example.test' } } : null });
  for (const ruta of ['/api/yo', '/data/notas.json', '/api/admin/usuarios']) {
    assert.equal((await pedir(ruta, false)).status, 401);
    assert.equal((await pedir(ruta)).status, 403);
  }
  assert.match((await pedir('/')).headers.get('location'), /ApprovalRequired/);
  assert.equal((await pedir('/entrar')).status, 200);
  assert.equal((await pedir('/api/garitas', false)).status, 200);
  assert.equal((await pedir('/api/garitas/admin', false)).status, 401);
  usuario.aprobado = true;
  assert.equal((await pedir('/data/notas.json')).status, 200);
  usuario.aprobado = false; // Mismo JWT, permiso revocado.
  assert.equal((await pedir('/data/notas.json')).status, 403);
  usuario = { ...usuario, aprobado: true, activo: false };
  assert.equal((await pedir('/api/yo')).status, 403);
  fallo = true;
  assert.equal((await pedir('/')).status, 503);
  fallo = false;
  usuario = { ...usuario, activo: true, aprobado: false };

  const sesion = cargar('lib/acceso/sesion', {
    ...mocks, auth: { auth: async () => ({ user: { email: usuario.correo } }) },
    'lib/acceso/bd': { hayBaseDeDatos: () => true },
  });
  await assert.rejects(sesion.requerirUsuario(), (e) => e.estado === 403);
  usuario.aprobado = true;
  await assert.rejects(sesion.requerirAdmin(), (e) => e.estado === 403);
  usuario.rol = 'admin';
  assert.equal((await sesion.requerirAdmin()).id, 1);

  let cambios = 0;
  const ruta = cargar('app/api/admin/usuarios/[id]/route', {
    'lib/acceso/http': http,
    'lib/acceso/sesion': sesion,
    'lib/acceso/usuarios': {
      buscarUsuarioPorId: async (id) => ({ id }),
      actualizarUsuario: async (id, cambio) => { cambios++; return { id, ...cambio }; },
    },
  });
  const patch = (id, body) => ruta.PATCH(new Request('https://pulso.test/api/admin/usuarios/' + id, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ id: String(id) }) });
  assert.equal((await patch(1, { aprobado: true })).status, 403);
  assert.equal((await patch(2, { aprobado: 'true' })).status, 422);
  usuario.rol = 'lector';
  assert.equal((await patch(2, { aprobado: true })).status, 403);
  usuario.rol = 'admin'; usuario.aprobado = false;
  assert.equal((await patch(2, { aprobado: true })).status, 403);
  assert.equal(cambios, 0);
  usuario.aprobado = true;
  assert.equal((await patch(2, { aprobado: true })).status, 200);
  assert.equal((await patch(2, { aprobado: false })).status, 200);
  assert.equal(cambios, 2);

  let consulta;
  const usuarios = cargar('lib/acceso/usuarios', {
    'lib/acceso/config': { acceso },
    'lib/acceso/bd': { sql: () => async (strings, ...values) => {
      consulta = { texto: strings.join('?'), values };
      return [{ id: 3, correo: 'nuevo@example.test', nombre: 'Nuevo', rol: 'lector', activo: true,
        aprobado: false, creado_en: '2026-09-28T00:00:00Z', ultimo_acceso_en: null }];
    } },
  });
  const identidad = { correo: 'nuevo@example.test', nombre: 'Nuevo', entraOid: null };
  assert.equal((await usuarios.registrarAcceso(identidad)).aprobado, false);
  assert.equal(consulta.values[4], false, 'nuevas cuentas requieren aprobacion');
  assert.match(consulta.texto, /ELSE usuarios.aprobado END/, 'reentrar conserva la decision');
  await usuarios.registrarAcceso({ ...identidad, correo: acceso.primerAdmin });
  assert.equal(consulta.values[4], true, 'bootstrap explicito del administrador');

  let opciones;
  cargar('auth', {
    'next-auth': { default: (config) => { opciones = config; return {}; } },
    'next-auth/providers/microsoft-entra-id': { default: () => ({}) },
    'lib/acceso/usuarios': { registrarAcceso: async () => usuario },
  });
  const login = () => opciones.callbacks.signIn({ user: { email: usuario.correo }, profile: {} });
  usuario.aprobado = false;
  assert.equal(await login(), '/entrar?error=ApprovalRequired');
  usuario.aprobado = true;
  assert.equal(await login(), true);
  usuario.activo = false;
  assert.equal(await login(), false);

  // Desarrollo sin servicios: nunca llama a Auth.js ni a la base.
  const devConfig = { acceso: { sinEntra: true, devCorreo: 'dev@pulso.local', devRol: 'admin' } };
  const sinServicios = cargar('lib/acceso/sesion', {
    'lib/acceso/config': devConfig,
    auth: { auth: async () => assert.fail('desarrollo no debe invocar Auth.js') },
    'lib/acceso/bd': { hayBaseDeDatos: () => false },
    'lib/acceso/usuarios': {},
  });
  assert.equal((await sinServicios.requerirAdmin()).id, 0);
  const proxyDev = cargar('proxy', {
    ...mocks, 'lib/acceso/config': devConfig,
    auth: { auth: () => () => assert.fail('desarrollo no debe ejecutar el envoltorio Auth.js') },
  });
  assert.equal(proxyDev.proxy({ nextUrl: new URL('https://pulso.test/admin/usuarios') }).status, 200);
  assert.equal(proxyDev.proxy({ nextUrl: new URL('https://pulso.test/api/garitas') }).headers.get('Access-Control-Allow-Origin'), '*');
  const entornoAnterior = { node: process.env.NODE_ENV, bypass: process.env.ACCESO_SIN_ENTRA };
  try {
    process.env.NODE_ENV = 'production';
    process.env.ACCESO_SIN_ENTRA = 'true';
    assert.equal(cargar('lib/acceso/config').acceso.sinEntra, false, 'produccion nunca admite el bypass');
  } finally {
    for (const [key, value] of [['NODE_ENV', entornoAnterior.node], ['ACCESO_SIN_ENTRA', entornoAnterior.bypass]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
  console.log('Aprobación: login, proxy, revocación, fallos, API, roles y altas verificados.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
