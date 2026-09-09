"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useConversacion, useEstado, useFuentes, useIndicadores } from "@/lib/datos/hooks";
import type { DocConversacion, DocEstado, DocFuentes, DocIndicadores, Fuente } from "@/lib/datos/tipos";
import { numero } from "@/lib/dominio/formato";
import { claveShf } from "@/lib/dominio/indicadores";
import { ruta } from "@/lib/dominio/secciones";
import {
  NACIONAL,
  NOMBRE_CORTO,
  ZONAS_PRODUCTO,
  ZONAS_RUTA,
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
      className="flex items-baseline gap-3 text-meta"
      title={
        f.estado === "ok"
          ? f.url
          : `${f.error ?? ""}${f.ultima_ok === null ? "" : `; último éxito: ${f.ultima_ok}`}`
      }
    >
      <span className="min-w-0 truncate text-tinta-dato">{f.nombre}</span>
      {/* El color no es el unico portador: va la palabra y el detalle. */}
      <span className={`shrink-0 ${f.estado === "ok" ? "text-sube/80" : "text-baja/90"}`}>
        {f.estado}
      </span>
      <span className="ml-auto shrink-0 truncate text-right tabular-nums text-tinta-meta">
        {f.estado === "ok" ? `${f.obtenidas} notas, ${f.ms} ms` : (f.error ?? "fallo").slice(0, 34)}
      </span>
    </li>
  );
}

