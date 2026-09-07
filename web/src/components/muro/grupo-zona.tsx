"use client";

import Link from "next/link";
import { memo, useEffect, useRef, useState } from "react";

import type { Figura } from "@/lib/datos/tipos";
import { numero } from "@/lib/dominio/formato";
import { NOMBRE_CORTO, ZONAS_RUTA, rutaDeZona, type ZonaRuta } from "@/lib/dominio/zonas";
import type { Grupo } from "@/lib/muro/indexar";
import { NotaFila } from "./nota-fila";

const esZonaRuta = (s: string): s is ZonaRuta => (ZONAS_RUTA as readonly string[]).includes(s);

/**
 * Un grupo del muro: la cabecera de zona, sus filas y el corte.
 *
 * A nivel de modulo y memoizado: definirlo dentro del padre remontaria todo
 * el grupo en cada render y perderia la posicion de scroll.
 *
 * EL CORTE. Sin el, la vista regional pinta las 579 filas de las nueve zonas
 * seguidas y las 205 de Tijuana entierran a Tecate; una seccion que se llama
 * "Titulares por zona" acababa siendo el unico lugar donde no se ven las
 * zonas. El corte no esconde nada: la cabecera dice el total del grupo, el
 * pie dice cuantas van, y el nombre de la zona ya es el enlace a su pagina.
 */
const GrupoBase = function GrupoZona({
  grupo,
  corte,
  roster,
  conCabecera,
  inicial,
  paso,
}: {
  grupo: Grupo;
  corte: number;
  roster: Map<string, Figura>;
  conCabecera: boolean;
  /** Filas abiertas de entrada. */
  inicial: number;
  /** Cuantas suma cada toque del pie. */
  paso: number;
}) {
  // El limite se reinicia cuando cambia la LISTA, no en cada render:
  // `indexar` crea un arreglo nuevo por cada filtro y por cada orden, asi que
  // su identidad es exactamente la senal que buscamos. Ajustar estado durante
  // el render es mas barato que un efecto: no hay un frame con el limite
  // viejo sobre la lista nueva.
  const [vistas, setVistas] = useState(grupo.notas);
  const [limite, setLimite] = useState(inicial);
  if (vistas !== grupo.notas) {
    setVistas(grupo.notas);
    setLimite(inicial);
  }

  const total = grupo.notas.length;
  const abiertas = Math.min(limite, total);
  const restantes = total - abiertas;

  // Al ampliar, el foco va al primer titular nuevo y no se queda en un boton
  // que ya dice otra cosa. Con raton no pinta anillo (:focus-visible), asi
  // que solo se nota donde hace falta.
  const lista = useRef<HTMLDivElement>(null);
  const aEnfocar = useRef<number | null>(null);
  useEffect(() => {
    const i = aEnfocar.current;
    if (i === null) return;
    aEnfocar.current = null;
    lista.current?.querySelectorAll("article")[i]?.querySelector("a")?.focus();
  }, [limite]);

  const ampliar = () => {
    aEnfocar.current = abiertas;
    setLimite(abiertas + paso);
  };

  return (
    <section className="mt-10 first:mt-0">
      {conCabecera ? (
        <h3 className="flex items-center gap-4 text-sm text-white/70">
          {esZonaRuta(grupo.zona) ? (
            <Link
              href={rutaDeZona(grupo.zona)}
              className="transition-colors duration-700 ease-firma hover:text-chart-1"
              title={`Ver solo ${NOMBRE_CORTO[grupo.zona]}`}
            >
              {grupo.zona}
            </Link>
          ) : (
            <span>{grupo.zona}</span>
          )}
          <span aria-hidden className="h-px flex-1 bg-white/[0.08]" />
          <span className="text-2xs tabular-nums text-white/40">{numero(total)}</span>
        </h3>
      ) : null}

      <div ref={lista} className={conCabecera ? "mt-2" : ""}>
        {grupo.notas.slice(0, abiertas).map((n) => (
          <NotaFila key={n.id} nota={n} corte={corte} roster={roster} />
        ))}
      </div>

      {/* El pie repite la figura de la cabecera —rotulo, filo, cifra— para que
          los dos extremos del grupo se lean como un par y no como un boton
          pegado abajo. */}
      {restantes > 0 ? (
        <button
          type="button"
          onClick={ampliar}
          className="group mt-1 flex w-full items-center gap-4 py-2.5 text-left text-[13px] text-white/55 transition-colors duration-700 ease-firma hover:text-white"
        >
          <span>
            {restantes > paso
              ? `Mostrar ${numero(paso)} más`
              : restantes === 1
                ? "Mostrar la última"
                : `Mostrar las ${numero(restantes)} restantes`}
          </span>
          <span
            aria-hidden
            className="h-px flex-1 bg-white/[0.08] transition-colors duration-700 ease-firma group-hover:bg-white/20"
          />
          <span className="text-2xs tabular-nums text-white/35">
            {numero(abiertas)} de {numero(total)}
          </span>
        </button>
      ) : null}
    </section>
  );
};

export const GrupoZona = memo(GrupoBase);
