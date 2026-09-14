"use client";

import { useState } from "react";

import {
  useRedes,
  useRedesComentarios,
  useTikTok,
  useTikTokComentarios,
} from "@/lib/datos/hooks";
import type {
  ComentarioPublicado,
  Destacado,
  DocRedes,
  DocRedesComentarios,
  RedesCuenta,
} from "@/lib/datos/tipos";
import { fechaCorta, hora, numero, pluralizar } from "@/lib/dominio/formato";
import * as F from "@/lib/dominio/frases";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";
import { Bisel } from "@/components/ui/bisel";
import { Esqueleto, Hueco } from "@/components/ui/primitivas";

/**
 * El panel de redes: los posts con mas likes de la ventana y lo que la gente
 * comento en cada uno. Un solo componente para dos plataformas, porque el
 * contrato de datos es el mismo (pulso/redes.py) y lo que cambia cabe en un
 * descriptor: de donde se leen los archivos, como se llama la unidad, quien es
 * la fuente de cada fila, que zona tiene sentido y que dice el pie.
 *
 * Dos archivos por plataforma, con dos destinos distintos a proposito. El de
 * conteos viene de git y trae los posts con sus cifras; el de texto viene de
 * efimero/, FUERA de git, y puede faltar (un despliegue desde git puro no lo
 * tiene). Eso no es un error del panel: se dice una vez, arriba, y las filas
 * salen sin comentarios.
 *
 * Orden de lectura: el dia manda. `destacados` llega ordenado por likes,
 * porque asi se ELIGEN; aqui se agrupan por fecha, del mas reciente al mas
 * antiguo, y dentro del dia por hora exacta cuando la fila la trae
 * (`publicado`: TikTok siempre, Instagram desde el corte del 10 de septiembre
 * de 2026) y por likes cuando no. Es lo que pidio el cliente para las dos
 * plataformas.
 *
 * Nada aqui calcula un porcentaje. Con ~30 comentarios por post uno solo
 * mueve el numero, y el validador del pipeline rechaza porcentajes en
 * cualquier nivel.
 *
 * Lo de arriba es para quien mantiene el panel; NO se le dice al lector. Desde
 * el 13 de septiembre de 2026 las cadenas visibles dicen que se esta mirando y
 * que no afirma, nunca de donde salio. Las que se fueron llegaban a nombrar la
 * consulta literal de TikTok, git, el despliegue y a Apify; el caso que lo
 * disparo es la faceta de TikTok, que explicaba su regla de zona en la primera
 * linea. Ver `paginas/redes.tsx` para la regla completa.
 */

const TIPO: Record<Destacado["tipo"], string> = {
  imagen: "imagen",
  video: "video",
  carrusel: "carrusel",
  otro: "post",
};

interface Lector {
  data: DocRedes | undefined;
  error: unknown;
}
interface LectorTextos {
  data: DocRedesComentarios | undefined;
  error: unknown;
}

/** Lo que cambia entre Instagram y TikTok. Todo lo demas es el mismo panel. */
interface Plataforma {
  nombre: string;
  usarDatos: () => Lector;
  usarTextos: () => LectorTextos;
  unidad: [string, string];
  /** Titulo de una fila sin pie. */
  sinPie: string;
  /** Quien publico: la cuenta del medio (Instagram) o el @ del creador (TikTok). */
  fuente: (d: Destacado, nombres: Map<string, string>) => string;
  etiquetaZona: (zona: string) => string;
  /** Hay fuente para esta vista. Instagram: una cuenta con sede en la zona;
   *  TikTok: cualquier busqueda activa, porque la zona la da el video. */
  hayFuente: (cuentas: RedesCuenta[], zona: ZonaRuta | null) => boolean;
  ventana: (data: DocRedes) => string;
  cabeza: (v: Vista, data: DocRedes) => string;
  sinFuente: (nombre: string) => string;
  sinFilas: (nombre: string, ventana: string) => string;
  sinToken: string;
  pie: string;
}

/* La zona de un destacado es la sede de la cuenta (Instagram) o lo que nombra
   el pie (TikTok). `estatal` y `nacional` no tienen ruta y se rotulan. */
