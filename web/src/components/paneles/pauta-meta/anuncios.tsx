"use client";

import type { FormEvent } from "react";
import { Bisel } from "@/components/ui/bisel";
import { Hueco } from "@/components/ui/primitivas";
import type { AnuncioMeta, SeccionMeta } from "@/lib/datos/tipos";
import { filtrarAnunciosMeta, sumarRangosMeta, type FiltrosMeta } from "@/lib/dominio/pauta-meta";
import { BOTON_META, BOTON_META_ACTIVO, CAMPO_META, CampoMeta, DatoMeta, FuenteMeta, fechaMeta, rangoMeta } from "./comunes";

export function TarjetaAnuncioMeta({ anuncio }: { anuncio: AnuncioMeta }) {
  return <Bisel as="article" nivel="panel" interior="flex flex-col gap-5 p-5 md:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3 text-meta">
      <span className={anuncio.estado === "activo" ? "text-tinta-dato" : "text-tinta-meta"}>
        {anuncio.estado === "activo" ? "● Activo" : anuncio.estado === "inactivo" ? "○ Inactivo" : "Estado sin dato"}</span>
      <span className="text-tinta-meta">{anuncio.formato === "desconocido" ? "Formato sin dato" : anuncio.formato}</span>
    </div>
    <p className="text-meta text-tinta-meta">{fechaMeta(anuncio.desde)} — {anuncio.hasta ? fechaMeta(anuncio.hasta) : anuncio.estado === "activo" ? "en circulación" : "fin sin dato"}</p>
    <p className="whitespace-pre-wrap break-words text-lectura text-tinta-titulo">{anuncio.texto ?? "Texto del anuncio no disponible"}</p>
    <p className="text-meta text-tinta-prosa">Pagado por: {anuncio.pagador ?? "sin dato"}</p>
    {anuncio.grupo ? <p className="rounded-nucleo border border-filo p-3 text-meta text-aviso">Meta agrupa {anuncio.grupo} anuncios en esta pieza. Detalle individual pendiente.</p> : null}
    <dl className="grid grid-cols-1 gap-5 border-y border-vela py-5 sm:grid-cols-2">
      <DatoMeta etiqueta="Gasto total del anuncio">{rangoMeta(anuncio.gasto, anuncio.moneda)}</DatoMeta>
      <DatoMeta etiqueta="Impresiones">{rangoMeta(anuncio.impresiones)}</DatoMeta>
      <DatoMeta etiqueta="Tamaño estimado de audiencia">{rangoMeta(anuncio.tamano_audiencia)}</DatoMeta>
      <DatoMeta etiqueta="Plataformas">{anuncio.plataformas.join(" · ") || "sin dato"}</DatoMeta>
    </dl>
    <details className="text-meta text-tinta-prosa">
      <summary className="cursor-pointer py-2">Entrega y datos del anuncio</summary>
      <dl className="mt-3 grid gap-4">
        <DatoMeta etiqueta="ID de biblioteca">{anuncio.id}</DatoMeta>
        <DatoMeta etiqueta="Regiones confirmadas">{anuncio.regiones.join(" · ") || "sin dato"}</DatoMeta>
        {anuncio.entrega.map((fila, i) => <DatoMeta key={`${fila.etiqueta}-${i}`} etiqueta={fila.etiqueta}>{fila.valor}</DatoMeta>)}
      </dl>
    </details>
    <a href={anuncio.url} target="_blank" rel="noreferrer" className={`${BOTON_META} mt-auto self-start`}>Ver anuncio y multimedia ↗</a>
  </Bisel>;
}

