// Comprobaciones offline del recorrido /ahora: los capitulos se encadenan en
// orden, no se reordenan y no repiten titulares. unittest invoca este archivo
// (tests/test_capitulos_web.py) y CI tambien.
//
// El mismo cargador que probar-busqueda.cjs. lib/busqueda/capitulos importa
// use-actualidad SOLO como tipo, que transpileModule borra, asi que aqui no
// entra ni React ni SWR.
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

const {
  CAPITULOS_MAXIMO, EN_VUELO_MAXIMO, UMBRAL_ACTIVACION,
  capitulosDe, debeActivar, fraseFinal, hilar,
} = cargar('lib/busqueda/capitulos');

// Ocho capitulos en toda entrada, nueve en Tecate: ahi se suman los
// comunicados del Ayuntamiento, que llegaron al recorrido el 15 de septiembre
// de 2026 al quitarse la pagina del muro donde vivian.
const largoDe = (entrada) => (entrada === 'Tecate' ? 9 : 8);
const { RUBROS, RUBROS_CADENA, RUBROS_PROGRAMA } = cargar('lib/busqueda/rubros');
const { TERMINOS_RUBRO, nombraRubro: nombraTitular } = cargar('lib/busqueda/rubros');
const { rubroDe, rutaDeEntrada } = cargar('lib/busqueda/entrada');
const { nombraRubro, terminosDeRubro } = cargar('lib/busqueda/tema-publicacion');
const { ZONAS_RUTA } = cargar('lib/dominio/zonas');
const { TOPE_ACTUALIDAD } = cargar('lib/busqueda/tipos');
const { indiceDeImagenes, imagenPara } = cargar('lib/busqueda/imagenes');
const { imagenDeHtml } = cargar('lib/busqueda/og-imagen');
const { indiceDeRelacionadas, relacionadasPara, terminos } = cargar('lib/busqueda/relacionadas');

const fila = (titulo, publicado = null, idioma = 'es') =>
  ({ titulo, url: 'https://news.google.com/rss/articles/' + encodeURIComponent(titulo), dominio: 'x.example', medio: 'X', publicado, idioma });
const listo = (resultados, extra = {}) => ({ estado: 'listo', resultados, caidos: [], truncada: false, ...extra });
const INACTIVO = { estado: 'inactivo' };
const CARGANDO = { estado: 'cargando' };
const FALLO = { estado: 'fallo' };
const lote = (prefijo, n) => Array.from({ length: n }, (_, i) => fila(`${prefijo} ${i + 1}`));

// Lo que la interfaz nunca dice: el mecanismo. Se prueba sobre cada cadena
// que llega a una tarjeta.
const MECANISMO = /google|rss|feed|api|pipeline|corpus|redirector/i;

