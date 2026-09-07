# Contratos de datos

Este documento **describe**; `pulso/validador.py` **manda**. Si los dos no
coinciden, el validador tiene razón y este archivo está viejo.

No hay carpeta `esquema/` con JSON Schema por dos razones. La primera es que
la biblioteca estándar de Python no trae validador, así que serían archivos
sin fuerza que se desfasan en silencio. La segunda es que las tres reglas que
de verdad importan aquí son de campos cruzados y JSON Schema no expresa
ninguna:

- que dos figuras no compartan un título de cargo con vigencias traslapadas,
- que el `id` de una nota siga siendo el hash de su `(fuente, título)`,
- que las figuras y fuentes que cita una nota existan en `config/`.

Correr `python -m pulso validar` es la forma de comprobar todo esto.

---

## `config/roster.json`

Entrada mantenida a mano. Es el componente de primera clase del sistema: los
cargos cambian a media administración y la atribución depende de la fecha de
la nota, no de quién gobierna hoy.

```json
{
 "verificado": "2026-09-03",
 "figuras": [
  {
   "id": "agc",
   "nombre": "Abdiel Gutiérrez Coronado",
   "cargo": "Presidente municipal de Tijuana",
   "partido": "Morena",
   "ambito": "Tijuana",
   "desde": "2026-06-21",
   "hasta": null,
   "alias": ["Abdiel Gutiérrez", "Gutiérrez Coronado"],
   "alias_cargo": ["alcalde de Tijuana", "presidente municipal de Tijuana"]
  }
 ]
}
```

| Campo | Regla |
|---|---|
| `id` | `^[a-z0-9_]{2,12}$`, único |
| `nombre` `cargo` `partido` | texto no vacío |
| `ambito` | uno de los de `pulso.ZONAS` |
| `desde` | `YYYY-MM-DD` |
| `hasta` | `null` si sigue en funciones, o una fecha **posterior** a `desde` |
| `alias` | nombres propios. **No** dependen de la fecha |
| `alias_cargo` | títulos del puesto. **Sí** dependen de la fecha |

### La ventana es semiabierta

`[desde, hasta)`: **`hasta` es exclusivo**. El día del relevo ya cuenta para
quien entra. Burgueño con `hasta: 2026-06-21` y Gutiérrez con
`desde: 2026-06-21` no se traslapan, y el 21 de junio resuelve a Gutiérrez,
que tomó el cargo a las 00:00 de ese día.

Mover cualquiera de las dos fechas un día produce un traslape y el validador
lo rechaza nombrando a las dos figuras y el alias en conflicto. Es la regla
que impide atribuirle a un alcalde la cobertura de otro.

### Por qué `alias` y `alias_cargo` están separados

Si el titular dice **Burgueño**, la nota habla de Burgueño aunque ya no
gobierne: el nombre propio no se desempata por fecha. Si dice solo **alcalde
de Tijuana**, hay que resolver quién lo era ese día.

El prototipo distinguía los dos casos buscando subcadenas (`"alcalde" in
clave`) y esa lista omitía `presidenta municipal`, con lo que las cuatro
alcaldesas del roster se resolvían sin importar la fecha. Ahora la distinción
está en los datos.

Cuando una nota nombra a la figura **y** menciona su cargo, gana el nombre
propio y la figura aparece una sola vez, con `via: "nominal"`.

### Reglas cruzadas

- Un mismo alias nominal no puede pertenecer a dos figuras. Dos personas con
  el mismo nombre no se desempatan por fecha, así que es un error de datos.
- Dos figuras no pueden compartir un `alias_cargo` con vigencias traslapadas.
- **Aviso**, no error: si un `ambito` no tiene figura vigente hoy, el roster
  probablemente está vencido.

---

## `config/medios.json`

Catálogo de fuentes. `zona` es la cobertura principal del medio y agrupa el
muro; no es la zona de cada nota. `tipo` admite `rss` (omisión) o `scrapy`.
`idioma` admite `es` u `en`.

