"use client";

import { ArrowUpRight } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { clasesBoton } from "@/components/ui/clases";
import { EstadoCarga } from "@/components/ui/estado-carga";
import { FilaPestanas } from "@/components/ui/pestanas";
import { useBusquedaViva } from "@/lib/busqueda/use-busqueda";
import { useFacebook, useRedes, useTikTok, useYouTube } from "@/lib/datos/hooks";
import { filtrarPorTexto } from "@/lib/dominio/consultas";
import { fechaConAnio, numero } from "@/lib/dominio/formato";
import { canonizarPublicacion, compararPublicaciones, fuenteDePublicacion, nombresDeCuentas, NOMBRE_RED, type PublicacionVisual, type RedVisual } from "@/lib/dominio/publicaciones";

const VISTAS = [{ id: "todo", nombre: "Todo" }, { id: "noticias", nombre: "Noticias" }, { id: "publicaciones", nombre: "Publicaciones" }] as const;
type Vista = (typeof VISTAS)[number]["id"];

function Resultado({ titulo, url, fuente, fecha, plataforma }: {
  titulo: string; url: string; fuente: string; fecha: string | null; plataforma?: string;
}) {
  return (
    <li className="border-b border-vela py-5 first:pt-0 last:border-0">
      <p className="mb-2 flex flex-wrap gap-x-2 text-meta text-tinta-meta">
        <span>{plataforma === undefined ? fuente : `${plataforma} · ${fuente}`}</span>
        {fecha ? <time dateTime={fecha}>{fechaConAnio(fecha.slice(0, 10))}</time> : <span>Sin fecha</span>}
      </p>
      <h4 className="break-words text-lectura text-tinta-titulo">{titulo || "Publicación sin título"}</h4>
      <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-flex min-h-11 items-center gap-2 text-cuerpo text-tinta-dato underline decoration-filo underline-offset-4 hover:decoration-tinta-dato">
        Abrir en {plataforma ?? fuente}<ArrowUpRight size={16} aria-hidden />
      </a>
    </li>
  );
}

function Grupo({ titulo, cantidad, children }: { titulo: string; cantidad: number | null; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <h3 className="mb-6 flex items-baseline justify-between gap-4 border-b border-filo pb-4 text-rotulo text-tinta-titulo">
        {titulo}{cantidad === null ? null : <span className="font-mono text-cuerpo tabular-nums text-tinta-meta">{numero(cantidad)}</span>}
      </h3>
      {children}
    </section>
  );
}

/** La búsqueda usa la prensa existente y TODAS las publicaciones disponibles,
 * antes del recorte del lector por lugar o popularidad. No descarga comentarios
 * ni inicia búsquedas pagadas. Cada fuente conserva sus fallos y su fecha. */