function nombreZona(z: string): string {
  return z in NOMBRE_CORTO ? NOMBRE_CORTO[z as ZonaRuta] : z;
}

const INSTAGRAM: Plataforma = {
  nombre: "Instagram",
  usarDatos: useRedes,
  usarTextos: useRedesComentarios,
  unidad: ["post", "posts"],
  sinPie: "Abrir en Instagram",
  fuente: (d, nombres) => nombres.get(d.cuenta) ?? d.cuenta,
  etiquetaZona: nombreZona,
  hayFuente: (cuentas, zona) =>
    zona === null ? cuentas.some((c) => c.activa) : cuentas.some((c) => c.zona === zona && c.activa),
  // Horas desde el corte del 10 de septiembre de 2026. Un corte anterior trae
  // `ventana_dias` y se describe como lo que es, no como 24 horas.
  ventana: (data) =>
    data.ventana_horas !== undefined
      ? `las últimas ${data.ventana_horas} horas`
      : `los últimos ${data.ventana_dias ?? 7} días`,
  cabeza: (v, data) =>
    v.esRegion
      ? `Los ${numero(v.total)} posts con más likes de ${INSTAGRAM.ventana(data)} en las cuentas de noticias de la región, del más reciente al más antiguo.`
      : `Los ${numero(v.total)} posts con más likes de ${INSTAGRAM.ventana(data)} en cuentas con sede en ${v.nombre}, del más reciente al más antiguo.`,
  sinFuente: (nombre) =>
    `Sin cuenta de Instagram de un medio con sede en ${nombre}. Es un hueco de cobertura, no un cero.`,
  sinFilas: (nombre, ventana) => `Sin posts de cuentas con sede en ${nombre} en ${ventana}.`,
  sinToken:
    "El panel de Instagram no está disponible en este momento. El resto del tablero funciona igual.",
  pie: "Se publican el pie del medio, las cifras del post y el texto de los comentarios más votados, nunca quién los escribió. Instagram no publica compartidos ni guardados de cuentas ajenas: es «sin dato», no cero.",
};

const TIKTOK: Plataforma = {
  nombre: "TikTok",
  usarDatos: useTikTok,
  usarTextos: useTikTokComentarios,
  unidad: ["video", "videos"],
  sinPie: "Abrir en TikTok",
  fuente: (d) => d.creador ?? d.cuenta,
  etiquetaZona: (z) => (z === "nacional" ? "sin lugar" : nombreZona(z)),
  // La busqueda no tiene sede: si esta activa, hay fuente para toda zona, y
  // una zona sin filas es "ningun video la nombro", no "sin cuenta".
  hayFuente: (cuentas) => cuentas.some((c) => c.activa),
  ventana: (data) => `las últimas ${data.ventana_horas ?? 24} horas`,
  cabeza: (v, data) =>
    v.esRegion
      ? `${numero(v.total)} ${pluralizar(v.total, "video", "videos")} de ${TIKTOK.ventana(data)} que ${pluralizar(v.total, "habla", "hablan")} de la región, del más reciente al más antiguo.`
      : `${numero(v.total)} ${pluralizar(v.total, "video", "videos")} de ${TIKTOK.ventana(data)} que ${pluralizar(v.total, "habla", "hablan")} de ${v.nombre}, del más reciente al más antiguo.`,
  sinFuente: () => "Sin videos de TikTok en el tablero. Es un hueco, no un cero.",
  sinFilas: (nombre, ventana) => `Ningún video habla de ${nombre} en ${ventana}.`,
  sinToken:
    "El panel de TikTok no está disponible en este momento. El resto del tablero funciona igual.",
  pie: "Se publican la descripción del video, el @ del creador, las cifras y el texto de los comentarios más votados, nunca quién los escribió. TikTok sí publica compartidos y guardados.",
};

interface Dia {
  fecha: string;
  posts: Destacado[];
}

/** Lo que el panel necesita, resuelto una vez (misma razon que en conversacion.tsx). */
interface Vista {
  nombre: string;
  esRegion: boolean;
  /** Los posts elegidos, agrupados por dia del mas reciente al mas antiguo. */
  dias: Dia[];
  total: number;
  hayFuente: boolean;
  nombres: Map<string, string>;
}

