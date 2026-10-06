"use client";

import { X as Cerrar } from "@phosphor-icons/react";
import { useState } from "react";

import { ChipSentimiento } from "@/components/ui/chip-sentimiento";
import { clasesBoton, clasesInsignia } from "@/components/ui/clases";
import { CON_COLUMNA_LIKES as CON_COLUMNA, LikesComentario as Likes } from "@/components/ui/likes-comentario";
import { Chip, Hueco } from "@/components/ui/primitivas";
import { Segmentado } from "@/components/ui/segmentado";
import { numero } from "@/lib/dominio/formato";
import type { ComentarioSeguido, RespuestaSeguimiento, TemaComentarios, TonoComentario } from "@/lib/seguimiento/contrato";
import { momento, nombreLikes, ordenarComentarios, type OrdenComentarios } from "@/lib/seguimiento/formato";

/**
 * La lista de comentarios de una publicacion en seguimiento. Vivia dentro de
 * ficha-seguimiento.tsx; salio el 2 de octubre de 2026 porque el expediente
 * de /reportes la necesita igual, debajo de cada publicacion de «En redes», y
 * el mismo gesto no se copia (AGENTS.md, «One component per gesture»).
 *
 * Abre por los de mas likes y con pocos a la vista (cliente, 30 de septiembre
 * de 2026: «muestra muchos desde el inicio»): hasta ese dia eran los cincuenta
 * mas recientes, y en un telefono eso son veinte pantallas.
 *
 * Tres filtros que son tres gestos distintos: el TEMA llega desde el resumen
 * («Ver los 11 comentarios») y se quita con su pastilla; el tono es un filtro
 * con su cuenta (ui/primitivas.tsx::Chip, que alinea la etiqueta con su
 * numero por la linea base); el orden es un interruptor de dos
 * (ui/segmentado.tsx). Se combinan.
 *
 * Un control que no cambiaria nada no se ofrece: un tono sin comentarios (la
 * tarjeta de tono ya dice el cero), el filtro entero cuando todos caen en el
 * mismo (una publicacion en ingles no tiene tono), y el orden por likes cuando
 * ningun comentario trae likes.
 */

/** Los que se ven al abrir, y cuantos mas trae cada «Ver más». */
const TOPE_INICIAL = 8;
const MAS_POR_VEZ = 20;

type Filtro = "todos" | TonoComentario;

const TONOS: readonly { id: TonoComentario; nombre: string }[] = [
  { id: "positivo", nombre: "Positivos" },
  { id: "negativo", nombre: "Negativos" },
  { id: "neutral", nombre: "Neutrales" },
];

function Comentario({ c, likes, columna }: { c: ComentarioSeguido; likes: [string, string]; columna: boolean }) {
  return (
    <li className={`py-4 first:pt-0 ${columna ? CON_COLUMNA : ""}`}>
      {columna ? <p className="text-cuerpo"><Likes n={c.likes} nombre={likes} /></p> : null}
      <div className="min-w-0">
        <blockquote className="max-w-[65ch] break-words text-lectura text-tinta-dato">{c.texto}</blockquote>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-meta text-tinta-meta">
          {c.escrito === null ? <Hueco>sin fecha</Hueco> : <span>{momento(c.escrito)}</span>}
          <ChipSentimiento s={c.sentimiento} />
          {c.nuevo ? <span className={clasesInsignia("dato")}>nuevo</span> : null}
        </p>
      </div>
    </li>
  );
}