```json
{"medios": [
    {"id": "zeta", "nombre": "Zeta Tijuana", "url": "https://zetatijuana.com/feed/",
     "zona": "Tijuana", "tipo": "rss", "activo": true},
    {"id": "elvigia", "nombre": "El Vigía", "url": "https://www.elvigia.net/",
     "zona": "Ensenada", "tipo": "scrapy", "activo": true,
     "scrapy": {"item": "article", "titulo": "h2.titulo a::text",
                "url": "h2.titulo a::attr(href)"}}
]}
```

`id` único y con el mismo formato que en el roster, `url` con esquema
`http://` o `https://`, `zona` de `pulso.ZONAS`, `activo` booleano e `idioma`
`es` u `en`. Una fuente Scrapy exige selectores `item`, `titulo` y `url`; solo
se lee esa portada, respetando robots.txt y sin copiar el cuerpo. Para apagar
un medio sin perder su registro, `"activo": false`: no se consulta y no se le
exige registro de salud.

Las URL vienen del prototipo y **están sin verificar una por una**. Se espera
que alguna falle en la primera corrida en vivo; eso aparece en
`data/fuentes.json` y no tumba el pipeline.

#### `idioma` decide con qué modelo se etiqueta el tono

Los cuatro medios de San Diego (KPBS, Voice of San Diego, Times of San Diego,
inewsource) publican en inglés; los otros dieciséis, en español. El modelo de
tono es `pysentimiento/robertuito-sentiment-analysis`, afinado sobre tuits en
español, y `pulso/sentimiento.py` fijaba `lang="es"` sin mirar la fuente.

Resultado: **98 de las 888 notas del corte** —una de cada nueve— llevaban un
tono calculado por un modelo español sobre texto en inglés. Un modelo así no
devuelve error: devuelve una etiqueta plausible, y mirando la salida no se
distingue de un acierto. El caso testigo, con la etiqueta que le puso:
«Legislative Recap: A Final Tally on How San Diego Lawmakers Performed» →
`neutral`.

Ahora una nota de un idioma que el analizador no habla se queda con
`postura: null` en vez de recibir una etiqueta inventada, y el conteo se
publica en `estado.json` como `notas_sin_modelo_idioma`. El idioma **no se
adivina del texto**: adivinar falla justo en los titulares cortos y con
nombres propios, que son casi todos. Lo declara el catálogo.

### `config/delegaciones-tijuana.json`

Es el snapshot versionado del directorio oficial de IMPLAN. La página declara
792 colonias pero el HTML enumera 791; el corte conserva esa discrepancia y no
inventa una entrada. Cada colonia es `contextual` por defecto; solo los alias
revisados aparecen como `alias_directos`, y los nombres repetidos entre
delegaciones quedan `omitido`. `python -m pulso delegaciones --actualizar`
refresca el directorio y regenera el asset SVG del mapa 2014 de ArcGIS.

---

## `data/notas.json` — la ventana reciente

Salida del pipeline. La escribe el bot; no se edita a mano.

**Esto es una ventana, no el histórico.** Trae los últimos `ventana_dias`
(30 por omisión); lo más viejo vive en `data/archivo/`. Antes crecía sin
límite: 561 bytes por nota y unas 200 notas nuevas al día son ~35 MB al año,
y el tablero se los bajaba todos en cada visita. Con la ventana el pico son
~3.2 MB en crudo, que el servidor manda como ~470 KB con brotli.

```json
{
 "esquema": 1,
 "ventana_dias": 30,
 "total": 1,
 "notas": [
  {
   "id": "f3b5926f167287d9",
   "titulo": "Tijuana estrena alcalde: Abdiel Gutiérrez toma protesta tras licencia de Burgueño",
   "url": "https://bajanews.mx/...",
   "dominio": "bajanews.mx",
   "fuente": "bajanews",
   "zona": "Tijuana",
   "fecha": "2026-06-21",
   "publicado": "2026-06-21T09:12:00-07:00",
   "capturado": "2026-09-03T18:00:00+00:00",
   "figuras": [
    {"id": "agc", "via": "nominal", "clave": "abdiel gutierrez"},
    {"id": "ibr", "via": "nominal", "clave": "burgueno"}
   ],
   "postura": null
  }
 ]
}
```

