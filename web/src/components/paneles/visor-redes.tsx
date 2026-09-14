"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookmarkSimple, ChatCircle, Heart, Play, ShareFat } from "@phosphor-icons/react";
import { useRedes, useTikTok } from "@/lib/datos/hooks";
import { reunirPublicaciones, type PublicacionVisual, type RedVisual } from "@/lib/dominio/publicaciones";
import { fechaCorta, hace, hora, numero } from "@/lib/dominio/formato";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";
import { clasesChip } from "@/components/ui/clases";
import { MedioSocial } from "./medio-social";

const FILTROS = [{ id: "todas", nombre: "Todas" }, { id: "instagram", nombre: "Instagram" }, { id: "tiktok", nombre: "TikTok" }] as const;

/** Corte de cada plataforma (`generado` de su archivo). La antiguedad se mide
 *  contra el, nunca contra el reloj del navegador: ver formato.ts::hace. */
type Cortes = Partial<Record<RedVisual, string>>;

/** El visor monta un solo medio: ocultar treinta iframes con CSS deja treinta
 * reproductores vivos. Los metadatos si permanecen para poder recorrerlos.
 *
 * EN EL TELEFONO ES UN RECORRIDO A PANTALLA COMPLETA (14 de septiembre de
 * 2026): cada tarjeta mide la pantalla, se pasa de una a otra con el gesto de
 * desplazar y el titular va debajo del medio, con las cifras en una columna al
 * costado. El mismo arbol JSX sirve a escritorio con las clases `md:`, que
 * restauran las dos columnas y la barra Anterior / Siguiente; nada se monta
 * dos veces. La altura y el ancho del medio los fija globals.css
 * (`.publicacion-visual`, `.medio-visual`), no clases arbitrarias, porque el
 * numero del margen de ajuste tiene que vivir en un solo lugar. */
export default function VisorRedes({ zona }: { zona: ZonaRuta | null }) {
  const instagram = useRedes();
  const tiktok = useTikTok();
  const [filtro, setFiltro] = useState<"todas" | RedVisual>("todas");
  const publicaciones = useMemo(() => reunirPublicaciones(instagram.data, tiktok.data, zona), [instagram.data, tiktok.data, zona]);
  const filas = useMemo(() => publicaciones.filter((fila) => filtro === "todas" || fila.red === filtro), [publicaciones, filtro]);
  const cortes: Cortes = { instagram: instagram.data?.generado, tiktok: tiktok.data?.generado };
  return <>
    <div role="group" aria-label="Plataforma visual" className="flex flex-wrap gap-1.5">
      {FILTROS.map((opcion) => <button key={opcion.id} type="button" className={clasesChip(filtro === opcion.id)} aria-pressed={filtro === opcion.id} onClick={() => setFiltro(opcion.id)}>{opcion.nombre}</button>)}
    </div>
    <p className="my-6 hidden max-w-[65ch] text-lectura text-tinta-prosa md:block">Una selección de publicaciones recientes, de la más nueva a la más antigua.</p>
    {(filtro === "todas" || filtro === "instagram") && !instagram.data ? <p role="status" className="my-4 text-cuerpo text-tinta-meta">{instagram.error ? "Las publicaciones de Instagram no están disponibles." : "Cargando Instagram…"}</p> : null}
    {(filtro === "todas" || filtro === "tiktok") && !tiktok.data ? <p role="status" className="my-4 text-cuerpo text-tinta-meta">{tiktok.error ? "Las publicaciones de TikTok no están disponibles." : "Cargando TikTok…"}</p> : null}
    {filas.length ? <Recorrido key={`${filtro}:${filas.map((fila) => fila.clave).join("|")}`} publicaciones={filas} cortes={cortes} /> :
      <p className="py-8 text-lectura text-tinta-meta">No hay publicaciones disponibles para esta selección. Es un hueco, no un cero.</p>}
  </>;
}

/** Margen de ajuste de la primera tarjeta, leido del CSS en cada llamada: es
 *  distinto en telefono y en escritorio, y leerlo aqui en vez de repetir el
 *  numero hace que un cambio de ancho se recoja solo. */
function margenDeAjuste(raiz: HTMLElement): number {
  const primera = raiz.querySelector<HTMLElement>("[data-indice]");
  return primera ? parseFloat(getComputedStyle(primera).scrollMarginTop) || 0 : 0;
}

function Recorrido({ publicaciones, cortes }: { publicaciones: PublicacionVisual[]; cortes: Cortes }) {
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
      // Las entradas de otras filas pueden conservar geometria anterior a un
      // cambio de altura. Comparar rectangulos actuales evita volver al post
      // anterior al pulsar Siguiente.
      const margen = margenDeAjuste(raiz);
      const visibles = [...raiz.querySelectorAll<HTMLElement>("[data-indice]")]
        .map((elemento) => ({ elemento, rectangulo: elemento.getBoundingClientRect() }))
        .filter(({ rectangulo }) => rectangulo.bottom > margen && rectangulo.top < window.innerHeight)
        .sort((a, b) => Math.abs(a.rectangulo.top - margen) - Math.abs(b.rectangulo.top - margen));
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
  const total = publicaciones.length;
  return <>
    <div className="sticky top-[var(--nav-alto)] z-[var(--z-elevado)] mb-6 hidden flex-wrap items-center justify-between gap-3 bg-vanta py-3 md:flex" aria-label="Recorrer publicaciones">
      <button type="button" className={`${clasesChip(false)} disabled:opacity-50`} disabled={actual === 0} onClick={() => ir(actual - 1)}>Anterior</button>
      <p aria-live="polite" className="text-cuerpo tabular-nums text-tinta-meta">{actual + 1} de {total}</p>
      <button type="button" className={`${clasesChip(false)} disabled:opacity-50`} disabled={actual === total - 1} onClick={() => ir(actual + 1)}>Siguiente</button>
    </div>
    <div ref={contenedor} className="recorrido-visual">
      {publicaciones.map((fila, indice) => <Publicacion key={fila.clave} fila={fila} indice={indice} total={total} corte={cortes[fila.red]} activo={indice === actual && visible && enPantalla} />)}
    </div>
    <p className="py-8 text-lectura text-tinta-meta">Llegaste al final de esta selección.</p>
  </>;
}

