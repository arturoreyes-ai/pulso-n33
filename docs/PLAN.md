> **Implementación · 25 de septiembre de 2026 — La búsqueda da lo que da Google
> Noticias, Entretenimiento, y los temas por relevancia.** El cliente buscó
> «mañanera» y no obtuvo lo mismo que en Google Noticias. La búsqueda pegaba los
> lugares del corredor a la palabra, también desde México, y eso traía notas de
> semanas atrás. Ahora la búsqueda respeta desde dónde se hace: desde México y
> desde Internacional busca la palabra tal cual, y da la misma lista que Google
> Noticias; desde el corredor, los primeros diez resultados son esos mismos y
> debajo siguen los del corredor y los de sus medios; desde un municipio sigue
> buscando en ese municipio.
>
> «Espectáculos» se llama ahora **Entretenimiento**, y los temas van por
> relevancia informativa: Política, Seguridad, Economía, Clima, Deportes,
> Entretenimiento, Turismo e IA, en la fila y en el recorrido. Con la entrada
> México, Entretenimiento, Deportes y Economía son la sección de Google para
> México y no una búsqueda: es su propia selección de lo más relevante del día.
> Y todos los temas de México quitan lo que es de otro país, como «Soda Stereo
> en Madrid» o «Susan Sarandon es arrestada en Nueva York»; lo que no nombra
> ningún lugar se queda, porque no se puede probar que sea de fuera. La tarjeta
> que separa los capítulos decía «15 titulars»; ya dice «titulares».

> **Implementación · 24 de septiembre de 2026 — Guion para locución en la
> pestaña TikTok.** El cliente cambió el foco del «Resumen con IA» del 23 de
> septiembre: ahora es un guion que un conductor memoriza y dice, pedido con un
> botón por programa. Noticias 33 saca exactamente cinco clips, uno por eje
> (garitas, información de Tijuana, mañanera de la presidenta, información de
> California) y un quinto libre; De Red en Red, un clip por cada tema de
> espectáculos. El resumen automático se retira, así que ninguna lectura con
> modelo se pide sola. Un eje sin videos del día se dice y no se rellena con
> otro.
>
> El mismo día el guion pasó a tener forma de guion (apertura, entrada a
> cámara, pase, clip, salida y cierre) y, por decisión del cliente tras
> comparar dos modelos, se escribe con Sonnet 5: cuesta unos 2 centavos de
> dólar por guion en lugar de medio, y fue el que atribuyó bien cada clip.

> **Implementación · 24 de septiembre de 2026 — Medios de México y del mundo en
> las dos redes.** El cliente pidió CNN en Español, BBC News Mundo y DW Español
> para Internacional, y Latinus, Azteca Noticias, Noticias Telemundo y N+ para
> México, en Instagram y en TikTok, «por ahora» en las dos. Se deja escrito
> como excepción a la regla de un medio en una sola red del 22 de septiembre:
> la misma nota puede salir dos veces en «Todas». Noticias Telemundo se
> zonifica por lo que nombra cada publicación, y la que no nombra lugar va a
> Internacional, por indicación del cliente. El TikTok de BBC News Mundo es
> @bbcnewsmundo; @bbcmundo es otra cuenta.

> **Implementación · 23 de septiembre de 2026 — Facebook en Redes.** El
> cliente pidió una pestaña de Facebook con cinco páginas: Blanco y Negro,
> Noticias de Tijuana, PSN, TV Azteca Baja California y Blanco y Rojo Noticias
> Tijuana, con lo más destacado del día. Se leen sin sesión, como Instagram:
> los posts de las últimas 24 horas, ordenados por reacciones y comentarios,
> con una vuelta por página antes del mérito para que una sola no se lleve la
> pantalla, y el texto de los comentarios más votados sin la identidad de
> quien comenta. Tres cosas que el sondeo del mismo día obligó a decidir:
>
> - La zona de cada post sale de lo que nombra, no de la página: en una misma
>   hora TV Azteca Baja California publicó de San Quintín, de Tijuana y de un
>   huracán.
> - Los posts que solo comparten el de otra página no se muestran. Los tres
>   que se sondearon de Blanco y Rojo eran de La Prensa Baja California; si
>   así sigue, lo honesto es leer La Prensa Baja California.
> - Blanco y Negro se lee en Facebook (1.14 millones de seguidores) y su
>   cuenta de Instagram (136,814) queda apagada, por la regla de un medio en
>   una sola red del 22 de septiembre: leer las dos repetiría cada nota.