| Campo | Notas |
|---|---|
| `id` | `sha256("<fuente>|<título plegado>")[:16]`. Se **recalcula** en cada validación |
| `fuente` | `id` de un medio del catálogo |
| `origen`, `descubierta_por` | opcionales: `descubrimiento_web` y `gdelt`; nunca contienen el cuerpo del artículo |
| `zona_medio` | cobertura declarada del medio; tiene que coincidir con el catálogo |
| `zonas` | zonas de las que **habla la nota**. Puede traer varias, o ninguna |
| `delegaciones` | delegaciones de Tijuana que nombra el **titular**. Solo trae algo si `zonas` incluye Tijuana |
| `alcance` | `zona`, `estatal`, `nacional` o `fuera` |
| `fecha` | día en el huso del medio, o `null` si el feed no trajo fecha usable |
| `publicado` | ISO-8601 con offset, o `null` |
| `capturado` | cuándo lo vio el pipeline por primera vez. **Se conserva** entre corridas |
| `figuras` | `via` es `nominal` o `cargo`; `clave` es el alias plegado que empató |
| `postura` | `null`, o `{etiqueta, puntaje, metodo, version}` |

### `zona_medio` no es `zonas`, y la diferencia importa

`zona_medio` es de quién viene la nota. `zonas` es de qué habla. Confundirlas
fue un error real: el feed de El Imparcial trae al grupo entero y la mayoría
de sus notas son de Hermosillo y Ciudad Obregón. En la primera corrida de 504
notas, confiar en la zona del medio puso `hermosillo` y `sonora` como temas
principales de un tablero de Baja California.

La regla que sale de ahí, implementada en `pulso/zonas.py`:

- Medio de una zona (`zona_medio != "estatal"`): se le cree su zona si la
  nota no nombra otra. Tecate Noticias hablando de algo sin decir «Tecate»
  sigue siendo evidencia de Tecate.
- Cable o grupo (`zona_medio == "estatal"`): tiene que **nombrar** el lugar.
  Si no, no se le asigna zona.

`alcance` reparte las notas en cuatro cajones. Solo `fuera` se excluye de los
temas y del muro; `nacional` se conserva porque una decisión federal sí pega
en la región, pero no se le inventa una zona.

Una nota puede contar en **varias** zonas a la vez: una nota de la garita es
de Tijuana y de San Diego, y aparece en las dos. Por eso la suma de
`por_zona` es mayor que `notas_total`.

### `delegaciones`: solo Tijuana, solo el titular

Tijuana es la única zona con subdivisión. `delegaciones` trae las
delegaciones (lista de `pulso.DELEGACIONES_TIJUANA`: Centro, Cerro Colorado,
La Mesa, La Presa A.L.R., La Presa Este, Otay Centenario, Playas de Tijuana,
San Antonio de los Buenos y Sánchez Taboada) que el **titular** nombra, ya
sea por su nombre o por un lugar inequívoco dentro de ella (la garita de
Otay, el aeropuerto, Zona Río, El Chaparral). Reglas:

- Solo se llena si `zonas` incluye Tijuana. El gazetero de delegaciones no
  re-zonifica: «zona centro» también existe en Mexicali y Ensenada.
- Empata por frase completa, no por subcadena: «playas» a secas es Playas de
  Rosarito y «natura» está dentro de «gubernatura».
- Los términos ambiguos quedan fuera a propósito (El Pípila existe en dos
  delegaciones; «zona norte» a secas es la liga de béisbol).

Cerca del 8 % de las notas de Tijuana nombra una delegación; el resto trae
la lista vacía y el tablero lo rotula como «sin delegación identificada».
Ningún indicador oficial (SHF, SESNSP, ENSU, predial) baja de municipio, así
que la delegación es una faceta del muro de prensa y nada más. Se recalcula
en cada corrida, igual que `zonas`. Los cortes anteriores al campo no traen
la clave: el validador lo avisa, no lo rechaza.

