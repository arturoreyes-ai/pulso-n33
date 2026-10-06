# 04 · Manual del administrador

Para quién: quien tiene rol `admin` en el tablero y acceso al repositorio de
GitHub. Qué cuenta: dar y quitar accesos, qué se enciende con qué interruptor y
cuánto cuesta, cómo se agrega una fuente sin meter basura, y la rutina que
evita que un panel se quede viejo sin que nadie lo note.

Verificado el 5 de octubre de 2026 · commit `2e66668`.

---

## 1. Lo que un admin ve y un lector no

| Lugar | Para qué |
|---|---|
| **Accesos** (`/admin/usuarios`, en el menú de tu cuenta) | Aprobar y revocar cuentas |
| **Reportes** (`/reportes`, en el riel) | Expedientes y términos seguidos, con PDF |
| **Expedientes** (`/reportes/<id>`) | El informe fijo de una persona y su PDF |

Para un lector esas rutas responden 404: no saben que existen.

## 2. Accesos

### Cómo llega una solicitud

1. La persona abre el tablero y pulsa **Entrar con Microsoft** con su cuenta
   de la organización.
2. Si es la primera vez, el tablero crea su cuenta como `lector`, **sin
   aprobar**, y le muestra que su acceso está pendiente.
3. Si `AVISO_SOLICITUD_REMITENTE` y `AVISO_SOLICITUD_PARA` están configurados,
   los admins reciben un correo con el enlace a Accesos.

### Aprobar o revocar

En **Accesos** hay dos listas: *Solicitudes pendientes* y *Cuentas del equipo*.
Cada fila tiene un botón **Aprobar acceso** o **Revocar acceso**.

- Revocar surte efecto **en el siguiente clic** de esa persona: la puerta
  consulta la base en cada petición, no espera a que caduque la sesión.
- **No puedes editar tu propia cuenta.** Otro admin tiene que hacerlo.
- La sesión dura 8 horas; después se vuelve a entrar con Microsoft.

### Cambiar el rol o desactivar

La pantalla solo aprueba y revoca. Para hacer admin a alguien o desactivar una
cuenta se usa la API (`PATCH /api/admin/usuarios/<id>` con `{"rol": "admin"}` o
`{"activo": false}`) o SQL directo en Neon:

```sql
update usuarios set rol = 'admin' where correo = 'persona@vivelabaja.com';
```

Cambiar el rol o reactivar **no aprueba**: son decisiones distintas.

**Puerta de emergencia:** el correo en `ACCESO_PRIMER_ADMIN` (variable de
Vercel) se vuelve admin, activo y aprobado cada vez que entra. Si todos los
admins pierden acceso, esa cuenta lo recupera.

Hoy: 16 cuentas, 6 admin y 10 lectores, ninguna pendiente.

## 3. Interruptores y topes de gasto

Nada pagado ocurre solo, salvo las cosechas del cron. Cada costo tiene un
interruptor y, donde aplica, un tope.

| Qué | Interruptor | Dónde | Costo y tope |
|---|---|---|---|
| Cosechas de Instagram, TikTok, Facebook y tendencias de X | `APIFY_HABILITADO=true` | Variable del repositorio en GitHub | Plan de Apify ($199/mes); presupuesto por corrida en cada `config/*.json` |
| Botones de IA (Analizar, Detallar, Guion, resumen de comentarios) | `ANALISIS_HABILITADO=true` + `ANTHROPIC_API_KEY` | Vercel | Centavos por botón: un guion ~$0.02–0.04 |
| Seguimiento («Actualizar») | `SEGUIMIENTO_HABILITADO=true` | Vercel | **$20/mes**, 10 lecturas por persona al día, 30 min entre lecturas |
| Búsqueda pagada en vivo | `BUSQUEDA_REDES_HABILITADA=true` | Vercel | $50/mes, 10 por persona al día. Sin botón en pantalla desde el 30 de septiembre |
| Panel de conversación de YouTube | `YOUTUBE_HABILITADO` | GitHub | **Apagado pendiente de opinión legal. No encender.** |
| Publicar con comentarios | `DESPLEGAR_TABLERO=true` + 3 secretos de Vercel | GitHub | Sin costo; ver manual técnico §5 |

Para cambiar una variable de GitHub: *Settings → Secrets and variables →
Actions → Variables*. Para Vercel: *proyecto `pulso` → Settings → Environment
Variables*, y redesplegar.

> **Apagar `APIFY_HABILITADO` para salir de un apuro está bien. Olvidar
> encenderlo, no.** El 24 de septiembre se apagó para que el cron terminara y
> las redes estuvieron un día y medio congeladas sin que nadie lo notara. Si lo
> apagas, apúntalo y pon un recordatorio.

Comprobar que el token de Apify funciona (gratis):

```bash
python -m pulso apify --verificar
```

## 4. Catálogos: agregar o quitar una fuente

Las fuentes viven en `config/`. Se editan a mano, por pull request, y CI
valida el cambio. Reglas que valen para todas:

1. **No se borra una fila: se apaga** con `"activo": false` y una `razon`
   escrita. La fila es la memoria de por qué no se lee.
2. **Sondear antes de activar.** Una fila activa necesita `verificado` con la
   fecha del sondeo, y su `razon` debe citar lo que el sondeo mostró. Sin eso,
   el validador la salta o falla.
