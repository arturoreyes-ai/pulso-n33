"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useConversacion, useEstado, useFuentes, useIndicadores } from "@/lib/datos/hooks";
import type { DocConversacion, DocEstado, DocFuentes, DocIndicadores, Fuente } from "@/lib/datos/tipos";
import { numero } from "@/lib/dominio/formato";
import { claveShf } from "@/lib/dominio/indicadores";
import {
  NACIONAL,
  NOMBRE_CORTO,
  ZONAS_PRODUCTO,
  ZONAS_RUTA,
  rutaDeZona,
  type ZonaRuta,
} from "@/lib/dominio/zonas";
import { Bisel } from "@/components/ui/bisel";
import { Barra, Esqueleto, FilaConteo, Hueco } from "@/components/ui/primitivas";

const FILAS = [...ZONAS_PRODUCTO, NACIONAL];

const esZonaRuta = (s: string): s is ZonaRuta => (ZONAS_RUTA as readonly string[]).includes(s);

type Canal = DocConversacion["canales"][number];

/* ------------------------------------------------------------------ filas */

function FilaFuente({ f }: { f: Fuente }) {
  return (
    <li
      className="flex items-baseline gap-3 text-xs"
      title={
        f.estado === "ok"
          ? f.url
          : `${f.error ?? ""}${f.ultima_ok === null ? "" : `; último éxito: ${f.ultima_ok}`}`
      }
    >
      <span className="min-w-0 truncate text-white/85">{f.nombre}</span>
      {/* El color no es el unico portador: va la palabra y el detalle. */}
      <span className={`shrink-0 ${f.estado === "ok" ? "text-sube/80" : "text-baja/90"}`}>
        {f.estado}
      </span>
      <span className="ml-auto shrink-0 truncate text-right tabular-nums text-white/45">
        {f.estado === "ok" ? `${f.obtenidas} notas, ${f.ms} ms` : (f.error ?? "fallo").slice(0, 34)}
      </span>
    </li>
  );
}

function FilaCanal({ c }: { c: Canal }) {
  return (
    <li className="flex items-baseline gap-3 text-xs" title={c.error ?? undefined}>
      <span className="min-w-0 truncate text-white/85">{c.nombre}</span>
      <span className={`shrink-0 ${c.estado === "ok" ? "text-sube/80" : "text-aviso/90"}`}>
        {c.estado === "sin_llave" ? "sin llave" : c.estado}
      </span>
      <span className="ml-auto shrink-0 tabular-nums text-white/45">
        {c.estado === "ok" ? `${c.videos} videos, ${numero(c.comentarios)} comentarios` : ""}
      </span>
    </li>
  );
}

/* ----------------------------------------------------------------- region */

