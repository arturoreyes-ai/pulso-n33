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
Cada carril muestra su hora; si el reporte tiene más de 90 minutos, la cifra se
conserva y la página marca que los datos no están al día. No incluye sentido
sur, CBX ni carga comercial.

Que el cliente sea un medio tiene una consecuencia legal directa, no
decorativa: la agregación se queda en **titular, fuente y enlace**, nunca el
cuerpo de la nota. Los medios de Baja California persiguen la republicación de
texto completo, y aquí el agregador competiría con ellos.

Desde el 14 de septiembre de 2026, a petición del cliente, se suma un cuarto
elemento acotado: la **miniatura que el medio publica**, enlazada y nunca
copiada. Al enlazarla, el navegador del lector la pide al medio: la página no
se presenta (`no-referrer`) pero la dirección IP sí llega. La opinión legal que
pide el plan sigue pendiente; la decisión es del cliente y queda registrada en
`docs/PLAN.md`.

Esa miniatura llega por dos caminos, y la regla de qué imagen vale **no es la
misma en los dos**, a propósito:

- **Lo que se guarda** en el archivo viene del feed o de la portada del propio
  medio, y solo si la imagen es suya: su dominio, un subdominio, o uno de los
  que su fila del catálogo declara. Una foto de stock o de otro medio le
  acreditaría una imagen que no hizo, y por eso se descarta aunque venga en el
  feed. Noticias Ensenada es el caso vivo: su feed trae fotos de Pexels y de
  otro medio, así que se queda sin miniatura a propósito.
- **Lo que se muestra en vivo** en la portada puede venir además del `og:image`
  de la página de la nota: la misma imagen que cualquier buscador usa para
  pintarla. Ahí se acepta cualquier host, porque un `og:image` no es una foto
  sacada del cuerpo de un feed sino la que **el medio eligió y declaró** para
  esa nota. No se guarda: se pide de a una, solo cuando alguien se detiene en
  la tarjeta, y si no llega la tarjeta lo dice con su propia placa.

Sondeo del 17 de septiembre de 2026, para que la cifra no envejezca sola: de
los quince feeds, Zeta, El Sol de Tijuana y La Voz de la Frontera de verdad no
traen imagen; Jornada BC sí la traía y se estaba tirando porque la sirve desde
otro dominio suyo. Las tres portadas que se leen sin RSS —AFN, El Vigía y Baja
News— tampoco daban ninguna, y no porque no la publiquen: nadie la leía.

El 17 de septiembre de 2026 el mismo botón llegó a una **publicación de redes**,
y ahí lee algo distinto y menos: no abre TikTok ni Instagram, ni nada de nadie.
Lo único que ve el modelo es lo que la pantalla ya muestra —el pie que el medio
escribió y el texto de los comentarios más votados—, y el enlace que manda el
navegador es una llave de búsqueda contra lo publicado, nunca una dirección que
el servidor visite. La ficha dice qué dice la publicación, qué se repite en los
comentarios, una idea de contenido para redes y lo que no establece. **Nunca
describe el video ni la imagen**: no los ha visto y no puede deducirlos.

Esa ficha es el único lugar del producto donde un modelo resume comentarios, y
por eso dos de las cinco reglas de abajo dejan de ser una instrucción y pasan a
ser código. La regla 2: son entre uno y veinte comentarios, muy por debajo del
piso de treinta, así que la ficha **no puede publicar un porcentaje, una
fracción ni una proporción**. La regla 1: veinte comentarios de cinco mil no son
una muestra, así que no puede escribir «la mayoría», «la gente», «la opinión
pública» ni atribuir lo leído a una ciudad. Una respuesta que lo intente se
descarta entera, y la sección se rotula «En los comentarios». Cuántos se leyeron
y cuántos reporta la plataforma se dicen **uno al lado del otro y jamás
divididos**, que es la regla 3. Y como los comentarios son texto público sin
moderar, alguno está escrito para que un modelo lo lea: son datos, no
instrucciones, y lo que los contiene no es el prompt sino esa comprobación.