> **Implementación · 23 de septiembre de 2026 — La lupa de Redes busca cualquier
> término: noticias, publicaciones y comentarios.** Hasta hoy la lupa solo sabía
> de los tres términos en seguimiento; cualquier otra palabra filtraba lo que ya
> estaba en pantalla. El cliente pidió que, busque lo que se busque, el sitio
> devuelva lo que hay. Ahora un término que no está en seguimiento abre la misma
> ficha —Noticias, Publicaciones y Comentarios, cuántos positivos y cuántos
> negativos— con dos mitades:
>
> - **Lo que no cuesta, al entrar**: el buscador de noticias con la frase entre
>   comillas en seis meses, el buscador propio de los seis medios verificados
>   (Blanco y Negro, Zeta, Síntesis, Jornada BC, Rosarito Noticias, Said
>   Betanzos), el archivo propio, lo que el tablero ya leyó en Instagram, TikTok
>   y YouTube que nombra el término, con el texto de sus comentarios, y las
>   tendencias de X que lo nombran, con la salvedad de siempre: es el ranking de
>   X, no una medida de la ciudad. La búsqueda de la portada también lee ahora
>   esos medios y el archivo, y al final ofrece «Ver en redes».
> - **Lo que cuesta, detrás de un botón**: «Buscar también en TikTok, Instagram
>   y Facebook». La búsqueda por palabra de TikTok, la etiqueta del término en
>   Instagram —que no se deja buscar por palabra sin sesión— y la búsqueda por
>   palabra de Facebook, con los comentarios de las diez publicaciones de más
>   alcance de cada red. Tarda minutos, y lo que llega se suma a las tarjetas.
>
> **Esto invierte dos decisiones, y se dice.** La primera es la del 18 de
> septiembre, «nunca una búsqueda en vivo pagada desde el navegador». Se paga
> solo cuando alguien pulsa, como Analizar, y con topes que el cliente fijó hoy:
> **50 dólares al mes** encima de lo que ya gasta la cosecha programada, y **diez
> búsquedas por persona al día**. Repetir un término dentro de seis horas reusa
> la primera búsqueda y no cuesta ni cuenta. El navegador nunca elige qué se
> corre: manda un término, y el servidor decide contra un libro de gasto.
> **Medido el mismo día** con «Vive la Baja», las tres redes: 65 segundos y
> 0.17 dólares. TikTok devolvió 20 videos y solo uno nombraba el término, y
> solo ese pagó comentarios. Con los precios de cada proveedor, una búsqueda
> con diez comentarios en cada una de diez publicaciones por red saldría en
> unos 0.60. Antes de empezar se reserva el peor caso, 2 dólares, porque el
> proveedor de TikTok no acepta un tope por corrida menor a 0.50.
>
> **La segunda es la búsqueda por palabra en Facebook, y es la de fondo.** El §3
> de abajo rehúsa el raspado con sesión sea de quien sea la cuenta, y la nota
> del 18 de septiembre la dejó cableada y apagada por eso: la página de búsqueda
> de Facebook exige sesión, así que el único servicio que la ofrece busca con
> cuentas propias. En *Meta v. Bright Data* la defensa descansó en no ser un
> usuario de la plataforma, y un proveedor que inicia sesión la pierde aunque la
> cuenta no sea nuestra. **El cliente decidió hoy encenderla para la búsqueda en
> vivo, sabiendo esto y sin opinión legal todavía.** Queda en ese único camino:
> la consulta programada sigue leyendo solo páginas públicas, y encenderla ahí
> sería otra decisión.
>
> **El tono es el mismo instrumento, no otro.** Lo pone el mismo modelo local
> que etiqueta la prensa y los comentarios de la cosecha, servido aparte para
> que el sitio pueda preguntarle; medido hoy, coincide con la etiqueta guardada
> del pipeline en 109 de 109 titulares. Un Claude o una copia del modelo en
> otro lenguaje habrían puesto dos medidas distintas bajo la misma palabra
> «positivo». Si el término nombra a una figura del roster, no se muestra tono:
> la excepción del 18 de septiembre dejó en pie esa prohibición, y una búsqueda
> libre la reabriría con solo escribir un nombre.
>
> **Lo que se sostiene igual.** Solo cuenta lo que nombra el término: el sondeo
> del 18 de septiembre trajo tres de tres videos ajenos para cada término del
> cliente, y sin ese filtro se pagarían los comentarios de una banda boliviana.
> Nada de esto entra a `data/` ni a git: el texto de los comentarios existe en
> tránsito y en el conjunto de datos de la corrida del proveedor, como el de la
> cosecha, y el libro de gasto guarda una huella del término, no el término. No
> se guarda quién comenta. Una búsqueda en vivo no tiene PDF ni Analizar, y lo
> que afirma es «lo que devolvió la búsqueda y nombra el término», no la
> cobertura del término.
>
> **Lo que falta.** El servicio de tono ya está publicado, aparte del sitio, y
> etiqueta igual que el pipeline (109 de 109 titulares, medido en producción).
> Falta darle al sitio su dirección y su secreto, crear la tabla del libro de
> gasto y encender la compuerta. Y un
> hallazgo de paso: Jornada BC se mudó a `jornadabc.com.mx`, así que su
> buscador redirige y ningún enlace pasa la regla de «del propio medio»; hay
> que sondear la fila nueva.

> **Implementación · 23 de septiembre de 2026 — Resumen con IA de TikTok y
> orden por popularidad.** El cliente mandó la captura del «Resumen con IA» que
> TikTok pinta arriba de su búsqueda «noticias internacionales» —asuntos,
> viñetas y la fuente de cada una— y lo pidió para las búsquedas que ya
> corremos: Mundo, México y Tijuana, con las publicaciones por popularidad y la
> opción de verlas por lo más reciente.
>
> - **Ese resumen no se puede traer, así que se escribe aquí.** El actor de
>   TikTok no lo devuelve, vive en la página de búsqueda de la app, y
>   publicarlo sería publicar lo que el modelo de otra empresa resumió de los
>   cuerpos de las notas. Es la misma razón por la que la nota del 17 de
>   septiembre, más abajo, dejó apagado el resumen de Apify. Lo escribe el
>   modelo de las otras lecturas y lee **solo la primera línea del pie y el @
>   de cada video** que la pestaña TikTok muestra: ni conteos, ni comentarios,
>   ni subtítulos. Cada punto cita los videos de donde sale y lleva a su
>   tarjeta; un punto que no se ata a un video no se pinta. Lo que un pie
>   afirma se presenta como afirmado, no como cierto.
> - **Se pide solo, sin botón, y se muestra plegado, como en TikTok**: lo
>   primero de la pestaña es el lugar, «Resumen con IA de…», la entrada entera
>   y el primer asunto desvaneciéndose, con «Ver más»; el primer video asoma
>   debajo en la misma pantalla. Las otras lecturas automáticas son botones;
>   esta no, por decisión del cliente. Sigue sin ser un paso de la ingesta
>   —nadie la pide si nadie abre la pestaña— y se guarda seis horas por lugar,
>   así que cuesta una llamada por lugar y ciclo, del orden de medio centavo
>   de dólar. Debajo de cinco videos no aparece. Fue la tercera forma del día:
>   primero una tarjeta a pantalla completa, que dejaba el primer video a un
>   gesto («la prioridad son los TikToks», pidió el cliente), luego una franja
>   de una línea con el resto flotando encima de los videos, y al final el
>   patrón de la búsqueda de TikTok que el cliente mandó, menos la sección de
>   usuarios.
> - **Sin salvedades en pantalla**, también a pedido del cliente ese día: ni
>   la que escribe el modelo sobre lo que el material no establece, ni la fija
>   de la página («no verifica lo que afirman ni es una muestra de ninguna
>   ciudad»). La del modelo se sigue pidiendo y vigilando, y no se pinta.
>   Queda «Generado con IA» y la forma de cada viñeta, que atribuye lo que
>   dice a un video.
> - **El lector abre con lo más popular** (likes; vistas en YouTube), con
>   «Más recientes» a un toque en la barra. En «Todas» las redes se intercalan
>   por puesto, porque los likes de una red y las vistas de otra no son la
>   misma unidad.
> - **La cosecha no cambia: sigue pidiendo «más relevantes».** Relevante es el
>   orden de TikTok para la consulta, no el más popular; de esos, el tablero
>   se queda con los quince con más likes por lugar. Lo que se ve es lo más
>   popular de lo relevante. Pedir «más gustados» no se hace sin un sondeo:
>   el riesgo es traer videos virales que no son noticia, falsos positivos con
>   cara de cobertura como los de Tecate.
>
> El resumen es tan bueno como los pies: en Mundo muchos son de creadores
> cualesquiera y de gancho, y queda a nivel de titular por diseño, mientras el
> de TikTok lee las notas.

