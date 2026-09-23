import { createHash } from "node:crypto";

import type { Idioma } from "@/lib/busqueda/tipos";

/**
 * Cliente del servicio de tono (pulso/tono.py). Solo servidor.
 *
 * El tono de la busqueda en vivo lo pone el MISMO modelo que etiqueta la
 * prensa y los comentarios del pipeline, detras de HTTP: en local con
 * `python -m pulso tono --servir` y en Vercel como la funcion de Python de
 * servicio-tono/api/tono.py, un proyecto aparte del tablero. El motivo de no usar otro —un Claude, un ONNX reescrito—
 * esta en el encabezado de pulso/tono.py: dos instrumentos bajo la palabra
 * «positivo» harian que una ficha en seguimiento y una en vivo dijeran lo
 * mismo midiendo distinto.
 *
 * `null` es «no se pudo etiquetar» y NO «neutral»: quien llama lo cuenta como
 * `sin_clasificar`, que la ficha pinta como «sin tono». Degradar en silencio
 * a neutral inventaria una medida.
 *
 * El idioma lo DECLARA quien llama —la fila del medio, la edicion del
 * buscador—, nunca se adivina del texto. Solo se manda lo que el servicio
 * habla; lo demas vuelve `null` desde alla sin pasar por el modelo.
 */

export type Vocabulario = "prensa" | "comentarios";

/** Lo que una ruta necesita del servicio: inyectable en las pruebas. */
export interface ServicioTono {
  /** Una etiqueta por texto, en orden, o null si el servicio no respondio. */
  etiquetar(textos: readonly string[], vocabulario: Vocabulario, idioma: Idioma): Promise<(string | null)[] | null>;
  /** Pide al servicio que cargue el modelo; no espera la respuesta. */
  calentar(): void;
}

export function configuracionTono(entorno: NodeJS.ProcessEnv = process.env): { url: string; secreto: string } | null {
  const url = (entorno.TONO_URL ?? "").trim();
  const secreto = (entorno.TONO_SECRETO ?? "").trim();
  if (url === "" || secreto === "") return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && !(u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost"))) return null;
  } catch {
    return null;
  }
  return { url, secreto };
}

const CABECERA_SECRETO = "X-Tono-Secreto";
/**
 * Medido el 23 de septiembre de 2026, con el modelo tibio y en CPU: en local
 * 128 titulares en 10.9 s; en Vercel (pulso-tono) 100 en 12.1 s, unos 120 ms
 * por texto, y ~10 s de arranque en frio. Una busqueda pagada trae hasta ~300
 * comentarios, que en una sola peticion pasaban del limite y salian enteros
 * «sin tono». Por eso lotes de 100 y un limite por lote que cubre ademas el
 * arranque en frio.
 */
const MS_LIMITE = 40_000;
const TOPE_POR_PETICION = 100;

/**
 * Lo ya etiquetado en este proceso, por HUELLA del texto y no por el texto:
 * la busqueda pagada pregunta cada cinco segundos y cada vez vuelve a leer los
 * mismos comentarios, y etiquetarlos de nuevo es tiempo de CPU por nada. La
 * llave es sha256(vocabulario|idioma|texto), asi que la memoria del proceso
 * guarda etiquetas y no una palabra de lo que alguien escribio.
 */
const MEMORIA_MAXIMA = 20_000;
const memoria = new Map<string, string>();

function huella(texto: string, vocabulario: Vocabulario, idioma: Idioma): string {
  return createHash("sha256").update(`${vocabulario}|${idioma}|${texto}`, "utf8").digest("hex");
}

function recordar(llave: string, etiqueta: string): void {
  if (memoria.size >= MEMORIA_MAXIMA) {
    const primera = memoria.keys().next().value;
    if (primera !== undefined) memoria.delete(primera);
  }
  memoria.set(llave, etiqueta);
}

/** Un servicio que nunca responde: sin configuracion, todo sale sin tono. */
export const SIN_SERVICIO: ServicioTono = {
  etiquetar: async () => null,
  calentar: () => undefined,
};

export function servicioTono(entorno: NodeJS.ProcessEnv = process.env, solicitar: typeof fetch = fetch): ServicioTono {
  const config = configuracionTono(entorno);
  if (config === null) return SIN_SERVICIO;
  const cabeceras = { "Content-Type": "application/json", [CABECERA_SECRETO]: config.secreto };
  return {
    async etiquetar(textos, vocabulario, idioma) {
      if (textos.length === 0) return [];
      const llaves = textos.map((t) => huella(t, vocabulario, idioma));
      const salida: (string | null)[] = llaves.map((k) => memoria.get(k) ?? null);
      // Solo lo que no estaba, sin repetir: un mismo texto en dos posts se
      // etiqueta una vez.
      const faltan = [...new Set(llaves.filter((k) => !memoria.has(k)))];
      const textoDe = new Map(llaves.map((k, i) => [k, textos[i]!]));
      for (let i = 0; i < faltan.length; i += TOPE_POR_PETICION) {
        const lote = faltan.slice(i, i + TOPE_POR_PETICION);
        try {
          const r = await solicitar(config.url, {
            method: "POST",
            headers: cabeceras,
            body: JSON.stringify({ textos: lote.map((k) => textoDe.get(k)!), vocabulario, idioma }),
            cache: "no-store",
            signal: AbortSignal.timeout(MS_LIMITE),
          });
          if (!r.ok) return null;
          const cuerpo = (await r.json()) as { etiquetas?: unknown };
          if (!Array.isArray(cuerpo.etiquetas) || cuerpo.etiquetas.length !== lote.length) return null;
          cuerpo.etiquetas.forEach((e, j) => { if (typeof e === "string") recordar(lote[j]!, e); });
        } catch {
          return null;
        }
      }
      return llaves.map((k, i) => salida[i] ?? memoria.get(k) ?? null);
    },
    calentar() {
      // Sin await a proposito: el arranque en frio corre mientras las redes
      // tardan sus minutos, y quien calienta no espera nada.
      void solicitar(config.url, { headers: cabeceras, cache: "no-store", signal: AbortSignal.timeout(60_000) }).catch(() => undefined);
    },
  };
}
