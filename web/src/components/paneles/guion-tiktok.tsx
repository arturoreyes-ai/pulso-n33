"use client";

import { Check as Hecho, Copy as Copiar, Microphone as Locucion } from "@phosphor-icons/react";
import { useId, useState } from "react";
import useSWRImmutable from "swr/immutable";

import { clasesBoton } from "@/components/ui/clases";
import { EstadoCarga } from "@/components/ui/estado-carga";
import {
  NOMBRE_PROGRAMA,
  PROGRAMAS_GUION,
  VERSION_GUION_TIKTOK,
  type ClipGuion,
  type GuionTikTok,
  type ProgramaGuion,
} from "@/lib/analisis/contrato-publicacion";

/**
 * Guion para locucion: lo primero de la pestana TikTok, con un boton por
 * programa del canal. Reemplazo el 24 de septiembre de 2026 al «Resumen con
 * IA», que se pedia solo al abrir la pestana; el cliente cambio el foco a un
 * texto que un conductor memoriza y dice, con las reglas de extraccion de la
 * hora de edicion (lib/analisis/guion-tiktok.ts las escribe).
 *
 * NADA SE PIDE SIN PULSAR. La tarjeta monta con los dos botones y nada mas: el
 * primer video asoma debajo en la misma pantalla, como con el resumen
 * plegado. Pulsar un programa pide su guion; el otro queda en la cache de SWR
 * si ya se pidio, asi que ir y volver entre los dos no vuelve a pagar. Sin
 * `shouldRetryOnError: false` SWR reintentaria sola una llamada de pago.
 *
 * EL GUION ES PARA DECIRSE, y eso decide la tipografia, la de un guion de
 * television: lo que el conductor dice va en cuerpo de lectura y tinta de
 * titulo (apertura, entrada, salida, cierre); las acotaciones —el eje, el
 * titular de escaleta, el pase y la marca del clip— van en pequeño y en tinta
 * de meta, porque se leen pero no se dicen igual. El pase va en cursiva: es
 * la frase que da paso, dicha, pero corta. La marca del clip es el boton del
 * video que se extrae, y lleva a SU tarjeta del recorrido (o al original si no
 * esta en la vista).
 * «Copiar guion» deja el texto entero en el portapapeles, con el enlace de
 * cada video, para el equipo que edita.
 *
 * Un eje sin videos se dice en una linea («Sin videos hoy: Garitas»). Es un
 * hueco medido por el codigo, no un clip vacio ni uno de otro eje.
 */

type Respuesta = { fase: "listo"; guion: GuionTikTok } | { fase: "fallo"; mensaje: string };

/** La pastilla del video: la de la fuente del resumen, con los 44px de alto
 *  del blanco de toque. */
const CLASES_FUENTE = [
  "inline-flex min-h-11 items-center justify-center rounded-full bg-vela px-4 text-meta text-tinta-prosa",
  "transition-[color,background-color,scale] duration-[var(--dur-toque)] ease-out active:scale-[0.97] hover:bg-filo hover:text-tinta-titulo",
].join(" ");

export function GuionTikTokBloque({ generado, irA }: {
  /** El corte del archivo: separa copias en el CDN y en SWR. */
  generado: string;
  /** Lleva el recorrido a la tarjeta de esa `clave`; false si no esta. */
  irA: (clave: string) => boolean;
}) {
  const id = useId();
  const [programa, setPrograma] = useState<ProgramaGuion | null>(null);

  return (
    <section aria-labelledby={`${id}-titulo`} className="mx-auto grid w-full max-w-[72ch] gap-4 text-lectura text-tinta-prosa">
      <header className="grid gap-1">
        <h2 id={`${id}-titulo`} className="flex items-center gap-2 text-rotulo text-tinta-titulo">
          <Locucion size={22} weight="light" aria-hidden className="shrink-0" />
          Guion para locución
        </h2>
        <p className="text-meta text-tinta-meta">Con los videos de TikTok de las últimas 24 horas</p>
      </header>

      <div role="group" aria-label="Programa" className="flex flex-wrap gap-2">
        {PROGRAMAS_GUION.map((p) => (
          <button key={p} type="button" className={clasesBoton(p === programa)} aria-pressed={p === programa}
            onClick={() => setPrograma(p)}>
            {NOMBRE_PROGRAMA[p]}
          </button>
        ))}
      </div>

      {programa === null ? null : <Guion key={programa} programa={programa} generado={generado} irA={irA} />}
    </section>
  );
}

