# Working on Pulso N33

Pulso N33 is a regional intelligence dashboard for the Tijuana–San Diego
corridor. There is no server and no database: GitHub Actions runs a Python
pipeline, writes JSON, commits it, and a static site reads those files. The git
history *is* the historical archive.

Read first, depending on what you're doing:

| Question | File |
|---|---|
| What does the product claim, and refuse to claim? | [PRODUCT.md](PRODUCT.md) |
| What shape is this JSON? | [docs/datos.md](docs/datos.md) |
| How do I run it? | [README.md](README.md) |
| What did the client actually ask for? | [docs/PLAN.md](docs/PLAN.md) |

**Read this whole file before changing anything in `pulso/`.** This repo
contains an unusual number of constraints that look like ordinary code and
aren't. Several of the most natural "improvements" here — filling a gap with a
zero, adding a timestamp, renaming a Spanish identifier, caching comment text —
break either a legal obligation or the product's central honesty claim.

---

## Hierarchy of truth

When two things disagree, this is the order that settles it:

1. **`pulso/validador.py` is law.** It is the executable schema. Run
   `python -m pulso validar`.
2. `docs/datos.md` **describes**, and can be stale. If it contradicts the
   validator, the validator is right and the doc is old.
3. `web/src/lib/datos/tipos.ts` is a **mirror** of the contracts for the
   TypeScript side. It follows; it does not lead.
4. `docs/PLAN.md` is **the client's document, copied verbatim**. Amend it by
   adding a preface note above the text, the way the existing implementation
   notes do. Never edit the body to match reality.

There is deliberately no `esquema/` folder with JSON Schema. The reason is
written down at the top of `docs/datos.md`: the standard library ships no
validator, so those files would drift in silence, and the three rules that
actually matter here are cross-field rules JSON Schema cannot express.

---

## Invariants

Each of these has a reason. Breaking one is not a style regression.

### Determinism

Two runs over the same input must produce **byte-identical** files.
Pinned by `TestDeterminismo` in `tests/test_pipeline.py:197`.

Why: the cron commits `data/` every six hours behind a
`git diff --cached --quiet` guard. Any nondeterminism — a set iteration order,
an unsorted dict, an incidental timestamp — makes every single run dirty the
diff and commit noise forever.

A corollary that bites in new code: **any historical series you write must be
sorted**, and the sort key must be explicit in each point rather than implied
by position. `data/indicadores.json` carries `serie` arrays for SHF and
predial; `pulso/validador.py` rejects an unsorted one with that reasoning in
the message. Position-implied periods break for a second reason too — San
Felipe and San Quintín are new municipios, so their series start years after
the other five.

### Idempotence

Re-running preserves `capturado` and does not inflate `nuevas`.
Pinned by `TestIdempotencia` in `tests/test_pipeline.py:216`.

### `notas.json` carries no run timestamp

On purpose, so it changes only when the content changes. `estado.json` and
`fuentes.json` *do* carry the run time, which is why every run still produces a
commit. Do not "fix" this asymmetry by adding a timestamp to `notas.json`.

### Time is injected, never read

No `date.today()`, no `datetime.now()` inside pipeline code. `ahora` is passed
in, and `hoy` derives from it — see `pulso/archivo.py`, where that value now
decides what gets archived. Tests pass a fixed
`AHORA = "2026-09-03T18:00:00+00:00"`.

### No YouTube comment text reaches git. Ever.

Not the text, not the comment id, not the identity of whoever wrote it. Raw
text lives in `cache/`, which is git-ignored with a 30-day TTL and purged each
run; only derived counts reach `data/conversacion.json`.

Why: YouTube Developer Policies III.E.4.d cap API data storage at 30 calendar
days, and a git repo cannot honour that — what you commit lives in every clone
and every prior commit. This is a compliance boundary, not a size optimisation.
`cache/` is in `.gitignore` with the reason written next to it.

Related: III.E.2.a restricts *aggregating* data across channels of different
owners, so the whole conversation panel ships **off** behind
`YOUTUBE_HABILITADO`, pending counsel. Do not enable it by default. None of
this binds `pulso/youtube.py`, which reads public Atom feeds rather than the
API — see «YouTube tiene dos módulos» below.

### Instagram comment text is published, but never committed

On 8 September 2026 the client's management asked to see the text of the
most-liked comments on each featured Instagram post. That reverses, **for
Instagram only**, the earlier "derived counts only" decision. Do not re-open
it. It does not change what matters about the channel, which is that the text
**never reaches git**: `python -m pulso redes` writes it to
`data/redes-comentarios.json`, regenerated on every run from the 30-day cache,
and `pulso sitio` plus `web/scripts/sincronizar-datos.mjs` carry it into the
built site with the rest of `data/`. It lived in a separate git-ignored folder,
`efimero/`, until 17 September 2026; what replaces that folder is one line of
`.gitignore` (`data/*-comentarios.json`) that `pulso/validador.py` **checks** as
soon as the file exists, because the cron runs `git add data/` every six hours
and what leaks there cannot be taken back. `data/redes.json` still carries
counts plus the featured posts (URL, the outlet's caption headline, likes,
comments, plays), and `pulso/validador.py` still rejects comment text or any
identity key inside `data/`.

On 15 September 2026 the client added fifteen more accounts and the catalogue
stopped being a Tijuana catalogue: 27 active across Tijuana, Mexicali,
Ensenada, Tecate, San Diego and `nacional`, with San Quintín the only gap
left. Two things that tanda taught, both written into the config: an Instagram
account's zone is **stamped from its row with no correction** — unlike TikTok,
this module never consults the gazetteer — so several rows carry a standing
instruction about which zone to move to if their conversation contradicts their
bio; and `@svnnoticias`, requested by the client and alive with 31k followers,
went to `senuelos` because the probe showed it is "Sonora Visión Noticias".
Nothing would have discarded its Hermosillo comments. **Probe before enabling**
is not a formality: `python -m pulso redes --sondear` costs one result per
handle, and `tests/test_instagram.py` enforces that every verified row's
`razon` cites it.

**And the probe is not enough when the place name exists twice.** On 21
September 2026 the client spotted an Argentine post on the Ensenada wall.
`@noticiasensenada` was the news account of **Ensenada, Buenos Aires**, and it
had been active since the 15th: four posts reached the corridor, all stamped
Ensenada — «PERSECUCIÓN EN JOSÉ C. PAZ», «TENSIÓN EN RUTA 6», «INDIGNACIÓN EN
VILLA CLELIA» and one about a cumbia group «de Ensenada». The probe could not
catch it and that is the point: the account is real (24,767 followers, 3,502
posts) and its bio — «El portal de noticias de la ciudad de Ensenada» — names
no country. A **toponym shared between countries is not verified by reading
the bio; it is verified by reading the places its posts name**, which the
probe prints. Ensenada, Tecate and Mexicali all have namesakes abroad. The row
also claimed to be the account of the medio `notiens`, and it was not:
noticiasensenada.com publishes generic listicles («Qué es el omega 3») and
links to no Instagram at all. It now sits in `senuelos` with the four
headlines written down, next to `@svnnoticias` and `@afnoticias`, the same
failure from Sonora and from Tocantins.

On 17 September 2026 the client asked for more variety without losing the
posts that are actually trending. `_destacados` now **gives every account one
round before merit resumes** (`VUELTAS_GARANTIZADAS = 1`, `redes.py`), in both
the global and the per-zone cut, and `seleccionarPublicaciones` applies the
same rule and the same constant to the region cut in `web/`. The case:
between 15 and 17 September `tjnoticias_ig` led **every** Tijuana run with
seven to ten of the fifteen slots and the zone fell to two-to-four accounts of
twelve — while all twelve harvested five posts a run, `estado: ok`. So the
six that never appeared were being paid for and discarded at the featuring
step, which is why this costs nothing: the posts and their comments are
already in `cache/`, and the published text is derived from `destacados`.

Three things it is **not**, each of which was the tempting version:

- **Not a per-account cap.** Past the first round everyone competes on likes
  again — that is what `min(turno, vueltas)` buys. A plain round-robin seats a
  10-like post above a 9,000-like one, which is the thing the client ruled out.
- **Not per-zone.** A zone round would seat a 2-like Tecate post above an
  1,895-like Tijuana one, asserting a parity the material does not have. An
  account's zone is its stamped seat, so dividing by account already weights
  each place by how many outlets it actually has.
- **Not a reorder.** The emitted array is still globally sorted by
  `(-likes, -comentarios, url)` and the screen still reads newest-first. The
  selection changed; the order did not. `validador.py:1461` is why, and the
  reason is diff noise behind `git diff --cached --quiet`.