export function ResultadosReportes({ consulta }: { consulta: string }) {
  const noticias = useBusquedaViva(consulta, null);
  const instagram = useRedes();
  const tiktok = useTikTok();
  const facebook = useFacebook();
  const youtube = useYouTube();
  const [vista, setVista] = useState<Vista>("todo");
  const [limite, setLimite] = useState(20);
  const filas = useMemo(() => {
    const docs = { instagram: instagram.data, tiktok: tiktok.data, facebook: facebook.data, youtube: youtube.data };
    const todas: PublicacionVisual[] = [];
    const vistas = new Set<string>();
    for (const red of Object.keys(docs) as RedVisual[]) {
      const doc = docs[red];
      if (doc === undefined) continue;
      const nombres = nombresDeCuentas(doc);
      for (const post of doc.destacados ?? []) {
        const url = canonizarPublicacion(post.url, red);
        const clave = `${red}:${url ?? post.url}`;
        if (vistas.has(clave)) continue;
        vistas.add(clave);
        todas.push({ post, red, clave, url, fuente: fuenteDePublicacion(post, red, nombres) });
      }
    }
    return filtrarPorTexto(todas, {}, consulta).sort((a, b) => compararPublicaciones(a.post, b.post));
  }, [instagram.data, tiktok.data, facebook.data, youtube.data, consulta]);
  const redes = [
    { nombre: "Instagram", ...instagram }, { nombre: "TikTok", ...tiktok },
    { nombre: "Facebook", ...facebook }, { nombre: "YouTube", ...youtube },
  ];
  const cargando = redes.some((r) => r.data === undefined && r.error === undefined);
  const fallidas = redes.filter((r) => r.error !== undefined && r.data === undefined);
  const disponibles = redes.filter((r) => r.data !== undefined);

  return (
    <section aria-labelledby="resultados-reportes" className="grid gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="resultados-reportes" className="min-w-0 break-words font-titular text-rotulo text-tinta-titulo">Resultados para {consulta}</h2>
        <Link href="/reportes" className={clasesBoton(false)}>Limpiar búsqueda</Link>
      </div>
      <FilaPestanas etiqueta="Tipo de resultado" pestanas={VISTAS.map((v) => ({ id: v.id, nombre: v.nombre, activa: v.id === vista, onElegir: () => setVista(v.id) }))} />
      <div className={vista === "todo" ? "grid gap-10 lg:grid-cols-2 lg:gap-12" : "max-w-[64rem]"}>
        {vista === "publicaciones" ? null : (
          <Grupo titulo="Noticias" cantidad={noticias.cargando || noticias.fallo || !noticias.activa ? null : noticias.resultados.length}>
            {noticias.cargando ? <EstadoCarga etiqueta="Buscando noticias" /> : null}
            {noticias.fallo ? <div role="status" className="mb-4 grid justify-items-start gap-2"><p className="text-cuerpo text-baja">No se pudieron cargar todas las noticias.</p><button type="button" disabled={noticias.actualizando} className={clasesBoton(false)} onClick={() => void noticias.actualizar()}>{noticias.actualizando ? "Buscando…" : "Reintentar"}</button></div> : !noticias.activa ? <p role="status" className="text-cuerpo text-tinta-meta">La búsqueda de noticias no está disponible por ahora.</p> : null}
            {noticias.avisoActualizacion ? <p role="status" className="mb-4 text-cuerpo text-tinta-meta">{noticias.avisoActualizacion}</p> : null}
            {noticias.caidos.length > 0 && !noticias.fallo ? <p className="mb-4 text-cuerpo text-tinta-meta">Algunas fuentes de noticias no respondieron. Se muestran los resultados disponibles.</p> : null}
            <ul>{noticias.resultados.map((n) => <Resultado key={n.url} titulo={n.titulo} url={n.url} fuente={n.medio} fecha={n.publicado} />)}</ul>
            {!noticias.cargando && noticias.activa && !noticias.fallo && noticias.resultados.length === 0 ? <p className="text-cuerpo text-tinta-meta">No se encontraron noticias para este término. Prueba con otro nombre o una frase más corta.</p> : null}
            {noticias.truncada ? <p className="mt-4 text-meta text-tinta-meta">Se muestra una selección de resultados. Precisa el término para acotar la búsqueda.</p> : null}
          </Grupo>
        )}
        {vista === "noticias" ? null : (
          <Grupo titulo="Publicaciones" cantidad={cargando || disponibles.length === 0 ? null : filas.length}>
            {cargando ? <EstadoCarga etiqueta="Buscando publicaciones" /> : null}
            {fallidas.length === 0 ? null : <div role="status" className="mb-4 grid justify-items-start gap-2"><p className="text-cuerpo text-baja">No se pudieron cargar las publicaciones de {fallidas.map((r) => r.nombre).join(", ")}.</p><button type="button" className={clasesBoton(false)} onClick={() => void Promise.all(fallidas.map((r) => r.mutate()))}>Reintentar</button></div>}
            <ul>{filas.slice(0, limite).map((f) => <Resultado key={f.clave} titulo={f.post.titulo} url={f.url ?? f.post.url} fuente={f.fuente} plataforma={NOMBRE_RED[f.red]} fecha={f.post.publicado ?? f.post.fecha} />)}</ul>
            {!cargando && disponibles.length > 0 && filas.length === 0 ? <p className="text-cuerpo text-tinta-meta">No hay coincidencias en el texto de las publicaciones disponibles. Prueba con una frase más corta.</p> : null}
            {filas.length > limite ? <button type="button" className={clasesBoton(false)} onClick={() => setLimite((n) => n + 20)}>Ver más publicaciones</button> : null}
            {disponibles.length === 0 ? null : <p className="mt-6 text-meta text-tinta-meta">Última lectura: {disponibles.map((r) => `${r.nombre}, ${fechaConAnio(r.data!.generado.slice(0, 10))}`).join(" · ")}.</p>}
          </Grupo>
        )}
      </div>
    </section>
  );
}
