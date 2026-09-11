# Pulso N33 — el producto

Qué es, qué mide, y sobre todo qué **no** dice. Los comandos y el mantenimiento
están en [README.md](README.md); los contratos de datos, en
[docs/datos.md](docs/datos.md); el plan de origen del cliente, en
[docs/PLAN.md](docs/PLAN.md).

---

## Qué es

Inteligencia regional del corredor Tijuana–San Diego, en ocho zonas: Tijuana,
Mexicali, Tecate, Playas de Rosarito, Ensenada, San Quintín, San Felipe y San
Diego. La lista canónica vive en `pulso/__init__.py` (`ZONAS`), no en prosa.

Sin servidor y sin base de datos: GitHub Actions corre el pipeline cada seis
horas, escribe archivos JSON, los commitea al repo y publica un sitio estático
que los lee. **El repo versionado es el histórico**: no hay otra copia de la
serie de tiempo que el historial de git.

## Para quién

El cliente está lanzando un medio. El encargo original, parafraseado en
[docs/PLAN.md](docs/PLAN.md) §1, pedía «un scraper que, dado cualquier tema
relevante, produzca un tablero con métricas de sentimiento público general».
La conversación de seguimiento acotó las prioridades a cuatro: **precio de
suelo, postura política, crimen y temas en tendencia**. Los tiempos de espera
en la frontera quedaron inicialmente despriorizados. El 8 de septiembre de
2026 se solicitó `/garitas`: un briefing para locución con esperas de CBP hacia
Estados Unidos en San Ysidro y Otay Mesa, incluidos los peatones y PedWest.
Es una consulta del servidor Next.js independiente del cron: no crea histórico
en git ni requiere base de datos. Las barras miden minutos, no longitud de fila.
Cada carril muestra su hora; reportes de más de 90 minutos quedan fuera del
resumen para leer al aire. No incluye sentido sur, CBX ni carga comercial.

Que el cliente sea un medio tiene una consecuencia legal directa, no
decorativa: la agregación se queda en **titular, fuente y enlace**, nunca el
cuerpo de la nota. Los medios de Baja California persiguen la republicación de
texto completo, y aquí el agregador competiría con ellos.

---

## Qué mide hoy

| Pieza | Estado | Notas |
|---|---|---|
| Muro de prensa por zona | funcionando | RSS + portadas Scrapy, con salud por fuente |
| Atribución de zona | funcionando | gazetero de lugares, no la zona del medio |
| Temas y tendencias | funcionando | n-gramas por documento, sin modelo ni API |
| Figuras públicas | funcionando | roster con ventanas de vigencia |
| Precios de vivienda | funcionando | índice SHF, serie trimestral desde 2005 y variación anual. Solo Tijuana y Mexicali |
| Precios de suelo | funcionando | predial de la SHCP, serie anual desde 2010, los 7 municipios |
| Crimen | funcionando | SESNSP mensual, los 7 municipios |
| Percepción de inseguridad | funcionando | ENSU trimestral. Solo Tijuana y Mexicali |
| San Diego, valor catastral | funcionando | SANDAG, mediana por ZIP |
| Conversación (YouTube) | **necesita llave** | canales verificados + hasta 3 búsquedas temáticas por corrida; retención de 30 días |
| Sentimiento de comentarios | funcionando | modelo local (pysentimiento), publicado como conteos por zona y tema; en YouTube nunca el texto |
| Redes (Instagram) | **necesita token** | 13 cuentas verificadas una por una (once de noticias y dos revistas de ciudad), sin sesión; los 15 posts con más likes de las últimas 24 horas, con hora exacta, y sus comentarios más votados. El texto va fuera de git (`efimero/`), la identidad no se ingiere |
| Redes (TikTok) | **necesita token** | búsqueda «tijuana noticias», relevancia, últimas 24 h, sin sesión; la zona sale del pie del video, se muestra el @ del creador y nunca quien comenta. Mismo canal fuera de git para el texto |
| Tono de titulares | funcionando | mismo modelo, `--metodo modelo`. Tono de la frase, no postura hacia una persona |
| Tablero por zona | funcionando | `web/`, Next.js: una página por zona con resumen, indicadores, temas, conversación y muro |
| Valores unitarios de suelo por zona | pendiente | Periódico Oficial, solo PDF, 5 formatos distintos |
| Tipo de cambio | pendiente | Banxico; el token exige un CAPTCHA humano |
| Gasto público | fuera de alcance | ver «Alcance» abajo |

---

## Cobertura por zona, sin adornos

Esto es lo que hay, medido, no lo que se querría tener.

