/**
 * Cliente minimo de la API de Apify para la busqueda pagada en vivo. Solo
 * servidor.
 *
 * Es el primer codigo del sitio que llama a Apify. pulso/apify.py usa el
 * extremo SINCRONO (`run-sync-get-dataset-items`), que aqui no sirve: una
 * funcion de Vercel no puede esperar los hasta 300 s de un actor sin
 * arriesgarse a morir a la mitad con la corrida ya cobrada. Aqui se ARRANCA la
 * corrida y se vuelve; el navegador pregunta cada pocos segundos y cada
 * pregunta mira el estado (responder.ts).
 *
 * Dos cosas que el cliente de Python no tenia y esta ruta si necesita:
 *
 *  - `maxTotalChargeUsd` en CADA corrida: el tope en dolares lo aplica Apify,
 *    no nosotros despues de pagar. El `Presupuesto` de Python cuenta
 *    resultados y cobra cuando la llamada ya volvio; con una corrida por
 *    boton, un actor que se desboca no puede pasar de su tope.
 *  - Una lista CERRADA de actores (`ACTORES`), cada uno con su razon escrita.
 *    La ruta no acepta un id del navegador: el navegador manda un termino.
 *
 * Y una que si comparte, porque es la frontera legal: `revisarEntrada` es el
 * espejo de pulso/apify.py::revisar_entrada. Ninguna entrada con cookies,
 * credenciales o token de sesion sale de aqui. La busqueda por palabra de
 * Facebook PASA esa revision —su entrada no trae nada de eso— y aun asi es la
 * excepcion que el cliente decidio el 23 de septiembre de 2026: el proveedor
 * busca con cuentas propias. Esta escrita en su fila y en docs/PLAN.md.
 */

export const API_APIFY = "https://api.apify.com/v2";

export interface Actor {
  id: string;
  razon: string;
}

/** Los unicos actores que esta ruta puede llamar. */
export const ACTORES = {
  tiktokBusqueda: {
    id: "clockworks~tiktok-scraper",
    razon: "La busqueda por palabra de TikTok, sin sesion: la misma de config/tiktok.json y de las consultas.",
  },
  tiktokComentarios: {
    id: "clockworks~tiktok-comments-scraper",
    razon: "Los comentarios de los videos que nombran el termino. 0.00075 USD cada uno en el nivel Silver (leido el 23 de septiembre de 2026).",
  },
  instagram: {
    id: "apify~instagram-scraper",
    razon: "La etiqueta del termino y los comentarios de sus publicaciones, sin sesion. Instagram no tiene busqueda por palabra sin sesion.",
  },
  facebookBusqueda: {
    id: "scraper_one~facebook-posts-search",
    razon: "Busqueda por palabra en Facebook. Su entrada no trae sesion, pero la pagina de busqueda de Facebook la exige, asi que el proveedor busca con cuentas propias: cruza la frontera de docs/PLAN.md §3 por decision del cliente del 23 de septiembre de 2026, pendiente de opinion legal.",
  },
  facebookComentarios: {
    id: "apify~facebook-comments-scraper",
    razon: "Los comentarios de las publicaciones publicas que devolvio la busqueda, sin sesion. 0.0017 USD cada uno en el nivel Silver.",
  },
} as const satisfies Record<string, Actor>;

/** Espejo de pulso/apify.py::LLAVES_DE_SESION. `username` y `user` no estan a
 *  proposito: en casi todos los actores son el perfil objetivo. */
export const LLAVES_DE_SESION: ReadonlySet<string> = new Set([
  "accesstoken", "authtoken", "bearertoken", "c_user", "cookie", "cookies",
  "csrftoken", "li_at", "login", "logincredentials", "logins", "password",
  "sessionid", "sessionids", "sessioncookie", "sessioncookies", "sessionpool",
  "sessiontoken", "xf_session",
]);

export class ActorProhibido extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ActorProhibido";
  }
}

export function revisarEntrada(entrada: Record<string, unknown>, actor: string): void {
  const encontradas = Object.keys(entrada).filter((k) => LLAVES_DE_SESION.has(k.trim().toLowerCase())).sort();
  if (encontradas.length > 0) {
    throw new ActorProhibido(
      `el actor ${actor} recibe ${encontradas.join(", ")}, o sea que correria con sesion iniciada; `
      + "docs/PLAN.md seccion 3 lo refusa.",
    );
  }
}

export interface Tope {
  /** Lo mas que Apify puede cobrar por esta corrida. */
  usd: number;
  /** Lo mas que se cobra en resultados, para actores por resultado. */
  items: number;
  /** Segundos antes de que Apify la corte. */
  segundos: number;
}

