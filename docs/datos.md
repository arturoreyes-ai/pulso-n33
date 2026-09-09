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

## `config/busquedas.json`

Consultas permanentes contra el RSS de búsqueda de Google Noticias. Se
cosechan en la misma corrida del cron que los feeds del catálogo: no hay verbo
ni cron nuevos, y el archivo es **opcional** (sin él, el pipeline se comporta
igual que antes de que existiera).

Existe porque el catálogo solo se entera de una nota cuando el medio la publica
en su propio feed, y hay municipios donde ese feed no existe. San Quintín es el
caso declarado: su renglón en `medios.json` es «registro deliberado de un
hueco, no un medio».

| Campo | Notas |
|---|---|
| `id` | `^bq_[a-z0-9_]{2,20}$`. **No** es `RE_ID`: doce caracteres no alcanzan para nombrar una consulta, y el prefijo evita que choque con un medio en `data/fuentes[].id` |
| `q` | la consulta tal cual se escribiría en news.google.com. Los operadores (`site:`, comillas, `OR`) funcionan |
| `idioma` | `es` o `en`. Elige el locale (`hl`/`gl`/`ceid`) **y** decide con qué modelo se etiqueta el tono de los publicadores que no están en el catálogo |
| `activo` | `false` apaga la consulta sin perder su registro |
| `ventana` | opcional, `when:<n><h\|d\|m\|y>`. Por omisión `when:1d` |
| `publicadores` | mapa a mano de la etiqueta de Google → `id` del catálogo |

Tres reglas que el validador impone y conviene entender:

**Una búsqueda no lleva `zona`.** Si la llevara y llegara a `zona_medio`, la
regla de medio de una sola zona le acreditaría esa zona a **todo** titular que
la consulta devuelva sin nombrar ningún lugar. Es el error de El Imparcial y
Hermosillo con otro disfraz. Las fuentes sintéticas son `estatal`, y la zona
sale del titular.

**`when:` no va en `q`.** La ventana es una propiedad de la cadencia del cron,
no de la pregunta que hizo la persona. Puesta en cada renglón, cambiar
`17 */6 * * *` obligaría a editarlos todos y el que se olvide se queda con otra
ventana sin que nada lo señale.

**Un renglón no se borra, se apaga.** Cada nota que trajo guarda su `id` en
`descubierta_por`; borrarlo invalida el histórico que produjo y además deja sin
idioma a sus fuentes sintéticas.

### Por qué `publicadores` es a mano y hace falta

Google rotula a los diarios de grupo con el dominio del **grupo**. El Sol de
Tijuana llega como `oem.com.mx`, que no es su dominio ni el de La Voz de la
Frontera —sus dos hermanos del catálogo, y los dos feeds más largos que hay—.
Sin el mapa, los dos medios de mayor volumen son justo los que la resolución
por dominio falla, y cada una de sus notas entra como fuente sintética
duplicando una nota curada. Adivinar no es opción: atribuye la nota al medio
equivocado.

La resolución va en tres pasos: dominio del `<source>`, luego nombre plegado,
luego el mapa. Si ninguno empata, la nota recibe `fuente: gn-<hash12>` derivado
del dominio del publicador.

### El enlace de una nota de búsqueda no es el del medio

El `<link>` de Google es un redirector opaco
(`news.google.com/rss/articles/CBM...`). **No se resuelve**: seguirlo es una
petición más por nota y el token puede rotar entre corridas, con lo que la
misma nota cambiaría de `url` en una corrida sin novedad. Se guarda tal cual, y
el `dominio` —que es lo que rotula el muro— se toma del `<source>`.

Por lo mismo, una copia curada siempre le gana a una de Google: el cruce entre
las dos no puede ser por URL, así que se hace por titular plegado.

---

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
| `fuente` | `id` de un medio del catálogo, o una fuente sintética: `web-<hash12>` (descubrimiento) o `gn-<hash12>` (búsqueda) |
| `origen`, `descubierta_por` | opcionales. `descubrimiento_web`/`gdelt`, o `busqueda_web`/`<id de la búsqueda>`; nunca contienen el cuerpo del artículo |
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