| Zona | Prensa (catálogo) | Búsqueda | YouTube | Vivienda | Suelo | Crimen | Percepción |
|---|---|---|---|---|---|---|---|
| Tijuana | fuerte, 4 medios | — | fuerte, 6 canales | ✅ | ✅ | ✅ | ✅ |
| Mexicali | fuerte | — | adecuado | ✅ | ✅ | ✅ | ✅ |
| Ensenada | adecuada, 3 medios incluido El Vigía | — | débil | ❌ | ✅ | ✅ | ❌ |
| Playas de Rosarito | débil, 1 medio | sí | marginal, 1 canal | ❌ | ✅ | ✅ | ❌ |
| Tecate | débil, 1 medio | sí | **hueco** | ❌ | ✅ | ✅ | ❌ |
| San Quintín | **sin medio local** | sí | **sin cobertura** | ❌ | ✅ | ✅ | ❌ |
| San Felipe | **sin medio local** | sí | sin cobertura | ❌ | ✅ | ✅ | ❌ |
| San Diego | fuerte, 4 medios | sí, en inglés | moderado | catastral | catastral | n/a | n/a |

Notas sobre los huecos:

- **El Vigía**, el diario principal de Ensenada, **no publica feed**; ahora se
  lee su portada con Scrapy. Su canal de YouTube tira a Shorts nacionales en
  vez de nota municipal.
- **Tecate** tiene una radiodifusora con 27 mil suscriptores que sube
  programas de radio, no noticias.
- **San Quintín** se volvió municipio en 2020 y no se encontró ningún medio
  local, ni feed ni canal. Desde septiembre de 2026 la columna «Búsqueda» lo
  cubre por otra vía: consultas permanentes en Google Noticias, que sí indexa
  a los medios que publican del valle aunque no estén en el catálogo. Pasó de
  2 notas en la ventana a 5 en la primera corrida. **Eso no lo convierte en
  cobertura equivalente**: son medios sin verificar, el enlace pasa por el
  redirector de Google, y el volumen depende de lo que Google decida indexar.
- El **índice SHF solo trae Tijuana y Mexicali** de todo Baja California. Y
  `ZM Tijuana` no sirve de proxy para Rosarito: sigue a Tijuana municipio con
  una diferencia media de 0.077% en 86 trimestres. Ese hueco se llena con el
  predial, que sí cubre los siete municipios pero mide recaudación, no
  valuación.
- La **ENSU nunca ha muestreado** Ensenada, Tecate, Rosarito, San Quintín ni
  San Felipe. Para esas zonas no hay medición de percepción, y no se infiere
  de las otras.

El tablero **rotula cada hueco** con «sin dato» o «fuera de muestra» en vez
de rellenarlo con un cero, que se leería como «aquí no pasa nada» en lugar de
«aquí no medimos».

### La columna «Búsqueda» mide otra cosa que la columna «Prensa»

Desde septiembre de 2026 el volumen de prensa incluye una vía que **no pasa
por el catálogo**: búsquedas permanentes en Google Noticias, pensadas para los
municipios donde no existe un medio local que verificar. Hay que decir sin
rodeos qué cambia y qué no.

**Lo que no cambia.** Sigue siendo titular, fuente y enlace, nunca el cuerpo
del artículo: el `<description>` de ese feed trae un ancla y el nombre del
medio, así que no hay cuerpo que guardar aunque se quisiera. Las notas siguen
recibiendo zona por lo que **nombra el titular**, no por quién las publicó, y
el tono sigue saliendo del idioma declarado, nunca adivinado del texto. Y la
regla 4 sigue en pie: esto no rellena un hueco con ceros, aporta notas reales.

**Lo que sí cambia.** El conjunto de medios dejó de ser una lista revisada a
mano. Un resultado de búsqueda puede venir de cualquier sitio que Google
indexe, sin la verificación que sí tiene cada renglón de `config/medios.json`,
y su enlace pasa por el redirector de Google antes de llegar al medio. Por eso
la matriz de arriba separa las dos columnas en vez de sumarlas: «4 medios» y
«sí» no son la misma clase de afirmación.

**Y una parte no llega al muro.** Un titular que no nombra ningún lugar de la
región queda como nacional y no se muestra: de las 56 notas de búsqueda del
primer corte, 26 cayeron ahí. Se siguen contando en los temas y en el estado,
y la banda de salud publica ese número por consulta (`sin_zona`) en vez de
dejar que se deduzca. Es también la razón de que las consultas se escriban con
topónimos: para que el lugar caiga en el titular y no solo en el cuerpo.

**Y desde el 11 de septiembre hay una segunda cosa en vivo que tampoco es
prensa cosechada.** Con el alcance México o Internacional y sin consulta, el
muro muestra la sección de Google Noticias de ese momento, en el orden de
Google. Esas filas no pasan por el pipeline: no tienen zona, tono ni figura,
no entran a `data/`, no se cuentan en ninguna cifra de este documento y van
marcadas «en vivo». Contestan «qué está sonando ahora», que es otra pregunta
que «qué cubre la prensa de la región», y por eso no se mezclan.

