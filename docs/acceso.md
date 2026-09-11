# Acceso al tablero: Microsoft Entra ID + Neon

El tablero de `web/` es privado. Se entra con la cuenta de Microsoft de la
organización, la sesión es una cookie firmada de ocho horas y el rol de cada
persona vive en una sola tabla, `usuarios`, en un Postgres gratuito de Neon.
No hay contraseñas propias, ni registro, ni recuperación de cuenta: Microsoft
es el dueño de la identidad y el tablero solo la lee.

Este documento es la receta completa, de cero a producción. Las decisiones de
diseño están en los docstrings del código, que es donde se leen al tocarlo;
aquí solo lo que hay que hacer con las manos fuera del repositorio.

## Qué hay, qué no hay

| Sí | No |
|---|---|
| Entrada con Entra ID (OIDC), sesión JWT de 8 h con cookie rodante | Contraseñas, registro, "olvidé mi contraseña" |
| Fila en `usuarios` creada al primer inicio de sesión | Cola de aprobación: quien entra, entra (como `lector`) |
| Dos roles, `lector` y `admin`, comprobados por ruta en la API | Tablas `accounts`/`sessions` de Auth.js: no hay adaptador |
| La puerta en `proxy.ts` cubre HTML estático, `/data/*.json` y `/api/*` | Comprobación de rol en el proxy: ahí solo hay un JWT |
| Alta y baja de usuarios por API (`PATCH /api/admin/usuarios/:id`) | Interfaz de administración |

Lo que cambia respecto a SmartNote, de donde viene el diseño: el proxy **sí
exige sesión**. Allí la portada es dinámica y decide en el servidor; aquí las
nueve páginas se prerrenderizan como HTML estático y los datos son archivos
bajo `/data`, sin ninguna ruta que pueda mirar la sesión. El único punto por el
que pasa todo es el proxy, y en Vercel corre antes del caché de borde, así que
ni una copia cacheada de `notas.json` se sirve sin sesión.

## Mapa del código

| Qué | Dónde |
|---|---|
| Configuración de Auth.js, proveedor Entra, `callbacks.signIn` (alta al entrar) | `web/src/auth.ts` |
| Ruta de Auth.js | `web/src/app/api/auth/[...nextauth]/route.ts` |
| La puerta: exige sesión y refresca la cookie | `web/src/proxy.ts` |
| Quién pregunta y con qué rol: `requerirUsuario`, `requerirAdmin`, `requerirRol` | `web/src/lib/acceso/sesion.ts` |
| Reglas puras de rol, sin imports | `web/src/lib/acceso/roles.ts` |
| SQL plano sobre `usuarios` | `web/src/lib/acceso/usuarios.ts` |
| Cliente de Neon | `web/src/lib/acceso/bd.ts` |
| `ErrorApi`, `respuestaError`, `jsonSinCache` | `web/src/lib/acceso/http.ts` |
| Rebanada de entorno, modo sin Entra | `web/src/lib/acceso/config.ts` |
| Acciones de servidor entrar/salir | `web/src/lib/acceso/acciones.ts` |
| La página de entrada | `web/src/app/entrar/page.tsx` |
| `GET /api/yo`, `GET /api/admin/usuarios`, `PATCH /api/admin/usuarios/:id` | `web/src/app/api/...` |
| DDL de `usuarios` y su runner | `web/db/0001_usuarios.sql`, `web/scripts/migrar.mjs` |

## 1. Registrar la aplicación en Azure

Portal de Azure > Microsoft Entra ID > Registros de aplicaciones > Nuevo
registro.

1. **Nombre**: `Pulso N33` o el que prefieras. Es lo que ve la gente en la
   pantalla de consentimiento.
2. **Tipos de cuenta admitidos**: solo este directorio (inquilino único).
3. **URI de redirección**: plataforma **Web**, no "Aplicación de página
   única". Es un cliente confidencial con secreto; una SPA no tiene secreto y
   Auth.js no funciona con ese registro. La URI es exacta:

   ```
   https://<tu-dominio>/api/auth/callback/microsoft-entra-id
   ```

   y, en la misma app, agrega la de desarrollo:

   ```
   http://localhost:3000/api/auth/callback/microsoft-entra-id
   ```

   El segmento final es el id del proveedor en Auth.js. Cualquier otra cosa
   produce `redirect_uri_mismatch`, el fallo de configuración más común.
