> **Contrato añadido · 21 de septiembre de 2026:** `pauta-meta.json` contiene catálogo, cobertura y reporte; `pauta-meta/<id>.json` contiene anuncios, información y audiencia por anunciante. Secciones con fuente, periodo, geografía, fechas, estado y completitud; valores ausentes como `null`. Autoridad: `validar_publicidad_meta_config`, `validar_publicidad_meta` y `validar_perfil_meta` en `pulso/validador.py`. [Detalle e importación](publicidad-meta.md).

> **Nombre de archivo · 22 de septiembre de 2026:** los datos se llaman
> `pauta-meta`, no `publicidad-meta`, y el producto sigue diciendo «Publicidad
> Meta» en pantalla. Las listas de filtrado en español —EasyList Spanish, que
> uBlock Origin activa sola a quien navega en español— bloquean cualquier URL
> que contenga «publicidad». El bloqueo ocurre en el navegador: el servidor
> responde 200 y la petición nunca sale, con `ERR_BLOCKED_BY_CLIENT` en la
> consola, así que el panel quedaba en «No se pudo cargar Publicidad Meta» sin
> que fallara nada del lado del servidor, y en producción le pasaría a
> cualquier visitante con esas listas. `config/publicidad-meta.json`,
> `cache/publicidad-meta/`, el verbo `pulso publicidad-meta` y los nombres de
> tipo **no** se renombraron: no se sirven por HTTP y nadie los bloquea.

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

## Gasto electoral

Tres documentos forman una sola superficie de producto, pero no una sola
métrica:

- `config/gasto-electoral.json` declara los procesos, el calendario y las
  fuentes oficiales.
- `data/gasto-electoral.json` contiene gasto **final auditado por persona** de
  2024.
- `data/financiamiento-partidos.json` contiene asignaciones públicas a
  **partidos** en 2026. Nunca se une con una candidatura.

`python -m pulso gasto-electoral` genera los dos archivos. El trabajo semanal
lee el directorio central de los ZIP del INE con HTTP Range y descarga solo el
Anexo II; no baja los expedientes completos. `--solo-financiamiento` actualiza
únicamente los XLSX y el acuerdo vigente del IEEBC.

### `data/gasto-electoral.json`

```json
{
 "esquema": 1,
 "moneda": "MXN",
 "procesos": [{
  "id": "pelo-2024",
  "estado": "auditado",
  "dictamen": "INE/CG1934/2024",
  "dictamen_url": "https://..."
 }],
 "resumen": {
  "filas_origen": 247,
  "candidaturas": 247,
  "sin_conciliar": 0,
  "incidencias": 0
 },
 "candidaturas": [{
  "id": "pelo-2024-18480",
  "proceso": "pelo-2024",
  "id_contabilidad": "18480",
  "nombre": "Julia Andrea Gonzalez Quiroz",
  "ambito": "local",
  "cargo": "Diputación Local Mr",
  "contienda_id": "local-diputacion-10",
  "contienda": "Distrito local 10",
  "partido": "MORENA",
  "gasto_reportado": 246559.97,
  "desglose_reportado": {
   "financieros": 27.84,
   "operativos": 22124.2,
   "radio_tv": 43.38,
   "propaganda": 198380.55,
   "impresos": 0,
   "via_publica": 25984,
   "cine": 0,
   "utilitaria": 0,
   "internet": 0
  },
  "diferencia_prorrateo": null,
  "auditoria": {
   "no_reportado": 0,
   "ajustes_reclasificaciones": 0,
   "quejas": null,
   "determinado": 0
  },
  "gasto_auditado": 246559.97,
  "tope": 1910814.66
 }],
 "incidencias": [],
 "fuentes": []
}
```

La identidad es determinista: `<proceso>-<id_contabilidad>`. Los nombres son
solo presentación y búsqueda; nunca participan en el join. Las 194 filas
locales y 53 federales deben quedar como candidatura conciliada o como
incidencia explícita. Una incidencia se excluye de todas las métricas.

Reglas aritméticas:

- categorías reportadas + `diferencia_prorrateo` = `gasto_reportado`;
- `gasto_reportado` + `auditoria.determinado` = `gasto_auditado`;
- `no_reportado + ajustes_reclasificaciones + quejas = determinado` sólo
  cuando el anexo publica los tres componentes; un componente vacío sigue
  siendo `null` y no se infiere una contrapartida;
- `gasto_auditado` es siempre `TOTAL DE GASTOS` del Anexo II final;
- `tope` y una categoría ausente son `null`, no cero. Un `$-` explícito en el
  archivo oficial sí es cero medido.

No hay `generado`: los dictámenes históricos son finales y una hora de
ejecución produciría diffs artificiales. `proceso_actual` lleva fechas del
calendario 2026–2027, pero no admite candidaturas provisionales.

### `data/financiamiento-partidos.json`

```json
{
 "esquema": 1,
 "ejercicio": 2026,
 "moneda": "MXN",
 "corte": "2026-07-03",
 "aviso": "Financiamiento público asignado; no equivale a gasto ejercido ni a gasto de campaña.",
 "partidos": [{
  "id": "encuentro-solidario-baja-california",
  "nombre": "Encuentro Solidario Baja California",
  "ordinario_original": 33124092.85,
  "ordinario_vigente": 17082101.12,
  "especifico": 2384934.69,
  "ministrado_enero_mayo": 33124092.85,
  "excedente_ministrado": 16041991.73,
  "total_asignado": 19467035.81
 }],
 "totales": {
  "ordinario_vigente": 89712302.94,
  "especifico": 4563840.75,
  "asignado": 94276143.69
 },
 "acuerdos": [],
 "fuentes": []
}
```

El XLSX ordinario publicado por el IEEBC conserva para PES BC lo ministrado
antes del acuerdo correctivo. Por eso se preserva como `ordinario_original` y
el acuerdo IEEBC/CGE37/2026 fija `ordinario_vigente`; borrar una de las dos
cifras ocultaría precisamente la diferencia que hay que explicar.

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
~3.2 MB en crudo, que el servidor manda como ~470 KB con brotli. La `imagen`
(desde el 14 de septiembre de 2026) añade unos 100 bytes a las notas que la
traen, dos de cada tres en los feeds que la publican: del orden de +350 KB en
crudo, mucho menos comprimido porque los hosts se repiten.

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
| `imagen` | opcional. URL `https` de la miniatura que el medio publica **en su propio feed o en su portada**, solo si su host es el del medio (o uno de los `imagenes_de` de su fila en `config/medios.json`). Enlazada, nunca copiada. **Se conserva** la primera vista, como `capturado`. Ausente cuando el medio no la publica o la nota llegó por búsqueda: no es un hueco que rellenar ni un `null` que escribir |
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
primera vez, así que volver a correr no reescribe la historia. `imagen`
también: un feed que cambia el tamaño de su miniatura o la quita no toca una
nota ya vista, porque si lo hiciera una corrida sin novedad ensuciaría `data/`.

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
eso el paso viene apagado detrás de `YOUTUBE_HABILITADO`. Esa bandera cubre
**este** módulo y nada más: `pulso/youtube.py` lee feeds Atom públicos, que no
son datos de la API, y corre sin compuerta.

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

### `destacados`, `cuentas`, `ventana_horas`, `destacados_maximo`

Desde el 8 de septiembre de 2026 el archivo lleva también los posts con más
likes de la ventana. Desde el **10 de septiembre de 2026**, a petición del
cliente, esa ventana es de **24 horas sobre la hora exacta de publicación**
(`ventana_horas` y `publicado`, igual que TikTok); antes fue de 7 días sobre
`fecha` (`ventana_dias: 7`, sin `publicado`). Un corte con la forma vieja —el
commiteado el 8 de septiembre, que el bot regenerará— sigue siendo válido con
un aviso, y un corte anterior a todos estos campos también: su ausencia es
aviso, no error.

