"use client";

import { useState } from "react";

import type { ComentarioPublicado, DocRedesComentarios } from "@/lib/datos/tipos";
import { numero, pluralizar } from "@/lib/dominio/formato";
import * as F from "@/lib/dominio/frases";
import { NOMBRE_RED, type PublicacionVisual } from "@/lib/dominio/publicaciones";

/**
 * Los comentarios mas votados de una publicacion: la hoja «Comentarios» del
 * lector y la vista previa de la columna de escritorio.
 *
 * Vivian en el panel de Lista (paneles/redes.tsx), que se fue el 15 de
 * septiembre de 2026 cuando el Visual paso a ser la unica presentacion. El
 * texto de los comentarios es lo que la direccion pidio ver el 8 de
 * septiembre, asi que se mudo a la tarjeta en vez de irse con la lista.
 *
 * El texto viene de efimero/, fuera de git, con retencion de 30 dias y sin
 * identidad: ni usuario, ni id, ni avatar existen en ningun archivo. Un 404
 * del archivo de texto no es un error del panel: un despliegue desde git puro
 * no lo trae, y aqui se dice que falta, no por que.
 *
 * Nada aqui calcula un porcentaje. Con ~30 comentarios por post uno solo
 * mueve el numero, y el validador del pipeline rechaza porcentajes en
 * cualquier nivel.
 */

/** El par de SWR del archivo de texto de una red. */
export interface Textos {
  data: DocRedesComentarios | undefined;
  error: unknown;
}

const SIN_TEXTO = "El texto de los comentarios no está disponible en esta vista.";

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

function Comentario({ c, recortar = false }: { c: ComentarioPublicado; recortar?: boolean }) {
  return (
    <li>
      <blockquote className={`max-w-[65ch] text-cuerpo text-tinta-dato ${recortar ? "line-clamp-2" : ""}`}>{c.texto}</blockquote>
      <p className="mt-1 flex items-center gap-2 text-meta text-tinta-meta">
        <span className="tabular-nums">
          {numero(c.likes)} {pluralizar(c.likes, "like", "likes")}
        </span>
        <ChipSentimiento s={c.sentimiento} />
      </p>
    </li>
  );
}

/** Lo que la columna de escritorio deja ver sin abrir la hoja: los dos
 *  primeros, recortados a dos lineas. Sin texto, nada: la hoja lo explica. */
export function VistaPreviaComentarios({ comentarios }: { comentarios: ComentarioPublicado[] | undefined }) {
  if (comentarios === undefined || comentarios.length === 0) return null;
  return (
    <ul className="space-y-3 border-l border-filo pl-4">
      {comentarios.slice(0, 2).map((c, i) => <Comentario key={i} c={c} recortar />)}
    </ul>
  );
}

/**
 * El cuerpo de la hoja. Los primeros `visibles` siempre; el resto detras de
 * «ver mas». El pipeline ya dejo fuera lo que no tiene likes despues de los
 * visibles, asi que aqui no se filtra: se muestra lo que llego. Quien monta
 * esto lo remonta por publicacion (`key`), para que «ver mas» no herede el
 * estado de la anterior.
 */
export function ComentariosPublicacion({ fila, textos }: { fila: PublicacionVisual; textos: Textos }) {
  const [abierto, setAbierto] = useState(false);
  const d = fila.post;
  const lista = textos.data?.por_post[d.url];
  const visibles = textos.data?.visibles ?? 5;
  const mostrados = lista === undefined ? [] : abierto ? lista : lista.slice(0, visibles);
  const ocultos = (lista?.length ?? 0) - mostrados.length;

  let cuerpo;
  if (textos.error !== undefined) {
    cuerpo = <p className="mt-6 text-cuerpo text-tinta-meta">{SIN_TEXTO}</p>;
  } else if (textos.data === undefined) {
    cuerpo = <p role="status" className="mt-6 text-cuerpo text-tinta-meta">Cargando comentarios…</p>;
  } else if (lista === undefined || lista.length === 0) {
    // Sin nada cosechado, la frase de arriba ya lo dijo. Aqui solo se avisa
    // cuando hubo comentarios y ninguno se publica (brigada o puro emoji).
    cuerpo = d.cosechados === 0 ? null : <p className="mt-6 text-cuerpo text-tinta-meta">No hay comentarios que mostrar en este post.</p>;
  } else {
    // Un solo filo para todo el bloque: las voces van juntas y debajo del
    // post, no cada una en su propia caja.
    cuerpo = (
      <div className="mt-6 border-l border-filo pl-4">
        <ul className="space-y-4">
          {mostrados.map((c, i) => <Comentario key={i} c={c} />)}
        </ul>
        {ocultos > 0 ? (
          <button type="button" onClick={() => setAbierto(true)}
            className="mt-4 text-meta text-tinta-prosa underline-offset-4 hover:text-tinta-titulo hover:underline">
            ver {ocultos} más
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-8">
      <p className="text-meta text-tinta-meta">{fila.fuente} · {NOMBRE_RED[fila.red]}</p>
      <h3 className="mt-1 break-words text-rotulo text-tinta-titulo">{d.titulo || "Publicación sin título"}</h3>
      <p className="mt-4 max-w-[65ch] text-cuerpo text-tinta-prosa">
        {F.fraseComentariosPost(d.sentimiento, d.cosechados, d.comentarios, d.opinion)}
      </p>
      {d.temas.length === 0 ? null : (
        <p className="mt-2 flex flex-wrap gap-2 text-meta text-tinta-meta">
          {d.temas.map((t) => (
            <span key={t.tema} title="Tema de prensa que aparece en los comentarios"
              className="inline-block rounded-full border border-filo bg-vela px-2 py-px whitespace-nowrap text-tinta-dato">
              «{t.tema}» {t.comentarios}
            </span>
          ))}
        </p>
      )}
      {cuerpo}
    </div>
  );
}