Cada búsqueda activa de `config/busquedas.json` trae **su propio registro**,
con `metodo: "busqueda"`, `zona: "estatal"` y su `id` (`bq_...`). Es un
renglón por consulta y no uno agregado, por dos razones: cada consulta falla
por su cuenta y la banda de salud tiene que poder decir cuál, y el panel de
cobertura filtra las fuentes por `zona`, así que un renglón agregado sin zona
no aparecería en ninguna página.

Su `detalle` lleva diez conteos: `items`, `sin_publicador`, `sin_fecha`,
`fuera_de_ventana`, `sin_sufijo`, `resueltas`, `sinteticas`, `recortadas`,
`notas` y `sin_zona`. Los dos últimos son los que se leen al revisar:
`sin_zona` dice cuántas de las que trajo **no llegan al muro** porque su
titular no nombra ningún lugar, que es la única forma de saber si una consulta
está bien escrita sin abrir el archivo. `resueltas` + `sinteticas` suma
`obtenidas`; lo recortado por el cupo no cuenta como resuelto.

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

## `data/redes.json` — comentarios de Instagram

Lo escribe `python -m pulso redes`, vía Apify y **sin iniciar sesión**. Es
opcional: si el archivo no está, el validador no protesta.

```json
{
 "esquema": 1,
 "generado": "2026-09-08T19:41:52+00:00",
 "plataforma": "instagram",
 "retencion_dias": 30,
 "comentarios_vigentes": 567,
 "posts_vigentes": 79,
 "opinion": 492,
 "repetidos": 12,
 "reacciones": 66,
 "por_zona": {"Ensenada": 61, "Tijuana": 351},
 "por_cuenta": {"elvigia_ig": 61, "zeta_ig": 351},
 "por_idioma": {"es": 412},
 "por_tema": [{"tema": "morena", "comentarios": 15, "posts": 5}],
 "salud": [{"cuenta": "zeta_ig", "estado": "ok", "posts": 5, "comentarios": 74}],
 "gasto": {"resultados": 300, "gastado": 158, "por_concepto": {"zeta_ig": 79}}
}
```

### Por qué este panel es más pobre que el de YouTube, a propósito

**La identidad no se omite al publicar: no se ingiere.** El actor devuelve
`ownerUsername`, `ownerProfilePicUrl` y `ownerId`, y `_limpiar()` los tira
antes de escribir el caché. Ninguno hace falta para ningún conteo, y lo que
no se guarda no se puede filtrar ni hay que borrarlo después. El validador
trata esas claves como prohibidas en `data/`: si alguna aparece, el filtro de
ingesta se rompió *antes* del caché, no después.

El `id` de cada comentario tampoco es el de Instagram, sino
`sha256(post|texto plegado)`. Es estable entre corridas —o sea idempotente—
y no ata la frase a una cuenta. Dos comentarios idénticos en el mismo post
colapsan en uno a propósito: el mismo comentario copiado dos veces no son dos
opiniones.

**No hay porcentajes en ningún nivel.** Los planes gratuitos de Apify
devuelven ~15 comentarios por post, debajo del mínimo de 30 que fija
PRODUCT.md. El validador rechaza cualquier clave `porcentaje` o `pct`, y el
tablero tampoco debe calcularlos en el cliente: un `n / total` en un
componente vuelve a meter por la puerta de atrás lo que el pipeline se negó a
emitir.

**La retención es de 30 días con menos derecho a ellos que YouTube.** YouTube
al menos *concede* ese plazo por política escrita (III.E.4.d). Meta no concede
nada: lo que ata aquí son sus términos más la LFPDPPP mexicana y la CPRA
californiana, porque un comentario con nombre propio es dato personal en las
dos. Ante la duda se aplica el plazo más corto que ya está implementado.

### `opinion`, `repetidos` y `reacciones`

Tres lecturas del mismo total, publicadas por separado y **no restadas entre
sí** en el tablero. Sólo `opinion` alimenta `por_tema`.

**`repetidos`** son los comentarios cuyo texto exacto aparece en 3 o más posts
*distintos de la misma cuenta*. Eso ya no es conversación, es una persona
insistiendo. El caso que lo motivó: la cosecha del 8 de septiembre de 2026
trajo `PÁGINA DE 4SC0 Y APARTE FAKE!!` idéntico en **nueve** posts de AFN, el
20% de los comentarios de esa cuenta. Dos mecanismos que ya existían no lo
atrapan, y por buenas razones: el deduplicado no, porque el id es
`sha256(post|texto)` y el mismo comentario en dos posts sí son dos hechos; y
plegar el texto tampoco, porque el `4SC0` es evasión deliberada, no un acento.

