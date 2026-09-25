> **Publicidad Meta:** piloto manual en Gasto electoral. Dos lectores: el navegador (hoy bloqueado por robots) y la API oficial de la Biblioteca de Anuncios (`--api`, requiere token tras verificar identidad en Meta). Sondeo, importación, descubrimiento de páginas y límites de cobertura: [guía de operación](docs/publicidad-meta.md).

# Pulso N33

Inteligencia regional del corredor Tijuana–San Diego: Tijuana, Mexicali,
Tecate, Playas de Rosarito, Ensenada, San Quintín, San Felipe y San Diego.

Qué mide, qué cubre y qué **no** dice: [PRODUCT.md](PRODUCT.md). Este archivo
es el manual de operación. El plan completo está en
[docs/PLAN.md](docs/PLAN.md); los contratos de datos, en
[docs/datos.md](docs/datos.md); las reglas para modificar el código, en
[AGENTS.md](AGENTS.md).

Sin servidor y sin base de datos: GitHub Actions corre el pipeline, escribe
archivos JSON, los commitea al repo y publica un sitio estático que los lee.
El repo versionado es el histórico.

---

## Correr en local

Requiere Python 3.11. Scrapy se usa solo en los medios sin RSS útil:

```bash
python -m pip install -r requirements.txt
```

El clasificador de tono y sentimiento es **opcional** y pesa: torch en CPU
más un modelo de ~430 MB que se baja una vez. Sin él todo corre con
`--metodo ninguno`, que es la omisión.

```bash
python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
```

```bash
python -m pip install -r requirements-modelo.txt
```

```bash
python -m unittest discover -s tests -v
```

```bash
python -m pulso correr --metodo modelo
```

El descubrimiento opcional consulta GDELT cada seis horas en el workflow y
visita una vez las páginas publisher. No persiste snippets ni cuerpos:

```bash
python -m pulso correr --metodo modelo --descubrimiento-web
```

El catálogo oficial de delegaciones se mantiene explícitamente, fuera de la
ingesta normal:

```bash
python -m pulso delegaciones --actualizar
```

Eso ingesta los feeds, resuelve zonas y figuras, calcula temas (globales y por
zona), etiqueta el tono de cada titular y escribe `data/`. Sin `--metodo
modelo` las notas salen con `postura: null`. Para una corrida determinista sin
red, con los 15 titulares reales de `tests/fixtures/corpus.json`:

```bash
python -m pulso correr --sin-red
```

Indicadores oficiales: vivienda, suelo, crimen y percepción.

```bash
python -m pulso indicadores
```

Gasto electoral final de Baja California (INE 2024) y financiamiento público
partidista (IEEBC 2026), en archivos separados:

```bash
python -m pulso gasto-electoral
```

El comando une por `id_contabilidad`, lee solo los Anexos II dentro de los ZIP
grandes mediante HTTP Range y falla si las 194 candidaturas locales y 53
federales no quedan conciliadas o acompañadas por una incidencia. Para
refrescar únicamente las asignaciones del IEEBC:

```bash
python -m pulso gasto-electoral --solo-financiamiento
```

Para actualizar únicamente los dictámenes finales del INE, sin consultar el
financiamiento del IEEBC:

```bash
python -m pulso gasto-electoral --solo-gasto
```

Se salta solo si lo que hay tiene menos de una semana, porque estas fuentes
son trimestrales o mensuales. `--forzar` para bajarlas de nuevo, `--solo shf`
para una sola.

Comentarios de YouTube (requiere `YOUTUBE_API_KEY`, ver abajo):

```bash
python -m pulso conversacion --sentimiento modelo
```

Además de los canales verificados, el comando toma los tres temas principales
de `data/temas.json`, busca videos recientes y calcula conteos, preguntas,
interacciones y subtemas. Con `--sentimiento modelo` etiqueta cada comentario
**en el cache** (positivo, negativo o neutral) y publica solo los conteos por
zona y por tema. `--temas-busqueda 0` apaga la búsqueda; nunca se publica el
texto ni la identidad de quien comentó.

Validar todo:

```bash
python -m pulso validar
```

El tablero nuevo vive en `web/` (Next.js). Copia `data/` y el roster a
`web/public/data/` y levanta el servidor de desarrollo:

```bash
pnpm --dir web dev
```

Queda en `http://localhost:3000/`, con una página por zona: `/tijuana`,
`/mexicali`, `/ensenada`, `/rosarito`, `/tecate`, `/san-quintin`,
`/san-felipe` y `/san-diego`. Tras volver a correr el pipeline, `pnpm --dir web
datos` vuelve a copiar los JSON.

El tablero plano anterior (`sitio/`) sigue ahí y es lo que arma el workflow:

```bash
python -m pulso servir
```

Queda en `http://localhost:8000/`. **No hay paso de armado**: sirve `sitio/`
en la raíz y mapea `/data/` y `/config/` a las carpetas reales, así que
editar `sitio/app.js` o volver a correr el pipeline se ve con recargar la
página. Manda `Cache-Control: no-store`, que es justo el problema que este
servidor existe para evitar.

`--puerto 3000` para cambiar el puerto. `--publico` lo abre a la red local,
útil para verlo desde el teléfono y con la advertencia obvia de que cualquiera
en esa red lo puede ver.

Ojo: `cache/`, donde vive el texto crudo de comentarios, **no** es una de las
tres rutas mapeadas, así que el servidor no lo expone.

Para publicar (lo que usa el workflow) es otro comando, que sí copia todo a
una carpeta:

```bash
python -m pulso sitio
```

En PowerShell, exporta `$env:PYTHONUTF8 = "1"` antes para que los acentos
salgan bien en la consola.

