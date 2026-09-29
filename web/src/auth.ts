import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

/**
 * Entrada con Microsoft Entra ID, sobre Auth.js v5.
 *
 * El archivo se llama `auth.ts`, no `acceso.ts`, porque es la convencion que
 * Auth.js documenta y que `proxy.ts` y la ruta `[...nextauth]` importan como
 * `@/auth`: igual que `proxy.ts`, el nombre lo pone el marco. Lo que si es
 * nuestro vive en lib/acceso/ y esta en espanol.
 *
 * Lo que este modulo decide, y por que:
 *
 *  - Identidad SOLO de Entra. No hay contrasenas, registro ni recuperacion de
 *    cuenta: Microsoft es el dueno de la identidad y el tablero solo la lee.
 *    La cuenta requiere aprobacion ademas de identidad; el rol lo pone la tabla
 *    `usuarios` (lib/acceso/usuarios.ts).
 *  - Sesion en JWT firmado con AUTH_SECRET, sin adaptador de base de datos:
 *    no existen las tablas accounts/sessions/verification_tokens de Auth.js.
 *    La unica tabla es `usuarios`, y se escribe en `callbacks.signIn`.
 *  - `trustHost: true`. Detras de Vercel la peticion llega por un proxy y
 *    sin esto Auth.js rechaza el host que ve.
 *  - `providers` vacio cuando faltan las variables. La app tiene que arrancar
 *    sin Entra para que el modo sin Entra de desarrollo sirva de algo, y para
 *    que `next build` no dependa de secretos.
 *  - `prompt: "select_account"`. Sin esto Microsoft reutiliza en silencio la
 *    cuenta activa del navegador, y quien tiene cuenta personal y de trabajo
 *    entra con la equivocada sin que se le pregunte.
 *  - El `oid` de Entra viaja en el token y sale en `session.user.entraOid`.
 *    Es el identificador inmutable de la persona; el correo puede cambiar.
 *
 * Los nombres de las variables son los que Auth.js infiere solo
 * (AUTH_MICROSOFT_ENTRA_ID_ID, _SECRET, _ISSUER). Se leen a mano de todos
 * modos porque hace falta saber si estan las tres.
 */
const clienteId = process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
const clienteSecreto = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;
const emisor = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER;

/** Verdadero cuando el despliegue puede entrar con Microsoft. La pagina /entrar lo ensena. */
export const hayEntra = Boolean(clienteId && clienteSecreto && emisor);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers:
    hayEntra && clienteId && clienteSecreto && emisor
      ? [
          MicrosoftEntraID({
            clientId: clienteId,
            clientSecret: clienteSecreto,
            issuer: emisor,
            authorization: {
              params: { prompt: "select_account", scope: "openid profile email User.Read" },
            },
          }),
        ]
      : [],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/entrar", signOut: "/entrar", error: "/entrar" },
  callbacks: {
    /** Registra la solicitud y solo crea sesion para cuentas activas y aprobadas. */
    async signIn({ user, profile }) {
      const correo = (user.email || "").trim().toLowerCase();
      if (!correo) return false;
      const { registrarAcceso } = await import("@/lib/acceso/usuarios");
      const fila = await registrarAcceso({
        correo,
        nombre: user.name?.trim() || correo,
        entraOid: typeof profile?.oid === "string" ? profile.oid : null,
      });
      if (!fila.activo) return false;
      if (!fila.aprobado) return "/entrar?error=ApprovalRequired";
      return true;
    },
    jwt({ token, profile }) {
      if (profile && typeof profile.oid === "string") token.entraOid = profile.oid;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as typeof session.user & { entraOid?: string }).entraOid =
          typeof token.entraOid === "string" ? token.entraOid : undefined;
      }
      return session;
    },
  },
});
