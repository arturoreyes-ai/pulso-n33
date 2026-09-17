> **Implementación · 17 de septiembre de 2026 — Analizar prepara una ficha para cabina.** A petición del cliente, el botón existente deja de devolver solo una lectura general y organiza la respuesta para una mesa de noticias: un resumen breve, entre tres y cinco puntos clave en orden de importancia, lo que la nota no establece y una sola idea de contenido para redes con formato, enfoque y gancho. No escribe un guion para leer al aire, un post terminado ni variantes por plataforma. Se mantienen las fronteras decididas el 15 de septiembre: la llamada ocurre solo después de confirmar el botón, va apagada por omisión, el cuerpo vive en memoria durante esa petición y nunca se guarda ni vuelve en la respuesta; la ficha puede equivocarse, no sustituye leer la nota, no atribuye postura a personas y no cuenta en las cifras de prensa. En pantalla toda esa metodología se reduce a «Generado con IA».

> **Implementación · 15 de septiembre de 2026 — La portada es el producto.** A petición del cliente se retira **Prensa**, la página que unas horas antes había recibido el muro de titulares: el sitio queda en En Tendencia, Redes, Indicadores, Garitas y Gasto electoral. Con esa página se van el muro y su tono, «De qué se habla esta semana», «Hoy en cifras» y la faceta por delegación; el cálculo no se detiene —la ingesta sigue midiendo y archivando lo mismo cada seis horas—, simplemente deja de tener pantalla, así que volver a mostrarlo es trabajo de interfaz y no de datos. **La búsqueda no se fue con ella**: vive en la portada, en la lupa de la barra, busca en el lugar que se esté leyendo y queda en el enlace, así que se comparte y sobrevive a una recarga. **Los comunicados del Ayuntamiento de Tecate tampoco se perdieron**: entran al recorrido de Tecate como un capítulo propio, después de los cinco rubros y antes de México, con los cinco más recientes; se rotulan «comunicado» y no «en vivo», llevan día sin hora porque el Ayuntamiento no publica hora, y siguen sin contar en ninguna cifra de prensa. El diálogo de «por dónde empezar» pasa a tres opciones —la región, México e Internacional— con las ocho ciudades plegadas bajo la primera: antes eran once opciones seguidas y las dos ediciones quedaban fuera de la pantalla. Sustituye lo dicho hoy mismo sobre Prensa. No cambia la ingesta, las cifras ni la retención.

> **Implementación · 15 de septiembre de 2026 — En Tendencia es la portada.** A petición del cliente, la página de inicio deja de ser el muro y pasa a ser el recorrido de titulares en vivo, que hasta ayer vivía en «Ahora» y ahora se llama **En Tendencia**: un titular por pantalla, empezando por el lugar que se elija —una zona, el corredor— o por México o Internacional, que se eligen en la misma barra. `/ahora` sigue funcionando y lleva a la portada. Nada del muro se quitó: los titulares con su tono y sus temas, «De qué se habla esta semana», «Hoy en cifras» y los Comunicados del Ayuntamiento de Tecate se mudan enteros a **Prensa**, una página nueva en la nav que existe también por zona, con las mismas pastillas de Región, México e Internacional. Cada tarjeta de titular gana un botón **Analizar** entre «Leer en» y «Compartir»: abre la nota del medio y devuelve una lectura breve de qué trata y qué no establece, hecha por máquina, que puede equivocarse y no cuenta en las cifras de prensa. Va apagado por omisión. Abrir la nota para leerla es decisión del cliente de hoy y mueve lo asentado en §3 sobre no tocar el cuerpo: nada de ese cuerpo se guarda ni se publica, la respuesta trae la lectura y nunca el texto leído, y no se cruza tono con figura. El enlace que publica el buscador no abre la nota —solo se resuelve dentro de un navegador—, así que la lectura usa el enlace del propio medio cuando el mismo titular está en el archivo; donde no lo está, el botón lo dice. Sustituye lo dicho el 14 de septiembre sobre «Ahora» como página aparte y sobre «En Tendencia» como sección de la portada. No cambia la ingesta, las cifras de prensa ni la retención.

