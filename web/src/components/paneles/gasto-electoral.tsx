"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

import { Bisel } from "@/components/ui/bisel";
import { clasesChip } from "@/components/ui/clases";
import { Segmentado } from "@/components/ui/segmentado";
import { Barra, Esqueleto, Hueco, Kpi } from "@/components/ui/primitivas";
import { useFinanciamientoPartidos, useGastoElectoral } from "@/lib/datos/hooks";
import type { CandidaturaGasto, DocFinanciamientoPartidos, DocGastoElectoral, FinanciamientoPartido } from "@/lib/datos/tipos";
import { plegar } from "@/lib/dominio/formato";
import { EstadoCarga } from "@/components/ui/estado-carga";

const MONEDA = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const ENTERO = new Intl.NumberFormat("es-MX");
const PanelPublicidadMeta = dynamic(() => import("./pauta-meta").then((m) => m.PanelPublicidadMeta), {
  loading: () => <div className="grid gap-4 rounded-panel border border-filo p-6">
    <EstadoCarga etiqueta="Abriendo Publicidad Meta" />
    <a className="text-meta text-tinta-dato underline underline-offset-4" href="/gasto-electoral?vista=meta">Si la carga no avanza, recargar la página</a>
  </div>,
});

const pesos = (n: number | null | undefined) =>
  n === null || n === undefined ? "sin dato" : MONEDA.format(n);

const porcentaje = (n: number | null) => (n === null ? "sin dato" : `${n.toFixed(1)}%`);

const ETIQUETAS_CATEGORIA: Record<keyof CandidaturaGasto["desglose_reportado"], string> = {
  propaganda: "Propaganda",
  operativos: "Operación de campaña",
  internet: "Internet y redes",
  via_publica: "Vía pública",
  utilitaria: "Propaganda utilitaria",
  radio_tv: "Radio y televisión",
  impresos: "Medios impresos",
  financieros: "Financieros",
  cine: "Cine",
};

const CAMPO =
  "w-full rounded-nucleo border border-filo bg-vanta px-4 py-3 text-cuerpo text-tinta-titulo placeholder:text-tinta-inerte";
/** La pastilla del tablero (ui/clases.ts). Era una propia, con borde. */
const BOTON = clasesChip(false);

function cambiarConsulta(
  actuales: URLSearchParams,
  cambios: Record<string, string | null>,
): string {
  const q = new URLSearchParams(actuales.toString());
  for (const [clave, valor] of Object.entries(cambios)) {
    if (valor === null || valor === "") q.delete(clave);
    else q.set(clave, valor);
  }
  const texto = q.toString();
  return `/gasto-electoral${texto ? `?${texto}` : ""}`;
}

function BarraDato({ etiqueta, valor, maximo, color }: {
  etiqueta: string;
  valor: number | null;
  maximo: number;
  color?: string;
}) {
  return (
    <li className="grid gap-2">
      <div className="flex items-baseline justify-between gap-4 text-meta">
        <span className="text-tinta-prosa">{etiqueta}</span>
        <span className="shrink-0 tabular-nums text-tinta-dato">{pesos(valor)}</span>
      </div>
      {valor === null ? <Hueco>sin dato</Hueco> : <Barra fraccion={maximo === 0 ? 0 : valor / maximo} color={color} />}
    </li>
  );
}

