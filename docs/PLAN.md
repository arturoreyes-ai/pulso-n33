<!-- Documento del cliente, copiado tal cual. Las divergencias de la
implementacion se anotan arriba, no editando el texto de abajo. -->

> ### Nota de implementación — Fase 0
>
> Este es el plan de origen, íntegro. Lo que se construyó difiere en cuatro
> puntos, decididos después de escribirlo:
>
> 1. **GitHub Pages, no Cloudflare Pages** (§5 y §7). Un solo proveedor, sin
>    cuenta ni token extra. El despliegue está **apagado**: Pages en un repo
>    privado exige plan de pago. El job existe y se salta solo hasta que se
>    define la variable `DESPLEGAR_PAGES`. Ver README.
> 2. **El repo se llama `pulso-n33`**, no `Scrapper`.
> 3. **El prototipo se reorganizó** en el paquete `pulso/`. `pipeline.py`,
>    `roster.json` y `corpus.json` de §10 ya no están en la raíz: viven en
>    `pulso/`, `config/` y `tests/fixtures/`. Los comandos de §10 cambian a
>    `python -m pulso evaluar` y `python -m pulso correr`.
> 4. **`pulso-n33-v2.html` de §10 no se encontró** en la máquina. El tablero
>    de `sitio/` se rehízo desde cero sobre el muro que ya vio el cliente.
>
> Un cambio de esquema que vale la pena señalar: el `alias` del roster se
> partió en `alias` (nombre propio, sin fecha) y `alias_cargo` (título del
> puesto, con fecha). El prototipo los distinguía por subcadena y esa lista
> omitía `presidenta municipal`, así que las cuatro alcaldesas se resolvían
> sin importar la fecha. Ver `docs/datos.md`.

---

> ### Correcciones a las cifras y fuentes del plan
>
> Todo lo de abajo se verificó bajando la fuente y reproduciendo el número.
> Lo que el plan afirma en §2 y §5 no siempre resistió.
>
> **La cifra de vivienda de BC estaba mal.** §2 dice «BC housing precio medio
> **$2,272,653 MXN** (Q1 2025), quartiles 1,047,305 / 1,569,932 / 2,748,069».
> No se pudo sustentar: en el primer trimestre de 2025 la SHF publicó **solo**
> la distribución nacional, y no existía tabla por entidad en ningún boletín
> de 2025. Las cifras correctas más cercanas, del reporte T2 2026 (acumulado
> enero–junio, no un trimestre suelto):
>
> | | Precio medio | 25% | 50% | 75% |
> |---|---|---|---|---|
> | Baja California | 2,320,797 | 1,221,836 | 1,587,201 | 2,614,000 |
> | Nacional | 1,960,032 | 843,000 | 1,299,580 | 2,226,101 |
>
> Dos señales de que el número viejo estaba mal aparte de no existir: su
> cuartil 75 (2,748,069) queda **arriba** del actual (2,614,000), lo que
> implicaría una caída que contradice el +9% anual; y su media está apenas 2%
> abajo de una cifra cinco trimestres posterior.
>
> **Lo que sí se confirmó:** Tijuana +11% anual hacia T1 2026 (el índice da
> +10.74%; para T2 2026 ya bajó a +8.64%). Y la ENSU de junio de 2026:
> Tijuana **67.6%**, Mexicali **70.8%**, nacional **59.8%**. Reproducidas
> desde el microdato, ponderando con `FAC_SEL`.
>
> **La URL del SHF de §2 está muerta.** `transparencia.shf.gob.mx` ya no
> resuelve (NXDOMAIN), y el CSV abierto que menciona el plan **ya no existe en
> ningún canal**: hoy es un XLSX en gob.mx. Se lee sin openpyxl, abriéndolo
> como el zip de XML que es.
>
> **El SESNSP se mudó.** Ya no usa Google Drive: ahora son enlaces de
> SharePoint cuyo identificador **cambia cada mes**, porque apunta al nombre
> del archivo. El histórico 2015–2025 quedó tras un muro de autenticación y
> hay que usar el espejo de `repodatos.atdt.gob.mx`.
>
> **La granularidad del SHF es peor de lo que supone la matriz de §6.** No
> son «74 municipios nacionales, BC siempre»: de Baja California solo hay
> **Tijuana y Mexicali**. Ensenada, Tecate, Rosarito, San Quintín y San Felipe
> **no existen** en el índice. Y `ZM Tijuana` no sirve de proxy para Rosarito
> o Tecate: sigue a Tijuana municipio con una diferencia media de 0.077% en
> 86 trimestres, o sea que Tijuana domina el agregado por completo. Ese hueco
> se llena con el predial de la SHCP, que sí cubre los siete municipios,
> aunque mide recaudación y no valuación.
>
> **La cuota de YouTube de §3 quedó obsoleta.** El 1 de junio de 2026 YouTube
> pasó a cubetas separadas: `search.list` ya no cuesta 100 unidades del
> presupuesto general, cuesta 1 pero tiene **tope de 100 llamadas al día** en
> su propia cubeta. La regla de no usarlo sigue siendo correcta, por otra
> razón: en un bucle por video agota el día en 100 videos.
>
> **Lo que §3 no consideró, y cambia la arquitectura:** las Políticas para
> Desarrolladores de YouTube (III.E.4.d) limitan el almacenamiento de
> comentarios a **30 días**, con obligación de borrar o refrescar. El plan
> propone en §5 commitear los datos al repo, y eso es incompatible: lo
> commiteado vive en cada clon y en cada commit anterior. Por eso el texto
> crudo va a `cache/`, fuera de git, y solo se commitean métricas derivadas.
> Las mismas políticas (III.E.2.a) restringen **agregar** datos de canales de
> distintos dueños, que es literalmente lo que hace un tablero multimedio.
> Eso merece opinión legal antes de publicarse.