**`reacciones`** son los comentarios sin un solo carácter alfanumérico: `👏`,
`😂😂😂`. Son reacción real y se cuentan, pero no dicen *de qué* hablan, así
que sumarlas a un tema sería inflarlo con aplausos.

**`posts` dentro de `por_tema`** dice cuántos posts distintos sostienen el
tema. Es la lección del clúster «agua» de YouTube, que resultó ser un solo
vlog del malecón: un tema con `posts: 1` es un post, no la ciudad. El
validador lo avisa a partir de 5 comentarios en un solo post.

### `gasto`, y por qué no es decorativo

Son dos pasadas pagadas y las dos cuentan contra el mismo tope: `resultsType:
"comments"` **solo acepta URLs de post**, así que no hay forma de pedir «los
comentarios de esta cuenta» en una llamada. Primero se piden los posts del
perfil, luego los comentarios de esos posts.

En `salud`, `comentarios` es lo **ingerido** y `crudos` lo **facturado**. No
son lo mismo: un post sin comentarios devuelve igual un item de relleno con
`text` vacío, que el filtro descarta pero Apify ya cobró. En la primera
cosecha El Vigía y Síntesis reportaban 5 comentarios cada uno y habían
ingerido cero.

`cache/instagram/vistos.json` registra qué posts ya se cosecharon y cuándo.
Sin él, un cron de cuatro corridas al día paga cuatro veces por los mismos
comentarios y el deduplicado del caché lo esconde: **los conteos salen bien y
la factura sale mal.** Ese archivo tiene que sobrevivir entre corridas
(`actions/cache`), igual que el caché de YouTube y por una razón distinta.

### `destacados`, `cuentas`, `ventana_dias`, `destacados_maximo`

Desde el 8 de septiembre de 2026 el archivo lleva también los posts de la
última semana con más likes. Un corte anterior a estos campos sigue siendo
válido: su ausencia es aviso, no error.

```json
"ventana_dias": 7,
"destacados_maximo": 15,
"cuentas": [
 {"cuenta": "canal66_ig", "nombre": "Mexicali — sin cuenta encontrada", "zona": "Mexicali", "activa": false},
 {"cuenta": "tjnoticias_ig", "nombre": "TjNoticias", "zona": "Tijuana", "activa": true}
],
"destacados": [
 {
  "url": "https://www.instagram.com/p/DdB_XeDm0S6/",
  "cuenta": "tjnoticias_ig",
  "zona": "Tijuana",
  "fecha": "2026-09-06",
  "titulo": "Cierran la garita de San Ysidro por obras",
  "tipo": "video",
  "likes": 1834,
  "comentarios": 212,
  "reproducciones": 12400,
  "cosechados": 30,
  "opinion": 27,
  "sentimiento": {"positivo": 3, "negativo": 18, "neutral": 6, "sin_clasificar": 0, "sin_modelo_idioma": 0},
  "temas": [{"tema": "garita", "comentarios": 9}]
 }
]
```

- **`titulo` es la primera línea del pie que escribió el medio**, recortada a
  160 caracteres. Es la regla «titular, fuente y liga» de la prensa aplicada a
  un post: el resto del pie no se publica, y un comentario jamás va aquí.
- **`zona` es la sede de la cuenta**, no el tema del post, igual que
  `por_zona`. El tablero dice «cuentas con sede en Tijuana».
- **`destacados` es la unión del top 15 general y del top 15 de cada zona**,
  sin repetir URL, ordenada por `(-likes, -comentarios, url)`. Así la página
  de una zona tiene sus propios quince sin que el archivo lleve un bloque por
  zona. El validador exige el orden (determinismo del `git diff --cached
  --quiet`) y que ninguna zona pase de `destacados_maximo`; el largo total sí
  puede superarlo.
- **La ventana se mide contra `generado`**, nunca contra el reloj de quien
  valida. Una `fecha` posterior a `generado` es reloj roto y es error.
