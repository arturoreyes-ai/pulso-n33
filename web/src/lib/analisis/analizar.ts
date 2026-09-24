import { json, SIN_CACHE } from "@/lib/busqueda/respuesta";
import { analisisHabilitado } from "./config";
import { formatoSocial, NOMBRES_FORMATO, REGLA_FORMATO } from "./formatos";
import type { LecturaAnalisis, SugerenciaSocial } from "./contrato";
import { dominioDeUrl } from "./dominio";
import { extraerTexto } from "./extraer";
import { resolverEnlace, type ResultadoEnlace } from "./resolver-enlace";
import { urlSegura } from "./url";

/**
 * La lectura automatica de una nota enlazada.
 *
 * QUE HACE ESTO Y QUE NO TOCA, porque parece cruzar dos lineas del producto y
 * solo cruza una, por decision del cliente del 15 de septiembre de 2026:
 *
 *  - SI abre la nota del medio. PRODUCT.md dice que el producto agrega titular,
 *    fuente y enlace y nunca el cuerpo, porque el cliente lanza un medio
 *    competidor. Leer la nota en el momento para explicarla es lo que el
 *    cliente pidio y autorizo.
 *  - NO guarda nada. El cuerpo vive en memoria el tiempo de una peticion; no
 *    va a data/, no va a cache/, y NO VA A LA RESPUESTA. Lo que vuelve es la
 *    lectura. Que la respuesta no contenga el texto leido es una prueba de
 *    scripts/probar-analisis.cjs, no una intencion.
 *  - SI resuelve el token opaco bajo demanda cuando el archivo aun no conoce
 *    el enlace editorial. Es distinto del pipeline: alla el token rota entre
 *    corridas y resolverlo cambiaria el `url` de una nota ya guardada. Aqui la
 *    resolucion ocurre despues de confirmar y no se guarda ninguna nota.
 *  - NO cruza tono con figura (regla 5 de PRODUCT.md). El prompt lo prohibe.
 *
 * `solicitar` se inyecta, como en lib/garitas/cbp.ts y lib/busqueda/
 * google-noticias.ts, para que scripts/probar-analisis.cjs pruebe la ruta
 * entera sin red y sin gastar una llamada de pago.
 */

/** Un dia. Una nota publicada no cambia, y la segunda persona que pulse el
 *  boton sobre el mismo titular no debe costar otra llamada al modelo. */
export const CACHE_ANALISIS = "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

const MS_LIMITE_MEDIO = 8000;
const MS_LIMITE_MODELO = 25000;
const MAX_BYTES = 1_500_000;
const MODELO = "claude-haiku-4-5-20251001";
const AGENTE = "PulsoN33/1.0 (+lectura automatica de una nota enlazada)";

const SISTEMA = [
  "Eres un lector de prensa regional del corredor Tijuana-San Diego.",
  "Recibes el texto de UNA nota y preparas una ficha breve en ESPAÑOL para una mesa de noticias, aunque la nota esté en inglés.",
  "Reglas:",
  "- No afirmes nada que no esté en el texto. Si el texto no alcanza, dilo.",
  "- No atribuyas postura, intención ni opinión a ninguna persona nombrada. Describe lo que la nota reporta, no lo que sugiere sobre alguien.",
  "- No cites mas de ocho palabras seguidas del original.",
  "- No opines sobre el medio ni sobre su linea editorial.",
  "- Escribe en prosa llana, sin adjetivos de color ni lenguaje sensacionalista.",
  "- La lectura es un resumen de mesa, NO un guion para leer al aire.",
  "- Ordena los puntos por importancia. Incluye quién, qué, dónde, cuándo, cifras y qué sigue solo cuando la nota lo establezca.",
  REGLA_FORMATO,
  "- No inventes citas, imágenes, video, reacciones del público ni material que la nota no diga que existe.",
  "Qué va en cada campo de la respuesta:",
  '{"lectura":"<2 a 3 frases neutrales>","puntos":["<dato prioritario>","..."],"salvedad":"<qué NO establece la nota>","sugerenciaSocial":{"formato":"<uno de la lista>","enfoque":"<ángulo editorial sustentado>","gancho":"<gancho factual, no sensacionalista>"}}',
  "Entre 3 y 5 puntos. Todos los campos deben tener texto.",
].join("\n");

/**
 * La forma de la respuesta, impuesta por la API (salidas estructuradas) en vez
 * de pedida en el prompt y rescatada despues de vallas y texto alrededor. Lo
 * que un esquema no expresa —texto no vacio, cuantos elementos— lo sigue
 * revisando `leerSalida`, y las reglas 1 y 2 `reglas.ts`.
 */
const ESQUEMA = {
  type: "object",
  properties: {
    lectura: { type: "string" },
    puntos: { type: "array", items: { type: "string" } },
    salvedad: { type: "string" },
    sugerenciaSocial: {
      type: "object",
      properties: { formato: { type: "string", enum: NOMBRES_FORMATO }, enfoque: { type: "string" }, gancho: { type: "string" } },
      required: ["formato", "enfoque", "gancho"],
      additionalProperties: false,
    },
  },
  required: ["lectura", "puntos", "salvedad", "sugerenciaSocial"],
  additionalProperties: false,
} as const;