`etiqueta` es `favorable`, `neutral` o `adversa`; `metodo` nunca es
`ninguno` (si el paso está apagado, `postura` es `null` y no un objeto).

### `postura` tiene dos formas

```json
{"etiqueta": "adversa", "puntaje": -2, "metodo": "diccionario", "version": "0.2.0"}
{"etiqueta": "adversa", "confianza": 0.9713, "metodo": "modelo",
 "modelo": "pysentimiento/robertuito-sentiment-analysis", "version": "0.2.0"}
```

Con `diccionario`, `puntaje` es entero. Con `modelo`, `confianza` es la
probabilidad de la etiqueta ganadora (0 a 1) y `modelo` dice qué modelo fue:
`clasificar_lote()` conserva la etiqueta si el modelo coincide y reclasifica
solo lo demás, porque el id de la nota es el hash de su título y la etiqueta
es estable. Es **tono del titular**, no postura hacia una persona; el tablero
lo rotula así y no lo cruza con `figuras`.

### Dos propiedades que hay que no romper

**No lleva marca de tiempo de corrida.** El archivo solo tiene `esquema`,
`total` y `notas`. Si tuviera un `generado`, cada corrida del cron produciría
un commit aunque no hubiera notas nuevas, y el guarda `git diff --quiet` del
workflow dejaría de servir.

**La identidad es estable y las notas se fusionan por ella.** El mismo titular
republicado en mayúsculas no es una nota nueva. `capturado` se conserva de la
primera vez, así que volver a correr no reescribe la historia.

`figuras` y `postura` se **recalculan en cada corrida**. Editar el roster o
cambiar de clasificador se propaga a todo el histórico sin migración.

La deduplicación es **por medio**. Dos medios que publican el mismo titular
son dos notas: cruzarlos necesita *shingles* y es de la Fase 1.

---

## `data/archivo/` — el histórico

```
data/archivo/notas-AAAA-MM.json   registros completos, uno por mes
data/archivo/indice.json          qué meses existen, cuántas notas y qué rango cubren
```

Los meses traen **exactamente el mismo esquema de nota** que la ventana, más
un campo `mes`. Recortar campos en la ventana ahorraría un 20% y costaría dos
caminos en el validador y una bifurcación en este documento; no vale la pena.

Una nota sale de la ventana cuando su `fecha` queda fuera de la retención, y
se agrega al mes que le toca en la misma corrida. El corte es **inclusivo**:
una nota de exactamente `ventana_dias` se queda. Una nota **sin fecha usable**
o **con fecha futura** (feed mal fechado) se queda también, porque no hay mes
al que mandarla.

Tres decisiones que conviene entender antes de tocar `pulso/archivo.py`:

**Se relee y se re-resuelve todo en cada corrida**, ventana y archivos. Es lo
que sostiene la propiedad de que editar el roster o el gazetero se propaga al
histórico sin migración.

**Solo se escribe el archivo que cambió.** Sin eso, re-resolver todo
reescribiría cada mes en cada corrida y el repo se llenaría de commits que no
cambian nada. `_escribir_si_cambio()` compara los bytes que va a escribir
contra los que ya están.

**`hoy` sale de `ahora`, no de `date.today()`.** Antes daba igual; ahora
decide qué se archiva, y con el reloj del sistema la misma entrada daría
particiones distintas según el día en que se corriera.

Reglas que verifica el validador: ningún id en dos archivos a la vez, el
índice y el disco coinciden en los dos sentidos, cada nota está en el mes que
le corresponde, los totales cuadran, y nada más viejo que la retención (más un
día de gracia) se quedó en la ventana. Ese último es el síntoma de que la
ventana dejó de recortarse.

## `data/fuentes.json`

Salud por fuente. Es lo que leerá la alarma de feed muerto por 24 h.

