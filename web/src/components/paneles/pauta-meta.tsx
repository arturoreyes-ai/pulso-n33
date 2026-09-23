"use client";

import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Bisel } from "@/components/ui/bisel";
import { Esqueleto, Hueco } from "@/components/ui/primitivas";
import { usePublicidadMeta, usePerfilMeta } from "@/lib/datos/hooks";
import type { DocGastoElectoral, PerfilMeta, VentanaMeta, VentanaReporteMeta } from "@/lib/datos/tipos";
import { filtrarPerfilesMeta, type FiltrosMeta } from "@/lib/dominio/pauta-meta";
import { BOTON_META, BOTON_META_ACTIVO, CAMPO_META, CampoMeta, PESTANAS_META, PestanasMeta, fechaMeta, type PestanaMeta } from "./pauta-meta/comunes";
import { AnunciosMeta } from "./pauta-meta/anuncios";
import { AudienciaAnuncianteMeta, CruceIneMeta, InformacionAnuncianteMeta } from "./pauta-meta/detalles";
import { EstadoCarga } from "@/components/ui/estado-carga";

const CompararMeta = dynamic(() => import("./pauta-meta/reportes").then((m) => m.CompararMeta));
const ReportePublicidadMeta = dynamic(() => import("./pauta-meta/reportes").then((m) => m.ReportePublicidadMeta));

function ErrorCargaMeta({ reintentar }: { reintentar: () => void }) {
  return <div role="alert" className="grid gap-4 rounded-panel border border-filo p-6">
    <p className="text-cuerpo text-baja">No se pudo cargar Publicidad Meta. Reintenta la consulta o recarga la página.</p>
    <div className="flex flex-wrap gap-3">
      <button type="button" className={BOTON_META} onClick={reintentar}>Reintentar</button>
      <a className={BOTON_META} href="/gasto-electoral?vista=meta">Recargar página</a>
    </div>
  </div>;
}

function PerfilSeleccionadoMeta({ perfil, pestana, filtros, pagina, ventana, cambiar, gasto }: {
  perfil: PerfilMeta; pestana: PestanaMeta; filtros: FiltrosMeta; pagina: number; ventana: VentanaMeta;
  cambiar: (valores: Record<string, string>) => void; gasto: DocGastoElectoral | undefined;
}) {
  const { data: detalle, error, isLoading, mutate } = usePerfilMeta(perfil.pagina ? perfil.id : null);
  return <div className="grid gap-6">
    <header className="flex flex-wrap justify-between gap-4 border-b border-vela pb-5">
      <div><p className="text-meta text-tinta-meta">{perfil.partido} · {perfil.ambito === "estatal" ? "Baja California" : perfil.ambito}</p>
        <h2 className="mt-2 font-titular text-seccion text-tinta-titulo">{perfil.pagina?.nombre ?? perfil.nombre}</h2>
        <p className="mt-2 text-cuerpo text-tinta-prosa">{perfil.cargo}</p></div>
      {perfil.pagina ? <a className={`${BOTON_META} self-start`} href={perfil.pagina.url} target="_blank" rel="noreferrer">Página del anunciante ↗</a> : null}
    </header>
    {!perfil.pagina ? <Hueco>Página pendiente de verificación. Publicidad sin dato.</Hueco>
      : isLoading ? <Esqueleto className="h-64" /> : error || !detalle ? <ErrorCargaMeta reintentar={() => void mutate()} />
      : pestana === "anuncios" ? <AnunciosMeta seccion={detalle.anuncios} filtros={filtros} pagina={pagina} cambiar={cambiar} />
      : pestana === "informacion" ? <InformacionAnuncianteMeta seccion={detalle.informacion} />
      : <AudienciaAnuncianteMeta secciones={detalle.audiencia} ventana={ventana} cambiar={(v) => cambiar({ meta_ventana: v })} />}
    <CruceIneMeta perfil={perfil} gasto={gasto} />
    {perfil.pagina ? <details className="text-meta text-tinta-meta"><summary className="cursor-pointer py-3">Fuentes de identificación</summary>
      <p className="mt-2">Verificado {fechaMeta(perfil.pagina.verificado)}</p><ul className="mt-3 flex flex-wrap gap-4">{perfil.pagina.fuentes.map((fuente, i) => <li key={fuente}><a href={fuente} target="_blank" rel="noreferrer" className="text-tinta-dato underline underline-offset-4">Referencia {i + 1} ↗</a></li>)}</ul>
    </details> : null}
  </div>;
}