function fallo(mensaje: string, codigo: string): Response {
  return json({ codigo, mensaje }, 200, SIN_CACHE);
}

function mensajeEnlace(medio: string): string {
  return medio === ""
    ? "Esta nota no se puede abrir desde aquí."
    : `Esta nota de ${medio} no se puede abrir desde aquí.`;
}

function registrarFalloEnlace(r: Extract<ResultadoEnlace, { ok: false }>): void {
  console.warn(
    `[analisis:enlace] etapa=${r.etapa} estado=${r.estado ?? "s/d"} host=${r.host ?? "s/d"}`,
  );
}

/** El JSON del modelo. La forma la fija `ESQUEMA`; esto revisa lo que el
 *  esquema no puede: campos vacios y cuantos puntos. */
function leerSalida(crudo: string): LecturaAnalisis | null {
  try {
    const o = JSON.parse(crudo) as Record<string, unknown>;
    const lectura = typeof o.lectura === "string" ? o.lectura.trim() : "";
    const salvedad = typeof o.salvedad === "string" ? o.salvedad.trim() : "";
    if (!Array.isArray(o.puntos) || !o.puntos.every((p) => typeof p === "string" && p.trim() !== "")) return null;
    const puntos = o.puntos.map((p) => p.trim());
    const social = o.sugerenciaSocial;
    if (social === null || typeof social !== "object" || Array.isArray(social)) return null;
    const campos = social as Record<string, unknown>;
    const sugerenciaSocial: SugerenciaSocial = {
      formato: typeof campos.formato === "string" ? campos.formato.trim() : "",
      enfoque: typeof campos.enfoque === "string" ? campos.enfoque.trim() : "",
      gancho: typeof campos.gancho === "string" ? campos.gancho.trim() : "",
    };
    if (
      lectura === "" || salvedad === "" || puntos.length < 3 || puntos.length > 5
      || formatoSocial(sugerenciaSocial.formato) === null || sugerenciaSocial.enfoque === "" || sugerenciaSocial.gancho === ""
    ) return null;
    return { lectura, puntos, salvedad, sugerenciaSocial };
  } catch {
    return null;
  }
}

export async function responderAnalisis(
  params: { u: string | null; m: string | null; d: string | null },
  solicitar: typeof fetch = fetch,
): Promise<Response> {
  if (!analisisHabilitado()) {
    return json(
      { codigo: "apagado", mensaje: "La lectura automática no está disponible." },
      400,
      SIN_CACHE,
    );
  }

  const medio = (params.m ?? "").slice(0, 120);
  const resuelto = await resolverEnlace(params.u, params.d, solicitar);
  if (!resuelto.ok) {
    if (resuelto.codigo === "url") {
      return json({ codigo: "url", mensaje: "Ese enlace no se puede leer." }, 400, SIN_CACHE);
    }
    registrarFalloEnlace(resuelto);
    return fallo(mensajeEnlace(medio), "enlace");
  }
  const url = resuelto.url;
  if (urlSegura(url.toString()) === null) {
    return json({ codigo: "url", mensaje: "Ese enlace no se puede leer." }, 400, SIN_CACHE);
  }

  let texto: string;
  try {
    const r = await solicitar(url.toString(), {
      headers: { "User-Agent": AGENTE, Accept: "text/html,application/xhtml+xml" },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(MS_LIMITE_MEDIO),
    });
    if (!r.ok) return fallo("El medio no entregó la nota.", "medio");
    if (r.url !== "") {
      const final = urlSegura(r.url);
      if (final === null || dominioDeUrl(final) !== resuelto.dominio) {
        registrarFalloEnlace({
          ok: false,
          codigo: "enlace",
          etapa: "destino",
          estado: r.status,
          host: resuelto.dominio,
        });
        return fallo(mensajeEnlace(medio), "enlace");
      }
    }
    texto = extraerTexto((await r.text()).slice(0, MAX_BYTES));
  } catch {
    return fallo("El medio no entregó la nota.", "medio");
  }

  // Menos que esto no es una nota: es un muro de suscripcion, una pagina de
  // consentimiento o un video sin transcripcion. Decirlo es mas util que
  // mandarselo al modelo y publicar lo que invente con tres frases.
  if (texto.length < 400) {
    return fallo("No hay suficiente texto en la nota para leerla.", "corta");
  }

  let cuerpo: unknown;
  try {
    const r = await solicitar("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(MS_LIMITE_MODELO),
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 900,
        system: SISTEMA,
        output_config: { format: { type: "json_schema", schema: ESQUEMA } },
        messages: [{ role: "user", content: `Medio: ${medio || "sin dato"}\n\n${texto}` }],
      }),
    });
    if (!r.ok) return fallo("No se pudo hacer la lectura.", "modelo");
    cuerpo = await r.json();
  } catch {
    return fallo("No se pudo hacer la lectura.", "modelo");
  }

  const bloques = (cuerpo as { content?: { type?: string; text?: string }[] }).content ?? [];
  const crudo = bloques.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  const analisis = leerSalida(crudo);
  if (analisis === null) return fallo("No se pudo hacer la lectura.", "modelo");

  return json({ ...analisis, medio }, 200, CACHE_ANALISIS);
}