```json
{
 "esquema": 1,
 "generado": "2026-09-03T18:00:00+00:00",
 "fuentes": [
    {"id": "zeta", "nombre": "Zeta Tijuana", "url": "https://zetatijuana.com/feed/",
     "metodo": "rss", "estado": "ok", "obtenidas": 20, "nuevas": 3, "ms": 812,
   "ultima_ok": "2026-09-03T18:00:00+00:00", "error": null},
  {"id": "afn", "nombre": "AFN Tijuana", "url": "https://afntijuana.info/lo-ultimo.php",
   "metodo": "scrapy", "estado": "ok", "obtenidas": 30, "nuevas": 2, "ms": 640,
   "ultima_ok": "2026-09-03T18:00:00+00:00", "error": null}
]}
```

`estado` es `ok` o `fallo`. Un `fallo` **exige** `error` con el motivo; un
`ok` no puede traerlo. Cada medio activo tiene que tener su registro. `zona`
es la cobertura declarada del medio (la misma de `config/medios.json`, que no
se publica), para que la página de cada zona pueda listar qué medios la
cubren; es opcional y, si viene, tiene que ser de `pulso.ZONAS`.

`ultima_ok` **se arrastra** de la corrida anterior cuando la fuente falla: sin
eso no se puede saber cuánto lleva caída, que es justo lo que dispara la
alarma.

El registro adicional `id: "descubrimiento-web"`, cuando se activa
`--descubrimiento-web`, usa `metodo: "descubrimiento"` y detalla candidatos,
páginas visitadas, aceptadas, rechazos, exclusiones de robots y fallos. GDELT
solo se usa para descubrir URLs transitorias; el publisher aporta el titular,
dominio y fecha que sí se persisten.

---

## `data/temas.json`

Temas del periodo con momento contra el periodo anterior. Sale de contar
n-gramas por documento sobre los titulares, sin modelo y sin API.

```json
{
 "origen": "prensa",
 "generado": "2026-09-03",
 "ventana_dias": 7,
 "minimo": 3,
 "notas_ventana": 406,
 "notas_previas": 11,
 "temas": [
  {
   "termino": "agua potable",
   "n": 11,
   "n_previo": 4,
   "momento": 7,
   "zonas": {"Tijuana": 6, "Mexicali": 3, "Ensenada": 2},
   "fuentes": {"zeta": 5, "lavoz": 4, "soltij": 2},
   "un_solo_medio": false,
   "notas": ["a3f9c2e1b7d04e55"],
   "ejemplos": ["Escasez de agua potable en la zona este"]
  }
 ],
 "descartados": [{"termino": "agua", "n": 11, "porque": "duplica «agua potable»"}]
}
```

Tres reglas que el módulo impone, no sugiere:

1. **Conteos, nunca porcentajes.** Con seis notas al día un porcentaje se
   mueve con dos comentarios.
2. **Prensa y comentarios nunca se mezclan.** La prensa sale neutra porque
   informa; los comentarios salen adversos porque opinan, y la brecha entre
   los dos es la señal. `origen` dice de cuál se trata y hay un archivo por
   origen.
3. **Nada por debajo de `minimo`.** Lo que no llega queda en `descartados`
   con el motivo, para poder auditar por qué no salió.

Detalles que evitan resultados falsos:

- **Frecuencia por documento, no por término.** Un titular que repite una
  palabra cuatro veces cuenta una vez; si no, un solo texto largo inventa un
  tema.
- **Los nombres de lugar no son temas.** Se filtran, porque son la faceta
  `zonas`. La lista está escrita a mano y no derivada del gazetero: partir
  las frases del gazetero en palabras tiraba `agua` (por «Agua Prieta»,
  Sonora) y `presa` (por «La Presa», Tijuana), o sea el tema más importante
  de Baja California y su principal infraestructura.
- **Etiquetas colapsadas.** `agua`, `agua potable` y `escasez agua potable`
  cubren las mismas notas: es un tema, no tres. Sobrevive la más específica.
- **`un_solo_medio`** marca un tema sostenido por una sola fuente. Es la
  agenda de ese medio, no un tema de la región. Se publica, rotulado.
