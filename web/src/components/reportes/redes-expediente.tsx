"use client";

import { ArrowSquareOut as Abrir, CaretDown as Desplegar, ChatCircleText as Leer } from "@phosphor-icons/react";
import Link from "next/link";
import { useId, useState } from "react";
import { useSWRConfig } from "swr";

import { ComentariosSeguidos } from "@/components/seguimiento/comentarios-seguidos";
import { ResumenComentarios } from "@/components/seguimiento/resumen-comentarios";
import { CifraTono } from "@/components/ui/cifra-tono";
import { clasesBoton } from "@/components/ui/clases";
import { EstadoCarga } from "@/components/ui/estado-carga";
import { serieTono } from "@/lib/dominio/consultas";
import { fechaConAnio, numero, pluralizar } from "@/lib/dominio/formato";
import { canonizarPublicacion } from "@/lib/dominio/publicaciones";
import type { PublicacionExpediente } from "@/lib/expedientes/expedientes";
import { SALVEDAD_TONO, momento } from "@/lib/seguimiento/formato";
import { useAgregar, useFichaSeguimiento, useListaSeguimiento } from "@/lib/seguimiento/use-seguimiento";

/**
 * «En redes» del expediente: cada publicacion es una fila que se abre, y
 * abierta dice lo que dicen sus comentarios (el resumen de IA de su
 * seguimiento), como suenan, y la lista con sus likes a un toque (cliente, 2
 * de octubre de 2026: «que el usuario tenga toda la informacion», y el mismo
 * dia, «un resumen en vez de cada comentario»).
 *
 * El texto de los comentarios NO viaja en el expediente: el JSON va a git, y
 * el texto de un comentario no llega a git nunca (AGENTS.md). Lo que se pinta
 * es el SEGUIMIENTO de esa publicacion (lib/seguimiento/), que guarda el texto
 * 15 dias en la base, sin identidad, con su tono y sus likes. Si la
 * publicacion no esta en seguimiento, la fila ofrece leerla: es una lectura
 * pagada y por eso es un boton, nunca algo que pase al abrir la fila. Abrir
 * no cuesta: solo consulta la lista del equipo.
 *
 * El tono va con SALVEDAD_TONO, como en la ficha de seguimiento: es la
 * excepcion a la regla 5 que el cliente decidio el 29 de septiembre de 2026,
 * y la salvedad no se quita. Conteos, nunca porcentajes.
 *
 * YouTube no entra a seguimiento y su feed no trae comentarios: «sin dato».
 */

const RED = { youtube: "YouTube", tiktok: "TikTok", facebook: "Facebook", instagram: "Instagram" } as const;

const COLUMNAS = "md:grid-cols-[minmax(0,1fr)_11rem_8.5rem_7rem_1.5rem]";

function AbrirEn({ p }: { p: PublicacionExpediente }) {
  return (
    <a href={p.url} target="_blank" rel="noopener noreferrer" className={clasesBoton(false)}>
      <Abrir size={16} aria-hidden /> Abrir en {RED[p.red]}
    </a>
  );
}

/** Lo leido de una publicacion en seguimiento. Primero lo que dicen los
 *  comentarios, en el resumen de IA que seguimiento ya escribio con su
 *  lectura, y su tono contado al lado; la lista de comentarios queda a un
 *  toque (cliente, 2 de octubre de 2026: «en vez de mostrar cada comentario,
 *  un resumen de lo que dice la gente»). Elegir un tema del resumen abre la
 *  lista filtrada por ese tema. */
