"use client";

import Script from "next/script";
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import type { Destacado } from "@/lib/datos/tipos";
import type { PublicacionVisual, RedVisual } from "@/lib/dominio/publicaciones";

type VentanaInstagram = Window & { instgrm?: { Embeds: { process: () => void } } };

/** Altura por debajo de la cual el iframe de Instagram todavia no tiene
 *  contenido: embed.js lo inserta a 24px y crece cuando el post responde.
 *  Solo vale para los medios que CRECEN al cargar (Instagram, TikTok).
 *  YouTube y Facebook nacen con su proporcion y avisan con `onLoad`: un video
 *  largo de YouTube a 16:9 en la columna de escritorio mide ~277x156, nunca
 *  llegaba a 200 y se quedaba oculto tras el esqueleto con «Volver a cargar»
 *  (captura del cliente, 24 de septiembre de 2026, un video de CNR). */
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

const ORIGEN_TIKTOK = "https://www.tiktok.com";

function ordenar(marco: HTMLIFrameElement | null, tipo: "play" | "pause" | "mute") {
  marco?.contentWindow?.postMessage({ type: tipo, "x-tiktok-player": true }, ORIGEN_TIKTOK);
}

/** TikTok: el reproductor v1, gobernado por postMessage.
 *
 * EL SANDBOX LLEVA `allow-same-origin` Y NO ES UN DESCUIDO. El 18 de
 * septiembre de 2026 se endurecio a `sandbox="allow-scripts"` a secas, y el
 * reproductor no volvio a arrancar: un origen opaco tumba su propio arranque y
 * la tarjeta se quedaba en el logotipo negro para siempre. Medido el 22: cero
 * mensajes en 12 s, dos veces, contra `onPlayerReady` en 1.3 s con el permiso.
 * Ademas, con origen opaco la particion de cache es desechable y los ~1.2 MB de
 * JS del reproductor se volvian a bajar en cada tarjeta. Dar `allow-same-origin`
 * a un marco de OTRO origen no le abre esta pagina; lo que el sandbox si sigue
 * negando es navegar el tablero (no hay `allow-top-navigation`). Los popups
 * devuelven los enlaces del propio reproductor, que funcionaban antes del 18.
 *
 * PRECARGADO Y EN PAUSA. El visor monta tambien la tarjeta siguiente
 * (visor-redes.tsx) con `activo` en false: arranca con `autoplay=1` y se pausa
 * al estar listo, y al asentarse recibe `play`. Medido: de pausa a reproducir
 * en 42 ms, contra 1.3-1.9 s de arranque en frio. `autoplay=0` no sirve para
 * esto: con el, el reproductor no avisa que esta listo ni obedece `play`. */
function MedioTikTok({ url, activo, fallar }: { url: string; activo: boolean; fallar: () => void }) {
  const marco = useRef<HTMLIFrameElement>(null);
  const listo = useRef(false);
  const [manual, setManual] = useState(false);
  const id = url.split("/").at(-1);
  // Lee `activo` al momento de estar listo sin volver a colgar el oyente.
  const alEstarListo = useEffectEvent(() => {
    listo.current = true;
    ordenar(marco.current, "mute");
    if (!activo) ordenar(marco.current, "pause");
  });
  useEffect(() => {
    function recibir(evento: MessageEvent) {
      if (evento.origin !== ORIGEN_TIKTOK || evento.source !== marco.current?.contentWindow) return;
      const dato = evento.data;
      if (!dato || typeof dato !== "object" || dato["x-tiktok-player"] !== true) return;
      if (dato.type === "onPlayerReady") alEstarListo();
      if (dato.type === "onPlayerError") {
        if (dato.value?.errorCode === 3002) setManual(true);
        else fallar();
      }
    }
    window.addEventListener("message", recibir);
    return () => window.removeEventListener("message", recibir);
  }, [fallar]);
  // Antes de estar listo no hay a quien ordenar: `alEstarListo` decide.
  useEffect(() => {
    if (listo.current) ordenar(marco.current, activo ? "play" : "pause");
  }, [activo]);
  return <>
    <iframe ref={marco} title="Publicación de TikTok" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      src={`${ORIGEN_TIKTOK}/player/v1/${id}?autoplay=1&muted=1&controls=1&description=1`}
      allow="autoplay; fullscreen" allowFullScreen className="aspect-[9/16] w-full border-0" onError={fallar} />
    {manual ? <p className="text-cuerpo text-tinta-meta">Pulsa reproducir para ver el video.</p> : null}
  </>;
}

/** YouTube: el reproductor incrustado, en su dominio sin cookies.
 *
 * `youtube-nocookie.com` por la misma razon por la que el sitio elige siempre
 * la opcion que menos rastrea: no deja cookies hasta que alguien le da a
 * reproducir. La proporcion la decide el FORMATO y no la red -- 9:16 para un
 * Short y 16:9 para un video largo --, que es el unico sitio de la interfaz
 * donde los dos formatos se comportan distinto.
 *
 * La URL canonica es siempre /watch?v=<id> (ver canonizarPublicacion), asi que
 * el id sale del parametro y no del final de la ruta como en TikTok.
 */
