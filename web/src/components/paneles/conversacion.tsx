"use client";

import type { ReactNode } from "react";

import { useConversacion, useRoster } from "@/lib/datos/hooks";
import type { DocConversacion, Sentimiento } from "@/lib/datos/tipos";
import { numero, pluralizar } from "@/lib/dominio/formato";
import * as F from "@/lib/dominio/frases";
import { indexarRoster, nombreCorto } from "@/lib/dominio/roster";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";
import { Bisel } from "@/components/ui/bisel";
import { ComoLeer } from "@/components/ui/como-leer";
import { Esqueleto, FilaConteo } from "@/components/ui/primitivas";
import { BarraSentimiento } from "@/components/ui/sentimiento";

/**
 * El panel de conversacion: frases y sentimiento, no nubes de palabras.
 *
 * Lo que habia aqui eran listas de unigramas ("playas 20", "bien 17",
 * "saludos 13"), que es lo que sale de contar n-gramas sobre comentarios
 * cortos y no le dice nada a nadie. Ahora cada bloque es una frase con
 * conteos (o porcentajes, cuando hay volumen) y una barra de partes. El texto
 * de los comentarios sigue sin publicarse: ver pulso/youtube.py.
 */

interface FilaTema {
  tema: string;
  comentarios: number;
  sentimiento?: Sentimiento;
  videos?: number;
  interacciones?: number;
  preguntas?: number;
}

function Tema({ fila, dias }: { fila: FilaTema; dias: number }) {
  const s = fila.sentimiento;
  const clasificados = s === undefined ? 0 : F.totalSentimiento(s);
  const frase =
    s !== undefined && clasificados > 0
      ? F.fraseSentimiento(s, `«${fila.tema}»`, dias)
      : `${numero(fila.comentarios)} ${pluralizar(fila.comentarios, "comentario", "comentarios")} sobre «${fila.tema}», sin clasificación de sentimiento.`;
  const meta = [
    fila.videos === undefined ? null : `${fila.videos} ${pluralizar(fila.videos, "video", "videos")}`,
    fila.interacciones === undefined ? null : `${numero(fila.interacciones)} likes y respuestas`,
    fila.preguntas === undefined
      ? null
      : `${fila.preguntas} ${pluralizar(fila.preguntas, "pregunta", "preguntas")}`,
  ].filter((x): x is string => x !== null);

  return (
    <li className="border-t border-vela py-5 first:border-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h4 className="text-lectura text-tinta-titulo">{fila.tema}</h4>
        <span className="text-meta tabular-nums text-tinta-meta">
          {numero(fila.comentarios)} {pluralizar(fila.comentarios, "comentario", "comentarios")}
        </span>
      </div>
      <p className="mt-2 max-w-[70ch] text-lectura text-tinta-dato">{frase}</p>
      {s !== undefined && clasificados > 0 ? (
        <div className="mt-3 max-w-md">
          <BarraSentimiento s={s} ariaLabel={frase} />
        </div>
      ) : null}
      {meta.length > 0 ? <p className="mt-2 text-meta text-tinta-meta">{meta.join("; ")}.</p> : null}
    </li>
  );
}

/**
 * Lo que el panel necesita, resuelto UNA vez.
 *
 * Antes cada campo se derivaba con su propio `zona === null ? ... : ...`, seis
 * veces seguidas, y la misma pregunta repartida en seis ternarios es lo que
 * hacia el componente ilegible: para saber que pintaba la vista de region
 * habia que leer la mitad derecha de seis lineas distintas. Aqui las dos
 * vistas quedan una debajo de la otra y se leen de corrido.
 */
interface Vista {
  nombre: string;
  esRegion: boolean;
  total: number;
  sentimiento: Sentimiento | undefined;
  clasificados: number;
  filas: FilaTema[];
  figuras: [string, number][];
  /** Solo la vista de zona lo trae; la de region no publica este renglon. */
  detalle: { interacciones: number; preguntas: number } | undefined;
  /** Comentarios sin etiquetar. Solo se reporta en la vista de region. */
  sinClasificar: number;
}

function vistaDeZona(data: DocConversacion, zona: ZonaRuta | null): Vista {
  if (zona === null) {
    const sentimiento = data.sentimiento;
    return {
      nombre: "la región",
      esRegion: true,
      total: data.comentarios_vigentes,
      sentimiento,
      clasificados: sentimiento === undefined ? 0 : F.totalSentimiento(sentimiento),
      filas: data.por_tema ?? [],
      figuras: Object.entries(data.por_figura).slice(0, 8),
      detalle: undefined,
      sinClasificar: sentimiento?.sin_clasificar ?? 0,
    };
  }
  const d = data.por_zona_detalle?.[zona];
  const sentimiento = d?.sentimiento;
  return {
    nombre: NOMBRE_CORTO[zona],
    esRegion: false,
    total: data.por_zona[zona] ?? 0,
    sentimiento,
    clasificados: sentimiento === undefined ? 0 : F.totalSentimiento(sentimiento),
    filas: d?.por_tema ?? [],
    figuras: [],
    detalle: d === undefined ? undefined : { interacciones: d.interacciones, preguntas: d.preguntas },
    sinClasificar: 0,
  };
}