> **Implementación · 23 de septiembre de 2026 — Las consultas dicen positivo o
> negativo.** Al ver la ficha de un término con sus cifras arriba (22 de
> septiembre), el cliente pidió que su dirección viera **cuántas noticias,
> publicaciones y comentarios son positivos y cuántos negativos**, sin
> tecnicismos y con **un solo vocabulario**: positivo y negativo, no «adversos,
> favorables, neutrales». Con eso cambian tres cosas de la nota del 18 de
> septiembre que está más abajo:
>
> - **Pantalla y PDF dicen positivo/negativo** en las tres series. El dato no
>   cambia: la prensa sigue guardando favorable/adversa y el validador lo sigue
>   exigiendo. Cada serie va en su propia tarjeta y no se suman.
> - **Las publicaciones llevan tono propio.** Hasta ese día solo lo llevaban los
>   comentarios. Ahora el mismo modelo local lee la primera línea de cada
>   publicación, y `tono_publicaciones` lo cuenta sobre todas las de la ventana.
> - **La salvedad del tono sale de la pantalla.** Sigue en el dato, igual
>   palabra por palabra, y en el PDF. De la ficha salen también las líneas que
>   explicaban de dónde salen los datos.
>
> Lo neutro se sigue diciendo, en gris y al pie de cada tarjeta, para que las
> cuentas cuadren con el total. Una serie que no se leyó sigue diciendo «sin
> dato», nunca cero.
>
> Ese mismo día, también a pedido del cliente, salieron de la ficha «En
> resumen» y la sección y tarjeta «Agregadas a mano». Las noticias señaladas a
> mano van ahora en la lista de noticias y en su tarjeta, sin marca de cómo
> llegaron. Una con fecha anterior a los seis meses va con las anteriores; una
> sin fecha va con las actuales. En el dato y en el PDF siguen aparte.
>
> Después, también el 23, la tarjeta de noticias pasó a un **total**, sin
> separar los seis meses de lo anterior, y las tarjetas dejaron de nombrar su
> ventana. Un enlace señalado a mano que es un post de Facebook, Instagram o
> TikTok cuenta como **publicación**, con su tono, y sale en el recorrido de
> publicaciones: así el post de Tijuana Línea Roja (11 de marzo de 2026) cuenta
> para Valente Márquez y, a pedido del cliente, también para Grupo Concordia,
> porque lo nombra.

> **Implementación · 22 de septiembre de 2026 — Fuentes fijas de México y
> Mundo.** La pastilla México de Redes seguía mostrando Mexicali, Tijuana y
> Corea del Norte. En Instagram los quince eran de La Crónica y El Mexicano,
> que el 15 de septiembre se fijaron como «México» por decisión del cliente. Esa
> decisión cambia en su efecto: sus publicaciones se colocan ahora por lo que
> dicen. Lo que nombra el corredor va a su ciudad, lo del mundo a Mundo, y lo
> demás sigue en México.
>
> Se agregan fuentes fijas:
> - para Mundo: CNN en Español, BBC News Mundo, DW Español y Noticias
>   Telemundo;
> - para México: Latinus, Azteca Noticias, El Heraldo de México y N+.
>
> Cada medio se lee en una sola red, Instagram o TikTok, la de más seguidores,
> para que la misma nota no salga dos veces. La otra queda anotada y apagada.
> Se sondearon ese mismo día:
> - **Instagram**: CNN en Español (8.9M) y BBC News Mundo (4.0M).
> - **TikTok**: DW Español (3.2M contra 2.1M en Instagram), Noticias Telemundo
>   (17.8M), Latinus (23.9M), Azteca Noticias (18.8M), El Heraldo de México
>   (10.6M contra 2.3M) y N+ (6.8M).
>
> Las cifras nacionales que dio el cliente eran las de TikTok. Instagram no dio
> datos sin sesión para Latinus, Azteca y N+, así que esa comparación queda por
> volver a sondear. En TikTok, «@bbcmundo» resultó ser otra cuenta, de 17
> seguidores; la BBC gana en Instagram de todos modos. YouTube queda fuera de
> esta regla.
>
> Lo que un medio o una búsqueda local publica sin nombrar lugar deja de caer
> en México. De una búsqueda de TikTok se descarta. De un medio del corredor
> queda en Corredor como «un lugar sin precisar», nunca en la página de una
> ciudad. Si nombra a México, sigue en México.
>
> Los temas en Redes, a la manera de la portada, quedan en espera. La portada
> no clasifica: pregunta a Google por tema, y en redes no hay un buscador
> equivalente. No cambia la prensa, sus cifras ni la retención.

> **Implementación · 22 de septiembre de 2026 — Mundo en Redes.** La pastilla
> «Mundo» de Redes vivía de una sola búsqueda de TikTok, y los quince videos
> que traía estaban ahí porque no nombraban lugar alguno, no porque fueran del
> extranjero. Al revés, lo que sí era del extranjero se perdía: el gacetero no
> conocía ningún lugar de fuera de México, así que «Más de 280 mil niños en
> Gaza regresaron a clases», de N+, salía en la pastilla México como si fuera
> nota nacional.
>
> Ahora las publicaciones de redes reconocen el extranjero. Lo que nombra
> Gaza, Ucrania o Madrid va a Mundo **venga de donde venga**, también de un
> medio de Tijuana: antes caía en México, que es peor que Mundo y que perderlo.
> La tarjeta dice «sobre el mundo» solo para eso. Lo que llega de una fuente
> del mundo sin nombrar lugar sigue en Mundo, pero con «un lugar sin precisar».
> Lo que habla de México —el país, sus instituciones— va a México aunque lo
> publique la BBC. Estados Unidos a secas no cuenta como extranjero, porque la
> frontera lo nombra todo el día. Un lugar del corredor nombrado de verdad
> gana siempre, y lo débil cede: un homónimo («la paz», «El Rosario,
> Sinaloa»), el `#tijuana` suelto al final de un video de Irán, o la firma
> «| TELEMUNDO SAN DIEGO» en un helicóptero caído en Los Ángeles.
>
> Se sumaron seis canales de YouTube del mundo, sondeados antes de encenderse:
> BBC News Mundo, CNN en Español, DW Español, FRANCE 24 Español, euronews y EL
> PAÍS. NTN24 se sondeó y quedó apagado: sus titulares llevan el adjetivo de la
> redacción, y encenderlo es decisión del cliente. Las cuentas de Instagram de
> esos medios y una búsqueda de TikTok en inglés quedan dadas de alta
> **apagadas**, porque sondearlas cuesta y falta la autorización.
>
> No cambia la prensa, sus cifras ni la retención: la zona de las notas sigue
> saliendo como salía.

> **Implementación · 22 de septiembre de 2026 — Segundo lector para Publicidad
> Meta: la API oficial.** El adaptador de navegador quedó bloqueado: el sondeo
> del 21 y del 22 devolvió «bloqueado (robots)» para las dos páginas
> verificadas, así que nueve de las diez figuras siguen sin datos. Se agrega
> `pulso/publicidad_meta_api.py`, que lee la API oficial de la Biblioteca de
> Anuncios (`--api`) y busca candidatos de página para quien no tiene
> (`--descubrir`, que no escribe nada). No es raspado y no toca
> `respetar_robots`. Falta un paso que no es de código: verificar identidad en
> Meta —identificación oficial y domicilio, de una persona con nombre— y poner
> el token en `.env`. Hasta entonces el comando sale con error y no escribe, y
> el catálogo sigue publicando sus ausencias como ausencias.