3. **Un nombre de lugar repetido no se verifica leyendo la bio.**
   `@noticiasensenada` era de Ensenada, Buenos Aires: 24 767 seguidores, bio
   sin país, y cuatro notas argentinas en el muro de Ensenada. Se verifica
   leyendo **los lugares que nombran sus publicaciones** (`--muestra`).
4. **Un medio, una red.** Si un medio está en Instagram y en TikTok, se lee en
   la que tiene más seguidores (`marca`); la otra fila queda apagada con los
   dos números. La excepción escrita son los medios nacionales e
   internacionales con `dos_redes`.

### Los sondeos (no escriben nada)

```bash
python -m pulso redes --sondear @cuenta --muestra 5 --ambito regional
```

```bash
python -m pulso tiktok --probar --fila <id>
```

```bash
python -m pulso facebook --sondear <id> --muestra 3
```

```bash
python -m pulso youtube --probar --canal <id>
```

Instagram cuesta un resultado por cuenta más N de muestra; YouTube es gratis.
El sondeo imprime dónde caería cada publicación: si una cuenta «de Tijuana»
manda la mitad a Sonora, no se activa.

### Dónde está cada catálogo

| Quieres… | Archivo |
|---|---|
| Un medio de prensa nuevo | `config/medios.json` (`idioma` obligatorio: el modelo de tono solo habla español) |
| Una cuenta de Instagram | `config/instagram.json` (`zona` o `ambito`, nunca ambos) |
| Una búsqueda o perfil de TikTok | `config/tiktok.json` |
| Una página de Facebook | `config/facebook.json` (siempre `ambito`) |
| Un canal de YouTube | `config/youtube.json` (sin `zona`: la zona sale del título) |
| Un término para Reportes | `config/consultas.json` |
| Una figura pública (cambio de cargo) | `config/roster.json`, con fechas `desde`/`hasta` |

Los señuelos (`senuelos`) son cuentas que parecieron buenas y no lo son,
guardadas con la prueba. Antes de proponer una cuenta, busca si ya está ahí.

## 5. Reportes y expedientes

### Términos seguidos (consultas)

Un término —«Vive la Baja», «Grupo Concordia», «Valente Márquez»— se define en
`config/consultas.json` y se cosecha **a mano, fuera del cron**:

```bash
python -m pulso consultas --sentimiento modelo
```

Si solo cambió la configuración (una exclusión, una fecha), sin pagar nada:

```bash
python -m pulso consultas --sin-cosecha --sentimiento modelo
```

- `prensa.excluidos`: titulares que la búsqueda trajo y no son del término,
  con su razón. La pantalla publica cuántos se excluyeron.
- `agregados`: enlaces que una persona señaló a mano.
- Comentarios copiados a mano de una publicación cerrada:
  `consultas --importar-comentarios ARCHIVO --consulta ID --post URL`.

> **Subir `data/consultas.json` al repositorio dispara la ingesta completa,
> pagos incluidos.** Para una demostración, corre en local.

### Expedientes

Un expediente es un informe **fechado y fijo** sobre una persona (el primero:
el año de Ismael Burgueño en prensa y redes). Vive en
`web/src/lib/expedientes/` y no se regenera solo. La parte de redes:

```bash
python -m pulso expediente-redes --expediente ismael-burgueno-2026 --estimar
```

`--estimar` imprime el peor caso en dólares sin llamar a nada; la corrida se
niega a arrancar por encima de `tope_usd`. Los resúmenes de comentarios se
escriben una vez, a mano (`node --env-file=.env scripts/resumir-expediente.cjs
<id>` desde `web/`, ~$1.30 por 97 publicaciones).

El PDF de un expediente o de un término se descarga desde su página.

## 6. Rutina

### Cada día (5 minutos)

1. **GitHub → Actions → «pulso»**: las últimas cuatro corridas en verde. Abre
   la última y lee las **anotaciones amarillas**: avisan de Apify apagado,
   paneles con más de 12 h de retraso, publicaciones cuyos conteos no se
   releyeron y vistas que esconden publicaciones mucho más populares.
2. En el tablero, **Redes**: las tarjetas dicen «hace X h». Si en lugar de eso
   muestran una fecha, ese panel está viejo.
3. **Accesos**: solicitudes pendientes.

### Cada semana

- Revisa el gasto en [Apify](https://console.apify.com) contra el plan.
- Revisa el gasto de Seguimiento (consulta en el modelo de datos, §4).
- El lunes corre el gasto electoral; mira que su paso no haya fallado.

### Cada mes o al caducar

- **Secreto de cliente de Entra ID**: tiene fecha de caducidad (anotada al
  crearlo). Genera uno nuevo antes, ponlo en Vercel y redespliega.
- Llaves de Apify y Anthropic: rotarlas si alguien con acceso deja el equipo.
- Revisa `config/roster.json` si cambió un cargo público.

## 7. Lo que no se cambia sin el cliente

Estas decisiones están registradas en `docs/PLAN.md` con fecha. Un admin no
las revierte; se le pregunta al cliente:

- Encender el panel de conversación de YouTube (opinión legal pendiente).
- Raspar con sesión iniciada en cualquier red.
- Cruzar el tono con figuras públicas fuera de Reportes y Seguimiento.
- Encender búsquedas de TikTok apagadas por falsos positivos (Tecate, San
  Felipe, San Quintín, Política, Economía, IA).
- Subir los topes de Seguimiento ($20) o de la búsqueda en vivo ($50).

---

Pulso N33 · 04 Manual del administrador · verificado el 5 de octubre de 2026
