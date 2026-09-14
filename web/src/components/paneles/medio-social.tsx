"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { clasesChip } from "@/components/ui/clases";
import type { PublicacionVisual } from "@/lib/dominio/publicaciones";

type VentanaInstagram = Window & { instgrm?: { Embeds: { process: () => void } } };

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

export function MedioSocial({ publicacion }: { publicacion: PublicacionVisual }) {
  const [intento, setIntento] = useState(0);
  const [fallo, setFallo] = useState(false);
  if (!publicacion.url) return <p className="py-8 text-lectura text-tinta-meta">Esta publicación no se puede mostrar aquí.</p>;
  return <div>
    {fallo ? <p role="status" className="py-8 text-lectura text-tinta-meta">La publicación no está disponible en esta vista.</p> :
      publicacion.red === "instagram"
        ? <MedioInstagram key={intento} url={publicacion.url} fallar={() => setFallo(true)} />
        : <MedioTikTok key={intento} url={publicacion.url} fallar={() => setFallo(true)} />}
    {/* Un iframe cargado puede contener un rechazo del proveedor. El enlace y
        el reintento siguen disponibles aunque el navegador no emita error. */}
    <button type="button" className={`${clasesChip(false)} mt-4`} onClick={() => { setFallo(false); setIntento((valor) => valor + 1); }}>Volver a cargar</button>
  </div>;
}
