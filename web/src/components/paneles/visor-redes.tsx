"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookmarkSimple, ChatCircle, Heart, Play, ShareFat, X as Cerrar } from "@phosphor-icons/react";
import { useRedes, useRedesComentarios, useTikTok, useTikTokComentarios } from "@/lib/datos/hooks";
import type { ComentarioPublicado } from "@/lib/datos/tipos";
import { NOMBRE_RED, reunirPublicaciones, type CubetaRegion, type PublicacionVisual, type RedVisual } from "@/lib/dominio/publicaciones";
import { fechaCorta, hace, hora, numero } from "@/lib/dominio/formato";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";
import { teclasDelRecorrido, useRecorrido } from "@/lib/pantalla/recorrido";
import { CONTROL } from "@/components/lector/lector";
import { clasesChip } from "@/components/ui/clases";
import { ComentariosPublicacion, VistaPreviaComentarios, type Textos } from "./comentarios-publicacion";
import { EsqueletoMedio, MedioSocial } from "./medio-social";

/** Las tres pestanas que caen aqui; YouTube y X son otras hojas del lector. */
export type FiltroVisual = "todas" | RedVisual;

const SIN_FILAS = "No hay publicaciones disponibles para esta selección. Es un hueco, no un cero.";

/** Corte de cada plataforma (`generado` de su archivo). La antiguedad se mide
 *  contra el, nunca contra el reloj del navegador: ver formato.ts::hace. */
type Cortes = Partial<Record<RedVisual, string>>;

/** El visor monta un solo medio: ocultar treinta iframes con CSS deja treinta
 * reproductores vivos. Los metadatos si permanecen para poder recorrerlos.
 *
 * ES UNA TARJETA POR PANTALLA, dentro del lector (components/lector) en todo
 * ancho desde el 15 de septiembre de 2026. El 14 nacio como Visual del
 * telefono junto a una Lista que en escritorio era la entrada; la Lista se
 * fue y con ella la barra Anterior / Siguiente y el desplazamiento de pagina.
 * Cada tarjeta mide la caja (`--alto-tarjeta`): en el telefono el titular va
 * debajo del medio con las cifras en una columna al costado; en escritorio el
 * medio va a la izquierda y a la derecha el titular, las cifras, «Ver
 * original», «Comentarios» y una vista previa de los dos comentarios mas
 * votados. El mismo arbol JSX sirve a los dos con clases `md:`; nada se monta
 * dos veces. La altura y el ancho del medio los fija globals.css
 * (`.publicacion-visual`, `.medio-visual`), no clases arbitrarias, porque el
 * numero de la reserva tiene que vivir en un solo lugar.
 *
 * Los comentarios viven en la tarjeta desde que no hay Lista: el texto es lo
 * que la direccion pidio ver el 8 de septiembre de 2026. Una sola hoja
 * (`<dialog>`) para todo el recorrido, nunca una por tarjeta; su cuerpo esta
 * en paneles/comentarios-publicacion.tsx. */
export default function VisorRedes({ zona, filtro, cubeta = "corredor" }: { zona: ZonaRuta | null; filtro: FiltroVisual; cubeta?: CubetaRegion }) {
  const instagram = useRedes();
  const tiktok = useTikTok();
  const textosInstagram = useRedesComentarios();
  const textosTikTok = useTikTokComentarios();
  const textos: Record<RedVisual, Textos> = { instagram: textosInstagram, tiktok: textosTikTok };
  const publicaciones = useMemo(() => reunirPublicaciones(instagram.data, tiktok.data, zona, cubeta), [instagram.data, tiktok.data, zona, cubeta]);
  const filas = useMemo(() => publicaciones.filter((fila) => filtro === "todas" || fila.red === filtro), [publicaciones, filtro]);
  const cortes: Cortes = { instagram: instagram.data?.generado, tiktok: tiktok.data?.generado };
  // Una plataforma del filtro actual sin datos y sin error: todavia carga.
  const cargando =
    (filtro !== "tiktok" && !instagram.data && !instagram.error) ||
    (filtro !== "instagram" && !tiktok.data && !tiktok.error);
  const estados = [
    (filtro === "todas" || filtro === "instagram") && !instagram.data
      ? instagram.error ? "Las publicaciones de Instagram no están disponibles." : "Cargando Instagram…" : null,
    (filtro === "todas" || filtro === "tiktok") && !tiktok.data
      ? tiktok.error ? "Las publicaciones de TikTok no están disponibles." : "Cargando TikTok…" : null,
  ].filter((estado): estado is string => estado !== null);
  return (
    <>
      {/* El estado se dice pero no ocupa lugar: la caja es la pantalla y una
          linea encima encogeria las tarjetas. */}
      {estados.map((estado) => <p key={estado} role="status" className="sr-only">{estado}</p>)}
      <Recorrido key={`${filtro}:${filas.map((fila) => fila.clave).join("|")}`} publicaciones={filas} cortes={cortes} cargando={cargando} textos={textos} />
    </>
  );
}