> **Implementación · 22 de septiembre de 2026 — Publicidad Meta se sirve como
> `pauta-meta`.** Los archivos publicados pasaron de `publicidad-meta.json` y
> `publicidad-meta/<id>.json` a `pauta-meta.json` y `pauta-meta/<id>.json`, y el
> panel y su carpeta en `web/` se renombraron igual. En pantalla el producto
> sigue diciendo «Publicidad Meta». El motivo: las listas de filtrado en español
> que traen los bloqueadores de anuncios bloquean cualquier URL con la palabra
> «publicidad», en el navegador y antes de que la petición salga, así que el
> panel decía «No se pudo cargar Publicidad Meta» mientras el servidor respondía
> 200 — y le habría pasado a cualquier visitante con esas listas, no solo en
> desarrollo. La configuración, el cache y el verbo de línea de comandos
> conservan el nombre anterior: no se sirven por HTTP.

> **Implementación · 21 de septiembre de 2026 — Publicidad Meta.** Se agrega la tercera vista de Gasto electoral con directorio, anuncios, información, audiencia, comparación y reporte, filtros en URL y vínculos INE verificados. El piloto manual publica 26 tarjetas de Julieta y secciones parciales; las ausencias siguen visibles. El sondeo automático se detuvo por robots.txt, por lo que la paginación automatizada no está validada en vivo. No se añadió cron, gasto, credenciales ni despliegue. [Operación y cobertura](publicidad-meta.md).

> **Implementación · 21 de septiembre de 2026 — Curar a mano lo que la búsqueda no acierta.** El cliente revisó la primera versión de los informes y pidió dos cosas opuestas y del mismo tipo. Quitar tres titulares que no tratan del término: una nota de videojuegos de IGN España y un reality de Univision que salieron en «Vive la Baja» —la frase cabe en cualquier oración— y la cartelera del Gran Poder de un medio boliviano que salió en «Grupo Concordia», donde ese nombre es el de una banda. Y agregar tres publicaciones que sí tratan del término y que ninguna búsqueda devuelve: dos notas —Zeta sobre la inversión en terrenos y Said Betanzos sobre el despojo con helicóptero— cuyo **titular no nombra el término**, porque lo nombra el cuerpo y aquí no se lee ningún cuerpo, y un post de la página Tijuana Línea Roja en Facebook, que no es una fuente configurada.
>
> **Se hace en el archivo de configuración y se justifica por escrito**, como cualquier fila apagada de este proyecto: cada descarte lleva su razón y cada enlace agregado lleva su nota. Lo descartado se empareja por titular y no por enlace, porque el enlace del buscador de noticias cambia entre consultas y la regla dejaría de aplicarse sola.
>
> **Y se dice en pantalla lo que es.** El informe publica cuántos titulares se descartaron a mano, porque una lista curada que no lo dijera afirmaría que la búsqueda devolvió justo eso. Lo agregado va en su propia sección, «Agregadas a mano», con la frase de que nadie las encontró buscando y que no entran en los conteos de arriba; el resumen las cuenta aparte. Un post de Facebook no publica una fecha que se pueda leer sin iniciar sesión, así que sale «sin fecha» en vez de una inventada. Se dio de alta además el buscador propio de Said Betanzos, que ya aporta cobertura anterior sobre Grupo Concordia.

> **Implementación · 18 de septiembre de 2026 — La prensa de una consulta: seis meses, el tono de cada titular y el buscador de cada medio.** Completa la nota de abajo con lo que el cliente pidió al ver la primera versión: que la prensa sobre **Grupo Concordia** y **Valente Márquez** mirara **seis meses** y no treinta días, que cada nota dijera si su titular suena **favorable, adverso o neutral**, que la pantalla dijera solo «sin dato» donde no hay dato —sin explicar por qué—, y que el informe recogiera lo que él ya había visto: que la prensa sobre Grupo Concordia es adversa, en Blanco y Negro Noticias entre otros, y que de Valente Márquez casi no hay nada reciente.
>
> **Lo que se hizo, y cómo se afirma.** La prensa tiene ahora su propia ventana, de seis meses (los titulares no son texto de conversación y no los ata la retención de 30 días de los comentarios; las redes siguen en 30 días). Cada titular lleva el tono del mismo modelo local que lee el muro, en el vocabulario de la prensa —favorable, adversa, neutral— y nunca en el de los comentarios, porque las dos series no se suman y por eso tampoco comparten etiquetas (§6). Se suma un segundo camino: además del buscador de noticias, se consulta el **buscador propio de cada medio** configurado (Blanco y Negro Noticias, Zeta, Síntesis TV, La Jornada BC, Rosarito Noticias), sin sesión y respetando su robots.txt, porque el buscador de noticias **no indexa** a Blanco y Negro y ahí estaba la cobertura que el cliente había visto. Solo entran los titulares que nombran el término. Los que lo nombran pero son anteriores a los seis meses se publican **aparte, con fecha**, en vez de esconderse en un conteo: los dos titulares más duros sobre Grupo Concordia son del 11 de marzo de 2026, una semana fuera de la ventana, y el único que nombra a Valente Márquez es de marzo de 2024.
>
> **Lo que el informe dice y lo que no.** Abre con un resumen en frases hechas de conteos y fechas: «3 titulares nombran «Grupo Concordia» en los últimos 6 meses: 0 adversos…», «y hay 3 anteriores a ese periodo, 2 adversos», «ningún titular de los últimos 6 meses nombra «Valente Márquez»; sí hay 1 anterior, de marzo de 2024». Así es como se afirma que la prensa es adversa o que no hay nada reciente: con el número y el medio, nunca con «la mayoría» ni con un porcentaje, que la regla 1 y la regla 2 de PRODUCT.md prohíben y que el código rechaza. La prensa se lee de todas las filas, encendidas o no —no cuesta—, y la corrida de la demo fue exactamente esa: solo prensa, ningún gasto en redes, que salen «sin dato».