> **Implementación · 15 de septiembre de 2026 — Redes, todo el corredor.** A petición del cliente, el panel de redes deja de ser un panel de Tijuana. Instagram pasa de 13 a **27 cuentas activas**: Mexicali (cinco, con `@canal66tv` cerrando el hueco que el archivo registraba desde el 8 de septiembre), Ensenada (tres más), Tecate (la primera), San Diego (tres) y tres que el cliente agrupó como «México» y van como `nacional`, por decisión suya. Las quince se sondearon antes de encenderse, como exige el propio archivo, y una **no resistió**: `@svnnoticias` está viva con 31 mil seguidores pero es «Sonora Visión Noticias», así que quedó en `senuelos` —en Instagram la zona no la da el gacetero sino la fila, y nada habría descartado sus comentarios de Hermosillo. Es el bug de El Imparcial otra vez, atajado por el sondeo. San Diego se parte por idioma: Univision y KSDY50 emiten en español y llevan tono; 619 News Media va en inglés y su postura queda en null, como los cuatro medios de San Diego del muro.
>
> TikTok pasa de una búsqueda a **once, ocho encendidas**, con un campo nuevo, `ambito` (regional | nacional | internacional). `ambito` **no es una zona y no acredita lugar a nadie**: cuando el pie del video nombra un lugar, manda el pie, igual en los tres. Lo único que decide es el residuo —el video que no nombra lugar, o que nombra uno de fuera—, porque las dos búsquedas nuevas rompían la regla vieja: «noticias méxico» tiraba Mazatlán y Sinaloa, que es justo lo que iba a buscar, y un video de Ucrania caía en `nacional`, indistinguible de una nota nacional mexicana. De ahí salen la zona `internacional`, que solo existe en TikTok, y el campo `alcance`, el veredicto crudo del gacetero, que viaja al lado de la zona para que «sin lugar» y «fuera del corredor» no se confundan. En la vista de región hay tres pastillas nuevas —Corredor, México, Mundo— porque un video del mundo trae órdenes de magnitud más likes que uno de Tecate y, sin separarlos, el corredor desaparecía de su propia portada.
>
> **Tres búsquedas quedaron apagadas con la razón escrita: Tecate, San Felipe y San Quintín.** Se probaron de verdad, con dos y tres consultas cada una, y no devuelven noticia sino falsos positivos: un incendio en Apodaca, Nuevo León, zonificado como Tecate porque el pie decía «Tecate Six»; una carrera de un club de running de Manhattan zonificada como San Felipe; un video de Cusco y otro de San Luis Potosí bajo San Quintín. «Tecate» es cerveza antes que municipio y «san felipe» es topónimo de media república. Un falso positivo con cara de cobertura es peor que un hueco rotulado, y para San Quintín este es el tercer hueco que el repositorio registra para el mismo municipio, coherente con §6 de este plan.
>
> **La factura sube y por eso la profundidad de TikTok baja**, de 30 videos × 30 comentarios a 15 × 20: con once búsquedas al ritmo anterior, la primera corrida del día costaría ~45 USD; así son ~12. Veinte comentarios por video quedan debajo del piso de 30 de PRODUCT.md y no cambia nada, porque este panel no emite un solo porcentaje. El tope de Instagram sube de 2,600 a 4,400 resultados por corrida: sin eso, el reparto por cuenta caería de 200 a 96 y se perderían 59 comentarios por cuenta **sin aviso**, que es como falla `reparto - posts`. Sigue en pie todo lo demás: nadie inicia sesión, el texto de los comentarios no entra a git, la identidad de quien comenta no se ingiere, y el panel sigue detrás de `APIFY_HABILITADO` con la opinión legal de §3 pendiente.