export function PanelPublicidadMeta({ gasto }: { gasto: DocGastoElectoral | undefined }) {
  const { data: documento, error, isLoading, mutate } = usePublicidadMeta();
  const parametros = useSearchParams();
  const router = useRouter();
  const cambiar = (valores: Record<string, string>) => {
    const siguientes = new URLSearchParams(parametros.toString());
    siguientes.set("vista", "meta");
    for (const [clave, valor] of Object.entries(valores)) {
      if (valor) siguientes.set(clave, valor); else siguientes.delete(clave);
    }
    router.push(`/gasto-electoral?${siguientes.toString()}`, { scroll: false });
  };
  const pestana = PESTANAS_META.find(([id]) => id === parametros.get("meta_tab"))?.[0] ?? "anuncios";
  const filtros: FiltrosMeta = { texto: parametros.get("meta_q") ?? "", estado: parametros.get("meta_estado") ?? "todos",
    desde: parametros.get("meta_desde") ?? "2024-01-01", hasta: parametros.get("meta_hasta") ?? "",
    plataforma: parametros.get("meta_plataforma") ?? "todas", formato: parametros.get("meta_formato") ?? "todos",
    region: parametros.get("meta_region") ?? "Baja California", orden: parametros.get("meta_orden") ?? "recientes" };
  const buscador = parametros.get("meta_buscar") ?? "";
  const partido = parametros.get("meta_partido") ?? "";
  const ambito = parametros.get("meta_ambito") ?? "";
  const perfiles = filtrarPerfilesMeta(documento?.perfiles ?? [], buscador, partido, ambito);
  const perfil = perfiles.find((p) => p.id === (parametros.get("meta_persona") ?? "jarp")) ?? perfiles[0];
  const ventana: VentanaMeta = parametros.get("meta_ventana") === "30" ? "30" : parametros.get("meta_ventana") === "90" ? "90" : "7";
  const periodo = parametros.get("meta_periodo") ?? "1";
  const ventanaReporte = (["1", "7", "30", "90", "todo"].includes(periodo) ? periodo : "1") as VentanaReporteMeta;
  const paginaNumero = Number(parametros.get("meta_pagina") ?? 1);
  const pagina = Number.isSafeInteger(paginaNumero) && paginaNumero > 0 ? paginaNumero : 1;
  if (isLoading) return <div className="grid gap-4 rounded-panel border border-filo p-6">
    <EstadoCarga etiqueta="Cargando el catálogo de Publicidad Meta" />
  </div>;
  if (error || !documento) return <ErrorCargaMeta reintentar={() => void mutate()} />;
  return <div className="grid gap-6">
    <Bisel interior="p-5 md:p-8"><div className="flex flex-wrap justify-between gap-6">
      <div><p className="text-meta uppercase tracking-widest text-tinta-dato">Biblioteca de publicidad política</p>
        <h2 className="mt-3 font-titular text-seccion text-tinta-titulo">Quién anuncia en Baja California</h2>
        <p className="mt-3 max-w-[65ch] text-cuerpo text-tinta-prosa">Anuncios, pagadores y audiencias de las figuras del catálogo, junto a sus registros electorales.</p></div>
      <div className="flex gap-6 self-end"><div><p className="font-titular text-seccion tabular-nums text-tinta-titulo">{documento.perfiles.length}</p><p className="text-meta text-tinta-meta">figuras del catálogo</p></div>
        <div><p className="font-titular text-seccion tabular-nums text-tinta-dato">{documento.perfiles.filter((p) => p.actualizado).length}</p><p className="text-meta text-tinta-meta">con información</p></div></div>
    </div><p className="mt-6 border-t border-vela pt-4 text-meta text-tinta-meta">México · temas sociales, elecciones o política · anuncios desde enero de 2024</p></Bisel>
    <form key={`${buscador}|${partido}|${ambito}`} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => {
      e.preventDefault(); cambiar({ ...Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>, meta_pagina: "1" });
    }}>
      <CampoMeta etiqueta="Buscar una figura"><input className={CAMPO_META} name="meta_buscar" defaultValue={buscador} placeholder="Nombre o cargo" /></CampoMeta>
      <CampoMeta etiqueta="Partido"><select name="meta_partido" className={CAMPO_META} defaultValue={partido}><option value="">Todos</option>{[...new Set(documento.perfiles.map((p) => p.partido))].sort().map((v) => <option key={v}>{v}</option>)}</select></CampoMeta>
      <CampoMeta etiqueta="Municipio o ámbito"><select name="meta_ambito" className={CAMPO_META} defaultValue={ambito}><option value="">Todos</option>{[...new Set(documento.perfiles.map((p) => p.ambito))].sort().map((v) => <option key={v} value={v}>{v === "estatal" ? "Baja California" : v}</option>)}</select></CampoMeta>
      <button type="submit" className={`${BOTON_META_ACTIVO} self-end`}>Filtrar figuras</button>
    </form>
    <PestanasMeta actual={pestana} cambiar={(valor) => cambiar({ meta_tab: valor })} />
    <div role="tabpanel" id="meta-contenido" aria-labelledby={`meta-tab-${pestana}`} tabIndex={0} className="min-w-0">
      {pestana === "comparar" ? <CompararMeta perfiles={perfiles} /> : pestana === "reporte" ? <ReportePublicidadMeta documento={documento} ventana={ventanaReporte} cambiar={(v) => cambiar({ meta_periodo: v })} />
        : <div className="grid items-start gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <nav aria-label="Figuras del catálogo" className="grid max-h-96 gap-2 overflow-y-auto rounded-panel border border-filo p-3 xl:max-h-none">
            {perfiles.map((p) => <button type="button" key={p.id} aria-pressed={p.id === perfil?.id} onClick={() => cambiar({ meta_persona: p.id, meta_pagina: "1" })}
              className={`rounded-nucleo border p-4 text-left transition-colors ${p.id === perfil?.id ? "border-chart-1 bg-realce" : "border-transparent hover:bg-vela"}`}>
              <span className="block text-cuerpo text-tinta-titulo">{p.pagina?.nombre ?? p.nombre}</span>
              <span className="mt-1 block text-meta text-tinta-meta">{p.ambito === "estatal" ? "Baja California" : p.ambito}</span>
              <span className={`mt-2 block text-meta ${p.actualizado ? "text-tinta-dato" : "text-tinta-meta"}`}>{p.actualizado ? `${p.anuncios ?? "Sin dato de"} piezas · ${p.estado === "ok" ? "disponible" : "parcial"}` : "Sin dato"}</span>
            </button>)}
            {!perfiles.length ? <Hueco>No hay figuras con estos filtros.</Hueco> : null}
          </nav>
          {perfil ? <PerfilSeleccionadoMeta key={perfil.id} perfil={perfil} pestana={pestana} filtros={filtros} pagina={pagina} ventana={ventana} cambiar={cambiar} gasto={gasto} /> : null}
        </div>}
    </div>
  </div>;
}