- **`momento` no se muestra sin historia.** Un feed RSS solo trae lo
  reciente, así que en la primera corrida la ventana anterior está casi
  vacía y todo saldría como «subiendo». El tablero lo oculta hasta que haya
  dos ventanas comparables.

### `por_zona`: los temas de cada zona

```json
"por_zona": {
 "Ensenada": {"notas_ventana": 56, "minimo": 2, "temas": [ ... ]}
}
```

Un bloque por zona con notas en la ventana; las zonas sin notas **no
aparecen** (clave ausente, no lista vacía). Cada bloque corre `temas()` solo
sobre las notas que mencionan la zona, así que una nota de la garita cuenta en
Tijuana y en San Diego. El `minimo` baja a 2 en zonas con menos de 100 notas:
con catorce notas a la semana nada llega a 3 y el bloque saldría vacío, que se
lee como «aquí no pasa nada». El mínimo usado se publica para que el tablero
lo diga.

## `data/indicadores.json`

Cifras oficiales **leídas, no calculadas**. Lo escribe `python -m pulso
indicadores`, que se salta solo si lo que hay tiene menos de una semana, así
que el archivo puede faltar sin que sea un error.

```json
{
 "esquema": 1,
 "generado": "2026-09-04T00:55:26+00:00",
 "indicadores": {"shf": {}, "predial": {}, "sesnsp": {}, "ensu": {}, "san_diego": {}},
 "salud": [{"id": "shf", "estado": "ok", "ms": 812, "error": null, "periodo": "2026-2T"}]
}
```

Cada fuente comparte cinco campos obligatorios y uno opcional:

| Campo | Regla |
|---|---|
| `fuente` | texto no vacío: quién publica el dato |
| `url` | de dónde se bajó |
| `cadencia` | `trimestral`, `anual`, `mensual` |
| `familia` | `vivienda`, `suelo`, `crimen` o `percepcion` |
| `aviso` | **obligatorio**: qué NO dice la cifra |
| `obtenido` | ISO-8601, si está |

`aviso` es obligatorio en el validador y no por prolijidad. Ninguna de estas
cifras la calcula el tablero y cada una mide algo distinto: el SHF es un índice
rebaseado por serie, el predial es recaudación y no valuación, el SESNSP son
delitos reportados y no ocurridos, el SANDAG es valor catastral congelado por
la Proposición 13. Una cifra sin rótulo se lee como lo que no es, y confundirlas
es el error fácil. Ver [PRODUCT.md](../PRODUCT.md).

### `serie`: la historia, no solo el último punto

`shf.series[*]` y `predial.municipios[*]` traen la serie completa:

```json
"Baja California · Tijuana": {
 "ambito": "municipio",
 "periodo": "2026-2T",
 "indice": 248.66,
 "variacion_anual_pct": 8.64,
 "trimestres": 86,
 "serie": [{"periodo": "2005-1T", "indice": 53.14},
           {"periodo": "2026-2T", "indice": 248.66}]
}
```

En predial cada punto lleva `{ciclo, por_cuenta_mxn, cuentas_pagadas}`.

Cuatro reglas que el validador impone:

- **La serie va ordenada** por `periodo` (SHF) o `ciclo` (predial). No es
  cosmético: la serie se reescribe en cada corrida y el guarda del cron es
  `git diff --cached --quiet`. Si el orden variara, cada corrida commitearía el
  mismo dato reacomodado.
- **`len(serie)` cuadra con el conteo** (`trimestres`, `ciclos`).
- **El último punto es `periodo`**, no un punto intermedio.
- **El año va explícito en cada punto**, nunca implícito en la posición. San
  Felipe y San Quintín son municipios nuevos y sus series arrancan en 2021 y
  2020, no en 2010 como las otras cinco.

Que `serie` **falte** es aviso, no error: los cortes escritos antes de que
existiera el campo no la traen y se llena con `python -m pulso indicadores
--forzar`. Que esté pero mal formada sí es error.

### Los huecos se declaran

