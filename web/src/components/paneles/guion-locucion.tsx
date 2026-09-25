"use client";

import { ArrowsOutSimple as Ampliar, Check as Hecho, Copy as Copiar, DownloadSimple as Descargar, Microphone as Locucion } from "@phosphor-icons/react";
import { useId, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import useSWRImmutable from "swr/immutable";

import { clasesBoton } from "@/components/ui/clases";
import { EstadoCarga } from "@/components/ui/estado-carga";
import {
  NOMBRE_EJE,
  NOMBRE_PROGRAMA,
  ORIGENES_GUION,
  PROGRAMAS_GUION,
  VERSION_GUION,
  type ClipGuion,
  type Guion,
  type OrigenGuion,
  type ProgramaGuion,
} from "@/lib/analisis/contrato-guion";
import { piezaDeGaritas } from "@/lib/analisis/nota-garitas";
import type { RespuestaGaritas } from "@/lib/garitas/tipos";

/**
 * Guion para locucion, con un boton por programa del canal. Vive en dos
 * lugares: primero en la pestana TikTok de Redes (desde el 24 de septiembre de
 * 2026, cuando reemplazo al «Resumen con IA»), y desde el 25 en una hoja de la
 * portada, sobre los titulares en vivo. Los guiones los escriben
 * lib/analisis/guion-tiktok.ts y lib/analisis/guion-prensa.ts con las reglas
 * de cada programa.
 *
 * NADA SE PIDE SIN PULSAR. La tarjeta monta con los botones y nada mas: en
 * TikTok el primer video asoma debajo en la misma pantalla. Pulsar un programa
 * pide su guion; los otros quedan en la cache de SWR si ya se pidieron, asi
 * que ir y volver entre ellos no vuelve a pagar. Sin `shouldRetryOnError:
 * false` SWR reintentaria sola una llamada de pago.
 *
 * LA LLAVE. En TikTok es el corte del archivo (`generado`), que cambia con el
 * cron. En prensa no hay corte: los titulares son en vivo, asi que la llave es
 * la HORA en que se pulso, y la ruta cachea una hora. Pulsar el mismo programa
 * dentro de la hora lee la copia; a la hora siguiente, titulares nuevos.
 *
 * LAS GARITAS LAS PONE ESTA TARJETA, no la ruta (25 de septiembre de 2026). En
 * Noticias 33 la primera nota son los tiempos de /api/garitas, armados con
 * lib/analisis/nota-garitas.ts al mostrarse el guion: el guion pagado se
 * cachea una hora en prensa y seis en TikTok, y una espera dicha con ese
 * atraso es falsa. /api/garitas es gratis. Si CBP no responde o no trae una
 * cifra al dia, la nota no sale y se dice «No se pudieron leer: Garitas».
 *
 * «AMPLIAR», en cada nota de prensa (el mismo dia): lee esa nota entera y la
 * reescribe para decirse (lib/analisis/ampliar.ts), con un boton por nota y
 * nunca solo. Es la excepcion de Analizar: una nota por pulsacion. La nota
 * ampliada reemplaza a la corta en pantalla, al copiar y al descargar.
 *
 * EL GUION ES PARA DECIRSE, y eso decide la tipografia, la de un guion de
 * television: lo que el conductor dice va en cuerpo de lectura y tinta de
 * titulo (apertura, entrada, salida, pregunta a la mesa, cierre); las
 * acotaciones —el eje, el titular de escaleta, el pase y la marca del clip—
 * van en pequeño y en tinta de meta, porque se leen pero no se dicen igual. El
 * pase va en cursiva: es la frase que da paso, dicha, pero corta. En TikTok la
 * marca del clip es el boton del video que se extrae, y lleva a SU tarjeta del
 * recorrido (o al original si no esta en la vista): es para el equipo, y el
 * guion ya no dice la cuenta. Una nota leida —en prensa, y la de garitas en los
 * dos— termina con «Abrir en <medio>», o «Abrir Garitas», que es nuestra.
 * «Copiar guion» deja el texto entero en el portapapeles, con el enlace de
 * cada pieza, para el equipo que edita; «Descargar» lo deja en un .txt, para
 * que el conductor lo edite con su propio giro (25 de septiembre de 2026, a
 * pedido del cliente). Es el mismo texto, y no nombra medios.
 *
 * Un eje sin material se dice en una linea («Sin videos hoy: California»). Es
 * un hueco medido por el codigo, no un clip vacio ni uno de otro eje. Uno que
 * no se pudo leer se dice aparte y como falla («No se pudieron leer: ...»).
 */

type Respuesta = { fase: "listo"; guion: Guion } | { fase: "fallo"; mensaje: string };
type RespuestaAmpliada = { fase: "listo"; entrada: string } | { fase: "fallo"; mensaje: string };
type Cache = ReturnType<typeof useSWRConfig>["cache"];

/** La pastilla de la fuente: la del resumen, con los 44px de alto del blanco
 *  de toque. */
const CLASES_FUENTE = [
  "inline-flex min-h-11 items-center justify-center rounded-full bg-vela px-4 text-meta text-tinta-prosa",
  "transition-[color,background-color,scale] duration-[var(--dur-toque)] ease-out active:scale-[0.97] hover:bg-filo hover:text-tinta-titulo",
].join(" ");

const MATERIAL: Record<OrigenGuion, { subtitulo: string; vacio: string }> = {
  tiktok: { subtitulo: "Con los videos de TikTok de las últimas 24 horas", vacio: "Sin videos hoy" },
  prensa: { subtitulo: "Con los titulares en vivo de las últimas 24 horas", vacio: "Sin notas hoy" },
};

/** La hora UTC en que se pulso, como llave: «2026-09-25T18». */
const horaActual = () => new Date().toISOString().slice(0, 13);

/**
 * Las garitas con la llave y la forma de /garitas (tablero-garitas.tsx): si ya
 * se leyeron en esta visita, SWR las tiene. Una lectura al montar y ninguna al
 * volver el foco: el texto no se mueve bajo quien lo esta leyendo.
 */
async function consultarGaritas(ruta: string): Promise<RespuestaGaritas> {
  const respuesta = await fetch(ruta);
  if (!respuesta.ok) throw new Error("CBP no disponible");
  return respuesta.json();
}
const OPCIONES_GARITAS = { revalidateOnMount: true, revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false } as const;

export function GuionLocucion({ origen, corte, irA, encabezado = true }: {
  origen: OrigenGuion;
  /** TikTok: el `generado` del archivo, que separa copias en el CDN y en SWR.
   *  Prensa: se omite, y la llave es la hora en que se pulsa. */
  corte?: string;
  /** TikTok: lleva el recorrido a la tarjeta de esa `clave`; false si no esta. */
  irA?: (clave: string) => boolean;
  /** En una hoja el titulo ya lo pone la hoja. */
  encabezado?: boolean;
}) {
  const id = useId();
  const [pedido, setPedido] = useState<{ programa: ProgramaGuion; corte: string } | null>(null);

  return (
    <section aria-labelledby={encabezado ? `${id}-titulo` : undefined} aria-label={encabezado ? undefined : "Guion para locución"}
      className="mx-auto grid w-full max-w-[72ch] gap-4 text-lectura text-tinta-prosa">
      <header className="grid gap-1">
        {encabezado ? (
          <h2 id={`${id}-titulo`} className="flex items-center gap-2 text-rotulo text-tinta-titulo">
            <Locucion size={22} weight="light" aria-hidden className="shrink-0" />
            Guion para locución
          </h2>
        ) : null}
        <p className="text-meta text-tinta-meta">{MATERIAL[origen].subtitulo}</p>
      </header>

      <div role="group" aria-label="Programa" className="flex flex-wrap gap-2">
        {PROGRAMAS_GUION.map((p) => (
          <button key={p} type="button" className={clasesBoton(p === pedido?.programa)} aria-pressed={p === pedido?.programa}
            onClick={() => setPedido({ programa: p, corte: corte ?? horaActual() })}>
            {NOMBRE_PROGRAMA[p]}
          </button>
        ))}
      </div>

      {pedido === null ? null : <GuionPrograma key={pedido.programa} origen={origen} programa={pedido.programa} corte={pedido.corte} irA={irA} />}
    </section>
  );
}

function GuionPrograma({ origen, programa, corte, irA }: { origen: OrigenGuion; programa: ProgramaGuion; corte: string; irA?: (clave: string) => boolean }) {
  const params = new URLSearchParams({ v: VERSION_GUION, p: programa, g: corte });
  const { data, error, mutate, isValidating } = useSWRImmutable<Respuesta>(
    `/api/guion-${origen}?${params}`, pedirGuion, { shouldRetryOnError: false });
  const conGaritas = programa === "noticias33";
  const garitas = useSWR<RespuestaGaritas>(conGaritas ? "/api/garitas" : null, consultarGaritas, OPCIONES_GARITAS);
  const { cache } = useSWRConfig();
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

  // La hora de referencia es la de la lectura de CBP, no la del reloj: una
  // cifra «al dia» lo es respecto de cuando se leyo.
  const leyendoGaritas = conGaritas && garitas.data === undefined && garitas.error === undefined;
  const notaGaritas = garitas.data === undefined ? null : piezaDeGaritas(garitas.data.cruces, Date.parse(garitas.data.consultado));
  const garitasSinLeer = conGaritas && !leyendoGaritas && notaGaritas === null;
  const primera = conGaritas && !garitasSinLeer ? 2 : 1;
  const sinLeer = garitasSinLeer ? [NOMBRE_EJE.garitas, ...guion.sinLeer] : guion.sinLeer;
  /** El guion como se copia y se descarga: con la nota de garitas delante y
   *  las notas ampliadas en su lugar, tal como se ven al pulsar. */
  const compuesto = (): Guion => ({
    ...guion,
    clips: [
      ...(notaGaritas === null ? [] : [notaGaritas]),
      ...guion.clips.map((c) => {
        const ampliada = ampliadaEnCache(cache, programa, c);
        return ampliada === null ? c : { ...c, entrada: ampliada };
      }),
    ],
    sinLeer,
  });

  return (
    <div className="aparicion-suave grid gap-6">
      <Parlamento rotulo="Apertura" texto={guion.apertura} />
      <ol className="grid gap-8">
        {leyendoGaritas ? <li><EstadoCarga etiqueta="Leyendo las garitas" /></li> : null}
        {notaGaritas === null ? null : <Pieza n={1} origen={guion.origen} programa={programa} clip={notaGaritas} irA={irA} />}
        {guion.clips.map((clip, i) => <Pieza key={i} n={primera + i} origen={guion.origen} programa={programa} clip={clip} irA={irA} />)}
      </ol>
      <Parlamento rotulo="Cierre" texto={guion.cierre} />
      {guion.faltantes.length === 0 ? null : (
        <p className="text-meta text-tinta-meta">{MATERIAL[guion.origen].vacio}: {guion.faltantes.join(", ")}.</p>
      )}
      {sinLeer.length === 0 ? null : (
        <p className="text-meta text-baja">No se pudieron leer: {sinLeer.join(", ")}.</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-filo pt-3">
        <p className="text-meta text-tinta-meta">Generado con IA.</p>
        <div className="flex flex-wrap gap-2">
          <BotonCopiar texto={() => textoPlano(compuesto())} />
          <button type="button" className={clasesBoton(false)} onClick={() => descargar(compuesto())}>
            <Descargar size={16} aria-hidden />
            Descargar
          </button>
        </div>
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

function Pieza({ n, origen, programa, clip, irA }: { n: number; origen: OrigenGuion; programa: ProgramaGuion; clip: ClipGuion; irA?: (clave: string) => boolean }) {
  const ampliada = useAmpliada(programa, clip);
  const entrada = ampliada.entrada ?? clip.entrada;
  const pregunta = clip.pregunta === null ? null : <Parlamento rotulo="A la mesa" texto={clip.pregunta} />;
  const leida = origen === "prensa" || propia(clip);
  return (
    <li className="grid gap-3">
      <div className="grid gap-1">
        <p className="text-meta text-tinta-meta">
          {leida ? "Nota" : "Clip"} {n} · {clip.eje}{clip.libre ? " · libre" : ""}{ampliada.entrada === null ? "" : " · ampliada"}
        </p>
        <h3 className="text-cuerpo font-medium text-tinta-prosa">{clip.titular}</h3>
      </div>
      <p className="break-words text-tinta-titulo">{entrada}</p>
      {ampliada.estado === "cargando" ? <EstadoCarga etiqueta="Leyendo la nota" /> : null}
      {ampliada.estado === "fallo" ? <p role="status" className="text-meta text-baja">{ampliada.mensaje}</p> : null}
      {leida ? <>
        <p className="break-words text-tinta-titulo">{clip.salida}</p>
        {pregunta}
        {/* `nofollow`: el enlace lo devolvio un buscador, como en la tarjeta
            del titular en vivo. La nota de garitas enlaza a /garitas, que es
            nuestra: ni `nofollow` ni «en». */}
        <div className="flex flex-wrap gap-2">
          {propia(clip) ? (
            <a href={clip.fuente.url} target="_blank" rel="noopener" className={CLASES_FUENTE}>
              Abrir {clip.fuente.fuente}
            </a>
          ) : (
            <a href={clip.fuente.url} target="_blank" rel="noopener noreferrer nofollow" className={CLASES_FUENTE}>
              Abrir en {clip.fuente.fuente}
            </a>
          )}
          {clip.ampliable === null || ampliada.estado === "listo" || ampliada.estado === "cargando" ? null : (
            <button type="button" className={clasesBoton(false)} onClick={ampliada.pedir}>
              <Ampliar size={16} aria-hidden />
              Ampliar
            </button>
          )}
        </div>
      </> : <>
        {clip.pase === null ? null : <p className="break-words italic text-tinta-prosa">{clip.pase}</p>}
        <span>
          <button type="button" className={CLASES_FUENTE} aria-label={`Ir al video de ${clip.fuente.fuente}`}
            onClick={() => {
              if (!irA?.(`tiktok:${clip.fuente.url}`)) window.open(clip.fuente.url, "_blank", "noopener,noreferrer");
            }}>
            Clip: {clip.fuente.fuente}
          </button>
        </span>
        <p className="break-words text-tinta-titulo">{clip.salida}</p>
        {pregunta}
      </>}
    </li>
  );
}

/** Una pieza que no salio de la lista del modelo sino del codigo: su enlace es
 *  una ruta nuestra, relativa. */
const propia = (clip: ClipGuion) => clip.fuente.url.startsWith("/");

/** El enlace entero: en un .txt o en el portapapeles, «/garitas» no lleva a
 *  ninguna parte. */
const enlaceEntero = (url: string) => new URL(url, window.location.origin).href;

/**
 * Las notas que ya se pidieron ampliar en esta visita. SWR guarda la
 * respuesta; esto guarda que se pulso, para que al volver a un programa la
 * nota se pinte ampliada sin pulsar otra vez ni pagar.
 */
const PEDIDAS = new Set<string>();

function llaveAmpliar(programa: ProgramaGuion, clip: ClipGuion): string | null {
  const a = clip.ampliable;
  if (a === null) return null;
  return `/api/ampliar-nota?${new URLSearchParams({ v: VERSION_GUION, p: programa, u: a.url, d: a.dominio, m: clip.fuente.fuente, t: a.titulo })}`;
}

/** Nada se pide sin pulsar, y SWR no reintenta sola una llamada de pago. */
function useAmpliada(programa: ProgramaGuion, clip: ClipGuion) {
  const llave = llaveAmpliar(programa, clip);
  const [pedida, setPedida] = useState(() => llave !== null && PEDIDAS.has(llave));
  const { data, error, isValidating, mutate } = useSWRImmutable<RespuestaAmpliada>(
    pedida ? llave : null, pedirAmpliada, { shouldRetryOnError: false });
  const estado = !pedida ? "quieto"
    : (data === undefined && error === undefined) || isValidating ? "cargando"
      : data?.fase === "listo" ? "listo" : "fallo";
  return {
    estado,
    entrada: estado === "listo" && data?.fase === "listo" ? data.entrada : null,
    mensaje: data?.fase === "fallo" ? data.mensaje : "No se pudo ampliar la nota.",
    pedir: () => {
      if (llave === null) return;
      PEDIDAS.add(llave);
      if (pedida) void mutate();
      else setPedida(true);
    },
  };
}

function ampliadaEnCache(cache: Cache, programa: ProgramaGuion, clip: ClipGuion): string | null {
  const llave = llaveAmpliar(programa, clip);
  if (llave === null || !PEDIDAS.has(llave)) return null;
  const guardada = cache.get(llave)?.data as RespuestaAmpliada | undefined;
  return guardada?.fase === "listo" ? guardada.entrada : null;
}

async function pedirAmpliada(url: string): Promise<RespuestaAmpliada> {
  const r = await fetch(url);
  const cuerpo = (await r.json()) as unknown;
  if (cuerpo !== null && typeof cuerpo === "object" && "entrada" in cuerpo && typeof cuerpo.entrada === "string" && cuerpo.entrada !== "") {
    return { fase: "listo", entrada: cuerpo.entrada };
  }
  return { fase: "fallo", mensaje: mensajeDeError(cuerpo, "No se pudo ampliar la nota.") };
}

function BotonCopiar({ texto }: { texto: () => string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button type="button" className={clasesBoton(false)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto());
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
 *  corchetes a la manera de un guion de television, y el enlace de cada pieza:
 *  el video que se extrae, o la nota. El enlace va sin el nombre del medio: el
 *  guion no cita fuentes, y el enlace es para leer la nota, no para decirla. */
function textoPlano(guion: Guion): string {
  const piezas = guion.clips.map((c, i) => {
    const clip = guion.origen === "tiktok" && !propia(c);
    return [
      `${clip ? "CLIP" : "NOTA"} ${i + 1} · ${c.eje}${c.libre ? " · libre" : ""} · ${c.titular}`,
      c.entrada,
      ...(clip ? [...(c.pase === null ? [] : [c.pase]), `[CLIP: ${c.fuente.fuente} ${c.fuente.url}]`, c.salida] : [c.salida]),
      ...(c.pregunta === null ? [] : [`[A LA MESA]\n\n${c.pregunta}`]),
      ...(clip ? [] : [`[ENLACE: ${enlaceEntero(c.fuente.url)}]`]),
    ].join("\n\n");
  });
  const huecos = [
    ...(guion.faltantes.length === 0 ? [] : [`${MATERIAL[guion.origen].vacio}: ${guion.faltantes.join(", ")}.`]),
    ...(guion.sinLeer.length === 0 ? [] : [`No se pudieron leer: ${guion.sinLeer.join(", ")}.`]),
  ];
  return [
    NOMBRE_PROGRAMA[guion.programa],
    `[APERTURA]\n\n${guion.apertura}`,
    ...piezas,
    `[CIERRE]\n\n${guion.cierre}`,
    ...huecos,
  ].join("\n\n---\n\n");
}

/** La fecha de Tijuana, que es la del programa: «2026-09-25». */
const FECHA_ARCHIVO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tijuana", year: "numeric", month: "2-digit", day: "2-digit" });

/**
 * El guion en un .txt: «guion-noticias-33-2026-09-25.txt». Texto plano y no un
 * .docx porque abre igual en Word, Docs, el Bloc de notas y el teleprompter, y
 * no pide una dependencia. Con BOM: sin el, Word en Windows puede tomarlo por
 * Windows-1252 y partir la «ñ» de «mañanera» en dos letras.
 */
function descargar(guion: Guion) {
  const nombre = NOMBRE_PROGRAMA[guion.programa].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const archivo = new Blob(["\uFEFF", textoPlano(guion), "\n"], { type: "text/plain;charset=utf-8" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = `guion-${nombre}-${FECHA_ARCHIVO.format(new Date())}.txt`;
  enlace.click();
  // Despues del clic y no en el mismo turno: revocar antes de que la descarga
  // arranque puede cancelarla.
  window.setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}

async function pedirGuion(url: string): Promise<Respuesta> {
  const r = await fetch(url);
  const cuerpo = (await r.json()) as unknown;
  const guion = leerGuion(cuerpo);
  return guion !== null ? { fase: "listo", guion } : { fase: "fallo", mensaje: mensajeDeError(cuerpo) };
}

function mensajeDeError(valor: unknown, porOmision = "No se pudo preparar el guion."): string {
  if (valor !== null && typeof valor === "object" && "mensaje" in valor && typeof valor.mensaje === "string") {
    return valor.mensaje;
  }
  return porOmision;
}

const cadenas = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const cadenaONulo = (v: unknown): v is string | null => v === null || typeof v === "string";

/** `ampliable`, o undefined si no tiene la forma: null es valido. */
function leerAmpliable(v: unknown): ClipGuion["ampliable"] | undefined {
  if (v === null) return null;
  if (v === undefined || typeof v !== "object") return undefined;
  const a = v as Record<string, unknown>;
  return typeof a.url === "string" && typeof a.dominio === "string" && typeof a.titulo === "string"
    ? { url: a.url, dominio: a.dominio, titulo: a.titulo }
    : undefined;
}

/** Estricto a proposito: una respuesta con otra forma se pinta como fallo,
 *  nunca a medias. */
function leerGuion(valor: unknown): Guion | null {
  if (valor === null || typeof valor !== "object") return null;
  const a = valor as Record<string, unknown>;
  const origen = ORIGENES_GUION.find((o) => o === a.origen);
  const programa = PROGRAMAS_GUION.find((p) => p === a.programa);
  if (origen === undefined || programa === undefined || !Array.isArray(a.clips) || !cadenas(a.faltantes) || !cadenas(a.sinLeer)
    || typeof a.leidos !== "number" || typeof a.apertura !== "string" || typeof a.cierre !== "string") return null;
  const clips: ClipGuion[] = [];
  for (const c of a.clips as unknown[]) {
    if (c === null || typeof c !== "object") return null;
    const r = c as Record<string, unknown>;
    const f = r.fuente as Record<string, unknown> | null | undefined;
    const ampliable = leerAmpliable(r.ampliable);
    if (typeof r.eje !== "string" || typeof r.libre !== "boolean" || typeof r.titular !== "string"
      || typeof r.entrada !== "string" || !cadenaONulo(r.pase) || typeof r.salida !== "string" || !cadenaONulo(r.pregunta)
      || f === null || typeof f !== "object" || typeof f.url !== "string" || typeof f.fuente !== "string" || ampliable === undefined) return null;
    clips.push({
      eje: r.eje, libre: r.libre, titular: r.titular, entrada: r.entrada, pase: r.pase, salida: r.salida, pregunta: r.pregunta,
      fuente: { url: f.url, fuente: f.fuente }, ampliable,
    });
  }
  if (clips.length === 0) return null;
  return { origen, programa, apertura: a.apertura, clips, cierre: a.cierre, faltantes: a.faltantes, sinLeer: a.sinLeer, leidos: a.leidos };
}