---

## Qué hay dentro

| Ruta | Qué es |
|---|---|
| `pulso/pipeline.py` | orquesta: fetch, normalizar, fusionar, resolver, clasificar, escribir |
| `pulso/spiders/noticias.py` | extrae titulares de portadas configuradas, respetando robots.txt |
| `pulso/scraping.py` | integra una sola corrida de Scrapy con la salud del pipeline |
| `pulso/zonas.py` | gazetero y alcance geográfico: de qué zona habla una nota |
| `pulso/temas.py` | temas y tendencias por conteo de n-gramas |
| `pulso/roster.py` | resuelve figuras públicas con ventanas de vigencia |
| `pulso/conversacion.py` | comentarios de YouTube vía API oficial, con la regla de retención |
| `pulso/youtube.py` | Shorts y videos de YouTube por feed público: sin llave, sin cuota y sin costo |
| `pulso/sentimiento.py` | modelo local de tono y sentimiento; opcional, ver `requirements-modelo.txt` |
| `pulso/clasificar.py` | `clasificar_lote`: ninguno, diccionario o modelo, en lote y sin reclasificar lo vigente |
| `pulso/validador.py` | el esquema ejecutable |
| `config/roster.json` | funcionarios con vigencias y alias. **Entrada a mano** |
| `config/medios.json` | catálogo de fuentes RSS o Scrapy. **Entrada a mano** |
| `config/busquedas.json` | consultas permanentes en Google Noticias. **Entrada a mano**, opcional |
| `config/canales.json` | canales de YouTube y señuelos a evitar. **Entrada a mano** |
| `data/*.json` | salida del pipeline. La escribe el bot; no se edita |
| `cache/` | texto crudo de comentarios. **Ignorado por git**, TTL de 30 días |
| `sitio/` | el tablero plano anterior. HTML, CSS y JS, sin build |
| `web/` | el tablero por zona. Next.js, lee los mismos JSON |
| `tests/` | 340 pruebas con `unittest` |

---

## Las tres entradas que hay que mantener

Todo lo demás se genera. De estas tres depende que el producto no mienta.

### El roster

Los cargos cambian a media administración, así que el roster lleva ventanas
`desde` / `hasta` y la resolución **depende de la fecha de la nota**.

El caso testigo: el alcalde de Tijuana Ismael Burgueño se fue de licencia
indefinida y su suplente Abdiel Gutiérrez tomó el cargo el 21 de junio de
2026. Una lista de nombres fija le habría atribuido semanas de cobertura a la
persona equivocada. La tabla 2024–2027 de Wikipedia sigue listando a Burgueño.

Al relevar a alguien: ponle `hasta` a quien sale, agrega a quien entra con
`desde` **el mismo día** (la ventana es semiabierta, `hasta` es exclusivo),
separa `alias` (nombres propios, sin fecha) de `alias_cargo` (títulos del
puesto, con fecha), actualiza `verificado` y corre `python -m pulso validar`.
Si las vigencias se traslapan, falla y dice quiénes y por cuál alias.

Conviene revisarlo una vez al mes.

### Búsquedas en Google Noticias

Para los municipios sin medio local hay una segunda vía, en la misma corrida y
sin verbo aparte: las consultas de `config/busquedas.json` se leen del RSS de
búsqueda de Google Noticias. Se apagan renglón por renglón con
`"activo": false`, y el archivo entero es opcional.

Cada consulta trae su propio registro de salud, con `metodo: "busqueda"`. Los
dos conteos que hay que mirar ahí son `detalle.notas` y `detalle.sin_zona`:
el segundo dice cuántas de las que trajo **no llegan al muro** porque su
titular no nombra ningún lugar. Si una consulta corre muy alta en `sin_zona`,
está mal escrita — hay que darle topónimos.