/** El medio montado cambia cuando el desplazamiento ASIENTA, nunca a mitad
 *  del gesto (useRecorrido): la tarjeta que sale sigue viva mientras el dedo
 *  la arrastra y la que entra monta su medio ya quieta en su sitio.
 *
 *  Sin filas, la caja sigue ahi con una tarjeta que mide lo mismo: el
 *  esqueleto mientras carga, y si no hay nada, el hueco dicho como hueco. La
 *  caja ES la pantalla, y una linea suelta en su lugar dejaria el lector
 *  vacio. */
function Recorrido({ publicaciones, cortes, cargando, textos }: {
  publicaciones: PublicacionVisual[];
  cortes: Cortes;
  cargando: boolean;
  textos: Record<RedVisual, Textos>;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const { actual, enPantalla, ir } = useRecorrido(contenedor);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const cambiar = () => setVisible(document.visibilityState === "visible");
    cambiar();
    document.addEventListener("visibilitychange", cambiar);
    return () => document.removeEventListener("visibilitychange", cambiar);
  }, []);
  const hoja = useRef<HTMLDialogElement>(null);
  const [abierta, setAbierta] = useState<PublicacionVisual | null>(null);
  useEffect(() => {
    if (abierta !== null) hoja.current?.showModal();
  }, [abierta]);
  const total = publicaciones.length;
  return <>
    <div ref={contenedor} className="recorrido-lector" tabIndex={0} role="region" aria-label="Publicaciones"
      onKeyDown={(evento) => teclasDelRecorrido(evento, actual, total, ir)}>
      {publicaciones.map((fila, indice) => (
        <Publicacion key={fila.clave} fila={fila} indice={indice} total={total} corte={cortes[fila.red]}
          activo={indice === actual && visible && enPantalla}
          comentarios={textos[fila.red].data?.por_post[fila.post.url]}
          onComentarios={() => setAbierta(fila)} />
      ))}
      {total === 0
        ? cargando
          ? <EsqueletoPublicacion />
          : <div className="publicacion-visual flex items-center px-4 md:px-8"><p className="mx-auto w-full max-w-[88rem] text-lectura text-tinta-meta">{SIN_FILAS}</p></div>
        : null}
    </div>
    <dialog ref={hoja} className="dialogo-lector" aria-labelledby="titulo-comentarios" onClose={() => setAbierta(null)}>
      <div className="cabecera-dialogo-lector">
        <h2 id="titulo-comentarios" className="text-rotulo text-tinta-titulo">Comentarios</h2>
        <button type="button" className={CONTROL} aria-label="Cerrar comentarios" onClick={() => hoja.current?.close()}><Cerrar size={20} aria-hidden /></button>
      </div>
      {abierta === null ? null : <ComentariosPublicacion key={abierta.clave} fila={abierta} textos={textos[abierta.red]} />}
    </dialog>
  </>;
}

/** Instagram: la zona es la sede de la cuenta («desde»). TikTok: la zona sale
 *  del texto del video («sobre»). Una preposicion cada una, sin oracion.
 *
 *  `fuera` y `nacional` son los dos residuos y NO son lo mismo: uno nombro un
 *  lugar que este tablero no cubre y el otro no nombro ninguno. El alcance los
 *  separa; un corte anterior al 15 de septiembre de 2026 no lo trae y los dos
 *  caen en «un lugar sin precisar», que es lo que se decia antes. */
function lugarDe(fila: PublicacionVisual): string {
  const { zona, alcance } = fila.post;
  const nombre = NOMBRE_CORTO[zona as ZonaRuta]
    ?? (zona === "estatal"
      ? "Baja California"
      : zona === "internacional"
        ? "el mundo"
        : alcance === "fuera"
          ? "un lugar fuera del corredor"
          : "un lugar sin precisar");
  return `${fila.red === "instagram" ? "desde" : "sobre"} ${nombre}`;
}

const CIFRAS = [
  ["Likes", "likes", Heart],
  ["Comentarios", "comentarios", ChatCircle],
  ["Reproducciones", "reproducciones", Play],
  ["Compartidos", "compartidos", ShareFat],
  ["Guardados", "guardados", BookmarkSimple],
] as const;