export function ComentariosSeguidos({ datos, tema = null, alQuitarTema, id, encabezado: Encabezado = "h2", className = "scroll-mt-24 border-t border-filo pt-8" }: {
  datos: RespuestaSeguimiento;
  tema?: TemaComentarios | null;
  alQuitarTema?: () => void;
  /** Unico por pagina: el expediente monta una lista por publicacion abierta. */
  id: string;
  /** El nivel lo pone quien la monta: en la ficha es una seccion de la
   *  pagina, en el expediente vive bajo «En redes». */
  encabezado?: "h2" | "h4";
  className?: string;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [orden, setOrden] = useState<OrdenComentarios>("likes");
  const [tope, setTope] = useState(TOPE_INICIAL);
  // Un tema nuevo vuelve a abrir la lista desde arriba. Es el ajuste de
  // estado al cambiar una prop que recomienda React: sin efecto, en el render.
  const [temaVisto, setTemaVisto] = useState(tema);
  if (temaVisto !== tema) {
    setTemaVisto(tema);
    setTope(TOPE_INICIAL);
  }
  const todos = datos.comentarios;
  const likes = nombreLikes(datos.publicacion.red);
  const tonos = TONOS.map((t) => ({ ...t, n: todos.filter((c) => c.sentimiento === t.id).length })).filter((t) => t.n > 0);
  const filtrable = tonos.some((t) => t.n < todos.length);
  const ordenable = todos.length > 1 && todos.some((c) => c.likes > 0);
  const delTema = tema === null ? todos : todos.filter((c) => tema.huellas.includes(c.huella));
  const lista = ordenarComentarios(filtro === "todos" ? delTema : delTema.filter((c) => c.sentimiento === filtro), ordenable ? orden : "recientes");
  const filtrar = (f: Filtro) => { setFiltro(f); setTope(TOPE_INICIAL); };
  const ordenar = (o: OrdenComentarios) => { setOrden(o); setTope(TOPE_INICIAL); };
  const resto = lista.length - tope;
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className={className}>
      <Encabezado id={`${id}-titulo`} className="text-rotulo text-tinta-titulo">Comentarios</Encabezado>
      <p className="mt-1 text-cuerpo text-tinta-meta">Se borran {datos.retencionDias} días después de la última actualización que los trajo.</p>
      {filtrable || ordenable || tema !== null ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {tema === null || alQuitarTema === undefined ? null : (
              <button type="button" onClick={alQuitarTema} aria-label={`Quitar el tema ${tema.nombre}`} className={clasesBoton(true)}>
                {tema.nombre} <Cerrar size={16} aria-hidden />
              </button>
            )}
            {filtrable ? (
              <div role="group" aria-label="Tono de los comentarios" className="flex flex-wrap gap-2">
                <Chip activo={filtro === "todos"} onClick={() => filtrar("todos")} cuenta={delTema.length}>Todos</Chip>
                {tonos.map((t) => (
                  <Chip key={t.id} activo={filtro === t.id} onClick={() => filtrar(t.id)} cuenta={delTema.filter((c) => c.sentimiento === t.id).length}>{t.nombre}</Chip>
                ))}
              </div>
            ) : null}
          </div>
          {ordenable ? (
            <Segmentado etiqueta="Orden de los comentarios" ancho="justo" opciones={[
              { id: "likes", nombre: `Más ${likes[1]}`, activo: orden === "likes", onElegir: () => ordenar("likes") },
              { id: "recientes", nombre: "Más recientes", activo: orden === "recientes", onElegir: () => ordenar("recientes") },
            ]} />
          ) : null}
        </div>
      ) : null}
      {todos.length === 0 ? (
        <p className="mt-6 text-cuerpo text-tinta-meta">
          {datos.actualizaciones.some((a) => a.estado === "listo") ? "No hay comentarios con texto guardados." : "Todavía no se leen los comentarios."}
        </p>
      ) : lista.length === 0 ? (
        <p className="mt-6 text-cuerpo text-tinta-meta">Ningún comentario con ese tono.</p>
      ) : (
        <>
          <ul className="mt-6 divide-y divide-vela">
            {lista.slice(0, tope).map((c) => <Comentario key={c.huella} c={c} likes={likes} columna={ordenable} />)}
          </ul>
          {resto > 0 ? (
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <button type="button" onClick={() => setTope((t) => t + MAS_POR_VEZ)} className={clasesBoton(false)}>
                Ver {numero(Math.min(MAS_POR_VEZ, resto))} más
              </button>
              <p className="text-meta tabular-nums text-tinta-meta">{numero(tope)} de {numero(lista.length)}</p>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