```json
"ventana_horas": 24,
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
  "publicado": "2026-09-06T17:40:12+00:00",
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
  `por_zona`. El tablero dice «cuentas con sede en Tijuana». La excepción es
  una cuenta con `ambito` (22 de septiembre de 2026, los medios del mundo):
  ahí cada post se zonifica por su pie con la tabla de TikTok, **publica
  `alcance`** y puede valer `internacional`; sus comentarios heredan la zona de
  su post. El validador acepta `alcance` como opcional en Instagram y exige
  que un `internacional` lo traiga, porque ninguna sede es «el mundo».
- **`destacados` es la unión del top 15 general y del top 15 de cada zona**,
  sin repetir URL, ordenada por `(-likes, -comentarios, url)`. Así la página
  de una zona tiene sus propios quince sin que el archivo lleve un bloque por
  zona. El validador exige el orden (determinismo del `git diff --cached
  --quiet`) y que ninguna zona pase de `destacados_maximo`; el largo total sí
  puede superarlo.
- **Cada uno de esos dos cortes reparte una vuelta por cuenta antes de volver
  al mérito** (`VUELTAS_GARANTIZADAS`, solo Instagram): entra la mejor
  publicación de cada cuenta que publicó en la ventana, y lo que sobre del
  tope se llena por likes como siempre. El caso: entre el 15 y el 17 de
  septiembre de 2026 `tjnoticias_ig` encabezó todas las corridas de Tijuana
  con entre siete y diez de los quince lugares, y la zona bajó a entre dos y
  cuatro cuentas de las doce activas, aunque las doce cosechan cinco posts en
  cada corrida. **No es un tope por cuenta**: pasada la primera vuelta todos
  vuelven a competir por likes, así que donde publica un solo medio
  —`elvigia_ig` se lleva los catorce de Ensenada— la selección es idéntica a
  la de antes. Inventar un hueco es el mismo error que rellenarlo. **Cambia
  qué se elige, nunca en qué orden se escribe.**
- **La ventana se mide contra `generado`**, nunca contra el reloj de quien
  valida, y sobre `publicado` (fecha-hora ISO en UTC, mismo formato que
  `generado`); `fecha` es su día, sirve para agrupar, y el validador exige que
  coincidan. Un `publicado` posterior a `generado` es reloj roto y es error.
  Exactamente una clave de ventana por archivo: las dos juntas son error.
- **Los conteos de comentarios de un post son la foto de su primera cosecha.**
  Con 24 horas de ventana, `dias_entre_cosechas` solo deduplica las corridas
  del día y un post sale de la ventana antes de volverse a cosechar; likes,
  comentarios y reproducciones sí se refrescan en cada corrida. Y cada corrida
  ve los últimos `posts_por_cuenta` (5) de cada cuenta: una que publica más de
  cinco veces entre corridas pierde posts.
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
- Un tema de prensa **nombra** un comentario si aparece como palabra completa
  (plural y etiqueta incluidos: «#Morena», «morenas»), nunca como subcadena, y
  entra en los `temas` de un post solo con **3 comentarios o más**
  (`redes.MINIMO_TEMA_POST`, la regla 3 de `pulso/temas.py`). Desde el 25 de
  septiembre de 2026: antes «tres» salía de «extraterrestres» y 42 de 52
  insignias descansaban en un solo comentario. El agregado `por_tema` usa la
  misma palabra completa y no lleva piso, porque su `posts` ya dice cuánto lo
  sostiene. Un corte anterior puede traer temas de 1 o 2 comentarios; el
  cron los regenera.

## `data/redes-comentarios.json` — el texto de los comentarios

**No está en git, a propósito.** El 8 de septiembre de 2026 la dirección pidió
ver el texto de los comentarios más votados de cada post destacado. Se
publica, pero el historial de git no puede cumplir una retención de 30 días,
así que `python -m pulso redes` lo escribe en `data/` pero `.gitignore` lo
excluye por nombre (`data/*-comentarios.json`), regenerándolo en cada corrida
desde el caché. Vivió en una carpeta aparte, `efimero/`, hasta el 17 de
septiembre de 2026; `pulso validar` da error si el archivo existe y esa línea
no está. `pulso sitio` y
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
  y los hashtags incluidos (`#tijuana` pliega a `tijuana`). Los comentarios
  heredan la zona de su video.
- **`alcance` es el veredicto crudo del gacetero** (`zona | estatal | fuera |
  extranjero | nacional`) y viaja **al lado** de `zona`, no en su lugar. Existe
  desde el 15 de septiembre de 2026, cuando el campo `ambito` de la búsqueda
  hizo que los dos dejaran de coincidir: en una búsqueda nacional un video de
  Guadalajara queda `zona: "nacional"` igual que uno que no nombró lugar
  alguno, y sin el alcance las dos filas serían la misma. El panel rotula
  «fuera del corredor» para una y «sin lugar» para la otra. Un corte anterior
  al campo sigue siendo válido (aviso, no error): `data/` lo escribe el bot y
  el cron lo regenera.
- **`extranjero` (22 de septiembre de 2026) nombra un lugar de fuera de
  México** y solo puede ir con `zona: "internacional"`; el validador lo exige.
  Lo calcula `pulso/zonas.py::alcance_redes`, que solo usan las redes:
  `zonas.alcance`, que zonifica la prensa, no cambió, y `notas.json` no se
  mueve. Existe porque el gacetero no conocía el extranjero y lo llamaba
  «nacional»: «Más de 280 mil niños en Gaza regresaron a clases», de N+, caía
  en la cubeta México. Tres reglas que no son obvias:
  - **Lo débil cede ante lo que la prosa nombra de fuera**: un homónimo del
    gacetero («la paz», «El Rosario, Sinaloa»), la cola de etiquetas del pie
    (`#tijuana` al final de un video de Irán) y la firma de un canal
    (`sufijos_titulo`). Un lugar del corredor nombrado en la prosa gana
    siempre, y las palabras comunes del corredor («la mesa», «la presa»)
    ceden solo ante el extranjero, no ante Sonora.
  - **Nombrar México bloquea `extranjero`**, sea el país o sus instituciones
    federales («Sheinbaum», «Pemex», «AICM»): «México vence a Argentina» es
    nacional. Y una fuente del mundo que habla de México también va a
    `nacional`, no a Mundo.
  - **Estados Unidos y California no son extranjero** en el gacetero, a
    propósito: la frontera los nombra todo el día. Los estados y ciudades de
    Estados Unidos fuera del corredor sí.
- **`ambito` decide el residuo, nunca la zona.** Cuando el pie nombra un lugar
  del gacetero manda el pie, igual en los tres ámbitos; lo único que cambia es
  qué se hace con el video que no nombra lugar o que nombra uno de fuera:

  | veredicto del gacetero | `regional` | `nacional` | `internacional` |
  |---|---|---|---|
  | una zona del producto | esa zona | esa zona | esa zona |
  | Baja California a secas | `estatal` | `estatal` | `estatal` |
  | un lugar mexicano de fuera | se descarta, y se cuenta en `salud[].fuera` | `nacional` | `nacional` |
  | un lugar del extranjero | **`internacional`** | **`internacional`** | **`internacional`** |
  | ningún lugar | se descarta, y se cuenta en `salud[].sin_lugar` (o `nacional` si nombra México) | `nacional` | **`internacional`**, o `nacional` si nombra México |

  La casilla regional sin lugar cambió el 22 de septiembre de 2026: antes era
  `nacional`, y el relleno de las búsquedas de Rosarito, Ensenada y Mexicali
  —una lluvia en Tegucigalpa, pies vacíos— llenaba la cubeta México. En YouTube
  y en una cuenta de Instagram con `ambito: regional`, que son **medios** del
  corredor y no búsquedas, esa casilla es `zona: "estatal"` con
  `alcance: "nacional"`: se ve en Corredor, nunca en una página de ciudad, y
  la tarjeta dice «un lugar sin precisar». El validador acepta ese par solo
  donde `PLATAFORMAS_REDES[plataforma]["residuo_corredor"]` es cierto.

  `internacional` es la única zona que no está en `ZONAS` de
  `pulso/__init__.py`: es la cubeta Mundo, existe en TikTok, YouTube y las
  cuentas de Instagram con `ambito`, y no entra a `ZONAS_DE_CONTEO` porque en
  temas y conversación no significa nada. Como `nacional`, no tiene página de
  zona y solo se ve en la vista de región. Junta dos cosas que el `alcance`
  separa: lo que nombró el extranjero (`extranjero`, verificado) y lo que vino
  de una edición del mundo sin nombrar nada (`nacional`), que es el mismo trato
  que `/api/actualidad` le da a la sección «Mundo» de Google Noticias. La
  tarjeta dice «sobre el mundo» solo para lo primero.
- **`ventana_horas: 24`**, medida sobre `publicado` (fecha-hora ISO en UTC,
  mismo formato que `generado`); `fecha` es su día y solo sirve para agrupar.
  Desde el 10 de septiembre de 2026 Instagram mide igual; `ventana_dias` solo
  sobrevive en un corte de Instagram anterior a esa fecha. Exactamente una de
  las dos claves por archivo: emitir las dos obligaría a un `ventana_dias: 1`
  que miente.
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
- **`duracion` son segundos de video y es opcional**, desde el 17 de septiembre
  de 2026. Solo TikTok: el actor de Instagram no la publica y ahí está
  prohibida. Un corte anterior no la trae y sigue siendo válido (aviso, no
  error). Nunca se emite un 0, que se leería como «video de duración cero» en
  vez de «no la trae». Existe por una razón de costo y no de interfaz: todo lo
  que Apify cobra sobre el video se factura **por segundo empezado**
  (`aiVideoSummary`, `aiVideoDescription`) o **por minuto empezado**
  (`transcription-minute`), así que sin ella cualquier presupuesto de esa
  familia es una suposición —que es exactamente lo que hubo que hacer el día
  que se preguntó cuánto costaría resumir los videos—.
- **El texto de los subtítulos no se guarda en ninguna parte.** Desde el 17 de
  septiembre de 2026 la cosecha pide `downloadSubtitlesOptions:
  DOWNLOAD_SUBTITLES`, que trae los subtítulos **que TikTok ya generó** cuando
  el video los tiene y no cobra un evento aparte. De ahí solo sale un conteo:
  `salud[].con_subtitulos`, cuántos videos de esa búsqueda los traían. El texto
  es el cuerpo del video y la agregación se queda en titular, fuente y enlace.

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
   "alcance": "zona",
   "zona": "Tijuana",
   "publicado": "2026-09-08T10:00:00+00:00",
   "fecha": "2026-09-08",
   "titulo": "Cierran la garita de San Ysidro por obras",
   "tipo": "video",
   "likes": 1834, "comentarios": 212, "compartidos": 41, "guardados": 12, "reproducciones": 90000,
   "duracion": 47,
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

## `data/tiktok-comentarios.json` — el texto de los comentarios de TikTok

Idéntico a `redes-comentarios.json` (`plataforma: "tiktok"`), validado contra
`data/tiktok.json` y con las claves de identidad de TikTok además prohibidas.
Mismas reglas: fuera de git, regenerado en cada corrida, 5 visibles y hasta 5
más solo con likes, menciones enmascaradas, sin id ni usuario.

### `config/tiktok.json`

Búsquedas, no cuentas: `busquedas[]` con `id` (`^tk_[a-z0-9_]{2,20}$`),
`nombre`, `consulta`, `idioma`, `activo`, `verificado` (fecha del `--probar`,
informativa), `ambito` opcional (`regional | nacional | internacional`; si
falta, `regional`) y `nota`. **`zona` es error**, por la misma razón que en
`config/busquedas.json`, y `ambito` no es la puerta de atrás a eso: no acredita
lugar a nadie, solo decide el residuo (ver `data/tiktok.json` arriba).

Once búsquedas desde el 15 de septiembre de 2026, **ocho activas**. Tecate, San
Felipe y San Quintín están apagadas con la razón escrita en su fila: se
probaron de verdad y no devuelven noticia sino falsos positivos —un incendio en
Apodaca, Nuevo León, zonificado como Tecate porque el pie decía «Tecate Six»;
una carrera de un club de Manhattan zonificada como San Felipe—. Un falso
positivo con cara de cobertura es peor que un hueco rotulado. La duodécima,
`tk_world_news` («world news», en inglés, para Mundo), entró apagada el 22 de
septiembre de 2026 hasta su `--probar`, que cuesta. `presupuesto_resultados`
está calculado sobre **todas** las filas (3,800 para doce: 12 × 15 × 21 =
3,780) y no sobre las activas, a propósito: así encender una apagada no
recorta los comentarios de las demás en silencio, que es como falla
`reparto - posts`.

`cosecha` trae `videos_por_busqueda`,
`comentarios_por_video`, `dias_entre_cosechas`, `ventana_horas`,
`filtro_fecha` (uno de `ALL_TIME | PAST_24_HOURS | PAST_WEEK | PAST_MONTH |
LAST_3_MONTHS | LAST_6_MONTHS`), `orden` (`MOST_RELEVANT | MOST_LIKED | LATEST`)
y `presupuesto_resultados`, el tope de **este comando**: cada verbo construye
su propio `Presupuesto`. Lo valida `validar_tiktok_config`.

**`perfiles`** (22 de septiembre de 2026) son cuentas de medios de México y del
mundo, las fuentes fijas de esas dos cubetas. Campos:
- `id` (`^tk_…`, sin chocar con una búsqueda: los dos son `cuenta` en `data/tiktok.json`);
- `nombre`, `perfil` (`@handle`), `idioma`;
- `ambito`: **obligatorio**, `nacional | internacional`;
- `activo`, `verificado` (fecha del `tiktok --probar --fila`, obligatoria si está activo), `nota`;
- `marca` y `seguidores` (ver `config/instagram.json`).

No llevan `consulta` ni `zona`: la zona sale del pie de cada video, igual que en una búsqueda.

`cosecha` suma `videos_por_perfil` (10) y `comentarios_por_video_perfil` (7). Tres cosas que difieren de una búsqueda:
- La ventana de 24 horas se impone **antes** de pedir comentarios, porque el perfil no trae filtro de fecha. En `salud`, el perfil cuenta `fuera_de_ventana`.
- Un video de otro autor se tira como `otro_creador`.
- `presupuesto_resultados` cuenta cada perfil como una fila entera, porque el reparto es parejo: 20 × 315 = 6,300.

### `config/instagram.json`

Una cuenta se cosecha solo si tiene `activo` **y** `verificado` en `true`.
Las veintisiete activas se sondearon con `--sondear` —diez el 8 de septiembre
de 2026, tres el 10 y catorce el 15, pedidas por el cliente ese día— y cada
`razon` cita los números del sondeo. Con la tanda del 15 el catálogo deja de
ser de Tijuana: cubre Tijuana, Mexicali, Ensenada, Tecate, San Diego y
`nacional`, y `sanquintin_ig` es el único hueco que queda, sin handle.
`canal66_ig` era el otro y se cerró ese día con `@canal66tv`, conservando su
`id`.

Cada fila lleva `zona` **o** `ambito`, nunca las dos ni ninguna; lo valida
`validar_instagram_config` desde el 22 de septiembre de 2026, que además exige
`handle` y `verificado: true` a toda cuenta activa. Con `ambito` la cuenta es
de las del mundo y sus posts se zonifican por el pie (ver `redes.json`
arriba); con `zona` todo sigue como estaba.

La zona de una cuenta con `zona` es **su sede declarada**, no el veredicto de
un gacetero: a diferencia de TikTok, esa fila no consulta `pulso/zonas.py`, así
que lo que diga se le estampa a cada comentario y a cada post de la cuenta sin
corrección posible. Por eso varias filas llevan escrita la instrucción de a qué
zona pasar si su conversación desmiente la bio, y por eso `@svnnoticias` —viva,
con 31 mil seguidores, pedida por el cliente— quedó en `senuelos`: es «Sonora
Visión Noticias», y nada habría descartado sus comentarios de Hermosillo. Los
handles derivados del
nombre del medio que fallaron están en `senuelos`. Es la misma trampa que
documenta la sección `senuelos` de `config/canales.json` —el handle obvio de
Uniradio es un canal muerto desde 2016— con un agravante: un handle
equivocado en Instagram no da error, da una cuenta ajena o vacía, y las dos se
cobran igual.

`cosecha.ventana_horas` (24) es la ventana de los destacados, en horas sobre la
hora exacta de publicación, desde el 10 de septiembre de 2026;
`posts_por_cuenta`, `comentarios_por_post` y `dias_entre_cosechas` gobiernan
las dos pasadas pagadas, y la `nota` del bloque explica por qué con 24 horas
los comentarios de un post son la foto de su primera cosecha.

**Una marca, una red** (22 de septiembre de 2026). Una fila puede llevar
`marca` (`^[a-z0-9_]{2,20}$`), que la une con el perfil del mismo medio en
`config/tiktok.json`, y `seguidores`, entero, del sondeo de esa red. Reglas de
`validar_marcas`:
- Dos filas activas con la misma `marca` entre las dos redes son **error**: el
  muro repetiría cada nota.
- Si la activa no es la de más seguidores, es un **aviso**.
- `seguidores` solo se exige a la fila activa. Una sin sondear no tiene cifra,
  y un 0 se leería como «nadie la sigue».

La Crónica y El Mexicano pasaron ese día de `zona: nacional` a
`ambito: nacional`. Sus 15 destacados de México traían Mexicali, Tijuana y
Corea del Norte.

`resultados_por_corrida` en `config/apify.json` tiene que dar al menos
`posts_por_cuenta × (1 + comentarios_por_post)` por cuenta activa, y una prueba
lo exige. Es la versión ejecutable del recorte silencioso de `reparto - posts`.

No hay hashtags, y no es un olvido. Un hashtag no lleva `zona`, por la misma
razón que no la lleva una búsqueda de Google Noticias: se la acreditaría a
todo comentario que no nombre lugar alguno, que es el bug de El Imparcial y
Hermosillo con otro disfraz.

## `data/youtube.json` — Shorts y videos de YouTube por feed público

Tercera plataforma de la familia `redes`, con el mismo contrato que
`data/redes.json` y `data/tiktok.json` (`plataforma: "youtube"`) y tres
diferencias que importan. La escribe `python -m pulso youtube`.

**No sale de la API de datos.** Sale de las dos listas de reproducción
automáticas que YouTube genera por canal y sirve por Atom, sin llave, sin
cuota y sin OAuth:

```
https://www.youtube.com/feeds/videos.xml?playlist_id=UUSH<id del canal sin UC>   Shorts
https://www.youtube.com/feeds/videos.xml?playlist_id=UULF<id del canal sin UC>   videos largos
```

Es un documento de sindicación público, del mismo tipo que los quince feeds de
prensa de `config/medios.json`. Esa distinción no es cosmética: las Políticas
para Desarrolladores de YouTube (III.E.2.a sobre agregar canales de distintos
dueños, III.E.4.d sobre los 30 días) atan los datos de la **API**, que es lo
que lee el otro módulo de YouTube, `pulso/conversacion.py` → `conversacion.json`.
Por eso aquel viene apagado detrás de `YOUTUBE_HABILITADO` y este no, y por eso
**los datos de los dos no se suman en un mismo agregado**.

**El prefijo no está documentado, y lo que compra el derecho a usarlo es que la
lista no clasifica.** Cada entrada trae su propio enlace —`/shorts/` o
`/watch?v=`— y de ahí sale el formato. La lista es sólo una estrategia de
lectura barata. Cuando las dos no coinciden manda el enlace y la discrepancia
se cuenta en `salud[].reclasificados`: el día que YouTube deje de honrar el
prefijo, el contador lo grita en la banda de salud en vez de callárselo. No es
hipotético — el 18 de septiembre de 2026 la lista `UULF` de Zeta, la de «solo
videos largos», traía diez entradas con enlace `/shorts/`.

### Las tres diferencias con Instagram y TikTok

**1. No hay comentarios, y el documento lo dice.** El feed público no los trae.
Todos los conteos de conversación salen en cero, y para que un cero no se lea
como medición la raíz lleva:

| campo | tipo | qué dice |
|---|---|---|
| `cosecha_comentarios` | bool | `false` aquí. Cuando es `false`, el validador **exige** que `comentarios_vigentes`, `opinion`, `repetidos` y `reacciones` sean 0 y que `por_tema` esté vacío, y calla el aviso «post destacado sin comentarios cosechados», que si no saldría en las ~80 filas de cada corrida y dejaría de ser una señal. Ausente se lee `true`: un corte anterior al 18 de septiembre de 2026 no lo trae y sí cosechaba. |

Sin ese campo, un panel sin cosecha y uno donde nadie comentó serían el mismo
archivo. Es la distinción entre «sin dato» y «0» aplicada al documento entero.
La interfaz lo lee para no pintar el botón de comentarios ni el de Analizar.

**2. Las cifras son otras, y las que faltan faltan a propósito.**

| campo | obligatorio en | qué es |
|---|---|---|
| `reproducciones` | youtube | `media:statistics@views`. Aquí ordena el corte, así que un 0 es cero medido y no se omite; en Instagram y TikTok sigue siendo opcional y sólo se emite si es mayor que 0. |
| `valoraciones` | youtube | `media:starRating@count`. **No se llama `likes`** a propósito: de 162 entradas sondeadas el `@average` sólo vale `5.00` o `0.00`, nunca algo intermedio, que es lo que se espera desde que no hay dislikes —o sea que casi seguro son los likes—, pero Google no lo documenta en ninguna parte y bautizarlo así sería una mentira tranquila sobre lo que la fuente publica. Tampoco es campo de pantalla: existe para el archivo y como segundo criterio de orden, la misma categoría que `duracion` en TikTok. |
| `likes`, `comentarios` | **ausentes** | El feed público no los trae. Su ausencia es «sin dato» y el validador los **rechaza** si aparecen: un `comentarios: 0` se leería como «nadie comentó» cuando lo cierto es que la fuente no lo dice. |
| `duracion` | ausente | El feed no la trae. |
| `creador` | ausente | El publicador **es** la `cuenta`, una fila del catálogo con `nombre` impreso. Un `creador` sería el mismo hecho dos veces y la segunda copia es una clave de identidad. |

El orden emitido es `(-reproducciones, -valoraciones, url)`, no el
`(-likes, -comentarios, url)` de las otras dos. Vive en
`PLATAFORMAS_REDES["youtube"]["orden"]` del validador y tiene que coincidir con
`ORDEN` de `pulso/youtube.py` y con `compararPorMerito` de
`web/src/lib/dominio/publicaciones.ts`: si divergen, `data/` se reescribe en
cada corrida y el guardia `git diff --cached --quiet` del cron deja de detectar
«sin cambios».

**3. Hay dos formatos y el corte se hace por separado.**

| campo | tipo | qué dice |
|---|---|---|
| `formato` | `"short"` \| `"video"` | Sólo YouTube, y obligatorio ahí. También decide la proporción del embed: 9:16 para un Short, 16:9 para un video largo. |

`_destacados` corta dentro de cada formato y dentro de cada `(formato, zona)`,
y emite la unión —el mismo patrón con el que ya unía el corte global con el de
cada zona—. `destacados_maximo` es por `(zona, formato)`.

El motivo no es estético: **las vistas de los dos formatos no miden lo mismo**.
Desde el 31 de marzo de 2025 YouTube cuenta una vista de Short como *cualquier
arranque o repetición, sin tiempo mínimo de reproducción*, y la de un video
largo no. Es el mismo campo `viewCount` contando dos eventos distintos. Medido
el 18 de septiembre de 2026 sobre los canales del corredor: mediana de **447**
vistas en Shorts contra **7** en videos. En un solo ranking los videos no
entran nunca, y el muro no se engrosa nada.

Y engrosarlo es el punto: los dos formatos son complementarios, no redundantes.
Cuatro de los once canales del corredor publican casi sólo videos largos
—Uniradio publicó 0 Shorts y 10 videos en siete días— y otros tres casi sólo
Shorts. Sobre siete días los dos juntos llevan la cobertura de Tecate de 10 a
16 piezas, la de Playas de Rosarito de 7 a 15 y la de San Quintín de 6 a 15.

### La zona sale del pie, no de la fila del canal

Como en TikTok, con `zonas.alcance_redes` y la zona del canal **nunca**
consultada. Se publica `alcance` al lado de `zona`, con las mismas cinco
etiquetas y la misma tabla de `ambito`.

**La firma del canal es evidencia débil.** `sufijos_titulo` lista la firma que
el canal pone al final de sus títulos: «| TELEMUNDO SAN DIEGO» en 17 de 43.
Cuenta mientras el título no nombre otro lugar, y cede cuando lo nombra: el
caso fue «Tres muertos tras caída del helicóptero … en Los Ángeles», que iba
al muro de San Diego. Quitarla sin más era peor: casi todo lo demás que firma
es de San Diego, en barrios que el gacetero no conoce, y se habría ido a Mundo.

**El título manda; la descripción sólo desempata.** Se lee la descripción
únicamente cuando el título no nombra lugar alguno. Vale catorce puntos de
resolución —sobre 462 piezas, 35% con el título solo y 49% con las dos— pero
una descripción de YouTube no es el pie de un TikTok: trae fechas de gira,
listas de ciudades y texto fijo del canal, y cualquiera de esas le acredita a
una ciudad una pieza que no habla de ella, con `alcance: "zona"`, el veredicto
más fuerte. El caso, del 18 de septiembre de 2026: «Intocable recorre por
primera vez las calles del centro de CDMX», de N+, salió `zona: Tijuana` y
encabezó el muro de Tijuana. Limitarla cuesta poco y sobre todo redistribuye:
el corredor pasa de 228 a 225 piezas, Tijuana de 140 a 125 y Playas de
Rosarito de 22 a 29.

**Un mismo canal no repite titular.** `_destacados` colapsa por `(cuenta,
título plegado)` y se queda con la más vista, porque el corte es por formato y
un Short y un video de la misma nota ganaban su lugar cada uno en su cola sin
que nada los cruzara. Por cuenta y no globalmente: dos medios con el mismo
titular es pluralidad de cobertura. El archivo conserva las dos.

El caso, medido: la fila de El Vigía dice Ensenada y nueve de sus quince Shorts
son nacionales —Trump, Milei, las Malvinas, Morelos, Cuautla—, con el más visto
de toda la corrida, 3,985 vistas, hablando de Trump y la Unión Europea.
Estamparle la zona de la fila pondría eso al frente del muro de Ensenada. No es
aislado: PSN dice Tijuana y sus seis Shorts salieron `nacional`; Síntesis dice
Tijuana y publicó San Diego; AFN dice Tijuana y publicó Ensenada. El feed de
YouTube de un medio es su canal nacional y viral, no su cobertura municipal.

Por eso `config/youtube.json` **no tiene campo `zona`** y el validador lo
rechaza: un campo que existe acaba pasándose. La `zona` de cada fila de
`cuentas[]` es `estatal`, que es como este repo escribe «no reclama un lugar».

### `salud[]`

| campo | qué cuenta |
|---|---|
| `entradas` | cuántas `<entry>` devolvió el feed. No hay un conteo facturado que reportar —no se paga nada— y es el denominador honesto de lo de abajo. |
| `posts` | cuántas entraron al catálogo. |
| `reclasificados` | cuántas venían en una lista y su enlace decía el otro formato. Ver arriba. |
| `descartados` | enlace ilegible, sin fecha, o formato apagado en el config. |
| `fuera` | tiradas por el ámbito: nombran un lugar de fuera de Baja California en una fila `regional`. |
| `estado` | `ok`, `fallo` o **`sin_lista`**. |

`sin_lista` es el 404 de una lista automática que el canal no tiene —el caso es
`yt_televisamxl`, que no tiene Shorts—. No es `fallo`, porque nada se rompió, y
no es `ok` con `posts: 0`, porque eso se lee «hoy no publicó». Es «sin dato»
contra «0» en la banda de salud.

`crudos`, `comentarios` y `con_subtitulos` no existen aquí.

### `gasto`

Sale en ceros y eso es correcto: este módulo no gasta. Se emite igual para que
el documento no cambie de forma entre plataformas.

### No hay `data/youtube-comentarios.json`

No se cosechan comentarios, así que no hay archivo de texto. El glob
`data/*-comentarios.json` de `.gitignore` ya lo cubriría el día que se
enciendan —es exactamente el caso que ese glob anticipó—, y el validador
verifica la línea en cuanto el archivo exista.

### `config/youtube.json`

Canales, no búsquedas. Existe aparte de `config/canales.json` —el catálogo del
módulo de la API— porque los dos leen canales de YouTube y ahí se acaba el
parecido: allá `zona` es obligatoria y aquí es un error, allá el documento
explica la cuota de la API y aquí no aplica, y los `activo` de allá responden
preguntas sobre videos largos que no dicen nada de los Shorts.

| campo | qué es |
|---|---|
| `id` | `^yt_[a-z0-9_]{2,20}$` |
| `canal` | el id `UC…` de 24 caracteres. Las listas se arman **reemplazando** el `UC` por `UUSH` o `UULF`, no anteponiéndolo. |
| `formatos` | subconjunto no vacío de `["short", "video"]`. Es para apagar un formato que el canal publica y **no sirve** —El Vigía entra como `["short"]` porque sus videos son «Resumen diario», digestos publicados por duplicado—, no uno que no publica. |
| `ambito` | `regional` \| `nacional` \| `internacional`. Decide el residuo, nunca la zona. |
| `sufijos_titulo` | opcional: la firma del canal al final del título, como lista de textos de 4 caracteres o más. Evidencia débil para el gacetero; el título se publica tal cual. |
| `idioma` | `es` \| `en`. Del config, nunca adivinado del texto. |
| `activo`, `verificado`, `nota` | La `nota` cita el sondeo con sus números; es de donde salen los porcentajes de este documento. |

**No lleva `zona`**, y el validador lo dice con el caso de El Vigía en el
mensaje.


## `data/facebook.json` — páginas de medios en Facebook

Lo escribe `python -m pulso facebook` desde el 23 de septiembre de 2026, con
las páginas de `config/facebook.json`. Es el contrato de `data/redes.json`
(`plataforma: "facebook"`, ventana en horas sobre `publicado`, reparto de una
vuelta por cuenta en el corte), con cuatro diferencias:

- **`compartidos` es obligatorio** en cada destacado, como en TikTok: Facebook
  sí lo publica, así que un 0 es cero medido. No hay `guardados`.
- **`likes` es el total de reacciones** (me gusta, me encanta, me asombra…),
  que es lo que el actor llama `likes` y lo que Facebook muestra junto al post.
- **`alcance` es obligatorio**: ninguna página lleva `zona`. Cada post se
  zonifica por su primera línea con `redes.zona_por_titulo` y el residuo de
  medio del corredor (`estatal` con `alcance: nacional`, «un lugar sin
  precisar»). Una página `regional` tira el post que nombra un lugar mexicano
  fuera de Baja California y lo cuenta en `salud[].fuera`.
- **Los comentarios son parciales a propósito.** Solo `comentarios_para`
  posts por página y corrida —los de más reacciones dentro de la ventana que
  no se cosecharon antes— pagan la segunda pasada. Un destacado con
  `cosechados: 0` es lo esperado y el validador no avisa por él.

`salud[]` suma `compartidos`: los posts que solo comparten otro, con un enlace
por todo texto, no entran (ver `pulso/facebook.py`). Las claves de identidad
del actor (`profileName`, `profileId`, `profileUrl`, `profilePicture`, `user`,
`sharedPost`, `topComments`, `facebookId`, `feedbackId`) son error en
cualquier parte del archivo.

## `data/facebook-comentarios.json` — el texto de los comentarios de Facebook

Mismo contrato que `data/redes-comentarios.json`, con `plataforma:
"facebook"`, emparejado con el `data/facebook.json` del mismo corte. Fuera de
git por el glob `data/*-comentarios.json`; el validador comprueba la línea en
cuanto el archivo existe.

### `config/facebook.json`

| campo | qué es |
|---|---|
| `id` | `^[a-z0-9_]{2,20}_fb$`, el `cuenta` de cada destacado |
| `pagina` | nombre de usuario de la página, o su id numérico si no tiene; nunca una URL |
| `nombre` | lo que se imprime como fuente |
| `ambito` | `regional`, `nacional` o `internacional`; decide el residuo, nunca la zona |
| `idioma` | `es` o `en`, declarado |
| `marca`, `seguidores` | la regla de una marca, una red, junto con Instagram y TikTok |
| `activo`, `verificado` | una fila activa necesita la fecha del `facebook --sondear` que la probó |
| `razon` | lo que el sondeo devolvió |

`zona` es error. `cosecha` lleva `posts_por_pagina`, `comentarios_por_post`,
`comentarios_para`, `dias_entre_cosechas`, `ventana_horas` y
`presupuesto_resultados`, todos enteros positivos.

## `data/tendencias.json` — tendencias de X por ubicación

Lo escribe `python -m pulso tendencias`, vía Apify y **sin iniciar sesión**: el
actor `automation-lab~twitter-trends-scraper` lee el endpoint de tendencias de
X con un guest token, la credencial anónima de un navegador sin cuenta. X entra
al tablero **solo por tendencias**; los tuits siguen fuera, porque sus
raspadores piden cookies (ver `senuelos` en `config/apify.json`). Es opcional:
si falta, el validador no se queja. La alternativa limpia queda escrita: la API
oficial de X cobra 0.01 USD por llamada a `GET /2/trends/by/woeid` (pago por
uso, 2026).

```json
{
 "esquema": 1,
 "generado": "2026-09-11T18:17:00+00:00",
 "plataforma": "x",
 "acceso": "sin_sesion",
 "maximo_por_ubicacion": 20,
 "ubicaciones": [
  {"id": "ensenada", "nombre": "Ensenada", "woeid": null, "zona": "Ensenada", "ambito": "zona", "activa": false, "estado": "sin_lista", "corte": null, "tendencias": []},
  {"id": "mexico", "nombre": "México", "woeid": 23424900, "zona": null, "ambito": "nacional", "activa": true, "estado": "ok", "corte": "2026-09-11T18:10:00+00:00",
   "tendencias": [
    {"puesto": 1, "nombre": "#GritoDeIndependencia", "url": "https://x.com/search?q=%23GritoDeIndependencia", "volumen": 25400},
    {"puesto": 3, "nombre": "Garita San Ysidro", "url": "https://x.com/search?q=%22Garita%20San%20Ysidro%22"}
   ]},
  {"id": "tijuana", "nombre": "Tijuana", "woeid": 149361, "zona": "Tijuana", "ambito": "zona", "activa": true, "estado": "ok", "corte": "2026-09-11T18:10:00+00:00",
   "tendencias": [{"puesto": 1, "nombre": "Garita San Ysidro", "url": "https://x.com/search?q=%22Garita%20San%20Ysidro%22"}]}
 ],
 "salud": [
  {"ubicacion": "mexico", "estado": "ok", "tendencias": 2, "promocionadas": 1},
  {"ubicacion": "tijuana", "estado": "ok", "tendencias": 1, "promocionadas": 0}
 ],
 "gasto": {"resultados": 200, "gastado": 101, "por_concepto": {"automation-lab~twitter-trends-scraper": 101}}
}
```

Siete reglas que el módulo impone, no sugiere:

1. **El ranking es de X, no nuestro.** `puesto` es el rank que devuelve X y no
   se renumera al quitar promocionadas: un hueco en la numeración es la huella
   de un anuncio. El validador exige `puesto` estrictamente creciente. El
   tablero dice «según X».
2. **Solo nombre, puesto y liga.** Ni un tuit ni quién lo escribió; un nombre
   que empieza con `@` se descarta al ingerir y es error en `data/`. Los campos
   crudos del actor (`tweetVolume`, `isPromoted`, `twitterSearchUrl`…) son
   claves prohibidas: si uno aparece, la lista blanca de
   `pulso/tendencias.py::_limpiar` se rompió. La `url` la construye el pipeline
   (`https://x.com/search?q=`), nunca se copia del actor.
3. **`volumen` solo cuando X lo da y es mayor que 0.** X retiró el volumen de
   casi todas las tendencias en enero de 2026; ausente es «sin dato», nunca 0,
   y un 0 es error.
4. **Una fila por ubicación del config, activa o hueco.** Cada zona del
   producto salvo `estatal` aparece exactamente una vez: Tijuana, Mexicali y
   San Diego con lista; Ensenada, Rosarito, Tecate, San Quintín y San Felipe
   como `activa: false, estado: "sin_lista"`, porque X no publica lista para
   ellas y el tablero rotula el hueco en vez de mostrar la nacional como si
   fuera local. México es `nacional` y el mundo `mundial`; ninguno lleva `zona`.
5. **`estado`** ∈ `ok | fallo | sin_token | sin_dato | sin_lista`. `ok` si y
   solo si hay tendencias; `sin_lista` si y solo si la fila está apagada.
   `salud` lleva una fila por ubicación activa, ordenada por `ubicacion`, con
   `estado`, `tendencias` (las que quedaron) y `promocionadas` (los anuncios
   descartados), y tiene que cuadrar con `ubicaciones`.
6. **`corte`** es la hora en que el actor recibió la lista de X (`asOf`), en
   UTC y en el formato de `generado`. Llega unos segundos después de
   `generado`, porque `generado` se toma antes de la llamada: eso es lo normal.
   Más de quince minutos después es **aviso**, no error: otro reloj o un
   archivo editado, y tampoco puede tumbar el commit de todo `data/`.
7. **Determinismo.** `ubicaciones` por `id`, `tendencias` por `puesto`,
   `salud` por `ubicacion`, `gasto.por_concepto` por clave. Dos corridas sobre
   la misma respuesta escriben bytes idénticos.

Un límite del dato, visto en el primer sondeo (11 de septiembre de 2026):
Tijuana, Mexicali y México devolvieron la misma lista en el mismo orden. X
publica el WOEID de la ciudad pero puede llenarlo con la lista nacional; el
archivo no lo deduplica —cada ubicación lleva lo que X devolvió— y el tablero
lo rotula cuando una ciudad coincide exactamente con México.

### `config/tendencias.json`

`ubicaciones[]` con `id` (`^[a-z0-9_]{2,12}$`), `nombre`, `woeid` (entero en
una activa, `null` en un hueco), `zona` (nombre de zona cuando `ambito` es
`zona`; `null` para `nacional` y `mundial`), `ambito`, `activo` y `razon`. Una
activa cita la fecha en que `python -m pulso tendencias --ubicaciones`
confirmó su WOEID —es el `--sondear` de esta sección—; un hueco cita por qué
no hay lista. Cada zona del producto salvo `estatal` tiene exactamente una
fila. `cosecha` trae `maximo_por_ubicacion` (1–50, el tope de X) y
`presupuesto_resultados`, que tiene que cubrir ubicaciones × máximo porque el
actor recortaría en silencio. `actor` es el id de Apify. Lo valida
`validar_tendencias_config`, que además pasa la entrada construida por la
guardia de sesión de `pulso/apify.py`.

## `data/consultas.json` — qué se dice de un término

Lo escribe `python -m pulso consultas` (`pulso/consultas.py`), a mano y fuera
del cron, desde el 18 de septiembre de 2026. Por cada **término** de
`config/consultas.json` —una marca o una persona— junta lo que dicen TikTok
(búsqueda), Instagram (cuentas y etiquetas) y Facebook (páginas públicas) en
los últimos **30 días**, y lo que dice la prensa en los últimos **seis meses**
(`ventana_prensa_dias`): el buscador de noticias más el buscador propio de
cada medio de `buscadores`, con el tono de cada titular. Lo valida
`validar_consultas`. La prensa se lee de **todas** las filas, apagadas
incluidas; una fila apagada sale con sus tres redes en `sin_dato`.

```json
{
 "esquema": 1,
 "generado": "2026-09-18T18:00:00+00:00",
 "ventana_dias": 30,
 "ventana_prensa_dias": 180,
 "retencion_dias": 30,
 "destacados_maximo": 10,
 "consultas": [
  {
   "id": "cq_vivelabaja",
   "termino": "Vive la Baja",
   "tipo": "empresa",
   "idioma": "es",
   "plataformas": {
    "tiktok": {
     "estado": "ok",
     "publicaciones": 14,
     "comentarios_cosechados": 212,
     "opinion": 190,
     "destacados": [
      {"url": "https://www.tiktok.com/@x/video/1", "cuenta": "cq_vivelabaja",
       "origen": "busqueda", "fuente": "vive la baja", "creador": "@x",
       "zona": "Ensenada", "alcance": "zona",
       "publicado": "2026-09-10T15:00:00+00:00", "fecha": "2026-09-10",
       "titulo": "Ruta del vino en Valle de Guadalupe", "tipo": "video",
       "likes": 1834, "comentarios": 212, "compartidos": 41, "guardados": 12,
       "reproducciones": 90000, "duracion": 47,
       "cosechados": 20, "opinion": 18,
       "sentimiento": {"positivo": 9, "negativo": 2, "neutral": 7, "sin_clasificar": 0, "sin_modelo_idioma": 0}}
     ],
     "salud": [
      {"consulta": "cq_vivelabaja", "plataforma": "tiktok", "origen": "busqueda",
       "fuente": "vive la baja", "estado": "ok", "posts": 14, "comentarios": 212,
       "crudos": 230, "descartados": 1, "fuera": 0}
     ]
    },
    "instagram": {"estado": "ok", "publicaciones": 22, "comentarios_cosechados": 140, "opinion": 121, "destacados": [], "salud": []},
    "facebook": {"estado": "ok", "publicaciones": 9, "comentarios_cosechados": 60, "opinion": 55, "destacados": [], "salud": []},
    "youtube": {"estado": "sin_dato", "razon": "No se consulta YouTube por término."},
    "x": {"estado": "sin_dato", "razon": "De X solo se leen tendencias, no publicaciones."}
   },
   "prensa": {
    "estado": "ok",
    "ventana_dias": 180,
    "resultados": [
     {"titulo": "Vive la Baja abre temporada en Ensenada",
      "url": "https://news.google.com/rss/articles/CBMiX…",
      "dominio": "elvigia.net", "fuente": "El Vigía", "fecha": "2026-09-14",
      "origen": "noticias", "tono": "favorable"},
     {"titulo": "Vecinos reclaman a Vive la Baja por el ruido del festival",
      "url": "https://zetatijuana.com/2026/07/vecinos-reclaman…",
      "dominio": "zetatijuana.com", "fuente": "Zeta", "fecha": "2026-07-02",
      "origen": "medio", "tono": "adversa"}
    ],
    "anteriores": [
     {"titulo": "Vive la Baja: la primera temporada", "url": "https://zetatijuana.com/2025/…",
      "dominio": "zetatijuana.com", "fuente": "Zeta", "fecha": "2025-11-02",
      "origen": "medio", "tono": "neutral"}
    ],
    "excluidos": 2,
    "tono": {"favorable": 1, "adversa": 1, "neutral": 0, "sin_clasificar": 0, "sin_modelo_idioma": 0,
             "titulares": 2, "metodo": "modelo", "modelo": "pysentimiento/robertuito-sentiment-analysis"},
    "por_medio": [
     {"fuente": "El Vigía", "dominio": "elvigia.net", "titulares": 1, "favorable": 1, "adversa": 0, "neutral": 0},
     {"fuente": "Zeta", "dominio": "zetatijuana.com", "titulares": 1, "favorable": 0, "adversa": 1, "neutral": 0}
    ],
    "buscadores": [
     {"id": "noticias", "nombre": "buscador de noticias", "estado": "ok", "titulares": 1, "anteriores": 0},
     {"id": "zeta", "nombre": "Zeta", "estado": "ok", "titulares": 1, "anteriores": 1}
    ],
    "muestra": "El buscador de noticias y el buscador propio de 5 medios, titulares de los últimos 180 días",
    "archivo": {"coincidencias": 0, "medios": 18, "busquedas": 6,
                "muestra": "18 medios del catálogo y 6 búsquedas, titulares de los últimos 180 días"}
   },
   "agregados": [
    {"titulo": "“Dinero seguro”, invertir en un terreno en Tijuana",
     "url": "https://zetatijuana.com/2026/05/dinero-seguro-invertir-en-un-terreno-en-tijuana/",
     "fuente": "Semanario ZETA", "fecha": "2026-05-18", "origen": "manual", "tono": "neutral"},
    {"titulo": "¡Sigue la impunidad! Señalan a empresario…",
     "url": "https://www.facebook.com/TijuanaLineaRoja/posts/1493856925630886/",
     "fuente": "Tijuana Línea Roja (Facebook)", "fecha": null, "origen": "manual", "tono": "adversa"}
   ],
   "tono": {
    "positivo": 120, "negativo": 31, "neutral": 160, "sin_clasificar": 0, "sin_modelo_idioma": 0,
    "comentarios": 311, "metodo": "modelo", "modelo": "pysentimiento/robertuito-sentiment-analysis",
    "salvedad_tono": "Conteo del tono de cada comentario según un modelo que lee frases, no posturas: …"
   },
   "tono_publicaciones": {
    "positivo": 3, "negativo": 0, "neutral": 5, "sin_clasificar": 0, "sin_modelo_idioma": 0,
    "publicaciones": 8, "metodo": "modelo", "modelo": "pysentimiento/robertuito-sentiment-analysis"
   },
   "temas": {"minimo": 3, "comentarios": 311, "temas": [{"termino": "valle guadalupe", "n": 14}]}
  }
 ],
 "gasto": {"resultados": 7000, "gastado": 1812, "por_concepto": {"cq_vivelabaja": 1812}}
}
```

Lo que el esquema decide, y por qué:

- **`cuenta` es el id del término**, y cada destacado lleva `origen`
  (`busqueda` | `cuenta` | `hashtag` | `pagina`) y `fuente` (la consulta
  literal, el `@handle`, la etiqueta o el slug de la página). Un término no es
  una cuenta ni un lugar: la zona sale del texto con el gacetero y `ambito`
  nacional en las **tres** plataformas —también en Instagram, donde
  `redes.json` la estampa desde la fila—, así que `alcance` viaja siempre. Un
  post que nombra Guadalajara queda `nacional/fuera`: es lo que la consulta fue
  a buscar. Desde el 22 de septiembre de 2026 uno que nombra Madrid queda
  `internacional/extranjero`, en vez de pasar por nota nacional mexicana.
- **Cada plataforma publica sus cifras y nada más.** TikTok trae `creador`,
  `compartidos`, `guardados` y `duracion`; Facebook trae `compartidos` (un 0 es
  cero medido); Instagram no trae ninguno de los tres y su ausencia es «sin
  dato». `reproducciones` solo si es mayor que 0. Orden explícito
  `(-likes, -comentarios, url)`, un solo corte global por plataforma —aquí la
  pregunta es qué se dice del término, no qué pasa en cada ciudad—, tope
  `destacados_maximo`. Sin `temas` por destacado: los temas son del término.
- **YouTube y X van como `sin_dato` con `razon` y sin un solo conteo.** Un 0
  se leería como «nadie habló» cuando lo cierto es que no se leyó. Lo mismo
  vale para una plataforma en la que el término no tiene fuentes (la persona
  no tiene cuenta de marca) o cuya fila está apagada. `razon` es para quien lee
  el archivo y va en registro de producto (el validador rechaza Apify, API,
  token, git, actor, cron o pipeline dentro); **la página y el PDF dicen solo
  «sin dato»**, por pedido del cliente del 18 de septiembre de 2026.
- **La prensa mide seis meses y cada titular lleva `tono`.** `ventana_dias`
  del bloque es la `ventana_prensa_dias` de la raíz (hasta 365; un titular no
  es conversación y no lo ata la retención de 30 días). `tono` es `favorable`
  | `adversa` | `neutral` | `null`, el vocabulario de la prensa del muro y
  nunca el de los comentarios: las dos series no se suman y por eso no
  comparten etiquetas (`docs/PLAN.md` §6). `null` es «sin tono» (no corrió el
  modelo, o el medio publica en un idioma que el modelo no lee), nunca
  «neutral» por omisión. El bloque `tono` son cinco cubetas que suman
  `titulares` y tienen que ser exactamente el recuento de `resultados`;
  `por_medio` reparte lo mismo por medio, ordenado `(-titulares, fuente)`.
- **Dos caminos, y `origen` dice cuál.** `noticias`: el buscador de noticias;
  `url` es el enlace opaco tal cual, nunca resuelto (ver
  `config/busquedas.json`), y nada de esto pasa por `notas.json`. `medio`: el
  buscador propio de un medio de `buscadores` (`config/consultas.json`), el RSS
  de búsqueda de WordPress; `url` es la nota en el sitio del medio, https, y su
  host es el `dominio`. Solo entran los titulares que **nombran** el término:
  el buscador del medio empareja contra el cuerpo, que aquí no se lee. Los
  repetidos entre caminos se quedan con el enlace del medio.
- **`anteriores` son los titulares que nombran el término antes de la
  ventana**, misma forma, con fecha y tono por fila, hasta 10, solo del
  buscador de un medio (el de noticias los filtra antes). No entran a `tono`
  ni a `por_medio`; se publican para no esconder lo que el buscador ya
  devolvió. El caso: los dos titulares más duros sobre Grupo Concordia son del
  11 de marzo de 2026, una semana fuera de los 180 días.
- **`excluidos` es cuántos titulares se descartaron a mano**, con su razón
  escrita en `config/consultas.json`. Se publica el conteo porque una lista
  curada que no dijera que lo fue afirmaría que la búsqueda devolvió justo
  eso. El emparejado es por **titular** y no por enlace —el del buscador de
  noticias rota entre corridas y la exclusión dejaría de aplicar sola— y por
  contención, porque el mismo titular llega con y sin el sufijo « - Medio»
  según el camino.
- **`consultas[].agregados` son los enlaces que la fila trae A MANO**, en su
  propia lista y **nunca dentro de `prensa`**: uno de ellos es un post de
  Facebook y no prensa, y sumarlos allí haría falso el conteo de al lado, que
  dice cuántos titulares *nombran* el término en la ventana. Cada uno lleva
  `titulo`, `url`, `fuente`, `fecha` (o `null`, que se pinta «sin fecha» y no
  se inventa), `origen: "manual"` y `tono`; van ordenados por fecha
  descendente con los de fecha ausente al final, y **no llevan cubetas**: dos
  titulares no hacen un conteo. La clave se omite cuando nadie agregó nada.
  Su ventana es la del enlace, no la de la prensa: se pidieron por nombre.
- **`buscadores` y `muestra` dicen qué se buscó**: una fila por buscador
  (`noticias` primero) con `estado` `ok` | `fallo` | `robots` y sus conteos.
  `robots` es un robots.txt que no permite la búsqueda con el agente del
  pipeline, o que no se pudo leer. El bloque es `ok` si al menos uno
  respondió.
- **`archivo.coincidencias`** cuenta los titulares del archivo propio que
  nombran el término dentro de la ventana **de la prensa**, y `muestra` dice
  sobre qué archivo se contó; la clave no es `notas` porque `notas` es clave
  prohibida en `data/`. Si el archivo está vacío el bloque se omite en vez de
  afirmar cero.
- **`tono` son cinco cubetas que suman `comentarios`**, sobre la opinión del
  término en las tres plataformas (sin brigada ni reacciones, como en
  `redes.json`), y **también para la fila `persona`**, por decisión del cliente
  del 18 de septiembre de 2026 (`docs/PLAN.md`). Por eso viaja `salvedad_tono`
  con el texto exacto de `pulso/consultas.py::SALVEDAD_TONO`: el validador lo
  compara por igualdad, en la misma postura que `SALVEDAD_FIJA` en `web/`.
  Desde el 23 de septiembre de 2026 la **pantalla** ya no la pinta (pedido del
  cliente); el dato la sigue trayendo y el PDF la sigue imprimiendo.
- **`tono_publicaciones` son cinco cubetas que suman `publicaciones`**, el tono
  del **pie** de cada publicación de la ventana (su `titulo`, nunca el pie
  entero), con el mismo modelo y las mismas cubetas que los comentarios.
  `publicaciones` es la suma de las `publicaciones` de los bloques leídos, y el
  validador exige que coincidan: la tarjeta de publicaciones dice un total y un
  tono, y tienen que ser del mismo conjunto. El idioma es el de la fila del
  config, nunca adivinado del pie. Existe desde el 23 de septiembre de 2026,
  cuando la dirección del cliente pidió contar noticias, publicaciones y
  comentarios positivos y negativos; un corte anterior no lo trae, pasa con
  aviso y la pantalla dice «sin dato» para ese tono, nunca cero.
- **`temas.temas[]` solo trae `{termino, n}`.** `temas.temas()` devuelve
  además `ejemplos` (texto de comentarios, que no entra a `data/`) y
  `n_previo`/`momento` (la ventana anterior nunca está en un cache de 30 días:
  saldrían siempre en cero, relleno). El propio término se quita: que «vive la
  baja» sea el tema de los comentarios sobre Vive la Baja no dice nada.
- **`ventana_dias` no puede exceder 30**, la retención del cache: una ventana
  más larga pediría texto que ya se purgó.

### El cache es por término

`cache/consultas/<cq_id>/<plataforma>/`, con la disciplina de `redes.py`:
texto crudo con 30 días de retención y fuera de git, `vistos.json` como freno
de costo (`dias_entre_cosechas: 7`, no 3: con 30 días de ventana, 3 repagaría
los comentarios de cada publicación unas diez veces al mes) y
`publicaciones.json` como catálogo. Un video que encuentran dos términos se
guardaría una sola vez en un cache compartido y su `cuenta` sería la del
término que corrió al último.

## `data/consultas-comentarios.json` — el texto de los comentarios de un término

Fuera de git por el glob `data/*-comentarios.json`, como los otros dos. Misma
forma y mismas reglas que `redes-comentarios.json` —las cuatro claves exactas
por comentario, menciones enmascaradas, «ver más» solo con likes, brigada y
reacciones fuera, 300 caracteres—, con `plataforma: "consultas"` y las urls de
las tres plataformas en un solo mapa ordenado. Cada url tiene que ser un
destacado de `consultas.json` del mismo corte; lo valida
`validar_consultas_comentarios`.

### `config/consultas.json`

```json
{
 "cosecha": {"ventana_dias": 30, "ventana_prensa_dias": 180, "posts_por_fuente": 20, "comentarios_por_post": 20,
             "dias_entre_cosechas": 7, "presupuesto_resultados": 7000, "prensa_por_consulta": 20,
             "destacados_maximo": 10, "filtro_fecha_tiktok": "PAST_MONTH", "orden_tiktok": "MOST_RELEVANT"},
 "buscadores": [
  {"id": "blancoynegro", "nombre": "Blanco y Negro Noticias",
   "url": "https://blancoynegro.mx/?s={q}&feed=rss2", "idioma": "es",
   "activo": true, "verificado": "2026-09-18", "nota": "…"}
 ],
 "consultas": [
  {"id": "cq_vivelabaja", "termino": "Vive la Baja", "tipo": "empresa", "idioma": "es",
   "activo": false, "verificado": null,
   "tiktok": {"consulta": "vive la baja"},
   "instagram": {"hashtags": ["vivelabaja"], "cuentas": ["@vivelabaja"]},
   "facebook": {"paginas": ["vivelabaja"]},
   "prensa": {"q": "\"Vive la Baja\"",
              "excluidos": [{"titulo": "…un fragmento distintivo…", "razon": "…"}]},
   "agregados": [{"url": "https://…", "titulo": "…", "fuente": "…",
                  "fecha": "2026-05-18", "nota": "…"}],
   "nota": "…"}
 ]
}
```

`id` cumple `^cq_[a-z0-9_]{2,20}$`; `tipo` es `persona` | `empresa` | `tema`;
`zona` en una fila es error. Una fila cosecha **redes** solo con `activo: true`
**y** `verificado` con fecha —la del primer `python -m pulso consultas --probar`
que devolvió publicaciones razonables, anotadas en su `nota`—, y una fila
activa sin fecha es error; la **prensa** se lee de todas las filas, porque no
cuesta ni exige sondear un handle. `ventana_prensa_dias` va de 1 a 365 (180
por omisión: seis meses, y el buscador de noticias acepta `when:180d` pero no
`when:6m`).

`buscadores` son los buscadores propios de los medios (el RSS de búsqueda de
WordPress, `/?s={q}&feed=rss2`), consultados para **todos** los términos con
el término sin comillas —WordPress manda las comillas al LIKE tal cual— y el
filtro por titular del pipeline. Cada fila lleva `id` (`^[a-z0-9_]{2,20}$`, y
no `noticias`, que es el buscador de noticias), `nombre`, `url` https con
`{q}` exactamente una vez y host fijo, `idioma`, `activo`, `verificado` y
`nota`; `activo` sin `verificado` es error, con la misma disciplina que una
fila de término (Uniradio devuelve su portada entera ignorando el término,
medido el 18 de septiembre de 2026, y nada lo habría delatado). Si el `id` es
un medio de `config/medios.json`, el host tiene que ser el del medio, para que
`fuente` no atribuya a un medio lo que publicó otro. robots.txt se consulta en
cada corrida con el agente del pipeline.

**La curación a mano vive en el config y se justifica por escrito**, como una
fila apagada de cualquier catálogo de este repo. `prensa.excluidos` es una
lista de `{titulo, razon}`: el título tiene que medir al menos 12 caracteres
—se empareja por contención y uno corto descartaría de más, en silencio— y la
razón es obligatoria. `agregados` es una lista de `{url, titulo, fuente,
fecha, nota}`, con `url` https, `fecha` nula o real, y `nota` obligatoria. Los
tres agregados del 21 de septiembre de 2026 existen porque su **titular no
nombra el término** —lo nombra el cuerpo, que aquí no se lee—, así que ninguna
búsqueda automática los traería; una prueba fija esa condición, para que un
enlace que sí se puede encontrar solo no viva en esta lista. `facebook.busqueda` es error mientras
`pulso/facebook.py::ACTOR_BUSQUEDA` sea `None`: la búsqueda por palabra en
Facebook exige sesión del proveedor. `presupuesto_resultados` tiene que cubrir
**todas** las fuentes configuradas, activas o no —fuentes × `posts_por_fuente`
× (1 + `comentarios_por_post`)—, para que encender una no recorte a las demás
en silencio (la lección de `config/tiktok.json`). Lo valida
`validar_consultas_config`.

## La búsqueda en vivo de un término — dos rutas, ningún archivo

Desde el 23 de septiembre de 2026 la lupa de Redes responde cualquier término
(ver AGENTS.md, «Búsqueda en vivo de un término»). **No escribe nada en
`data/`**: lo que sigue es el contrato de dos respuestas, que no valida
`pulso/validador.py` porque no pasan por él. Su espejo es TypeScript
(`web/src/lib/busqueda/termino.ts`, `web/src/lib/redes-en-vivo/responder.ts`)
y lo fija `web/scripts/probar-redes-en-vivo.cjs`.

Las dos traen **piezas** de una consulta y no la consulta armada: la arma el
navegador con `lib/dominio/termino-vivo.ts::armarConsulta` sobre la lista final
de publicaciones, sin repetidas, para que una publicación que traigan las dos
no cuente dos veces. El resultado tiene exactamente la forma de un elemento de
`consultas[]` de `data/consultas.json`, con una diferencia: `plataformas.youtube`
puede traer datos (los videos de los canales que el tablero ya lee y nombran el
término). X es siempre `sin_dato`.

```json
{
 "termino": "vive la baja",
 "generado": "2026-09-23T18:00:00.000Z",
 "figura": false,
 "prensa": { "estado": "ok", "ventana_dias": 180, "resultados": [], "anteriores": [], "tono": {}, "por_medio": [], "buscadores": [] },
 "redes": { "instagram": [], "youtube": [] },
 "salud": [],
 "pies": { "https://www.instagram.com/p/…/": "positivo" },
 "metodo": "modelo",
 "modelo": "pysentimiento/robertuito-sentiment-analysis"
}
```

- `redes` **sin una red** es «esa red no se leyó» (`sin_dato`); una red leída y
  vacía viaja como lista vacía. La pantalla distingue las dos.
- `pies` es el tono del pie de cada publicación en el vocabulario de los
  comentarios, más `sin_modelo_idioma` (la fila declara otro idioma) y
  `sin_clasificar` (el servicio no respondió). Una url que falta cuenta como
  `sin_clasificar`, nunca como neutral.
- `figura: true` cuando el término nombra a alguien del roster, o cuando el
  roster no se pudo leer: entonces no se pidió ningún tono y todo cae en
  `sin_clasificar` (regla 5 de PRODUCT.md).
- Los destacados en vivo llevan `cuenta: "vivo"`, `zona: "nacional"` sin
  `alcance` (el gacetero es Python y la búsqueda de un término no lo usa),
  `origen` (`busqueda` o `hashtag`) y `fuente` (el término, la etiqueta, el
  slug de la página o «Facebook»). **Nunca** el autor de un post de Facebook.

### `GET /api/termino?q=` — la mitad gratuita

`{ consulta, piezas, textos, tendencias, redesEnVivo }`. `textos` tiene la forma
de `redes-comentarios.json` con los comentarios ya publicados de las
publicaciones que nombran el término. `tendencias` son las filas de
`tendencias.json` que lo nombran: `{ lugar, puesto, nombre, url }`, nunca un
tuit. `redesEnVivo` dice si el botón de la mitad pagada se puede ofrecer.
`Cache-Control: private`: lleva texto de comentarios.

### `POST /api/redes-en-vivo` y `GET /api/redes-en-vivo?id=&q=` — la pagada

El POST recibe `{ q }` y devuelve `{ id }` (202 si arrancó, 200 si reusó una
búsqueda del mismo término de las últimas seis horas). Errores con `codigo`:
`apagado` (400: falta la bandera, el token, la base o `AUTH_SECRET`),
`limite_dia` y `limite_mes` (429), `no_disponible` (503), más los tres de
`validar.ts`. El GET necesita el término además del id —el id solo no abre una
búsqueda— y devuelve `{ id, estado, redes, piezas, textos }`, con `estado`
`buscando | listo | fallo` y el de cada red `sin_iniciar | buscando |
comentarios | listo | fallo`. `no-store` siempre.

El libro de gasto (`web/db/0002_busquedas_redes.sql`) no guarda ni el término
ni texto: una huella HMAC del término, las ids de las corridas y lo que costó
cada una.

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