function Region({
  estado,
  fuentes,
  conv,
}: {
  estado: DocEstado;
  fuentes: DocFuentes | undefined;
  conv: DocConversacion | undefined;
}) {
  // Normalizado al MAXIMO, nunca a un total: por_zona suma mas que
  // notas_total porque una nota puede contar en varias zonas.
  const max = FILAS.reduce((m, z) => Math.max(m, estado.por_zona[z] ?? 0), 0);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Bisel opaco interior="p-6 md:p-8">
        <h3 className="text-base tracking-tight text-white">Notas por zona</h3>
        <ul className="mt-6 grid gap-2.5">
          {FILAS.map((z) => {
            const n = estado.por_zona[z] ?? 0;
            const etiqueta: ReactNode = esZonaRuta(z) ? (
              <Link
                href={rutaDeZona(z)}
                className="transition-colors duration-700 ease-firma hover:text-chart-1"
              >
                {NOMBRE_CORTO[z]}
              </Link>
            ) : (
              z
            );
            return (
              <li
                key={z}
                className="grid grid-cols-[8.5rem_1fr_5.5rem] items-center gap-3 text-xs"
              >
                <span className={n === 0 ? "text-aviso/80" : "text-white/80"}>{etiqueta}</span>
                <Barra fraccion={max === 0 ? 0 : n / max} />
                <span className="text-right tabular-nums">
                  {n === 0 ? (
                    <Hueco titulo="Ninguna nota atribuida a esta zona en el corte">
                      sin cobertura
                    </Hueco>
                  ) : (
                    <span className="text-white/70">{numero(n)}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 max-w-[65ch] border-t border-white/[0.06] pt-4 text-xs leading-relaxed text-white/50">
          Una nota que habla de dos zonas cuenta en las dos, así que la suma es mayor
          que el total. Las de fuera de la región se descartan antes de contar. Un cero
          se rotula: significa que no medimos ahí, no que no pase nada.
        </p>
      </Bisel>

      <div className="grid gap-6">
        <Bisel opaco interior="p-6 md:p-8">
          <h3 className="text-base tracking-tight text-white">Salud de las fuentes de prensa</h3>
          {fuentes === undefined ? (
            <Esqueleto className="mt-6 h-[260px]" />
          ) : (
            <ul className="mt-6 grid gap-1.5">
              {fuentes.fuentes.map((f) => (
                <FilaFuente key={f.id} f={f} />
              ))}
            </ul>
          )}
        </Bisel>

        {conv === undefined || conv.canales.length === 0 ? null : (
          <Bisel opaco interior="p-6 md:p-8">
            <h3 className="text-base tracking-tight text-white">Canales de YouTube</h3>
            <ul className="mt-6 grid gap-1.5">
              {conv.canales.map((c) => (
                <FilaCanal key={c.id} c={c} />
              ))}
            </ul>
          </Bisel>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- zona */

function Disponible({ si, texto }: { si: boolean; texto: string }) {
  return si ? <span className="text-sube/85">sí</span> : <Hueco titulo={texto}>sin dato</Hueco>;
}

function Zona({
  zona,
  estado,
  fuentes,
  conv,
  ind,
}: {
  zona: ZonaRuta;
  estado: DocEstado;
  fuentes: DocFuentes | undefined;
  conv: DocConversacion | undefined;
  ind: DocIndicadores | undefined;
}) {
  const nombre = NOMBRE_CORTO[zona];
  const n = estado.por_zona[zona] ?? 0;
  const max = FILAS.reduce((m, z) => Math.max(m, estado.por_zona[z] ?? 0), 0);

  const conZona = fuentes?.fuentes.some((f) => f.zona !== undefined) ?? false;
  const propias = fuentes?.fuentes.filter((f) => f.zona === zona) ?? [];
  const estatales = fuentes?.fuentes.filter((f) => f.zona === "estatal") ?? [];
  const canales = conv?.canales.filter((c) => c.zona === zona) ?? [];

  const I = ind?.indicadores;
  const sd = zona === "San Diego";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Bisel opaco interior="p-6 md:p-8">
        <h3 className="text-base tracking-tight text-white">Fuentes que cubren {nombre}</h3>
        <div className="mt-5 grid grid-cols-[8.5rem_1fr_5.5rem] items-center gap-3 text-xs">
          <span className="text-white/80">Notas en {estado.ventana_dias} días</span>
          <Barra fraccion={max === 0 ? 0 : n / max} />
          <span className="text-right tabular-nums text-white/70">{numero(n)}</span>
        </div>
        <p className="mt-2 text-2xs text-white/45">
          La barra compara contra la zona con más notas del corte.
        </p>

        {fuentes === undefined ? (
          <Esqueleto className="mt-6 h-[160px]" />
        ) : !conZona ? (
          <>
            <p className="mt-6 text-xs text-white/55">
              Este corte no trae la zona de cada medio; se listan todas las fuentes.
            </p>
            <ul className="mt-3 grid gap-1.5">
              {fuentes.fuentes.map((f) => (
                <FilaFuente key={f.id} f={f} />
              ))}
            </ul>
          </>
        ) : (
          <>
            <h4 className="mt-6 text-xs text-white/55">Medios de {nombre}</h4>
            {propias.length === 0 ? (
              <p className="mt-2 text-sm text-white/65">
                Ningún medio del catálogo tiene a {nombre} como cobertura principal. Las
                notas llegan de cables y de medios de otras zonas cuando nombran el lugar.
              </p>
            ) : (
              <ul className="mt-2 grid gap-1.5">
                {propias.map((f) => (
                  <FilaFuente key={f.id} f={f} />
                ))}
              </ul>
            )}
            {estatales.length === 0 ? null : (
              <>
                <h4 className="mt-6 text-xs text-white/55">Cables y medios estatales</h4>
                <ul className="mt-2 grid gap-1.5">
                  {estatales.map((f) => (
                    <FilaFuente key={f.id} f={f} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        {conv === undefined ? null : (
          <>
            <h4 className="mt-6 text-xs text-white/55">Canales de YouTube de {nombre}</h4>
            {canales.length === 0 ? (
              <p className="mt-2 text-sm text-white/65">
                Sin canal verificado para {nombre}. Los comentarios atribuidos a la zona
                vienen de videos que la nombran.
              </p>
            ) : (
              <ul className="mt-2 grid gap-1.5">
                {canales.map((c) => (
                  <FilaCanal key={c.id} c={c} />
                ))}
              </ul>
            )}
          </>
        )}
      </Bisel>

      <Bisel opaco interior="p-6 md:p-8">
        <h3 className="text-base tracking-tight text-white">Indicadores disponibles para {nombre}</h3>
        {I === undefined ? (
          <Esqueleto className="mt-6 h-[200px]" />
        ) : sd ? (
          <ul className="mt-6">
            <FilaConteo
              etiqueta="Valor catastral (SANDAG)"
              valor={<Disponible si={I.san_diego !== undefined} texto="Sin padrón catastral en este corte" />}
            />
            {["Precio de vivienda (SHF)", "Predial (SHCP)", "Delitos (SESNSP)", "Percepción (ENSU)"].map(
              (k) => (
                <FilaConteo
                  key={k}
                  etiqueta={k}
                  atenuada
                  valor={<Hueco titulo="Fuente mexicana; mide municipios de Baja California">no aplica</Hueco>}
                />
              ),
            )}
          </ul>
        ) : (
          <ul className="mt-6">
            <FilaConteo
              etiqueta="Precio de vivienda (SHF)"
              valor={
                <Disponible
                  si={I.shf?.series[claveShf(zona)] !== undefined}
                  texto="La SHF no publica índice para este municipio"
                />
              }
            />
            <FilaConteo
              etiqueta="Predial (SHCP)"
              valor={<Disponible si={I.predial?.municipios[zona] !== undefined} texto="Sin registro de predial" />}
            />
            <FilaConteo
              etiqueta="Delitos (SESNSP)"
              valor={<Disponible si={I.sesnsp?.municipios[zona] !== undefined} texto="Sin serie del SESNSP" />}
            />
            <FilaConteo
              etiqueta="Percepción (ENSU)"
              valor={
                I.ensu?.ciudades[zona] !== undefined ? (
                  <span className="text-sube/85">sí</span>
                ) : (
                  <Hueco titulo="La ENSU nunca ha muestreado esta ciudad">fuera de muestra</Hueco>
                )
              }
            />
          </ul>
        )}
        <p className="mt-6 max-w-[65ch] border-t border-white/[0.06] pt-4 text-xs leading-relaxed text-white/50">
          Lo que falta no se rellena con ceros ni se infiere de otras zonas. El índice
          SHF solo existe para Tijuana y Mexicali; la ENSU nunca ha muestreado Ensenada,
          Tecate, Rosarito, San Quintín ni San Felipe.
        </p>
      </Bisel>
    </div>
  );
}

/* ------------------------------------------------------------------ panel */

export function PanelCobertura({ zona }: { zona: ZonaRuta | null }) {
  const { data: estado } = useEstado();
  const { data: fuentes } = useFuentes();
  const { data: conv } = useConversacion();
  const { data: ind } = useIndicadores();

  if (estado === undefined) return <Esqueleto className="h-[420px]" />;

  return zona === null ? (
    <Region estado={estado} fuentes={fuentes} conv={conv} />
  ) : (
    <Zona zona={zona} estado={estado} fuentes={fuentes} conv={conv} ind={ind} />
  );
}
