"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRedes, useTikTok } from "@/lib/datos/hooks";
import { reunirPublicaciones, type PublicacionVisual, type RedVisual } from "@/lib/dominio/publicaciones";
import { fechaCorta, hora, numero } from "@/lib/dominio/formato";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";
import { clasesChip } from "@/components/ui/clases";
import { MedioSocial } from "./medio-social";

const FILTROS = [{ id: "todas", nombre: "Todas" }, { id: "instagram", nombre: "Instagram" }, { id: "tiktok", nombre: "TikTok" }] as const;

/** El visor monta un solo medio: ocultar treinta iframes con CSS deja treinta
 * reproductores vivos. Los metadatos sí permanecen para poder recorrerlos. */
export default function VisorRedes({ zona }: { zona: ZonaRuta | null }) {
  const instagram = useRedes();
  const tiktok = useTikTok();
  const [filtro, setFiltro] = useState<"todas" | RedVisual>("todas");
  const publicaciones = useMemo(() => reunirPublicaciones(instagram.data, tiktok.data, zona), [instagram.data, tiktok.data, zona]);
  const filas = useMemo(() => publicaciones.filter((fila) => filtro === "todas" || fila.red === filtro), [publicaciones, filtro]);
  return <>
    <div role="group" aria-label="Plataforma visual" className="flex flex-wrap gap-1.5">
      {FILTROS.map((opcion) => <button key={opcion.id} type="button" className={clasesChip(filtro === opcion.id)} aria-pressed={filtro === opcion.id} onClick={() => setFiltro(opcion.id)}>{opcion.nombre}</button>)}
    </div>
    <p className="my-6 max-w-[65ch] text-lectura text-tinta-prosa">Una selección de publicaciones recientes, de la más nueva a la más antigua.</p>
    {(filtro === "todas" || filtro === "instagram") && !instagram.data ? <p role="status" className="mb-4 text-cuerpo text-tinta-meta">{instagram.error ? "Las publicaciones de Instagram no están disponibles." : "Cargando Instagram…"}</p> : null}
    {(filtro === "todas" || filtro === "tiktok") && !tiktok.data ? <p role="status" className="mb-4 text-cuerpo text-tinta-meta">{tiktok.error ? "Las publicaciones de TikTok no están disponibles." : "Cargando TikTok…"}</p> : null}
    {filas.length ? <Recorrido key={`${filtro}:${filas.map((fila) => fila.clave).join("|")}`} publicaciones={filas} /> :
      <p className="py-8 text-lectura text-tinta-meta">No hay publicaciones disponibles para esta selección. Es un hueco, no un cero.</p>}
  </>;
}

