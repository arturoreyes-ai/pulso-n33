"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useIndicadores } from "@/lib/datos/hooks";
import type { DocIndicadores, PanelSesnsp } from "@/lib/datos/tipos";
import { dolares, nombreMes, numero, pesos } from "@/lib/dominio/formato";
import * as F from "@/lib/dominio/frases";
import { ZIPS_FRONTERA, claveShf, periodoLegible } from "@/lib/dominio/indicadores";
import { ruta } from "@/lib/dominio/secciones";
import {
  MUNICIPIOS_BC,
  NOMBRE_CORTO,
  ZONAS_RUTA,
  type ZonaRuta,
} from "@/lib/dominio/zonas";
import { GRAFICAS } from "@/lib/graficas/registro";
import { ComoLeer } from "@/components/ui/como-leer";
import { Barra, Esqueleto, FilaConteo, Hueco, Signo } from "@/components/ui/primitivas";
import { Alternar, useVista } from "./alternar";
import { Tarjeta } from "./tarjeta";

type Ind = DocIndicadores["indicadores"];

const esZonaRuta = (s: string): s is ZonaRuta => (ZONAS_RUTA as readonly string[]).includes(s);

/** El nombre de una zona como enlace a su pagina; cualquier otra cosa, texto. */
function enlaceZona(nombre: string): ReactNode {
  if (!esZonaRuta(nombre)) return nombre;
  return (
    <Link
      href={ruta(nombre, "indicadores")}
      className="transition-colors hover:text-chart-1-texto"
    >
      {NOMBRE_CORTO[nombre]}
    </Link>
  );
}

/* -------------------------------------------------------------- crimen */

/**
 * El crimen es la unica fuente con serie de tiempo, asi que es la unica que
 * ofrece vista de grafica. La lista sigue siendo la vista por omision.
 */
function TarjetaCrimenRegion({ panel }: { panel: PanelSesnsp }) {
  const { vista, setVista, intento } = useVista("crimen");
  const Grafica = GRAFICAS.crimen;

  return (
    <Tarjeta
      titulo="Crimen reportado, acumulado del año"
      fuente={panel.fuente}
      periodo={panel.periodo}
      aviso={panel.aviso}
      className="md:col-span-8"
      extra={<Alternar vista={vista} onVista={setVista} onIntento={intento} />}
    >
      {vista === "grafica" ? (
        <Grafica panel={panel} />
      ) : (
        <ul>
          {MUNICIPIOS_BC.map((z) => {
            const m = panel.municipios[z];
            if (m === undefined) return null;
            return (
              <FilaConteo
                key={z}
                etiqueta={enlaceZona(z)}
                valor={numero(m.total)}
                titulo={Object.entries(m.delitos_clave)
                  .slice(0, 4)
                  .map(([d, n]) => `${d}: ${n}`)
                  .join(", ")}
              />
            );
          })}
        </ul>
      )}
    </Tarjeta>
  );
}