> **Implementación · 18 de septiembre de 2026 — Consultas: qué se dice de un término, el tono también para una persona, y su informe en PDF.** El cliente pidió saber qué dicen las redes y la prensa de tres términos —**«Valente Márquez»**, **«Vive la Baja»** y **«Grupo Concordia»**, dos empresas y una persona— y poder entregárselo a su dirección en PDF. Ninguno de los tres aparece en las ~6,000 notas del archivo de prensa y Redes lee las últimas 24 horas de cuentas de medios, así que el material viene de fuentes vivas en una ventana de **30 días**: la búsqueda de TikTok, las cuentas y etiquetas de Instagram, las páginas públicas de Facebook y el buscador de noticias, todo **sin iniciar sesión**. Se configura en `config/consultas.json`, corre a mano (`python -m pulso consultas`) y **queda fuera del cron** hasta que la demo se juzgue; una fila solo se cosecha después de sondearla con `--probar` y anotar lo que devolvió.
>
> **Lo que cambia respecto a la regla 5, dicho sin adornos.** PRODUCT.md dice que el tono no es postura y que el tablero nunca lo cruza con una figura. El cliente decidió publicar el **conteo de tono** de los comentarios sobre los tres términos, **incluida la persona**. Se hace como conteos —positivos, negativos, neutrales, sin clasificar, sin modelo por idioma—, nunca como porcentaje ni como una cifra de «consenso», y siempre junto a esta salvedad, que el código exige palabra por palabra: *«Conteo del tono de cada comentario según un modelo que lee frases, no posturas: dice si el texto suena a queja, a celebración o a información, no lo que quien escribe piensa de la persona o de la marca. Son comentarios de quien decidió comentar, no una muestra de nadie.»* El cruce con las figuras del roster sigue prohibido; la lectura automática sigue sin atribuir postura a nadie.
>
> **Lo que no se hace, y por qué.** YouTube no se busca por término (no hay búsqueda sin la API de datos, que sigue apagada) y de X solo se leen tendencias: los dos salen como «sin dato» con su razón, nunca en cero. La **búsqueda por palabra en Facebook** queda cableada pero apagada: el único servicio que la ofrece necesita iniciar sesión en Facebook con cuentas del proveedor, y §3 refusa el raspado con sesión sea de quien sea la cuenta; se leen las páginas públicas de las marcas y encender la búsqueda es una decisión legal del cliente. El texto de los comentarios se publica en la página y en el PDF pero **no entra a git**, igual que el de Instagram y TikTok, y la identidad de quien comenta no se guarda en ningún lado. En Redes, la lupa abre la búsqueda: un término en seguimiento muestra su cosecha y ofrece **Descargar PDF**; cualquier otro texto filtra las publicaciones que ya están en pantalla. El PDF se arma en el servidor a partir de lo publicado, con una sola llamada al modelo para la lectura de qué se repite, y termina con la página «Lo que este informe no dice».

> **Implementación · 18 de septiembre de 2026 — Fuera el «Acerca de» y fuera el pie.** Dos peticiones del mismo día y del mismo criterio: la pantalla no está para explicarse.
>
> **Primero el botón de información.** El de la portada y el de Redes desaparecen, y con ellos la prosa que describía cómo está hecho esto: por dónde empieza el recorrido, qué trae cada pestaña de redes, en qué ventana se mide.
>
> **Y después el pie, de todo el tablero.** El bloque del final que decía lo que este producto no afirma se quitó de todas las páginas, igual que el de Gasto electoral. No queda pie en ninguna pantalla. La primera versión de este cambio lo había mudado al menú; el cliente aclaró que no quería moverlo sino quitarlo, y así quedó.
>
> **Y el último «Cómo leer este dato».** El desplegable del panel de indicadores, que explicaba la cadencia de cada fuente oficial y qué no mide cada una, era el que quedaba de los siete y se fue con lo demás. Lo que decía está en PRODUCT.md, en la tabla de indicadores, ampliada para que no falte nada de lo que ahí se explicaba.
>
> **Qué se conserva, que es lo que importa.** Las salvedades que van pegadas al dato siguen enteras, porque ahí es donde se leen: un hueco sigue diciendo «sin dato» o «fuera de muestra» y nunca cero; con pocos elementos se siguen mostrando conteos y no porcentajes; la prensa y los comentarios siguen sin sumarse en una sola cifra; el tono sigue sin atribuirse a ninguna persona; las filas en vivo siguen avisando que no cuentan en las cifras de prensa; «es el ranking de X, no una medida de la ciudad» sigue bajo el panel de X; y cada lectura automática sigue llevando su salvedad, que el propio código rechaza quitar.
>
> **Lo que sí se pierde, dicho sin adornos.** Ya no hay ningún sitio en la pantalla donde las cinco reglas se lean juntas, ni donde se diga qué mide cada indicador oficial. Quedan escritas en PRODUCT.md y siguen siendo comprobaciones ejecutables del código, no buenas intenciones; pero quien no abra ese documento ya no las ve enunciadas. El caso concreto: dos municipios con su predial lado a lado ya no traen en pantalla la advertencia de que eso es recaudación y no valor, y compararlos para rankear sigue siendo tan incorrecto como antes.

> **Implementación · 18 de septiembre de 2026 — Elegir tema en la portada.** Los cinco temas de «En Tendencia» —Clima, Seguridad, Deportes, Política, Economía— existen desde el 11 de septiembre, cuando se pidieron con una captura de la caja «Trending topics» en la mano. Desde que la portada es el recorrido, el 15 de septiembre, quedaron encerrados en mitad del recorrido: había que pasar los quince titulares del lugar antes de llegar al primero, y no había manera de pedir uno. Ahora hay una fila bajo la barra —Todo · Clima · Seguridad · Deportes · Política · Economía— y elegir uno **empieza ahí**.
>
> **Acota por dónde se empieza, no lo que hay.** Pasado el tema el recorrido sigue con lo que destaca en el lugar y con los otros cuatro temas, en el mismo orden de siempre. No se pierde ninguna lista ni se pide ninguna de más: son las mismas que ya se traían, en otro orden.
>
> **El lugar y el tema no se estorban.** Cambiar de ciudad con Seguridad puesta deja Seguridad puesta, y al revés. Los dos quedan en el enlace, así que se comparte, sobrevive a una recarga y el botón de atrás funciona: `/tijuana?t=seguridad` es «seguridad en Tijuana» y se puede mandar por mensaje tal cual. Al buscar manda la búsqueda, y la fila de temas desaparece mientras tanto.
>
> **Un tema sigue siendo una búsqueda, no una clasificación.** Cada uno es su lista de términos en español e inglés sobre los últimos dos días, no una etiqueta que alguien le puso a la nota: lo único que se afirma es «esto devolvió la búsqueda para estos términos». Nada de esto se guarda ni entra en las cifras de prensa.

> **Implementación · 18 de septiembre de 2026 — La portada deja de descargar el archivo.** Supera, en el mecanismo y no en lo que se ve, a la nota del 17 de septiembre que está justo debajo: donde dice que «Relacionadas» sale «del archivo que el navegador **ya descargó** para las miniaturas» y que «no cuesta una petición», hoy no hay tal descarga y sí hay una petición. Lo demás de esa nota sigue igual —el 87%, el emparejado por palabras poco comunes, lo que no muestra— y nada cambia en pantalla.
>
> Lo que había: para resolver la miniatura, el enlace del propio medio y las notas relacionadas de las quince filas visibles, la portada se bajaba el archivo entero de titulares: 4.8 MB, 917 KB comprimidos, 6,020 notas. Era aproximadamente el 95% de todo lo que el tablero descarga, y se pagaba en cada visita aunque nadie abriera una sola hoja de relacionadas.
>
> Lo que hay: los tres cruces se resuelven en el servidor, que ya tenía esos titulares al lado. La miniatura y el enlace llegan con cada fila; las notas relacionadas se piden al abrir la hoja. Medido en la portada: **ninguna descarga del archivo**, unos 6 KB por sección y unos 2.6 KB por cada hoja que de verdad se abre. Las tres funciones que hacen el emparejado no cambiaron; cambió quién las llama.
>
> Una consecuencia que se decidió a propósito: cuando el archivo no se puede consultar, la hoja lo dice con una frase propia en vez de decir «no encontramos notas anteriores». La segunda afirmaría un hueco de cobertura que nadie midió, y eso es la regla 4 al revés.

