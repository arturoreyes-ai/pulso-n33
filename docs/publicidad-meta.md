# Publicidad Meta: operación manual

La vista vive en `/gasto-electoral?vista=meta`. El catálogo inicial son las nueve figuras de `config/roster.json` más Julieta Ramírez; no pretende cubrir a todas las personas políticas de Baja California. Los filtros y pestañas se guardan en la URL. Los anuncios se cargan por anunciante; Comparar y Reporte se cargan al abrirlos.

## Estado del piloto del 21 de septiembre de 2026

El piloto contiene 26 tarjetas públicas de Julieta (24 individuales y dos grupos pendientes de expansión), información de transparencia, audiencia de siete días y cuatro filas del reporte de México del 18 de septiembre, además de su importe por ubicación para Baja California. Es una lectura parcial, no un censo desde 2024. Las ventanas de 30/90 días siguen sin dato. El catálogo documenta dos páginas verificadas (Julieta y Marina) y ocho vínculos con candidaturas INE. Las otras ocho páginas permanecen sin identificar; Marina no tiene anuncios capturados.

Las fuentes de identidad y fechas están en `config/publicidad-meta.json`. Julieta se vincula mediante su [ficha del Senado](https://morena.senado.gob.mx/ramirez-padilla-julieta-andrea/) y la [resolución que identifica la página numérica](https://www.te.gob.mx/sentenciasHTML/convertir/expediente/SRE-PSD-0027-2021-). La página de Marina está identificada en la [resolución del IEEBC](https://transparenciaieebc.mx/files/83m/acuerdos/res16_2021_CQyD.pdf). No se atribuyen páginas por semejanza de nombres. Los vínculos INE comprueban nombre completo, cargo y contienda contra el documento electoral existente.

El sondeo automático de ambas páginas se detuvo antes de abrir el navegador: `business.facebook.com/robots.txt` rechaza al agente del proyecto. Las páginas públicas habían sido legibles sin sesión durante la revisión manual, pero eso no valida la extracción automatizada. El adaptador de navegador existe; sus selectores, expansión y paginación quedan pendientes de validación en vivo mientras continúe este bloqueo. No hay tarea programada ni credenciales.

## La API oficial: por qué existe esta segunda vía

El adaptador de navegador quedó bloqueado. El sondeo del 21 y del 22 de
septiembre de 2026 devolvió `bloqueado (robots)` para las **dos** páginas
verificadas: `business.facebook.com/robots.txt` rechaza al agente del
proyecto. Nueve de las diez figuras se quedaron en `sin_dato` sin que nada
estuviera roto, y las dos salidas tentadoras están cerradas: apagar
`respetar_robots` es la frontera que fija AGENTS.md y que
`validar_publicidad_meta_config` obliga a documentar, y alquilar un raspador
no cambia nada por el mismo motivo por el que no se alquila para entrar con
sesión.

`pulso/publicidad_meta_api.py` lee `ads_archive`, la API de la Biblioteca de
Anuncios. **No es raspado:** se pide por HTTPS con un token, no hay sesión de
nadie, no hay navegador y robots.txt no gobierna una API. La referencia de
Meta cubre los anuncios «about social issues, elections or politics»
entregados en cualquier país y acepta `MX` en `ad_reached_countries`, así que
el catálogo cabe entero. El fundamento legal es distinto al del navegador, y
por eso son dos módulos y no un parámetro.

Lo que cuesta es una **verificación de identidad de Meta** —identificación
oficial y domicilio, de una persona con nombre— igual que el token de Apify
fue un paso humano. Sin token el módulo no escribe: levanta error y sale con
código 1, como el adaptador de navegador sin Playwright. No publica
`sin_dato`, porque faltar una credencial es un problema de operación y no un
hallazgo sobre el anunciante; además `combinar_seccion` conserva los datos
anteriores cuando los nuevos son `null`, y una sección `sin_dato` con datos
heredados llega al validador como «ausencia con datos».

```powershell
python -m pulso publicidad-meta --api --ahora 2026-09-22T18:00:00+00:00
python -m pulso publicidad-meta --api --persona jarp --ahora 2026-09-22T18:00:00+00:00
python -m pulso publicidad-meta --descubrir
```

Define el token en `.env` como `META_ADS_TOKEN` (se aceptan también
`META_API_TOKEN`, `META_TOKEN` y `FACEBOOK_ADS_TOKEN`, porque la credencial
circula con varios nombres según de dónde se copie).

### Qué trae y qué no

La API da **anuncios**. No da el bloque de transparencia de la página ni el
gasto de 7/30/90 días, que en el piloto salieron de una transcripción manual,
así que la captura **omite** `informacion` y `audiencia`: `armar` conserva la
sección anterior cuando la nueva no viene, de modo que correr esto no borra lo
que Julieta ya tiene. Emitirlas vacías sí lo borraría. Tampoco trae el formato
del creativo ni el «N ads use this creative», por lo que `formato` sale
`desconocido` y `grupo` sale `null`; deducir «imagen» porque no dijo «video»
sería una afirmación que la fuente no hace. La URL de cada anuncio **se
construye**, nunca se copia de `ad_snapshot_url`, que lleva el token de acceso
pegado.

Una lectura que agota `--max-paginas` con cursor pendiente sale `parcial` con
`completo: false`. No se declara censo lo que se truncó.

### Descubrir no es verificar

`--descubrir` busca por nombre a las figuras **sin** página y enseña
candidatos: id de página, nombre, cuántos anuncios sostienen la coincidencia y
quién declaró pagarlos. **No escribe nada.** La regla del catálogo —no se
atribuyen páginas por semejanza de nombres— no se relaja porque la respuesta
venga de Meta: que la API devuelva una página llamada como la persona sigue
siendo semejanza de nombres. Lo que agrega es el `bylines`, la declaración
legal de quién pagó, que es evidencia de otra clase. La decisión, sus
`fuentes` y su `razon` las escribe una persona en `config/publicidad-meta.json`.

Esto es lo que desbloquea a las ocho figuras sin página. La vía documental no
sirve: el identificador **numérico** que exige el validador aparece en
resoluciones que tratan de anuncios pagados —el caso `SRE-PSD` de Julieta—, no
en las de espectaculares o propaganda gubernamental, que son las que existen
para las ocho.

## Ejecutar

Desde la raíz, con el entorno Python del proyecto:

```powershell
python -m pulso publicidad-meta --probar --ahora 2026-09-21T18:00:00+00:00
python -m pulso publicidad-meta --probar --persona jarp --ahora 2026-09-21T18:00:00+00:00
python -m pulso publicidad-meta --importar cache/publicidad-meta/piloto.json --ahora 2026-09-21T18:00:00+00:00
python -m pulso validar
cd web
pnpm datos
```

`--probar` no publica ni modifica capturas. Un sondeo bloqueado no habilita la colección. La importación es la vía manual actual: permite publicar una transcripción verificada sin volver a solicitar las páginas. El archivo de ejemplo está en el caché local ignorado; no forma parte de un clon nuevo. Los documentos normalizados del piloto sí están versionados.

Para una futura ejecución del navegador, instalar `requirements-meta.txt` y `python -m playwright install chromium`, sondear primero y después ejecutar `python -m pulso publicidad-meta --ahora <ISO>`. El contexto es nuevo y sin sesión; no se cargan imágenes ni videos. `--max-paginas` limita la paginación y deja el resultado parcial si se alcanza. Un inicio de sesión, desafío o bloqueo detiene la lectura afectada. No cambiar `respetar_robots` sin una decisión explícita y documentada del proyecto.

## Contrato e importación

`pulso/validador.py` es la autoridad. `web/src/lib/datos/tipos.ts` refleja `DocPublicidadMeta` (índice) y `DocPerfilMeta` (detalle). `publicidad_meta.perfil_vacio` y `seccion` construyen envolturas válidas para preparar una importación sin inventar valores.

La entrada de `--importar` es un objeto con `perfiles` y `reporte`. Cada clave de perfiles es un ID del catálogo; su valor lleva `pagina_id`, y opcionalmente `anuncios`, `informacion` y `audiencia` (ventanas `7`, `30`, `90`). El reporte usa `1`, `7`, `30`, `90`, `todo`. Cada sección contiene `estado`, `fuente`, `periodo`, `geografia`, `consultado`, `ultimo_exito`, `completo`, `motivo` y `datos`. Omitir una sección conserva la anterior. Un fallo con `datos: null` conserva el último dato, su fecha, fuente y periodo, marcándolo como no completo.

Los anuncios incluyen ID de biblioteca/página, enlace, texto, estado, fechas de entrega, plataformas, formato, pagador, moneda, rangos de gasto e impresiones, regiones, entrega demográfica y grupo. El archivo no permite HTML crudo, sesiones ni credenciales. Las capturas crudas viven en `cache/publicidad-meta/`, fuera de git; las fechadas se purgan después de 30 días. La salida es determinista para una entrada y fecha iguales. La sincronización existente copia índice y detalles al sitio.

## Interpretación

- `null` significa ausencia. Cero sólo se publica cuando la fuente lo muestra, como la audiencia de siete días de Julieta.
- Los anuncios finalizados antes de 2024 se excluyen; los que cruzan el 1 de enero se conservan. Los totales históricos retienen el periodo original de Meta.
- Un signo `$` sin código explícito no confirma MXN. Esos totales se muestran con moneda sin confirmar y no entran en comparaciones monetarias.
- Las sumas de rangos individuales excluyen grupos sin resolver y permanecen separadas de los totales publicados por Meta. No son estimaciones puntuales ni totales completos.
- Entrega en Baja California no convierte todo el gasto del anuncio en gasto exclusivo del estado. La segmentación elegida y la entrega observada son conceptos separados; no se promedian porcentajes de anuncios.
- INE y Meta conservan periodos y definiciones separados. No se calcula gasto no reportado ni se suman ambos como gasto adicional.

## Verificación

```powershell
python -m unittest tests.test_publicidad_meta -v
python -m unittest tests.test_publicidad_meta_api -v
node web/scripts/probar-publicidad-meta.cjs
python -m pulso validar
cd web
pnpm build
```

Las pruebas cubren identidad, rangos, monedas, fechas, deduplicación, grupos pendientes, conservación ante fallos, rutas/enlaces, ausencia frente a cero y determinismo. La validación en vivo del colector permanece pendiente; las pruebas de contrato no la sustituyen.

Resultado de entrega: 21 pruebas Python y las pruebas de dominio TypeScript pasan; `pnpm build` y la comprobación de tokens pasan. Se verificaron en navegador filtros, historial, pestañas con teclado, paginación, cruce INE y ausencia frente a cero; el ancho móvil de 390 px no desborda. El validador global pasa con la fecha del corte (21 de septiembre). Al pasar al 22 de septiembre señala una noticia previa (`c9932fe97ed03c7d`) que excedió 30 días en la ventana de prensa; no es un error de estos documentos y no se modificó ese archivo ajeno.