function TarjetaCrimenZona({ panel, zona }: { panel: PanelSesnsp; zona: ZonaRuta }) {
  const { vista, setVista, intento } = useVista("crimenZona");
  const Grafica = GRAFICAS.crimenZona;
  const m = panel.municipios[zona];
  const nombre = NOMBRE_CORTO[zona];
  if (m === undefined) return null;

  const clave = Object.entries(m.delitos_clave).toSorted((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...clave.map(([, n]) => n));

  return (
    <Tarjeta
      titulo={`Delitos reportados en ${nombre}, por mes`}
      fuente={panel.fuente}
      periodo={panel.periodo}
      aviso={panel.aviso}
      className="md:col-span-8"
      extra={<Alternar vista={vista} onVista={setVista} onIntento={intento} />}
    >
      <p className="max-w-[70ch] text-lectura text-tinta-dato">{F.fraseCrimen(m, nombre)}</p>
      {vista === "grafica" ? (
        <div className="mt-4">
          <Grafica panel={panel} municipio={zona} />
        </div>
      ) : (
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <ul>
            {/* La llave es el MES, no la posicion: la identidad de la fila es
                "enero", y el indice solo es donde cae hoy en el arreglo. */}
            {m.por_mes.map((v, i) => (
              <FilaConteo
                key={nombreMes(i)}
                etiqueta={nombreMes(i)}
                valor={
                  <span className="inline-flex items-baseline gap-3">
                    <span>{numero(v)}</span>
                    {i === 0 ? null : <Signo v={F.variacionPct(v, m.por_mes[i - 1])} invertir />}
                  </span>
                }
              />
            ))}
          </ul>
          <div>
            <p className="text-meta text-tinta-prosa">{F.fraseDelitosClave(m)}</p>
            <ul className="mt-3 grid gap-2.5">
              {clave.map(([d, n]) => (
                <li
                  key={d}
                  className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-3 text-meta"
                >
                  <span className="truncate text-tinta-dato" title={d}>
                    {d}
                  </span>
                  <Barra fraccion={n / max} color="var(--color-chart-5)" />
                  <span className="text-right tabular-nums text-tinta-dato">{numero(n)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Tarjeta>
  );
}

/* -------------------------------------------------------------- region */

function Region({ I }: { I: Ind }) {
  const sesnsp = I.sesnsp;
  const predial = I.predial;
  const ensu = I.ensu;
  const sd = I.san_diego;
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
      {I.shf === undefined ? null : (
        <Tarjeta
          titulo="Vivienda, variación anual"
          fuente={I.shf.fuente}
          periodo={periodoLegible(I.shf.periodo)}
          aviso={I.shf.aviso}
          className="md:col-span-8"
        >
          <ul>
            {Object.entries(I.shf.series)
              .toSorted(
                (a, b) =>
                  (b[1].variacion_anual_pct ?? -Infinity) - (a[1].variacion_anual_pct ?? -Infinity),
              )
              .map(([k, s]) => (
                <FilaConteo
                  key={k}
                  etiqueta={enlaceZona(k.replace("Baja California · ", ""))}
                  valor={<Signo v={s.variacion_anual_pct} decimales={2} />}
                  titulo={`${s.trimestres} trimestres de serie`}
                />
              ))}
            {/* Los municipios sin cobertura se rotulan. Nunca una barra en
                cero, que se leeria como "no subio" en vez de "no hay dato". */}
            {I.shf.sin_cobertura.map((z) => (
              <FilaConteo
                key={z}
                etiqueta={enlaceZona(z)}
                atenuada
                valor={<Hueco titulo="La SHF no publica índice para este municipio">sin dato</Hueco>}
              />
            ))}
          </ul>
          <p className="mt-4 text-meta text-tinta-prosa">{I.shf.universo}</p>
        </Tarjeta>
      )}

      {ensu === undefined ? null : (
        <Tarjeta
          titulo="Percepción de inseguridad"
          fuente={ensu.fuente}
          periodo={periodoLegible(ensu.periodo)}
          aviso={ensu.cobertura}
          className="md:col-span-4"
        >
          <ul>
            {Object.entries(ensu.ciudades).map(([k, c]) => (
              <FilaConteo
                key={k}
                etiqueta={enlaceZona(k)}
                valor={c.pct_inseguro === null ? "sin dato" : `${F.decimal(c.pct_inseguro)}%`}
                titulo={`${numero(c.poblacion_18mas)} personas de 18 años y más`}
              />
            ))}
            <FilaConteo
              etiqueta="Nacional"
              valor={
                ensu.nacional.pct_inseguro === null
                  ? "sin dato"
                  : `${F.decimal(ensu.nacional.pct_inseguro)}%`
              }
            />
            {MUNICIPIOS_BC.filter((z) => ensu.ciudades[z] === undefined).map((z) => (
              <FilaConteo
                key={z}
                etiqueta={enlaceZona(z)}
                atenuada
                valor={
                  <Hueco titulo="La ENSU nunca ha muestreado esta ciudad">fuera de muestra</Hueco>
                }
              />
            ))}
          </ul>
        </Tarjeta>
      )}

      {sesnsp === undefined ? null : <TarjetaCrimenRegion panel={sesnsp} />}

      {predial === undefined ? null : (
        <Tarjeta
          titulo="Suelo, predial por cuenta"
          fuente={predial.fuente}
          periodo={predial.periodo}
          aviso={predial.aviso}
          className="md:col-span-4"
        >
          {/* Ordenado por VARIACION, no por nivel: la fuente advierte que los
              niveles no sirven para rankear municipios. */}
          <ul>
            {MUNICIPIOS_BC.flatMap((z) => {
              const m = predial.municipios[z];
              return m === undefined ? [] : [[z, m] as const];
            })
              .toSorted(
                (a, b) =>
                  (b[1].variacion_anual_pct ?? -Infinity) - (a[1].variacion_anual_pct ?? -Infinity),
              )
              .map(([z, m]) => (
                <FilaConteo
                  key={z}
                  etiqueta={enlaceZona(z)}
                  valor={
                    <span className="inline-flex items-baseline gap-3">
                      <span className="text-tinta-dato">{pesos(m.por_cuenta_mxn)}</span>
                      <Signo v={m.variacion_anual_pct} />
                    </span>
                  }
                  titulo={`${numero(m.cuentas_pagadas)} cuentas pagadas`}
                />
              ))}
          </ul>
        </Tarjeta>
      )}

      {sd === undefined ? null : (
        <Tarjeta
          titulo="San Diego, valor catastral mediano"
          fuente={sd.fuente}
          aviso={sd.aviso}
          className="md:col-span-4"
        >
          <ul>
            {ZIPS_FRONTERA.map((c) => {
              const z = sd.zips[c];
              if (z === undefined) return null;
              return (
                <FilaConteo
                  key={c}
                  etiqueta={c}
                  valor={dolares(z.mediana_usd)}
                  titulo={`${numero(z.parcelas)} parcelas`}
                />
              );
            })}
          </ul>
          <p className="mt-4 text-meta text-tinta-prosa">
            {sd.faltantes} De {numero(Object.keys(sd.zips).length)} códigos postales, aquí se
            muestran los de la franja fronteriza.{" "}
            <Link href={ruta("San Diego", "indicadores")} className="text-tinta-dato underline decoration-tinta-inerte underline-offset-2 hover:decoration-tinta-prosa">
              Ver San Diego
            </Link>
            .
          </p>
        </Tarjeta>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- municipio */

/**
 * Cinco tarjetas independientes, una por fuente.
 *
 * Cada una se guarda a si misma: `Municipio` era un solo componente con cinco
 * ramas `X === undefined ? null : <Tarjeta>` y sus derivaciones intercaladas,
 * asi que para cambiar la tarjeta de predial habia que leer las otras cuatro.
 * Ahora la ausencia de una fuente se decide en el unico lugar que la usa.
 */
function TarjetaVivienda({
  shf,
  zona,
  nombre,
}: {
  shf: Ind["shf"];
  zona: ZonaRuta;
  nombre: string;
}) {
  if (shf === undefined) return null;
  const serie = shf.series[claveShf(zona)];
  const bc = shf.series["Baja California"];
  const nac = shf.series["Nacional"];
  return (
    <Tarjeta
      titulo="Vivienda, variación anual"
      fuente={shf.fuente}
      periodo={periodoLegible(shf.periodo)}
      aviso={shf.aviso}
      className="md:col-span-4"
    >
      <ul>
        <FilaConteo
          etiqueta={nombre}
          atenuada={serie === undefined}
          valor={
            serie === undefined ? (
              <Hueco titulo="La SHF no publica índice para este municipio">sin dato</Hueco>
            ) : (
              <Signo v={serie.variacion_anual_pct} decimales={2} />
            )
          }
        />
        {bc === undefined ? null : (
          <FilaConteo
            etiqueta="Baja California, referencia"
            valor={<Signo v={bc.variacion_anual_pct} decimales={2} />}
          />
        )}
        {nac === undefined ? null : (
          <FilaConteo
            etiqueta="Nacional, referencia"
            valor={<Signo v={nac.variacion_anual_pct} decimales={2} />}
          />
        )}
      </ul>
      <p className="mt-4 text-lectura text-tinta-prosa">
        {F.fraseVivienda(serie, nombre, shf.periodo)}
      </p>
    </Tarjeta>
  );
}

function TarjetaPredial({
  predial,
  zona,
  nombre,
}: {
  predial: Ind["predial"];
  zona: ZonaRuta;
  nombre: string;
}) {
  if (predial === undefined) return null;
  const m = predial.municipios[zona];
  return (
    <Tarjeta
      titulo="Suelo, predial por cuenta"
      fuente={predial.fuente}
      periodo={predial.periodo}
      aviso={predial.aviso}
      className="md:col-span-4"
    >
      {m === undefined ? (
        <Hueco titulo="Sin registro de predial para este municipio">sin dato</Hueco>
      ) : (
        <>
          <p className="text-cifra tabular-nums text-tinta-titulo">
            {pesos(m.por_cuenta_mxn)}{" "}
            <span className="text-lectura">
              <Signo v={m.variacion_anual_pct} />
            </span>
          </p>
          <p className="mt-3 text-lectura text-tinta-prosa">
            {F.frasePredial(m, nombre)} {numero(m.cuentas_pagadas)} cuentas pagadas,{" "}
            {m.ciclos} ciclos de serie.
          </p>
        </>
      )}
    </Tarjeta>
  );
}

function TarjetaPercepcion({
  ensu,
  zona,
  nombre,
}: {
  ensu: Ind["ensu"];
  zona: ZonaRuta;
  nombre: string;
}) {
  if (ensu === undefined) return null;
  const e = ensu.ciudades[zona];
  // "Fuera de muestra" y "sin dato" no son lo mismo: la ENSU nunca muestreo
  // estas ciudades, no es que este corte no las traiga.
  const fueraDeMuestra = e === undefined || e.pct_inseguro === null;
  return (
    <Tarjeta
      titulo="Percepción de inseguridad"
      fuente={ensu.fuente}
      periodo={periodoLegible(ensu.periodo)}
      aviso={ensu.cobertura}
      className="md:col-span-4"
    >
      <ul>
        <FilaConteo
          etiqueta={nombre}
          atenuada={fueraDeMuestra}
          valor={
            e === undefined || e.pct_inseguro === null ? (
              <Hueco titulo="La ENSU nunca ha muestreado esta ciudad">fuera de muestra</Hueco>
            ) : (
              `${F.decimal(e.pct_inseguro)}%`
            )
          }
        />
        <FilaConteo
          etiqueta="Nacional"
          valor={
            ensu.nacional.pct_inseguro === null
              ? "sin dato"
              : `${F.decimal(ensu.nacional.pct_inseguro)}%`
          }
        />
      </ul>
      <p className="mt-4 text-lectura text-tinta-prosa">
        {F.frasePercepcion(e, nombre, ensu.nacional.pct_inseguro, ensu.periodo)}
      </p>
    </Tarjeta>
  );
}

function TarjetaOtrosMunicipios({
  sesnsp,
  zona,
}: {
  sesnsp: Ind["sesnsp"];
  zona: ZonaRuta;
}) {
  if (sesnsp === undefined) return null;
  return (
    <Tarjeta
      titulo="Otros municipios, delitos en el año"
      fuente={sesnsp.fuente}
      periodo={sesnsp.periodo}
      aviso="Para contexto. Los totales no son per cápita: comparan volumen, no riesgo."
      className="md:col-span-4"
    >
      <ul>
        {/* Una sola pasada, con las dos razones de omitir un municipio juntas
            y a la vista: es el de esta pagina, o el corte no lo trae. */}
        {MUNICIPIOS_BC.map((z) => {
          if (z === zona) return null;
          const o = sesnsp.municipios[z];
          if (o === undefined) return null;
          return <FilaConteo key={z} etiqueta={enlaceZona(z)} valor={numero(o.total)} />;
        })}
      </ul>
    </Tarjeta>
  );
}

function Municipio({ I, zona }: { I: Ind; zona: ZonaRuta }) {
  const nombre = NOMBRE_CORTO[zona];
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
      <TarjetaVivienda shf={I.shf} zona={zona} nombre={nombre} />
      {I.sesnsp === undefined ? null : <TarjetaCrimenZona panel={I.sesnsp} zona={zona} />}
      <TarjetaPredial predial={I.predial} zona={zona} nombre={nombre} />
      <TarjetaPercepcion ensu={I.ensu} zona={zona} nombre={nombre} />
      <TarjetaOtrosMunicipios sesnsp={I.sesnsp} zona={zona} />
    </div>
  );
}

/* ----------------------------------------------------------- san diego */

function SanDiego({ I }: { I: Ind }) {
  const sd = I.san_diego;
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
      {sd === undefined ? null : (
        <Tarjeta
          titulo="Valor catastral mediano por código postal"
          fuente={sd.fuente}
          aviso={sd.aviso}
          className="md:col-span-8"
        >
          <p className="max-w-[70ch] text-lectura text-tinta-dato">
            {F.fraseSanDiego(sd.zips, ZIPS_FRONTERA)}
          </p>
          <ul className="mt-4">
            {ZIPS_FRONTERA.map((c) => {
              const z = sd.zips[c];
              if (z === undefined) return null;
              return (
                <FilaConteo
                  key={c}
                  etiqueta={c}
                  valor={dolares(z.mediana_usd)}
                  titulo={`${numero(z.parcelas)} parcelas`}
                />
              );
            })}
          </ul>
          <p className="mt-4 text-meta text-tinta-prosa">
            {sd.faltantes} De {numero(Object.keys(sd.zips).length)} códigos postales, aquí se
            muestran los de la franja fronteriza.
          </p>
        </Tarjeta>
      )}

      <Tarjeta titulo="Indicadores mexicanos" fuente="SHF, SHCP, SESNSP e INEGI" className="md:col-span-4">
        <p className="text-lectura text-tinta-prosa">
          El índice de vivienda, el predial, la incidencia delictiva y la ENSU miden
          municipios de Baja California y no aplican a San Diego. Para el lado
          mexicano de la garita,{" "}
          <Link
            href={ruta("Tijuana", "indicadores")}
            className="text-tinta-titulo underline decoration-tinta-inerte underline-offset-2 hover:decoration-tinta-prosa"
          >
            ver Tijuana
          </Link>
          .
        </p>
      </Tarjeta>
    </div>
  );
}

/* --------------------------------------------------------------- panel */

export function PanelIndicadores({
  zona,
  lectura,
}: {
  zona: ZonaRuta | null;
  lectura?: ReactNode;
}) {
  const { data, error } = useIndicadores();

  if (error !== undefined) {
    return (
      <p className="text-lectura text-baja">
        No se pudo leer indicadores.json. Corre{" "}
        <code className="text-tinta-titulo">python -m pulso indicadores</code>.
      </p>
    );
  }
  if (data === undefined) {
    return (
      <div className="grid gap-6 md:grid-cols-12">
        <Esqueleto className="h-[340px] md:col-span-8" />
        <Esqueleto className="h-[340px] md:col-span-4" />
      </div>
    );
  }

  const I = data.indicadores;
  const fallos = data.salud.filter((s) => s.estado === "fallo");

  return (
    <>
      {zona === null ? (
        <Region I={I} />
      ) : zona === "San Diego" ? (
        <SanDiego I={I} />
      ) : (
        <Municipio I={I} zona={zona} />
      )}
      {fallos.length > 0 ? (
        <p className="mt-6 text-meta text-tinta-prosa">
          No se pudo actualizar: {fallos.map((f) => f.id).join(", ")}.
        </p>
      ) : null}
      <ComoLeer>{lectura}</ComoLeer>
    </>
  );
}