> **Implementación · 17 de septiembre de 2026 — Notas relacionadas, y una carpeta menos.** Dos cambios sin relación entre sí, salvo que los dos salen del mismo archivo de titulares.
>
> **La tarjeta gana «Relacionadas».** Un titular en vivo es titular, fuente y enlace: no hay desde dónde seguir un tema. El botón abre lo que los medios del corredor ya publicaron sobre lo mismo en las semanas anteriores, tomado del archivo que el navegador **ya descargó** para las miniaturas. No cuesta una petición ni un centavo, no depende de ningún buscador y da resultado en el 87% de los titulares. Empareja por palabras poco comunes: «Tijuana» o «gobierno» no deciden nada, un apellido sí. Compara palabras y no sentido, así que acierta cuando dos notas cuentan el mismo hecho y a veces junta dos que solo comparten vocabulario; por eso se llama «notas relacionadas» y no «la cobertura de este tema». Sin coincidencias lo dice con una frase, no rellena. No muestra el tono de esas notas ni las suma con las cifras de prensa.
>
> **Y desaparece la carpeta `efimero/`.** El texto de los comentarios de Instagram y TikTok vivía en una carpeta aparte para no entrar a git. Sigue sin entrar a git —esa es la obligación, y no se toca—, pero ahora sale con el resto de la corrida, y lo que lo separa del historial es una línea de configuración que el propio validador **comprueba** antes de cada publicación, en vez de una carpeta que había que copiar en cuatro sitios distintos. Para quien lee la página no cambia nada. Lo que cambia es que la regla dejó de ser una costumbre y pasó a ser una comprobación: si alguien la borrara, la publicación falla antes de que el texto pudiera quedar guardado para siempre.

> **Implementación · 17 de septiembre de 2026 — Redes: que no gane siempre la cuenta más grande.** A petición del cliente, el corte de publicaciones destacadas de Instagram deja de ser puro conteo de me gusta. Entre el 15 y el 17 de septiembre **una sola cuenta encabezó todas las corridas de Tijuana, con entre siete y diez de los quince lugares**, y la ciudad bajó a entre dos y cuatro cuentas de las doce activas — aunque las doce se cosechan enteras en cada corrida. Ahora **cada cuenta entra con su mejor publicación antes de que ninguna repita**, y lo que sobre del límite de quince se sigue repartiendo por alcance. La publicación más vista de la región, con 9,099 me gusta, sigue abriendo la lista: no se pierde lo que destaca, se deja de perder todo lo demás.
>
> **No es un tope por cuenta, y la diferencia es el punto.** Pasada esa primera vuelta todas vuelven a competir por alcance, así que donde publica un solo medio —El Vigía se lleva los catorce de Ensenada— la lista queda exactamente igual que antes. Recortarla habría inventado un hueco donde lo que hay es un solo medio, que es el mismo error que rellenar uno vacío. Y el reparto es **por medio, no por ciudad**: por ciudad habría puesto publicaciones de una y dos reacciones por delante de una de mil ochocientas, afirmando una paridad que los datos no tienen.
>
> **La portada de región se arregla igual, y esa sí de inmediato.** Ahí las quince filas eran doce de Tijuana, dos de San Diego y una de Mexicali, repartidas entre ocho cuentas: Ensenada, Tecate y el estatal salían en cero en su propia portada habiendo publicado. Con el mismo reparto quedan quince cuentas distintas y las seis zonas.
>
> **Lo que esto no promete.** Solo aparece la cuenta que **publicó algo en las últimas 24 horas**; a la que no publicó no se le inventa una fila. Y algunas de las publicaciones que ahora entran no traen texto de comentarios, lo que la ficha ya rotula. No cambia la ingesta, el gasto, el límite de quince por zona ni la retención: se cosecha exactamente lo mismo que antes y solo cambia cuál de lo cosechado se muestra. TikTok se queda como estaba, por decisión del cliente.

> **Implementación · 17 de septiembre de 2026 — Analizar abre también una nota recién llegada.** La falla de la captura ocurría antes de pedir la lectura: una fila en vivo trae una dirección opaca y el botón solo sabía recuperar la dirección editorial si el mismo titular ya estaba en el archivo. Cuando no estaba —o cuando dos medios compartían el titular— se rendía con «no se puede abrir desde aquí». El camino rápido se conserva, pero ahora el cruce exige **titular plegado y dominio del medio**; así una copia sindicada no puede atribuirse al medio equivocado. Si no hay cruce, la dirección opaca llega a la ruta y se resuelve solo después de que la persona confirma Analizar.
>
> La resolución es deliberadamente estrecha y puede fallar: acepta únicamente direcciones HTTPS exactas de Google Noticias, hace un solo intento acotado para obtener sus parámetros y otro para resolverlos, y abre el destino únicamente si su dominio normalizado coincide con el medio anunciado en la fila. Un límite de tráfico, una respuesta malformada, una dirección insegura o un dominio distinto terminan antes de la llamada pagada y se muestran como «Esta nota de {medio} no se puede abrir desde aquí». El registro interno conserva solo etapa, estado y dominio, nunca el titular, el cuerpo, la llave ni la dirección completa. Es un flujo no documentado del buscador y por eso sigue siendo una mejora de mejor esfuerzo, no una garantía.
>
> No cambia la ingesta: `data/` conserva el token opaco y no se añade persistencia ni esquema. Tampoco cambia la frontera de privacidad: el cuerpo vive en memoria durante esa petición, nunca vuelve en la respuesta y nunca se guarda. La versión pública de la petición sube para separar las respuestas anteriores del caché y el tiempo máximo de la ruta se amplía para alojar las dos vueltas opcionales, la descarga editorial y el modelo.