export type EstadoCorrida = "READY" | "RUNNING" | "SUCCEEDED" | "FAILED" | "TIMING-OUT" | "TIMED-OUT" | "ABORTING" | "ABORTED";

export interface Corrida {
  id: string;
  dataset: string;
  estado: EstadoCorrida;
  /** Lo que de verdad se cobra (`usageTotalUsd`), o null si aun no se sabe. */
  usd: number | null;
}

export const TERMINADAS: ReadonlySet<EstadoCorrida> = new Set(["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"]);

export class ErrorApify extends Error {
  constructor(public readonly estado: number, mensaje: string) {
    super(mensaje);
    this.name = "ErrorApify";
  }
}

const MS_LIMITE = 15_000;

function comoCorrida(crudo: unknown): Corrida {
  const d = (crudo as { data?: Record<string, unknown> } | null)?.data ?? {};
  const id = typeof d.id === "string" ? d.id : "";
  const dataset = typeof d.defaultDatasetId === "string" ? d.defaultDatasetId : "";
  if (!/^[A-Za-z0-9]{8,40}$/.test(id) || !/^[A-Za-z0-9]{8,40}$/.test(dataset)) {
    throw new ErrorApify(502, "Apify devolvio una corrida sin id");
  }
  const usd = typeof d.usageTotalUsd === "number" && Number.isFinite(d.usageTotalUsd) ? d.usageTotalUsd : null;
  return { id, dataset, estado: (typeof d.status === "string" ? d.status : "READY") as EstadoCorrida, usd };
}

async function pedir(url: string, init: RequestInit, token: string, solicitar: typeof fetch): Promise<unknown> {
  const r = await solicitar(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(MS_LIMITE),
  });
  // Los mensajes no llevan el cuerpo de Apify: puede traer la entrada, y la
  // entrada lleva el termino que alguien busco.
  if (r.status === 401) throw new ErrorApify(401, "token de Apify rechazado");
  if (r.status === 402) throw new ErrorApify(402, "credito de Apify agotado");
  if (!r.ok) {
    // El TIPO del error si, que no lleva la entrada: fue lo que explico el 400
    // de TikTok de la sonda del 23 de septiembre de 2026 (un tope por debajo
    // del minimo del actor). El mensaje no, que puede citar la entrada.
    const tipo = await r.json().then((c: { error?: { type?: unknown } }) => (typeof c?.error?.type === "string" ? c.error.type : null)).catch(() => null);
    throw new ErrorApify(r.status, `Apify respondio ${r.status}${tipo === null ? "" : ` (${tipo.slice(0, 60)})`}`);
  }
  return r.json();
}

/** Arranca una corrida y vuelve en cuanto Apify la acepta. */
export async function iniciarCorrida(
  actor: Actor,
  entrada: Record<string, unknown>,
  tope: Tope,
  token: string,
  solicitar: typeof fetch = fetch,
): Promise<Corrida> {
  revisarEntrada(entrada, actor.id);
  const params = new URLSearchParams({
    timeout: String(tope.segundos),
    maxItems: String(tope.items),
    maxTotalChargeUsd: tope.usd.toFixed(2),
  });
  const cuerpo = await pedir(`${API_APIFY}/acts/${actor.id}/runs?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entrada),
  }, token, solicitar);
  return comoCorrida(cuerpo);
}

export async function estadoCorrida(id: string, token: string, solicitar: typeof fetch = fetch): Promise<Corrida> {
  if (!/^[A-Za-z0-9]{8,40}$/.test(id)) throw new ErrorApify(400, "id de corrida invalido");
  return comoCorrida(await pedir(`${API_APIFY}/actor-runs/${id}`, { method: "GET" }, token, solicitar));
}

/** Los items de una corrida. Leerlos no cuesta: el cobro fue al producirlos. */
export async function itemsDe(dataset: string, limite: number, token: string, solicitar: typeof fetch = fetch): Promise<Record<string, unknown>[]> {
  if (!/^[A-Za-z0-9]{8,40}$/.test(dataset)) throw new ErrorApify(400, "id de dataset invalido");
  const params = new URLSearchParams({ clean: "true", format: "json", limit: String(limite) });
  const cuerpo = await pedir(`${API_APIFY}/datasets/${dataset}/items?${params.toString()}`, { method: "GET" }, token, solicitar);
  return Array.isArray(cuerpo) ? cuerpo.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null) : [];
}