---

# Pulso N33 — Project Plan

Regional intelligence dashboard for the Tijuana–San Diego corridor, Tecate, Rosarito, Ensenada and San Quintín.

**Status:** scoping
**Last updated:** 3 September 2026
**Source of truth for figures:** everything marked *verified* below was confirmed against a primary source on this date.

---

## 1. What the client asked for

Original brief, paraphrased from Spanish:

> A web scraper that, given any relevant topic, produces a dashboard with metrics on general public sentiment — for example about a politician: what's being said, how much money they've spent, land prices, trends up or down. Mainly Tijuana–San Diego, Tecate, Rosarito, Ensenada, San Quintín. Fully automated, without needing AI APIs.

Follow-up narrowed the priorities to: **land pricing, political sentiment, crime, and trending themes.** Border wait times were explicitly deprioritised.

### What that actually is

Three products with very different difficulty, not one:

| # | Product | Difficulty | Verdict |
|---|---------|-----------|---------|
| A | Autonomous press aggregator (existing Muro N33, made self-refreshing) | Low | Build |
| B | Land and housing price tracking, BC + San Diego | Medium, asymmetric | Build, scoped |
| C | Political stance and theme tracking across sources | Medium, with a hard ceiling on coverage | Build, scoped honestly |
| D | Public spending tracking | High | Defer, quote separately |

---

## 2. Verified data sources

### Free, official, structured

| Source | What it gives | Format | Cadence | Coverage | Verified |
|--------|--------------|--------|---------|----------|----------|
| **SHF Índice de Precios de la Vivienda** | Housing price by state and municipality, from mortgage appraisals — *transaction* price, not asking price | Open CSV at `transparencia.shf.gob.mx` | Quarterly | 74 municipios nationally; BC state always | ✅ |
| **INEGI ENSU** | Perception of insecurity, government effectiveness, urban complaints, interpersonal conflict — probability sample | CSV / PDF | Quarterly | **Tijuana and Mexicali only** in BC | ✅ |
| **SESNSP** | Reported crime incidence | CSV | Monthly | All municipios | ✅ |
| **Banxico SIE** | MXN/USD | API | Daily | National | — |
| **BC press RSS** | Headlines, links, timestamps | RSS | Continuous | All five zones | Feed URLs need per-outlet verification |
| **YouTube Data API v3** | Comments on local news channels | JSON | Continuous | Strong for BC side | ✅ |
| **SanGIS / SANDAG / County Assessor** | Parcels, assessed values, sales | GeoJSON / CSV | Monthly | San Diego County | — |

