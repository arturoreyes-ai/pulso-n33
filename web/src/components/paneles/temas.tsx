"use client";

import { memo, type ReactNode } from "react";

import { useTemas } from "@/lib/datos/hooks";
import type { Tema } from "@/lib/datos/tipos";
import { numero, pluralizar } from "@/lib/dominio/formato";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";
import { alternarTema, useFiltroTema } from "@/lib/muro/filtro-tema";
import { Bisel } from "@/components/ui/bisel";
import { ComoLeer } from "@/components/ui/como-leer";
import { Esqueleto } from "@/components/ui/primitivas";

/**
 * Sin dos ventanas comparables el momento es ruido: en las primeras corridas
 * la ventana anterior esta casi vacia porque un feed RSS solo trae lo
 * reciente, y TODO saldria como "subiendo". Se oculta hasta que haya
 * historia.
 */
const MIN_PREVIAS = 20;

/** A nivel de modulo y memoizada: nunca definida dentro del padre. */
const FilaTema = memo(function FilaTema({
  t,
  indice,
  hayMomento,
  activo,
  ejemplos,
  mostrarZonas,
}: {
  t: Tema;
  indice: number;
  hayMomento: boolean;
  activo: boolean;
  /** Cuantos titulares reales mostrar debajo del tema. */
  ejemplos: number;
  mostrarZonas: boolean;
}) {
  return (
    <li className="relative pl-7">
      <span className="absolute top-0.5 left-0 text-meta tabular-nums text-tinta-meta">
        {indice + 1}
      </span>

      <button
        type="button"
        aria-pressed={activo}
        onClick={() => alternarTema(t.notas)}
        className={`text-left transition-colors ${
          activo ? "text-chart-1" : "text-tinta-titulo hover:text-chart-1"
        }`}
      >
        <span className="text-lectura">{t.termino}</span>
      </button>

      <span className="ml-2 text-meta tabular-nums text-tinta-meta">
        {t.n} {pluralizar(t.n, "nota", "notas")}
      </span>

      {hayMomento && t.momento !== 0 ? (
        <span
          className={`ml-2 rounded-etiqueta px-1 text-meta font-semibold tabular-nums ${
            t.momento > 0 ? "bg-sube/15 text-sube" : "bg-vela text-tinta-meta"
          }`}
          title={`contra las ${t.n_previo} de la ventana anterior`}
        >
          {t.momento > 0 ? "▲ +" : "▼ "}
          {t.momento}
        </span>
      ) : null}

      {t.un_solo_medio ? (
        <span
          className="ml-2 rounded-etiqueta border border-aviso/30 px-1.5 py-px text-meta text-aviso"
          title="Un tema sostenido por un medio es la agenda de ese medio, no de la región"
        >
          un solo medio
        </span>
      ) : null}

      {mostrarZonas ? (
        <p className="mt-1 text-meta text-tinta-meta">
          {Object.entries(t.zonas)
            .slice(0, 4)
            .map(([z, n]) => `${z} ${n}`)
            .join(", ")}
        </p>
      ) : null}

      {ejemplos > 0 && t.ejemplos.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {t.ejemplos.slice(0, ejemplos).map((e) => (
            <li key={e} className="text-cuerpo text-tinta-prosa">
              {e}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
});

export function PanelTemas({ zona, lectura }: { zona: ZonaRuta | null; lectura?: ReactNode }) {
  const { data, error } = useTemas();
  const temaIds = useFiltroTema();

  if (error !== undefined) return <p className="text-lectura text-baja">No se pudo leer temas.json.</p>;
  if (data === undefined) return <Esqueleto className="h-[420px]" />;

  const nombre = zona === null ? null : NOMBRE_CORTO[zona];
  const bloque = zona === null ? undefined : data.por_zona?.[zona];
  // Sin bloque por zona (corte viejo del pipeline) se filtran los temas
  // regionales que mencionan la zona, y se dice que es un sustituto.
  const desglosado = zona === null || bloque !== undefined;
  const lista =
    zona === null
      ? data.temas.slice(0, 12)
      : bloque !== undefined
        ? bloque.temas.slice(0, 8)
        : data.temas.filter((t) => (t.zonas[zona] ?? 0) > 0).slice(0, 8);
  const minimo = bloque?.minimo ?? data.minimo;
  const notasVentana = bloque?.notas_ventana ?? data.notas_ventana;
  const hayMomento = data.notas_previas >= MIN_PREVIAS;

  if (lista.length === 0) {
    return (
      <Bisel interior="p-6 md:p-8">
        <p className="max-w-[65ch] text-lectura text-tinta-prosa">
          {nombre === null
            ? `Ningún tema alcanzó el mínimo de ${minimo} notas en la ventana de ${data.ventana_dias} días.`
            : `Ningún tema alcanzó el mínimo de ${minimo} notas sobre ${nombre} en ${data.ventana_dias} días. `}
          {nombre === null ? null : (
            <>
              Las notas individuales están en el{" "}
              <a href="#muro" className="text-tinta-titulo underline decoration-tinta-inerte underline-offset-2 hover:decoration-tinta-prosa">
                muro
              </a>
              .
            </>
          )}
        </p>
        <ComoLeer>{lectura}</ComoLeer>
      </Bisel>
    );
  }

  return (
    <Bisel interior="p-6 md:p-8">
      <p className="text-meta text-tinta-prosa">
        {nombre === null
          ? `${numero(notasVentana)} notas en ${data.ventana_dias} días, mínimo ${minimo} por tema.`
          : desglosado
            ? `${numero(notasVentana)} notas sobre ${nombre} en ${data.ventana_dias} días, mínimo ${minimo} por tema.`
            : `Temas regionales que mencionan ${nombre}; el desglose propio de la zona llega con el siguiente corte del pipeline.`}
      </p>

      <ol className="mt-6 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((t, i) => (
          <FilaTema
            key={t.termino}
            t={t}
            indice={i}
            hayMomento={hayMomento}
            activo={t.notas.length > 0 && t.notas.every((id) => temaIds.has(id))}
            ejemplos={zona === null ? 1 : 3}
            mostrarZonas={zona === null}
          />
        ))}
      </ol>

      <p className="mt-6 text-meta text-tinta-prosa">
        Toca un tema para filtrar el muro de titulares.
        {hayMomento
          ? ""
          : ` La tendencia aparece cuando haya dos ventanas comparables; la anterior tiene ${data.notas_previas} notas.`}
      </p>
      <ComoLeer>{lectura}</ComoLeer>
    </Bisel>
  );
}