> **Implementación · 15 de septiembre de 2026 — Redes en un solo lector.** La página de redes deja de tener Lista / Visual: en todo tamaño de pantalla es un lector a pantalla completa con su propia barra (volver, lugar, información) y pestañas para Todas, Instagram, TikTok, YouTube y X. Las listas de Instagram y TikTok se retiran; los comentarios más votados de cada publicación, cuyo texto la dirección pidió ver el 8 de septiembre, pasan a la tarjeta: una vista previa en la columna de escritorio y una hoja «Comentarios» en ambos tamaños, con la frase de sentimiento y los temas. YouTube conserva su panel de cifras. X conserva su contenido y sus salvedades en filas al estilo de la página de tendencias de X —puesto, contexto y nombre, con la primera tendencia de cada ubicación en la voz de titular— y sin imagen de portada. En escritorio la píldora de navegación sigue arriba del lector. Sustituye lo dicho el 14 de septiembre sobre Lista como entrada inicial y sobre los comentarios en Lista. No cambia la ingesta, el límite de selección ni la retención.


> **Implementación · 14 de septiembre de 2026 — Miniaturas.** A petición del cliente, cada nota de un medio del catálogo lleva la miniatura que ese medio publica en su propio feed, enlazada y nunca copiada, y solo si la imagen es del medio (su dominio o un CDN declarado en `config/medios.json`). Diez de quince feeds la traen; Zeta, El Sol de Tijuana, La Voz de la Frontera, Jornada BC y Síntesis no, y las notas encontradas por búsqueda tampoco: ahí la tarjeta de «Ahora» sigue siendo tipográfica. La imagen se conserva tal como se vio la primera vez. No se toca el cuerpo de la nota ni se resuelve el redirector de Google. Pendiente la opinión legal que pide §3; la decisión es del cliente.

> **Implementación · 14 de septiembre de 2026 — Ahora.** Nueva página «Ahora» en la nav: titulares en vivo a pantalla completa, uno por tarjeta, que se pasan con el gesto de desplazar (Anterior / Siguiente en escritorio). Se elige por dónde empezar —una zona, el corredor, México o Internacional— y el recorrido encadena, en este orden, lo que destaca ahí, los cinco rubros de ese mismo lugar o edición, y las otras dos secciones, con una tarjeta divisoria entre capítulos; un titular ya mostrado no se repite. Cada tarjeta lleva titular, medio, hora, «en vivo», el enlace al medio y Compartir; no hay imagen ni extracto porque la fuente no los publica, y el producto sigue siendo titular, fuente y enlace. Se conserva el máximo de 15 por lista; una lista que falla se dice que falta y el recorrido sigue. No cambia la ingesta ni las cifras de prensa.

> **Implementación · 14 de septiembre de 2026 — En Tendencia.** Los titulares destacados en vivo abren la portada antes de Titulares, bajo el nombre «En Tendencia». Actualizar pide la respuesta más reciente para el lugar, rubro o búsqueda elegidos, conserva la lista mientras espera y avisa si no hay novedades o si falla. No cambia las cifras de prensa ni la ingesta; México e Internacional conservan una sola lista en vivo.

> **Implementación · 14 de septiembre de 2026 — Visual en el teléfono.** En pantallas angostas la página de redes abre en Visual: cada publicación ocupa la pantalla, se pasa de una a otra con el gesto de desplazar, y debajo van el titular, la antigüedad y el lugar, con las cifras al costado; lo que la plataforma no publica se dice «sin dato», nunca 0. En escritorio Lista sigue siendo la entrada inicial y la disposición a dos columnas no cambia. Sigue montado un solo medio a la vez; la publicación de Instagram conserva su altura propia y puede exceder una pantalla. No cambia la ingesta, el límite de selección ni la retención.

> **Implementación · 14 de septiembre de 2026 — Redes visuales.** Se añade Lista / Visual; Lista sigue siendo la entrada inicial. Visual reúne la selección existente de Instagram y TikTok, con filtros por plataforma y zona, mediante publicaciones incrustadas oficiales. Solo un medio permanece montado; los comentarios siguen en Lista. No cambia la ingesta, el límite de selección ni la retención. La disponibilidad de cada publicación depende de su plataforma.