Consecuencia estructural que hay que decir en voz alta: el tablero
sobrerrepresenta a Tijuana. No es un defecto del código, es la distribución
real de la prensa y de la estadística oficial en el estado.

---

## Los indicadores y lo que cada uno NO dice

Ninguna de estas cifras las calcula el tablero: se leen de la fuente oficial y
se etiquetan. Cada una mide algo distinto y confundirlas es el error fácil.

| Fuente | Qué es | Cadencia | La trampa |
|---|---|---|---|
| Índice SHF | avalúos de vivienda **con crédito hipotecario** | trimestral | base 2017=100 **rebaseada por serie**: los niveles no se comparan entre ciudades, solo las variaciones. Y no da precios en pesos por municipio |
| Predial SHCP | **recaudación**, no valuación | anual | contaminado por diferencias de tasa y de eficiencia de cobro; sirve para comparar un municipio consigo mismo, no para rankear |
| SESNSP | delitos **reportados**, no ocurridos | mensual, ~3 semanas de rezago | la serie RNID 2026 no se concatena con 2015–2025 sin crosswalk: cambió la clasificación |
| ENSU | percepción, muestra probabilística | trimestral | la única medición real de percepción, y solo cubre dos ciudades |
| SANDAG | valor **catastral**, no de venta | mensual | la Proposición 13 congela la base gravable hasta que la casa cambia de dueño, así que queda muy por debajo del mercado. No comparable con el SHF |

El suelo sin construir sigue siendo el hueco real. El índice SHF cubre vivienda
hipotecada, así que quedan fuera las operaciones al contado, los terrenos y la
tierra ejidal, que es buena parte de la oferta costera de Baja California. Los
siete municipios **sí** publican valores unitarios de suelo por zona en el
Periódico Oficial, pero en PDF, con cinco formatos de tabla distintos y
necesitando un extractor externo. Está identificado y sin construir.

---

## Lo que este producto no dice

Cinco reglas. Ninguna es una preferencia de estilo: cada una está impuesta por
el código y hay pruebas que la sostienen.

**1. Mide volumen de prensa y de conversación, no opinión pública.** Un titular
es una decisión editorial de un medio; un comentario de YouTube es de quien
decidió comentar. Ninguno de los dos es una muestra de la población. La única
medición de percepción con muestra probabilística es la ENSU del INEGI, y solo
cubre Tijuana y Mexicali.

**2. Con volumen bajo, conteos y no porcentajes.** El tablero dice porcentajes
solo a partir de 30 comentarios o titulares. Con seis notas al día un
porcentaje se mueve con dos comentarios.

**3. Prensa y comentarios nunca se suman en un número.** Cuando los dos tienen
volumen, el tablero los pone lado a lado y en palabras. La distancia entre uno
y otro es la señal; promediarlos la borra.

**4. Los huecos se rotulan, no se rellenan.** «Sin dato» y «fuera de muestra»
son estados distintos de cero, y el tablero los distingue.

**5. El tono no es postura.** El **tono** de los titulares y el
**sentimiento** de los comentarios los asigna un modelo local
(`pysentimiento/robertuito-sentiment-analysis`, entrenado en tuits). Mide si
una frase suena a queja, a celebración o a información. **No mide postura hacia
una persona**: «alcalde inaugura obra» y «alcalde critica al gobernador» salen
positivo y negativo por el verbo, no por lo que signifiquen para el alcalde.
Por eso el tablero **nunca cruza tono con figura**, y por eso la sección 4 del
plan sigue prefiriendo un clasificador por lotes para postura política. El
diccionario de `pulso/clasificar.py` sigue siendo la línea base y sigue sin ser
publicable: lee *toma protesta* como una manifestación.

Y el modelo **solo habla español**. Los cuatro medios de San Diego publican en
inglés, así que sus notas —98 de 888 en el corte actual— salen con
`postura: null` en vez de con una etiqueta que un modelo entrenado en tuits en
español no puede sostener. El conteo se publica; el hueco no se rellena.

Y los temas salen de contar repeticiones de frases, sin modelo. Funcionan bien
para lo que está claramente arriba y mal para lo sutil. Un tema sostenido por
un solo medio se rotula como tal, porque es la agenda de ese medio.

---

## Alcance

**Construido y en operación:** el muro de prensa autónomo con atribución de
zona, los indicadores oficiales de vivienda, suelo, crimen y percepción, el
valor catastral de San Diego, los temas y tendencias, el roster con ventanas de
vigencia, el tono de titulares y el tablero por zona.

