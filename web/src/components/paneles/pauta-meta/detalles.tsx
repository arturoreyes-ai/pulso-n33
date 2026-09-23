"use client";

import { Bisel } from "@/components/ui/bisel";
import { Hueco } from "@/components/ui/primitivas";
import type { AudienciaMeta, DocGastoElectoral, InformacionMeta, PerfilMeta, SeccionMeta, VentanaMeta } from "@/lib/datos/tipos";
import { BOTON_META, CAMPO_META, CampoMeta, DatoMeta, FuenteMeta, fechaMeta, importeMeta, numeroMeta } from "./comunes";

export function CruceIneMeta({ perfil, gasto }: { perfil: PerfilMeta; gasto: DocGastoElectoral | undefined }) {
  const candidatura = perfil.ine ? gasto?.candidaturas.find((c) => c.id === perfil.ine?.id) : undefined;
  const proceso = candidatura ? gasto?.procesos.find((p) => p.id === candidatura.proceso) : undefined;
  return <Bisel nivel="panel" interior="p-5 md:p-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h3 className="text-rotulo text-tinta-titulo">Referencia INE · elecciones 2024</h3>
      {candidatura ? <a className={BOTON_META} href={`/gasto-electoral?persona=${encodeURIComponent(candidatura.id)}`}>Ver perfil auditado →</a> : null}
    </div>
    {candidatura && proceso ? <>
      <p className="mt-3 text-meta text-tinta-meta">{candidatura.contienda} · {proceso.dictamen} · {fechaMeta(proceso.corte)}</p>
      <dl className="mt-5 grid gap-5 sm:grid-cols-2">
        <DatoMeta etiqueta="Internet y redes reportado">{importeMeta(candidatura.desglose_reportado.internet, "MXN")}</DatoMeta>
        <DatoMeta etiqueta="Gasto total auditado de campaña">{importeMeta(candidatura.gasto_auditado, "MXN")}</DatoMeta>
      </dl>
      <p className="mt-5 text-meta text-tinta-meta">Los periodos y conceptos de Meta e INE son distintos. Estas cifras no se suman.</p>
      <a className="mt-3 inline-block text-meta text-tinta-dato underline underline-offset-4" href={proceso.dictamen_url} target="_blank" rel="noreferrer">Documento del INE ↗</a>
    </> : <p className="mt-4 text-cuerpo text-tinta-meta">{perfil.ine ? "La información auditada no está disponible en esta vista." : "Sin candidatura 2024 vinculada en este catálogo."}</p>}
  </Bisel>;
}

export function InformacionAnuncianteMeta({ seccion }: { seccion: SeccionMeta<InformacionMeta> }) {
  const datos = seccion.datos;
  return <div className="grid gap-6"><FuenteMeta seccion={seccion} />
    {datos ? <>
      <div className="grid gap-5 md:grid-cols-2">{datos.totales.map((t) => <Bisel key={`${t.etiqueta}-${t.desde}`} nivel="panel" interior="p-6">
        <p className="text-meta text-tinta-meta">{t.etiqueta}</p>
        <p className="mt-4 break-words font-titular text-seccion tabular-nums text-tinta-titulo">{importeMeta(t.importe, t.moneda)}</p>
        <p className="mt-4 text-meta text-tinta-meta">{fechaMeta(t.desde)} — {fechaMeta(t.hasta)} · {t.geografia === "MX" ? "México" : t.geografia}</p>
      </Bisel>)}</div>
      <Bisel nivel="panel" interior="p-6"><h3 className="text-rotulo text-tinta-titulo">Transparencia de la página</h3>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">{datos.transparencia.map((p, i) => <DatoMeta key={`${p.etiqueta}-${i}`} etiqueta={p.etiqueta}>{p.valor}</DatoMeta>)}</dl>
        {!datos.transparencia.length ? <Hueco>Sin dato de transparencia.</Hueco> : null}
      </Bisel>
      <Bisel nivel="panel" interior="p-6"><h3 className="text-rotulo text-tinta-titulo">Fuentes de financiamiento declaradas</h3>
        {datos.pagadores.length ? <ul className="mt-4 divide-y divide-vela">{datos.pagadores.map((p, i) => <li key={`${p.nombre}-${i}`} className="flex flex-wrap justify-between gap-3 py-4">
          <div><p className="text-cuerpo text-tinta-prosa">{p.nombre}</p><p className="mt-1 text-meta text-tinta-meta">{fechaMeta(p.desde)} — {fechaMeta(p.hasta)} · {p.geografia === "MX" ? "México" : p.geografia}</p></div>
          <span className="text-cuerpo tabular-nums text-tinta-dato">{importeMeta(p.importe, p.moneda)}</span></li>)}</ul> : <Hueco>Sin dato de pagadores.</Hueco>}
      </Bisel>
    </> : <Hueco>No hay información del anunciante disponible.</Hueco>}
  </div>;
}

export function AudienciaAnuncianteMeta({ secciones, ventana, cambiar }: {
  secciones: Record<VentanaMeta, SeccionMeta<AudienciaMeta>>; ventana: VentanaMeta; cambiar: (ventana: string) => void;
}) {
  const seccion = secciones[ventana];
  const datos = seccion.datos;
  return <div className="grid gap-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h3 className="text-rotulo text-tinta-titulo">Selección de audiencia del anunciante</h3>
        <p className="mt-3 max-w-[65ch] text-meta text-tinta-meta">Describe a quién buscó llegar el anunciante. La entrega de cada anuncio se consulta en su ficha.</p></div>
      <CampoMeta etiqueta="Periodo de audiencia"><select className={CAMPO_META} value={ventana} onChange={(e) => cambiar(e.target.value)}>
        {["7", "30", "90"].map((v) => <option key={v} value={v}>Últimos {v} días</option>)}</select></CampoMeta>
    </div>
    <FuenteMeta seccion={seccion} />
    {datos ? <Bisel nivel="panel" interior="p-6">
      <dl className="grid gap-5 sm:grid-cols-2"><DatoMeta etiqueta="Gasto publicado">{importeMeta(datos.importe, datos.moneda)}</DatoMeta>
        <DatoMeta etiqueta="Anuncios">{numeroMeta(datos.anuncios)}</DatoMeta></dl>
      {datos.anuncios === 0 ? <p className="mt-6 text-cuerpo text-tinta-prosa">Meta no reporta anuncios para esta página durante este periodo.</p>
        : datos.selecciones.length ? <dl className="mt-6 grid gap-5 border-t border-vela pt-5 sm:grid-cols-2">{datos.selecciones.map((s, i) => <DatoMeta key={`${s.etiqueta}-${i}`} etiqueta={s.etiqueta}>{s.valor}</DatoMeta>)}</dl>
        : <div className="mt-6"><Hueco>Selecciones de audiencia sin dato.</Hueco></div>}
    </Bisel> : <Hueco>No hay datos de audiencia disponibles para este periodo.</Hueco>}
  </div>;
}

