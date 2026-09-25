import { json, SIN_CACHE } from "@/lib/busqueda/respuesta";
import { nombraAlguno } from "@/lib/busqueda/tema-publicacion";
import { leerNotaEnlazada } from "./analizar";
import { analisisHabilitado, MODELO_GUION } from "./config";
import { PROGRAMAS_GUION, type NotaAmpliada } from "./contrato-guion";
import { fallo, marcasDeMedio, quitarRelleno, sinEsfuerzo, sistemaAmpliar, TERMINOS_CONFERENCIA } from "./guion";
import { reglaRota } from "./reglas";

/**
 * «Ampliar»: UNA nota del guion de prensa, reescrita con la nota entera.
 *
 * EL CASO. El 25 de septiembre de 2026 la nota de Tijuana de Noticias 33
 * terminaba en «El medio no da mas detalles sobre el caso.»: el guion solo lee
 * titulares. El cliente pregunto cuanto costaria leer la nota completa, y de
 * tres opciones medidas eligio esta: un boton por nota, que lee solo esa. Leer
 * las notas de un guion al escribirlo costaba de 3 a 7 veces mas y era el
 * analisis en lote que la excepcion de Analizar prohibe por escrito.
 *
 * ES LA EXCEPCION DE ANALIZAR, no otra (AGENTS.md, «Legal boundaries»): una
 * nota, pedida con un boton, leida en memoria por `leerNotaEnlazada` —la misma
 * funcion, con las mismas guardas de enlace y de dominio— y nunca guardada. La
 * respuesta trae la nota reescrita y NUNCA el texto leido; probar-analisis.cjs
 * lo afirma. Lo que no se puede hacer con esto es ampliar todas las notas en
 * segundo plano: eso es el lote.
 *
 * LAS REGLAS DEL GUION, con el texto como material (guion.ts::sistemaAmpliar:
 * las mismas de decir y el tono del programa), y las mismas comprobaciones en
 * codigo: reglas.ts, el relleno, la mañanera y el medio. Aqui la mañanera se
 * compara con el titular Y con el texto, que en el guion no se tiene.
 *
 * El modelo es el del guion (MODELO_GUION), porque esto tambien se dice al
 * aire. Una nota de 8,000 caracteres son ~2,500 tokens: ~1 a 2 centavos.
 */

/** Un dia en el CDN, como Analizar: una nota publicada no cambia, y el segundo
 *  que pulse Ampliar sobre la misma nota del mismo programa no paga. Sin
 *  stale-while-revalidate, como el guion: revalidar seria pagar sin pulsar. */
export const CACHE_AMPLIAR = "public, max-age=0, s-maxage=86400";

const MS_LIMITE_MODELO = 40000;
const TOPE_TITULO = 300;
const NO_SE_PUDO = "No se pudo ampliar la nota.";

const ESQUEMA = {
  type: "object",
  properties: { entrada: { type: "string" } },
  required: ["entrada"],
  additionalProperties: false,
} as const;

export async function responderAmpliar(
  params: { p: string | null; u: string | null; m: string | null; d: string | null; t: string | null },
  solicitar: typeof fetch = fetch,
  /** Solo para comparar modelos a mano; la ruta usa siempre MODELO_GUION. */
  modelo: string = MODELO_GUION,
): Promise<Response> {
  if (!analisisHabilitado()) {
    return json({ codigo: "apagado", mensaje: "La nota ampliada no está disponible." }, 400, SIN_CACHE);
  }
  const programa = PROGRAMAS_GUION.find((p) => p === params.p);
  if (programa === undefined) return json({ codigo: "programa", mensaje: "Programa desconocido." }, 400, SIN_CACHE);
  const titulo = (params.t ?? "").trim().slice(0, TOPE_TITULO);
  if (titulo === "") return json({ codigo: "titulo", mensaje: "Falta el titular de la nota." }, 400, SIN_CACHE);

  const leida = await leerNotaEnlazada({ u: params.u, m: params.m, d: params.d }, solicitar);
  if (!leida.ok) return leida.respuesta;

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
        model: modelo,
        max_tokens: sinEsfuerzo(modelo) ? 1200 : 6000,
        system: sistemaAmpliar(programa),
        output_config: {
          format: { type: "json_schema", schema: ESQUEMA },
          ...(sinEsfuerzo(modelo) ? {} : { effort: "low" }),
        },
        // Sin el medio: el guion no lo cita, y lo que no se lee no se dice. El
        // texto lo trae a veces igual, y para eso esta la comprobacion de abajo.
        messages: [{ role: "user", content: `Titular: ${titulo}\n\nTexto de la nota:\n${leida.texto}` }],
      }),
    });
    if (!r.ok) return fallo(NO_SE_PUDO, "modelo");
    cuerpo = await r.json();
  } catch {
    return fallo(NO_SE_PUDO, "modelo");
  }

  const bloques = (cuerpo as { content?: { type?: string; text?: string }[] }).content ?? [];
  const crudo = bloques.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  let dicho = "";
  try {
    const o = JSON.parse(crudo) as Record<string, unknown>;
    dicho = typeof o.entrada === "string" ? o.entrada.trim() : "";
  } catch {
    return fallo(NO_SE_PUDO, "modelo");
  }
  if (reglaRota([dicho]) !== null) return fallo(NO_SE_PUDO, "reglas");
  const entrada = quitarRelleno(dicho);
  if (entrada === "") return fallo(NO_SE_PUDO, "modelo");
  // La mañanera que ni el titular ni la nota nombran: el caso de guion.ts.
  if (nombraAlguno(entrada, TERMINOS_CONFERENCIA) && !nombraAlguno(`${titulo}\n${leida.texto}`, TERMINOS_CONFERENCIA)) {
    return fallo(NO_SE_PUDO, "reglas");
  }
  // El guion no cita medios; el suyo solo si el titular mismo lo nombra.
  if (marcasDeMedio(leida.medio).some((m) => m.nombra(entrada) && !m.nombra(titulo))) return fallo(NO_SE_PUDO, "reglas");

  const nota: NotaAmpliada = { entrada };
  return json(nota, 200, CACHE_AMPLIAR);
}