El mismo día se sumó **«De qué se habla»**, la única pieza que mira varias
publicaciones a la vez: una hoja con los conteos que la ingesta ya calculaba en
cada corrida y no tenían pantalla —cómo suena cada comentario, y cuántos quedan
sin clasificar por idioma— y, detrás de otro botón, una lectura automática de
qué asuntos se repiten. **No se funden en una cifra**: son dos maneras de mirar
el mismo texto y se ponen lado a lado, que es la regla 3 aplicada fuera de la
prensa. Cuántos comentarios se leyeron, de cuántas publicaciones de la selección
y cuántos reportan las plataformas se dicen los tres, **sin dividirse jamás**:
ese cociente sería una tasa de muestreo que nadie midió.

Y la advertencia de que esto no representa a nadie **la escribe la página, no el
modelo**. Pedírsela a él lo obligaba a nombrar justo lo que la comprobación
prohíbe —«la opinión pública», «la mayoría», «la gente»— y la lectura entera se
descartaba: cuatro de cada seis advertencias correctas caían así, y en pantalla
solo se veía que no se pudo. La comprobación vigila **afirmaciones**, y una
advertencia que las niega no cabe bajo la misma prohibición. El modelo dice ahora
únicamente qué queda sin aclarar en el material; la salvedad es del producto,
donde no puede omitirse ni suavizarse.

El 15 de septiembre de 2026, a petición del cliente, el tablero se redujo a lo
que se lee: el recorrido de titulares, las redes, los indicadores, las garitas y
el gasto electoral. El muro de titulares con su tono, los temas de la semana y
el resumen en cifras dejaron de tener pantalla. **Las cinco reglas de abajo no
cambian**: la ingesta sigue midiendo y archivando lo mismo cada seis horas, y
siguen gobernando lo que el producto afirma y lo que no —también sobre los
titulares en vivo, que son lectura y no muestra—. Lo que cambia es cuántas de
ellas tienen hoy una pantalla que las ilustre.