/** Del mas reciente al mas antiguo; dentro del dia, por hora exacta cuando la
 *  fila trae `publicado` y por likes cuando no. Un corte de Instagram anterior
 *  al 10 de septiembre de 2026 no la trae: ahi las dos cadenas vacias empatan
 *  y decide el like. */
function porDia(posts: Destacado[]): Dia[] {
  const orden = [...posts].sort(
    (a, b) =>
      b.fecha.localeCompare(a.fecha) ||
      (b.publicado ?? "").localeCompare(a.publicado ?? "") ||
      b.likes - a.likes ||
      a.url.localeCompare(b.url),
  );
  const dias: Dia[] = [];
  for (const p of orden) {
    const ultimo = dias[dias.length - 1];
    if (ultimo !== undefined && ultimo.fecha === p.fecha) ultimo.posts.push(p);
    else dias.push({ fecha: p.fecha, posts: [p] });
  }
  return dias;
}

function vistaDeZona(data: DocRedes, zona: ZonaRuta | null, pl: Plataforma): Vista {
  const destacados = data.destacados ?? [];
  const cuentas = data.cuentas ?? [];
  const maximo = data.destacados_maximo ?? 15;
  const nombres = new Map(cuentas.map((c) => [c.cuenta, c.nombre] as const));
  // La SELECCION respeta el orden del archivo (por likes); solo despues se
  // reordena por fecha para leer.
  const elegidos =
    zona === null
      ? destacados.slice(0, maximo)
      : destacados.filter((d) => d.zona === zona).slice(0, maximo);
  return {
    nombre: zona === null ? "la región" : NOMBRE_CORTO[zona],
    esRegion: zona === null,
    dias: porDia(elegidos),
    total: elegidos.length,
    hayFuente: pl.hayFuente(cuentas, zona),
    nombres,
  };
}

/* ------------------------------------------------------------ comentarios */

function ChipSentimiento({ s }: { s: ComentarioPublicado["sentimiento"] }) {
  if (s === null) return null;
  const clase =
    s === "negativo"
      ? "border-baja/30 text-baja/80"
      : s === "positivo"
        ? "border-sube/30 text-sube/80"
        : "border-filo text-tinta-meta";
  return (
    <span
      title="Cómo suena la frase. No mide la postura hacia una persona."
      className={`inline-block rounded-full border px-2 py-px text-meta whitespace-nowrap ${clase}`}
    >
      {s}
    </span>
  );
}

function Comentario({ c }: { c: ComentarioPublicado }) {
  return (
    <li>
      <blockquote className="max-w-[65ch] text-cuerpo text-tinta-dato">{c.texto}</blockquote>
      <p className="mt-1 flex items-center gap-2 text-meta text-tinta-meta">
        <span className="tabular-nums">
          {numero(c.likes)} {pluralizar(c.likes, "like", "likes")}
        </span>
        <ChipSentimiento s={c.sentimiento} />
      </p>
    </li>
  );
}

/**
 * Los primeros `visibles` siempre; el resto detras de «ver mas». El pipeline
 * ya dejo fuera lo que no tiene likes despues de los visibles, asi que aqui
 * no se filtra: se muestra lo que llego.
 */