`shf.sin_cobertura` lista los cinco municipios que el índice no trae y
`ensu.cobertura` dice que la encuesta nunca los ha muestreado. Son campos de
datos, no comentarios: el tablero los lee para rotular «sin dato» y «fuera de
muestra» en vez de pintar un cero.

## `data/conversacion.json`

Métricas **derivadas** de comentarios de YouTube. El texto de los comentarios
no está aquí, y no por descuido.

```json
{
 "esquema": 1,
 "generado": "2026-09-03T18:00:00+00:00",
 "aviso": "Metricas derivadas. El texto de los comentarios NO se almacena...",
 "retencion_dias": 30,
 "comentarios_vigentes": 1840,
   "por_zona": {"Tijuana": 900, "Mexicali": 420, "nacional": 300},
   "por_tema": [
    {"tema": "agua potable", "comentarios": 84, "videos": 2,
     "interacciones": 190, "preguntas": 12,
     "zonas": {"Tijuana": 84},
     "subtemas": [{"termino": "falta de agua", "n": 21}]}
   ],
 "por_canal": {"siempre_yt": 700, "uniradio_yt": 500},
 "por_figura": {"agc": 45, "mpao": 30},
 "temas": [{"termino": "agua potable", "n": 32, "momento": 8, "zonas": {"Tijuana": 20}}],
 "canales": [{"id": "uniradio_yt", "estado": "ok", "videos": 8, "comentarios": 500}],
 "cuentas": {"presupuesto": {"gastado": 258, "tope": 8500}, "cache": {"retencion_dias": 30}}
}
```

### Por qué el texto no se commitea

Las Políticas para Desarrolladores de YouTube, sección III.E.4.d, limitan el
almacenamiento de datos no autorizados (lo que devuelve una llave de API sobre
contenido público) a **30 días naturales**, tras los cuales hay que borrarlos
o refrescarlos. Además obligan a mantener los datos consistentes con YouTube,
o sea a propagar borrados y ediciones.

Un repo de git no puede cumplir eso: lo commiteado vive en cada clon y en cada
commit anterior, así que «borrar en 30 días» es imposible una vez que entró al
historial. De ahí la separación:

| Dónde | Qué | Git |
|---|---|---|
| `cache/comentarios/AAAA-MM-DD.json` | texto crudo | **ignorado**, TTL de 30 días |
| `data/conversacion.json` | conteos y temas calculados | commiteado |

`purgar()` corre en cada cosecha y borra los archivos con más de 30 días.
`derivar()` produce lo único que se publica, y quita explícitamente los
`ejemplos` de los temas porque son texto literal. Tampoco se guarda el autor,
su canal ni su foto: no hace falta para medir conversación y es dato personal
de terceros.

### Sentimiento: la etiqueta se queda en el cache, el conteo se publica

Con `--sentimiento modelo`, `clasificar_cache()` agrega a cada registro del
cache un campo `sentimiento` (`{"etiqueta": "NEG", "confianza": 0.97,
"modelo": "..."}`) que vive los mismos 30 días que el texto. A
`conversacion.json` llegan solo conteos:

```json
"sentimiento": {"metodo": "modelo", "modelo": "pysentimiento/robertuito-sentiment-analysis",
                "positivo": 41, "negativo": 97, "neutral": 52, "sin_clasificar": 4},
"por_zona_detalle": {
 "Tijuana": {"comentarios": 150, "interacciones": 420, "preguntas": 6,
             "sentimiento": {"positivo": 30, "negativo": 80, "neutral": 40},
             "por_tema": [{"tema": "agua", "comentarios": 65,
                           "sentimiento": {"positivo": 5, "negativo": 45, "neutral": 15}}]}
}
```

`positivo + negativo + neutral + sin_clasificar` tiene que dar
`comentarios_vigentes`, y `por_zona_detalle[z].comentarios` tiene que
coincidir con `por_zona[z]`; el validador lo comprueba. `por_tema[]` también
lleva `sentimiento`. Ninguna clave llamada `texto`, `ejemplos`, `notas`,
`autor` o `video_titulo` puede aparecer a ninguna profundidad; el validador
recorre el archivo entero buscándolas.

