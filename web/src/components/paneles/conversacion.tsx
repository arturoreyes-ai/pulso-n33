"use client";

import type { ReactNode } from "react";

import { useConversacion, useRoster } from "@/lib/datos/hooks";
import type { Sentimiento } from "@/lib/datos/tipos";
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
        <h4 className="text-[15px] tracking-tight text-tinta-titulo">{fila.tema}</h4>
        <span className="text-2xs tabular-nums text-tinta-meta">
          {numero(fila.comentarios)} {pluralizar(fila.comentarios, "comentario", "comentarios")}
        </span>
      </div>
      <p className="mt-2 max-w-[70ch] text-sm leading-snug text-tinta-dato">{frase}</p>
      {s !== undefined && clasificados > 0 ? (
        <div className="mt-3 max-w-md">
          <BarraSentimiento s={s} ariaLabel={frase} />
        </div>
      ) : null}
      {meta.length > 0 ? <p className="mt-2 text-2xs text-tinta-meta">{meta.join("; ")}.</p> : null}
    </li>
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
    return <p className="text-sm text-tinta-prosa">No hay panel de conversación en este corte.</p>;
  }
  if (data === undefined) return <Esqueleto className="h-[260px]" />;

  const roster = indexarRoster(rosterDoc);
  const sinLlave = data.canales.length > 0 && data.canales.every((c) => c.estado === "sin_llave");
  const nombre = zona === null ? "la región" : NOMBRE_CORTO[zona];
  const dias = data.retencion_dias;
  const detalle = zona === null ? undefined : data.por_zona_detalle?.[zona];
  const total = zona === null ? data.comentarios_vigentes : (data.por_zona[zona] ?? 0);
  const sentimiento = zona === null ? data.sentimiento : detalle?.sentimiento;
  const clasificados = sentimiento === undefined ? 0 : F.totalSentimiento(sentimiento);
  const filas: FilaTema[] = zona === null ? (data.por_tema ?? []) : (detalle?.por_tema ?? []);
  const figuras = zona === null ? Object.entries(data.por_figura).slice(0, 8) : [];

  let cabeza: ReactNode;
  if (sinLlave) {
    cabeza = (
      <p className="max-w-[70ch] text-sm leading-relaxed text-tinta-prosa">
        Sin llave de la API de YouTube configurada, así que no hay comentarios que
        medir. El resto del tablero funciona igual: es degradación esperada, no una
        falla.
      </p>
    );
  } else if (total === 0) {
    cabeza = (
      <p className="max-w-[70ch] text-sm leading-relaxed text-tinta-prosa">
        {zona === null
          ? `Sin comentarios vigentes en los últimos ${dias} días.`
          : `Sin comentarios atribuidos a ${nombre} en los últimos ${dias} días.`}
      </p>
    );
  } else {
    let frase =
      sentimiento !== undefined && clasificados > 0
        ? F.fraseSentimiento(sentimiento, nombre, dias)
        : `${numero(total)} comentarios sobre ${nombre} en ${dias} días; sin clasificación de sentimiento en este corte.`;
    if (zona === null && data.sentimiento !== undefined && data.sentimiento.sin_clasificar > 0) {
      frase += ` ${numero(data.sentimiento.sin_clasificar)} siguen sin clasificar.`;
    }
    cabeza = (
      <>
        <p className="max-w-[70ch] text-base leading-snug text-tinta-titulo">{frase}</p>
        {sentimiento !== undefined && clasificados > 0 ? (
          <div className="mt-4 max-w-lg">
            <BarraSentimiento s={sentimiento} ariaLabel={frase} />
          </div>
        ) : null}
        {detalle === undefined ? null : (
          <p className="mt-3 text-xs text-tinta-prosa">
            {numero(detalle.interacciones)} likes y respuestas; {detalle.preguntas}{" "}
            {pluralizar(detalle.preguntas, "pregunta", "preguntas")}.
          </p>
        )}
      </>
    );
  }

  return (
    <Bisel opaco interior="p-6 md:p-8">
      {cabeza}

      {filas.length > 0 ? (
        <div className="mt-8">
          <h3 className="text-xs text-tinta-prosa">Por tema</h3>
          <ul className="mt-3">
            {filas.slice(0, 8).map((f) => (
              <Tema key={f.tema} fila={f} dias={dias} />
            ))}
          </ul>
        </div>
      ) : null}

      {figuras.length > 0 ? (
        <div className="mt-8">
          <h3 className="text-xs text-tinta-prosa">Figuras mencionadas en comentarios</h3>
          <ul className="mt-2 max-w-sm">
            {figuras.map(([k, n]) => (
              <FilaConteo key={k} etiqueta={nombreCorto(k, roster)} valor={numero(n)} />
            ))}
          </ul>
          <p className="mt-2 text-2xs text-tinta-meta">
            Menciones por nombre o cargo. Con volúmenes así de bajos es un conteo, no una
            tendencia, y nunca se cruza con el sentimiento.
          </p>
        </div>
      ) : null}

      <p className="mt-8 text-xs leading-relaxed text-tinta-prosa">
        Se publican conteos y sentimiento agregado, nunca el texto de un comentario ni
        quién lo escribió. Retención de {dias} días por las Políticas para Desarrolladores
        de YouTube.
      </p>
      <ComoLeer>{lectura}</ComoLeer>
    </Bisel>
  );
}