Desde el 15 de septiembre de 2026, también a petición del cliente, el lector
puede pedir una **lectura automática** de una nota: el botón «Analizar» de una
tarjeta pide confirmación antes de abrir la nota enlazada y preparar una ficha
breve para la mesa de noticias. Desde el 17 de septiembre esa ficha separa el resumen para cabina,
entre tres y cinco puntos clave, lo que la nota no establece y una sola idea de
contenido para redes con formato, enfoque y gancho; no escribe un guion ni el
post terminado. Es la única parte del producto que toca el cuerpo de una nota,
y lo toca sin quedárselo: el cuerpo vive lo que dura una petición, no se guarda
en ningún archivo ni en el historial, y la respuesta lleva la lectura, nunca el
texto leído. La pantalla la rotula solo «Generado con IA». La ficha no cuenta en
ninguna cifra de prensa ni atribuye postura a ninguna persona, que es la regla 5
aplicada a un modelo distinto del de tono. Va apagada salvo que se encienda con
una clave propia. La opinión legal sigue pendiente; la decisión es del cliente y
queda registrada en `docs/PLAN.md`.

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
| Redes (Instagram) | **necesita token** | 28 cuentas verificadas una por una, sin sesión, en Tijuana, Mexicali, Ensenada, Tecate, San Diego y `nacional`; las publicaciones de las últimas 24 horas por zona, con hora exacta, y sus comentarios más votados; cada zona se queda con quince y el corte entra primero por la publicación más vista de cada cuenta, para que una con más seguidores no se lleve la lista de su ciudad — entre el 15 y el 17 de septiembre de 2026 una sola tuvo entre siete y diez de los quince de Tijuana. Desde el 17 de septiembre de 2026 la tarjeta no repite las cifras de la plataforma: la publicación incrustada ya las trae, y en vivo. El texto va fuera de git (`efimero/`), la identidad no se ingiere |
| Redes (TikTok) | **necesita token** | ocho búsquedas encendidas —una por lugar del corredor más México y el mundo—, relevancia, últimas 24 h, sin sesión; la zona sale del pie del video, se muestra el @ del creador y nunca quien comenta. Tres apagadas con la razón escrita. Mismo canal fuera de git para el texto. Desde el 17 de septiembre de 2026 se piden los subtítulos que TikTok ya generó, que no cobran: de ellos solo sale un conteo de para cuántos videos existen, nunca el texto. Cada video trae su duración en segundos, que es lo que permite presupuestar: resumir o transcribir los videos con la IA de Apify cuesta entre 3 y 10 veces el plan y va apagado |
| Redes (X, tendencias) | **necesita token** | lo que X marca como tendencia en Tijuana, Mexicali, San Diego, México y el mundo, leído sin sesión (guest token); nombre, puesto y liga, nunca tuits ni identidad; las promocionadas se descartan y el volumen es «sin dato» donde X no lo publica |
| Tono de titulares | funcionando | mismo modelo, `--metodo modelo`. Tono de la frase, no postura hacia una persona |
| Tablero por zona | funcionando | `web/`, Next.js: una página por zona con resumen, indicadores, temas, conversación y muro |
| Gasto electoral | implementado | página independiente para gasto final auditado de candidaturas de Baja California en 2024; financiamiento partidista 2026 aislado y rotulado como asignación, no gasto |
| Valores unitarios de suelo por zona | pendiente | Periódico Oficial, solo PDF, 5 formatos distintos |
| Tipo de cambio | pendiente | Banxico; el token exige un CAPTCHA humano |
| Gasto público | fuera de alcance | ver «Alcance» abajo |

---

## Cobertura por zona, sin adornos

Esto es lo que hay, medido, no lo que se querría tener.

| Zona | Prensa (catálogo) | Búsqueda | YouTube (video) | Vivienda | Suelo | Crimen | Percepción |
|---|---|---|---|---|---|---|---|
| Tijuana | fuerte, 4 medios | — | fuerte, 30 piezas al día | ✅ | ✅ | ✅ | ✅ |
| Mexicali | fuerte | — | adecuado | ✅ | ✅ | ✅ | ✅ |
| Ensenada | adecuada, 3 medios incluido El Vigía | — | adecuado, casi todo Shorts | ❌ | ✅ | ✅ | ❌ |
| Playas de Rosarito | débil, 1 medio | sí | marginal, 1 canal | ❌ | ✅ | ✅ | ❌ |
| Tecate | débil, 1 medio | sí | **hueco**: sin canal propio | ❌ | ✅ | ✅ | ❌ |
| San Quintín | **sin medio local** | sí | **sin cobertura** | ❌ | ✅ | ✅ | ❌ |
| San Felipe | **sin medio local** | sí | sin cobertura | ❌ | ✅ | ✅ | ❌ |
| San Diego | fuerte, 4 medios | sí, en inglés | moderado, en español | catastral | catastral | n/a | n/a |

La columna de YouTube mide **lo que publican 16 canales**, Shorts y videos
largos, en las últimas 24 horas. Es otra cosa que la conversación: ese panel
—comentarios y su tono— sigue existiendo en el pipeline pero no en pantalla, y
lo que se ve no tiene comentarios de ninguna clase. Tecate, San Quintín y San
Felipe salen vacíos algunos días y el panel lo dice: «es un hueco, no un
cero».

Notas sobre los huecos:

- **El Vigía**, el diario principal de Ensenada, **no publica feed**; ahora se
  lee su portada con Scrapy. Su canal de YouTube tira a Shorts nacionales en
  vez de nota municipal: medido el 18 de septiembre de 2026, nueve de sus
  quince Shorts eran nacionales —Trump, Milei, Morelos— y el más visto de toda
  la corrida, con 3,985 vistas, hablaba de Trump y la Unión Europea. Por eso la
  zona de cada pieza sale de lo que nombra, no del medio que la publicó.
- **Canal 33**, dado de alta el 18 de septiembre de 2026, es la mejor fuente
  medida de Tijuana en este canal: 21 de 30 piezas la nombran y su mediana de
  vistas cuadruplica la del resto.
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
medio, así que no hay cuerpo que guardar aunque se quisiera, y tampoco trae
imagen: la miniatura solo existe para las notas que llegan por el feed del
propio medio. Las notas siguen
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
marcadas con el ícono de tendencia. Contestan «qué está sonando ahora», que es otra pregunta
que «qué cubre la prensa de la región», y por eso no se mezclan. Desde el 12
de septiembre la misma lista existe para cada zona y para la región en la
sección «Lo que destaca ahora», con pastillas de rubro que son búsquedas, y
con un tope de quince. La interfaz no nombra a Google, a petición del
cliente; este documento sí, porque la procedencia es parte de lo que el
producto no puede callar hacia adentro.

Consecuencia estructural que hay que decir en voz alta: el tablero
sobrerrepresenta a Tijuana. No es un defecto del código, es la distribución
real de la prensa y de la estadística oficial en el estado.

---

## Los indicadores y lo que cada uno NO dice

Ninguna de estas cifras las calcula el tablero: se leen de la fuente oficial y
se etiquetan. Cada una mide algo distinto y confundirlas es el error fácil.

**Esta tabla es el único sitio donde eso está escrito.** Hasta el 18 de
septiembre de 2026 el panel de indicadores traía un desplegable «Cómo leer este
dato» que decía lo mismo en corto; era el último de los siete y se quitó con el
pie del sitio, el mismo día y por la misma petición del cliente: la pantalla
enseña el dato, no se explica. Lo que sigue en pantalla es la **etiqueta** de
cada cifra —de qué fuente es y de cuándo—, porque eso no es metodología: es qué
es ese número. Lo de abajo es lo que ya no dice ninguna pantalla.

| Fuente | Qué es | Cadencia | La trampa |
|---|---|---|---|
| Índice SHF | avalúos de vivienda **con crédito hipotecario** | trimestral | base 2017=100 **rebaseada por serie**: los niveles no se comparan entre ciudades, solo las variaciones. No da precios en pesos por municipio, y **solo existe para Tijuana y Mexicali**: para los otros cinco no hay índice y no se infiere del de al lado |
| Predial SHCP | **recaudación**, no valuación | anual | contaminado por diferencias de tasa y de eficiencia de cobro; sirve para comparar un municipio consigo mismo, no para rankear |
| SESNSP | delitos **reportados**, no ocurridos | mensual, ~3 semanas de rezago | la serie RNID 2026 no se concatena con 2015–2025 sin crosswalk: cambió la clasificación. Y es **conteo absoluto, no per cápita**: un municipio grande sale arriba por ser grande |
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

**Una excepción, decidida por el cliente el 18 de septiembre de 2026.** Las
**consultas por término** (`data/consultas.json`, sección Redes → búsqueda)
publican el conteo de tono de los comentarios sobre una marca o una persona,
incluida la persona. Se publica como **conteos, nunca porcentajes ni una cifra
de «consenso»**, y siempre junto a una salvedad que el validador exige palabra
por palabra: mide si cada frase suena a queja, a celebración o a información,
no lo que quien escribe piensa de la persona o de la marca, y son comentarios
de quien decidió comentar, no una muestra de nadie. Desde el mismo día la
consulta publica también el **tono de cada titular de prensa** de los últimos
seis meses —favorable, adversa o neutral, el vocabulario del muro— con su medio
y su fecha, y un resumen hecho de conteos («3 titulares, 2 adversos; lo adverso
viene de tal medio»), nunca de «la mayoría» ni de un porcentaje. El cruce con
las **figuras** del roster sigue prohibido y la lectura automática sigue sin
atribuir postura a nadie. Queda registrado en `docs/PLAN.md`.