function TablaAlterna({ titulo, filas }: {
  titulo: string;
  filas: { etiqueta: string; valor: string }[];
}) {
  return (
    <details className="mt-5 border-t border-vela pt-4">
      <summary className="cursor-pointer text-meta text-tinta-meta hover:text-tinta-prosa">
        {titulo}
      </summary>
      <table className="mt-3 w-full text-meta">
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.etiqueta} className="border-b border-vela">
              <th scope="row" className="py-2 text-left font-normal text-tinta-prosa">
                {fila.etiqueta}
              </th>
              <td className="py-2 text-right tabular-nums text-tinta-dato">{fila.valor}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function Calendario() {
  return (
    <Bisel as="section" nivel="panel" interior="p-6 md:p-8">
      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
        <div>
          <p className="text-meta text-tinta-meta">Proceso 2026–2027</p>
          <h2 className="mt-2 text-rotulo text-tinta-titulo">Todavía no hay gasto de campaña de 2027</h2>
          <p className="mt-3 max-w-[62ch] text-cuerpo text-tinta-prosa">
            El proceso federal inició el 10 de septiembre de 2026; el local inicia el 6 de
            diciembre. Las precampañas comienzan el 4 de enero de 2027 y las campañas el 4 de
            abril. Esta página publica personas solo cuando existe un dictamen final auditado.
          </p>
          <a
            className="mt-5 inline-flex text-meta text-tinta-dato underline decoration-filo underline-offset-4 hover:decoration-tinta-dato"
            href="https://portal.ine.mx/voto-y-elecciones/elecciones-2027/baja-california-2027/"
            target="_blank"
            rel="noreferrer"
          >
            Consultar calendario oficial del INE
          </a>
        </div>
        <ol className="grid gap-3 text-meta">
          <li className="flex justify-between gap-4 border-b border-vela pb-2">
            <span className="text-tinta-prosa">Inicio local</span>
            <time className="tabular-nums text-tinta-dato" dateTime="2026-12-06">6 dic 2026</time>
          </li>
          <li className="flex justify-between gap-4 border-b border-vela pb-2">
            <span className="text-tinta-prosa">Precampañas</span>
            <time className="tabular-nums text-tinta-dato" dateTime="2027-01-04">4 ene 2027</time>
          </li>
          <li className="flex justify-between gap-4 border-b border-vela pb-2">
            <span className="text-tinta-prosa">Campañas</span>
            <time className="tabular-nums text-tinta-dato" dateTime="2027-04-04">4 abr 2027</time>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-tinta-prosa">Elección</span>
            <time className="tabular-nums text-tinta-dato" dateTime="2027-06-06">6 jun 2027</time>
          </li>
        </ol>
      </div>
    </Bisel>
  );
}

function Buscador({ candidaturas, seleccionada, alSeleccionar }: {
  candidaturas: CandidaturaGasto[];
  seleccionada: CandidaturaGasto | null;
  alSeleccionar: (c: CandidaturaGasto) => void;
}) {
  const parametros = useSearchParams();
  const router = useRouter();
  const [texto, setTexto] = useState(seleccionada?.nombre ?? "");
  const [abierto, setAbierto] = useState(false);
  const [indice, setIndice] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const ambito = parametros.get("ambito") ?? "todos";
  const cargo = parametros.get("cargo") ?? "todos";

  useEffect(() => {
    if (seleccionada) setTexto(seleccionada.nombre);
  }, [seleccionada]);

  useEffect(() => {
    const cerrar = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("pointerdown", cerrar);
    return () => document.removeEventListener("pointerdown", cerrar);
  }, []);

  const cargos = useMemo(
    () => [...new Set(candidaturas.map((c) => c.cargo))].toSorted((a, b) => a.localeCompare(b, "es")),
    [candidaturas],
  );
  const resultados = useMemo(() => {
    const consulta = plegar(texto);
    return candidaturas
      .filter((c) => ambito === "todos" || c.ambito === ambito)
      .filter((c) => cargo === "todos" || c.cargo === cargo)
      .filter((c) =>
        consulta.length < 2
          ? false
          : plegar(`${c.nombre} ${c.partido} ${c.cargo} ${c.contienda}`).includes(consulta),
      )
      .slice(0, 8);
  }, [ambito, candidaturas, cargo, texto]);

  const cambiarFiltro = (clave: "ambito" | "cargo", valor: string) => {
    router.replace(cambiarConsulta(parametros, { [clave]: valor === "todos" ? null : valor }));
    setAbierto(texto.trim().length >= 2);
  };

  return (
    <Bisel as="section" nivel="panel" interior="p-6 md:p-8">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(10rem,0.5fr)_minmax(14rem,0.7fr)]">
        <div ref={caja} className="relative">
          <label htmlFor="buscar-persona" className="mb-2 block text-cuerpo text-tinta-dato">
            Nombre, partido, cargo o contienda
          </label>
          <input
            id="buscar-persona"
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="resultados-personas"
            aria-expanded={abierto && resultados.length > 0}
            aria-activedescendant={abierto && resultados[indice] ? `persona-${resultados[indice].id}` : undefined}
            autoComplete="off"
            className={CAMPO}
            value={texto}
            placeholder="Ej. Norma Bustamante"
            onFocus={() => setAbierto(texto.trim().length >= 2)}
            onChange={(e) => {
              setTexto(e.target.value);
              setIndice(0);
              setAbierto(e.target.value.trim().length >= 2);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && resultados.length) {
                e.preventDefault();
                setAbierto(true);
                setIndice((i) => (i + 1) % resultados.length);
              } else if (e.key === "ArrowUp" && resultados.length) {
                e.preventDefault();
                setAbierto(true);
                setIndice((i) => (i - 1 + resultados.length) % resultados.length);
              } else if (e.key === "Enter" && abierto && resultados[indice]) {
                e.preventDefault();
                alSeleccionar(resultados[indice]);
                setAbierto(false);
              } else if (e.key === "Escape") {
                setAbierto(false);
              }
            }}
          />
          {abierto && resultados.length > 0 ? (
            <ul
              id="resultados-personas"
              role="listbox"
              className="absolute inset-x-0 top-full z-[var(--z-portal)] mt-2 max-h-80 overflow-y-auto rounded-nucleo border border-filo bg-carta p-2 shadow-bisel"
            >
              {resultados.map((c, i) => (
                <li
                  id={`persona-${c.id}`}
                  key={c.id}
                  role="option"
                  aria-selected={i === indice}
                  className={`cursor-pointer rounded-etiqueta px-3 py-3 ${i === indice ? "bg-realce" : "hover:bg-filo"}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    alSeleccionar(c);
                    setAbierto(false);
                  }}
                >
                  <span className="block text-cuerpo text-tinta-titulo">{c.nombre}</span>
                  <span className="mt-1 block text-meta text-tinta-meta">
                    {c.partido} · {c.contienda}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {abierto && texto.trim().length >= 2 && resultados.length === 0 ? (
            <p className="mt-2 text-meta text-aviso">Sin coincidencias en los perfiles conciliados.</p>
          ) : null}
        </div>
        <label className="text-cuerpo text-tinta-dato">
          <span className="mb-2 block">Ámbito</span>
          <select className={CAMPO} value={ambito} onChange={(e) => cambiarFiltro("ambito", e.target.value)}>
            <option value="todos">Todos</option>
            <option value="local">Local</option>
            <option value="federal">Federal</option>
          </select>
        </label>
        <label className="text-cuerpo text-tinta-dato">
          <span className="mb-2 block">Cargo</span>
          <select className={CAMPO} value={cargo} onChange={(e) => cambiarFiltro("cargo", e.target.value)}>
            <option value="todos">Todos</option>
            {cargos.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-4 text-meta text-tinta-meta">
        La búsqueda ignora mayúsculas y acentos. Usa el nombre oficial publicado por el INE.
      </p>
    </Bisel>
  );
}

function Perfil({ candidatura, pares, dictamen, dictamenUrl }: {
  candidatura: CandidaturaGasto;
  pares: CandidaturaGasto[];
  dictamen: string;
  dictamenUrl: string;
}) {
  const usado = candidatura.tope === null ? null : candidatura.gasto_auditado / candidatura.tope * 100;
  const categorias = Object.entries(candidatura.desglose_reportado)
    .map(([clave, valor]) => ({
      etiqueta: ETIQUETAS_CATEGORIA[clave as keyof CandidaturaGasto["desglose_reportado"]],
      valor,
    }))
    .toSorted((a, b) => (b.valor ?? -1) - (a.valor ?? -1));
  const maxCategoria = Math.max(...categorias.map((c) => c.valor ?? 0), 0);
  const paresOrdenados = pares.toSorted((a, b) => b.gasto_auditado - a.gasto_auditado);
  const maxPar = paresOrdenados[0]?.gasto_auditado ?? 0;
  const ajuste = candidatura.auditoria.determinado;

  return (
    <div className="grid gap-6">
      <Bisel as="article" nivel="panel" interior="p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-meta text-tinta-meta">{candidatura.contienda}</p>
            <h2 className="mt-2 font-titular text-seccion text-tinta-titulo">{candidatura.nombre}</h2>
            <p className="mt-3 text-cuerpo text-tinta-prosa">
              {candidatura.partido} · {candidatura.cargo} · ID contable {candidatura.id_contabilidad}
            </p>
          </div>
          <a className={BOTON} href={dictamenUrl} target="_blank" rel="noreferrer">
            {dictamen}
          </a>
        </div>
        <div className="mt-8 grid gap-8 border-t border-vela pt-8 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            etiqueta="Gasto final determinado"
            valor={pesos(candidatura.gasto_auditado)}
            frase="Cifra principal del Anexo II final."
            fuente="INE · auditoría final 2024"
          />
          <Kpi
            etiqueta="Originalmente reportado"
            valor={pesos(candidatura.gasto_reportado)}
            frase="Antes de hallazgos y ajustes de auditoría."
          />
          <Kpi
            etiqueta="Ajuste de auditoría"
            valor={`${ajuste > 0 ? "+" : ""}${pesos(ajuste)}`}
            frase="Diferencia conciliada contra el total final."
          />
          <Kpi
            etiqueta="Tope utilizado"
            valor={porcentaje(usado)}
            frase={candidatura.tope === null ? "El expediente no publicó tope." : `Tope: ${pesos(candidatura.tope)}.`}
            hueco={usado === null}
          />
        </div>
      </Bisel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Bisel as="section" nivel="panel" interior="p-6">
          <h3 className="text-rotulo text-tinta-titulo">Puente de conciliación</h3>
          <p className="mt-2 text-meta text-tinta-meta">Reportado → hallazgos y ajustes → total auditado</p>
          <ol className="mt-6 grid gap-5">
            <BarraDato etiqueta="Gasto reportado" valor={candidatura.gasto_reportado} maximo={candidatura.gasto_auditado} />
            <BarraDato
              etiqueta="Determinado por auditoría"
              valor={Math.abs(ajuste)}
              maximo={candidatura.gasto_auditado}
              color={ajuste < 0 ? "var(--color-baja)" : "var(--color-aviso)"}
            />
            <BarraDato
              etiqueta="Gasto final auditado"
              valor={candidatura.gasto_auditado}
              maximo={candidatura.gasto_auditado}
              color="var(--color-chart-2)"
            />
          </ol>
          <TablaAlterna titulo="ver conciliación como tabla" filas={[
            { etiqueta: "Gasto reportado", valor: pesos(candidatura.gasto_reportado) },
            { etiqueta: "No reportado", valor: pesos(candidatura.auditoria.no_reportado) },
            { etiqueta: "Ajustes o reclasificaciones", valor: pesos(candidatura.auditoria.ajustes_reclasificaciones) },
            { etiqueta: "Quejas", valor: pesos(candidatura.auditoria.quejas) },
            { etiqueta: "Determinado por auditoría", valor: pesos(ajuste) },
            { etiqueta: "Total final", valor: pesos(candidatura.gasto_auditado) },
          ]} />
        </Bisel>

        <Bisel as="section" nivel="panel" interior="p-6">
          <h3 className="text-rotulo text-tinta-titulo">Gasto reportado por categoría</h3>
          <p className="mt-2 text-meta text-tinta-meta">Categorías del reporte abierto; no son el total auditado.</p>
          <ul className="mt-6 grid gap-4">
            {categorias.map((c, i) => (
              <BarraDato
                key={c.etiqueta}
                etiqueta={c.etiqueta}
                valor={c.valor}
                maximo={maxCategoria}
                color={`var(--color-chart-${i % 6 + 1})`}
              />
            ))}
          </ul>
          <TablaAlterna titulo="ver categorías como tabla" filas={categorias.map((c) => ({
            etiqueta: c.etiqueta, valor: pesos(c.valor),
          }))} />
        </Bisel>
      </div>

      <Bisel as="section" nivel="panel" interior="p-6 md:p-8">
        <h3 className="text-rotulo text-tinta-titulo">Comparación en la misma contienda</h3>
        <p className="mt-2 text-meta text-tinta-meta">
          Solo {candidatura.contienda}; no se mezclan cargos ni distritos.
        </p>
        <ol className="mt-6 grid gap-4">
          {paresOrdenados.map((c) => (
            <li key={c.id} className={c.id === candidatura.id ? "rounded-nucleo bg-vela p-3" : "p-3"}>
              <div className="mb-2 flex items-baseline justify-between gap-4">
                <span className="min-w-0 truncate text-cuerpo text-tinta-prosa">
                  {c.nombre} <span className="text-tinta-meta">· {c.partido}</span>
                </span>
                <span className="shrink-0 tabular-nums text-meta text-tinta-dato">{pesos(c.gasto_auditado)}</span>
              </div>
              <Barra fraccion={maxPar === 0 ? 0 : c.gasto_auditado / maxPar} color={c.id === candidatura.id ? "var(--color-chart-2)" : undefined} />
            </li>
          ))}
        </ol>
        <TablaAlterna titulo="ver comparación como tabla" filas={paresOrdenados.map((c) => ({
          etiqueta: `${c.nombre} · ${c.partido}`, valor: pesos(c.gasto_auditado),
        }))} />
      </Bisel>
    </div>
  );
}

function Partidos({ partidos, totales, aviso, ejercicio, acuerdos }: {
  partidos: FinanciamientoPartido[];
  totales: { ordinario_vigente: number; especifico: number; asignado: number };
  aviso: string;
  ejercicio: number;
  acuerdos: { id: string; fecha: string; url: string }[];
}) {
  const ordenados = partidos.toSorted((a, b) => b.total_asignado - a.total_asignado);
  const maximo = ordenados[0]?.total_asignado ?? 0;
  return (
    <div className="grid gap-6">
      <Bisel as="section" nivel="panel" interior="p-6 md:p-8">
        <div className="grid gap-8 sm:grid-cols-3">
          <Kpi etiqueta={`Total asignado ${ejercicio}`} valor={pesos(totales.asignado)} frase={aviso} />
          <Kpi etiqueta="Actividades ordinarias" valor={pesos(totales.ordinario_vigente)} frase="Presupuesto anual vigente." />
          <Kpi etiqueta="Actividades específicas" valor={pesos(totales.especifico)} frase="Asignación anual separada." />
        </div>
      </Bisel>
      <Bisel as="section" nivel="panel" interior="p-6 md:p-8">
        <h2 className="text-rotulo text-tinta-titulo">Asignación por partido</h2>
        <p className="mt-2 max-w-[70ch] text-cuerpo text-aviso">{aviso}</p>
        <ol className="mt-8 grid gap-5">
          {ordenados.map((p, i) => (
            <li key={p.id}>
              <div className="mb-2 flex items-baseline justify-between gap-4">
                <span className="text-cuerpo text-tinta-prosa">{p.nombre}</span>
                <span className="shrink-0 tabular-nums text-meta text-tinta-dato">{pesos(p.total_asignado)}</span>
              </div>
              <Barra fraccion={maximo === 0 ? 0 : p.total_asignado / maximo} color={`var(--color-chart-${i % 6 + 1})`} />
              {p.excedente_ministrado === undefined ? null : (
                <p className="mt-2 text-meta text-aviso">
                  PES BC: se ministraron {pesos(p.ministrado_enero_mayo)} de enero a mayo;
                  {" "}{pesos(p.excedente_ministrado)} exceden el ordinario vigente tras el acuerdo correctivo.
                </p>
              )}
            </li>
          ))}
        </ol>
        <TablaAlterna titulo="ver asignaciones como tabla" filas={ordenados.map((p) => ({
          etiqueta: p.nombre,
          valor: `${pesos(p.ordinario_vigente)} ordinario + ${pesos(p.especifico)} específico = ${pesos(p.total_asignado)}`,
        }))} />
        <div className="mt-8 flex flex-wrap gap-3 border-t border-vela pt-5">
          {acuerdos.map((a) => (
            <a key={a.id} className={BOTON} href={a.url} target="_blank" rel="noreferrer">
              {a.id}
            </a>
          ))}
        </div>
      </Bisel>
    </div>
  );
}

type VistaGasto = "candidaturas" | "partidos" | "meta";

function SelectorVista({ vista, onChange }: { vista: VistaGasto; onChange: (vista: VistaGasto) => void }) {
  // El segmentado del tablero (ui/segmentado.tsx), como el alcance de la
  // portada: eran tres pastillas con borde propias de esta pagina.
  return (
    <Segmentado etiqueta="Vista de datos electorales" opciones={([
      ["candidaturas", "Candidaturas 2024"], ["partidos", "Partidos 2026"], ["meta", "Publicidad Meta"],
    ] as const).map(([id, nombre]) => ({ id, nombre, activo: vista === id, onElegir: () => onChange(id) }))} />
  );
}

function CandidaturasDisponibles({
  gasto,
  seleccionada,
  alSeleccionar,
}: {
  gasto: DocGastoElectoral;
  seleccionada: CandidaturaGasto | null;
  alSeleccionar: (candidatura: CandidaturaGasto) => void;
}) {
  return (
    <>
      <Buscador candidaturas={gasto.candidaturas} seleccionada={seleccionada} alSeleccionar={alSeleccionar} />
      {seleccionada ? (
        <Perfil
          candidatura={seleccionada}
          pares={gasto.candidaturas.filter((c) => c.contienda_id === seleccionada.contienda_id)}
          dictamen={gasto.procesos.find((p) => p.id === seleccionada.proceso)?.dictamen ?? "Dictamen final"}
          dictamenUrl={gasto.procesos.find((p) => p.id === seleccionada.proceso)?.dictamen_url ?? "#"}
        />
      ) : (
        <Bisel as="section" nivel="panel" interior="p-6 md:p-8">
          <div className="grid gap-8 sm:grid-cols-3">
            <Kpi etiqueta="Filas oficiales" valor={ENTERO.format(gasto.resumen.filas_origen)} frase="194 locales y 53 federales en Baja California." />
            <Kpi etiqueta="Perfiles conciliados" valor={ENTERO.format(gasto.resumen.candidaturas)} frase="Con total final del Anexo II." />
            <Kpi
              etiqueta="Sin conciliar"
              valor={gasto.resumen.sin_conciliar === 0 ? "Ninguna" : ENTERO.format(gasto.resumen.sin_conciliar)}
              frase={gasto.resumen.sin_conciliar === 0 ? "Toda fila tiene respaldo documental." : "Excluidas de métricas y descritas en incidencias."}
              hueco={gasto.resumen.sin_conciliar > 0}
            />
          </div>
          <p className="mt-8 border-t border-vela pt-5 text-cuerpo text-tinta-prosa">
            Escribe al menos dos caracteres para elegir una candidatura. El gasto se compara
            solo con personas del mismo municipio, distrito o elección senatorial.
          </p>
        </Bisel>
      )}
    </>
  );
}

function ContenidoCandidaturas({
  cargandoGasto,
  errorGasto,
  gasto,
  seleccionada,
  alSeleccionar,
}: {
  cargandoGasto: boolean;
  errorGasto: unknown;
  gasto: DocGastoElectoral | undefined;
  seleccionada: CandidaturaGasto | null;
  alSeleccionar: (candidatura: CandidaturaGasto) => void;
}) {
  if (cargandoGasto) return <Esqueleto className="h-64" />;
  if (errorGasto || !gasto) {
    return (
      <Bisel as="section" nivel="panel" interior="p-6 md:p-8">
        <h2 className="text-rotulo text-tinta-titulo">Perfiles auditados aún no disponibles</h2>
        <p className="mt-3 max-w-[65ch] text-cuerpo text-tinta-prosa">
          Este despliegue no contiene todavía el archivo final conciliado del INE. Es una
          ausencia de datos, no un gasto de cero. El importador semanal exige que las 247
          filas oficiales queden conciliadas o registradas como incidencia antes de publicarlas.
        </p>
      </Bisel>
    );
  }
  return <CandidaturasDisponibles gasto={gasto} seleccionada={seleccionada} alSeleccionar={alSeleccionar} />;
}

function ContenidoPartidos({
  cargandoFinanciamiento,
  errorFinanciamiento,
  financiamiento,
}: {
  cargandoFinanciamiento: boolean;
  errorFinanciamiento: unknown;
  financiamiento: DocFinanciamientoPartidos | undefined;
}) {
  return cargandoFinanciamiento ? <Esqueleto className="h-64" /> : errorFinanciamiento || !financiamiento ? (
    <Bisel as="section" nivel="panel" interior="p-6 md:p-8">
      <h2 className="text-rotulo text-tinta-titulo">Asignaciones no disponibles</h2>
      <p className="mt-3 text-cuerpo text-tinta-prosa">El archivo del IEEBC no llegó a este despliegue. No se interpreta como cero.</p>
    </Bisel>
  ) : (
    <Partidos
      partidos={financiamiento.partidos}
      totales={financiamiento.totales}
      aviso={financiamiento.aviso}
      ejercicio={financiamiento.ejercicio}
      acuerdos={financiamiento.acuerdos}
    />
  );
}

function ContenidoGasto({
  vista,
  cargandoGasto,
  errorGasto,
  gasto,
  seleccionada,
  alSeleccionar,
  cargandoFinanciamiento,
  errorFinanciamiento,
  financiamiento,
}: {
  vista: VistaGasto;
  cargandoGasto: boolean;
  errorGasto: unknown;
  gasto: DocGastoElectoral | undefined;
  seleccionada: CandidaturaGasto | null;
  alSeleccionar: (candidatura: CandidaturaGasto) => void;
  cargandoFinanciamiento: boolean;
  errorFinanciamiento: unknown;
  financiamiento: DocFinanciamientoPartidos | undefined;
}) {
  return vista === "candidaturas" ? (
    <ContenidoCandidaturas
      cargandoGasto={cargandoGasto}
      errorGasto={errorGasto}
      gasto={gasto}
      seleccionada={seleccionada}
      alSeleccionar={alSeleccionar}
    />
  ) : (
    <ContenidoPartidos
      cargandoFinanciamiento={cargandoFinanciamiento}
      errorFinanciamiento={errorFinanciamiento}
      financiamiento={financiamiento}
    />
  );
}

export function PanelGastoElectoral() {
  const parametros = useSearchParams();
  const router = useRouter();
  const vista: VistaGasto = parametros.get("vista") === "meta" ? "meta" : parametros.get("vista") === "partidos" ? "partidos" : "candidaturas";
  const { data: gasto, error: errorGasto, isLoading: cargandoGasto } = useGastoElectoral();
  const { data: financiamiento, error: errorFinanciamiento, isLoading: cargandoFinanciamiento } =
    useFinanciamientoPartidos();
  const personaId = parametros.get("persona");
  const seleccionada = gasto?.candidaturas.find((c) => c.id === personaId) ?? null;

  const elegirVista = (nueva: VistaGasto) => {
    router.push(cambiarConsulta(parametros, { vista: nueva === "candidaturas" ? null : nueva }));
  };
  const elegirPersona = (c: CandidaturaGasto) => {
    router.push(cambiarConsulta(parametros, { persona: c.id, vista: null }));
  };

  return (
    <div className="grid gap-8">
      {vista !== "meta" ? <Calendario /> : null}

      <SelectorVista vista={vista} onChange={elegirVista} />

      {vista === "meta" ? <PanelPublicidadMeta gasto={gasto} /> : <ContenidoGasto
        vista={vista}
        cargandoGasto={cargandoGasto}
        errorGasto={errorGasto}
        gasto={gasto}
        seleccionada={seleccionada}
        alSeleccionar={elegirPersona}
        cargandoFinanciamiento={cargandoFinanciamiento}
        errorFinanciamiento={errorFinanciamiento}
        financiamiento={financiamiento}
      />}
    </div>
  );
}