<!-- Documento del cliente, copiado tal cual. Las divergencias de la
implementacion se anotan arriba, no editando el texto de abajo. -->

> ### Nota de implementación — Gasto electoral de Baja California
>
> Se añadió `/gasto-electoral` como página independiente. El procesamiento
> une los CSV abiertos y los Anexos II finales del INE por `id_contabilidad`,
> registra toda fila no conciliada y lee los ZIP por rangos. La vista separa
> sin ambigüedad gasto auditado por candidatura de las asignaciones públicas
> a partidos en 2026; estas últimas no se atribuyen a personas ni se presentan
> como gasto ejercido. La actualización es semanal o manual, no cada seis
> horas, y los archivos históricos no llevan hora de ejecución.

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

> ### Nota de implementación — Instagram vía Apify
>
> §3 cierra con «get a lawyer's sign-off before any scraping of a platform
> with a login wall. **This plan assumes we don't.**» El cliente pidió
> explícitamente el raspado de redes el **8 de septiembre de 2026** y se
> construyó, así que el plan y la implementación ya no coinciden en este
> punto. Lo que sigue en pie y lo que cambió:
>
> **Sigue en pie, y es la condición de todo lo demás: nadie inicia sesión.**
> El actor de Instagram declara extraer solo los comentarios que ve un usuario
> no logueado. Apify no altera el análisis de §3 —rentar el navegador no renta
> la responsabilidad, y en *Meta v. Bright Data* la defensa dependió de no ser
> «usuario»— así que la regla se volvió ejecutable en vez de quedar escrita:
> `pulso/apify.py` rechaza cualquier actor activo cuya entrada traiga cookies,
> credenciales o token de sesión, y hay una prueba que lo fija. Cambiar
> `"activo": true` no basta para encender un raspado logueado.
>
> **Sigue en pie la advertencia de que deslogueado se ve poco.** §3 dice que
> «logged out, Facebook and Instagram show almost nothing». Los planes
> gratuitos de Apify devuelven ~15 comentarios por post, lo que choca de
> frente con la cuarta regla de PRODUCT.md: debajo de 30 elementos se emiten
> conteos, no porcentajes. Por eso `data/redes.json` no publica un solo
> porcentaje y el validador los rechaza.
>
> **Cambió el fundamento de la retención, no el plazo.** §3 y la nota de
> arriba razonan los 30 días desde la política de YouTube (III.E.4.d). Meta no
> concede plazo alguno: aquí atan sus términos más la LFPDPPP y la CPRA. Se
> aplica el mismo plazo por ser el más corto ya implementado, y además la
> identidad de quien comenta **se tira al ingerir**, así que no llega ni al
> caché.
>
> **X quedó fuera, y no por costo.** Cerró la lectura anónima en 2023, así que
> todo raspador que sirve pide cookies: es exactamente el caso que §3 refusa.
> Está registrado como señuelo en `config/apify.json`. La vía legal sería la
> API oficial de pago.
>
> **Falta lo que §3 pide y no se ha hecho:** sigue sin haber opinión legal
> escrita. Las diez cuentas de `config/instagram.json` se sondearon y
> verificaron el 8 de septiembre de 2026; el panel sigue detrás de
> `APIFY_HABILITADO`, igual que el de YouTube.
>
> **Se publica el texto de los comentarios, por instrucción de la dirección
> (8 de septiembre de 2026, tarde).** Ese mismo día por la mañana se había
> acordado publicar solo conteos derivados; por la tarde la dirección pidió
> ver los 15 posts con más likes de la semana con el texto de sus comentarios
> más votados. Es una decisión del cliente y queda aquí para que nadie la
> vuelva a discutir desde cero. Lo que la acota: el texto **no entra a git**
> —vive en `efimero/redes-comentarios.json`, carpeta ignorada que el pipeline
> regenera en cada corrida desde el caché de 30 días y que el sitio copia al
> construir—, la identidad de quien comenta sigue sin ingerirse, y se muestran
> a lo sumo 10 comentarios por post (5 visibles y 5 más solo si tienen likes).
> Para YouTube no cambia nada: ahí el «nunca texto» sale de política escrita.
> Instagram no expone compartidos, reposts ni guardados de cuentas ajenas, así
> que esas cifras se rotulan «sin dato».
>
> **TikTok entró, por búsqueda y sin sesión (8 de septiembre de 2026).** §3
> lo descartaba porque la Research API es académica; el camino real es el
> actor público `clockworks~tiktok-scraper`, deslogueado, con la consulta
> «tijuana noticias» ordenada por relevancia sobre las últimas 24 horas, más
> `clockworks~tiktok-comments-scraper` para los comentarios (~5 USD por 1,000
> resultados). Cuatro decisiones del cliente lo acotan: (1) la fuente es una
> **búsqueda**, así que ningún video hereda zona de la consulta; la zona sale
> de lo que nombra la descripción con el mismo gacetero que las notas, un video
> de fuera de la región se descarta y uno sin lugar queda `nacional`; (2) se
> muestra el **@ del creador** como fuente, porque es quien publicó y la liga
> ya lo trae, y es la única identidad que cruza a `data/`; quien comenta sigue
> anónimo; (3) la ventana es de **24 horas** sobre la hora exacta de
> publicación, impuesta en el pipeline y no confiada al filtro del actor; (4)
> se muestran del más reciente al más antiguo. El texto va a
> `efimero/tiktok-comentarios.json`, fuera de git, como el de Instagram. TikTok
> sí publica compartidos y guardados; aquí aparecen.