Where one outlet is the only publisher — `elvigia_ig` holds all fourteen of
Ensenada at a median of **1 like** — the round exhausts immediately and the
output is byte-identical to before. Manufacturing a gap is the same error as
filling one. **TikTok is deliberately out** (client's call): there `cuenta` is
a search id, so dividing by it would divide the mechanism; the honest key
would be `creador`, and `tests/test_tiktok.py` pins that TikTok does not
divide while proving the switch works.

On 10 September 2026 the client asked for "the latest 24 hours" of four
accounts (`@tjnoticias`, `@yoamotijuana`, `@tijuanainforma.mx`,
`@el.tijuanense`). Since then the Instagram window is **24 hours on
`publicado`** (`ventana_horas`, like TikTok) and the 8 September "15 most-liked
posts of the week" is superseded; `docs/PLAN.md` records it. A `data/redes.json`
written before that date carries `ventana_dias: 7` and no `publicado`;
`pulso/validador.py` accepts it with an aviso, not an error, because `data/` is
bot-written and the cron regenerates it. Do not hand-edit it to silence the
aviso, and do not add `ventana_dias` back to the pipeline.

Why not put it in `data/`: the git history cannot honour a 30-day retention.
Why this is still legal-adjacent: a comment is personal data under LFPDPPP and
CPRA once tied to a person, so commenter identity (`ownerUsername`, ids,
avatar) is dropped at ingest and does not exist in any file. Instagram exposes
no share, repost or save counts for other accounts' posts; those are labelled
`sin dato`, never zero.

### TikTok is a search, so the zone comes from the caption

`pulso/tiktok.py` (same architecture, shared core in `pulso/redes.py`) reads
standing queries from `config/tiktok.json` over the last 24 hours — one per
corridor place plus one for Mexico and one for the world since 15 September
2026, eleven rows of which eight are on. A query carries no zone, for the same
reason a Google News search does not: it would credit Tijuana to every video
that names no place. Each video's zone comes from `zonas.alcance` over its raw
caption.

**`ambito` decides the residue, never the zone.** It is the one field that
looks like a way around the rule and is not. When the caption names a place in
the gazetteer, the caption wins, identically in all three ámbitos. All
`ambito` changes is what happens to a video that names *no* place, or one
outside the region:

| gazetteer verdict | `regional` | `nacional` | `internacional` |
|---|---|---|---|
| a product zone | that zone | that zone | that zone |
| Baja California alone | `estatal` | `estatal` | `estatal` |
| a Mexican place outside BC | dropped | `nacional` | `nacional` |
| no place at all | `nacional` | `nacional` | `internacional` |

Hence `alcance`, the raw gazetteer verdict, published **beside** `zona` rather
than instead of it: without it `nacional` would mean both "named no place" and
"named Guadalajara", and the panel's «sin lugar» label would be false for half
the rows. `internacional` is the only zone outside `ZONAS`; it lives in
`PLATAFORMAS_REDES["tiktok"]["zonas"]` and deliberately **not** in
`ZONAS_DE_CONTEO`, which temas, conversación and Instagram share.

**Three queries are off with the reason written** (Tecate, San Felipe, San
Quintín). They were probed for real on 15 September 2026 and return false
positives, not coverage: an Apodaca fire zoned as Tecate because the caption
said "Tecate Six", a Manhattan running club zoned as San Felipe. A false
positive wearing the face of coverage is worse than a labelled gap. Do not turn
them on without a probe that says otherwise, and note that
`presupuesto_resultados` is sized for all eleven rows precisely so that turning
one on cannot truncate the others' comment pass in silence. Two identity rules differ from Instagram, both
decided by the client on 8 September 2026: the **creator's @handle is
published** (they chose to post; the URL carries it anyway) and the validator
requires it to match the URL; **commenter identity is never stored**, as
before. TikTok does publish shares and saves, so `compartidos` and `guardados`
are required there and forbidden for Instagram. The window is `ventana_horas`
on `publicado`, never `ventana_dias` (Instagram measures the same way since
10 September 2026). The comments actor costs ~$5 per 1,000
results; `cache/tiktok/vistos.json` is what keeps that to once a day.

**Nothing the video actor charges per second is on, and `duracion` is how you
can tell.** Since 17 September 2026 the harvest asks for
`downloadSubtitlesOptions: DOWNLOAD_SUBTITLES` — the captions **TikTok itself
already generated**, for the videos that have them, which bills no event at all.
The three paid options stay off and their prices sit next to the constant in
`pulso/tiktok.py`: `transcription-minute` is $0.034 per *started minute per
video*, and `aiVideoSummary` / `aiVideoDescription` are $0.0008 per **second of
video**, at the Scale plan's Silver tier. At ~232 videos a run and four runs a
day that is $668–$2,005/month to summarise everything and ~$950 to transcribe
it — three to ten times the $199 plan. There is no "TikTok AI" summarizer:
`aiVideoSummary` is **Apify's**, written by a third party, outside
`web/src/lib/analisis/reglas.ts` and not bound by the five rules, so it does not
get published even if someone turns it on.

Each featured video therefore carries `duracion` (seconds, optional, never 0 —
a corte from before the field stays valid with an aviso). It is not a screen
field; the card has shown no figures since that same day. It exists because
**every one of those charges is per second or per started minute, so without it
any budget in that family is a guess** — which is exactly what had to be
estimated the day the question came up. It arrives free with every result.

**The subtitle text is never stored.** What comes out is a count per search,
`salud[].con_subtitulos` — for how many videos captions existed — because that
is the number that decides whether reading them is worth it. A caption track is
the video's body, and aggregation stays at headline, source and link.

### YouTube tiene dos módulos y no comparten fundamento legal

`pulso/conversacion.py` (antes `pulso/youtube.py`) lee la **API de datos** con
llave y escribe `data/conversacion.json`. `pulso/youtube.py` lee los **feeds
Atom públicos** de cada canal y escribe `data/youtube.json`. La diferencia
decide todo lo demás: las Políticas para Desarrolladores (III.E.2.a sobre
agregar canales de distintos dueños, III.E.4.d sobre los 30 días) atan los
datos de la API y no un documento de sindicación público, que está en el mismo
plano que los quince feeds de prensa de `config/medios.json`. Por eso el
primero vive detrás de `YOUTUBE_HABILITADO` pendiente de opinión legal y el
segundo corre sin compuerta, y por eso **sus datos no se suman en un mismo
agregado**. Cada uno tiene su catálogo —`config/canales.json` y
`config/youtube.json`— y no se fusionan: allá `zona` es obligatoria y aquí es
un error del validador.

Desde el 18 de septiembre de 2026 la pestaña «YouTube» del lector es el visor
del segundo. El panel agregado de comentarios que ocupaba ese lugar salió, con
`paneles/conversacion.tsx`: llevaba congelado desde el 4 de septiembre porque
el cron nunca lo refresca. El pipeline de `conversacion.py` sigue intacto y
`data/conversacion.json` se sigue escribiendo cuando se corre a mano —el
historial de git es el archivo—; lo que cambió es qué se pinta.

**Las listas `UUSH` y `UULF` no están documentadas, y lo que compra el derecho
a usarlas es que no clasifican.** YouTube genera dos listas automáticas por
canal, reemplazando el `UC` del id: `UUSH` son los Shorts y `UULF` los videos
largos. `pulso/conversacion.py` ya había rechazado el atajo hermano (`UC`→`UU`)
porque «falla en silencio», y aquí no puede: cada entrada del feed trae su
propio enlace, `/shorts/` o `/watch?v=`, y **el enlace es la clasificación**.
La lista es sólo una estrategia de lectura barata. Cuando las dos discrepan
manda el enlace y la discrepancia se cuenta en `salud[].reclasificados`, así
que el día que el prefijo deje de significar lo que creemos el contador lo
grita. No es una precaución teórica: el 18 de septiembre la lista `UULF` de
Zeta —la de «solo videos largos»— traía diez entradas con enlace `/shorts/`.

**La zona sale del pie, como en TikTok, y por un caso medido.** La fila de El
Vigía decía Ensenada; nueve de sus quince Shorts son nacionales —Trump, Milei,
las Malvinas, Morelos, Cuautla— y el más visto de toda la corrida, con 3,985
vistas, hablaba de Trump y la Unión Europea. Estampar la zona de la fila,
que es el modelo de Instagram, pondría eso al frente del muro de Ensenada. PSN
dice Tijuana y sus seis Shorts salieron `nacional`; Síntesis dice Tijuana y
publicó San Diego; AFN dice Tijuana y publicó Ensenada. **El feed de YouTube de
un medio es su canal nacional y viral, no su cobertura municipal** — el mismo
diario hace nota de colonia en su portada y Shorts de Trump aquí. Así que
`alcance(texto, None)`, con el segundo argumento siempre `None`, y
`config/youtube.json` **sin campo `zona`**: un campo que existe acaba pasándose,
y que el validador lo rechace sale más barato que un comentario pidiendo que no.
La tabla de `ambito` se movió a `redes.py::zona_por_ambito` y `tiktok._zona`
quedó de envoltura: copiada dos veces, una corrección llega a una sola.

**Pero el título manda y la descripción sólo desempata** (21 de septiembre de
2026). Una descripción de YouTube no es el pie de un TikTok: trae fechas de
gira, listas de ciudades y texto fijo del canal. El caso: «Intocable recorre
por primera vez las calles del centro de CDMX», de N+, salió `zona: Tijuana`
con `alcance: "zona"` —el veredicto más fuerte— y encabezó el muro de Tijuana,
porque su descripción nombraba Tijuana en una lista de fechas de gira. Así que
`youtube._zona` lee la descripción **sólo cuando el título no nombra lugar
alguno**. Cuesta poco y sobre todo redistribuye: sobre 462 piezas el corredor
pasa de 228 a 225, y por dentro Tijuana baja de 140 a 125 mientras Rosarito
sube de 22 a 29 y Tecate de 5 a 8 — la ciudad grande es la que más se nombra
de paso, así que era la que más se llevaba de más.

Ese caso destapó además **un hueco del gacetero que no era de YouTube**: la
capital faltaba entera de `FUERA`. Leído de un medio de una sola zona, «Hoy No
Circula: qué autos no circulan en CDMX» devolvía `('zona', ['Tijuana'])`,
porque sin veredicto de fuera dispara la rama de `zona_medio`. Se agregaron 22
lugares (CDMX, Edomex, Toluca, Pachuca, SLP…), que tocan 76 de 6,699 titulares
de la ventana. **No** se agregaron `morelos`, `hidalgo` ni `durango`, que son
estados y también colonias de Tijuana — `morelos` está además en `LUGARES` —,
y hay una prueba que fija esa exclusión con la razón escrita.

**Un mismo canal no repite titular en pantalla.** El corte es por formato, así
que cuando CNR subió «LOCALIZAN A HOMBRE SIN VIDA…» como Short y como video
largo cada una ganó su lugar en su propia cola y nada las cruzaba: dos tarjetas
seguidas diciendo lo mismo. `_destacados` acepta `dedupe_titulo`, que colapsa
por `(cuenta, título plegado)` —la misma llave que `pulso/busquedas.py` usa
para las notas— y se queda con la más vista. **Por cuenta y no globalmente**:
dos medios cubriendo lo mismo con el mismo titular es pluralidad de cobertura,
no repetición. El archivo conserva las dos.

**Los dos formatos se cortan por separado porque sus vistas no miden lo
mismo.** Desde el 31 de marzo de 2025 YouTube cuenta una vista de Short como
cualquier arranque o repetición, sin tiempo mínimo, y la de un video largo no:
es el mismo campo `viewCount` contando dos eventos distintos. Medido el 18 de
septiembre: mediana de **447** vistas en Shorts contra **7** en videos. En un
solo ranking los videos no entran nunca. `_destacados` corta dentro de cada
formato y dentro de cada `(formato, zona)` y emite la unión, que es el mismo
patrón con el que ya unía el corte global con el de cada zona; el orden emitido
sigue siendo global, porque esa regla existe por ruido de diff. **No es
decoración: son complementarios.** Cuatro de los once canales del corredor
publican casi sólo videos largos —Uniradio publicó 0 Shorts y 10 videos en
siete días— y otros tres casi sólo Shorts; juntos llevan Tecate de 10 a 16
piezas en siete días, Rosarito de 7 a 15 y San Quintín de 6 a 15.

**Lo que el feed no trae se publica como ausente.** No hay conteo de
comentarios ni duración, así que `likes` y `comentarios` **no existen** en un
destacado de YouTube y el validador los rechaza: un `comentarios: 0` se leería
como «nadie comentó» cuando lo cierto es que la fuente no lo dice. Ordena por
`reproducciones` con `valoraciones` de desempate. `valoraciones` es
`media:starRating@count` y **no se llama `likes`** — el sondeo apunta a que lo
son, pero Google no lo documenta y bautizarlo así sería una mentira tranquila.
El orden vive en tres sitios que tienen que coincidir: `PLATAFORMAS_REDES` del
validador, `ORDEN` de `pulso/youtube.py` y `compararPorMerito` de
`web/src/lib/dominio/publicaciones.ts`.

**No se cosechan comentarios, y el documento lo dice en vez de salir en
ceros.** `cosecha_comentarios: false` en la raíz obliga a que todos los conteos
de conversación sean 0 y calla el aviso por post, que si no saldría en las ~80
filas de cada corrida. Sin ese campo, un panel sin cosecha y uno donde nadie
comentó serían el mismo archivo. La tarjeta lo lee para no pintar ni el botón
de comentarios ni el de **Analizar** —no hay texto que leerle a un modelo—, y
lo decide por el campo y no por la red, para que encenderlos después sea un
cambio de datos y no de código. Encenderlos costaría ~24 USD/mes con las 16
filas activas, medido; queda pendiente y **YouTube no entra a `RedAnalizable`**
mientras tanto.

**El paso del cron va sin compuerta, y las dos candidatas son las
equivocadas.** `APIFY_HABILITADO` regula gasto y aquí no hay ninguno: colgarlo
de ahí haría que una decisión de facturación borrara en silencio un panel
gratuito. `YOUTUBE_HABILITADO` existe por políticas que hablan de datos de la
API, y colgarlo de ahí afirmaría que la bandera trata de YouTube-como-marca en
vez de las políticas, congelando una posición legal que nadie tomó.

**No existe trending por ciudad, a ningún precio.** YouTube retiró su página de
Trending y desde el 21 de julio de 2025 el chart `mostPopular` de la API sólo
devuelve Música, Películas y Gaming; todas las superficies de tendencia,
incluidas las de Apify, son por código ISO de **país**. Lo que se publica es
«lo más visto de las últimas 24 h entre estos canales», zonificado por el pie.
No es «lo que es tendencia en Tijuana» y el panel no puede decir que lo sea.
Y `search.list` sigue prohibido por la regla de `docs/PLAN.md`: cubeta propia
con tope de 100 llamadas al día. Este módulo no toca la API de datos.

**Sondear no cuesta, así que es el procedimiento normal.** `python -m pulso
youtube --probar` lee unas pocas entradas por canal sin escribir nada, y es lo
que hay que correr antes de poner `activo: true` en una fila. Los cinco canales
que el cliente pidió el 18 de septiembre se dieron de alta así, y los números
de cada sondeo están en la `nota` de su fila: `@canal33noticias` resolvió 80% a
zona del producto —21 de 30 en Tijuana, mediana de 1,856 vistas— y entró como
`regional`; `@NMas`, `@Milenio`, `@UnoTv` e `@imagennoticias` resolvieron entre
3% y 13% y entraron como `nacional`, donde pueblan la cubeta México y nunca se
le acreditan a una ciudad. `@siempreenlanoticia` ya estaba.


### Consultas: qué se dice de un término

`pulso/consultas.py` reads `config/consultas.json` — terms, not accounts or
places: «Valente Márquez», «Vive la Baja», «Grupo Concordia» since 18 September
2026 — and writes `data/consultas.json` (git) plus `data/consultas-comentarios.json`
(text, git-ignored by the existing glob). It runs **by hand, off the cron**,
until the client judges the demo. Social sources are TikTok search, Instagram
accounts and hashtags and Facebook **pages** (`pulso/facebook.py`), all
logged-out, over **30 days** (equal to the retention, and the validator caps
`ventana_dias` there). The press is **another window, six months**
(`ventana_prensa_dias`, up to 365): the Google News RSS plus the **outlets' own
WordPress search feeds** listed in `buscadores`, with the **tone of every
headline** (`favorable | adversa | neutral`, the wall's press vocabulary,
never the comments'). Rules that look arbitrary and are not:

- **The press is read for every row, active or not.** `activo` gates the paid
  Apify harvest; reading headlines costs nothing and needs no handle probe. A
  row that is off ships with its three networks as `sin_dato`, which is what
  happened to it. The demo run of 18 September 2026 was exactly that: three
  rows off, press only, zero Apify results.
- **`buscadores` exist because Google does not index the outlet that matters.**
  Blanco y Negro Noticias (`blancoynegro.mx`) published three adverse headlines
  about Grupo Concordia in March–April 2026 and the news RSS returns none of
  them. A WordPress site answers `/?s=<term>&feed=rss2`; the term goes
  **unquoted** (WordPress feeds the quotes to the LIKE and only finds posts
  that contain literal quotes, measured on Síntesis) and `_nombra` keeps only
  headlines that **name** the term, because the outlet's engine matches the
  body and no body is read here. robots.txt is checked per run with the
  pipeline's own agent (`permitido_por_robots`): four outlets answer 403 to a
  generic agent and 200 to ours, and an unreadable robots.txt counts as
  disallowed. Each searcher row needs `verificado` before `activo`, same as a
  term: Uniradio returns its whole front page ignoring the term, and nothing
  would have flagged it.
- **Older matches are published, dated, apart.** `anteriores` carries the
  headlines that name the term but predate the window, from the outlets'
  searchers only, capped at 10, outside the tone counts and `por_medio`. The
  case: the two hardest Grupo Concordia headlines are from 11 March 2026, one
  week outside 180 days, and the only one naming Valente Márquez is from March
  2024. Hiding them behind a count would have been the report saying less than
  the harvest knew.
- **Hand curation is config, written down, and labelled on screen** (21
  September 2026). Two lists, both per term. `prensa.excluidos` drops a
  headline the search brought back that is not about the term, matched by
  **folded title** and not by link — the news link is a token that rotates
  between runs, so a url exclusion would stop applying by itself — and by
  containment, since the same headline arrives with and without the « - Medio»
  suffix. Each entry carries its `razon`, the title must be at least 12
  characters (a short one would over-match in silence), and the count of what
  was dropped is **published** as `prensa.excluidos`: a curated list that did
  not say so would claim the search returned exactly that. Three were dropped
  that day: a Bolivian band's «Gran Poder» billing for Grupo Concordia, and an
  IGN España videogame piece and a Univision reality-show note for Vive la
  Baja, all homonyms of a phrase that fits anywhere.
  `consultas[].agregados` is the opposite: links a person pointed at, in their
  own list and **never inside `prensa`**, because one of them is a Facebook
  post rather than press and because folding them into `prensa.resultados`
  would make the count beside it false — that count says how many headlines
  *name* the term. They carry `origen: "manual"`, a `tono` each and no
  buckets, and their `fecha` may be `null`, which prints «sin fecha»: the
  Facebook post publishes none readable without a session and inventing one is
  worse. A test pins that **no `agregado`'s headline names its term**: if one
  did, the search would find it and the list is the wrong home for it.
- **The screen says «sin dato» and nothing more.** The `razon` on a `sin_dato`
  block stays in the file (the validator still checks its register) but the
  ficha, the YouTube/X tabs and the PDF no longer print it: the client asked
  that the UI not explain the mechanism even to say what it does not do.
- **The summary sentences are counts, never a verdict.**
  `lib/dominio/consultas.ts::frasesConsulta` opens the ficha and the PDF with
  sentences built from the document — «3 titulares, 2 adversos; lo adverso viene
  de Blanco y Negro Noticias (2)», «ningún titular en 6 meses; 1 anterior, de
  marzo de 2024» — and `probar-consultas.cjs` pins that none says «la
  mayoría», «la gente», «opinión pública» or a percentage. That is how "the
  press on Grupo Concordia is negative" and "there is almost nothing recent on
  Valente Márquez" get said here.

- **`cuenta` is the term id** and every destacado carries `origen` and
  `fuente`. The zone comes from the text with `ambito="nacional"` in all three
  platforms, Instagram included: a brand is not a place, and a post naming
  Guadalajara is what the query went looking for, so it survives as
  `nacional/fuera` instead of being dropped.
- **The cache is per term:** `cache/consultas/<cq_id>/<plataforma>/`. A video
  two terms both find would otherwise reassign `cuenta` to whichever ran last.
  `dias_entre_cosechas` is 7, not 3: with a 30-day window, 3 re-pays each
  post's comments about ten times a month.
- **One generic two-pass loop**, not calls into `tiktok.cosechar` or
  `instagram.cosechar`: neither takes `dias_entre_cosechas`, each builds its own
  budget, and tests would need three patch points. `consultas.correr_actor` is
  the only one.
- **YouTube and X are `sin_dato` with a `razon`, never 0.** `razon` lives in
  the file for whoever reads it and stays in product register (the validator
  rejects Apify, API, token, git, actor, cron, pipeline in it); since 18
  September 2026 the screen and the PDF print only «sin dato» (see above).
- **`archivo.coincidencias`, not `notas`**: `notas` is a prohibited key name.
  `temas` publishes only `{termino, n}` because `temas.temas()` also returns
  `ejemplos` (comment text) and `n_previo`/`momento` (always-zero filler here).
- **Tone counts are published for the person too**, by client decision (see
  `docs/PLAN.md`, 18 September 2026, and the carve-out under rule 5 in
  PRODUCT.md). `tono.salvedad_tono` must equal `consultas.SALVEDAD_TONO`
  exactly; the validator compares by equality, same posture as `SALVEDAD_FIJA`.
- **Facebook keyword search is wired but refused**: `facebook.ACTOR_BUSQUEDA`
  is `None`, `facebook.busqueda` in a row is a validator error, and the actor
  sits in `senuelos`. Facebook's search page needs a login, so the vendor
  searches with its own accounts, and the session rule does not care whose
  account it is. Turning it on is the client's legal call.
- **`--probar` before `activo: true`**, and `activo` without a `verificado`
  date is an error. The probe prints only the field *names* of discarded items
  (`claves_descartadas`), never their content. The first probe on 18 September
  2026 showed why: TikTok «grupo concordia» is a music band, «valente marquez»
  returns noise, and the Facebook pages returned items without a URL.
- **Pushing `data/consultas.json` starts the paid ingest**: any push touching
  `data/` outside `paths-ignore` runs `pulso.yml`. For the demo, run locally.
  `pulso/entorno.py` reads `APIFY_TOKEN` from `.env`, so a "dry" probe on a
  machine with that file is a real, paid call.

### The five product rules, as code constraints

These are the claims in [PRODUCT.md](PRODUCT.md#lo-que-este-producto-no-dice).
In code they mean:

- **Never zero-fill a coverage gap.** `sin dato` and `fuera de muestra` are
  distinct states from `0`. A zero reads as "nothing happens here" instead of
  "we don't measure here."
- **Below 30 items, emit counts, not percentages.**
- **Never combine press and comments into one number.** Side by side only. The
  gap between them is the signal.
- **Never cross tone with `figuras`.** The model scores the tone of a sentence,
  not stance toward a person: *"alcalde inaugura obra"* scores positive because
  of the verb. Joining tone to a public figure manufactures a claim the model
  cannot support.
- **Never run text through a model that doesn't speak its language.** The tone
  model is Spanish (RoBERTuito, TASS tweets); the four San Diego outlets
  publish in English. Language comes from `idioma` in `config/medios.json` —
  never guessed from the text, which fails on exactly the short proper-noun
  headlines that make up most of the wall. A note in a language the analyzer
  doesn't speak gets `postura: null`, and the count goes to `estado.json` as
  `notas_sin_modelo_idioma`. This one shipped broken for months and nothing
  flagged it: a sentiment model given foreign text returns a plausible label,
  not an error.
- **Headline, source and link only** — never article body text. The client is
  launching a competing outlet, so this matters more than the usual aggregator
  norm. Since 14 September 2026 (client decision, counsel pending) a note may
  also carry `imagen`: the thumbnail the outlet publishes **in its own feed**,
  hotlinked, never copied, and only when the image host is the outlet's own or
  a CDN its catalogue row lists in `imagenes_de`. `pulso/fetch.py::imagen_de`
  reads `media:*`, image enclosures and the first useful `<img>` in the
  description, keeps nothing but the URL, and `normalizar.imagen_del_medio`
  drops stock, emoji sprites and other outlets' photos; the validator rejects
  the rest. First-seen wins on merge, like `capturado`, so a feed resizing its
  image cannot dirty `data/`. `<enclosure>` is never assumed to be an image:
  in this catalogue it is video (Zeta) or audio (inewsource).

### Google News search feeds (`pulso/busquedas.py`)

A third ingestion path beside RSS/Scrapy and GDELT discovery: standing queries
in `config/busquedas.json`, harvested on the same cron. Four decisions that
look arbitrary and are not:

- **The Google redirect is never resolved.** `<link>` is an opaque
  `news.google.com/rss/articles/CBM…` token. Following it costs one request per
  item *and* the token can rotate between runs — the same note would change its
  `url` on a run with no news, which is exactly what `notas.json` exists not to
  do. Store it verbatim; take `dominio` from `<source>`.
- **`fuente` maps to the catalogue when the publisher is in it.** `id_nota` is
  `sha256(fuente|folded title)`, so a Zeta article found through Google only
  dedupes against Zeta's own copy if both hash identically. Resolution order is
  domain → folded name → the hand-written `publicadores` map; a miss mints
  `gn-<hash12>`. The map is load-bearing, not a nicety: Google labels group
  papers with the group's domain, so El Sol de Tijuana arrives as `oem.com.mx`
  — the domain of neither `soltij` nor `lavoz`, the two longest feeds we have.
- **Strip the `" - Publisher"` suffix by exact match, never a `" - "` regex.**
  *"Tijuana - San Diego: la garita cierra el domingo"* is a normal headline
  here, and a generic cut leaves "Tijuana".
- **A búsqueda has no `zona`.** One that reached `zona_medio` would credit that
  zone to every headline the query returns that names no place — the El
  Imparcial/Hermosillo bug in a new costume. Synthetic sources are `estatal`.

A synthetic source's `idioma` is recovered from `descubierta_por` →
`config/busquedas.json`, not from `medios_runtime`. Putting it only in runtime
fails on the *second* run, when the synthetic medio is gone and the language
falls back to Spanish — and a sentiment model given foreign text returns a
plausible label, not an error. That is the San Diego failure again, and it is
why deleting a row from that config is a validator error rather than a warning.

The per-run budget is **shared out, not raced for**. The first version spent it
in file order and the first two queries took all 40, leaving the other four at
zero with everything in `recortadas`.

---

## Language and naming

**Spanish, throughout.** Module names (`zonas.py`, `clasificar.py`,
`validador.py`), functions (`correr`, `cosechar`, `derivar`, `armar`, `purgar`),
CLI verbs (`correr`, `validar`, `sitio`, `servir`), flags (`--sin-red`,
`--metodo`, `--salida`), JSON keys (`notas`, `figuras`, `alcance`, `postura`),
TypeScript identifiers (`ZONAS_PRODUCTO`, `zonasDeNota`, `compararZona`), React
files (`tablero.tsx`, `cabecera/banda.tsx`) and CSS classes (`.cabeza`,
`.marca`, `.tenue`) are all Spanish.

Do not introduce an English identifier into `pulso/` or `web/src/`, and do not
"normalise" an existing one. `docs/PLAN.md` is the single English document
because it is the client's copy.

**Accents follow the medium.** Python docstrings and comments are Spanish
*without* accents (`configuracion`, `informacion`, `atribucion`). JSON data,
TypeScript and Markdown use full accents. `pulso/normalizar.py::fold` exists
precisely because outlets publish inconsistently accented ALL-CAPS headlines.

---

## How this codebase documents itself

This is the strongest convention in the repo, and worth matching.

Every module docstring names **the real-world failure that motivated the
module**, with the case named:

- `pulso/zonas.py` — El Imparcial's feed carries the whole newspaper group, so
  "hermosillo" and "sonora" came out as top themes of a Baja California
  dashboard. That was the first run, over 504 notes.
- `pulso/roster.py` — the Burgueño/Gutiérrez succession of 21 June 2026.
- `pulso/clasificar.py` — the lexicon reads *toma protesta*, a swearing-in
  ceremony, as a protest.

Comments explain **why not** as often as why: `next.config.ts` on leaving
`output` undefined, `docs/datos.md` on the absent `esquema/` folder,
`scripts/sincronizar-datos.mjs` on why it exits 1. Config files disable a
source with `"activo": false` plus a written reason rather than deleting the
row — `sanquintin` is "registro deliberado de un hueco, no un medio."

Write in that register: terse, evidence-backed, willing to state a limitation
bluntly. If you fix a bug, put the case that caused it in the comment.

---

## Dependencies: stdlib-first

This is a design stance, not an accident. `requirements.txt` is **one line**:

```
Scrapy==2.18.0
```

RSS and Atom parsing (`xml.etree`), HTTP (`urllib`), the dev server
(`http.server`), the validator and the n-gram topic model are all standard
library. XLSX files are opened as the zip-of-XML they are, deliberately
avoiding openpyxl. Do not reach for `requests`, `feedparser`, `pandas`,
`beautifulsoup4` or `openpyxl` — every one of them has a stdlib path already
taken here.

The model layer stays **optional** in `requirements-modelo.txt` (pysentimiento,
transformers, with torch installed separately from the CPU index to avoid the
~800 MB CUDA wheel). Everything must keep working with `--metodo ninguno`,
which is the default. CI never installs the model.

Scrapy is used only for the three outlets with no usable RSS. Its settings are
deliberately conservative and stay that way: `ROBOTSTXT_OBEY = True`,
`CONCURRENT_REQUESTS_PER_DOMAIN = 1`, `DOWNLOAD_DELAY = 1.0`, AutoThrottle on,
cookies off. The spider reads one configured front page per outlet and never
follows the article.

---

## Commands

Python 3.11. On PowerShell, set `$env:PYTHONUTF8 = "1"` first.

```bash
python -m unittest discover -s tests -v
```

```bash
python -m pulso validar
```

```bash
python -m pulso correr --sin-red
```

```bash
pnpm --dir web tipos
```

`--sin-red` runs the full pipeline offline over the 15 real headlines in
`tests/fixtures/corpus.json`. Use it as your default check; it is deterministic
and needs no network.

**Exit codes carry meaning.** `correr` returns **2** only on a total blackout
(`modo == "red"` and zero sources responded, `pulso/__main__.py:76`); a partial
source failure is normal, shows up in the health band, and exits 0. `validar`
returns 1 on any error. Do not soften either one.

The full command surface — `indicadores`, `conversacion`, `delegaciones`,
`sitio`, `servir`, `evaluar` — is documented in [README.md](README.md).

---

## Testing

- **`unittest` only.** No pytest, no config file. 21 modules, 588 test methods, and the suite is expected fully green. Install `requirements.txt`
  first: without Scrapy, `tests/test_scraping.py` fails to import and you see
  587 run with one error, which is an unprovisioned environment and not a
  regression.
- **Tests are always offline.** `tests/test_pipeline.py` says so in its
  docstring. Never add a test that touches the network.
- **Tests read the real `config/*.json`** (`BasePipeline.setUpClass`), so a
  config edit can legitimately break the suite. Check before assuming your code
  change is at fault.
- **Never load the model in a test.** Use `pulso.sentimiento.AnalizadorFalso`
  (`pulso/sentimiento.py:101`), which has the same interface. The real model is
  ~430 MB.
- Inject `ahora`; use `tempfile` for output directories; `unittest.mock.patch`
  for network boundaries.
- Class naming is `TestX`, with two pre-existing outliers (`DelegacionesTest`,
  `DescubrimientoTest`).

---

## Files you don't hand-edit

- **`data/**`** — pipeline output, written by the bot. If it looks wrong, fix
  the code that produces it and re-run.
- **`web/public/data/`** — copied from `data/` by
  `web/scripts/sincronizar-datos.mjs`. It exits 1 when `../data` is missing, on
  purpose, so a misconfigured build cannot publish a dashboard where every
  panel shows an error.
- **`config/delegaciones-tijuana.json`** and
  `web/src/lib/dominio/delegaciones-mapa.ts` — regenerate with
  `python -m pulso delegaciones --actualizar`.
- **`web/AGENTS.md`** — generated and re-added by `next dev` (see
  `node_modules/next/dist/server/lib/generate-agent-files.js`). Removing it
  from a diff only recreates the uncommitted change; commit it with your work.
- **`cache/`** — never goes into git. See the invariant above.
- **`data/consultas.json`** — written by `pulso consultas` by hand; its text
  file is `data/consultas-comentarios.json`, covered by the glob below.
- **`data/*-comentarios.json`** — written by `pulso redes` and `pulso tiktok`,
  git-ignored **by name**, copied into the site with the rest of `data/`. The
  comment text lives here and nowhere else. The glob is deliberate: a folder
  protects whatever lands in it by default and a single filename does not, so a
  future `youtube-comentarios.json` stays out of git without anyone having to
  remember.

---

## Serialization

Pipeline output is written as:

```python
json.dumps(datos, ensure_ascii=False, indent=1, sort_keys=False) + "\n"
```

with `open(ruta, "w", encoding="utf-8", newline="\n")` — see
`pulso/pipeline.py:63`. `indent=2` is correct for the delegaciones catalog and
the generated TS map (`pulso/delegaciones.py:292`); don't unify them.

`.gitattributes` forces `* text=auto eol=lf`, with the reason written in the
file: without it, a `data/` commit from Windows and one from the Ubuntu bot
fight over line endings and the `git diff --cached --quiet` guard stops
detecting "no changes."

---

## Extending the schema

Every `validar_*` function returns `(errores, avisos)` — two lists of strings.
An **error** breaks the run; an **aviso** only prints. Pick deliberately.

Adding a field to any `data/*.json` means three edits, in this order of
authority:

1. a rule in `pulso/validador.py`,
2. the contract in `docs/datos.md`,
3. the mirror in `web/src/lib/datos/tipos.ts`.

Config conventions: every config file carries a self-explaining `"nota"` field;
zone ids match `^[a-z0-9_]{2,12}$`, shared by roster and medios; a note's `id`
must remain the hash of its `(fuente, título)`.

---

## Legal boundaries

Do not cross these without the user explicitly saying so; two of them are
already refused on the record in `docs/PLAN.md` §3.

- **No logged-in social scraping.** Cited: *Meta v. Bright Data*, *Meta v.
  Voyager Labs*, plus LFPDPPP and CPRA. **A rented scraper does not change
  this** — the natural mistake is to read "we use Apify now" as a way around
  it. Delegating the browser does not delegate the liability: the Bright Data
  defense turned on not being a *user*, and an actor that logs in destroys it
  whether the login is yours or a vendor's. `pulso/apify.py` makes the rule
  executable rather than advisory: `leer_catalogo` rejects any **active**
  actor whose input carries cookies, credentials or a session token, so
  flipping `"activo": true` in `config/apify.json` is not enough to turn on a
  logged-in scrape. `tests/test_apify.py` pins that.
- **`ROBOTSTXT_OBEY` stays on** and per-domain concurrency stays at 1.
- **Headline, source and link only.** Never article body text. For Instagram
  posts that means the first line of the outlet's caption, never the whole pie.
  **One carve-out, decided by the client on 15 September 2026:** the reader can
  press **Analizar** on a card and `/api/analizar` fetches the linked article,
  sends it to a model and returns a short reading. Nothing of that body is
  stored or published — not in `data/`, not in `cache/`, and **not in the
  response**, which carries the reading and never the text read. That last part
  is what keeps `docs/datos.md`'s "no se guardan cuerpos ni resumenes" true, and
  it is pinned by `web/scripts/probar-analisis.cjs`, not left to intent. The
  route is off unless `ANALISIS_HABILITADO=true` **and** `ANTHROPIC_API_KEY` is
  set, because every press is a paid call and the brief says "without needing AI
  APIs". Do not widen this to bulk or background analysis, and do not let the
  prompt cross tone with a figure (rule 5).
- **`Analizar` on a social post is a second carve-out, and it is narrower —
  read it as one, not as a widening.** Since 17 September 2026 the same button
  sits on an Instagram or TikTok card and calls `/api/analizar-publicacion`,
  which **fetches nothing**: its only outbound request is to the model. The
  model sees what the page already shows — the outlet's caption line and the
  most-voted comment texts from the published text file — and the URL the
  browser sends is a
  **lookup key** matched against the published `destacados`, never an address
  the server visits. That is what closes two holes at once: there is no SSRF
  surface, which is why `urlSegura` is deliberately absent there, and nobody
  with a session can use the route as a free Claude proxy by sending their own
  text. `probar-analisis.cjs` asserts the single outbound call and that no URL
  matched a social host, so the "no social scraping" rule is an assertion here
  rather than a promise. It reads the four JSON files **from disk**, not over
  HTTP: `proxy.ts` gates `/data/` behind the session so a self-fetch would 401
  in production only, and the origin would come from the caller's `Host`
  header. The price is `next.config.ts`'s `outputFileTracingIncludes`, which
  fails silently in production if dropped.
- **`/api/analizar-conversacion` is the same carve-out over a whole selection**,
  and the only place a model looks at more than one post. Same posture — nothing
  fetched, disk reads of the published files, one call to the model — plus a
  floor: under 10 comment texts it returns `pocos` without spending anything,
  because "what recurs" over three comments is one comment promoted to a
  pattern. It is a **button, not a cron step**: that is what keeps both "do not
  widen this to bulk or background analysis" and the brief's "without needing AI
  APIs" true. Note it costs the same either way — the response caches for six
  hours (one ingest cycle) per place and ámbito, so the first press pays ~$0.04
  and the rest of that cycle reads the copy. Measured: ~1,250 input tokens for
  one post, ~37,000 for a whole run. **Prompt caching is not a lever here** —
  Haiku 4.5 needs a 4,096-token prefix and ours is ~1,000, so it silently never
  caches.
- **The sampling caveat is the page's, never the model's**, in both redes
  routes. The case: the prompt asked the model to say "this is not what a city
  thinks", and to say that correctly it has to *name* what `reglas.ts` forbids —
  «la opinión pública», «la mayoría», «la gente» — so the validator rejected the
  whole reading and the reader just saw "No se pudo hacer la lectura". Four of
  six correct caveats died that way. **The validator polices assertions; a
  disclaimer that negates them cannot live under the same ban.** So the model is
  now told not to discuss representativeness at all and only says what the
  material leaves unestablished; `SALVEDAD_FIJA` in each panel says the rest,
  where it cannot be omitted or softened — the same division `chrome/pie.tsx`
  used to draw for the whole site
  and the five rules. Pinned in `probar-analisis.cjs`. Do not put it back in a
  prompt.
- **Two product rules are executable in `web/`, not just prompted.**
  `web/src/lib/analisis/reglas.ts` rejects a whole model response that carries
  a percentage or proportion (rule 2 — a post has 1–20 comments, below the 30
  floor) or that attributes what it read to «la mayoría», «la gente» or «la
  opinión pública» (rule 1). Comments are unmoderated public text, so some of
  it is written for a model to read: they are data, never instructions, and the
  validator is what holds — not the prompt. Do not "simplify" it away. Its
  numeral branch lives inside a string, so the backslash is doubled; a lost one
  kills the digit case with nothing to flag it, and the test pins both spellings.
- **The search link does not open the article, and on-demand resolution is not
  the pipeline rule breaking.** A live row's `url` is an opaque Google token
  that **does not HTTP-redirect**: requesting it server-side returns Google's
  own page, which resolves the destination in JavaScript. `Analizar` first uses
  the outlet's real link when folded title **and normalized publisher domain**
  match the archive (`lib/busqueda/enlaces.ts`); title alone can select another
  publisher's syndicated copy. When there is no match, the confirmed request
  may resolve the token through Google's undocumented article flow
  (`lib/analisis/resolver-enlace.ts`). It accepts only exact HTTPS Google News
  article paths and only a destination whose normalized host equals the row's
  advertised publisher. A rate limit, malformed response, unsafe URL or domain
  mismatch fails closed before the paid model call. The pipeline's "never
  resolve the redirect" rule is untouched: there the token rotates between
  runs and would dirty `data/`; the on-demand result is never persisted.
- **Instagram comment text never goes to git**, and commenter identity is never
  stored anywhere (see the invariant above). It ships in
  `data/redes-comentarios.json`, which `.gitignore` excludes by name.
- **X: trends only, never tweets.** X closed anonymous reading in 2023, so
  the tweet scrapers that work want session cookies and stay refused
  (`apidojo~tweet-scraper` is a señuelo in `config/apify.json`). On 11
  September 2026 the client asked for what is trending on X; trends are the
  exception because X's trends endpoint still answers an anonymous guest
  token, which is what `automation-lab~twitter-trends-scraper` uses: no login,
  no cookies, so `pulso/apify.py` accepts its input. `pulso/tendencias.py`
  reads Tijuana, Mexicali, San Diego, Mexico and worldwide into
  `data/tendencias.json` with the trend name, X's own rank and a search link,
  nothing else: no tweet text, no author, promoted trends dropped, `volumen`
  only when X publishes one. Same legal posture as the Instagram actor
  (logged-out, pending counsel, behind `APIFY_HABILITADO`). The clean
  alternative is written down: the official X API charges $0.01 per trends
  request, pay-per-use. Do not widen this to tweets.
- **The YouTube *conversation* panel stays off** behind `YOUTUBE_HABILITADO`.
  That flag covers `pulso/conversacion.py`, the Data API reader, and nothing
  else. `pulso/youtube.py` reads public Atom feeds, is not API Data, and runs
  ungated — see the section above on why those are two different questions.
- Note that the published site is **public even when the repo is private**,
  and would publish `data/*.json` and `config/roster.json` along with it. That
  is why `DESPLEGAR_TABLERO` exists and defaults to off.

---

## The web dashboard

Next.js 16 + React 19, TypeScript strict with `noUncheckedIndexedAccess`,
Tailwind v4, pnpm.

- **Read `web/AGENTS.md` and the relevant guide in `node_modules/next/dist/docs/`
  before writing Next.js code.** This is not the Next.js in your training data.
- Keep `optimizePackageImports` for `@phosphor-icons/react` and `recharts` in
  `next.config.ts`. Dropping it is a silent ~400 KB bundle regression.
- `next.config.ts` leaves `output` undefined on purpose, so route handlers and
  ISR stay available.
- Typecheck with `pnpm --dir web tipos` (`next typegen && tsc --noEmit`).
- **Routes are a grid of two axes: place x view.** The place is a zone slug
  (`zonas.ts`); the view is `redes`, `indicadores`, or the
  portada, which has no segment (`secciones.ts`). Every route is one cell:
  `/`, `/tijuana`, `/redes`, `/tijuana/redes`. Build every internal link with
  `secciones.ts::ruta(zona, vista)` — that is what keeps the two axes
  independent, so changing zone keeps the view and changing view keeps the
  zone. Region sections are literal folders (`app/redes/`) beside `app/[zona]/`
  because the root cannot hold two dynamic segments; a section named like a
  zone slug would silently shadow that zone's page, and `RUTAS_SIN_COLISION`
  in `secciones.ts` is the type-level guard that stops it compiling.
- **`cobertura` was a third view until 14 September 2026**, removed at the
  client's request along with `app/cobertura/`, `paginas/cobertura.tsx` and
  `paneles/cobertura.tsx`. It held the zone-by-source matrix and per-feed
  health. Rule 4 did not live there and still holds: every panel draws its own
  `Hueco` and the
  portada's run summary publishes how many sources answered. Do not re-add a
  view without re-adding it to `SECCIONES`, `NOMBRE`, `TITULO`, the
  `DESCRIPCION` record in `metadatos.ts` and the `CUERPOS` table in
  `paginas/pagina.tsx` — the type system catches all five.

- **The four social platforms share one page, and the page is a reader.**
  Instagram, TikTok, YouTube and X are one view (`redes`), not four sections:
  the same question asked in four places. Since 15 September 2026 the page is
  the **fixed full-screen reader** shared with `/ahora`
  (`components/lector/lector.tsx`, settle hook in `lib/pantalla/recorrido.ts`)
  on every width: a bar (back to the zone's portada, the place as a dialog of
  links, and — since 18 September 2026 — **no info button and no footer**: the
  client asked that the UI stop explaining itself, so the «Acerca de» dialog
  went and took each page's entrada prose with it, and `chrome/pie.tsx` was
  deleted the same day (see below), a row of tabs in the
  style of X's trending page (`paneles/lector-redes.tsx`: Todas · Instagram ·
  TikTok · YouTube · X, `aria-pressed` buttons, a 2 px `chart-1` underline,
  one mounted at a time with SWR preload on hover), and a box below. The
  first three tabs are `paneles/visor-redes.tsx`: one embedded post per
  screen, mandatory snap inside the box, one media mounted, heights frozen
  during the gesture; the most-voted **comment text lives in the card** (a
  two-comment preview in the desktop column and a «Comentarios» sheet on both
  sizes, `paneles/comentarios-publicacion.tsx`). **The card carries no platform
  counts** since 17 September 2026 — no likes, comments, plays, shares or
  saves, no count on the Comentarios button, no per-comment likes: the embed
  beside them shows the same figures and shows them live, while ours are up to
  six hours old, and the client sent a screenshot of a card reading 3,635 next
  to an embed reading 3,944. That is not rule 4 breaking (it forbids *filling* a
  gap with a zero, not showing a figure), but it did supersede a written
  `docs/PLAN.md` note, so it has one of its own. The pipeline still ingests and
  archives every one of those fields. In their place the chip row carries
  **Analizar** (`paneles/analisis-publicacion.tsx`), whose sheet is hoisted to
  `Recorrido` beside the comments one — a `<dialog>` per card would be 98 of
  them. YouTube and X are the same
  box without snap (`.hoja-lector`); X is trends, not comments
  (`paneles/tendencias.tsx`), in X's row grammar with the #1 trend of each
  location set in Archivo and the caveat under it. The Instagram / TikTok
  **lists and the Lista / Visual toggle are gone** (`paneles/redes.tsx`,
  `paneles/selector-red.tsx`, `lib/pantalla/movil.ts` deleted); `docs/PLAN.md`
  records the reversal. One CSS rule, `main:has(.lector) > :not(:has(.lector))`,
  hides header, footer and `Velo` while a reader is up; on `md` the nav pill
  (`.nav-flotante`) is exempt and the box starts at `--nav-alto`. The section
  is rendered with `revelar={false}` because `Revelar`'s transform would
  contain the fixed box.
- **Live Google News never becomes a `Nota`.** `/api/buscar` (search) and
  `/api/actualidad` (the México / World section the wall shows when its
  scope is `mexico` or `internacional` and nothing is typed, and the
  per-zone local section the portada shows under «Lo que destaca ahora»:
  `?z=<slug>`, or `?a=region` for Tijuana plus San Diego, because Google's
  «Baja California» section exists but comes back empty; `&t=<rubro>` turns
  any of them into a two-day Google News *search* with the terms in
  `rubros.ts`, because the RSS has no location-plus-topic section, and the
  panel labels it as a search) return
  `ResultadoExterno` rows: no id, zone, tone or figure, never written to
  `data/`, never summed with press counts. Capped at 15 (`TOPE_ACTUALIDAD`)
  at the client's request, and the UI never names Google (also the client's
  request, 12 September 2026): code and docs do, the UI says "en vivo" and
  names the outlet per row. The section feed is rendered in
  Google's own order on purpose: it is not date-ordered, it is their ranking,
  and that ranking is the signal. The pipeline deliberately does not harvest
  it, because `data/` cannot say "right now" and a place-less headline would
  be `alcance: nacional` and never reach the wall. Both handlers are
  offline-tested by `web/scripts/probar-busqueda.cjs`.
- **The UI says *what*, never *how*.** Since 13 September 2026 no user-facing
  string may name the mechanism: not `pipeline`, `corpus`, `corrida`, `corte`
  (as a run), `cosechado`, `vigentes`, Apify, an API key, git, the deploy, a
  redirector, a filename, or TikTok's literal query. The trigger was the TikTok
  facet, which opened with «De los videos de las últimas 24 horas para «tijuana
  noticias», los que nombran Tijuana en su descripción» and went on to explain
  git. It is the 12 September «the UI never names Google» rule widened from the
  vendor to the whole mechanism, and `docs/PLAN.md` records it.

  What that does *not* license is opacity. The distinction is meaning versus
  procedure: «Es el ranking de X, no una medida de la ciudad» stays, «leído sin
  iniciar sesión» goes.

  **There is no longer a site footer, and that changes what the panels owe.**
  `chrome/pie.tsx` stated the five PRODUCT.md rules on every page and this file
  used to say «do not thin it». On 18 September 2026 the client removed it, and
  the «Acerca de» dialogs with it: a reader does not come to be told where the
  data comes from. Do not re-add a site-wide footer without them asking.

  What that costs is real and should not be quietly recovered by adding prose
  somewhere else. The panels' silence was affordable **because** the footer
  spoke; now nothing states the five rules on screen at all. So the per-panel
  expressions of them are no longer a courtesy, they are the whole of it:
  `Hueco` and the «sin dato» / «fuera de muestra» labels (rule 4), counts below
  30 (rule 2), press and comments never summed (rule 3), tone never joined to a
  figure (rule 5), and each model reading's `SALVEDAD_FIJA`, which
  `analisis/reglas.ts` enforces over the whole response. **Thinning any of those
  is now a product regression with nothing behind it.** The rules themselves are
  unchanged and still executable in `pulso/validador.py` and `reglas.ts`;
  PRODUCT.md is now the only place they are written out together. Gap labels («sin dato», «fuera de muestra», the
  `Hueco` states) are rule 4 and are not mechanism; keep them. Degraded states
  say what is missing, never why in infrastructure terms.

  `ui/como-leer.tsx` («Cómo leer este dato») is **gone**. It had survived on the
  indicadores panel alone, on the argument that it explained what the SHF index,
  the predial and the ENSU measure — the source's meaning, not ours. The client
  removed it on 18 September 2026 along with the site footer. Do not re-add it.
  What that argument was protecting now lives only in PRODUCT.md's «Los
  indicadores y lo que cada uno NO dice» table, which is where to put anything
  of that kind. Each figure keeps its **source and date label** on screen, which
  is not methodology — it is what the number is — and that stays. All the mechanism prose that used to live in those blocks is in
  PRODUCT.md and in the module docstrings of `paginas/redes.tsx`,
  `paneles/visor-redes.tsx` and `paneles/comentarios-publicacion.tsx`.

- **`/garitas` and `/gasto-electoral` are pages, not a separate site.** Both are
  `SUELTAS` in `secciones.ts`: in the nav, outside the place x view grid. They
  mount `Navegacion` from their own server `page.tsx` — never from the client
  tablero, which would drag the nav's server action and `dist/ssr` icon into the
  client bundle. Garitas was the counter-example until 14 September 2026: it
  shipped its own `<nav>`, its own `garitas.module.css` and a
  `margin-top: -88px` at `z-index: var(--z-nav)` that parked it *on top of* the
  dashboard's pill, which is why the nav appeared to be missing there. It now
  uses the shared container (`max-w-[88rem]`, `px-4 md:px-8`), `Bisel`, `Barra`
  and the type tokens. Don't reintroduce a CSS module for a page: the tokens in
  `globals.css` are the scale, and `pnpm tokens` fails on off-scale values.

- **The portada is `En Tendencia`, and it is the whole product.** A
  WikiTok-style recorrido of live headlines, one per screen, on every width
  (client request, 14 September 2026; promoted from `/ahora` to the frontpage
  on the 15th). The wall lived one afternoon as a third section, `prensa`, and
  the client removed it the same day: with it went the wall, its tone, the
  weekly themes, «Hoy en cifras» and the delegación facet. **The pipeline still
  computes all of it** — the git history *is* the archive, and `estado.json`
  carries the run time that makes every run commit — so `temas.json` and
  `estado.json` are written and read by nobody. Putting any of it back on
  screen is interface work, not data work.

  **`notas.json` has no browser reader at all since 18 September 2026, and that
  is the point.** It had one — the recorrido, for thumbnails (`imagenes.ts`),
  the outlet link behind Analizar (`enlaces.ts`) and Notas relacionadas
  (`relacionadas.ts`) — and to serve it the portada preloaded the whole file:
  **4.8 MB, 917 KB gzipped, 6,020 notes**, to answer three questions about
  fifteen live rows. That was ~95% of everything the dashboard downloads and
  93% of what the data history weighs. The three cross-references are keyed on
  the live headline's folded title, and the server already had the disk beside
  it, so they moved there (`lib/busqueda/archivo.ts`): `imagen` and
  `referencia` now ride in each row of `/api/actualidad` and `/api/buscar`, and
  the sheet asks `/api/relacionadas` when it opens. Measured on the portada:
  **zero requests to `/data/`**, ~6 KB of enrichment per chapter and ~2.6 KB
  per sheet actually opened. The three matching functions did not change a
  line — they were already pure; only the caller did. Do not give `notas.json`
  a hook again: `lib/datos/config.ts` says so where the route still is.

  Two things that follow, both load-bearing. The three routes need
  `./public/data/notas.json` in `outputFileTracingIncludes`, which fails only
  in production and silently. And `/api/relacionadas` answers **503 `datos`**
  when the corpus is unreadable rather than an empty list, because the sheet
  reads empty as «no encontramos notas anteriores; la cobertura no es pareja en
  el corredor» — asserting a gap nobody measured, which is rule 4 inverted.
  `NotaRelacionada` also makes rule 5 a compiler matter: `postura` no longer
  reaches that panel instead of merely not being painted.

  **Notas relacionadas** is a card's chip opening one hoisted sheet that lists
  archived notes sharing rare words with the live headline. Scoring is by rarity
  (`log(total/df)`), and there is deliberately **no stopword list** — porting
  `temas.py`'s hand-tuned `VACIAS`/`DEMASIADO_COMUNES`/`LUGARES_PALABRAS` would
  mean maintaining a second copy of a list nobody re-tunes, and rarity does that
  job by itself against today's archive. Measured: index in 56 ms, 0.20 ms per
  query, something to show for 87% of headlines. It compares bags of words, not
  meaning, so it is offered as a suggestion and never as «the coverage of this
  topic». The sheet shows no `postura` (rule 5), no percentages (rule 2) and a
  plain sentence when there is nothing (rule 4).

  The sheet is **hoisted to the recorrido**, not mounted per card, with the turn
  counter `visor-redes.tsx` documents. `AnalisisTitular` still mounts one
  `<dialog>` per card, which is the thing that pattern exists to avoid; don't
  copy it.

  It chains `/api/actualidad` lists as *chapters* in a fixed order (the chosen
  entry → its five rubros → the other two sections) instead of raising
  `TOPE_ACTUALIDAD`. **Since 18 September 2026 a rubro can be the entry too**
  (`?t=`, the tab row under the reader bar): the head is **reordered**, never
  lengthened — chosen rubro, then the place's section, then the other four — so
  the chain still measures eight (nine in Tecate) and `CAPITULOS_MAXIMO`, the
  `Capitulos` tuple union and the nine `useActualidad` slots are untouched. The
  reorder is a hand-written table in `cabezaDe` rather than a `filter` because
  a filter returns `Capitulo[]` and the chain stops being of known length; it is
  exhaustive over `Rubro | null` on purpose, so adding a rubro breaks at compile
  time the way `ACENTO_RUBRO` already does. The place's section is never
  dropped, only moved: choosing a theme narrows where you start, not what there
  is. Like `?e=`, it is read on the **server** and choosing is navigating — but
  unlike `?e=` a zone route reads it too, because a theme narrows a place
  instead of competing with it. `?q=` still wins over it: search is a mode.
  Existing chains are unchanged because the parameter defaults to null; Google's order is kept inside a chapter and a folded title
  already shown is dropped (`lib/busqueda/capitulos.ts`, pure, pinned by
  `scripts/probar-capitulos.cjs`). `use-capitulos.ts` freezes each list once it
  settles so the five-minute refresh cannot move the card under the reader's
  finger.

  **The chain is eight chapters, or NINE in Tecate**, which adds the
  Ayuntamiento's comunicados after the five rubros. That is why `Capitulos` is
  a union of two tuple widths, why `CAPITULOS_MAXIMO` (9) is a ceiling on data
  slots rather than a total, and why `debeActivar` takes the real chain length
  **as a parameter**. Reading a module constant there is a silent failure, not
  an error: the ninth chapter is simply never requested and the loading card
  spins forever. `use-capitulos.ts` therefore calls `useActualidad` nine times
  with null gates and always pushes nine `estados` — its `useMemo` has spread
  deps and React requires a constant dep-array size.

  **The comunicados chapter is the only one not fed by the live read.** It
  comes from the municipal document, which is independent of the press on
  purpose (`pulso/comunicados.py`). The seam is `EstadoCapitulo`, which is
  already source-agnostic — it speaks only `ResultadoExterno[]`, `Idioma[]` and
  `boolean` — so a sibling of `asentado()` adapts the document and nothing
  downstream knows. Cards render as `tipo: "titular"` (a comunicado *is*
  headline, source and link) but read `t.capitulo === "comunicados"` to drop
  three claims that would be false: the «en vivo» chip, the hour (the
  Ayuntamiento publishes a date, and `hora()` would print midnight), and
  `nofollow` (that exists because a search engine returned the link; this one
  is the publisher's own).

  **The entry is half route, half facet, and both halves are load-bearing.** A
  municipio is a place and already had a segment, so `/tecate` means "start at
  Tecate"; México and Internacional are not places and would be credited as
  such by `[zona]`, so they are `?e=` (`lib/busqueda/entrada.ts`). `?e=` and
  `?q=` are read **on the server** in `app/page.tsx` and passed down as props.
  Do not "fix" that into `useSearchParams` under a `<Suspense>`, which is what
  the Next docs describe and what this shipped as first: on this prerendered
  route the boundary stayed pending forever — the fallback card in place and
  the real `.lector` parked in a detached holder off `<body>` — so
  `main:has(.lector)` never matched and the phone kept the nav pill and the
  footer on top of the reader. It typechecks, passes every `.cjs` contract, and
  looks right on a laptop.

- **Search is a MODE of the reader, not a chapter** (`?q=`, the magnifier in
  the bar). A search is a flat list of up to 40 results with no chapter order,
  no dividers and no tail sections; putting it in the chain would need a third
  source type there for nothing. The form is a real `<form method="get">` and
  does not search as you type: in a full-screen reader every keystroke would
  rebuild the card stack under the reader's finger, and this way it works
  without JavaScript and stays in the URL. `use-busqueda.ts` lost its
  `titulosCorpus`/`suprimirConocidas` argument with the wall — there is no
  longer anything above it to avoid repeating.

- **The reader carries the site's navigation, and on a phone it is the only
  one.** `globals.css` hides everything but the reader and brings the pill back
  only at `min-width: 48rem`. The portada has no page behind it, so `Lector`
  takes an optional `volver` (omitted there) and a required `menu`. `menu` is
  `chrome/menu-lector.tsx`, a **server** component passed as a ReactNode — the
  same channel as `informacion` — because it carries the `cerrarSesion` server
  action, which cannot be rendered from a client module. Build it from
  `VISTAS` + `SUELTAS` + `ruta()`; never import `Navegacion` into a client
  component. Place and view stay in **separate dialogs**.

- **`/ahora` is now a 308 to `/`** (`app/ahora/page.tsx`, `permanentRedirect`).
  The file survives only for that, and `"ahora"` stays in the
  `SegmentoLiteral` union of `secciones.ts` because the literal segment still
  competes with `[zona]`.

- **The reader carries the site's navigation, and on a phone it is the only
  one.** `globals.css` hides everything but the reader and brings the pill back
  only at `min-width: 48rem`. That was fine while every reader was an interior
  page reachable by its back arrow; the portada has no page behind it, so
  `Lector` takes an optional `volver` (omitted on the portada) and a required
  `menu`. `menu` is `chrome/menu-lector.tsx`, a **server** component passed as
  a ReactNode — the same channel as `informacion` — because it carries the
  `cerrarSesion` server action, which cannot be rendered from a client module.
  Build it from `VISTAS` + `SUELTAS` + `ruta()`; never import `NavPildora` into
  a client component. Place and view stay in **separate dialogs**: merging them
  re-mixes the two axes the pill argues in writing that it separated.

- **`web/` is what ships.** The cron builds it on the runner and deploys it
  prebuilt, behind `DESPLEGAR_TABLERO`. It deploys from the runner rather than
  from a host build against git because the comment text, though it sits in
  `data/`, is outside git: a host building from the repo would publish posts
  with no comments. `sitio/` is the previous flat dashboard — plain HTML, CSS and JS,
  no build step. It is still in the repo, still smoke-tested by CI and still
  what `pulso servir` serves, but the cron no longer assembles it.

---

## CI

`.github/workflows/ci.yml` runs on every PR: tests, `validar`, a full offline
run to a temp directory, then `validar` again on that output and a `sitio`
build. No model dependencies. Get this green before asking for review.

`.github/workflows/pulso.yml` runs the cron at `17 */6 * * *` — minute 17, not
0, because thousands of crons queue on the hour. It commits `data/` as
`pulso-bot` with `[skip ci]` when the content changed.

One detail that explains the single-workflow design, annotated in the file:
**commits made with `GITHUB_TOKEN` do not trigger `on: push`**. A separate
deploy-on-push workflow would never fire after the cron's commit. The upside is
that the bot's commit cannot re-trigger the workflow, so there is no loop.
Don't split these two jobs apart.

---

## Deployment, as it actually is

Worth knowing before debugging "the site is stale", because the answer is not
the pipeline.

**The runner-side deploy is not configured.** `pulso.yml` has a
`Construir y desplegar el tablero` step behind `vars.DESPLEGAR_TABLERO`, and
that variable is unset — but so are `VERCEL_TOKEN`, `VERCEL_ORG_ID` and
`VERCEL_PROJECT_ID`. The only repo secret is `APIFY_TOKEN` and the only repo
variable is `APIFY_HABILITADO`, so setting `DESPLEGAR_TABLERO=true` on its own
would fail that step, not enable it.

**What publishes today is Vercel's Git integration on `main`**, building from
the repository. Two consequences follow, both visible on the live site:

- **The cron's `data/` commits never redeploy it.** They land as
  `datos: ingesta … [skip ci]`, and Vercel honours `[skip ci]` by default. The
  `[skip ci]` is not wrong — it is belt-and-braces against an Actions loop that
  `GITHUB_TOKEN` already prevents — but the side effect is that the published
  dashboard refreshes only when a **human** pushes to `main`. Between human
  pushes the site can sit days behind `data/`.
- **The comment text is missing from the live site.** This is the failure the
  deploy design above predicts in so many words: the comment text is outside
  git, so a host building from the repository publishes posts with no comments. The
  Instagram and TikTok panels degrade to «El texto de los comentarios no está
  disponible en esta vista», which is the panel reporting a misconfiguration
  correctly, not a bug.

To publish the current `data/` without waiting for a feature push, commit
something that matches `pulso.yml`'s `paths-ignore` (`**.md` or `docs/**`).
Vercel builds it and the pipeline does not re-run. **Never use an empty commit
for this**: it matches no ignored path, so it starts a full ingest — including
the paid Apify actors.

And do not let the skip token appear **anywhere in that commit's message**,
body included. Both GitHub Actions and Vercel scan the whole message, not just
the subject line, so a commit that merely *quotes* the token in prose is
skipped by both — which is how the first attempt at writing this very section
published nothing: no workflow run, no Vercel build, a commit sitting on `main`
doing exactly what it was describing. Refer to it in prose as "the skip token"
and keep the literal spelling in files, where it is inert.

Fixing it properly is one of three, and the first is the only one that also
puts comment text on the site: create the three Vercel secrets and set
`DESPLEGAR_TABLERO=true`; drop `[skip ci]` from the bot's commit message
(freshness only); or call a Vercel deploy hook after the data commit.