function Lectura({ id, p }: { id: string; p: PublicacionExpediente }) {
  const { data, error, mutate } = useFichaSeguimiento(id);
  const [lista, setLista] = useState(false);
  const [tema, setTema] = useState<string | null>(null);
  if (data === undefined) {
    return error === undefined ? <EstadoCarga etiqueta="Cargando comentarios" /> : <p className="text-cuerpo text-baja">No se pudieron cargar los comentarios.</p>;
  }
  const conteo = data.tono.conteo;
  const leidos = conteo.positivo + conteo.negativo + conteo.neutral + conteo.sinTono;
  const ultima = data.actualizaciones.find((a) => a.estado === "listo");
  if (data.enCurso && data.comentarios.length === 0) {
    return (
      <div className="grid gap-2">
        <EstadoCarga etiqueta="Leyendo comentarios" />
        <p className="text-cuerpo text-tinta-meta">Puede tardar unos minutos. Puedes seguir leyendo el expediente.</p>
      </div>
    );
  }
  const temaActivo = data.resumen?.temas?.find((t) => t.nombre === tema) ?? null;
  const sinResumen = data.resumen === null && !data.resumible;
  return (
    <div className="grid gap-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:gap-10">
        <div className="min-w-0">
          {sinResumen ? (
            <p className="max-w-[60ch] text-lectura text-tinta-prosa">
              {data.comentarios.length === 0
                ? "No hay comentarios con texto guardados."
                : `${numero(data.comentarios.length)} ${pluralizar(data.comentarios.length, "comentario", "comentarios")}: muy pocos para resumirlos. Se leen abajo.`}
            </p>
          ) : (
            <ResumenComentarios
              id={`exp-res-${id}`}
              encabezado="h4"
              datos={data}
              alResumir={() => mutate()}
              alVerTema={(t) => { setTema(t.nombre); setLista(true); }}
            />
          )}
        </div>
        <div className="grid content-start gap-4">
          <ul className="grid">
            <CifraTono rotulo="Tono de los comentarios" serie={serieTono(conteo, "m")} genero="m" unidad={["comentario", "comentarios", "Ningún comentario"]}>
              {leidos === 0 ? null : <p className="text-meta text-tinta-meta">{SALVEDAD_TONO}</p>}
            </CifraTono>
          </ul>
          <div className="grid gap-3 text-meta text-tinta-meta">
            {ultima === undefined ? null : <p>Leídos el {momento(ultima.fecha)}.</p>}
            {data.enCurso ? <EstadoCarga etiqueta="Actualizando" /> : null}
            <div className="flex flex-wrap gap-2">
              <Link href={`/seguimiento/${id}`} className={clasesBoton(false)}>Ver en Seguimiento</Link>
              <AbrirEn p={p} />
            </div>
          </div>
        </div>
      </div>
      {data.comentarios.length === 0 ? null : lista || sinResumen ? (
        <ComentariosSeguidos
          id={`exp-com-${id}`}
          datos={data}
          tema={temaActivo}
          alQuitarTema={() => setTema(null)}
          encabezado="h4"
          className="aparicion-suave min-w-0 border-t border-vela pt-6"
        />
      ) : (
        <p>
          <button type="button" onClick={() => setLista(true)} className={clasesBoton(false)}>
            <Desplegar size={16} aria-hidden /> Ver los {numero(data.comentarios.length)} comentarios
          </button>
        </p>
      )}
    </div>
  );
}

/** Una publicacion que nadie ha leido todavia: el boton que la lee. */
function SinLeer({ p, url, disponible }: { p: PublicacionExpediente; url: string; disponible: boolean }) {
  const { mutate } = useSWRConfig();
  const agregar = useAgregar();
  async function leer() {
    const r = await agregar.correr(url, "es");
    if (r !== null) await mutate("/api/seguimiento");
  }
  return (
    <div className="grid max-w-[60ch] gap-4">
      <p className="text-lectura text-tinta-prosa">
        Los comentarios de esta publicación todavía no se han leído.
        {disponible ? " Se leen con sus likes y su tono, y la publicación queda en Seguimiento." : null}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {disponible ? (
          <button type="button" onClick={() => void leer()} disabled={agregar.enviando} className={`${clasesBoton(true)} disabled:opacity-60`}>
            <Leer size={16} aria-hidden /> {agregar.enviando ? "Pidiendo…" : "Leer comentarios"}
          </button>
        ) : null}
        <AbrirEn p={p} />
      </div>
      {!disponible ? <p className="text-cuerpo text-tinta-meta">La lectura de comentarios no está disponible por ahora.</p> : null}
      {agregar.fallo === null ? null : <p role="alert" className="text-cuerpo text-baja">{agregar.fallo.mensaje}</p>}
    </div>
  );
}

/** Lo que se ve al abrir una fila. Se monta solo abierta: cerrada, la fila no
 *  pide nada a la API. */