---

> ### Nota de implementación — Instagram: las últimas 24 horas
>
> **El cliente pidió el 10 de septiembre de 2026 ver «lo último de las 24
> horas» de cuatro cuentas de Instagram:** `@tjnoticias`, `@yoamotijuana`,
> `@tijuanainforma.mx` y `@el.tijuanense`. Solo la primera estaba en
> `config/instagram.json`; las otras tres no aparecían en ningún archivo del
> repositorio y nunca se habían sondeado.
>
> **Cambia la ventana del panel, y con eso se revierte parte de la decisión
> del 8 de septiembre.** Aquella tarde la dirección pidió «los 15 posts con
> más likes de la semana»; desde el **10 de septiembre de 2026** el panel de
> Instagram muestra los posts con más likes de las **últimas 24 horas**,
> medidas sobre la hora exacta de publicación (`publicado`) igual que TikTok,
> del más reciente al más antiguo y con la hora en cada fila. Es una decisión
> del cliente y queda aquí para que nadie la vuelva a discutir desde cero. Lo
> que NO cambia: el texto de los comentarios más votados se sigue publicando
> (fuera de git, en `efimero/`), la identidad de quien comenta sigue sin
> ingerirse, y compartidos y guardados siguen siendo «sin dato».
>
> **Las tres cuentas nuevas pasaron por `--sondear` antes de encenderse,**
> como exige el propio archivo, y las tres resistieron: `@yoamotijuana`
> (572,558 seguidores, 23,999 posts) es una revista de ciudad y no un medio de
> noticias, la misma salvedad escrita de `tjpublica_ig`; `@el.tijuanense`
> (115,257 seguidores, 12,597 posts) y `@tijuanainforma.mx` (45,224
> seguidores, 1,145 posts) son medios digitales tijuanenses nativos de redes.
> Ninguna tiene equivalente en `config/medios.json`. Con ellas el catálogo pasa
> de diez a trece cuentas activas, y el tope de Apify sube de 2,000 a 2,600
> resultados por comando para que el reparto por cuenta no recorte la pasada
> de comentarios en silencio.
>
> **Un corte anterior sigue siendo válido.** `data/redes.json` lo escribe el
> bot y no se edita a mano; el commiteado el 8 de septiembre trae
> `ventana_dias: 7` y filas sin `publicado`, y el validador lo acepta con un
> aviso hasta que el cron lo regenere. El cron solo lo hará con
> `APIFY_HABILITADO` encendida, que a la fecha de esta nota sigue apagada.
>
> **Dos límites del dato, escritos antes de que sorprendan.** Cada corrida ve
> los últimos cinco posts de cada cuenta, cuatro veces al día: «los de más
> likes de 24 horas» son los de más likes entre esos, y una cuenta que publica
> más de cinco veces entre corridas pierde posts (subir el número encarece las
> dos pasadas de Apify, no una). Y con una ventana de 24 horas los comentarios
> de un post se leen una sola vez —`dias_entre_cosechas` solo deduplica las
> corridas del día—, así que sus conteos y su texto son la foto de la primera
> lectura, mientras likes, comentarios y reproducciones se refrescan en cada
> corrida.

