"use client";

import { Bisel } from "@/components/ui/bisel";
import { Hueco } from "@/components/ui/primitivas";
import type { DocPublicidadMeta, PerfilMeta, VentanaReporteMeta } from "@/lib/datos/tipos";
import { gruposComparablesMeta } from "@/lib/dominio/pauta-meta";
import { CAMPO_META, CampoMeta, DatoMeta, FuenteMeta, fechaMeta, importeMeta, numeroMeta } from "./comunes";

export function CompararMeta({ perfiles }: { perfiles: PerfilMeta[] }) {
  const grupos = gruposComparablesMeta(perfiles);
  return <div className="grid gap-6">
    <div><h3 className="text-rotulo text-tinta-titulo">Gasto publicado por anunciante</h3><p className="mt-3 text-meta text-tinta-meta">Comparación por el mismo periodo, territorio y moneda. Los rangos de anuncios individuales se muestran por separado en Anuncios.</p></div>
    {grupos.length ? grupos.map((grupo) => <Bisel key={grupo.clave} nivel="panel" interior="p-6">
      <p className="text-meta text-tinta-meta">{fechaMeta(grupo.total.desde)} — {fechaMeta(grupo.total.hasta)} · {grupo.total.geografia === "MX" ? "México" : grupo.total.geografia} · {grupo.total.moneda}</p>
      <ol className="mt-5 divide-y divide-vela">{grupo.filas.map(({ perfil, total }) => <li key={perfil.id} className="flex flex-wrap justify-between gap-4 py-4">
        <a className="text-cuerpo text-tinta-prosa underline underline-offset-4" href={`/gasto-electoral?vista=meta&meta_persona=${perfil.id}&meta_tab=informacion`}>{perfil.nombre}</a>
        <span className="text-cuerpo tabular-nums text-tinta-dato">{importeMeta(total.importe, total.moneda)}</span></li>)}</ol>
    </Bisel>) : <Hueco>Aún no hay dos anunciantes con cifras del mismo periodo, territorio y moneda confirmada.</Hueco>}
    <p className="text-meta text-tinta-meta">{perfiles.length} perfiles en la selección · {perfiles.filter((p) => p.totales.length > 0).length} con cifras publicadas. La ausencia de información no representa gasto cero.</p>
  </div>;
}

export function ReportePublicidadMeta({ documento, ventana, cambiar }: {
  documento: DocPublicidadMeta; ventana: VentanaReporteMeta; cambiar: (ventana: string) => void;
}) {
  const seccion = documento.reporte[ventana];
  const datos = seccion.datos;
  const bc = datos?.regiones.find((r) => r.nombre === "Baja California");
  const perfiles = new Map(documento.perfiles.filter((p) => p.pagina).map((p) => [p.pagina!.id, p]));
  return <div className="grid gap-6">
    <div className="flex flex-wrap justify-between gap-4"><div><h3 className="text-rotulo text-tinta-titulo">Reporte de publicidad política · México</h3>
      <p className="mt-3 text-meta text-tinta-meta">Totales publicados por Meta y gasto por ubicación.</p></div>
      <CampoMeta etiqueta="Periodo del reporte"><select className={CAMPO_META} value={ventana} onChange={(e) => cambiar(e.target.value)}>
        <option value="1">Último día</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="todo">Todo el histórico</option>
      </select></CampoMeta></div>
    <FuenteMeta seccion={seccion} />
    {datos ? <>
      <Bisel nivel="panel" interior="p-6"><dl className="grid gap-6 md:grid-cols-3">
        <DatoMeta etiqueta="Gasto total · México">{importeMeta(datos.importe, datos.moneda)}</DatoMeta>
        <DatoMeta etiqueta="Entrega en Baja California">{importeMeta(bc?.importe ?? null, datos.moneda)}</DatoMeta>
        <DatoMeta etiqueta="Anuncios · México">{numeroMeta(datos.anuncios)}</DatoMeta>
      </dl></Bisel>
      <div className="overflow-x-auto rounded-panel border border-filo"><table className="w-full text-left text-meta">
        <caption className="p-4 text-left text-cuerpo text-tinta-titulo">Anunciantes disponibles · {seccion.completo ? "reporte completo" : "reporte parcial"}</caption>
        <thead className="border-y border-filo bg-vela text-tinta-meta"><tr><th className="p-4" scope="col">Página / pagador</th><th className="p-4 text-right" scope="col">Gasto</th><th className="p-4 text-right" scope="col">Anuncios</th></tr></thead>
        <tbody>{datos.anunciantes.map((a, i) => <tr key={`${a.pagina_id}-${a.pagador}-${i}`} className="border-b border-vela">
          <th className="p-4 font-normal" scope="row"><a href={perfiles.has(a.pagina_id) ? `/gasto-electoral?vista=meta&meta_persona=${perfiles.get(a.pagina_id)!.id}` : `https://www.facebook.com/ads/library/?country=MX&view_all_page_id=${a.pagina_id}`} className="text-tinta-dato underline underline-offset-4">{a.nombre}</a><span className="mt-1 block text-tinta-meta">{a.pagador ?? "Pagador sin dato"}</span></th>
          <td className="p-4 text-right tabular-nums text-tinta-prosa">{importeMeta(a.importe, datos.moneda)}</td><td className="p-4 text-right tabular-nums text-tinta-prosa">{numeroMeta(a.anuncios)}</td>
        </tr>)}</tbody></table>
        {!datos.anunciantes.length ? <div className="p-4"><Hueco>Sin detalle de anunciantes disponible.</Hueco></div> : null}
      </div>
    </> : <Hueco>Este periodo del reporte todavía no tiene información disponible.</Hueco>}
  </div>;
}