- **`comentarios` es el total que reporta Instagram; `cosechados` lo que hay en
  caché** (a lo sumo `comentarios_por_post`). Se publican los dos.
- **`reproducciones` solo existe en video y solo si es mayor que 0.** Un cero
  se leería como «nadie lo vio» y no como «no es video». Instagram **no
  publica compartidos, reposts ni guardados** de cuentas ajenas y el actor no
  trae ningún campo para eso: el panel los rotula «sin dato».
- **`likes` llega en -1** cuando la cuenta oculta los likes; se recorta a 0 y
  el post se va al fondo. Un post que ya salió de los últimos N de su cuenta
  conserva la última métrica vista, sin marca de tiempo.
- **`tipo`** ∈ `imagen | video | carrusel | otro`.
- **`cuentas` viaja sin `handle`** (clave prohibida) y con las cuentas apagadas
  incluidas: son el registro deliberado de un hueco y permiten rotular «sin
  cuenta» en Mexicali y San Quintín en vez de un cero.
- `sentimiento` y `temas` de cada post se cuentan sobre su `opinion`, con las
  mismas exclusiones que el bloque global.

## `efimero/redes-comentarios.json` — el texto de los comentarios

**No está en git, a propósito.** El 8 de septiembre de 2026 la dirección pidió
ver el texto de los comentarios más votados de cada post destacado. Se
publica, pero el historial de git no puede cumplir una retención de 30 días,
así que `python -m pulso redes` lo escribe en `efimero/` —carpeta ignorada,
ver `.gitignore`— regenerándolo en cada corrida desde el caché. `pulso sitio` y
`web/scripts/sincronizar-datos.mjs` lo copian al artefacto **si existe**; un
despliegue desde git puro sale sin él y el panel lo dice. `--sin-texto` lo
omite.

```json
{
 "esquema": 1,
 "generado": "2026-09-08T20:36:52+00:00",
 "plataforma": "instagram",
 "retencion_dias": 30,
 "visibles": 5,
 "maximo": 10,
 "por_post": {
  "https://www.instagram.com/p/DdB_XeDm0S6/": [
   {"texto": "…", "likes": 41, "fecha": "2026-09-06", "sentimiento": "negativo"},
   {"texto": "…", "likes": 0, "fecha": "2026-09-07", "sentimiento": null}
  ]
 }
}
```

- **Solo posts que están en `destacados`**; el validador lo cruza con el
  `redes.json` del mismo corte, y un archivo huérfano (sin `redes.json`) es
  error.
- **Los primeros `visibles` van siempre; del siguiente a `maximo` solo con
  `likes > 0`.** Es la regla literal del cliente: «ver más» no destapa
  comentarios que nadie votó. Orden por likes y, a igual likes, el más
  reciente primero.
- **Cuatro claves exactas por comentario**: `texto` (recortado a 300), `likes`,
  `fecha` (puede ser `""`), `sentimiento` (`positivo | negativo | neutral |
  null`). **Sin `id`, sin usuario, sin URL del comentario.** Cualquier clave de
  identidad es error, con el mismo mensaje que en `redes.json`.
- **Fuera la brigada y las reacciones**: el mismo texto en tres o más posts de
  la misma cuenta y los comentarios de puro emoji se cuentan en `redes.json`,
  pero no se muestran como voz de nadie.
- El tablero no calcula nada sobre esta lista: la pinta.

## `data/tiktok.json` — videos de TikTok por búsqueda

Lo escribe `python -m pulso tiktok`. **Mismo contrato que `redes.json`** (lo
valida `validar_redes(…, plataforma="tiktok")`, con la tabla
`PLATAFORMAS_REDES` del validador diciendo qué cambia), y es opcional. Lo que
cambia, y por qué:

- **La fuente es una búsqueda, no una cuenta.** `cuentas` trae la búsqueda
  (`tk_tijuana_noticias`) con `zona: "estatal"`, que es la regla de fuente
  sintética de `pulso/busquedas.py`: la fila no lleva zona porque una consulta
  se la acreditaría a todo video que no nombre lugar alguno.