---

> ### Nota de implementación — Actualidad de México e Internacional en el muro
>
> **El cliente pidió el 11 de septiembre de 2026 un filtro de noticias de
> México y de noticias internacionales que muestre «lo que está sonando en ese
> momento», con una barra para buscar encima, reutilizando la vía de Google
> Noticias que ya existía.** Esta nota documenta también la búsqueda en vivo,
> que se publicó el 8 de septiembre sin nota propia.
>
> **Lo que ya había.** Desde el 8 de septiembre el muro de titulares busca en
> vivo en el RSS de Google Noticias (`/api/buscar`) además de en lo cosechado,
> con cuatro alcances: la zona de la página, la región, México e Internacional.
> Pero las pastillas de alcance solo aparecían al escribir, y con México o
> Internacional sin consulta el muro quedaba vacío: el corpus es regional por
> construcción y no participa en esos dos, y la búsqueda no tenía qué buscar.
>
> **Lo que se construyó.** Las pastillas de alcance están siempre a la vista
> en la barra del muro (Región · México · Internacional, más la zona en la
> página de una zona). Con México o Internacional y sin consulta, el muro
> muestra la sección de Google Noticias de ese momento (`/api/actualidad`):
> México es la sección «México» de la edición mexicana —decisión del cliente
> frente a la portada «Noticias destacadas», que mezcla país y mundo—;
> Internacional es la sección «Mundo» en las ediciones en español y en inglés,
> intercaladas. Se muestra **en el orden de Google**, que no es por fecha (se
> midió: 23 inversiones en 45 titulares) sino su ranking de la sección; ese
> orden es la señal de «qué suena ahora», y por eso en ese modo no hay
> pastillas de orden. Se refresca cada cinco minutos, lo mismo que vive en el
> CDN, y al volver a la pestaña. Escribir tres letras o más pasa a la búsqueda
> en vivo dentro de ese alcance, que ya existía; borrar vuelve a la actualidad.
> El enlace `/?a=mexico` se comparte.
>
> **Lo que NO cambia, dicho antes de que alguien lo proponga.** Nada de esto
> entra a `data/` ni al pipeline: el cron de seis horas no puede decir «ahora
> mismo», y un titular nacional que no nombra ningún lugar de la región sería
> `alcance: nacional` y nunca llegaría al muro. Las filas son enlaces sin
> clasificar —sin zona, tono ni figura, marcadas «en vivo»— y no se suman con
> ninguna cifra de prensa. Sigue siendo titular, medio y enlace, y el enlace es
> el redirector de Google, como en la búsqueda. Si Google redirige fuera de
> `news.google.com`, no se lee un byte. Si una edición falla, se dice cuál y la
> respuesta no se guarda en el CDN.
>
> **Ese mismo día, más tarde, el cliente pidió dos cosas más.** Una sección en
> la portada con «lo que está sonando en las noticias» del lugar que se mira,
> con el mismo lector de Google Noticias: es «Lo que destaca ahora», debajo de
> «De qué se habla esta semana», y muestra la sección LOCAL que Google arma
> para la zona (`/api/actualidad?z=<zona>`), en el orden de Google y con diez
> filas que se abren de diez en diez. En la región van las de Tijuana y San
> Diego intercaladas (`?a=region`), porque la sección «Baja California» de
> Google existe pero llegó vacía en el sondeo del 11 de septiembre. Tijuana va
> en español e inglés; San Diego en inglés; las demás en español, y las cuatro
> chicas (Tecate 6, Rosarito 8, San Quintín 5, San Felipe 1 titulares ese día)
> muestran lo que hay, nunca se rellenan. Y quitar la pastilla «Antiguas» del
> muro: un muro de prensa se lee de hoy hacia atrás, así que el control de
> orden desapareció entero y el muro va siempre del más reciente al más
> antiguo.
>
> **Y una tercera, con una captura de Google Noticias en la mano:** la caja
> «Trending topics» de la página local de Google (Weather, Crime, Sports,
> Politics, Business, con notas debajo de cada pastilla). El RSS de Google no
> expone esa clasificación ni las imágenes, así que «Lo que destaca ahora»
> lleva pastillas de rubro —Clima, Seguridad, Deportes, Política, Economía—
> que son **búsquedas** en Google Noticias (`/api/actualidad?…&t=<rubro>`):
> los términos del rubro en el idioma de cada edición más los del lugar, en
> los últimos dos días y en el orden de Google. El panel dice que no es la
> clasificación de Google; «Todo» sigue siendo la sección tal cual, y no hay
> miniaturas porque el feed no las trae.
>
> **El 12 de septiembre de 2026 el cliente ajustó cuatro cosas de esa
> sección.** (1) La interfaz **no nombra a Google**: los títulos y las frases
> hablan de «lo que destaca ahora» y de «búsqueda en vivo»; el código y estos
> documentos sí lo nombran, porque de ahí sale el dato, y cada fila sigue
> nombrando al medio, que es la fuente real. (2) **Quince titulares como
> máximo** por lista, en vez de cuarenta, «para minimizar el desfase»: en una
> lista por relevancia lo que se aleja del lugar o del rubro se acumula al
> final; sin pie de «mostrar más». (3) **Reloj de doce horas** en todo el
> tablero («9:36 pm», no «21:36 h»), no solo ahí. (4) **La misma
> implementación en todos los alcances**: en las ocho zonas y en la región
> vive en la sección «Lo que destaca ahora»; en México e Internacional, donde
> no hay corpus, vive en el propio muro de titulares, con las mismas
> pastillas de rubro y el mismo tope, y la sección de abajo se oculta para no
> mostrar la misma lista dos veces.