const RED_NOMBRE: Record<RedVisual, string> = { instagram: "Instagram", tiktok: "TikTok" };

/** Instagram: la zona es la sede de la cuenta («desde»). TikTok: la zona sale
 *  del texto del video («sobre»). Una preposicion cada una, sin oracion. */
function lugar(fila: PublicacionVisual): string {
  const nombre = NOMBRE_CORTO[fila.post.zona as ZonaRuta] ?? (fila.post.zona === "estatal" ? "Baja California" : "un lugar sin precisar");
  return `${fila.red === "instagram" ? "desde" : "sobre"} ${nombre}`;
}

const CIFRAS = [
  ["Likes", "likes", Heart],
  ["Comentarios", "comentarios", ChatCircle],
  ["Reproducciones", "reproducciones", Play],
  ["Compartidos", "compartidos", ShareFat],
  ["Guardados", "guardados", BookmarkSimple],
] as const;

function Publicacion({ fila, indice, total, corte, activo }: { fila: PublicacionVisual; indice: number; total: number; corte: string | undefined; activo: boolean }) {
  const iso = fila.post.publicado ?? fila.post.fecha;
  const antiguedad = corte ? hace(iso, corte) : "";
  const cuando = antiguedad ? `hace ${antiguedad}` : `${fechaCorta(iso)}${fila.post.publicado ? ` · ${hora(fila.post.publicado)}` : ""}`;
  return <article data-indice={indice} aria-label={`Publicación ${indice + 1} de ${total}`}
    className="publicacion-visual relative -mx-4 flex flex-col md:mx-0 md:grid md:grid-cols-2 md:items-start md:gap-12 md:border-b md:border-filo md:py-8">
    <EspacioMedio publicacion={fila} activo={activo} />
    {/* La banda del titular va DEBAJO del medio, en flujo, no encima: encima
        taparia el pie propio de Instagram (autor, enlace) y exigiria juegos de
        pointer-events sobre el iframe. En telefono cabe en dos lineas de
        titular; la columna de escritorio lo muestra entero. */}
    <div className="min-w-0 px-4 pb-6 md:self-center md:px-0 md:pb-0">
      <h2 className="line-clamp-2 break-words text-cuerpo text-tinta-titulo md:line-clamp-none md:text-rotulo">{fila.post.titulo || "Publicación sin título"}</h2>
      <p className="mt-2 text-meta text-tinta-meta md:mt-4 md:text-cuerpo md:text-tinta-prosa">
        {fila.fuente} · {RED_NOMBRE[fila.red]} · <time dateTime={iso}>{cuando}</time> · {lugar(fila)}
      </p>
      {/* Cinco cifras siempre, con «sin dato» donde la plataforma no publica
          la cifra: Instagram no expone compartidos ni guardados. Omitir la fila
          esconderia el hueco; un 0 lo mentiria. En telefono es una columna al
          costado del medio, sobre el margen que EspacioMedio le deja. */}
      <dl className="absolute right-3 bottom-40 flex w-14 flex-col items-center gap-4 md:static md:my-6 md:grid md:w-auto md:grid-cols-2 md:gap-4">
        {CIFRAS.map(([nombre, campo, Icono]) => {
          const valor = fila.post[campo];
          return <div key={campo} className="flex flex-col items-center md:items-start">
            <dt>
              <Icono aria-hidden size={22} weight="light" className="text-tinta-inerte md:hidden" />
              <span className="sr-only md:not-sr-only md:text-cuerpo md:text-tinta-meta">{nombre}</span>
            </dt>
            <dd className={`text-meta tabular-nums md:text-cuerpo ${valor === undefined ? "text-tinta-meta" : "text-tinta-dato"}`}>{valor === undefined ? "sin dato" : numero(valor)}</dd>
          </div>;
        })}
      </dl>
      <div className="mt-3 flex items-center justify-between gap-3 md:mt-0 md:justify-start">
        {fila.url
          ? <a href={fila.url} target="_blank" rel="noopener noreferrer nofollow" className={clasesChip(true)}>Ver original</a>
          : <p className="text-meta text-tinta-meta md:text-cuerpo">Enlace no disponible.</p>}
        <p className="text-meta tabular-nums text-tinta-meta md:hidden">{indice + 1} de {total}</p>
      </div>
    </div>
  </article>;
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
  return <div className="flex flex-1 items-center justify-center px-4 pt-4 pr-20 md:block md:px-0 md:pt-0">
    <div className="medio-visual mx-auto md:w-full md:max-w-[24rem]" style={{ minHeight: altura || undefined }}>
      <div ref={espacio} className="min-h-[32rem]">
        {activo ? <MedioSocial publicacion={publicacion} /> : <div className="flex min-h-[32rem] items-center justify-center bg-carta text-cuerpo text-tinta-meta">{RED_NOMBRE[publicacion.red]}</div>}
      </div>
    </div>
  </div>;
}
