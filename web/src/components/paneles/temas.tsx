"use client";

import { memo } from "react";

import { useTemas } from "@/lib/datos/hooks";
import type { DocTemas, Tema } from "@/lib/datos/tipos";
import { numero, pluralizar } from "@/lib/dominio/formato";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";
import { alternarTema, useFiltroTema } from "@/lib/muro/filtro-tema";
import { Bisel } from "@/components/ui/bisel";
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

      {/* `py-2.5 -my-2.5`: BLANCO DE TOQUE sin mover nada. El termino es el
          control que filtra el muro y median 25px de alto, el de una linea de
          texto; con el relleno y el margen negativo que lo cancela el area
          pulsable queda en 45px y la maqueta no se entera. Se puede porque
          nada de lo que rodea a este boton es pulsable: la numeracion es un
          `<span>` absoluto, las zonas un `<p>` y los ejemplos `<li>` de texto
          plano, asi que el area crecida no le roba el toque a ningun vecino.
          Las filas van a `gap-7`, 28px, de modo que dos areas crecidas siguen
          sin tocarse. */}
      <button
        type="button"
        aria-pressed={activo}
        onClick={() => alternarTema(t.notas)}
        className={`-my-2.5 py-2.5 text-left transition-colors ${
          activo ? "text-chart-1-texto" : "text-tinta-titulo hover:text-chart-1-texto"
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

/**
 * Que lista de temas toca, y con que rotulo. Son TRES casos y antes estaban
 * como un ternario anidado mas cuatro derivaciones con `?.` y `??` sueltas:
 * la region, la zona con desglose propio, y la zona de un corte viejo del
 * pipeline que todavia no trae `por_zona`. El tercero es un SUSTITUTO -- temas
 * regionales que mencionan la zona -- y por eso se rotula distinto.
 */
interface VistaTemas {
  nombre: string | null;
  lista: Tema[];
  minimo: number;
  notasVentana: number;
  desglosado: boolean;
}

function vistaDeTemas(data: DocTemas, zona: ZonaRuta | null): VistaTemas {
  if (zona === null) {
    return {
      nombre: null,
      lista: data.temas.slice(0, 12),
      minimo: data.minimo,
      notasVentana: data.notas_ventana,
      desglosado: true,
    };
  }
  const nombre = NOMBRE_CORTO[zona];
  const bloque = data.por_zona?.[zona];
  if (bloque !== undefined) {
    return {
      nombre,
      lista: bloque.temas.slice(0, 8),
      minimo: bloque.minimo,
      notasVentana: bloque.notas_ventana,
      desglosado: true,
    };
  }
  return {
    nombre,
    lista: data.temas.filter((t) => (t.zonas[zona] ?? 0) > 0).slice(0, 8),
    minimo: data.minimo,
    notasVentana: data.notas_ventana,
    desglosado: false,
  };
}

/** El rotulo de arriba: los mismos tres casos, como guardas. */
function fraseTemas(v: VistaTemas, dias: number): string {
  if (v.nombre === null) {
    return `${numero(v.notasVentana)} notas en ${dias} días, mínimo ${v.minimo} por tema.`;
  }
  if (v.desglosado) {
    return `${numero(v.notasVentana)} notas sobre ${v.nombre} en ${dias} días, mínimo ${v.minimo} por tema.`;
  }
  return `Temas regionales que mencionan ${v.nombre}; todavía no hay un desglose propio de la zona.`;
}

function SinTemas({
  v,
  dias,
}: {
  v: VistaTemas;
  dias: number;
}) {
  return (
    <Bisel interior="p-6 md:p-8">
      <p className="max-w-[65ch] text-lectura text-tinta-prosa">
        {v.nombre === null
          ? `Ningún tema alcanzó el mínimo de ${v.minimo} notas en la ventana de ${dias} días.`
          : `Ningún tema alcanzó el mínimo de ${v.minimo} notas sobre ${v.nombre} en ${dias} días. `}
        {v.nombre === null ? null : (
          <>
            Las notas individuales están en el{" "}
            <a href="#muro" className="text-tinta-titulo underline decoration-tinta-inerte underline-offset-2 hover:decoration-tinta-prosa">
              muro
            </a>
            .
          </>
        )}
      </p>
    </Bisel>
  );
}

export function PanelTemas({ zona }: { zona: ZonaRuta | null }) {
  const { data, error } = useTemas();
  const temaIds = useFiltroTema();

  if (error !== undefined) return <p className="text-lectura text-baja">No se pudo leer temas.json.</p>;
  if (data === undefined) return <Esqueleto className="h-[420px]" />;

  const v = vistaDeTemas(data, zona);
  const dias = data.ventana_dias;
  const hayMomento = data.notas_previas >= MIN_PREVIAS;

  if (v.lista.length === 0) return <SinTemas v={v} dias={dias} />;

  return (
    <Bisel interior="p-6 md:p-8">
      <p className="text-meta text-tinta-prosa">{fraseTemas(v, dias)}</p>

      <ol className="mt-6 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
        {v.lista.map((t, i) => (
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
    </Bisel>
  );
}