- **La zona de cada video sale de su pie**, con el gacetero de `pulso/zonas.py`
  y los hashtags incluidos (`#tijuana` pliega a `tijuana`). Un video que nombra
  Hermosillo se descarta y se cuenta en `salud[].fuera`; uno que no nombra
  lugar queda **`nacional`**, el veredicto literal del gacetero, y solo se ve
  en la vista de región. Los comentarios heredan la zona de su video.
- **`ventana_horas: 24` en vez de `ventana_dias`**, medida sobre `publicado`
  (fecha-hora ISO en UTC, mismo formato que `generado`); `fecha` es su día y
  solo sirve para agrupar. Exactamente una de las dos claves por plataforma:
  emitir las dos obligaría a un `ventana_dias: 1` que miente.
- **`creador`**: el @handle de quien publicó el video, en minúsculas. Es la
  única identidad que cruza a `data/`, por decisión del cliente del 8 de
  septiembre de 2026 (la URL ya lo trae), y el validador exige que sea el de la
  URL. Quien comenta sigue sin ingerirse: `uniqueId`, `uid`, `avatarThumbnail`
  y `cid` son claves prohibidas.
- **`compartidos` y `guardados` son obligatorios**: TikTok los publica, así que
  un 0 es cero medido. En Instagram están prohibidos, porque ahí faltar es
  «sin dato». `reproducciones` conserva la regla compartida (solo si > 0).
- `titulo` es la descripción del video **sin la cola de hashtags**; si el pie
  era solo hashtags se deja intacto.

```json
{
 "esquema": 1,
 "generado": "2026-09-08T23:10:00+00:00",
 "plataforma": "tiktok",
 "retencion_dias": 30,
 "ventana_horas": 24,
 "destacados_maximo": 15,
 "cuentas": [{"cuenta": "tk_tijuana_noticias", "nombre": "Tijuana noticias", "zona": "estatal", "activa": true}],
 "destacados": [
  {
   "url": "https://www.tiktok.com/@tjnoticias/video/7301",
   "cuenta": "tk_tijuana_noticias",
   "creador": "@tjnoticias",
   "zona": "Tijuana",
   "publicado": "2026-09-08T10:00:00+00:00",
   "fecha": "2026-09-08",
   "titulo": "Cierran la garita de San Ysidro por obras",
   "tipo": "video",
   "likes": 1834, "comentarios": 212, "compartidos": 41, "guardados": 12, "reproducciones": 90000,
   "cosechados": 30, "opinion": 27,
   "sentimiento": {"positivo": 3, "negativo": 18, "neutral": 6, "sin_clasificar": 0, "sin_modelo_idioma": 0},
   "temas": [{"tema": "garita", "comentarios": 9}]
  }
 ],
 "salud": [{"cuenta": "tk_tijuana_noticias", "estado": "ok", "posts": 28, "comentarios": 410, "crudos": 430, "fuera": 1, "descartados": 1}]
}
```

**Lo que hay que saber del actor.** `clockworks~tiktok-scraper` con
`searchSection: "/video"`, `videoSearchSorting: "MOST_RELEVANT"` y
`videoSearchDateFilter: "PAST_24_HOURS"` (los dos últimos son filtros
cobrados). Los valores válidos no están en la ficha pública del actor: salieron
de un HTTP 400 del propio actor el 8 de septiembre de 2026, cuando la primera
versión mandó `YESTERDAY` copiado de la interfaz de TikTok. Son `ALL_TIME |
PAST_24_HOURS | PAST_WEEK | PAST_MONTH | LAST_3_MONTHS | LAST_6_MONTHS` para la
fecha y `MOST_RELEVANT | MOST_LIKED | LATEST` para el orden. La ventana se
impone igual en `derivar()` y el filtro solo recorta lo que se factura;
`python -m pulso tiktok --probar` trae tres videos para verlo. Los comentarios
del actor van a un dataset aparte que `correr_actor` no lee, así que la segunda
pasada usa `clockworks~tiktok-comments-scraper` (~5 USD por 1,000 resultados,
diez veces el de videos): con 30 videos × 30 comentarios son ~4.50 USD en la
primera corrida del día, y `cache/tiktok/vistos.json` evita repetirlos. Las
URL de las dos pasadas se canonizan a `https://www.tiktok.com/@{handle}/video/{id}`
porque llegan con distinto caso y query, y sin eso el cruce falla en silencio.
`textLanguage` se ignora: el idioma sale del config.