function Publicacion({ fila, indice, total, corte, activo, comentarios, onComentarios }: {
  fila: PublicacionVisual;
  indice: number;
  total: number;
  corte: string | undefined;
  activo: boolean;
  comentarios: ComentarioPublicado[] | undefined;
  onComentarios: () => void;
}) {
  const iso = fila.post.publicado ?? fila.post.fecha;
  const antiguedad = corte ? hace(iso, corte) : "";
  const cuando = antiguedad ? `hace ${antiguedad}` : `${fechaCorta(iso)}${fila.post.publicado ? ` · ${hora(fila.post.publicado)}` : ""}`;
  return <article data-indice={indice} aria-label={`Publicación ${indice + 1} de ${total}`}
    className="publicacion-visual mx-auto flex w-full max-w-[88rem] flex-col md:grid md:grid-cols-2 md:items-center md:gap-12 md:px-8 md:py-8">
    <EspacioMedio publicacion={fila} activo={activo} />
    {/* La banda del titular va DEBAJO del medio, en flujo, no encima: encima
        taparia el pie propio de Instagram (autor, enlace) y exigiria juegos de
        pointer-events sobre el iframe. En telefono cabe en dos lineas de
        titular; la columna de escritorio lo muestra entero. */}
    <div className="relative min-w-0 px-4 pb-6 md:static md:px-0 md:pb-0">
      <h2 className="line-clamp-2 break-words text-cuerpo text-tinta-titulo md:line-clamp-none md:text-rotulo">{fila.post.titulo || "Publicación sin título"}</h2>
      <p className="mt-2 text-meta text-tinta-meta md:mt-4 md:text-cuerpo md:text-tinta-prosa">
        {fila.fuente} · {NOMBRE_RED[fila.red]} · <time dateTime={iso}>{cuando}</time> · {lugarDe(fila)}
      </p>
      {/* Cinco cifras siempre, con «sin dato» donde la plataforma no publica
          la cifra: Instagram no expone compartidos ni guardados. Omitir la fila
          esconderia el hueco; un 0 lo mentiria. En telefono es una columna al
          costado del medio, anclada a la banda (`bottom-full`): queda justo
          encima de ella tenga el titular una o dos lineas, sobre el margen que
          EspacioMedio le deja al medio. */}
      <dl className="absolute right-3 bottom-full mb-4 flex w-14 flex-col items-center gap-4 md:static md:my-6 md:grid md:w-auto md:grid-cols-3 md:gap-4">
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
      <div className="mt-3 flex flex-wrap items-center gap-3 md:mt-0">
        {fila.url
          ? <a href={fila.url} target="_blank" rel="noopener noreferrer nofollow" className={clasesChip(true)}>Ver original</a>
          : <p className="text-meta text-tinta-meta md:text-cuerpo">Enlace no disponible.</p>}
        {/* En el telefono la cifra ya esta en la columna de iconos; repetirla
            aqui no cabe en una linea con «Ver original» y el contador. */}
        <button type="button" className={clasesChip(false)} onClick={onComentarios}>
          Comentarios<span className="hidden md:inline"> · {numero(fila.post.comentarios)}</span>
        </button>
        <p className="ml-auto text-meta tabular-nums text-tinta-meta">{indice + 1} de {total}</p>
      </div>
      <div className="mt-6 hidden md:block"><VistaPreviaComentarios comentarios={comentarios} /></div>
    </div>
  </article>;
}

/* En escritorio la celda se estira (nunca `justify-self-end`: un item que se
   encoge a su contenido deja al medio, que mide en %, con ancho cero) y el
   medio se alinea al borde de la columna de texto con `justify-end`. */
const CLASES_MARCO_MEDIO = "flex flex-1 items-center justify-center px-4 pt-4 pr-20 md:flex-none md:justify-end md:px-0 md:pt-0";

/** Mantiene la altura ya medida al desmontar el medio. La reserva parte del
 * esqueleto, que es la forma esperada, y solo crece con lo medido: asi el
 * iframe de Instagram, que nace a 24px, no encoge la tarjeta ni la agranda al
 * aterrizar, y salir de un reel alto no desplaza el siguiente post bajo el
 * dedo. Las tarjetas inactivas muestran el esqueleto quieto, sin pulso: es una
 * forma en reposo, no una carga en curso. */
function EspacioMedio({ publicacion, activo }: { publicacion: PublicacionVisual; activo: boolean }) {
  const espacio = useRef<HTMLDivElement>(null);
  const [altura, setAltura] = useState(0);
  useEffect(() => {
    const elemento = espacio.current;
    if (!elemento || !activo) return;
    const observador = new ResizeObserver((entradas) => {
      const medida = Math.ceil(entradas[0]?.contentRect.height ?? 0);
      setAltura((anterior) => Math.max(anterior, medida));
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [activo]);
  return <div className={CLASES_MARCO_MEDIO}>
    <div className="medio-visual mx-auto md:mx-0 md:max-w-[24rem]" style={{ minHeight: altura || undefined }}>
      <div ref={espacio}>
        {activo ? <MedioSocial publicacion={publicacion} /> : <EsqueletoMedio red={publicacion.red} tipo={publicacion.post.tipo} pulsar={false} />}
      </div>
    </div>
  </div>;
}

/** Mientras no hay filas, una tarjeta con la geometria de una real, para que
 *  la primera publicacion sustituya al esqueleto en su sitio y no empuje la
 *  caja. */
function EsqueletoPublicacion() {
  return <article aria-hidden className="publicacion-visual sin-ajuste mx-auto flex w-full max-w-[88rem] flex-col md:grid md:grid-cols-2 md:items-center md:gap-12 md:px-8">
    <div className={CLASES_MARCO_MEDIO}>
      <div className="medio-visual mx-auto md:mx-0 md:max-w-[24rem]"><EsqueletoMedio red="instagram" tipo="imagen" /></div>
    </div>
    <div className="animate-pulse px-4 pb-6 md:px-0">
      <div className="h-5 w-10/12 rounded-etiqueta bg-vela" />
      <div className="mt-3 h-3 w-1/2 rounded-etiqueta bg-vela" />
    </div>
  </article>;
}
