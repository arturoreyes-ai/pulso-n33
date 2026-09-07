"use client";

import { useMemo } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";

import { useRoster } from "@/lib/datos/hooks";
import { nombreDeFiltro } from "@/lib/dominio/delegaciones";
import { numero } from "@/lib/dominio/formato";
import { indexarRoster } from "@/lib/dominio/roster";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";
import { limpiarTema } from "@/lib/muro/filtro-tema";
import type { Orden } from "@/lib/muro/use-muro";
import { useMuro } from "@/lib/muro/use-muro";
import { Bisel } from "@/components/ui/bisel";
import { Chip, Esqueleto } from "@/components/ui/primitivas";
import { GrupoZona } from "./grupo-zona";
import { SelectorDelegacion } from "./selector-delegacion";

const ORDENES: { clave: Orden; nombre: string }[] = [
  { clave: "reciente", nombre: "Recientes" },
  { clave: "antiguo", nombre: "Antiguas" },
];

/**
 * Cuantas filas abre cada grupo.
 *
 * En la vista regional hay NUEVE grupos a la vez, asi que el corte tiene que
 * dejar llegar a Tecate sin scrollear las 205 de Tijuana. En la pagina de una
 * zona hay un solo grupo y el corte puede ser mas generoso.
 */
const INICIAL_REGION = 6;
const INICIAL_ZONA = 25;
const PASO = 25;

export function Muro({ zona }: { zona: ZonaRuta | null }) {
  const m = useMuro(zona);
  const { data: rosterDoc } = useRoster();
  const roster = useMemo(() => indexarRoster(rosterDoc), [rosterDoc]);

  if (m.error !== undefined) {
    return (
      <p className="text-lectura text-baja">
        No se pudo leer notas.json. Corre{" "}
        <code className="text-tinta-titulo">python -m pulso correr</code>.
      </p>
    );
  }
  if (m.cargando) return <Esqueleto className="h-[600px]" />;

  const nombre = zona === null ? null : NOMBRE_CORTO[zona];
  // Con delegacion activa la linea de conteo dice cual; sin ella, la zona.
  const sujeto = m.delegacion === null ? nombre : nombreDeFiltro(m.delegacion);
  const agrupado = zona === null;

  return (
    <Bisel interior="p-4 md:p-8">
      {/* Barra de filtros. Sticky con blur: elemento fijo y area chica, que es
          el caso donde el blur si esta permitido. Deja de ser sticky en movil
          porque ocuparia media pantalla. La zona ya no se elige aqui: es la
          pagina.

          `top` es `--nav-alto`, no un 24 a ojo: la barra atraca EXACTAMENTE
          contra la pildora flotante. Con el 24 quedaba una banda de 20px
          entre las dos y las filas pasaban por ahi a opacidad completa. */}
      <div className="sticky top-[var(--nav-alto)] z-[var(--z-elevado)] -mx-4 mb-6 border-b border-vela bg-carta/85 px-4 py-3 backdrop-blur-md md:-mx-8 md:px-8 max-sm:static max-sm:bg-transparent max-sm:backdrop-blur-none">
        <div className="flex flex-wrap items-center gap-3">
          <div role="search" className="relative">
            <MagnifyingGlass
              size={14}
              weight="light"
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-meta"
            />
            <input
              type="search"
              value={m.consulta}
              onChange={(e) => m.setConsulta(e.target.value)}
              placeholder="Buscar en los titulares"
              aria-label="Buscar en los titulares"
              className="w-56 rounded-full border border-filo bg-vela py-2 pr-3 pl-8 text-cuerpo text-tinta-titulo placeholder:text-tinta-meta"
            />
          </div>

          <div role="group" aria-label="Orden" className="flex gap-1">
            {ORDENES.map((o) => (
              <Chip
                key={o.clave}
                activo={m.orden === o.clave}
                onClick={() => m.elegirOrden(o.clave)}
              >
                {o.nombre}
              </Chip>
            ))}
          </div>

          {m.temaIds.size > 0 ? (
            <button
              type="button"
              onClick={limpiarTema}
              className="inline-flex items-center gap-1.5 rounded-full bg-chart-1/15 px-3 py-2 text-meta text-chart-1-texto transition-colors hover:bg-chart-1/25"
            >
              <X size={12} weight="light" aria-hidden />
              filtrado por tema
            </button>
          ) : null}

          {/* aria-live SOLO en la linea de conteo. Ponerlo en el muro
              anunciaria cientos de filas. */}
          <p aria-live="polite" className="ml-auto text-meta tabular-nums text-tinta-meta">
            {numero(m.visibles)}
            {m.desfasado ? "…" : ""}
            {sujeto === null ? " de " : ` notas sobre ${sujeto} de `}
            {numero(m.totalVentana)}
            {m.ventanaDias === null ? "" : ` en ${m.ventanaDias} días`}
          </p>
        </div>

        {/* Solo Tijuana se subdivide. La fila va junto a la lista que filtra,
            no en el encabezado, para que el efecto se vea donde se toca.

            El mapa de poligonos queda fuera POR AHORA: ver
            `mapa-delegaciones.tsx`, que sigue en el arbol sin consumidor. */}
        {m.conteoDelegaciones === null ? null : (
          <div className="mt-3">
            <SelectorDelegacion
              activa={m.delegacion}
              conteo={m.conteoDelegaciones}
              onElegir={m.elegirDelegacion}
            />
          </div>
        )}
      </div>

      {/* `pendiente` viene de useTransition: la lista se atenua mientras el
          render ancho corre, en vez de bloquear el control. */}
      <div
        data-pendiente={m.pendiente ? "" : undefined}
        className={`transition-opacity duration-[var(--dur-cambio)] ease-firma ${
          m.pendiente ? "opacity-60" : "opacity-100"
        }`}
      >
        {m.grupos.length === 0 ? (
          <p className="py-16 text-center text-lectura text-tinta-prosa">
            {m.totalVentana > 0
              ? sujeto === null
                ? "Sin notas que coincidan con este filtro."
                : `Sin notas sobre ${sujeto} que coincidan con este filtro.`
              : "Sin notas todavía. Corre el pipeline."}
          </p>
        ) : (
          m.grupos.map((g) => (
            <GrupoZona
              key={g.zona}
              grupo={g}
              corte={m.corte}
              roster={roster}
              conCabecera={agrupado}
              inicial={agrupado ? INICIAL_REGION : INICIAL_ZONA}
              paso={PASO}
            />
          ))
        )}
      </div>

      {/* Lo que NO esta en el muro, dicho en el muro. Las dos exclusiones van
          en el mismo pie porque las dos contestan la misma pregunta: por que
          la cifra de arriba no llega al total de la ventana. */}
      {zona === null && (m.fuera > 0 || m.nacionales > 0) ? (
        <p className="mt-10 border-t border-vela pt-5 text-meta text-tinta-prosa">
          {m.fuera > 0 ? (
            <>
              {numero(m.fuera)} notas de fuera de la región quedaron descartadas. Vienen
              de cables de grupo: el feed de El Imparcial trae al periódico entero y la
              mayoría de sus notas son de Sonora.{" "}
            </>
          ) : null}
          {m.nacionales > 0 ? (
            <>
              {numero(m.nacionales)} notas nacionales quedaron fuera del muro: su titular
              no nombra ningún lugar de la región. Siguen contadas en «Qué se cubre y qué
              no».
            </>
          ) : null}
        </p>
      ) : null}
    </Bisel>
  );
}