**Construido y apagado detrás de una variable:** el panel de conversación de
YouTube, incluido el sentimiento de comentarios. Necesita `YOUTUBE_API_KEY` y
`YOUTUBE_HABILITADO`. Está apagado por una razón legal, no técnica: ver abajo.

**Pendiente, identificado:** los valores unitarios de suelo por zona del
Periódico Oficial (PDF, cinco formatos de tabla, requiere extractor externo) y
el tipo de cambio de Banxico (el token exige un CAPTCHA humano).

**Fuera de alcance, se cotiza aparte:** el **gasto público**. El encargo lo
listaba como si fuera una gráfica. En México significa la Plataforma Nacional
de Transparencia, la cuenta pública de la ASEBC, el Periódico Oficial y
CompraNet: en buena parte PDF escaneados e inconsistentes, con publicación
irregular y rezagos largos. Es el punto menos automatizable del encargo y, con
ironía, el único donde una IA es indispensable, para extracción. No se dobla
dentro del alcance base.

**Rechazado, y queda por escrito:** el scraping de redes sociales con sesión
iniciada. Ver [docs/PLAN.md](docs/PLAN.md) §3, que cita *Meta v. Bright Data* y
*Meta v. Voyager Labs* además de la LFPDPPP y la CPRA. No es una limitación
técnica: es una decisión que no se revisa sin abogado.

### La retención de 30 días y por qué el panel viene apagado

Las Políticas para Desarrolladores de YouTube (III.E.4.d) limitan el
almacenamiento de datos de la API a 30 días naturales. Un repo de git no puede
cumplir eso: lo commiteado vive en cada clon y en cada commit anterior. Así que
el texto crudo va a `cache/`, ignorado por git y purgado en cada corrida, y al
repo solo entra `data/conversacion.json` con conteos y temas calculados por
nosotros. **Sin texto literal, sin id de comentario y sin identidad de quien
escribió.**

Las mismas políticas (III.E.2.a) restringen **agregar** datos de canales de
distintos dueños, y un tablero que suma varios medios roza esa línea. Por eso
el panel viene apagado detrás de una variable, pendiente de la opinión de un
abogado.

### Instagram: el texto sí se muestra, y aun así no entra a git

El 8 de septiembre de 2026 la dirección pidió ver los comentarios de Instagram
tal cual, no solo contados. Se hace, con tres límites que no son de estilo:

- **El texto no se commitea.** Va a `efimero/redes-comentarios.json`, carpeta
  ignorada por git que el pipeline regenera en cada corrida desde un caché que
  se purga a los 30 días. El sitio la copia al construir. Lo que sale del
  caché desaparece de la página en la siguiente corrida; el historial de git
  nunca lo tuvo.
- **La identidad no existe en ningún archivo.** Usuario, foto e id de quien
  comenta se descartan al leer. La página muestra la frase, no la persona.
- **Instagram no publica compartidos, reposts ni guardados** de cuentas
  ajenas. Esas cifras son «sin dato», no cero. Sí hay likes, comentarios y, en
  video, reproducciones.

En YouTube no cambia nada: ahí el «nunca el texto» sale de una política
escrita, no de una decisión del cliente.

### TikTok: una búsqueda, no cuentas, y lo que eso obliga

La sección de TikTok lee la búsqueda «tijuana noticias» (relevancia, últimas
24 horas) sin iniciar sesión. Como los videos vienen de cualquier creador, la
regla de zona es la de las notas de prensa: la da lo que nombra la descripción,
nunca la consulta. Un video que nombra otra región se descarta; uno que no
nombra lugar se rotula «sin lugar en la descripción» y no tiene página de zona.
Se muestra el @ del creador porque es quien publicó y la liga ya lo trae; quien
comenta sigue anónimo. TikTok sí publica compartidos y guardados, y aquí
aparecen como cifras medidas.

---

## De qué depende que el producto no mienta

Todo lo demás se genera. Tres entradas se mantienen a mano, y de ellas depende
que las cifras signifiquen lo que dicen:

- `config/roster.json` — funcionarios con ventanas `desde`/`hasta`. Los cargos
  cambian a media administración y la atribución depende de la **fecha de la
  nota**, no de quién gobierna hoy. El caso testigo: el alcalde de Tijuana
  Ismael Burgueño se fue de licencia y su suplente Abdiel Gutiérrez tomó el
  cargo el 21 de junio de 2026. Una lista fija le habría atribuido semanas de
  cobertura a la persona equivocada.
- `config/medios.json` — el catálogo de fuentes, RSS o Scrapy.
- `config/canales.json` — canales de YouTube y la lista de `senuelos`, handles
  que resuelven a canales muertos y devolverían vacío en silencio.

El procedimiento para editarlas está en el
[README](README.md#las-tres-entradas-que-hay-que-mantener). Las reglas que el
validador impone sobre ellas están en [docs/datos.md](docs/datos.md).
