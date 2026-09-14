"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Destacado } from "@/lib/datos/tipos";
import type { PublicacionVisual, RedVisual } from "@/lib/dominio/publicaciones";

type VentanaInstagram = Window & { instgrm?: { Embeds: { process: () => void } } };

/** Altura por debajo de la cual el iframe de Instagram todavia no tiene
 *  contenido: embed.js lo inserta a 24px y crece cuando el post responde. */
const UMBRAL_ALTURA = 200;

/** Sin altura real tras esta espera, se ofrece recargar. */
const ESPERA_RECARGA = 8000;

/** Instagram transforma nodos: se le entrega un contenedor vacío separado
 * del árbol de React, y se vacía al salir para que no siga sonando. */
function MedioInstagram({ url, fallar }: { url: string; fallar: () => void }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const procesar = () => (window as VentanaInstagram).instgrm?.Embeds.process();
  useEffect(() => {
    const destino = contenedor.current;
    if (!destino) return;
    const cita = document.createElement("blockquote");
    cita.className = "instagram-media";
    cita.dataset.instgrmPermalink = url;
    cita.dataset.instgrmVersion = "14";
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.textContent = "Ver en Instagram";
    cita.append(enlace);
    destino.append(cita);
    procesar();
    return () => destino.replaceChildren();
  }, [url]);
  return <>
    <Script id="instagram-visual" src="https://www.instagram.com/embed.js" strategy="afterInteractive" onReady={procesar} onError={fallar} />
    <div ref={contenedor} className="medio-instagram w-full" />
  </>;
}

function MedioTikTok({ url, fallar }: { url: string; fallar: () => void }) {
  const marco = useRef<HTMLIFrameElement>(null);
  const [manual, setManual] = useState(false);
  const id = url.split("/").at(-1);
  useEffect(() => {
    function recibir(evento: MessageEvent) {
      if (evento.origin !== "https://www.tiktok.com" || evento.source !== marco.current?.contentWindow) return;
      const dato = evento.data;
      if (!dato || typeof dato !== "object" || dato["x-tiktok-player"] !== true) return;
      if (dato.type === "onPlayerReady") {
        marco.current?.contentWindow?.postMessage({ type: "mute", "x-tiktok-player": true }, "https://www.tiktok.com");
      }
      if (dato.type === "onPlayerError") {
        if (dato.value?.errorCode === 3002) setManual(true);
        else fallar();
      }
    }
    window.addEventListener("message", recibir);
    return () => window.removeEventListener("message", recibir);
  }, [fallar]);
  return <>
    <iframe ref={marco} title="Publicación de TikTok" src={`https://www.tiktok.com/player/v1/${id}?autoplay=1&muted=1&controls=1&description=1`}
      allow="autoplay; fullscreen" allowFullScreen className="aspect-[9/16] w-full border-0" onError={fallar} />
    {manual ? <p className="text-cuerpo text-tinta-meta">Pulsa reproducir para ver el video.</p> : null}
  </>;
}

/** La forma que tendra el medio antes de tenerlo, para que la tarjeta apenas
 *  se mueva cuando aterrice. TikTok es un 9:16 limpio. Instagram trae su
 *  propio marco (cabecera con la cuenta, pie con acciones y texto), unos
 *  8.75rem repartidos en dos bloques: 3.25rem y 5rem mas dos huecos de
 *  0.25rem. Los dos numeros se estimaron a 279px de ancho; si en un telefono
 *  real el iframe cae mas alto o mas bajo que el esqueleto, se ajustan aqui y
 *  en ningun otro lugar. Sin rotulo de plataforma: la banda ya la nombra. */
export function EsqueletoMedio({ red, tipo, pulsar = true }: { red: RedVisual; tipo: Destacado["tipo"]; pulsar?: boolean }) {
  const proporcion = red === "tiktok" || tipo === "video" ? "aspect-[9/16]" : "aspect-[4/5]";
  return <div aria-hidden data-esqueleto={red} className={`flex w-full flex-col gap-1 ${pulsar ? "animate-pulse" : ""}`}>
    {red === "instagram" ? <div className="h-[3.25rem] rounded-nucleo bg-vela" /> : null}
    <div className={`${proporcion} w-full rounded-nucleo bg-vela`} />
    {red === "instagram" ? <div className="h-[5rem] rounded-nucleo bg-vela" /> : null}
  </div>;
}

