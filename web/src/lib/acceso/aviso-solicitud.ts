/**
 * Correo a los administradores cuando alguien pide acceso.
 *
 * Desde el 28 de septiembre de 2026 una cuenta nueva entra pendiente
 * (0004_aprobacion.sql) y nadie se enteraba: la solicitud esperaba en
 * Accesos hasta que un admin abriera la pagina por otra razon. El 29 de
 * septiembre Arturo pidio un correo con nombre, correo y hora del Pacifico.
 *
 * Sale por Microsoft Graph con la misma app de Entra que firma la entrada,
 * con credenciales de cliente: ni proveedor nuevo ni registros DNS. Exige el
 * permiso de aplicacion Mail.Send con consentimiento del inquilino (receta en
 * docs/acceso.md §3), que por si solo deja enviar como CUALQUIER buzon; por
 * eso la receta lo acota con una directiva de acceso de aplicacion al buzon
 * remitente.
 *
 * Solo la PRIMERA vez que el correo aparece (el INSERT de registrarAcceso), no
 * en cada reintento de una cuenta pendiente: quien pulsa «Entrar» cinco veces
 * no son cinco solicitudes.
 *
 * Nunca rompe la entrada. Sin las variables no hace nada, y un fallo de Graph
 * se registra y se traga: el aviso es cortesia, la solicitud ya esta en la
 * tabla. Se espera (con tope de 8 s) en vez de dispararse suelto porque en
 * una funcion de Vercel lo que queda pendiente al responder puede no correr.
 */
const TOPE_MS = 8_000;

export interface Solicitud {
  nombre: string;
  correo: string;
  /** Cuando se registro la fila; ISO. */
  creadoEn: string;
}

interface ConfigAviso {
  inquilino: string;
  clienteId: string;
  clienteSecreto: string;
  remitente: string;
  destinatarios: string[];
}

function configAviso(): ConfigAviso | null {
  const clienteId = process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
  const clienteSecreto = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;
  // https://login.microsoftonline.com/<inquilino>/v2.0
  const inquilino = /login\.microsoftonline\.com\/([^/]+)/.exec(process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER || "")?.[1];
  const remitente = (process.env.AVISO_SOLICITUD_REMITENTE || "").trim().toLowerCase();
  const destinatarios = (process.env.AVISO_SOLICITUD_PARA || "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  if (!clienteId || !clienteSecreto || !inquilino || !remitente || destinatarios.length === 0) return null;
  return { inquilino, clienteId, clienteSecreto, remitente, destinatarios };
}

export function avisoHabilitado(): boolean {
  return configAviso() !== null;
}

/** «29 sep 2026, 10:42 a.m. PDT»: PST en invierno y PDT en verano, lo dice Intl y no nosotros. */
export function horaPacifico(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso)) + " " + zonaCorta(iso);
}

function zonaCorta(iso: string): string {
  // es-MX da «GMT-7»; en-US da «PDT»/«PST», que es lo que se pidio.
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", timeZoneName: "short" }).formatToParts(new Date(iso));
  return partes.find((p) => p.type === "timeZoneName")?.value ?? "PT";
}

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Vercel fija el dominio de produccion; sin el, el correo va sin enlace. */
function enlaceAccesos(): string | null {
  const dominio = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return dominio ? `https://${dominio}/admin/usuarios` : null;
}

export function cuerpoAviso(s: Solicitud): { asunto: string; html: string } {
  const hora = horaPacifico(s.creadoEn);
  const enlace = enlaceAccesos();
  const html = [
    `<p>${escapar(s.nombre)} pidió acceso a Pulso N33.</p>`,
    "<table cellpadding=\"4\">",
    `<tr><td><b>Nombre</b></td><td>${escapar(s.nombre)}</td></tr>`,
    `<tr><td><b>Correo</b></td><td>${escapar(s.correo)}</td></tr>`,
    `<tr><td><b>Hora</b></td><td>${escapar(hora)}</td></tr>`,
    "</table>",
    enlace
      ? `<p><a href="${escapar(enlace)}">Aprobar o rechazar en Accesos</a></p>`
      : "<p>Apruébala o recházala en Accesos.</p>",
  ].join("\n");
  return { asunto: `Solicitud de acceso: ${s.nombre}`, html };
}

async function pedir(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TOPE_MS) });
}

export async function avisarSolicitud(s: Solicitud): Promise<void> {
  const config = configAviso();
  if (!config) return;
  try {
    const token = await pedir(`https://login.microsoftonline.com/${config.inquilino}/oauth2/v2.0/token`, {
      method: "POST",
      body: new URLSearchParams({
        client_id: config.clienteId,
        client_secret: config.clienteSecreto,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    });
    if (!token.ok) throw new Error(`token ${token.status}: ${(await token.text()).slice(0, 300)}`);
    const { access_token } = (await token.json()) as { access_token?: string };
    if (!access_token) throw new Error("token sin access_token");

    const { asunto, html } = cuerpoAviso(s);
    const envio = await pedir(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.remitente)}/sendMail`, {
      method: "POST",
      headers: { authorization: `Bearer ${access_token}`, "content-type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: asunto,
          body: { contentType: "HTML", content: html },
          toRecipients: config.destinatarios.map((address) => ({ emailAddress: { address } })),
        },
        saveToSentItems: false,
      }),
    });
    // 202 Accepted; 403 ErrorAccessDenied = falta Mail.Send o la directiva no cubre al remitente.
    if (envio.status !== 202) throw new Error(`sendMail ${envio.status}: ${(await envio.text()).slice(0, 300)}`);
  } catch (error) {
    console.error("aviso de solicitud no enviado:", error);
  }
}