Y el modelo **solo habla español**. Los cuatro medios de San Diego publican en
inglés, así que sus notas —98 de 888 en el corte actual— salen con
`postura: null` en vez de con una etiqueta que un modelo entrenado en tuits en
español no puede sostener. El conteo se publica; el hueco no se rellena.

Y los temas salen de contar repeticiones de frases, sin modelo. Funcionan bien
para lo que está claramente arriba y mal para lo sutil. Un tema sostenido por
un solo medio se rotula como tal, porque es la agenda de ese medio.

### Y las cinco viven en el código y en este documento, no en la página

El **13 de septiembre de 2026** el cliente pidió que la interfaz dejara de
explicar cómo obtiene los datos. Es la regla del 12 de septiembre —la interfaz
no nombra a Google, este documento sí— corrida del proveedor a todo el
mecanismo: **la interfaz dice qué está viendo el lector y qué no afirma; nunca
cómo se obtuvo.** El caso que lo disparó: la sección de TikTok abría nombrando
la consulta literal, seguía con la regla de zona y terminaba diciendo que el
texto de los comentarios «se publica fuera de git y este despliegue no lo
trae».

Hasta el 18 de septiembre de 2026 las cinco se decían enteras **en cada
página**, en el pie del sitio. Ese día el cliente pidió quitar el pie del
tablero completo, con el mismo argumento que había quitado las fichas «Acerca
de» unas horas antes: el lector no viene a que le expliquen de dónde sale lo
que ve. **Queda dicho aquí que esa prosa ya no está en pantalla**, y este
documento pasa a ser el único sitio donde las cinco se leen juntas.

Lo que **no** cambió es dónde importa, que es junto al dato. Las reglas siguen
siendo ejecutables y siguen siendo visibles panel por panel: «sin dato» y
«fuera de muestra» siguen siendo estados distintos de cero y los sigue pintando
cada panel; por debajo de 30 elementos se siguen emitiendo conteos y no
porcentajes; prensa y comentarios siguen sin sumarse en una sola cifra; el tono
sigue sin cruzarse con `figuras`; las filas en vivo siguen marcadas y siguen
diciendo que no cuentan en las cifras de prensa; «es el ranking de X, no una
medida de la ciudad» sigue bajo su propio panel; y las lecturas del modelo
siguen llevando su salvedad fija, que `web/src/lib/analisis/reglas.ts` sigue
haciendo cumplir sobre la respuesta entera.

Lo que se fue de la pantalla, en los dos pasos, es prosa: primero el
procedimiento —«pipeline», «corpus», «corrida», «cosechado», Apify, las llaves,
el redirector, los nombres de archivo— y después el enunciado general de las
salvedades. Ninguna de las dos cosas era una comprobación; las comprobaciones
están en `pulso/validador.py` y en `reglas.ts`, y ahí siguen.

El desplegable «Cómo leer este dato» se había quitado ya de seis de los siete
paneles, por ser prosa de metodología. El de indicadores había sobrevivido con
el argumento de que explicaba qué miden el índice SHF, el predial y la ENSU —el
significado de la fuente y no el del código—. El 18 de septiembre de 2026 se fue
también, a petición del cliente, junto con el pie.

Ese argumento no era falso y por eso hay que decir qué pasó con él: **lo que
ese desplegable explicaba ahora solo está en este documento**, en la tabla de
arriba. Un lector que mire el predial de dos municipios lado a lado y no abra
PRODUCT.md no tiene en pantalla nada que le diga que está viendo recaudación y
no valor. Lo que sí sigue en pantalla, pegado a cada cifra, es su fuente y su
fecha; eso no se toca.