/** El medio aterriza sobre su esqueleto y aparece cuando tiene altura de
 *  verdad; hasta entonces la tarjeta conserva la forma esperada y nada salta
 *  bajo el dedo. Las tres capas comparten una celda de cuadricula: el
 *  esqueleto, el medio y, solo si hace falta, el aviso con «Volver a cargar».
 *  Ninguna de las dos ultimas cambia la altura de la tarjeta al aparecer. */
export function MedioSocial({ publicacion }: { publicacion: PublicacionVisual }) {
  const medio = useRef<HTMLDivElement>(null);
  const [intento, setIntento] = useState(0);
  const [fallo, setFallo] = useState(false);
  const [listo, setListo] = useState(false);
  const [cubierto, setCubierto] = useState(false);
  const [tardo, setTardo] = useState(false);
  // El medio se da por cargado cuando tiene altura de verdad. Se mide el
  // envoltorio y no el iframe: Instagram sustituye nodos y TikTok ya nace con
  // su 9:16, y el mismo observador sirve a los dos.
  useEffect(() => {
    const elemento = medio.current;
    if (!elemento || listo || fallo) return;
    const observador = new ResizeObserver((entradas) => {
      if (entradas.some((entrada) => entrada.contentRect.height >= UMBRAL_ALTURA)) setListo(true);
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [listo, fallo, intento]);
  useEffect(() => {
    if (listo || fallo) return;
    const temporizador = window.setTimeout(() => setTardo(true), ESPERA_RECARGA);
    return () => window.clearTimeout(temporizador);
  }, [listo, fallo, intento]);
  const fallar = useCallback(() => setFallo(true), []);
  const reintentar = () => {
    setFallo(false);
    setListo(false);
    setCubierto(false);
    setTardo(false);
    setIntento((valor) => valor + 1);
  };
  if (!publicacion.url) return <p className="py-8 text-lectura text-tinta-meta">Esta publicación no se puede mostrar aquí.</p>;
  const ofrecerRecarga = fallo || (tardo && !listo);
  return <div data-medio={publicacion.red} className="grid">
    {cubierto ? null : <div className="[grid-area:1/1]"><EsqueletoMedio red={publicacion.red} tipo={publicacion.post.tipo} pulsar={!fallo && !listo} /></div>}
    {/* self-start: en una celda apilada el hijo se estira a la altura de la
        fila y el observador mediria el esqueleto, no el medio. */}
    <div ref={medio} onTransitionEnd={(evento) => { if (evento.propertyName === "opacity" && listo) setCubierto(true); }}
      className={`[grid-area:1/1] min-w-0 self-start transition-opacity duration-[var(--dur-cambio)] ease-firma ${listo ? "opacity-100" : "opacity-0"}`}>
      {fallo ? null : publicacion.red === "instagram"
        ? <MedioInstagram key={intento} url={publicacion.url} fallar={fallar} />
        : <MedioTikTok key={intento} url={publicacion.url} fallar={fallar} />}
    </div>
    {ofrecerRecarga ? <div className="[grid-area:1/1] flex flex-col items-center justify-end gap-2 pb-4 text-center">
      {fallo ? <p role="status" className="text-cuerpo text-tinta-meta">La publicación no está disponible en esta vista.</p> : null}
      {/* Un iframe cargado puede contener un rechazo del proveedor sin que el
          navegador emita error: ese caso lo cubre «Ver original», que esta
          siempre en la banda. Aqui se ofrece recargar solo cuando la carga
          fallo o cuando en ESPERA_RECARGA no llego altura alguna. */}
      <button type="button" className="text-meta text-tinta-meta transition-colors hover:text-tinta-titulo" onClick={reintentar}>Volver a cargar</button>
    </div> : null}
  </div>;
}