function Detalle({ p }: { p: PublicacionExpediente }) {
  const lista = useListaSeguimiento();
  if (p.red === "youtube") {
    return (
      <div className="grid gap-4">
        <p className="text-lectura text-tinta-prosa">De YouTube no hay comentarios ni tono: <span className="text-tinta-meta">sin dato</span>.</p>
        <div><AbrirEn p={p} /></div>
      </div>
    );
  }
  const url = canonizarPublicacion(p.url, p.red);
  if (lista.data === undefined) {
    return lista.error === undefined ? <EstadoCarga etiqueta="Buscando comentarios" /> : <p className="text-cuerpo text-baja">No se pudieron cargar los comentarios.</p>;
  }
  const seguida = url === null ? undefined : lista.data.publicaciones.find((s) => s.url === url);
  if (seguida !== undefined) return <Lectura id={seguida.id} p={p} />;
  if (url === null) return <div className="grid gap-4"><p className="text-cuerpo text-tinta-meta">Sin dato de comentarios.</p><div><AbrirEn p={p} /></div></div>;
  return <SinLeer p={p} url={url} disponible={lista.data.disponible} />;
}

function Fila({ p }: { p: PublicacionExpediente }) {
  const [abierta, setAbierta] = useState(false);
  const panel = useId();
  return (
    <li className="border-t border-vela first:border-t-0">
      <button
        type="button"
        aria-expanded={abierta}
        aria-controls={panel}
        onClick={() => setAbierta((a) => !a)}
        className={`group grid w-full grid-cols-[minmax(0,1fr)_1.5rem] items-start gap-x-6 gap-y-2 px-5 py-5 text-left transition-colors duration-[var(--dur-toque)] hover:bg-vela sm:px-8 ${COLUMNAS} ${abierta ? "bg-vela" : ""}`}
      >
        <span className="grid min-w-0 gap-1">
          <span className="text-cuerpo text-tinta-dato transition-colors group-hover:text-tinta-titulo">{p.titulo}</span>
          <span className="text-meta text-tinta-meta">{RED[p.red]} · {fechaConAnio(p.fecha)}{p.cuenta === null ? null : <span className="md:hidden"> · {p.cuenta}</span>}</span>
        </span>
        <Desplegar size={16} aria-hidden className={`col-start-2 row-start-1 mt-1 justify-self-end text-tinta-meta transition-transform duration-[var(--dur-cambio)] md:col-start-5 ${abierta ? "rotate-180" : ""}`} />
        <span className="hidden text-cuerpo text-tinta-prosa md:block md:col-start-2 md:row-start-1">{p.cuenta ?? <span className="text-meta text-tinta-meta">sin dato</span>}</span>
        <span className="flex flex-wrap items-baseline gap-x-5 gap-y-1 md:contents">
          <span className="whitespace-nowrap md:col-start-3 md:row-start-1 md:text-right">
            <span className="font-mono text-cuerpo tabular-nums text-tinta-dato">{numero(p.alcance)}</span>
            <span className="text-meta text-tinta-meta"> {p.unidad}</span>
          </span>
          <span className="whitespace-nowrap md:col-start-4 md:row-start-1 md:text-right">
            {p.comentarios === null ? <span className="text-meta text-tinta-meta">sin dato</span> : (
              <><span className="font-mono text-cuerpo tabular-nums text-tinta-dato">{numero(p.comentarios)}</span><span className="text-meta text-tinta-meta md:hidden"> comentarios</span></>
            )}
          </span>
        </span>
      </button>
      {abierta ? (
        <div id={panel} className="aparicion-suave border-t border-vela px-5 pb-8 pt-6 sm:px-8">
          <Detalle p={p} />
        </div>
      ) : null}
    </li>
  );
}

export function RedesExpediente({ publicaciones }: { publicaciones: readonly PublicacionExpediente[] }) {
  return (
    <div>
      <div className={`hidden gap-x-6 px-5 pb-4 text-meta text-tinta-meta sm:px-8 md:grid ${COLUMNAS}`} aria-hidden>
        <span>Publicación</span>
        <span>Cuenta</span>
        <span className="text-right">Alcance</span>
        <span className="text-right">Comentarios</span>
        <span />
      </div>
      <ul className="border-t border-vela">
        {publicaciones.map((p) => <Fila key={p.url} p={p} />)}
      </ul>
    </div>
  );
}