---

> ### Nota de implementación — X: tendencias, sin sesión
>
> **El cliente preguntó el 11 de septiembre de 2026 si se puede mostrar «qué es
> tendencia en X» para la región, México y el mundo.** §3 refusa el raspado con
> cuenta, y la nota de arriba sacó a X porque «todo raspador que sirve pide
> cookies». Eso sigue siendo cierto para los **tuits**, y por eso
> `apidojo~tweet-scraper` sigue de señuelo en `config/apify.json`. Las
> **tendencias** resultaron ser la excepción: el endpoint de tendencias de X
> sigue contestando a un guest token, la credencial anónima que recibe un
> navegador sin cuenta, y el actor `automation-lab~twitter-trends-scraper` lo
> lee así: su entrada son ubicaciones y un tope, sin cookies ni contraseña, y
> pasa la guardia de `pulso/apify.py`. Nadie inicia sesión. La postura legal es
> la misma que la del actor de Instagram: deslogueado, pendiente de opinión
> legal, detrás de `APIFY_HABILITADO`.
>
> **La alternativa limpia queda escrita.** La API oficial de X cobra hoy 0.01
> USD por llamada a `GET /2/trends/by/woeid` (pago por uso; los planes Basic y
> Pro cerraron en 2026). Cinco ubicaciones cuatro veces al día son unos 6 USD
> al mes. Se eligió el actor por reutilizar el token, el presupuesto y la
> compuerta que ya existen; si el abogado prefiere la API, `pulso/tendencias.py`
> cambia de fuente y el contrato de `data/tendencias.json` no.
>
> **Qué se publica y qué no.** De cada tendencia, el nombre, el puesto que X le
> dio y la liga a su búsqueda en X. Ni un tuit ni quién lo escribió: un nombre
> que empieza con @ se descarta. Las promocionadas son anuncios y se descartan.
> El volumen va solo cuando X lo publica —lo retiró para casi todas en enero de
> 2026—; ausente es «sin dato», nunca cero. Es el ranking de X, no una medida
> de la ciudad, y el tablero lo dice así.
>
> **Dónde hay lista y dónde no.** X publica tendencias por ciudad para Tijuana
> (WOEID 149361), Mexicali (133475) y San Diego (2487889), más México (23424900)
> y el mundo (1); los cinco se confirmaron el **11 de septiembre de 2026** con
> `python -m pulso tendencias --ubicaciones` sobre las 467 ubicaciones del
> actor. Para Ensenada, Rosarito, Tecate, San Quintín y San Felipe no hay lista:
> cada una tiene una fila apagada en `config/tendencias.json` y el tablero
> rotula el hueco en vez de mostrar la lista nacional como si fuera local. Y
> un límite del dato que salió en el primer sondeo: Tijuana, Mexicali y México
> devolvieron exactamente las mismas cinco tendencias en el mismo orden. X
> publica el WOEID de la ciudad pero, al menos ese día, lo llenó con la lista
> nacional; el panel muestra la lista y lo dice debajo del título.
>
> **Cuesta centavos.** Una sola llamada al actor por corrida cubre las cinco
> ubicaciones: ~100 tendencias, unos 0.015 USD; ~2 USD al mes.