### Key figures already confirmed

- BC housing precio medio **$2,272,653 MXN** (Q1 2025), 5th-highest state; quartiles $1,047,305 / $1,569,932 / $2,748,069.
- Tijuana housing **+11% annual** into Q1 2026. BC state **+10.8%** in H1 2025.
- ENSU Q2 2026 (published 24 July 2026): Tijuana **67.6%** feel unsafe, Mexicali **70.8%**, national **59.8%**.
- Mexicali ranked among the three worst urban areas nationally on perceived government effectiveness: **13.6%** vs **30.8%** national.

### Paid, San Diego side

ParcelQuest, Regrid, ATTOM sell clean parcel and sale data. MLS requires a licensed IDX/RESO feed through a broker. **Zillow and Redfin block scrapers and forbid it in ToS — not an option.**

### Not available at any reasonable price

- Facebook and Instagram public conversation — closed to commercial use. Own Pages only, via Graph API.
- TikTok — Research API is academic-only.
- WhatsApp — closed. Significant blind spot for a Mexican audience.
- X — paid; cheap tier too thin for this volume.

---

## 3. The social-media question, resolved

The client asked about scraping social platforms with a logged-in account. **This is the wrong direction and must be refused.**

In *Meta v. Bright Data* (N.D. Cal., January 2024), the court granted Bright Data summary judgment on Meta's breach-of-contract claim, reasoning that Meta's terms govern "your use" of the platforms and that Bright Data was not a "user" while logged out. Logging in destroys that defense entirely — it makes you a user, bound by the terms. Scraping with purpose-built accounts is worse still; that's the fact pattern behind *Meta v. Voyager Labs*.

Separately, the ruling is fact-specific and doesn't bless all logged-out scraping. And data-protection law applies regardless of scraping legality: sentiment data about named people is personal data under Mexico's LFPDPPP and California's CPRA.

There's also a practical catch: logged out, Facebook and Instagram show almost nothing. The legally clean path and the useful path barely overlap there.

**Get a lawyer's sign-off before any scraping of a platform with a login wall. This plan assumes we don't.**

### What we use instead

| Source | Volume, Tijuana | Notes |
|--------|----------------|-------|
| YouTube comments on local news channels | Dominant | Spanish, residents, on-topic. The real find. |
| BC press RSS | Moderate | Reporting, not opinion |
| Reddit | Marginal | r/Tijuana is small and skews to English speakers and visitors. Useful for the **San Diego** side, not the Mexican one. |

Reddit and YouTube are complementary, not redundant — they cover opposite sides of the border.

### YouTube quota budget

10,000 units/day free, per Google Cloud project. Cannot be purchased; increases require a manual review form.

| Call | Cost | Daily use | Units |
|------|------|-----------|-------|
| `playlistItems.list` | 1 | 18 local channels | 18 |
| `videos.list` | 1 | ~60 new videos | 60 |
| `commentThreads.list` | 1 | ~180 pages of 100 | 180 |
| `search.list` | **100** | **avoided entirely** | 0 |
| | | **of 10,000** | **258** |

**The rule: never call `search.list`.** Maintain a fixed channel list, read each channel's uploads playlist at 1 unit, pull comments at 1 unit per 100. Searching burns the whole day in 100 calls.

---

## 4. The "no AI APIs" constraint

Roughly 80% of the brief is deterministic and needs no model at all: prices, crime counts, perception indices, exchange rates, mention volume, trend direction, dedup, threshold alerts. A name is a string; full-text search handles entity tracking.

The exception is *"qué se dice de él"* — separating **negative topic** from **negative toward the person**. Word lists cannot do this. Demonstrated on a real headline during scoping:

> *"Tijuana estrena alcalde: Abdiel Gutiérrez toma protesta tras licencia de Burgueño"* (Baja News)
> Lexicon verdict: **adversa (−2)** — it read *protesta* as a demonstration.

**Toma protesta** is the swearing-in ceremony. This fires at every change of administration at all three levels of government. No generic Spanish lexicon handles the Mexicanism.