## `efimero/tiktok-comentarios.json` — el texto de los comentarios de TikTok

Idéntico a `redes-comentarios.json` (`plataforma: "tiktok"`), validado contra
`data/tiktok.json` y con las claves de identidad de TikTok además prohibidas.
Mismas reglas: fuera de git, regenerado en cada corrida, 5 visibles y hasta 5
más solo con likes, menciones enmascaradas, sin id ni usuario.

### `config/tiktok.json`

Búsquedas, no cuentas: `busquedas[]` con `id` (`^tk_[a-z0-9_]{2,20}$`),
`nombre`, `consulta`, `idioma`, `activo`, `verificado` (fecha del `--probar`,
informativa) y `nota`. **`zona` es error**, por la misma razón que en
`config/busquedas.json`. `cosecha` trae `videos_por_busqueda`,
`comentarios_por_video`, `dias_entre_cosechas`, `ventana_horas`,
`filtro_fecha` (uno de `ALL_TIME | PAST_24_HOURS | PAST_WEEK | PAST_MONTH |
LAST_3_MONTHS | LAST_6_MONTHS`), `orden` (`MOST_RELEVANT | MOST_LIKED | LATEST`)
y `presupuesto_resultados`, el tope de **este comando**: cada verbo construye
su propio `Presupuesto`. Lo valida `validar_tiktok_config`.

### `config/instagram.json`

Una cuenta se cosecha solo si tiene `activo` **y** `verificado` en `true`.
Las diez activas se sondearon el 8 de septiembre de 2026 con `--sondear` y cada
`razon` cita los números del sondeo; `canal66_ig` (Mexicali) y `sanquintin_ig`
son huecos registrados a propósito, sin handle. Los handles derivados del
nombre del medio que fallaron están en `senuelos`. Es la misma trampa que
documenta la sección `senuelos` de `config/canales.json` —el handle obvio de
Uniradio es un canal muerto desde 2016— con un agravante: un handle
equivocado en Instagram no da error, da una cuenta ajena o vacía, y las dos se
cobran igual.

No hay hashtags, y no es un olvido. Un hashtag no lleva `zona`, por la misma
razón que no la lleva una búsqueda de Google Noticias: se la acreditaría a
todo comentario que no nombre lugar alguno, que es el bug de El Imparcial y
Hermosillo con otro disfraz.

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

## Comunicados municipales (`comunicados.json`)

Documento independiente de `notas.json`, escrito por `python -m pulso comunicados`.
Los boletines del Ayuntamiento de Tecate no entran a cobertura de prensa,
temas, figuras ni sentimiento. `config/comunicados.json` conserva la fuente,
los selectores y la fecha de verificación; no se agrega a `medios.json`.

- `esquema: 1`, `zona: "Tecate"`, `fuente: {id, nombre, url}` identifica a
  `gobtecate`, Gobierno de Tecate, `https://tecate.gob.mx/`.
- `modo`: `red` o `sin_red`; los ejemplos offline se rotulan en la interfaz.
- `consultado`: instante ISO de la corrida, inyectado por el comando.
- `ultimo_exito`: instante ISO de la última extracción correcta o `null`.
- `estado`: `ok` o `fallo`; `error` es `null` en éxito y un motivo en fallo.
- `comunicados`: objetos estrictos `{id, titulo, url, fecha}`; `id` usa el hash
  existente de fuente y título, URL única `https://tecate.gob.mx/noticias/<id>`,
  fecha editorial `YYYY-MM-DD` o `null`. Orden por fecha descendente, sin fecha
  al final, y URL ascendente como desempate. No se guardan cuerpos ni resúmenes.

Una lectura correcta reemplaza la lista. Una falla de red o extracción vacía
conserva los titulares y `ultimo_exito` previos del mismo modo. Sin corte
anterior, se publica lista vacía con estado `fallo`, nunca un éxito ficticio.
Una corrida real no conserva ejemplos offline. La portada incluye un carrusel
con noticias más antiguas: “últimos” significa lo expuesto allí, no una ventana
temporal ni todo el archivo. No se sigue paginación ni artículos.