function FilaCanal({ c }: { c: Canal }) {
  return (
    <li className="flex items-baseline gap-3 text-meta" title={c.error ?? undefined}>
      <span className="min-w-0 truncate text-tinta-dato">{c.nombre}</span>
      <span className={`shrink-0 ${c.estado === "ok" ? "text-sube/80" : "text-aviso/90"}`}>
        {c.estado === "sin_llave" ? "sin llave" : c.estado}
      </span>
      <span className="ml-auto shrink-0 tabular-nums text-tinta-meta">
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
      <Bisel interior="p-6 md:p-8">
        <h3 className="text-rotulo text-tinta-titulo">Notas por zona</h3>
        <ul className="mt-6 grid gap-2.5">
          {FILAS.map((z) => {
            const n = estado.por_zona[z] ?? 0;
            const etiqueta: ReactNode = esZonaRuta(z) ? (
              <Link
                href={ruta(z, "cobertura")}
                className="transition-colors hover:text-chart-1-texto"
              >
                {NOMBRE_CORTO[z]}
              </Link>
            ) : (
              z
            );
            return (
              <li
                key={z}
                className="grid grid-cols-[8.5rem_1fr_5.5rem] items-center gap-3 text-meta"
              >
                <span className={n === 0 ? "text-aviso/80" : "text-tinta-dato"}>{etiqueta}</span>
                <Barra fraccion={max === 0 ? 0 : n / max} />
                <span className="text-right tabular-nums">
                  {n === 0 ? (
                    <Hueco titulo="Ninguna nota atribuida a esta zona en el corte">
                      sin cobertura
                    </Hueco>
                  ) : (
                    <span className="text-tinta-dato">{numero(n)}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 max-w-[65ch] border-t border-vela pt-4 text-meta text-tinta-prosa">
          Una nota que habla de dos zonas cuenta en las dos, así que la suma es mayor
          que el total. Las de fuera de la región se descartan antes de contar. Un cero
          se rotula: significa que no medimos ahí, no que no pase nada.
        </p>
      </Bisel>

      <div className="grid gap-6">
        <Bisel interior="p-6 md:p-8">
          <h3 className="text-rotulo text-tinta-titulo">Salud de las fuentes de prensa</h3>
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
          <Bisel interior="p-6 md:p-8">
            <h3 className="text-rotulo text-tinta-titulo">Canales de YouTube</h3>
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

/** Una lista de fuentes, o la razon de que este vacia. */
function Medios({ nombre, propias }: { nombre: string; propias: Fuente[] }) {
  return (
    <>
      <h4 className="mt-6 text-meta text-tinta-prosa">Medios de {nombre}</h4>
      {propias.length === 0 ? (
        <p className="mt-2 text-lectura text-tinta-prosa">
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
    </>
  );
}

function Estatales({ estatales }: { estatales: Fuente[] }) {
  if (estatales.length === 0) return null;
  return (
    <>
      <h4 className="mt-6 text-meta text-tinta-prosa">Cables y medios estatales</h4>
      <ul className="mt-2 grid gap-1.5">
        {estatales.map((f) => (
          <FilaFuente key={f.id} f={f} />
        ))}
      </ul>
    </>
  );
}

function CanalesDeZona({ nombre, canales }: { nombre: string; canales: Canal[] }) {
  return (
    <>
      <h4 className="mt-6 text-meta text-tinta-prosa">Canales de YouTube de {nombre}</h4>
      {canales.length === 0 ? (
        <p className="mt-2 text-lectura text-tinta-prosa">
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
  );
}

/**
 * El bloque de medios, en tres casos mutuamente excluyentes y como guardas.
 *
 * El del medio importa: los cortes viejos no traen `zona` por fuente, y sin
 * ese dato la unica salida honesta es listar todas y decirlo.
 */
function BloqueMedios({
  nombre,
  fuentes,
  propias,
  estatales,
}: {
  nombre: string;
  fuentes: DocFuentes | undefined;
  propias: Fuente[];
  estatales: Fuente[];
}) {
  if (fuentes === undefined) return <Esqueleto className="mt-6 h-[160px]" />;
  if (!fuentes.fuentes.some((f) => f.zona !== undefined)) {
    return (
      <>
        <p className="mt-6 text-meta text-tinta-prosa">
          Este corte no trae la zona de cada medio; se listan todas las fuentes.
        </p>
        <ul className="mt-3 grid gap-1.5">
          {fuentes.fuentes.map((f) => (
            <FilaFuente key={f.id} f={f} />
          ))}
        </ul>
      </>
    );
  }
  return (
    <>
      <Medios nombre={nombre} propias={propias} />
      <Estatales estatales={estatales} />
    </>
  );
}

/** Tarjeta izquierda: quien cubre la zona. */
function FuentesDeZona({
  zona,
  nombre,
  estado,
  fuentes,
  conv,
}: {
  zona: ZonaRuta;
  nombre: string;
  estado: DocEstado;
  fuentes: DocFuentes | undefined;
  conv: DocConversacion | undefined;
}) {
  const n = estado.por_zona[zona] ?? 0;
  const max = FILAS.reduce((m, z) => Math.max(m, estado.por_zona[z] ?? 0), 0);
  const propias = fuentes?.fuentes.filter((f) => f.zona === zona) ?? [];
  const estatales = fuentes?.fuentes.filter((f) => f.zona === "estatal") ?? [];
  const canales = conv?.canales.filter((c) => c.zona === zona) ?? [];

  return (
    <Bisel interior="p-6 md:p-8">
      <h3 className="text-rotulo text-tinta-titulo">Fuentes que cubren {nombre}</h3>
      <div className="mt-5 grid grid-cols-[8.5rem_1fr_5.5rem] items-center gap-3 text-meta">
        <span className="text-tinta-dato">Notas en {estado.ventana_dias} días</span>
        <Barra fraccion={max === 0 ? 0 : n / max} />
        <span className="text-right tabular-nums text-tinta-dato">{numero(n)}</span>
      </div>
      <p className="mt-2 text-meta text-tinta-meta">
        La barra compara contra la zona con más notas del corte.
      </p>

      <BloqueMedios nombre={nombre} fuentes={fuentes} propias={propias} estatales={estatales} />
      {conv === undefined ? null : <CanalesDeZona nombre={nombre} canales={canales} />}
    </Bisel>
  );
}

/**
 * San Diego mide con otra vara: solo trae catastral, y las cuatro fuentes
 * mexicanas se rotulan "no aplica" en vez de "sin dato". No es lo mismo y el
 * tablero no los confunde.
 */
function IndicadoresSanDiego({ I }: { I: NonNullable<DocIndicadores["indicadores"]> }) {
  return (
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
  );
}

function IndicadoresMunicipio({
  zona,
  I,
}: {
  zona: ZonaRuta;
  I: NonNullable<DocIndicadores["indicadores"]>;
}) {
  return (
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
  );
}

/** Tarjeta derecha: que indicadores existen para la zona. */
function IndicadoresDeZona({
  zona,
  nombre,
  ind,
}: {
  zona: ZonaRuta;
  nombre: string;
  ind: DocIndicadores | undefined;
}) {
  const I = ind?.indicadores;
  return (
    <Bisel interior="p-6 md:p-8">
      <h3 className="text-rotulo text-tinta-titulo">Indicadores disponibles para {nombre}</h3>
      {I === undefined ? (
        <Esqueleto className="mt-6 h-[200px]" />
      ) : zona === "San Diego" ? (
        <IndicadoresSanDiego I={I} />
      ) : (
        <IndicadoresMunicipio zona={zona} I={I} />
      )}
      <p className="mt-6 max-w-[65ch] border-t border-vela pt-4 text-meta text-tinta-prosa">
        Lo que falta no se rellena con ceros ni se infiere de otras zonas. El índice
        SHF solo existe para Tijuana y Mexicali; la ENSU nunca ha muestreado Ensenada,
        Tecate, Rosarito, San Quintín ni San Felipe.
      </p>
    </Bisel>
  );
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
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <FuentesDeZona zona={zona} nombre={nombre} estado={estado} fuentes={fuentes} conv={conv} />
      <IndicadoresDeZona zona={zona} nombre={nombre} ind={ind} />
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