Hay una excepción para desarrolladores auditados (política de métricas
derivadas, vigente desde el 1 de junio de 2026) que permite guardar métricas
36 meses, pero **el contenido cualitativo, o sea títulos y texto de
comentarios, sigue bajo la regla de 30 días incluso auditado**. El corpus
crudo no se archiva nunca.

Las mismas políticas (III.E.2.a) restringen **agregar** datos de canales de
distintos dueños. Un tablero que suma comentarios de varios medios roza esa
línea. Conviene la opinión de un abogado antes de publicar este panel, y por
eso el paso viene apagado detrás de `YOUTUBE_HABILITADO`.

### En GitHub Actions

El cache es efímero por corrida, así que sin persistirlo la ventana de 30 días
no existiría: cada corrida derivaría solo de sí misma. Se persiste con
`actions/cache`, que no es git, caduca solo y es privado del repo.

## `config/canales.json`

Lista **fija** de canales de YouTube. No se descubren canales con
`search.list`: tiene cubeta de cuota propia con tope de 100 llamadas al día, y
meterla en un bucle por video agota el día en 100 videos.

El archivo tiene dos secciones. `canales` son los que se leen. `senuelos` son
canales que **no** hay que usar y por qué, porque varios handles obvios
resuelven a canales muertos y devolverían vacío en silencio:

- `@UniradioInforma` → 110 subs, última subida en 2016. El handle vivo es
  `@uniradiobaja`.
- `@afntijuana` → 2 videos, nada desde 2007.
- `EL IMPARCIAL TV` → 190K subs y sube a diario, pero de 15 subidas
  revisadas 7 mencionan Sonora, 5 Hermosillo y ninguna una ciudad de BC. Es
  el canal insignia de Sonora, y el único lo bastante grande para torcer el
  tablero entero, igual que su feed RSS.

## `data/estado.json`

Resumen de la corrida. Es lo que pinta la banda del tablero.

```json
{
 "esquema": 1,
 "pulso_version": "0.2.0",
 "generado": "2026-09-03T18:00:00+00:00",
 "modo": "red",
 "metodo_postura": "ninguno",
 "commit": "79ba601",
 "corrida": "https://github.com/arturoreyes-ai/pulso-n33/actions/runs/123456",
 "fuentes_ok": 15,
 "fuentes_fallo": 0,
 "notas_total": 513,
 "notas_nuevas": 7,
 "notas_region": 485,
 "notas_sin_modelo_idioma": 98,
 "por_zona": {"Tijuana": 125, "Mexicali": 99, "San Diego": 88, "San Quintín": 1},
 "por_alcance": {"zona": 351, "nacional": 107, "estatal": 27, "fuera": 28},
 "roster_figuras": 9,
 "roster_vigentes": 8
}
```

`por_zona` suma más que `notas_total` porque una nota puede contar en varias
zonas. `notas_region` es `notas_total` menos las de alcance `fuera`.

`notas_sin_modelo_idioma` son las notas que quedaron sin `postura` porque no
hay modelo de su idioma, no porque el paso esté apagado: con
`metodo_postura: ninguno` vale 0, porque entonces ninguna se saltó **por
idioma**. Ver `config/medios.json`.

`modo` es `red` o `corpus`. `metodo_postura` es `ninguno`, `diccionario` o `modelo`.
`commit` y `corrida` salen de las variables de GitHub Actions y son `null` en
local. `pulso_version` tiene que coincidir con el paquete: si no, los datos
los escribió otra versión y hay que volver a correr.

---

## Notas de escritura

Los tres archivos se escriben con `ensure_ascii=False` (acentos literales,
para que el diff se lea), `indent=1`, `newline="\n"` y salto de línea final.
`.gitattributes` fuerza LF en todo el repo: sin eso, un commit desde Windows
y otro del bot en Ubuntu pelean por los saltos de línea y el guarda
`git diff --quiet` deja de detectar "sin cambios".