> **Implementación · 17 de septiembre de 2026 — Las tarjetas de En Tendencia dejan de salir en blanco.** Se preguntó si Apify podía traer las imágenes que faltan en el recorrido de la portada. No hacía falta y no servía: su catálogo no tiene ningún actor que lea una página cualquiera, y añadir uno sería pagar por resultado —sobre el tráfico de lectores, no sobre las cuatro corridas del día— para hacer una petición pública que el propio sitio ya sabe hacer.
>
> **El diagnóstico, medido y no supuesto.** Una fila en vivo nunca trae imagen, y la única forma de recuperarla era encontrar esa misma nota en el archivo. De 503 notas llegadas por búsqueda, **ninguna** la recupera: el 95% son de medios que no están en el catálogo, 226 distintos. Y la caja de la foto se reservaba igual, así que la tarjeta apartaba un hueco transparente de hasta 14 rem. Eso era lo que se veía en blanco.
>
> **Dos arreglos, y el primero no depende de nada.** La tarjeta sin foto ahora lleva una **placa** con el nombre del medio, teñida con el color del capítulo: no afirma nada, no pide nada y no puede fallar. Encima de ella, cuando alguien se detiene en una tarjeta, se pide la imagen que **el propio medio declara** en la página de su nota —la misma que usa cualquier buscador para pintarla—. Se pide de a una, nunca de las 135 del recorrido, y si el medio no contesta la placa se queda. No cuesta dinero: no hay modelo ni proveedor.
>
> **Lo que no cambia.** No se guarda nada de esa página: lo que vuelve es la dirección de la imagen y nada más, y que la respuesta no traiga texto de la nota es una prueba automática, no una intención. La regla de la ingesta sigue igual —ahí el enlace del buscador no se resuelve, porque cambia entre corridas y ensuciaría el archivo—. Y la regla de qué imagen se **guarda** tampoco se afloja: sigue siendo solo la del propio medio.
>
> **De paso, dos huecos que eran nuestros y no de los medios.** Las tres portadas que se leen sin RSS —AFN, El Vigía y Baja News— no daban ninguna miniatura, y resultó que sí las publican: no había quien las leyera. Y Jornada BC sí traía foto, pero servida desde otro dominio suyo, así que se estaba descartando por «no es del medio». Noticias Ensenada se queda sin miniatura a propósito: sus fotos son de banco y de otro medio, y acreditárselas sería falso.

> **Implementación · 17 de septiembre de 2026 — TikTok: los subtítulos que ya existen, y cuánto dura cada video.** Se preguntó si el actor de TikTok permite usar «la IA de TikTok» para resumir un video. **TikTok no ofrece tal cosa**; lo que ofrece el actor que ya se usa es la IA *de Apify* —`aiVideoSummary` y `aiVideoDescription`— y, aparte, los **subtítulos que TikTok ya generó** para los videos que los traen. Se enciende lo segundo y se dejan apagadas las tres opciones de pago, con los precios anotados en el código para que la decisión no haya que rehacerla.
>
> **Por qué:** las opciones de IA se cobran **por segundo de video** (0.0008 USD en el plan Scale) y la transcripción **por minuto empezado y por video** (0.034 USD). Con ~232 videos por corrida y cuatro corridas al día, resumir todo cuesta entre 668 y 2,005 USD al mes según duren 30 o 90 segundos, y transcribir todo ~950 USD: entre tres y diez veces el plan de 199 USD, antes de los videos y comentarios que ya se pagan. Los subtítulos de TikTok, en cambio, **no cobran ningún evento**: no existe uno para esa opción en la tabla de precios y el rótulo ($) de la ficha está sobre las dos de transcripción y no sobre ésta.
>
> **Lo que cambia en los datos, y lo que no.** Cada video destacado gana `duracion`, en segundos, opcional —un corte anterior no la trae y sigue siendo válido, con aviso—. No es un dato de pantalla: la tarjeta no pinta cifras desde hoy. Existe porque **sin ella no se puede presupuestar nada de lo que se cobra por segundo**, que es exactamente lo que hubo que estimar a ciegas al responder la pregunta; viene gratis en cada resultado y en un día de corridas dice el número real. De los subtítulos **no se guarda una sola palabra**: sale un conteo por búsqueda, `salud[].con_subtitulos`, que dice para cuántos videos existen y por tanto si vale la pena leerlos. El texto de unos subtítulos es el cuerpo del video y la agregación se queda en titular, fuente y enlace.
>
> **Lo que queda decidido para después**, cuando se sepa la cobertura: leer ese texto para que la ficha de «Analizar» pueda decir qué ocurre en el video en vez de solo qué dice el pie. Eso cruzaría la misma línea que el cliente ya movió el 15 de septiembre para las notas —cuerpo en memoria durante una petición, nunca guardado, la respuesta lleva la lectura y nunca el texto— con una diferencia real que hay que decir: la salida de una corrida de Apify vive en un conjunto de datos **suyo**, no en memoria nuestra. Publicar el resumen de Apify en vez de leerlo con el nuestro es otra cosa distinta y no se hace: lo escribe un tercero, no pasa por `web/src/lib/analisis/reglas.ts` y no está atado a las cinco reglas. No cambia las cifras, la retención ni el gasto actual.

> **Implementación · 17 de septiembre de 2026 — «De qué se habla»: los comentarios de toda la selección.** A petición del cliente, la barra de Redes gana un botón que abre una hoja sobre el conjunto de publicaciones que se están leyendo, no sobre una. Trae **dos mediciones, una al lado de la otra y sin fundirse**: arriba, los conteos que la ingesta ya calculaba en cada corrida y no tenían pantalla —cuántos comentarios suenan a queja, a celebración o a información, y cuántos quedan sin clasificar por estar en un idioma que el analizador no lee—; debajo, detrás de su propio botón, una lectura automática de qué asuntos se repiten. Los conteos se ven aunque la lectura automática esté apagada, porque no cuestan nada y llevaban meses calculándose a ciegas.
>
> **Cuesta lo que cuesta, y queda medido:** una lectura de una corrida completa son unos cuatro centavos de dólar; la respuesta se guarda seis horas —el ciclo de la ingesta— por lugar y ámbito, así que la primera persona que pulse en ese ciclo la paga y las demás leen la misma copia. Por eso es un botón y no una cifra de la corrida: **nadie llama a nadie si nadie pulsa**, el encargo sigue sin necesitar una API para funcionar, y meterlo en la corrida costaría lo mismo sin esa garantía. Tampoco se abre TikTok ni Instagram: se lee lo que ya está en pantalla.
>
> **Lo que la hoja dice y lo que no.** Dice cuántos comentarios se leyeron, de cuántas publicaciones de las que hay en la selección —casi nunca son todas, y decirlo es rotular el hueco en vez de disimularlo— y cuántos reportan las plataformas. Esas cifras van al lado, **nunca divididas**: su cociente sería una proporción sobre muy pocos comentarios y mezclaría dos mediciones distintas. La advertencia de que esto no es una muestra de ninguna ciudad **la escribe la página, no el modelo**: al pedírsela a él, la frase correcta tenía que nombrar justo lo que la comprobación prohíbe —«la opinión pública», «la mayoría», «la gente»— y la lectura entera se rechazaba; cuatro de cada seis advertencias correctas morían así y el lector solo veía que no se pudo. La comprobación vigila afirmaciones, no advertencias. El modelo ahora dice únicamente qué queda sin aclarar en lo que leyó. No cambia la ingesta, las cifras ni la retención.