function MedioYouTube({ url, formato, cargar, fallar }: { url: string; formato: "short" | "video" | undefined; cargar: () => void; fallar: () => void }) {
  let id = "";
  try {
    id = new URL(url).searchParams.get("v") ?? "";
  } catch {
    id = "";
  }
  if (!id) return <p className="py-8 text-lectura text-tinta-meta">Esta publicación no se puede mostrar aquí.</p>;
  const proporcion = formato === "video" ? "aspect-video" : "aspect-[9/16]";
  return <iframe title="Publicación de YouTube"
    src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&playsinline=1&rel=0`}
    allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
    className={`${proporcion} w-full border-0`} onLoad={cargar} onError={fallar} />;
}

/** Facebook: el plugin de publicacion incrustada de la propia plataforma, que
 *  es un iframe y no exige su SDK de JavaScript. Sin el SDK no hay ajuste
 *  automatico de altura, asi que la tarjeta reserva 4:5 y lo que sobre se lee
 *  en «Ver original»; una publicacion privada o borrada muestra el aviso de
 *  Facebook DENTRO del iframe sin emitir error, y con cookies de terceros
 *  bloqueadas puede pedir sesion. Lo usan las consultas por termino y, desde
 *  el 23 de septiembre de 2026, la pestana Facebook de Redes. */
function MedioFacebook({ url, tipo, cargar, fallar }: { url: string; tipo: Destacado["tipo"]; cargar: () => void; fallar: () => void }) {
  // Un reel o un video va por el plugin de VIDEO: el de publicacion lo pinta
  // como una tarjeta con miniatura y texto, y en el recorrido del panel de
  // medios (23 de septiembre de 2026) la mitad de los posts de estas paginas
  // son reels. Sin el SDK no hay pausa desde fuera, y por eso Facebook no se
  // precarga (visor-redes.tsx::PRECARGA).
  const video = tipo === "video";
  const params = new URLSearchParams({ href: url, show_text: video ? "false" : "true", width: "500" });
  return <iframe title="Publicación de Facebook" src={`https://www.facebook.com/plugins/${video ? "video" : "post"}.php?${params.toString()}`}
    scrolling="no" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
    className={`${video ? "aspect-[9/16]" : "aspect-[4/5]"} w-full border-0`} onLoad={cargar} onError={fallar} />;
}

/** La forma que tendra el medio antes de tenerlo, para que la tarjeta apenas
 *  se mueva cuando aterrice. TikTok es un 9:16 limpio. Instagram trae su
 *  propio marco (cabecera con la cuenta, pie con acciones y texto), unos
 *  8.75rem repartidos en dos bloques: 3.25rem y 5rem mas dos huecos de
 *  0.25rem. Los dos numeros se estimaron a 279px de ancho; si en un telefono
 *  real el iframe cae mas alto o mas bajo que el esqueleto, se ajustan aqui y
 *  en ningun otro lugar. Sin rotulo de plataforma: la banda ya la nombra. */
export function EsqueletoMedio({ red, tipo, formato, pulsar = true }: { red: RedVisual; tipo: Destacado["tipo"]; formato?: Destacado["formato"]; pulsar?: boolean }) {
  // En YouTube manda el formato: un video largo es 16:9 y un Short 9:16. Si el
  // esqueleto no mide lo que va a montar, el congelado de alturas del visor
  // salta una tarjeta justo al cambiar de formato.
  const proporcion = red === "youtube"
    ? (formato === "video" ? "aspect-video" : "aspect-[9/16]")
    : red === "facebook" ? (tipo === "video" ? "aspect-[9/16]" : "aspect-[4/5]")
    : red === "tiktok" || tipo === "video" ? "aspect-[9/16]" : "aspect-[4/5]";
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
export function MedioSocial({ publicacion, activo = true }: {
  publicacion: PublicacionVisual;
  /** False en la tarjeta SIGUIENTE, que el visor monta por adelantado: el
   *  medio carga igual y solo TikTok, que es el que se reproduce solo, espera
   *  en pausa. Instagram no arranca nada sin que alguien lo pulse. */
  activo?: boolean;
}) {
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
  const cargar = useCallback(() => setListo(true), []);
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
    {cubierto ? null : <div className="[grid-area:1/1]"><EsqueletoMedio red={publicacion.red} tipo={publicacion.post.tipo} formato={publicacion.post.formato} pulsar={!fallo && !listo} /></div>}
    {/* self-start: en una celda apilada el hijo se estira a la altura de la
        fila y el observador mediria el esqueleto, no el medio. */}
    <div ref={medio} onTransitionEnd={(evento) => { if (evento.propertyName === "opacity" && listo) setCubierto(true); }}
      className={`[grid-area:1/1] min-w-0 self-start transition-opacity duration-[var(--dur-cambio)] ease-firma ${listo ? "opacity-100" : "opacity-0"}`}>
      {fallo ? null : publicacion.red === "instagram"
        ? <MedioInstagram key={intento} url={publicacion.url} fallar={fallar} />
        : publicacion.red === "youtube"
          ? <MedioYouTube key={intento} url={publicacion.url} formato={publicacion.post.formato} cargar={cargar} fallar={fallar} />
          : publicacion.red === "facebook"
            ? <MedioFacebook key={intento} url={publicacion.url} tipo={publicacion.post.tipo} cargar={cargar} fallar={fallar} />
            : <MedioTikTok key={intento} url={publicacion.url} activo={activo} fallar={fallar} />}
    </div>
    {ofrecerRecarga ? <div className="[grid-area:1/1] flex flex-col items-center justify-end gap-2 pb-4 text-center">
      {fallo ? <p role="status" className="text-cuerpo text-tinta-meta">La publicación no está disponible en esta vista.</p> : null}
      {/* Un iframe cargado puede contener un rechazo del proveedor sin que el
          navegador emita error: ese caso lo cubre «Abrir en …», que esta
          siempre en la banda. Aqui se ofrece recargar solo cuando la carga
          fallo o cuando en ESPERA_RECARGA no llego altura alguna. */}
      <button type="button" className="text-meta text-tinta-meta transition-colors hover:text-tinta-titulo" onClick={reintentar}>Volver a cargar</button>
    </div> : null}
  </div>;
}