/** La frase de arriba, con el sufijo de sin clasificar si aplica. */
function fraseDeCabeza(v: Vista, dias: number): string {
  const base =
    v.sentimiento !== undefined && v.clasificados > 0
      ? F.fraseSentimiento(v.sentimiento, v.nombre, dias)
      : `${numero(v.total)} comentarios sobre ${v.nombre} en ${dias} días; sin clasificación de sentimiento en este corte.`;
  return v.sinClasificar > 0
    ? `${base} ${numero(v.sinClasificar)} siguen sin clasificar.`
    : base;
}

/** Las tres formas que puede tomar el encabezado, como clausulas de guarda. */
function Cabeza({ v, dias, sinLlave }: { v: Vista; dias: number; sinLlave: boolean }) {
  if (sinLlave) {
    return (
      <p className="max-w-[70ch] text-lectura text-tinta-prosa">
        Sin llave de la API de YouTube configurada, así que no hay comentarios que
        medir. El resto del tablero funciona igual: es degradación esperada, no una
        falla.
      </p>
    );
  }
  if (v.total === 0) {
    return (
      <p className="max-w-[70ch] text-lectura text-tinta-prosa">
        {v.esRegion
          ? `Sin comentarios vigentes en los últimos ${dias} días.`
          : `Sin comentarios atribuidos a ${v.nombre} en los últimos ${dias} días.`}
      </p>
    );
  }
  const frase = fraseDeCabeza(v, dias);
  return (
    <>
      <p className="max-w-[70ch] text-lectura text-tinta-titulo">{frase}</p>
      {v.sentimiento !== undefined && v.clasificados > 0 ? (
        <div className="mt-4 max-w-lg">
          <BarraSentimiento s={v.sentimiento} ariaLabel={frase} />
        </div>
      ) : null}
      {v.detalle === undefined ? null : (
        <p className="mt-3 text-meta text-tinta-prosa">
          {numero(v.detalle.interacciones)} likes y respuestas; {v.detalle.preguntas}{" "}
          {pluralizar(v.detalle.preguntas, "pregunta", "preguntas")}.
        </p>
      )}
    </>
  );
}

/** Se pinta sola o no se pinta: la lista vacia no llega al padre como rama. */
function PorTema({ filas, dias }: { filas: FilaTema[]; dias: number }) {
  if (filas.length === 0) return null;
  return (
    <div className="mt-8">
      <h3 className="text-meta text-tinta-prosa">Por tema</h3>
      <ul className="mt-3">
        {filas.slice(0, 8).map((f) => (
          <Tema key={f.tema} fila={f} dias={dias} />
        ))}
      </ul>
    </div>
  );
}

function Figuras({
  figuras,
  roster,
}: {
  figuras: [string, number][];
  roster: ReturnType<typeof indexarRoster>;
}) {
  if (figuras.length === 0) return null;
  return (
    <div className="mt-8">
      <h3 className="text-meta text-tinta-prosa">Figuras mencionadas en comentarios</h3>
      <ul className="mt-2 max-w-sm">
        {figuras.map(([k, n]) => (
          <FilaConteo key={k} etiqueta={nombreCorto(k, roster)} valor={numero(n)} />
        ))}
      </ul>
      <p className="mt-2 text-meta text-tinta-meta">
        Menciones por nombre o cargo. Con volúmenes así de bajos es un conteo, no una
        tendencia, y nunca se cruza con el sentimiento.
      </p>
    </div>
  );
}

export function PanelConversacion({
  zona,
  lectura,
}: {
  zona: ZonaRuta | null;
  lectura?: ReactNode;
}) {
  const { data, error } = useConversacion();
  const { data: rosterDoc } = useRoster();

  if (error !== undefined) {
    return <p className="text-lectura text-tinta-prosa">No hay panel de conversación en este corte.</p>;
  }
  if (data === undefined) return <Esqueleto className="h-[260px]" />;

  const sinLlave = data.canales.length > 0 && data.canales.every((c) => c.estado === "sin_llave");
  const dias = data.retencion_dias;
  const v = vistaDeZona(data, zona);

  return (
    <Bisel interior="p-6 md:p-8">
      <Cabeza v={v} dias={dias} sinLlave={sinLlave} />
      <PorTema filas={v.filas} dias={dias} />
      <Figuras figuras={v.figuras} roster={indexarRoster(rosterDoc)} />

      <p className="mt-8 text-meta text-tinta-prosa">
        Se publican conteos y sentimiento agregado, nunca el texto de un comentario ni
        quién lo escribió. Retención de {dias} días por las Políticas para Desarrolladores
        de YouTube.
      </p>
      <ComoLeer>{lectura}</ComoLeer>
    </Bisel>
  );
}