El enlace que se guarda es el redirector de Google, no el del medio; el
dominio que rotula el muro sale del `<source>` del feed. El porqué está en
[docs/datos.md](docs/datos.md#configbusquedasjson).

### El catálogo de medios

Las fuentes con RSS se leen como antes. AFN, El Vigía y Baja News no exponen un
RSS útil para esta tarea y se leen con Scrapy desde una sola portada por medio,
con `ROBOTSTXT_OBEY`, AutoThrottle, una conexión por dominio y selectores
declarados en `config/medios.json`. No se sigue el cuerpo de los artículos.

Dos cosas que conviene saber:

- **El Imparcial** es el que más volumen aporta y el que menos relevancia
  regional tiene: su feed trae al grupo entero y la mayoría de sus notas son
  de Hermosillo. Por eso existe `pulso/zonas.py`.
- Un fallo parcial es normal y aparece en la franja de salud sin tumbar el
  pipeline. La corrida solo se marca en rojo si **ninguna** fuente responde.

### Los canales de YouTube

La lista fija de canales sigue siendo la base. Además se usan como máximo tres
llamadas de `search.list` por corrida para conectar los temas principales de
prensa con videos recientes. Su cubeta tiene tope de 100 llamadas al día: aun
con un cron horario son 72, dejando margen para ejecuciones manuales.

El archivo trae una sección `senuelos` con canales que **no** hay que usar y
por qué. Varios handles obvios resuelven a canales muertos que devolverían
vacío en silencio: `@UniradioInforma` no sube nada desde 2016 (el vivo es
`@uniradiobaja`) y `@afntijuana` desde 2007.

---

## YouTube (API de datos): llave y la regla de los 30 días

Esto es para el panel de **conversación** —comentarios y su tono—, que lee la
API de datos con llave. Los Shorts y los videos son el otro módulo de YouTube y
no necesitan nada de esto: ver «YouTube: Shorts y videos por feed público» más
abajo. Para encender el panel de conversación hacen falta dos cosas:

```bash
gh secret set YOUTUBE_API_KEY
```

```bash
gh variable set YOUTUBE_HABILITADO -b true
```

La llave se saca en `console.cloud.google.com`: habilitar «YouTube Data API
v3» y crear una llave de API. La cuota gratuita es de 10,000 unidades al día
por proyecto, no se compra, y ampliarla requiere una auditoría manual. El
presupuesto de este pipeline es de unos cientos de unidades diarias, y el
módulo lleva su propio contador que se detiene antes de agotar la cuota.

**El texto de los comentarios no se commitea, y no es por descuido.** Las
Políticas para Desarrolladores de YouTube (III.E.4.d) limitan el
almacenamiento a 30 días naturales, con obligación de borrar o refrescar. Un
repo de git no puede cumplir eso: lo commiteado vive en cada clon y en cada
commit anterior. Así que el texto crudo va a `cache/`, ignorado por git y
purgado en cada corrida, y al repo solo entra `data/conversacion.json` con
conteos y temas calculados por nosotros. Sin texto literal, sin id de
comentario y sin identidad de quien escribió.

Las mismas políticas (III.E.2.a) restringen **agregar** datos de canales de
distintos dueños, y un tablero que suma varios medios roza esa línea.
Conviene la opinión de un abogado antes de publicar este panel. Por eso viene
apagado detrás de una variable y no encendido por omisión.

---

## Apify: token y la regla de la sesión

Apify renta actores que raspan plataformas sociales. El token se saca en
`console.apify.com` → **Settings → API & Integrations**, y se guarda en dos
lugares distintos según dónde vaya a correr.

En tu máquina, como variable de entorno de la sesión —nunca en un archivo del
repo:

```powershell
$env:APIFY_TOKEN = "apify_api_..."
```

En GitHub, como secreto. `gh` lo pide por stdin, así que el token no queda en
el historial de la terminal:

```bash
gh secret set APIFY_TOKEN
```

```bash
gh variable set APIFY_HABILITADO -b true
```

Comprueba que quedó bien antes de esperar al cron. Es una llamada y no cuesta
crédito:

```bash
python -m pulso apify --verificar
```

### Sondea el handle antes de encenderlo

```bash
python -m pulso redes --sondear zeta.tijuana uniradiobaja
```

Cuesta un resultado por cuenta y evita pagar por la cuenta equivocada.
**Adivinar el handle a partir del nombre del medio falla, y falla en
silencio.** Y el sondeo no solo sirve para saber si el handle existe: sirve
para leer la BIO. El 15 de septiembre de 2026 el cliente pidió `@svnnoticias`
y el sondeo la mostró viva, con 31 mil seguidores — y con bio de «Sonora
Visión Noticias». En Instagram la zona no la da el gacetero sino la fila del
config, así que nada habría descartado sus comentarios de Hermosillo. Quedó
en `senuelos`. De los seis handles derivados con los que nació
`config/instagram.json`, cinco estaban mal: tres eran cuentas ocupadas con 0
publicaciones, `@afnoticias` resultó ser un portal de Tocantins, Brasil con
113 mil seguidores y bio en portugués, y el de Uniradio repetía exactamente el
señuelo que ya estaba documentado en YouTube. Los dos handles buenos que
faltaban —`@zeta.tijuana`, con punto, y `@afntijuana2`— no se adivinan: salen
del sitio web del propio medio.

### Ningún actor inicia sesión, y no es negociable

`docs/PLAN.md` §3 refusa el raspado con cuenta, y **Apify no cambia ese
análisis**: rentar el navegador no renta la responsabilidad. En *Meta v.
Bright Data* la defensa que prosperó dependió de no ser «usuario» de la
plataforma, o sea de no haber iniciado sesión; un actor que se loguea destruye
esa defensa igual de bien si el login lo ejecuta un tercero por contrato, y
encima suma la cuenta del proveedor al expediente. Ese es el patrón de hechos
de *Meta v. Voyager Labs*.

Por eso la regla vive en el código y no en un comentario: `pulso/apify.py`
rechaza al leer `config/apify.json` cualquier actor activo cuya entrada traiga
cookies, credenciales o tokens de sesión. **No basta con cambiar `"activo":
false`** — hay una prueba que lo fija (`tests/test_apify.py`).

`config/apify.json` trae hoy seis actores apagados, cada uno con su razón
escrita, y una sección `senuelos` con los que **no** hay que usar y por qué.
Los raspadores de tuits de X están ahí: X cerró la lectura anónima en 2023, así
que los que sirven piden cookies. Las tendencias de X son la excepción, porque
su endpoint sigue contestando sin cuenta; ver abajo.

### Lo que sí puede llegar a `data/`

Conteos derivados y los posts destacados (URL, pie del medio como titular,
likes, comentarios, reproducciones), y nada más. Misma disciplina que YouTube
pero más estricta, porque YouTube al menos concede 30 días por política
escrita (III.E.4.d) y Meta, TikTok y X no conceden nada: lo que ata aquí son
los términos de cada plataforma más la LFPDPPP mexicana y la CPRA californiana,
ya que un comentario con nombre propio es dato personal en las dos. El texto
crudo vive en `cache/`, ignorado por git y purgado en cada corrida.

### El texto de los comentarios sale a `data/`, pero no a git

El 8 de septiembre de 2026 la dirección pidió ver el texto de los comentarios
más votados de cada post destacado. Se publica, pero **fuera de git**:
`python -m pulso redes` escribe `data/redes-comentarios.json` desde el caché, y
`.gitignore` lo excluye por nombre (`data/*-comentarios.json`, un glob para que
cualquier archivo de texto futuro quede fuera sin tener que acordarse). Tanto
`pulso sitio` como `web/scripts/sincronizar-datos.mjs` lo llevan al artefacto
con el resto de `data/`. Así la
página lo muestra y el historial de git no conserva ni una frase, con lo que la
retención de 30 días sigue siendo ejecutable. La identidad de quien comenta
sigue sin ingerirse. Un despliegue hecho desde git puro sale sin ese archivo y
el panel lo dice. `--sin-texto` lo omite. Hasta el 17 de septiembre de 2026
vivía en una carpeta aparte, `efimero/`; `pulso validar` falla si el archivo
existe y la línea de `.gitignore` no está.

### TikTok: búsquedas, con `--probar` antes del cron

```bash
python -m pulso tiktok --probar
```

Trae tres videos de cada búsqueda de `config/tiktok.json` sin cosechar
comentarios ni escribir nada, para ver con ojos humanos qué devuelve el filtro
`PAST_24_HOURS` del actor y cómo quedan zona y título. Anota la fecha en
`verificado`. Luego:

```bash
python -m pulso tiktok --sentimiento modelo
```

Escribe `data/tiktok.json` y `data/tiktok-comentarios.json` (fuera de git). La zona de
cada video sale de su descripción con el gacetero, nunca de la consulta; el @
del creador sí se publica, quien comenta no. El actor de comentarios cobra
~5 USD por 1,000 resultados: con las ocho búsquedas activas a 15 videos × 20
comentarios son ~12 USD la primera corrida del día, y `cache/tiktok/vistos.json`
evita repetirlos.

Desde el 15 de septiembre de 2026 hay once búsquedas —una por lugar del
corredor más México y el mundo— y un campo `ambito`. **`ambito` no es una
zona**: cuando la descripción nombra un lugar, manda la descripción, igual en
los tres. Lo único que decide es el residuo: en una búsqueda `regional` un
video de fuera se descarta, y en las otras dos se conserva como `nacional`; un
video que no nombra lugar queda `nacional`, salvo en la del mundo, donde queda
`internacional`. El campo `alcance` publica el veredicto crudo del gacetero al
lado de la zona, para que «sin lugar» y «fuera del corredor» no se
confundan. Desde el 22 de septiembre de 2026 hay un quinto veredicto,
`extranjero`: el video que nombra un lugar de fuera de México va a
`internacional` en los tres ámbitos, verificado, y lo que nombra México se
queda en `nacional`. Lo calcula `pulso/zonas.py::alcance_redes`, que solo usan
las redes; la prensa no cambia.

Desde el 22 de septiembre de 2026 hay también `perfiles`: cuentas de medios de
México y del mundo, leídas con el mismo actor, 10 videos y 7 comentarios por
video de la ventana. Una fila apagada se sondea por su id, y el sondeo
imprime los seguidores del perfil:

```bash
python -m pulso tiktok --probar --fila tk_dwespanol
```

### Facebook: páginas de medios, con `--sondear` antes del cron

```bash
python -m pulso facebook --sondear
```

Trae los últimos tres posts de cada página activa de `config/facebook.json`
(con ids, esas páginas aunque estén apagadas) y dónde caería cada uno, sin
comentarios ni escribir nada; cuesta tres resultados por página. Luego:

```bash
python -m pulso facebook --sentimiento modelo
```

Escribe `data/facebook.json` y `data/facebook-comentarios.json` (fuera de git).
La zona de cada post sale de su texto, nunca de la página; los posts que solo
comparten otro no entran; y los comentarios se pagan solo para los cuatro posts
de más reacciones de cada página y corrida, del orden de 1.35 USD al día con
cinco páginas.

En Instagram, `--sondear` acepta `--muestra N` para ver dónde caerían los
últimos N posts de cada cuenta con un ámbito dado. La bio no alcanza: así se
coló la Ensenada de Buenos Aires.

```bash
python -m pulso redes --sondear @latinus_us --muestra 3 --ambito nacional
``` Tres búsquedas están apagadas con la razón escrita —Tecate, San
Felipe y San Quintín—: se probaron y devuelven falsos positivos, no cobertura.
Un incendio en Apodaca entró como Tecate porque el pie decía «Tecate Six».

### YouTube: Shorts y videos por feed público, sin llave y sin costo

```bash
python -m pulso youtube --probar
```

Lee unas pocas piezas de cada canal activo de `config/youtube.json` sin
escribir nada, para ver cómo quedan zona, alcance y formato. Una fila todavía
apagada se sondea por su id, que es como se prueba antes de poner
`activo: true`:

```bash
python -m pulso youtube --probar --canal yt_bbcmundo
```

Como no cuesta nada, es el procedimiento normal y no un ritual previo al gasto:
los números que cita la `nota` de cada fila salen de aquí. Luego:

```bash
python -m pulso youtube
```

Escribe `data/youtube.json`. Eran 32 peticiones y son 43 desde los seis canales
del mundo del 22 de septiembre de 2026, a feeds Atom públicos —dos
listas por canal, `UUSH` para Shorts y `UULF` para videos largos— sin llave,
sin cuota y sin secretos. **No es la API de datos**: ese es el otro módulo de
YouTube, `pulso conversacion`, que sí necesita `YOUTUBE_API_KEY` y sí vive
detrás de `YOUTUBE_HABILITADO`. Los datos de los dos no se suman.

**No cosecha comentarios**: el feed no los trae. El documento sale con
`cosecha_comentarios: false`, que es lo que impide leer sus ceros como una
medición, y la tarjeta no pinta ni el botón de comentarios ni el de Analizar.
Encenderlos costaría ~24 USD/mes con las 16 filas activas.

La zona de cada pieza sale de su título y su descripción con el gacetero,
**nunca de la fila del canal**: la de El Vigía decía Ensenada y nueve de sus
quince Shorts eran nacionales. Por eso una fila no lleva `zona` y el validador
la rechaza. `ambito` decide sólo el residuo, igual que en TikTok.

Shorts y videos se cortan **por separado** y el muro emite la unión, porque sus
vistas no miden lo mismo: desde el 31 de marzo de 2025 una vista de Short es
cualquier arranque o repetición sin tiempo mínimo. Medido: mediana de 447
vistas en Shorts contra 7 en videos, así que en un solo ranking los videos no
entrarían nunca.

**No existe trending por ciudad.** YouTube retiró su página de Trending y desde
julio de 2025 el chart `mostPopular` de la API sólo devuelve Música, Películas
y Gaming; toda superficie de tendencia, incluidas las de pago, es por país. Lo
que se publica es lo más visto de las últimas 24 horas entre estos canales.

### X: tendencias por ubicación, sin sesión

```bash
python -m pulso tendencias --ubicaciones
```

Lista las ubicaciones para las que X publica tendencias, filtradas a México,
Estados Unidos y el mundo, con su WOEID (cuesta una corrida del actor, ~470
resultados). Es el `--sondear` de esta sección: una ubicación se enciende en
`config/tendencias.json` solo con el WOEID visto aquí y la fecha en su `razon`.
Luego:

```bash
python -m pulso tendencias --probar
```

Cinco tendencias por ubicación, sin escribir nada, para ver con ojos humanos
qué devuelve el actor. Y el comando del cron:

```bash
python -m pulso tendencias
```

Escribe `data/tendencias.json`: el ranking de X para Tijuana, Mexicali, San
Diego, México y el mundo, con el nombre, el puesto y la liga de cada tendencia.
Nunca un tuit ni quién lo escribió; las promocionadas se descartan; el volumen
va solo cuando X lo publica. El actor lee el endpoint de tendencias de X con un
guest token —sin cuenta, sin cookies—, que es lo que lo deja pasar por la
guardia de sesión; los tuits siguen fuera. Una llamada por corrida cubre las
cinco ubicaciones: ~100 resultados, unos centavos. Para Ensenada, Rosarito,
Tecate, San Quintín y San Felipe X no publica lista, y el tablero lo dice.

### El presupuesto es un tope duro

Apify cobra por resultado. El cron corre cuatro veces al día, así que
`resultados_por_corrida` se multiplica por 120 al mes antes de mirar la
factura. El presupuesto se **reparte** entre los actores activos en vez de
gastarse en orden de archivo, y el endpoint síncrono corta a los 300 segundos:
si un actor empieza a devolver 408, baja su `cuota` en la configuración en vez
de subir el timeout.

---

### Consultas: qué se dice de un término

Desde el 18 de septiembre de 2026, `config/consultas.json` guarda **términos**
—marcas y personas— de los que se cosecha lo que dicen TikTok (búsqueda),
Instagram (cuentas y etiquetas) y Facebook (páginas públicas) en los últimos
30 días, y lo que dice la prensa en los últimos **seis meses**: el buscador de
noticias y el buscador propio de cada medio de `buscadores`, con el tono de
cada titular (favorable | adversa | neutral). Todo sin iniciar sesión. Corre
**a mano y fuera del cron** hasta que la demo se juzgue. La prensa se lee de
todas las filas y no cuesta nada; las redes solo de una fila encendida, y esa
parte sí se cobra. El procedimiento, en orden:

```bash
python -m pulso redes --sondear @vivelabaja @grupoconcordia
```

```bash
python -m pulso consultas --probar
```

```bash
python -m pulso consultas --sentimiento modelo
```

`--probar` recorre todas las filas, apagadas incluidas, con tres publicaciones
por fuente, sin comentarios y sin escribir; lo que devuelve va a la `nota` de
la fila, y solo entonces se fecha `verificado` y se pone `activo: true` (el
validador rechaza una fila activa sin fecha). La corrida escribe
`data/consultas.json` y `data/consultas-comentarios.json` (texto, fuera de git
por el mismo glob que los demás). Cuesta del orden de 7 USD la primera vez con
las nueve fuentes configuradas y menos de 0.50 USD las siguientes dentro de
`dias_entre_cosechas`. YouTube y X salen «sin dato» (el archivo lleva la
razón; la pantalla no); la búsqueda por palabra en Facebook está apagada
(`pulso/facebook.py`). Ojo: `APIFY_TOKEN` se lee de `.env`, así que `--probar`
en una máquina con ese archivo es una llamada real. El tono se publica como
conteos también para la fila `persona`, por decisión del cliente registrada en
`docs/PLAN.md`. Con todas las filas apagadas la corrida lee solo la prensa —es
lo que se corrió para la demo del 18 de septiembre de 2026— y las tres redes
salen «sin dato».

Dos listas del config curan a mano lo que la búsqueda no acierta, y las dos se
justifican por escrito: `prensa.excluidos` descarta un titular que no trata del
término —se empareja por titular, porque el enlace del buscador de noticias
cambia entre consultas— y el informe publica cuántos se descartaron;
`agregados` añade un enlace que ninguna búsqueda devuelve, porque su titular no
nombra el término, y sale en su propia sección rotulada como tal, fuera de los
conteos.

## Automatización

`.github/workflows/pulso.yml` corre las pruebas, el pipeline, la conversación
si está habilitada, valida la salida y commitea `data/` si cambió.

El cron corre cada seis horas (`17 */6 * * *`) y activa el descubrimiento web
solo en las corridas programadas; una corrida manual puede omitirlo.
Ten en cuenta que `estado.json` y `fuentes.json` llevan la hora de la corrida,
así que cada corrida produce un commit aunque no haya notas nuevas.
`notas.json` no lleva marca de tiempo y solo cambia cuando cambia el
contenido.

Un detalle que explica por qué el commit y el despliegue viven en el mismo
workflow: **los commits hechos con `GITHUB_TOKEN` no disparan `on: push`**. Un
workflow aparte de «desplegar al hacer push» nunca correría después del commit
del cron y la página se quedaría congelada. La otra cara es útil: el commit
del bot no puede volver a disparar el workflow, así que no hay ciclo.

`.github/workflows/ci.yml` corre en cada PR: pruebas, validador y una corrida
offline completa a una carpeta temporal.

---

## Publicar el tablero

> **El tablero publicado es privado.** Se entra con la cuenta de Microsoft
> de la organización y el rol vive en una tabla `usuarios` en Neon. El
> registro en Azure, la base de datos, las variables de Vercel y el modo de
> desarrollo sin Azure están en [docs/acceso.md](docs/acceso.md).

Lo que se publica es **`web/`**, el tablero de Next.js. `sitio/` sigue en el
repo y en CI, pero ya no es el producto: el cron dejó de armarlo.

**Está apagado a propósito** hasta que el proyecto del host exista. Para
encenderlo hacen falta una variable y tres secretos:

```bash
gh variable set DESPLEGAR_TABLERO -b true
gh secret set VERCEL_TOKEN
gh secret set VERCEL_ORG_ID
gh secret set VERCEL_PROJECT_ID
```

**Se despliega desde el runner**, no desde un build del host contra git, y no
es un detalle de herramienta. El texto de los comentarios está en `data/` pero
fuera de git por la retención de 30 días, así que un host que construya desde
el repositorio jamás lo vería y publicaría los posts sin comentarios. En el
cron, en cambio, lo acaba de escribir el paso de redes de la misma corrida, y
`pnpm build` lo copia a `web/public/data` con el resto de `data/`.

**Hoy, sin embargo, publica la integración de Git de Vercel**, conectada al
repo desde el 9 de septiembre de 2026: cada push a `main` construye producción,
incluidos los cuatro commits diarios del bot, y ese build no ve el texto, así
que los posts salen sin el texto de sus comentarios y el panel lo dice. Encender
el despliegue desde el runner sin apagar la integración pondría a los dos a
competir por producción; cuál se queda es una decisión pendiente, no un
descuido. El proyecto tiene Root Directory `web`, archivos fuera de la raíz
incluidos y Framework Preset Next.js; sin el último, Vercel construye y luego
sirve `web/public/` como sitio estático, y todo es 404 (`docs/acceso.md` §7).

**No es exportación estática y por eso Pages ya no sirve.** `next.config.ts`
deja `output` sin definir a propósito para conservar las route handlers, y
`/api/garitas` existe porque CBP no manda cabeceras CORS: hace falta un host
con Node. Es una ruta JSON pública y de solo lectura; el resto del tablero y
sus APIs conservan la puerta de sesión.

Ojo con lo mismo que antes: el sitio es **público** aunque el repo sea
privado, y publica también `data/*.json` y `config/roster.json`.

Para servir el tablero plano en local, `python -m pulso servir` sigue
funcionando igual, con `/data/` y `/config/` mapeados a las carpetas de
verdad.

---

## Notas de mantenimiento

- La carpeta local sigue llamándose `Scrapper`; el repo es `pulso-n33`.
- `.gitattributes` fuerza LF. Sin eso, un commit de `data/` desde Windows y
  otro del bot en Ubuntu pelean por los saltos de línea y el guarda
  `git diff --quiet` deja de detectar «sin cambios».
- `cache/` nunca debe entrar a git. Está en `.gitignore` con el motivo escrito.

## Comunicados del Ayuntamiento de Tecate

`python -m pulso comunicados` lee una vez la portada pública municipal con
Scrapy y escribe `data/comunicados.json`. La sección aparece debajo del muro
en Tecate, separada de las métricas de prensa. El cron la actualiza cada seis
horas; ambos sitios copian el archivo con los demás datos.

Para verificar sin red, usa:

```bash
python -m pulso comunicados --sin-red --salida <carpeta-temporal>
```

Los ejemplos se marcan como prueba; no uses esa salida
para sustituir los datos reales. Si la fuente falla, el panel conserva la
última lectura correcta e informa que no se pudo actualizar.

## Búsqueda en vivo y actualidad de Google Noticias

El muro de titulares busca en dos lugares a la vez: en lo que la última
corrida cosechó y, en vivo, en el RSS de búsqueda de Google Noticias. Lo
segundo sale por una route handler del tablero (`/api/buscar`) porque el feed
de Google no manda CORS y porque así una racha de gente buscando lo mismo es
una sola llamada río arriba. Cuatro alcances: la zona de la página, la región,
México e Internacional; el corpus solo participa en los dos primeros.

### La actualidad: ediciones y secciones locales

Con México o Internacional y sin consulta, el muro muestra la sección de
Google Noticias de ese momento por `/api/actualidad?a=mexico|internacional`:
México es la sección «México» de la edición mexicana; Internacional, la
sección «Mundo» en español y en inglés, intercaladas. Va **en el orden de
Google**, sin reordenar: no es por fecha, es su ranking de la sección, y eso
es lo que se quiere ver. Se refresca cada cinco minutos.

La portada trae además la sección «Lo que destaca ahora»: la sección LOCAL
que Google Noticias arma para la zona de la página
(`/api/actualidad?z=<zona>`), en el orden de Google y diez filas a la vez. En
la región van las de Tijuana y San Diego intercaladas (`?a=region`), porque la
sección «Baja California» de Google existe pero llega vacía. Tijuana va en
español e inglés, San Diego en inglés y las demás en español. El mapa de
lugares y el sondeo que lo justifica están en
`web/src/lib/busqueda/actualidad.ts`.
Las pastillas de rubro de esa sección (Clima, Seguridad, Deportes, Política,
Economía) son **búsquedas**, no la clasificación de Google: `&t=<rubro>`
agrega los términos de `web/src/lib/busqueda/rubros.ts` a los del lugar, en
el idioma de cada edición y en los últimos dos días. El RSS no trae imágenes.
Quince titulares como máximo por lista (`TOPE_ACTUALIDAD`), sin «mostrar
más». En México e Internacional la misma lista, con los mismos rubros, vive en
el muro de titulares y la sección de abajo se oculta. La interfaz no nombra a
Google, a petición del cliente; el código y este README sí.

Tres cosas que las dos rutas comparten y no hay que aflojar:

- **Siempre 200.** Un feed caído viaja como `estado: "fallo"` dentro de
  `fuentes`, para que la página pueda decir qué pasó. Solo un `?a=` inválido
  o una consulta vacía dan 400.
- **Al CDN solo cuando todo respondió.** `s-maxage=300` si cada edición vino
  bien; `private, no-store` si alguna falló. Una falla pasajera clavada cinco
  minutos en el CDN es peor que la falla.
- **Solo `news.google.com`.** Las secciones contestan con un 302 al id opaco
  de la sección y `fetch` lo sigue; si el destino final no es ese host, no se
  lee un byte.

Nada de esto toca `data/` ni el pipeline: son enlaces sin clasificar, sin
zona, tono ni figura, y no cuentan en ninguna cifra de prensa. El porqué está
en [PRODUCT.md](PRODUCT.md#la-columna-búsqueda-mide-otra-cosa-que-la-columna-prensa).

Verificación offline del contrato: `node web/scripts/probar-busqueda.cjs`
después de instalar las dependencias de `web/`; también la corre el job web
de CI. Lee el mismo
`tests/fixtures/google-noticias.xml` que las pruebas de Python, para que los
dos lectores del feed no diverjan en silencio.

Desde el 23 de septiembre de 2026 la búsqueda de la región lee también el
buscador propio de los seis medios verificados de `config/consultas.json`
(tres segundos cada uno; Zeta tarda diez y ahí no entra) y las notas del
archivo que nombran el término, y al final ofrece «Ver en redes».

## Búsqueda de un término en Redes

`/redes?q=<término>` arma, para cualquier término que no esté en seguimiento,
la misma ficha que una consulta: noticias, publicaciones y comentarios, cuántos
positivos y cuántos negativos. Lo gratuito sale al entrar por `/api/termino`;
la búsqueda en TikTok, Instagram y Facebook va detrás de un botón por
`/api/redes-en-vivo`. Medido el 23 de septiembre de 2026 con «Vive la Baja»: 65
segundos y 0.17 dólares por las tres redes; una búsqueda con muchos comentarios
llega a unos 0.60. Las reglas y su porqué están en AGENTS.md, «Búsqueda
en vivo de un término»; los contratos, en [docs/datos.md](docs/datos.md).

El **tono** lo pone el mismo modelo local del pipeline, servido aparte. En
local, con las dependencias de `requirements-modelo.txt`:

```bash
python -m pulso tono --servir
```

y en `web/.env.local` la dirección y un secreto cualquiera, el mismo en los dos
lados (el servicio lo lee de ahí o del entorno):

```
TONO_URL=http://127.0.0.1:8765/
TONO_SECRETO=...
```

Sin eso, todo sale «sin tono», nunca neutral. En Vercel es el proyecto
**`pulso-tono`**, aparte del tablero: la función de Python
`servicio-tono/api/tono.py`, en `https://pulso-tono.vercel.app/api/tono`.
Empaqueta el modelo con `TONO_EMPAQUETAR=1` y lleva `VERCEL_SUPPORT_LARGE_FUNCTIONS=1`
y `TONO_SECRETO`; el tablero solo necesita `TONO_URL` y el mismo secreto. Va
aparte porque dentro de `web/` cada despliegue del sitio instalaría torch. Se
despliega **desde `servicio-tono/` y nunca desde la raíz**, porque `vercel
deploy` sube todo lo que ve y la raíz tiene `cache/`:

```bash
node servicio-tono/empaquetar.mjs
```

```bash
vercel deploy --prod --scope areyes-1125
```

(el segundo, dentro de `servicio-tono/`). `GET /api/tono?salud=1` con el
secreto dice versiones e importaciones sin cargar el modelo. Medido el 23 de
septiembre de 2026: arranque en frío ~10 s, ~120 ms por texto, y las mismas
etiquetas que el pipeline en 109 de 109 titulares.

La **búsqueda pagada** va apagada salvo que estén las cuatro llaves, porque sin
la base de datos no hay libro de gasto y sin libro no hay topes:

```
BUSQUEDA_REDES_HABILITADA=true
APIFY_API_TOKEN=...
DATABASE_URL=...        # o NEON_DB_DATABASE_URL, la de la integración
AUTH_SECRET=...         # la de Auth.js; firma la huella del término en el libro
```

y la tabla del libro, una vez: `pnpm --dir web migrar`. Los topes —50 dólares al
mes encima de la cosecha programada, diez búsquedas por persona al día— están
en `web/src/lib/redes-en-vivo/config.ts`.

Verificación offline: `node web/scripts/probar-redes-en-vivo.cjs` (también la
corre el job web de CI) y
`python -m unittest tests.test_redes_en_vivo_paridad tests.test_tono`.

## Garitas para locución

La página Next.js `/garitas` consulta `/api/garitas` para San Ysidro, PedWest
y Otay Mesa hacia Estados Unidos. Requiere el servidor Next.js; no forma parte
del sitio estático anterior. El endpoint consulta el XML público de CBP con
límite de 8 segundos y 2 MiB, sin credenciales ni redirecciones. Las respuestas
válidas se cachean en el CDN hasta 5 minutos; los errores no se cachean.
`GET /api/garitas` es público, devuelve JSON y permite lectura desde otros
orígenes; los huecos de CBP siguen siendo `null`, nunca cero. No hace falta
iniciar sesión para consumirlo.

El navegador consulta al entrar en la página y después solo al pulsar Actualizar;
no consulta por intervalo, foco, reconexión ni reintento automático. La fila
peatonal Ready Lane de Otay se omite en la página. Conserva
el último resultado si falla la actualización. La hora de cada carril, con PDT/PST explícito, determina su
vigencia: después de 90 minutos se excluye del texto de locución. No se
infieren ceros, longitud de fila ni tiempos para entrar a México.

Verificación offline del contrato web: `node web/scripts/probar-garitas.cjs`
después de instalar las dependencias de `web/`; también la corre el job web
de CI.

### En Tendencia: la portada

La página de inicio muestra los titulares en vivo uno por pantalla, al estilo de
un recorrido de video vertical: se pasa al siguiente con el gesto de desplazar,
la rueda o Av Pág. Encadena las listas que ya sirve `/api/actualidad` como
capítulos —lo que destaca donde se elige empezar, los cinco rubros de ahí y las
otras dos secciones—, conserva el orden de cada lista y no repite un titular ya
mostrado. La tarjeta lleva imagen solo cuando la misma nota está en el corpus
con la miniatura que su medio publica en su propio feed; el RSS de Google no la
trae y no hay extracto; la tarjeta es titular, medio, hora, ícono de tendencia,
enlace, Analizar y Compartir.

Por dónde empieza el recorrido se reparte entre la ruta y la query: `/` es el
corredor, `/tecate` empieza en Tecate, y `/?e=mexico` y `/?e=internacional` son
facetas, no lugares. `/ahora`, que fue esta página el 14 de septiembre de 2026,
responde un redirect permanente a `/`.

La fila de temas bajo la barra —Todo, Clima, Seguridad, Deportes, Política,
Economía— es la faceta `?t=<rubro>`, y son los mismos cinco rubros que ya sirve
`/api/actualidad`. Elegir uno **reordena** la cadena para empezar por él: el
capítulo del lugar pasa a segundo y los otros cuatro siguen detrás, así que
sigue midiendo ocho capítulos (nueve en Tecate). Es ortogonal al lugar y los dos
se conservan entre sí: `/tijuana?t=seguridad`, `/?e=mexico&t=economia`. Un rubro
desconocido cae en «Todo»; con `?q=` manda la búsqueda y la fila no se pinta.

La lupa de la barra **busca**: `?q=` en la misma ruta, así que `/tijuana?q=garita`
busca en Tijuana. Es un formulario que se envía, no una búsqueda al teclear, y
queda en el enlace.

En **Tecate** el recorrido lleva un capítulo más: los cinco comunicados más
recientes del Ayuntamiento, después de los cinco rubros y antes de México. Se
rotulan «comunicado», llevan día sin hora —el Ayuntamiento no publica hora— y no
cuentan en ninguna cifra de prensa.

El muro de titulares, «De qué se habla esta semana» y «Hoy en cifras» se
retiraron del sitio el 15 de septiembre de 2026 a petición del cliente. La
ingesta los sigue calculando y archivando; sólo dejaron de tener pantalla.

Verificación offline del contrato: `node web/scripts/probar-capitulos.cjs`;
también la corre el job web de CI.

### Analizar: la lectura automática de una nota

El botón «Analizar» de una tarjeta abre una confirmación; solo al aceptar abre
la nota enlazada, la manda a un modelo y devuelve una ficha en español para la
mesa de noticias: un resumen breve, de
tres a cinco puntos ordenados por importancia, qué **no** establece la nota y
una sola idea para redes con formato, enfoque y gancho. No es un guion para
leer al aire ni un post terminado. Nada del cuerpo de la nota se guarda ni se
devuelve: la respuesta lleva la ficha y nunca el texto leído.

Va apagado salvo que estén las dos variables, porque cada lectura confirmada es
una llamada de pago:

```
ANALISIS_HABILITADO=true
ANTHROPIC_API_KEY=sk-ant-...
```

Las filas en vivo traen un enlace opaco del buscador, no la dirección editorial.
La lectura prefiere el enlace del propio medio cuando encuentra el mismo titular
y dominio en el archivo. Si la nota acaba de aparecer y aún no está allí,
resuelve el token **bajo demanda y solo después de confirmar**. Esa resolución
depende de un flujo no documentado del buscador: un límite de tráfico, una
respuesta cambiada o un dominio que no coincida se rotulan como una nota que no
se puede abrir, sin llamar al modelo. No se guarda el enlace resuelto ni el
cuerpo de la nota.

Verificación offline del contrato: `node web/scripts/probar-analisis.cjs`;
también la corre el job web de CI.