> **Implementación · 17 de septiembre de 2026 — Redes: fuera las cifras, dentro Analizar.** A petición del cliente, la tarjeta de una publicación deja de mostrar likes, comentarios, reproducciones, compartidos y guardados: la publicación incrustada ya las trae al lado y las trae mejor, porque las lee en vivo mientras el corte tiene hasta seis horas —en la captura del cliente el video decía 3,944 likes y la tarjeta 3,635, dos números para lo mismo en la misma pantalla—. Se van también el contador del botón de comentarios y los likes de cada comentario; el orden de los comentarios los sigue usando y el texto no cambia. **Sustituye** lo dicho el 14 de septiembre en «Visual en el teléfono» sobre las cifras al costado y su «sin dato»: sin fila no hay cifra que matizar, y el pie del sitio sigue diciendo las cinco reglas enteras en cada página. La ingesta no cambia: `likes`, `compartidos` y `guardados` se siguen midiendo y archivando cada seis horas, solo dejan de tener pantalla.
>
> En su lugar la tarjeta gana el botón **Analizar** que los titulares tienen desde el 15 de septiembre, con una ficha propia: qué dice la publicación, **qué se repite en los comentarios**, una sola idea de contenido para redes con formato, enfoque y gancho, y lo que no establece. La sección de comentarios se rotula «En los comentarios» y no «lo que dice la mayoría»: veinte comentarios de cinco mil no son una mayoría de nadie, y la regla 1 la dice el pie de cada página. Cuando no hay texto de comentarios —hoy, casi siempre, y siempre en un despliegue construido desde el repositorio— la ficha se hace igual con el pie y esa sección dice que faltan.
>
> **No se abre TikTok ni Instagram.** Lo que el modelo lee es lo que el sitio ya tiene en pantalla: el pie que el medio escribió y el texto de los comentarios más votados. El enlace que manda el navegador es una llave de búsqueda contra lo publicado, nunca una dirección que el servidor visite, así que §3 sigue intacto y esta ficha cruza menos que la de una nota, que sí abre la nota. Se mantiene todo lo demás de la decisión del 15 de septiembre: la llamada ocurre solo después de confirmar, va apagada por omisión, nada se guarda y la respuesta lleva la lectura, nunca lo leído. Dos reglas del producto quedan además **impuestas por el código y no por la instrucción al modelo**: la ficha no puede publicar porcentajes ni proporciones —son menos de treinta comentarios— ni atribuir lo leído a «la mayoría», «la gente» o «la opinión pública»; una respuesta que lo intente se descarta entera. Un comentario que le pida al modelo cambiar sus reglas es texto de un comentario, no una instrucción. En pantalla toda esa metodología se reduce a «Generado con IA». No cambia la ingesta, las cifras ni la retención.

> **Implementación · 17 de septiembre de 2026 — El recorrido marca las tendencias con un ícono.** A petición del cliente, las tarjetas sustituyen el texto visible «en vivo» por la flecha ascendente de tendencia. El nombre accesible y el texto al pasar el cursor dicen «Noticia en tendencia» y conservan la salvedad de que no cuenta en las cifras de prensa.

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

> ### Nota de implementación — YouTube: Shorts y videos, por feed público
>
> **El cliente pidió el 18 de septiembre de 2026 ver los Shorts de noticias
> por ciudad**, «los que están subiendo y los más vistos», y añadir seis
> canales: `@canal33noticias`, `@imagennoticias`, `@Milenio`, `@UnoTv`,
> `@NMas` y `@siempreenlanoticia` (este último ya estaba en el catálogo). §3
> sólo contemplaba YouTube como fuente de **comentarios**, por la API de
> datos; esto es otra cosa y por eso es un módulo aparte.
>
> **Sale gratis, y esa es la noticia.** Los Shorts y los videos se leen de dos
> listas automáticas que YouTube genera por canal y sirve por Atom (`UUSH` y
> `UULF`), sin llave, sin cuota y sin OAuth. Son documentos de sindicación
> públicos, del mismo tipo que los quince feeds de prensa que el pipeline ya
> lee. No se toca la API de datos, así que la regla de §3 de no llamar nunca a
> `search.list` sigue intacta —y con ella su presupuesto—, y las Políticas
> para Desarrolladores que tienen apagado el panel de conversación
> (III.E.2.a, III.E.4.d) no atan esto: hablan de datos de la API. Son dos
> módulos de YouTube con fundamentos distintos y sus datos no se suman.
>
> **«Trending» significa aquí «lo más visto de las últimas 24 horas», y no
> puede significar otra cosa.** YouTube retiró su página de Trending y desde
> el 21 de julio de 2025 el chart `mostPopular` de la API sólo devuelve
> Música, Películas y Gaming. **No existe trending por ciudad a ningún
> precio**: toda superficie de tendencia, incluidas las de pago, es por código
> ISO de país. Lo que hay es el conteo de vistas que YouTube publica por
> pieza, y la ciudad sale de lo que la pieza nombra.
>
> **Entraron los videos largos además de los Shorts, y el corte se hace por
> separado.** El cliente observó que los Shorts regionales son pocos y que los
> abundantes son nacionales, y los números le dan la razón: los dos formatos
> juntos duplican el volumen y llenan justo las zonas delgadas —Tecate de 10 a
> 16 piezas en siete días, Rosarito de 7 a 15, San Quintín de 6 a 15—, y
> cuatro de los once canales del corredor publican casi sólo videos largos.
> Pero no se mezclan en un solo ranking: desde el 31 de marzo de 2025 una
> vista de Short cuenta cualquier arranque o repetición sin tiempo mínimo y la
> de un video largo no, así que es el mismo campo contando dos eventos
> distintos. Medido: mediana de 447 vistas contra 7. Mezclados, los videos no
> entrarían nunca.
>
> **De los cinco canales nuevos, uno es regional y cuatro son nacionales**, y
> se sondearon uno a uno antes de encenderlos. `@canal33noticias` resolvió 80%
> a zona del producto —21 de 30 piezas nombran Tijuana— con mediana de 1,856
> vistas: es la mejor fuente medida del corredor en este canal. `@NMas`,
> `@Milenio`, `@UnoTv` e `@imagennoticias` resolvieron entre 3% y 13%, así que
> entraron con `ambito: nacional`: pueblan la cubeta México del lector y nunca
> se le acreditan a una ciudad.
>
> **Quedó pendiente el texto de los comentarios.** El feed no lo trae y
> cosecharlo cuesta un actor de Apify, ~24 USD/mes con las 16 filas activas al
> volumen medido. El cliente decidió el mismo día dejarlo apagado por ahora,
> así que el panel no tiene comentarios de ninguna clase y tampoco el botón
> **Analizar**. El documento lo dice con `cosecha_comentarios: false` en vez de
> salir en ceros, que se leerían como «nadie comentó».
>
> **La pestaña «YouTube» del lector dejó de ser el panel agregado de
> comentarios.** Ese panel llevaba congelado desde el 4 de septiembre de 2026
> porque el cron nunca lo refresca, y salió del lector junto con
> `paneles/conversacion.tsx`. El pipeline que lo produce sigue intacto.

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