function FiltrosAnunciosMeta({ filtros, aplicar }: { filtros: FiltrosMeta; aplicar: (cambios: Record<string, string>) => void }) {
  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    aplicar(Object.fromEntries(new FormData(evento.currentTarget).entries()) as Record<string, string>);
  };
  return <form key={JSON.stringify(filtros)} onSubmit={enviar} className="grid gap-4 rounded-panel border border-filo p-4 sm:grid-cols-2 lg:grid-cols-4">
    <CampoMeta etiqueta="Buscar en los anuncios"><input className={CAMPO_META} name="meta_q" defaultValue={filtros.texto} placeholder="Texto, pagador o ID" /></CampoMeta>
    <CampoMeta etiqueta="Estado"><select className={CAMPO_META} name="meta_estado" defaultValue={filtros.estado}>
      <option value="todos">Todos los estados</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option></select></CampoMeta>
    <CampoMeta etiqueta="Entregados desde"><input type="date" name="meta_desde" className={CAMPO_META} min="2024-01-01" defaultValue={filtros.desde} /></CampoMeta>
    <CampoMeta etiqueta="Entregados hasta"><input type="date" name="meta_hasta" className={CAMPO_META} min={filtros.desde || "2024-01-01"} defaultValue={filtros.hasta} /></CampoMeta>
    <CampoMeta etiqueta="Plataforma"><select className={CAMPO_META} name="meta_plataforma" defaultValue={filtros.plataforma}>
      <option value="todas">Todas</option>{["Facebook", "Instagram", "Messenger", "Audience Network", "Threads", "WhatsApp"].map((p) => <option key={p}>{p}</option>)}</select></CampoMeta>
    <CampoMeta etiqueta="Formato"><select className={CAMPO_META} name="meta_formato" defaultValue={filtros.formato}>
      <option value="todos">Todos</option><option value="video">Video</option><option value="imagen">Imagen</option><option value="texto">Texto</option></select></CampoMeta>
    <CampoMeta etiqueta="Entrega por región"><select className={CAMPO_META} name="meta_region" defaultValue={filtros.region}>
      <option value="Baja California">Baja California</option><option value="todas">Todas las disponibles</option></select></CampoMeta>
    <CampoMeta etiqueta="Orden"><select className={CAMPO_META} name="meta_orden" defaultValue={filtros.orden}>
      <option value="recientes">Más recientes</option><option value="antiguos">Más antiguos</option></select></CampoMeta>
    <button type="submit" className={`${BOTON_META_ACTIVO} justify-self-start`}>Aplicar filtros</button>
    <button type="button" onClick={() => aplicar({ meta_q: "", meta_estado: "todos", meta_desde: "2024-01-01", meta_hasta: "", meta_plataforma: "todas", meta_formato: "todos", meta_region: "Baja California", meta_orden: "recientes" })}
      className={`${BOTON_META} justify-self-start`}>Restablecer</button>
  </form>;
}

export function AnunciosMeta({ seccion, filtros, pagina, cambiar }: {
  seccion: SeccionMeta<AnuncioMeta[]>; filtros: FiltrosMeta; pagina: number;
  cambiar: (valores: Record<string, string>) => void;
}) {
  const anuncios = filtrarAnunciosMeta(seccion.datos ?? [], filtros);
  const paginas = Math.max(1, Math.ceil(anuncios.length / 12));
  const actual = Math.min(Math.max(1, pagina), paginas);
  const sumas = sumarRangosMeta(anuncios);
  const invalidas = filtros.hasta && filtros.desde > filtros.hasta;
  return <div className="grid gap-6">
    <FuenteMeta seccion={seccion} />
    <FiltrosAnunciosMeta filtros={filtros} aplicar={(valores) => cambiar({ ...valores, meta_pagina: "1" })} />
    {invalidas ? <Hueco>La fecha final debe ser posterior a la inicial.</Hueco> : <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-cuerpo text-tinta-titulo">{seccion.datos === null ? "Anuncios sin dato" : `${anuncios.length} piezas disponibles${seccion.completo ? "" : " · cobertura parcial"}`}</p>
        {sumas.map((s) => <p key={s.moneda} className="text-meta text-tinta-meta">Suma de rangos de {s.anuncios} anuncios: <span className="text-tinta-dato">{rangoMeta(s.rango, s.moneda)}</span></p>)}
      </div>
      <p className="max-w-[75ch] text-meta text-tinta-meta">El gasto mostrado corresponde al anuncio completo, aunque haya tenido entrega en Baja California.</p>
      {anuncios.length ? <div className="grid items-stretch gap-5 lg:grid-cols-2">{anuncios.slice((actual - 1) * 12, actual * 12).map((a) => <TarjetaAnuncioMeta key={a.id} anuncio={a} />)}</div>
        : <Hueco>{seccion.datos === null ? "No hay información de anuncios disponible para esta persona." : "No hay piezas disponibles con estos filtros. La información sin confirmar no se incluye."}</Hueco>}
      {paginas > 1 ? <nav aria-label="Páginas de anuncios" className="flex items-center justify-center gap-4">
        <button type="button" className={BOTON_META} disabled={actual === 1} onClick={() => cambiar({ meta_pagina: String(actual - 1) })}>Anterior</button>
        <span className="text-meta text-tinta-meta" aria-live="polite">{actual} / {paginas}</span>
        <button type="button" className={BOTON_META} disabled={actual === paginas} onClick={() => cambiar({ meta_pagina: String(actual + 1) })}>Siguiente</button>
      </nav> : null}
    </>}
  </div>;
}
