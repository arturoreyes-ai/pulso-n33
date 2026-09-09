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
`YOUTUBE_HABILITADO`, pending counsel. Do not enable it by default.

### Instagram comment text is published, but never committed

On 8 September 2026 the client's management asked to see the text of the
most-liked comments on each featured Instagram post. That reverses, **for
Instagram only**, the earlier "derived counts only" decision. Do not re-open
it. It does not change the channel: `python -m pulso redes` writes the text to
`efimero/redes-comentarios.json`, a git-ignored folder regenerated on every run
from the 30-day cache, and `pulso sitio` plus `web/scripts/sincronizar-datos.mjs`
copy it into the built site when it exists. `data/redes.json` still carries
counts plus the featured posts (URL, the outlet's caption headline, likes,
comments, plays), and `pulso/validador.py` still rejects comment text or any
identity key inside `data/`.

Why not put it in `data/`: the git history cannot honour a 30-day retention.
Why this is still legal-adjacent: a comment is personal data under LFPDPPP and
CPRA once tied to a person, so commenter identity (`ownerUsername`, ids,
avatar) is dropped at ingest and does not exist in any file. Instagram exposes
no share, repost or save counts for other accounts' posts; those are labelled
`sin dato`, never zero.

### TikTok is a search, so the zone comes from the caption

`pulso/tiktok.py` (same architecture, shared core in `pulso/redes.py`) reads
the query "tijuana noticias" over the last 24 hours. A query carries no zone,
for the same reason a Google News search does not: it would credit Tijuana to
every video that names no place. Each video's zone comes from
`zonas.alcance` over its raw caption; out-of-region videos are dropped,
no-place videos are `nacional`. Two identity rules differ from Instagram, both
decided by the client on 8 September 2026: the **creator's @handle is
published** (they chose to post; the URL carries it anyway) and the validator
requires it to match the URL; **commenter identity is never stored**, as
before. TikTok does publish shares and saves, so `compartidos` and `guardados`
are required there and forbidden for Instagram. The window is `ventana_horas`
on `publicado`, never `ventana_dias`. The comments actor costs ~$5 per 1,000
results; `cache/tiktok/vistos.json` is what keeps that to once a day.

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
  norm.

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

- **`unittest` only.** No pytest, no config file. 16 modules, 398 test
  methods, and the suite is expected fully green. Install `requirements.txt`
  first: without Scrapy, `tests/test_scraping.py` fails to import and you see
  394 run with one error, which is an unprovisioned environment and not a
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
- **`efimero/`** — written by `pulso redes` and `pulso tiktok`, git-ignored,
  copied into the site at build time. The comment text lives here and nowhere
  else.

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
- **Instagram comment text goes to `efimero/`, never to `data/` or git**, and
  commenter identity is never stored anywhere (see the invariant above).
- **The YouTube panel stays off** behind `YOUTUBE_HABILITADO`.
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
  (`zonas.ts`); the view is `redes`, `indicadores`, `cobertura`, or the
  portada, which has no segment (`secciones.ts`). Every route is one cell:
  `/`, `/tijuana`, `/redes`, `/tijuana/redes`. Build every internal link with
  `secciones.ts::ruta(zona, vista)` — that is what keeps the two axes
  independent, so changing zone keeps the view and changing view keeps the
  zone. Region sections are literal folders (`app/redes/`) beside `app/[zona]/`
  because the root cannot hold two dynamic segments; a section named like a
  zone slug would silently shadow that zone's page, and `RUTAS_SIN_COLISION`
  in `secciones.ts` is the type-level guard that stops it compiling.
- **The three social platforms share one page.** Instagram, TikTok and YouTube
  are one view (`redes`) with a facet selector, not three sections. They are
  the same question asked in three places, and only one panel mounts at a time
  because each is an island that fetches its own JSON.
- **`web/` is what ships.** The cron builds it on the runner and deploys it
  prebuilt, behind `DESPLEGAR_TABLERO`. It deploys from the runner rather than
  from a host build against git because the comment text lives in `efimero/`,
  outside git: a host building from the repo would publish posts with no
  comments. `sitio/` is the previous flat dashboard — plain HTML, CSS and JS,
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