function Comentarios({
  lista,
  visibles,
  disponibles,
  cosechados,
}: {
  lista: ComentarioPublicado[] | undefined;
  visibles: number;
  disponibles: boolean;
  cosechados: number;
}) {
  const [abierto, setAbierto] = useState(false);
  if (!disponibles) return null;
  if (lista === undefined || lista.length === 0) {
    // Sin nada cosechado, la frase de arriba ya lo dijo. Aqui solo se avisa
    // cuando hubo comentarios y ninguno se publica (brigada o puro emoji).
    if (cosechados === 0) return null;
    return (
      <p className="mt-3 text-meta text-tinta-meta">
        No hay comentarios que mostrar en este post.
      </p>
    );
  }
  const mostrados = abierto ? lista : lista.slice(0, visibles);
  const ocultos = lista.length - visibles;
  return (
    // Un solo filo para todo el bloque: las voces van juntas y debajo del
    // post, no cada una en su propia caja.
    <div className="mt-4 border-l border-filo pl-4">
      <ul className="space-y-4">
        {mostrados.map((c, i) => (
          <Comentario key={i} c={c} />
        ))}
      </ul>
      {ocultos > 0 && !abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="mt-4 text-meta text-tinta-prosa underline-offset-4 hover:text-tinta-titulo hover:underline"
        >
          ver {ocultos} más
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ post */

function Post({
  d,
  pl,
  nombres,
  comentarios,
  visibles,
  textoDisponible,
}: {
  d: Destacado;
  pl: Plataforma;
  nombres: Map<string, string>;
  comentarios: ComentarioPublicado[] | undefined;
  visibles: number;
  textoDisponible: boolean;
}) {
  const cifras = [
    `${numero(d.likes)} ${pluralizar(d.likes, "like", "likes")}`,
    `${numero(d.comentarios)} ${pluralizar(d.comentarios, "comentario", "comentarios")}`,
    d.compartidos === undefined ? null : `${numero(d.compartidos)} compartidos`,
    d.guardados === undefined ? null : `${numero(d.guardados)} guardados`,
    d.reproducciones === undefined ? null : `${numero(d.reproducciones)} reproducciones`,
  ].filter((x): x is string => x !== null);
  const cuando = d.publicado === undefined ? null : hora(d.publicado);

  return (
    <li className="py-5">
      <h4 className="max-w-[70ch] text-lectura font-normal">
        <a
          href={d.url}
          target="_blank"
          rel="noopener nofollow noreferrer"
          className="text-tinta-titulo transition-colors hover:text-chart-1-texto"
        >
          {d.titulo === "" ? pl.sinPie : d.titulo}
        </a>
      </h4>

      {/* Quien y que, separado de cuanto: la fuente se lee primero y las
          cifras van juntas en numeros tabulares. */}
      <p className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-meta text-tinta-meta">
        <span className="text-tinta-prosa">
          {cuando === null ? null : (
            <>
              <time dateTime={d.publicado} className="tabular-nums">
                {cuando}
              </time>
              {" · "}
            </>
          )}
          {pl.fuente(d, nombres)} · {pl.etiquetaZona(d.zona)} · {TIPO[d.tipo]}
        </span>
        <span className="tabular-nums">{cifras.join(" · ")}</span>
      </p>

      <p className="mt-3 max-w-[70ch] text-cuerpo text-tinta-prosa">
        {F.fraseComentariosPost(d.sentimiento, d.cosechados, d.comentarios, d.opinion)}
      </p>
      {d.temas.length === 0 ? null : (
        <p className="mt-2 flex flex-wrap gap-2 text-meta text-tinta-meta">
          {d.temas.map((t) => (
            <span
              key={t.tema}
              title="Tema de prensa que aparece en los comentarios"
              className="inline-block rounded-full border border-filo bg-vela px-2 py-px whitespace-nowrap text-tinta-dato"
            >
              «{t.tema}» {t.comentarios}
            </span>
          ))}
        </p>
      )}

      <Comentarios
        lista={comentarios}
        visibles={visibles}
        disponibles={textoDisponible}
        cosechados={d.cosechados}
      />
    </li>
  );
}

/** Un dia: la fecha una sola vez, una regla, y los posts de ese dia. */
function GrupoDia({
  dia,
  v,
  pl,
  textos,
  visibles,
}: {
  dia: Dia;
  v: Vista;
  pl: Plataforma;
  textos: DocRedesComentarios | undefined;
  visibles: number;
}) {
  const n = dia.posts.length;
  return (
    <section aria-label={`${pl.unidad[1]} del ${fechaCorta(dia.fecha)}`}>
      <h3 className="flex items-baseline gap-3 text-meta text-tinta-meta">
        <time dateTime={dia.fecha} className="font-medium text-tinta-dato">
          {fechaCorta(dia.fecha)}
        </time>
        <span aria-hidden="true" className="h-px flex-1 self-center bg-vela" />
        <span className="tabular-nums">
          {n} {pluralizar(n, pl.unidad[0], pl.unidad[1])}
        </span>
      </h3>
      <ol className="divide-y divide-vela">
        {dia.posts.map((d) => (
          <Post
            key={d.url}
            d={d}
            pl={pl}
            nombres={v.nombres}
            comentarios={textos?.por_post[d.url]}
            visibles={visibles}
            textoDisponible={textos !== undefined}
          />
        ))}
      </ol>
    </section>
  );
}

/* ---------------------------------------------------------------- cabeza */

/** Las formas del encabezado, como clausulas de guarda. */
function Cabeza({
  data,
  v,
  pl,
  sinToken,
  textos,
  textoError,
}: {
  data: DocRedes;
  v: Vista;
  pl: Plataforma;
  sinToken: boolean;
  textos: DocRedesComentarios | undefined;
  textoError: boolean;
}) {
  if (sinToken) {
    return <p className="max-w-[70ch] text-lectura text-tinta-prosa">{pl.sinToken}</p>;
  }
  if (data.destacados === undefined) {
    return (
      <p className="max-w-[70ch] text-lectura text-tinta-prosa">
        Todavía no hay lista de {pl.unidad[1]}. Las cifras sí:{" "}
        {numero(data.comentarios_vigentes)} comentarios sobre {numero(data.posts_vigentes)}{" "}
        {pl.unidad[1]}.
      </p>
    );
  }
  if (!v.hayFuente) {
    return (
      <p className="text-lectura">
        <Hueco titulo="Hueco de cobertura, registrado a propósito">{pl.sinFuente(v.nombre)}</Hueco>
      </p>
    );
  }
  if (v.total === 0) {
    return (
      <p className="text-lectura">
        <Hueco>{pl.sinFilas(v.nombre, pl.ventana(data))}</Hueco>
      </p>
    );
  }
  return (
    <>
      <p className="max-w-[70ch] text-lectura text-tinta-titulo">{pl.cabeza(v, data)}</p>
      <p className="mt-2 max-w-[70ch] text-meta text-tinta-prosa">
        En total, {numero(data.comentarios_vigentes)} comentarios sobre{" "}
        {numero(data.posts_vigentes)} {pl.unidad[1]}.
        {textoError
          ? " El texto de los comentarios no está disponible en esta vista."
          : textos === undefined
            ? " Cargando comentarios…"
            : ""}
      </p>
    </>
  );
}

/* ----------------------------------------------------------------- panel */

function PanelSocial({ zona, pl }: { zona: ZonaRuta | null; pl: Plataforma }) {
  const { data, error } = pl.usarDatos();
  const { data: textos, error: textoError } = pl.usarTextos();

  if (error !== undefined) {
    return <p className="text-lectura text-tinta-prosa">No se pudo mostrar {pl.nombre}.</p>;
  }
  if (data === undefined) return <Esqueleto className="h-[320px]" />;

  const sinToken = data.salud.length > 0 && data.salud.every((s) => s.estado === "sin_token");
  const v = vistaDeZona(data, zona, pl);
  const visibles = textos?.visibles ?? 5;

  return (
    <Bisel interior="p-6 md:p-8">
      <Cabeza
        data={data}
        v={v}
        pl={pl}
        sinToken={sinToken}
        textos={textos}
        textoError={textoError !== undefined}
      />

      {v.total > 0 && v.hayFuente && !sinToken ? (
        <div className="mt-8 space-y-10">
          {v.dias.map((dia) => (
            <GrupoDia key={dia.fecha} dia={dia} v={v} pl={pl} textos={textos} visibles={visibles} />
          ))}
        </div>
      ) : null}

      <p className="mt-10 text-meta text-tinta-prosa">{pl.pie}</p>
    </Bisel>
  );
}

export function PanelRedes({ zona }: { zona: ZonaRuta | null }) {
  return <PanelSocial zona={zona} pl={INSTAGRAM} />;
}

export function PanelTikTok({ zona }: { zona: ZonaRuta | null }) {
  return <PanelSocial zona={zona} pl={TIKTOK} />;
}
