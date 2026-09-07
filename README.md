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
| `pulso/youtube.py` | comentarios vía API oficial, con la regla de retención |
| `pulso/sentimiento.py` | modelo local de tono y sentimiento; opcional, ver `requirements-modelo.txt` |
| `pulso/clasificar.py` | `clasificar_lote`: ninguno, diccionario o modelo, en lote y sin reclasificar lo vigente |
| `pulso/validador.py` | el esquema ejecutable |
| `config/roster.json` | funcionarios con vigencias y alias. **Entrada a mano** |
| `config/medios.json` | catálogo de fuentes RSS o Scrapy. **Entrada a mano** |
| `config/canales.json` | canales de YouTube y señuelos a evitar. **Entrada a mano** |
| `data/*.json` | salida del pipeline. La escribe el bot; no se edita |
| `cache/` | texto crudo de comentarios. **Ignorado por git**, TTL de 30 días |
| `sitio/` | el tablero plano anterior. HTML, CSS y JS, sin build |
| `web/` | el tablero por zona. Next.js, lee los mismos JSON |
| `tests/` | 331 pruebas con `unittest` |

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

## YouTube: llave y la regla de los 30 días

Para encender el panel de conversación hacen falta dos cosas:

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

**Está apagado a propósito.** GitHub Pages en un repo privado exige plan de
pago, y este repo es privado. El job de despliegue existe y se salta solo.

Para encenderlo:

```bash
gh api -X POST repos/arturoreyes-ai/pulso-n33/pages -f build_type=workflow
```

```bash
gh variable set DESPLEGAR_PAGES -b true
```

El sitio queda en `https://arturoreyes-ai.github.io/pulso-n33/`. Ojo: una
página de Pages es **pública** aunque el repo sea privado, y publicaría
también `data/*.json` y `config/roster.json`. La otra opción es hacer público
el repo, que además da minutos de Actions ilimitados.

Todas las rutas del tablero son relativas, así que el mismo `_site/` funciona
en `localhost` y bajo el subcamino `/pulso-n33/`.

---

## Notas de mantenimiento

- La carpeta local sigue llamándose `Scrapper`; el repo es `pulso-n33`.
- `.gitattributes` fuerza LF. Sin eso, un commit de `data/` desde Windows y
  otro del bot en Ubuntu pelean por los saltos de línea y el guarda
  `git diff --quiet` deja de detectar «sin cambios».
- `cache/` nunca debe entrar a git. Está en `.gitignore` con el motivo escrito.
