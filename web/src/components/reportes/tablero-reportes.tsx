"use client";

import { ArrowRight, DownloadSimple, MagnifyingGlass } from "@phosphor-icons/react";
import Link from "next/link";

import { Bisel } from "@/components/ui/bisel";
import { clasesBoton } from "@/components/ui/clases";
import { EstadoCarga } from "@/components/ui/estado-carga";
import { LARGO_MAXIMO_CONSULTA, MINIMO_CONSULTA } from "@/lib/busqueda/tipos";
import { useConsultas } from "@/lib/datos/hooks";
import type { Consulta } from "@/lib/datos/tipos";
import { cifrasConsulta, rutaDeConsulta } from "@/lib/dominio/consultas";
import { fechaConAnio, numero } from "@/lib/dominio/formato";
import { rutaDeInforme } from "@/lib/informe/contrato";
import { ResultadosReportes } from "./resultados-reportes";

const TIPO = { persona: "Persona", empresa: "Empresa", tema: "Tema" };

function TarjetaTermino({ c }: { c: Consulta }) {
  const { prensa, publicaciones, comentarios } = cifrasConsulta(c);
  const cifras = [
    { nombre: "Noticias", n: prensa.estado === "ok" ? prensa.tono.total : null },
    { nombre: "Publicaciones", n: publicaciones.estado === "ok" ? publicaciones.total : null },
    { nombre: "Comentarios", n: comentarios.estado === "ok" ? comentarios.tono.total : null },
  ];
  return (
    <Bisel as="article" nivel="panel" interior="flex flex-col p-5 sm:p-6">
      <p className="text-meta text-tinta-meta">{TIPO[c.tipo]}</p>
      <h3 className="mt-3 break-words font-titular text-rotulo text-tinta-titulo">{c.termino}</h3>
      <dl className="my-6 grid gap-3 border-y border-vela py-5">
        {cifras.map(({ nombre, n }) => (
          <div key={nombre} className="flex items-baseline justify-between gap-4">
            <dt className="text-cuerpo text-tinta-prosa">{nombre}</dt>
            <dd className={n === null ? "text-cuerpo text-tinta-meta" : "font-mono text-rotulo tabular-nums text-tinta-dato"}>{n === null ? "Sin dato" : numero(n)}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Link href={rutaDeConsulta(c.termino)} className={clasesBoton(true)} aria-label={`Ver reporte de ${c.termino}`}>Ver reporte <ArrowRight size={16} aria-hidden /></Link>
        <a href={rutaDeInforme(c.id)} download className={clasesBoton(false)} aria-label={`Descargar PDF de ${c.termino}`}><DownloadSimple size={16} aria-hidden /> PDF</a>
      </div>
    </Bisel>
  );
}

/** Los términos vienen del mismo documento que sus fichas: nunca una lista
 * de ejemplos con conteos inventados. Buscar y abrir un reporte son gestos
 * distintos; una búsqueda no se convierte en un reporte antiguo por coincidir. */
export function TableroReportes({ consulta }: { consulta: string }) {
  const { data, error, mutate } = useConsultas();
  const valida = consulta.length >= MINIMO_CONSULTA && consulta.length <= LARGO_MAXIMO_CONSULTA;
  return (
    <div className="grid gap-10">
      <Bisel interior="p-5 sm:p-6">
        <form action="/reportes" method="get" role="search" className="grid gap-3">
          <label htmlFor="buscar-reportes" className="text-cuerpo font-medium text-tinta-titulo">Buscar noticias y publicaciones</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-nucleo border border-filo bg-vanta px-4">
              <MagnifyingGlass size={20} aria-hidden className="shrink-0 text-tinta-meta" />
              <input id="buscar-reportes" name="q" type="search" defaultValue={consulta} required minLength={MINIMO_CONSULTA} maxLength={LARGO_MAXIMO_CONSULTA} enterKeyHint="search" autoComplete="off" placeholder="Escribe un nombre, empresa o tema" aria-describedby="alcance-reportes" className="min-w-0 w-full bg-transparent py-4 text-cuerpo text-tinta-titulo placeholder:text-tinta-meta" />
            </div>
            <button type="submit" className={clasesBoton(true)}>Buscar <ArrowRight size={16} aria-hidden /></button>
          </div>
          <p id="alcance-reportes" className="text-meta text-tinta-meta">Noticias y textos de las publicaciones disponibles en Instagram, TikTok, Facebook y YouTube.</p>
        </form>
      </Bisel>

      {consulta === "" ? null : valida ? <ResultadosReportes consulta={consulta} /> : <p role="status" className="text-cuerpo text-tinta-meta">Escribe entre {MINIMO_CONSULTA} y {LARGO_MAXIMO_CONSULTA} caracteres para buscar.</p>}

      <section aria-labelledby="terminos-reportes">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="terminos-reportes" className="font-titular text-rotulo text-tinta-titulo">Términos en seguimiento</h2>
          {data === undefined ? null : <p className="text-meta text-tinta-meta">Reportes al {fechaConAnio(data.generado.slice(0, 10))}</p>}
        </div>
        {data !== undefined ? data.consultas.length === 0 ? (
          <p className="text-cuerpo text-tinta-meta">Todavía no hay términos en seguimiento. Puedes buscar un nombre o tema arriba.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">{data.consultas.map((c) => <TarjetaTermino key={c.id} c={c} />)}</div>
        ) : error !== undefined ? (
          <div role="status" className="flex flex-wrap items-center gap-4"><p className="text-cuerpo text-baja">No se pudieron cargar los reportes.</p><button type="button" onClick={() => void mutate()} className={clasesBoton(false)}>Reintentar</button></div>
        ) : <EstadoCarga etiqueta="Cargando reportes" />}
      </section>
    </div>
  );
}