function Recorrido({ publicaciones }: { publicaciones: PublicacionVisual[] }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [actual, setActual] = useState(0);
  const [visible, setVisible] = useState(true);
  const [enPantalla, setEnPantalla] = useState(false);
  useEffect(() => {
    const cambiar = () => setVisible(document.visibilityState === "visible");
    cambiar();
    document.addEventListener("visibilitychange", cambiar);
    return () => document.removeEventListener("visibilitychange", cambiar);
  }, []);
  useEffect(() => {
    const raiz = contenedor.current;
    if (!raiz) return;
    const observador = new IntersectionObserver(() => {
      // Las entradas de otras filas pueden conservar geometría anterior a un
      // cambio de altura. Comparar rectángulos actuales evita volver al post
      // anterior al pulsar Siguiente.
      const visibles = [...raiz.querySelectorAll<HTMLElement>("[data-indice]")]
        .map((elemento) => ({ elemento, rectangulo: elemento.getBoundingClientRect() }))
        .filter(({ rectangulo }) => rectangulo.bottom > 160 && rectangulo.top < window.innerHeight)
        .sort((a, b) => Math.abs(a.rectangulo.top - 160) - Math.abs(b.rectangulo.top - 160));
      const primera = visibles[0];
      setEnPantalla(!!primera);
      if (primera) setActual(Number(primera.elemento.dataset.indice));
    }, { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
    raiz.querySelectorAll("[data-indice]").forEach((elemento) => observador.observe(elemento));
    return () => observador.disconnect();
  }, []);
  function ir(indice: number) {
    const destino = contenedor.current?.querySelector<HTMLElement>(`[data-indice="${indice}"]`);
    destino?.scrollIntoView({ behavior: "instant", block: "start" });
    setActual(indice);
  }
  return <>
    <div className="sticky top-20 z-10 mb-6 flex flex-wrap items-center justify-between gap-3 bg-vanta py-3" aria-label="Recorrer publicaciones">
      <button type="button" className={`${clasesChip(false)} disabled:opacity-50`} disabled={actual === 0} onClick={() => ir(actual - 1)}>Anterior</button>
      <p aria-live="polite" className="text-cuerpo tabular-nums text-tinta-meta">{actual + 1} de {publicaciones.length}</p>
      <button type="button" className={`${clasesChip(false)} disabled:opacity-50`} disabled={actual === publicaciones.length - 1} onClick={() => ir(actual + 1)}>Siguiente</button>
    </div>
    <div ref={contenedor} className="recorrido-visual">
      {publicaciones.map((fila, indice) => <article key={fila.clave} data-indice={indice} aria-label={`Publicación ${indice + 1}`} className="publicacion-visual grid min-h-[80svh] items-start gap-6 border-b border-filo py-8 md:grid-cols-2 md:gap-12">
        <EspacioMedio publicacion={fila} activo={indice === actual && visible && enPantalla} />
        <div className="min-w-0 self-center">
          <h2 className="text-rotulo text-tinta-titulo break-words">{fila.post.titulo || "Publicación sin título"}</h2>
          <p className="mt-4 text-cuerpo text-tinta-prosa">{fila.fuente} · {fila.red === "instagram" ? "Instagram" : "TikTok"}</p>
          <p className="mt-2 text-cuerpo text-tinta-meta">{fila.red === "instagram" ? "Cuenta con sede en " : "Habla de "}{NOMBRE_CORTO[fila.post.zona as ZonaRuta] ?? (fila.post.zona === "estatal" ? "Baja California" : "un lugar sin precisar")}</p>
          <p className="mt-2 text-cuerpo text-tinta-meta"><time dateTime={fila.post.publicado ?? fila.post.fecha}>{fechaCorta(fila.post.publicado ?? fila.post.fecha)}{fila.post.publicado ? ` · ${hora(fila.post.publicado)}` : ""}</time></p>
          <dl className="my-6 grid grid-cols-2 gap-4 text-cuerpo">
            {([["Likes", fila.post.likes], ["Comentarios", fila.post.comentarios], ["Reproducciones", fila.post.reproducciones], ["Compartidos", fila.post.compartidos], ["Guardados", fila.post.guardados]] as const).map(([nombre, valor]) =>
              <div key={nombre}><dt className="text-tinta-meta">{nombre}</dt><dd className="tabular-nums text-tinta-dato">{valor === undefined ? "sin dato" : numero(valor)}</dd></div>)}
          </dl>
          {fila.url ? <a href={fila.url} target="_blank" rel="noopener noreferrer nofollow" className={clasesChip(true)}>Ver original</a> : <p className="text-cuerpo text-tinta-meta">Enlace no disponible.</p>}
        </div>
      </article>)}
    </div>
    <p className="py-8 text-lectura text-tinta-meta">Llegaste al final de esta selección.</p>
  </>;
}

/** Mantiene la altura ya medida al desmontar el medio. Sin esta reserva,
 * salir de un reel alto desplaza el siguiente post bajo el dedo. */
function EspacioMedio({ publicacion, activo }: { publicacion: PublicacionVisual; activo: boolean }) {
  const espacio = useRef<HTMLDivElement>(null);
  const [altura, setAltura] = useState(0);
  useEffect(() => {
    const elemento = espacio.current;
    if (!elemento || !activo) return;
    const observador = new ResizeObserver(() => {
      const medida = Math.ceil(elemento.getBoundingClientRect().height);
      setAltura((anterior) => Math.max(anterior, medida));
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [activo]);
  return <div className="mx-auto w-full max-w-[24rem]" style={{ minHeight: altura || undefined }}>
    <div ref={espacio} className="min-h-[32rem]">
      {activo ? <MedioSocial publicacion={publicacion} /> : <div className="flex min-h-[32rem] items-center justify-center bg-carta text-cuerpo text-tinta-meta">{publicacion.red === "instagram" ? "Instagram" : "TikTok"}</div>}
    </div>
  </div>;
}