function Guion({ programa, generado, irA }: { programa: ProgramaGuion; generado: string; irA: (clave: string) => boolean }) {
  const params = new URLSearchParams({ v: VERSION_GUION_TIKTOK, p: programa, g: generado });
  const { data, error, mutate, isValidating } = useSWRImmutable<Respuesta>(
    `/api/guion-tiktok?${params}`, pedirGuion, { shouldRetryOnError: false });
  const cargando = (data === undefined && error === undefined) || isValidating;
  const falla = error !== undefined ? "No se pudo preparar el guion." : data?.fase === "fallo" ? data.mensaje : null;
  const guion = !cargando && data?.fase === "listo" ? data.guion : null;

  if (cargando) return <EstadoCarga etiqueta="Escribiendo el guion" />;
  if (falla !== null || guion === null) {
    return (
      <div className="aparicion-suave grid justify-items-start gap-3">
        <p role="status" className="text-baja">{falla ?? "No se pudo preparar el guion."}</p>
        <button type="button" className={clasesBoton(false)} onClick={() => void mutate()}>Reintentar</button>
      </div>
    );
  }
  return (
    <div className="aparicion-suave grid gap-6">
      <Parlamento rotulo="Apertura" texto={guion.apertura} />
      <ol className="grid gap-8">
        {guion.clips.map((clip, i) => <Clip key={i} n={i + 1} clip={clip} irA={irA} />)}
      </ol>
      <Parlamento rotulo="Cierre" texto={guion.cierre} />
      {guion.faltantes.length === 0 ? null : (
        <p className="text-meta text-tinta-meta">Sin videos hoy: {guion.faltantes.join(", ")}.</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-filo pt-3">
        <p className="text-meta text-tinta-meta">Generado con IA.</p>
        <BotonCopiar texto={textoPlano(guion)} />
      </div>
    </div>
  );
}

/** Lo que el conductor dice, con su rotulo de acotacion encima. */
function Parlamento({ rotulo, texto }: { rotulo: string; texto: string }) {
  return (
    <div className="grid gap-1">
      <p className="text-meta text-tinta-meta">{rotulo}</p>
      <p className="break-words text-tinta-titulo">{texto}</p>
    </div>
  );
}

function Clip({ n, clip, irA }: { n: number; clip: ClipGuion; irA: (clave: string) => boolean }) {
  return (
    <li className="grid gap-3">
      <div className="grid gap-1">
        <p className="text-meta text-tinta-meta">
          Clip {n} · {clip.eje}{clip.libre ? " · libre" : ""}
        </p>
        <h3 className="text-cuerpo font-medium text-tinta-prosa">{clip.titular}</h3>
      </div>
      <p className="break-words text-tinta-titulo">{clip.entrada}</p>
      <p className="break-words italic text-tinta-prosa">{clip.pase}</p>
      <span>
        <button type="button" className={CLASES_FUENTE} aria-label={`Ir al video de ${clip.fuente.fuente}`}
          onClick={() => {
            if (!irA(`tiktok:${clip.fuente.url}`)) window.open(clip.fuente.url, "_blank", "noopener,noreferrer");
          }}>
          Clip: {clip.fuente.fuente}
        </button>
      </span>
      <p className="break-words text-tinta-titulo">{clip.salida}</p>
    </li>
  );
}
function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button type="button" className={clasesBoton(false)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          window.setTimeout(() => setCopiado(false), 2000);
        } catch {
          setCopiado(false);
        }
      }}>
      {copiado ? <Hecho size={16} aria-hidden /> : <Copiar size={16} aria-hidden />}
      <span aria-live="polite">{copiado ? "Copiado" : "Copiar guion"}</span>
    </button>
  );
}

/** El guion como texto para la mesa de edicion, con las acotaciones entre
 *  corchetes a la manera de un guion de television, y el enlace de cada video
 *  que se extrae. */
function textoPlano(guion: GuionTikTok): string {
  const clips = guion.clips.map((c, i) => [
    `CLIP ${i + 1} · ${c.eje}${c.libre ? " · libre" : ""} · ${c.titular}`,
    c.entrada,
    c.pase,
    `[CLIP: ${c.fuente.fuente} ${c.fuente.url}]`,
    c.salida,
  ].join("\n\n"));
  const faltan = guion.faltantes.length === 0 ? [] : [`Sin videos hoy: ${guion.faltantes.join(", ")}.`];
  return [
    NOMBRE_PROGRAMA[guion.programa],
    `[APERTURA]\n\n${guion.apertura}`,
    ...clips,
    `[CIERRE]\n\n${guion.cierre}`,
    ...faltan,
  ].join("\n\n---\n\n");
}

async function pedirGuion(url: string): Promise<Respuesta> {
  const r = await fetch(url);
  const cuerpo = (await r.json()) as unknown;
  const guion = leerGuion(cuerpo);
  return guion !== null ? { fase: "listo", guion } : { fase: "fallo", mensaje: mensajeDeError(cuerpo) };
}

function mensajeDeError(valor: unknown): string {
  if (valor !== null && typeof valor === "object" && "mensaje" in valor && typeof valor.mensaje === "string") {
    return valor.mensaje;
  }
  return "No se pudo preparar el guion.";
}

/** Estricto a proposito: una respuesta con otra forma se pinta como fallo,
 *  nunca a medias. */
function leerGuion(valor: unknown): GuionTikTok | null {
  if (valor === null || typeof valor !== "object") return null;
  const a = valor as Record<string, unknown>;
  const programa = PROGRAMAS_GUION.find((p) => p === a.programa);
  if (programa === undefined || !Array.isArray(a.clips) || !Array.isArray(a.faltantes) || typeof a.videos !== "number"
    || typeof a.apertura !== "string" || typeof a.cierre !== "string") return null;
  if (!a.faltantes.every((f) => typeof f === "string")) return null;
  const clips: ClipGuion[] = [];
  for (const c of a.clips as unknown[]) {
    if (c === null || typeof c !== "object") return null;
    const r = c as Record<string, unknown>;
    const f = r.fuente as Record<string, unknown> | null | undefined;
    if (typeof r.eje !== "string" || typeof r.libre !== "boolean" || typeof r.titular !== "string"
      || typeof r.entrada !== "string" || typeof r.pase !== "string" || typeof r.salida !== "string"
      || f === null || typeof f !== "object" || typeof f.url !== "string" || typeof f.fuente !== "string") return null;
    clips.push({
      eje: r.eje, libre: r.libre, titular: r.titular, entrada: r.entrada, pase: r.pase, salida: r.salida,
      fuente: { url: f.url, fuente: f.fuente },
    });
  }
  if (clips.length === 0) return null;
  return { programa, apertura: a.apertura, clips, cierre: a.cierre, faltantes: a.faltantes as string[], videos: a.videos };
}