---

> ### Nota de implementación — La interfaz dice qué, no cómo
>
> **El 13 de septiembre de 2026 el cliente pidió que la interfaz dejara de
> explicar cómo obtiene los datos.** El caso que lo disparó es la faceta de
> TikTok, que abría nombrando la consulta literal —«De los videos de las
> últimas 24 horas para «tijuana noticias», los que nombran Tijuana en su
> descripción. La zona la da el pie del video, no el creador»— y seguía con
> «se publica fuera de git y este despliegue no lo trae» y «5 de 7 comentarios
> leídos». Un lector del tablero no necesita nada de eso.
>
> **Es la regla del 12 de septiembre, generalizada.** Esa nota dejó por escrito
> que la interfaz no nombra a Google y que este documento sí. La misma frontera
> se corre ahora del proveedor a todo el mecanismo: **la interfaz dice qué está
> viendo el lector y qué no afirma; nunca cómo se obtuvo.** Salieron de la
> pantalla, entre otras, `pipeline`, `corpus`, `corrida`, `corte`, `cosechado`,
> `vigentes`, Apify, la llave de YouTube, el redirector, las Políticas para
> Desarrolladores, `notas.json` y un `python -m pulso correr` que el muro le
> ofrecía al lector cuando no había datos.
>
> **Lo que NO cambió, y es lo que hace que esto no sea opacidad.** Las cinco
> reglas de PRODUCT.md siguen dichas en cada página, completas, en el pie del
> sitio (`web/src/components/chrome/pie.tsx`), que además ganó la única que le
> faltaba: los huecos se rotulan, no se rellenan. «Sin dato» y «fuera de
> muestra» siguen distinguiéndose de cero en cada panel; «Es el ranking de X, no
> una medida de la ciudad» sigue ahí; las filas en vivo siguen marcadas y
> siguen diciendo que no cuentan en las cifras de prensa. Lo que se fue es el
> procedimiento, no la salvedad.
>
> **Se quitó «Cómo leer este dato» de seis de los siete paneles** —las cuatro
> facetas de redes, actualidad y temas—, que era prosa de metodología. El de
> indicadores se queda: explica qué miden el índice SHF, el predial y la ENSU,
> que es el significado de la fuente y no el de nuestro código, y es el único
> lugar donde quitarlo haría que una cifra significara algo falso.
>
> **Ningún cambio en el pipeline.** La búsqueda de TikTok sigue siendo «tijuana
> noticias»; solo dejó de decírsele al lector.

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