Three further failure modes found on real headlines: every *percepción de inseguridad* story scored adverse with no politician in it (bucketing by region instead of by resolved entity would poison a mayor's trend line); a scholarship story scored +3 as a government win with no official named; and the water-concession story mentions the governor only in the body, so headline-only matching misses her.

### Options

| Option | Cost | Trade-off |
|--------|------|-----------|
| Lexicon only | $0 | Demonstrably wrong on Mexican political press. Not publishable. |
| Local model (pysentimiento / RoBERTuito / BETO) | $0 recurring | Satisfies "no AI API" literally. Costs engineering hours and server RAM; weaker at stance vs topic. |
| **Batch LLM classification** | **~$10/month** | Recommended. Claude Haiku 4.5 is $1/M input and $5/M output, 50% off via Batch API. Classification isn't real-time, so batch fits. |

The client is optimising away the cheapest line item. Data access and engineering hours cost orders of magnitude more.

**Design requirement:** the classifier is one swappable step. The system must degrade to mention-volume-without-stance if it's switched off. That's an honest fallback, not a broken product.

---

## 5. Architecture

Zero recurring infrastructure cost.

```
GitHub Actions (cron)
  ├── fetch: RSS · SHF CSV · ENSU · SESNSP · Banxico · YouTube API
  ├── normalise + dedup  (hash / shingles)
  ├── resolve entities   (date-windowed roster)
  ├── classify stance    (batch LLM, swappable)
  └── write data/*.json  → commit
                            │
                    Cloudflare Pages / GitHub Pages
                            │
                     static dashboard reads JSON
```

- No server, no database initially. JSON files in the repo, versioned — which also gives free historical snapshots.
- Migrate to Postgres only when JSON gets unwieldy.
- Cost: a domain, roughly $12/year, plus ~$10/month for classification.

### The roster is a first-class component

Officeholders change mid-term. Tijuana's mayor **Ismael Burgueño Ruiz** took indefinite leave on 20 June 2026 to pursue Morena's state coordination and a 2027 gubernatorial run; his suplente **Abdiel Gutiérrez Coronado** took office at 00:00 on 21 June. Wikipedia's 2024–2027 table still lists Burgueño.

A hardcoded name list would have misattributed 74 days of Tijuana coverage to the wrong person. The roster therefore carries `desde` / `hasta` validity windows, and entity resolution is date-aware — verified working in the prototype.

**Current roster (verified 3 Sep 2026, all Morena):**

| Office | Holder |
|--------|--------|
| Governor, Baja California | Marina del Pilar Ávila Olmeda |
| Tijuana | Abdiel Gutiérrez Coronado (since 21 Jun 2026) |
| Mexicali | Norma Alicia Bustamante Martínez |
| Ensenada | Claudia Josefina Agatón Muñiz |
| Playas de Rosarito | María del Rocío Adame Muñoz |
| Tecate | Román Cota Muñoz |
| San Quintín | Miriam Elizabeth Cano Núñez |
| San Felipe | José Luis Dagnino López |

Matching must be accent-folded (`Gutiérrez` = `Gutierrez`), alias-aware (name, surname, office title), and case-insensitive — outlets publish in all caps.

---

## 6. Coverage matrix

This is the honest picture and should be shown to the client **before** anything is promised.

| Zone | Housing price | Perception (ENSU) | Crime | Press | YouTube | Reddit |
|------|--------------|-------------------|-------|-------|---------|--------|
| Tijuana | Municipal | ✅ Yes | ✅ | Strong | Strong | Thin |
| Mexicali | Municipal | ✅ Yes | ✅ | Strong | Strong | Thin |
| Ensenada | State only | ❌ None | ✅ | Moderate | Moderate | Near zero |
| Rosarito | State only | ❌ None | ✅ | Weak | Weak | Some, but expat/real-estate only |
| Tecate | State only | ❌ None | ✅ | Weak | Weak | Near zero |
| San Quintín | State only | ❌ None | ✅ (thin) | Very weak | Very weak | None |
| San Diego | County data | n/a | ✅ | Strong | Moderate | Strong |

**Rules that follow from this:**

1. Below a volume threshold, show **counts, not percentages**. With 6 notes a day, any percentage moves on two comments.
2. San Quintín is a no-coverage zone for now — it only became a municipio in 2020 and has almost no local press. Label it, don't fake it.
3. Never blend press and comment stance into one number. Press runs neutral because it reports; comments run adverse because they opine. The gap is the signal.
4. SHF measures mortgage-financed housing. **Not raw land, cash deals, or ejido** — which is much of Baja's coastal supply. For actual *terrenos* you fall back to asking prices, and must label them as such.

---

## 7. Phases

Estimates assume one competent developer, part-time.

### Phase 0 — Setup (2–3 days)
Repo, GitHub Actions skeleton, Cloudflare Pages deploy, JSON schema, roster with validity windows.

### Phase 1 — Press wall goes autonomous (1–2 weeks)
The visible fix to what the client already saw. Verify RSS URLs per outlet, ingest, dedup, hourly refresh.

**Copyright:** headline + source + link + short snippet is the aggregator norm. Full-text republication is a legal problem, and BC outlets pursue it. Since the client is launching an outlet, this matters more than usual.

### Phase 2 — Land and housing prices (2–3 weeks)
SHF CSV ingestion, quarterly series by municipio, quartile spread. San Diego parcel layer. Explicit labelling of the ejido / raw-land gap.

### Phase 3 — YouTube ingestion (1–2 weeks)
Fixed channel list, uploads playlist reads, comment pulls, quota accounting with headroom alarms.

### Phase 4 — Stance classification (1–2 weeks)
Batch LLM step. Per-source breakdown, never blended. Build the lexicon fallback path at the same time so the swap is real.

### Phase 5 — Crime and perception (1 week)
ENSU and SESNSP ingestion. Coverage gaps rendered as gaps.

### Phase 6 — Themes (1–2 weeks)
Unsupervised clustering over press and comments, momentum vs prior week, human-readable cluster labels.

**Working total: 8–12 weeks part-time to something defensible.** A convincing demo exists already.

### Deferred, quote separately

**Public spending.** The client listed *"cuánto dinero ha gastado"* as though it were a chart. In Mexico that means the Plataforma Nacional de Transparencia, cuenta pública from ASEBC, Periódico Oficial and CompraNet — largely inconsistent and scanned PDFs, with irregular publication and long lags. It is the least automatable item in the brief and, ironically, the one where AI is most necessary, for extraction. Do not fold it into the base scope.

---

## 8. Risks

| Risk | Mitigation |
|------|-----------|
| Client expects "all social media" | Show the coverage matrix in the first meeting. WhatsApp and Facebook groups are unreachable and that's structural, not a budget problem. |
| Client publishes a number the data can't support | Every panel carries its source and cadence. Volume thresholds gate percentages. |
| Roster goes stale | Validity windows plus a monthly review task. The Burgueño case is the worked example. |
| RSS feeds break | Per-source health check; alert when a feed returns zero for 24h. |
| Scraping pressure returns | Written position in §3. Get counsel's sign-off before revisiting. |
| Sampling bias sold as public opinion | Dashboard language must say "press and comment volume," never "what people think." ENSU is the only real perception measure and it covers two cities. |

---

## 9. Open questions for the client

1. Is this for the news outlet itself, a client-facing product, or internal research? It changes how loudly the caveats need to be displayed.
2. Which zones matter most? San Quintín currently can't be served honestly.
3. *Terrenos* or *vivienda*? SHF answers housing well and land poorly. Land needs a different, weaker approach.
4. Any budget at all for San Diego parcel data? It's the difference between real numbers and scraped guesses on the US side.
5. Who maintains the roster and channel list after handoff?

---

## 10. Prototype status

Working, in this repo:

- `pipeline.py` — RSS fetcher, accent-folded and date-aware entity matcher, baseline lexicon classifier. Stdlib only.
- `roster.json` — verified officeholders with aliases and validity windows.
- `corpus.json` — 15 real BC headlines with sources and dates.
- `pulso-n33-v2.html` — dashboard demo, real SHF and ENSU figures, simulated stance panels, every panel labelled real or simulated.

Run `python3 pipeline.py` for the classification pass, `python3 pipeline.py --fetch` for live ingestion.

**Nothing in the demo should be published.** Simulated panels are labelled; the fictional-subject examples were replaced with real headlines during scoping, but stance verdicts on real politicians are illustrative output, not editorial findings.