function comprobar() {
  // --- capitulosDe -------------------------------------------------------
  const region = capitulosDe('region');
  assert.equal(region.length, 8);
  assert.equal(CAPITULOS_MAXIMO, 10, 'el techo de ranuras de datos, no el total');
  assert.deepEqual(region.map((c) => c.id), ['local', ...RUBROS_CADENA, 'mexico', 'internacional']);
  assert.deepEqual(region[0].pedido, { ambito: 'region', rubro: null });
  assert.deepEqual(region[2].pedido, { ambito: 'region', rubro: 'seguridad' });
  assert.deepEqual(region[6].pedido, { ambito: 'mexico', rubro: null });
  assert.deepEqual(region[7].pedido, { ambito: 'internacional', rubro: null });
  assert.equal(region[0].rotulo, 'Toda la región · ahora');
  assert.equal(region[0].titulo, 'Lo que destaca ahora en el corredor');
  assert.equal(region[2].rotulo, 'Seguridad · últimos dos días');
  assert.equal(region[2].titulo, 'Seguridad en el corredor');
  assert.equal(region[6].rotulo, 'México · ahora');
  assert.equal(region[7].rotulo, 'Internacional · ahora');
  assert.equal(region[6].id, 'mexico');
  assert.equal(region[7].id, 'internacional');

  const tijuana = capitulosDe('Tijuana');
  assert.deepEqual(tijuana[0].pedido, { zona: 'Tijuana', rubro: null });
  assert.deepEqual(tijuana[1].pedido, { zona: 'Tijuana', rubro: 'politica' });
  assert.equal(tijuana[0].rotulo, 'Tijuana · ahora');
  assert.equal(tijuana[1].titulo, 'Política sobre Tijuana');
  // El orden por relevancia (25 de septiembre de 2026): la nota dura primero.
  assert.deepEqual([...RUBROS_CADENA], ['politica', 'seguridad', 'economia', 'clima', 'deportes']);
  assert.deepEqual([...RUBROS], [...RUBROS_CADENA, 'espectaculos', 'turismo', 'ia'], 'la fila y la cadena no se contradicen');
  // Mexico e Internacional no dependen del lugar elegido.
  assert.deepEqual(tijuana[6].pedido, region[6].pedido);
  assert.deepEqual(tijuana[7].pedido, region[7].pedido);
  // Mexico e Internacional como ENTRADA: la edicion, sus rubros sin terminos
  // de lugar, la otra edicion y el corredor al final.
  const mexico = capitulosDe('mexico');
  assert.deepEqual(mexico.map((c) => c.id), ['mexico', ...RUBROS_CADENA, 'internacional', 'local']);
  assert.deepEqual(mexico[0].pedido, { ambito: 'mexico', rubro: null });
  assert.deepEqual(mexico[2].pedido, { ambito: 'mexico', rubro: 'seguridad' });
  assert.deepEqual(mexico[6].pedido, { ambito: 'internacional', rubro: null });
  assert.deepEqual(mexico[7].pedido, { ambito: 'region', rubro: null });
  assert.equal(mexico[0].rotulo, 'México · ahora');
  assert.equal(mexico[2].titulo, 'Seguridad en México');
  // Los rubros que Google clasifica son su seccion en Mexico, y la cejilla lo
  // dice como en una seccion: «ahora», no «ultimos dos dias».
  assert.equal(mexico[3].id, 'economia');
  assert.equal(mexico[3].rotulo, 'Economía · ahora');
  assert.equal(mexico[2].rotulo, 'Seguridad · últimos dos días', 'Seguridad no tiene seccion: sigue siendo busqueda');
  assert.equal(capitulosDe('mexico', 'espectaculos')[0].rotulo, 'Entretenimiento · ahora');
  assert.equal(capitulosDe('mexico', 'espectaculos')[0].titulo, 'Entretenimiento en México');
  assert.equal(capitulosDe('region', 'espectaculos')[0].rotulo, 'Entretenimiento · últimos dos días', 'un lugar no tiene seccion por tema');
  assert.equal(capitulosDe('internacional')[5].rotulo, 'Deportes · últimos dos días', 'ni el mundo');
  assert.equal(mexico[7].rotulo, 'Toda la región · ahora');
  const mundo = capitulosDe('internacional');
  assert.deepEqual(mundo.map((c) => c.id), ['internacional', ...RUBROS_CADENA, 'mexico', 'local']);
  assert.deepEqual(mundo[1].pedido, { ambito: 'internacional', rubro: 'politica' });
  assert.equal(mundo[1].titulo, 'Política en el mundo');
  assert.deepEqual(mundo[7].pedido, { ambito: 'region', rubro: null });

  for (const e of ['region', ...ZONAS_RUTA, 'mexico', 'internacional']) {
    const cs = capitulosDe(e);
    assert.equal(cs.length, largoDe(e), e);
    assert.equal(new Set(cs.map((c) => c.id)).size, largoDe(e), `${e}: ids sin repetir`);
    assert.ok(cs.length <= CAPITULOS_MAXIMO, `${e}: cabe en las ranuras de datos`);
    for (const c of cs) {
      assert.ok(c.acento.startsWith('text-'), `${e}/${c.id}: acento es una clase de texto`);
      // `pedido` es null exactamente en los capitulos que no salen de la
      // lectura en vivo. Si eso se desincroniza, use-capitulos pide null y el
      // capitulo se queda cargando para siempre, sin error y sin tarjeta.
      assert.equal(c.pedido === null, c.fuente !== 'actualidad', `${e}/${c.id}: fuente y pedido de acuerdo`);
      for (const texto of [c.nombre, c.rotulo, c.titulo]) assert.doesNotMatch(texto, MECANISMO, `${e}/${c.id}: «${texto}»`);
    }
  }

  // --- capitulosDe con un rubro: la cabeza se reordena, la cadena no crece -
  // El selector de tema (`?t=`, 18 de septiembre de 2026). Hasta entonces los
  // cinco rubros eran los capitulos 2 a 6 y a un tema solo se llegaba
  // deslizando por encima de los quince titulares del capitulo local, que es
  // otra manera de decir que no se podia pedir.
  const economiaTj = capitulosDe('Tijuana', 'economia');
  assert.deepEqual(economiaTj.map((c) => c.id),
    ['economia', 'local', 'politica', 'seguridad', 'clima', 'deportes', 'mexico', 'internacional'],
    'el elegido primero, el lugar segundo, los otros cuatro en el orden de RUBROS');
  assert.deepEqual(economiaTj[0].pedido, { zona: 'Tijuana', rubro: 'economia' });
  assert.deepEqual(economiaTj[1].pedido, { zona: 'Tijuana', rubro: null });
  assert.equal(economiaTj[0].titulo, 'Economía sobre Tijuana');
  // El capitulo del LUGAR no se pierde. Elegir tema acota por donde se
  // empieza, no lo que hay: es el mismo capitulo que encabeza la cadena sin
  // tema, movido un puesto.
  assert.deepEqual(economiaTj[1], tijuana[0]);
  assert.deepEqual(economiaTj.slice(6), tijuana.slice(6), 'la cola no se mueve');

  // Sin rubro, la cadena de siempre. El parametro por omision es lo que deja
  // verdes todas las aserciones de arriba.
  for (const e of ['region', ...ZONAS_RUTA, 'mexico', 'internacional']) {
    assert.deepEqual(capitulosDe(e, null), capitulosDe(e), `${e}: sin tema, la cadena de siempre`);
  }

  for (const e of ['region', ...ZONAS_RUTA, 'mexico', 'internacional']) {
    const sinTema = capitulosDe(e);
    for (const r of RUBROS_CADENA) {
      const cs = capitulosDe(e, r);
      assert.equal(cs.length, largoDe(e), `${e}/${r}: la cadena no cambia de largo`);
      assert.ok(cs.length <= CAPITULOS_MAXIMO, `${e}/${r}: cabe en las ranuras de datos`);
      assert.equal(new Set(cs.map((c) => c.id)).size, largoDe(e), `${e}/${r}: ids sin repetir`);
      assert.equal(cs[0].id, r, `${e}/${r}: empieza por el tema`);
      // La seccion del lugar queda segunda. Su id no siempre es 'local': en
      // las ediciones es 'mexico' o 'internacional' (ver seccionDe).
      assert.equal(cs[1].id, sinTema[0].id, `${e}/${r}: la seccion queda segunda`);
      // Los MISMOS capitulos en otro orden: ni uno se pierde ni entra uno
      // nuevo. Es lo que sostiene que CAPITULOS_MAXIMO no se mueva.
      assert.deepEqual(cs.map((c) => c.id).sort(), sinTema.map((c) => c.id).sort(),
        `${e}/${r}: los mismos capitulos, reordenados`);
      for (const c of cs) {
        assert.equal(c.pedido === null, c.fuente !== 'actualidad', `${e}/${r}/${c.id}: fuente y pedido de acuerdo`);
        for (const texto of [c.nombre, c.rotulo, c.titulo]) assert.doesNotMatch(texto, MECANISMO, `${e}/${r}/${c.id}: «${texto}»`);
      }
    }
  }

  // --- Rubros de la programacion: van delante, la cadena sigue entera ------
  // El 24 de septiembre de 2026 el cliente pidio los temas de sus programas
  // en la fila. No son de la cadena: elegido uno, va primero y la cadena sin
  // tema sigue detras, igual, y mide uno mas.
  assert.deepEqual([...RUBROS].sort(), [...RUBROS_CADENA, ...RUBROS_PROGRAMA].sort(), 'la fila son los ocho');
  for (const e of ['region', ...ZONAS_RUTA, 'mexico', 'internacional']) {
    const sinTema = capitulosDe(e);
    for (const r of RUBROS_PROGRAMA) {
      const cs = capitulosDe(e, r);
      assert.equal(cs.length, largoDe(e) + 1, `${e}/${r}: uno mas`);
      assert.ok(cs.length <= CAPITULOS_MAXIMO, `${e}/${r}: cabe en las ranuras de datos`);
      assert.equal(cs[0].id, r, `${e}/${r}: empieza por el tema`);
      assert.deepEqual(cs.slice(1), [...sinTema], `${e}/${r}: detras, la cadena de siempre`);
      assert.equal(new Set(cs.map((c) => c.id)).size, cs.length, `${e}/${r}: ids sin repetir`);
      for (const texto of [cs[0].nombre, cs[0].rotulo, cs[0].titulo]) assert.doesNotMatch(texto, MECANISMO, `${e}/${r}: «${texto}»`);
    }
  }
  const iaTj = capitulosDe('Tijuana', 'ia');
  assert.equal(iaTj[0].titulo, 'Inteligencia artificial sobre Tijuana');
  assert.equal(iaTj[0].rotulo, 'IA · última semana');
  assert.deepEqual(iaTj[0].pedido, { zona: 'Tijuana', rubro: 'ia' });
  assert.equal(capitulosDe('Tecate', 'turismo').length, 10, 'Tecate con tema de programa llena el techo');
  assert.equal(debeActivar(hilar(capitulosDe('Tecate', 'turismo'), Array(9).fill(listo(lote('X', 1)))), 99, 9, 10), true, 'se pide el decimo');

  // Tecate conserva sus nueve con tema puesto, y el boletin sigue detras de
  // los rubros: no es lo que esta pasando, no se adelanta a un titular.
  const tecateClima = capitulosDe('Tecate', 'clima');
  assert.deepEqual(tecateClima.map((c) => c.id),
    ['clima', 'local', 'politica', 'seguridad', 'economia', 'deportes', 'comunicados', 'mexico', 'internacional']);

  // --- El tema en Redes: los terminos del rubro sobre el titulo ------------
  // 24 de septiembre de 2026. Palabra entera, siglas con mayusculas, frases
  // tambien como etiqueta pegada, y sin acentos a los dos lados.
  assert.ok(nombraRubro('Lanzan herramienta de IA para maquilas', 'ia'));
  assert.ok(nombraRubro('Así cambia el trabajo #InteligenciaArtificial', 'ia'));
  assert.ok(nombraRubro('San Diego startup bets on AI', 'ia'));
  assert.ok(!nombraRubro('La guía de la feria', 'ia'), 'ia dentro de una palabra no');
  assert.ok(!nombraRubro('ela ia para casa', 'ia'), 'ia en minusculas es otra palabra');
  assert.ok(!nombraRubro('Sube el precio del pan', 'politica'), 'pan no es el PAN');
  assert.ok(nombraRubro('El PAN presenta iniciativa', 'politica'));
  assert.ok(nombraRubro('Lo que dijo la presidenta en la mañanera', 'politica'), 'la mañanera va en Política');
  assert.ok(nombraRubro('MAÑANERA DE HOY', 'politica'), 'mayusculas y acentos del medio');
  assert.ok(nombraRubro('Nuevo restaurante en el Valle de Guadalupe', 'turismo'));
  assert.ok(!nombraRubro('Un factor clave', 'espectaculos'), 'actor dentro de factor no');
  assert.ok(nombraRubro('Concierto gratis en la playa', 'espectaculos'));
  assert.ok(nombraRubro('🌧️ Huracanes Polo y Odalys no representan riesgo', 'clima'), 'plural');
  assert.ok(nombraRubro('#Comonfort | 🚔 Emboscan a elementos de las FSPE.', 'seguridad'));
  assert.ok(nombraRubro('La #Presidenta recibió en Palacio Nacional al presidente de Corea', 'politica'));
  assert.ok(!nombraRubro('Festival en Playas de Rosarito', 'turismo'), 'el nombre de una zona no es turismo');
  for (const r of RUBROS) assert.equal(typeof nombraRubro('', r), 'boolean', r);

  // --- La copia del pipeline: pulso/rubros.py ------------------------------
  // 25 de septiembre de 2026. El top 10 de TikTok por rubro lo corta el
  // pipeline con una copia de esta regla, y lo que la pagina no reconozca como
  // del rubro son comentarios pagados que nadie ve. Este fixture fija lo que
  // el sitio decide; tests/test_rubros.py fija que la copia decida lo mismo.
  // Tras un cambio DELIBERADO de terminos aqui:
  //   node scripts/probar-capitulos.cjs --escribir-rubros
  // y porta a pulso/rubros.py lo que la prueba de Python diga.
  //
  // `titulares` es la OTRA regla, la de rubros.ts::nombraRubro, con una lista
  // por idioma: la que la portada aplica a sus titulares en vivo. Desde el 25
  // de septiembre de 2026 pulso/tema_nota.py la copia para poner rubro a las
  // notas de prensa (tests/test_tema_nota.py), y por el idioma no es la de
  // arriba: «mayor» y «Padres» son de ingles aqui.
  const FIXTURE_RUBROS = path.resolve(__dirname, 'fixtures/rubros/esperado.json');
  const guardado = JSON.parse(fs.readFileSync(FIXTURE_RUBROS, 'utf8'));
  const calculado = {
    nota: guardado.nota,
    rubros: [...RUBROS],
    terminos: Object.fromEntries(RUBROS.map((r) => [r, terminosDeRubro(r)])),
    casos: guardado.casos.map(({ titulo }) => ({ titulo, rubros: RUBROS.filter((r) => nombraRubro(titulo, r)) })),
    titulares: {
      terminos: Object.fromEntries(RUBROS.map((r) => [r, TERMINOS_RUBRO[r]])),
      casos: (guardado.titulares?.casos ?? []).map(({ titulo, idioma }) =>
        ({ titulo, idioma, rubros: RUBROS.filter((r) => nombraTitular(titulo, r, idioma)) })),
    },
  };
  if (process.argv.includes('--escribir-rubros')) {
    fs.writeFileSync(FIXTURE_RUBROS, JSON.stringify(calculado, null, 1) + '\n');
    console.log(`Escrito ${path.relative(process.cwd(), FIXTURE_RUBROS)}; corre tests/test_rubros.py.`);
  } else {
    assert.deepEqual(calculado, guardado,
      'los rubros cambiaron sin regenerar el fixture: node scripts/probar-capitulos.cjs --escribir-rubros');
  }

  // --- La faceta: leerla de la URL y volver a escribirla -------------------
  // Un tema inventado cae en «Todo», por la misma razon que una entrada
  // inventada cae en la region: un enlace viejo muestra la cadena completa, no
  // una pestana marcada que no existe.
  for (const r of RUBROS) assert.equal(rubroDe(r), r);
  for (const basura of [null, '', 'CLIMA', 'weather', 'seguridad ', 'politics']) {
    assert.equal(rubroDe(basura), null, `«${basura}» no es un rubro`);
  }

  // Las tres formas de URL. Los dos controles componen la MISMA: cambiar de
  // lugar conserva el tema y cambiar de tema conserva el lugar.
  assert.equal(rutaDeEntrada('region'), '/');
  assert.equal(rutaDeEntrada('region', 'clima'), '/?t=clima');
  assert.equal(rutaDeEntrada('Tijuana'), '/tijuana');
  assert.equal(rutaDeEntrada('Tijuana', 'seguridad'), '/tijuana?t=seguridad');
  assert.equal(rutaDeEntrada('mexico'), '/?e=mexico');
  assert.equal(rutaDeEntrada('mexico', 'economia'), '/?e=mexico&t=economia');
  assert.equal(rutaDeEntrada('internacional', null), '/?e=internacional');

  // --- Tecate: el capitulo de comunicados ---------------------------------
  // Va DESPUES de los cinco rubros y ANTES de las otras ediciones: sigue
  // siendo de Tecate, pero son boletines publicados y no lo que esta pasando,
  // asi que no se adelantan a ningun titular reciente.
  const tecate = capitulosDe('Tecate');
  assert.deepEqual(tecate.map((c) => c.id), ['local', ...RUBROS_CADENA, 'comunicados', 'mexico', 'internacional']);
  const comunicados = tecate[6];
  assert.equal(comunicados.fuente, 'comunicados');
  assert.equal(comunicados.pedido, null, 'no se pide a la lectura en vivo');
  assert.equal(comunicados.titulo, 'Comunicados del Ayuntamiento');
  assert.equal(comunicados.rotulo, 'Gobierno de Tecate · comunicado');
  // Ninguna otra entrada lo lleva: es la unica fuente municipal del catalogo.
  for (const e of ['region', 'mexico', 'internacional', 'Tijuana', 'Mexicali']) {
    assert.ok(!capitulosDe(e).some((c) => c.fuente === 'comunicados'), `${e} no lleva comunicados`);
  }
  // El divisor los cuenta como comunicados, no como titulares.
  const hTecate = hilar(tecate, [
    listo(lote('T', 2)), listo([]), listo([]), listo([]), listo([]), listo([]),
    listo(lote('Boletin', 3)), INACTIVO, INACTIVO,
  ]);
  const divisorBoletin = hTecate.tarjetas.find((t) => t.tipo === 'divisor');
  assert.equal(divisorBoletin.capitulo, 'comunicados');
  assert.equal(divisorBoletin.sustantivo, 'comunicado');
  assert.equal(divisorBoletin.plural, 'comunicados');
  assert.equal(divisorBoletin.n, 3);
  const divisorTitulares = hilar(region, [listo(lote('A', 2)), listo(lote('B', 2)), ...Array(6).fill(INACTIVO)])
    .tarjetas.find((t) => t.tipo === 'divisor');
  assert.equal(divisorTitulares.sustantivo, 'titular');
  // «15 titulars» salio al aire el 25 de septiembre de 2026: el plural se
  // escribe, no se arma con una «s».
  assert.equal(divisorTitulares.plural, 'titulares');
  assert.match(fs.readFileSync(path.resolve(__dirname, '../src/components/ahora/tarjetas-ahora.tsx'), 'utf8'), /\$\{t\.n\} \$\{t\.plural\}/);
  // Y la cadena de nueve solo esta completa con los nueve asentados.
  assert.equal(hilar(tecate, Array(8).fill(listo([]))).completo, false, 'ocho de nueve no es completo');
  assert.equal(hilar(tecate, Array(9).fill(listo([]))).completo, true);
  // Con ocho activados el noveno no se ha pedido: es el fallo mudo que
  // motivo pasarle el largo a debeActivar.
  assert.equal(debeActivar(hilar(tecate, Array(8).fill(listo(lote('X', 1)))), 99, 8, 9), true, 'en Tecate se pide el noveno');
  assert.equal(debeActivar(hilar(region, Array(8).fill(listo(lote('X', 1)))), 99, 8, 8), false, 'en el resto no hay noveno');

  // --- hilar: orden y corte ---------------------------------------------
  // Se para en el primer capitulo no asentado, aunque uno posterior ya llego.
  let h = hilar(region, [listo(lote('A', 3)), CARGANDO, listo(lote('C', 2)), INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO]);
  assert.equal(h.tarjetas.length, 3, 'el capitulo 2 espera al 1');
  assert.equal(h.enVuelo, 1);
  assert.equal(h.completo, false);
  assert.ok(h.tarjetas.every((t) => t.tipo === 'titular'), 'el primer capitulo no lleva divisor');

  // Divisor antes del segundo capitulo con titulares, con su cuenta.
  h = hilar(region, [listo(lote('A', 3)), listo(lote('B', 2)), INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO]);
  assert.deepEqual(h.tarjetas.map((t) => t.tipo), ['titular', 'titular', 'titular', 'divisor', 'titular', 'titular']);
  assert.equal(h.tarjetas[3].capitulo, 'politica');
  assert.equal(h.tarjetas[3].n, 2);
  assert.equal(h.tarjetas[3].nota, null);
  assert.deepEqual(h.tarjetas.filter((t) => t.tipo === 'titular').map((t) => t.orden), [1, 2, 3, 4, 5]);
  assert.equal(h.titulares, 5);

  // El orden de Google se conserva: fechas fuera de orden, posiciones intactas.
  const desordenado = [fila('Viejo', '2026-09-01T10:00:00Z'), fila('Nuevo', '2026-09-10T10:00:00Z'), fila('Medio', '2026-09-05T10:00:00Z')];
  h = hilar(region, [listo(desordenado), INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO]);
  assert.deepEqual(h.tarjetas.map((t) => t.r.titulo), ['Viejo', 'Nuevo', 'Medio']);

  // --- hilar: repetidos y vacios ------------------------------------------
  // Entre capitulos, por titular plegado: acentos y mayusculas no separan.
  h = hilar(region, [listo([fila('Garita de San Ysidro cierra')]), listo([fila('GARITA DE SAN YSIDRO CIERRA'), fila('Otra')]), INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO]);
  assert.deepEqual(h.tarjetas.map((t) => t.tipo === 'titular' ? t.r.titulo : t.tipo), ['Garita de San Ysidro cierra', 'divisor', 'Otra']);
  assert.equal(h.tarjetas[1].n, 1, 'la cuenta del divisor es tras quitar repetidos');
  // Dentro del mismo capitulo tambien, y el titulo vacio se descarta.
  h = hilar(region, [listo([fila('Uno'), fila('uno'), fila('   '), fila('Dos')]), INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO]);
  assert.deepEqual(h.tarjetas.map((t) => t.r.titulo), ['Uno', 'Dos']);
  // Un capitulo que queda en cero no deja divisor y se anota en vacios.
  h = hilar(region, [listo([fila('Uno')]), listo([fila('UNO')]), listo([fila('Dos')]), INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO]);
  assert.deepEqual(h.tarjetas.map((t) => t.tipo), ['titular', 'divisor', 'titular']);
  assert.equal(h.tarjetas[1].capitulo, 'seguridad');
  assert.deepEqual(h.vacios, ['politica']);

  // --- hilar: fallos -----------------------------------------------------
  h = hilar(region, [FALLO, listo(lote('B', 2)), INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO, INACTIVO]);
  assert.deepEqual(h.tarjetas.map((t) => t.tipo), ['hueco', 'titular', 'titular'], 'el hueco se dice y el recorrido sigue');
  assert.deepEqual(h.faltantes, ['local']);
  assert.equal(h.tarjetas[0].capitulo, 'local');

  // --- hilar: nota del divisor y completo --------------------------------
  const todos = [listo(lote('A', 1)), listo(lote('B', TOPE_ACTUALIDAD), { caidos: ['en'], truncada: true }), listo([]), listo(lote('D', 1)), FALLO, listo(lote('F', 1)), listo(lote('G', 1)), listo(lote('H', 1))];
  h = hilar(region, todos);
  assert.equal(h.completo, true);
  assert.equal(h.enVuelo, 0);
  const divisor = h.tarjetas.find((t) => t.tipo === 'divisor' && t.capitulo === 'politica');
  assert.equal(divisor.nota, 'Faltan los titulares en inglés. Hay más; se muestran los primeros.', 'sin un numero que contradiga la cuenta');
  assert.deepEqual(h.vacios, ['seguridad']);
  assert.deepEqual(h.faltantes, ['clima']);
  assert.equal(h.titulares, 1 + TOPE_ACTUALIDAD + 1 + 1 + 1 + 1);
  h = hilar(region, [...todos.slice(0, 7), CARGANDO]);
  assert.equal(h.completo, false, 'completo solo con los ocho asentados');

  // --- fraseFinal ----------------------------------------------------------
  const frase = fraseFinal(region, hilar(region, todos));
  assert.equal(frase, `${1 + TOPE_ACTUALIDAD + 4} titulares en este recorrido. No se pudo traer: Clima. Sin titulares nuevos en: Seguridad.`);
  assert.doesNotMatch(frase, MECANISMO);
  assert.equal(fraseFinal(region, hilar(region, [listo(lote('A', 1)), ...Array(7).fill(listo([]))])), 'Un titular en este recorrido. Sin titulares nuevos en: Política, Seguridad, Economía, Clima, Deportes, México, Internacional.');

  // --- debeActivar ---------------------------------------------------------
  // El ultimo argumento es el largo REAL de la cadena, no una constante del
  // modulo: leerla de ahi era lo que dejaba sin pedir el noveno capitulo de
  // Tecate, sin error y con la tarjeta de carga girando para siempre.
  assert.equal(UMBRAL_ACTIVACION, 3);
  assert.equal(EN_VUELO_MAXIMO, 2);
  const soloCargando = hilar(region, [CARGANDO, ...Array(7).fill(INACTIVO)]);
  assert.equal(debeActivar(soloCargando, 0, 1, 8), true, 'al montar se adelanta el segundo capitulo');
  const dosEnVuelo = hilar(region, [CARGANDO, CARGANDO, ...Array(6).fill(INACTIVO)]);
  assert.equal(debeActivar(dosEnVuelo, 0, 2, 8), false, 'nunca mas de dos por delante');
  // El adelantado llego primero: sigue sin mostrarse, asi que no libera lugar.
  const adelantado = hilar(region, [CARGANDO, listo(lote('B', 5)), ...Array(6).fill(INACTIVO)]);
  assert.equal(adelantado.emitidos, 0);
  assert.equal(adelantado.tarjetas.length, 0);
  assert.equal(debeActivar(adelantado, 0, 2, 8), false, 'un capitulo adelantado no cuenta como recorrido');
  const ambos = hilar(region, [listo(lote('A', 2)), listo(lote('B', 5)), ...Array(6).fill(INACTIVO)]);
  assert.equal(ambos.emitidos, 2);
  assert.equal(debeActivar(ambos, 0, 2, 8), false, 'al principio de ocho tarjetas no se pide');
  assert.equal(debeActivar(ambos, 4, 2, 8), true, 'a tres del final si');
  const quince = hilar(region, [listo(lote('A', TOPE_ACTUALIDAD)), ...Array(7).fill(INACTIVO)]);
  assert.equal(debeActivar(quince, 0, 1, 8), false, 'al principio de quince no se pide');
  assert.equal(debeActivar(quince, TOPE_ACTUALIDAD - 1 - UMBRAL_ACTIVACION, 1, 8), true, 'a tres del final si');
  assert.equal(debeActivar(quince, TOPE_ACTUALIDAD - 2 - UMBRAL_ACTIVACION, 1, 8), false);
  const vacio = hilar(region, [listo([]), ...Array(7).fill(INACTIVO)]);
  assert.equal(debeActivar(vacio, 0, 1, 8), true, 'un capitulo vacio no detiene la cadena');
  const completo = hilar(region, todos);
  assert.equal(debeActivar(completo, completo.tarjetas.length - 1, 8, 8), false, 'con los ocho pedidos no hay mas');

  // --- imagenes: del corpus, por titular plegado, nunca de otra nota --------
  const nota = (titulo, imagen) => ({ id: 'x', titulo, url: 'https://medio.example/n', dominio: 'medio.example', fuente: 'medio', zona_medio: 'Tijuana', zonas: [], alcance: 'zona', fecha: null, publicado: null, capturado: '2026-09-14T00:00:00Z', figuras: [], postura: null, ...(imagen ? { imagen } : {}) });
  const indice = indiceDeImagenes([
    nota('Garita de San Ysidro cierra', 'https://medio.example/a.jpg'),
    nota('GARITA DE SAN YSIDRO CIERRA', 'https://medio.example/b.jpg'),
    nota('Sin imagen'),
    nota('   ', 'https://medio.example/vacio.jpg'),
  ]);
  assert.equal(indice.size, 1, 'una por titular plegado; el titulo vacio no entra');
  assert.equal(imagenPara(fila('garita de san ysidro cierra'), indice), 'https://medio.example/a.jpg', 'gana la primera del archivo');
  assert.equal(imagenPara(fila('Sin imagen'), indice), null, 'una nota sin imagen no toma la de otra');
  assert.equal(imagenPara(fila('Otro titular'), indice), null);

  // --- og:image: la imagen que el propio medio declara en su pagina ---------
  // Lo que el cruce con el corpus no alcanza (de 503 notas llegadas por
  // busqueda, cero recuperan miniatura) lo cubre esto. Puro: HTML entra, una
  // URL sale o null. No pide nada.
  const BASE = 'https://medio.example/nota';
  const cabeza = (metas) => `<html><head>${metas}</head><body><img src="https://medio.example/cuerpo.jpg"></body></html>`;

  assert.equal(
    imagenDeHtml(cabeza('<meta property="og:image" content="https://cdn.example/a.jpg">'), BASE),
    'https://cdn.example/a.jpg',
    'og:image en un CDN ajeno SE ACEPTA: es la que el medio declaro para su nota',
  );
  assert.equal(
    imagenDeHtml(cabeza('<meta content="https://cdn.example/b.jpg" name="twitter:image">'), BASE),
    'https://cdn.example/b.jpg',
    'twitter:image, y con los atributos al reves',
  );
  assert.equal(
    imagenDeHtml(cabeza('<meta property="og:image" content="https://cdn.example/og.jpg"><meta name="twitter:image" content="https://cdn.example/tw.jpg">'), BASE),
    'https://cdn.example/og.jpg',
    'og gana a twitter',
  );
  assert.equal(
    imagenDeHtml(cabeza("<meta property='og:image' content='/img/rel.jpg'>"), BASE),
    'https://medio.example/img/rel.jpg',
    'una relativa se resuelve contra la pagina',
  );
  assert.equal(
    imagenDeHtml(cabeza('<meta property="og:image" content="https://cdn.example/a.jpg?w=1&amp;h=2">'), BASE),
    'https://cdn.example/a.jpg?w=1&h=2',
    '&amp; en los parametros del CDN se decodifica',
  );
  assert.equal(imagenDeHtml(cabeza(''), BASE), null, 'sin meta no se inventa nada');
  assert.equal(
    imagenDeHtml(cabeza('<meta property="og:image" content="http://cdn.example/a.jpg">'), BASE),
    null,
    'http no: el navegador lo bloquea en una pagina https',
  );
  assert.equal(
    imagenDeHtml(cabeza('<meta property="og:image" content="data:image/png;base64,AAAA">'), BASE),
    null,
    'un data: seria COPIAR la imagen en vez de enlazarla',
  );
  assert.equal(
    imagenDeHtml(cabeza(`<meta property="og:image" content="https://cdn.example/${'a'.repeat(600)}.jpg">`), BASE),
    null,
    'mismo tope de largo que el pipeline',
  );
  assert.equal(
    imagenDeHtml('<html><head><meta property="og:image" content="https://cdn.example/a.jpg">', BASE),
    'https://cdn.example/a.jpg',
    'un <head> truncado a media etiqueta no rompe',
  );
  // El cuerpo no se mira: ahi viven las fotos de stock y las de OTRO medio,
  // que es justo el caso que normalizar.py::imagen_del_medio existe para tirar.
  assert.equal(
    imagenDeHtml('<html><head></head><body><meta property="og:image" content="https://cdn.example/cuerpo.jpg"></body></html>', BASE),
    null,
    'un og:image fuera del <head> no cuenta',
  );

  // --- notas relacionadas: por rareza, contra el archivo ya descargado -----
  // No hay lista de palabras vacias a proposito: la rareza hace ese trabajo
  // sola y con el corpus de hoy. Lo que se fija aqui es que de verdad la haga.
  const rel = (titulo, extra = {}) => ({
    id: 'id-' + plegarLocal(titulo).replace(/ /g, '-').slice(0, 24),
    titulo, url: 'https://medio.example/' + encodeURIComponent(titulo),
    dominio: 'medio.example', fuente: 'medio', zona_medio: 'Tijuana', zonas: [],
    alcance: 'zona', fecha: '2026-09-10', publicado: null,
    capturado: '2026-09-10T00:00:00Z', figuras: [], postura: null, ...extra,
  });
  const plegarLocal = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  assert.deepEqual(terminos('Grito en Tijuana, 2026'), ['grito', 'tijuana'],
    'menos de 4 letras fuera, y un año no es un tema');

  // A escala de archivo de verdad: la rareza es una PROPORCION, asi que con
  // cuarenta notas «2 de 40» no es raro y con quinientas si. Un fixture chico
  // probaria un regimen que el producto nunca ve.
  // «tijuana» y «gobierno» salen en casi todo el archivo; «pirotecnia» no.
  const relleno = Array.from({ length: 500 }, (_, i) =>
    rel('Gobierno de Tijuana anuncia obra numero ' + (i + 1)));
  const indiceRel = indiceDeRelacionadas([
    ...relleno,
    rel('Pirotecnia ilumina el cielo de Tijuana en el Grito'),
    rel('Aseguran pirotecnia clandestina en una bodega de Tijuana'),
    rel('Gobierno de Tijuana repavimenta la Vía Rápida'),
  ]);

  const hallados = relacionadasPara('Pirotecnia deja tres heridos en Tijuana', indiceRel);
  assert.ok(hallados.length >= 2, 'dos notas comparten un término raro');
  assert.ok(hallados.every((n) => /Pirotecnia/i.test(n.titulo)),
    'gana el término raro, no «tijuana», que está en todas');

  // Dos términos comunes compartidos no bastan: es la forma más fácil de que
  // un panel de relacionadas mienta con cara de acierto.
  assert.deepEqual(relacionadasPara('Gobierno de Tijuana presenta su informe', indiceRel), [],
    'sin ningún término raro en común no hay relación');

  // La misma nota no es una nota relacionada.
  const mismos = relacionadasPara('Pirotecnia ilumina el cielo de Tijuana en el Grito', indiceRel);
  assert.ok(!mismos.some((n) => plegarLocal(n.titulo) === plegarLocal('Pirotecnia ilumina el cielo de Tijuana en el Grito')),
    'se descarta por titular plegado, la misma llave que imagenes.ts');

  // `fuera` es lo que el gacetero marcó como ajeno a la región: el caso de
  // El Imparcial y Hermosillo. No se relaciona.
  const conFuera = indiceDeRelacionadas([
    ...relleno,
    rel('Pirotecnia asegurada en Hermosillo', { alcance: 'fuera' }),
    rel('Pirotecnia asegurada en Tijuana'),
  ]);
  const sinFuera = relacionadasPara('Aseguran pirotecnia en un domicilio', conFuera);
  assert.ok(!sinFuera.some((n) => /Hermosillo/.test(n.titulo)), 'una nota «fuera» no se relaciona');

  // Archivo vacío y titular sin términos: ni error ni invención.
  assert.deepEqual(relacionadasPara('Lo que sea', indiceDeRelacionadas([])), []);
  assert.deepEqual(relacionadasPara('un no si', indiceRel), [],
    'sin dos términos propios no hay con qué comparar');

  // Determinista: el mismo archivo da el mismo orden.
  assert.deepEqual(
    relacionadasPara('Pirotecnia deja tres heridos en Tijuana', indiceRel).map((n) => n.id),
    relacionadasPara('Pirotecnia deja tres heridos en Tijuana', indiceRel).map((n) => n.id));

  console.log('Capítulos: 8 capítulos (9 en Tecate), orden, tema, repetidos, fallos, activación, imágenes, og:image y relacionadas verificados offline.');
}

comprobar();