4. **Certificados y secretos** > Nuevo secreto de cliente. Copia la columna
   **Valor** en cuanto aparece; después se oculta. **No** copies el "Id. de
   secreto": pega igual de bien y falla con `AADSTS7000215: Invalid client
   secret provided`. Apunta la fecha de caducidad: hay que rotarlo antes.
5. **Permisos de API**: `openid`, `profile`, `email`, `User.Read` de Microsoft
   Graph, delegados. Vienen por omisión salvo `User.Read`. Si el inquilino
   exige consentimiento del administrador, concédelo aquí una vez.
6. De **Información general** apunta el **Id. de aplicación (cliente)** y el
   **Id. de directorio (inquilino)**.

## 2. La base de datos: Neon

Neon es Postgres administrado con un nivel gratuito (medio GB, cómputo que se
duerme solo cuando nadie lo usa). Para una tabla con menos de 50 filas no se
acerca a ningún límite, y se conecta a Vercel sin configurar nada.

**Camino A, el recomendado: desde Vercel.** En el proyecto de Vercel >
Storage > Create Database > Neon. Vercel crea el proyecto en Neon e inyecta
las variables en el proyecto, para todos los entornos, **con el prefijo
`NEON_DB_`**: la cadena que importa llega como `NEON_DB_DATABASE_URL`, y el
código la acepta igual que `DATABASE_URL`. El cron ya hace `vercel pull` antes
de construir, así que el runner la ve sin tocar el workflow.

**Camino B: en neon.tech directo.** Crea el proyecto, copia la cadena de
conexión "pooled" del panel y ponla como `DATABASE_URL` en Vercel a mano.

Después, desde `web/`, crea la tabla:

```bash
DATABASE_URL="postgresql://..." pnpm migrar
```

El runner aplica `db/*.sql` en orden y cada archivo es idempotente, así que
se puede repetir sin miedo. Alternativa sin Node: pega el contenido de
`web/db/0001_usuarios.sql` en el editor SQL de Neon.

En local, la misma variable en `web/.env.local` basta: `pnpm migrar` la lee
de ahí.

## 3. Variables de entorno

En Vercel > Settings > Environment Variables, para Production (y Preview si
lo usas). Los nombres `AUTH_*` son los que Auth.js lee solo; los `ACCESO_*`
son nuestros.

| Variable | Valor | De dónde |
|---|---|---|
| `AUTH_SECRET` | 32 bytes aleatorios en base64url | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | Id. de aplicación (cliente) | Azure, paso 1.6 |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | El **Valor** del secreto | Azure, paso 1.4 |
| `AUTH_MICROSOFT_ENTRA_ID_ISSUER` | `https://login.microsoftonline.com/<Id. de inquilino>/v2.0` | Azure, paso 1.6 |
| `ACCESO_PRIMER_ADMIN` | Tu correo, en minúsculas | Tú |
| `DATABASE_URL` o `NEON_DB_DATABASE_URL` | Cadena de Neon | Paso 2 (la integración pone la segunda sola) |

Dos cosas que no son obvias:

- `AUTH_SECRET` no lo lee ningún módulo nuestro con `process.env`; Auth.js lo
  toma directo. Y v5 usa nombres `AUTH_*`: `NEXTAUTH_SECRET` y `NEXTAUTH_URL`
  no hacen nada.
- `ACCESO_PRIMER_ADMIN` no es "el primero que entra". Es un correo que entra
  como `admin` y activo **en cada entrada**. Con la tabla vacía es el
  arranque; con el último admin perdido o desactivado, es la puerta de
  emergencia: pon tu correo, vuelve a entrar, arregla el resto por la API.

`web/.env.example` tiene las mismas variables comentadas una a una.

## 4. Desarrollo local

Con Azure, copia `web/.env.example` a `web/.env.local`, rellena las
`AUTH_*` con los valores del registro (la URI de `localhost` del paso 1.3 ya
está dada de alta) y `DATABASE_URL`. `pnpm dev` y entra.

**Sin Azure ni base de datos**, que es lo que quieres para tocar la interfaz:

```
ACCESO_SIN_ENTRA=true
ACCESO_DEV_CORREO=dev@pulso.local
ACCESO_DEV_ROL=admin
```

El servidor actúa como si hubiera entrado ese correo con ese rol; cambia
`ACCESO_DEV_ROL` a `lector` para ver el 403 de las rutas de admin. Si además
hay `DATABASE_URL`, la fila de desarrollo se escribe de verdad; si no, es un
usuario sintético y la tabla no se toca. El modo **solo existe bajo
`next dev`**: la condición es `NODE_ENV !== "production"`, que `next build` y
`next start` fijan solos, así que ningún `.env` arrastrado a Vercel puede
abrir el tablero.

## 5. Administrar usuarios

No hay interfaz; son dos rutas y `curl` con la cookie del navegador, o
cualquier cliente que la envíe. Todas responden `Cache-Control: no-store`.

```bash
# Quién soy
curl -b "authjs.session-token=..." https://<dominio>/api/yo

# Lista (solo admin)
curl -b "authjs.session-token=..." https://<dominio>/api/admin/usuarios

# Volver admin a alguien, o darlo de baja (solo admin; nunca a uno mismo)
curl -b "authjs.session-token=..." -X PATCH -H "content-type: application/json" \
  -d '{"rol":"admin"}' https://<dominio>/api/admin/usuarios/7
curl -b "authjs.session-token=..." -X PATCH -H "content-type: application/json" \
  -d '{"activo":false}' https://<dominio>/api/admin/usuarios/7
```

Qué hace una baja (`activo=false`): la persona **no puede volver a entrar**
(`callbacks.signIn` la rechaza y `/entrar` le dice que su cuenta está
desactivada) y la API le responde 403 en la siguiente petición. La sesión que
ya tenga abierta sigue viendo el HTML estático hasta ocho horas, porque el
proxy solo ve el JWT. Si eso no basta en un caso concreto, rota `AUTH_SECRET`:
invalida todas las sesiones a la vez.

## 6. Lista de verificación

En orden, la primera vez:

1. El proyecto de Vercel dice Framework Preset **Next.js**, Root Directory
   **web** e "Include source files outside of the Root Directory" activado.
   Sin lo primero todo es `404` aunque el build pase (ver §7).
2. `pnpm migrar` terminó con `0001_usuarios.sql: 1 sentencia(s) aplicada(s)`.
3. Abrir `/` sin sesión redirige a `/entrar?volver=%2F`; abrir
   `/data/notas.json` sin sesión responde `401` en JSON, no HTML.
4. Entrar con el correo de `ACCESO_PRIMER_ADMIN` crea la fila con
   `rol=admin`; `/api/yo` lo confirma.
5. Entrar con un segundo correo crea una fila `lector`; para esa persona,
   `/api/admin/usuarios` responde `403`.
6. "Salir" en la pastilla lleva a `/entrar?salida=1` y `/` vuelve a pedir
   sesión.
7. A las ocho horas sin actividad la sesión caduca; con actividad, el proxy
   la va renovando.

## 7. Cuando falla

| Síntoma | Causa | Arreglo |
|---|---|---|
| `AADSTS50011` / `redirect_uri_mismatch` | La URI registrada no es exactamente `/api/auth/callback/microsoft-entra-id` sobre el dominio que se usa | Paso 1.3, y revisa `http` vs `https` |
| `AADSTS7000215: Invalid client secret` | Se pegó el "Id. de secreto" en vez del "Valor" | Paso 1.4; genera otro secreto |
| `/entrar?error=Configuration` | Falta alguna de las tres `AUTH_MICROSOFT_ENTRA_ID_*` o `AUTH_SECRET` en ese entorno | Paso 3; en Vercel, redespliega tras cambiar variables |
| `/entrar?error=AccessDenied` | La cuenta está `activo=false`, o `DATABASE_URL` falla dentro de `callbacks.signIn` | Revisa la fila; mira los logs de la función en Vercel |
| Entra y vuelve a `/entrar` en bucle | La cookie no se fija: `trustHost`, o el dominio cambió (preview de Vercel con otra URL) | Registra también la URI del preview, o prueba en producción |
| Microsoft no pregunta qué cuenta usar | Falta `prompt: "select_account"` en `auth.ts` | Está puesto a propósito; no lo quites |
| Todo responde 401, hasta el HTML | El `matcher` del proxy excluye algo de más, o `acceso.sinEntra` en un build | Revisa `proxy.ts`; el modo sin Entra no existe en builds |
| `DATABASE_URL no está configurado` en logs | La integración de Neon no está en ese entorno (Preview vs Production) | Vercel > Storage > conecta el entorno que falta |
| Vercel responde `404: NOT_FOUND` en toda la página, pero `/ruido.svg` y `/data/*.json` responden 200 | Framework Preset quedó en "Other": el proyecto se importó con la raíz del repo (sin `package.json` en git) y Vercel no vuelve a detectar el framework al cambiar Root Directory a `web`; construye Next y publica `public/` como sitio estático | Settings > Build and Deployment > Framework Preset = Next.js y redesplegar. Pasó el 11 de septiembre de 2026 |

## 8. Lo que se dejó fuera, y por qué

Del diseño original de SmartNote no se trajo:

- **La cola de aprobación** (`access_status`, solicitud/aprobación, la
  pantalla "tu acceso está en revisión"). Aquí quien tiene cuenta en el
  inquilino puede ver el tablero; el control fino de quién está en el
  inquilino es de Entra, no nuestro.
- **El conteo de "último admin"**. Con menos de 50 usuarios la salvaguarda
  que importa es no poder editarse a uno mismo (`roles.ts`) más la puerta de
  emergencia de `ACCESO_PRIMER_ADMIN`.
- **El registro de auditoría** y la verificación del nombre de la base. Una
  tabla, un uso.
- **Los tokens de worker** (`snw_`). No hay worker.

Y una regla de este repo que el acceso no cambia: `usuarios` es la **única**
tabla. Los datos del producto siguen en `data/*.json` y su historial sigue
siendo git. Si algo más quiere una base de datos, es una conversación aparte.