Hacia adentro no cambia nada: este documento, `docs/PLAN.md`, `AGENTS.md` y los
comentarios del código siguen nombrando cada mecanismo, porque la procedencia
es parte de lo que el producto no puede callar hacia adentro.

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

- **El texto no se commitea.** Va a `data/redes-comentarios.json`, que git
  ignora por nombre y que el pipeline regenera en cada corrida desde un caché
  que se purga a los 30 días. El sitio lo copia al construir. Lo que sale del
  caché desaparece de la página en la siguiente corrida; el historial de git
  nunca lo tuvo.
- **La identidad no existe en ningún archivo.** Usuario, foto e id de quien
  comenta se descartan al leer. La página muestra la frase, no la persona.
- **Instagram no publica compartidos, reposts ni guardados** de cuentas
  ajenas. Esas cifras son «sin dato», no cero. Sí hay likes, comentarios y, en
  video, reproducciones.

En YouTube no cambia nada: ahí el «nunca el texto» sale de una política
escrita, no de una decisión del cliente.

### TikTok: búsquedas, no cuentas, y lo que eso obliga

La sección de TikTok lee búsquedas (relevancia, últimas 24 horas) sin iniciar
sesión: una por lugar del corredor más una de México y una del mundo. Como los
videos vienen de cualquier creador, la regla de zona es la de las notas de
prensa: la da lo que nombra la descripción, nunca la consulta. Se muestra el @
del creador porque es quien publicó y la liga ya lo trae; quien comenta sigue
anónimo. TikTok sí publica compartidos y guardados, y aquí aparecen como
cifras medidas.

Lo que cambia entre una búsqueda del corredor y las dos nuevas es **solo el
residuo**, nunca la zona de un video cuya descripción nombra un lugar. En una
búsqueda del corredor, un video de otra región se descarta; en la de México se
conserva y se rotula «fuera del corredor», porque es justo lo que esa lista va
a buscar. Un video que no nombra lugar alguno se rotula «sin lugar», y en la
lista del mundo va a «Mundo». Ninguna de las dos tiene página de zona: se ven
en la vista de región, detrás de su propia pastilla, y la página lo dice —
«Mundo» agrupa lo que no nombra ningún lugar de la región, no es una
comprobación de que el video sea del extranjero.

**Tres lugares no tienen búsqueda, y eso está escrito, no omitido.** Tecate,
San Felipe y San Quintín se probaron el 15 de septiembre de 2026 y no devuelven
noticia: «tecate» es cerveza antes que municipio —un incendio en Apodaca,
Nuevo León, entró como Tecate— y «san felipe» es topónimo de media
república. Un falso positivo con cara de cobertura es peor que un hueco
rotulado. Tecate sí tiene prensa y cuenta de Instagram; San Quintín sigue
siendo la zona sin cobertura que este documento declara desde el principio.

### X: tendencias, sin sesión y sin tuits

El 11 de septiembre de 2026 el cliente pidió ver qué es tendencia en X. Los
tuits siguen fuera: sus raspadores piden cookies, y eso es el raspado con
cuenta que se refusa arriba. Las tendencias entran porque el endpoint de X las
sigue dando a un navegador sin cuenta, y así las lee el actor de Apify: sin
iniciar sesión. Lo que se muestra es el ranking de X para Tijuana, Mexicali,
San Diego, México y el mundo, en su orden, con el nombre de cada tendencia y la
liga a su búsqueda; nunca un tuit ni quién lo escribió, y las promocionadas se
descartan. Es lo que X decidió destacar, no de qué habla la ciudad, y el
tablero lo dice. Para Ensenada, Rosarito, Tecate, San Quintín y San Felipe X no
publica lista, y eso se rotula, no se rellena con la nacional. El volumen de
tuits es «sin dato» casi siempre: X lo retiró en enero de 2026.

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
