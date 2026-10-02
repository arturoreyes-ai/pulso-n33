"use client";

import {
  Check as Hecho,
  EnvelopeSimple as Correo,
  FacebookLogo,
  LinkSimple as Enlace,
  ShareNetwork as IconoCompartir,
  WhatsappLogo,
  XLogo,
} from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { clasesBoton } from "./clases";

/**
 * «Compartir»: un boton que abre, en su sitio, las formas de mandar un enlace.
 * El MISMO en las tarjetas de la portada y en las de /redes.
 *
 * EL CASO, 1 de octubre de 2026. La portada tenia su propio boton
 * (ahora/tarjetas-ahora.tsx) que abria la hoja del sistema (`navigator.share`)
 * y, donde no existe, copiaba el enlace en silencio. El cliente lo pidio
 * tambien en /redes, pero NO nativo: la hoja del sistema es distinta en cada
 * equipo, en Windows casi vacia, y en escritorio no existia, asi que la mitad
 * del equipo solo podia copiar el enlace, sin elegir a donde mandarlo. Aqui todos ven las
 * mismas cinco opciones.
 *
 * QUE NO ES. No es un `<dialog>`: una hoja por tarjeta serian noventa
 * dialogos montados (visor-redes.tsx), y el panel se monta solo mientras esta
 * abierto, asi que cien tarjetas cuestan cien botones. Tampoco es un
 * `role="menu"`: ese rol obliga a manejar flechas, y esto son cinco enlaces y
 * un boton, que se recorren con Tab como cualquier grupo.
 *
 * DONDE SE ABRE. Hacia arriba, porque en las dos paginas la fila de acciones
 * queda en la mitad baja de la tarjeta; hacia abajo si arriba no cabe. Y corrido
 * lo justo para caber en la pantalla. Se mide al ABRIR, en el manejador,
 * nunca en el render. Crece desde el centro del boton (`transform-origin`),
 * no desde el centro del panel.
 *
 * Los enlaces de cada red los abre quien pulsa: ninguna peticion sale de aqui.
 * WhatsApp primero: es por donde el equipo se pasa las notas.
 */

const ANCHO_PANEL = 240;
/** Medido: 242px con las cinco opciones y el filo. */
const ALTO_PANEL = 250;
const MARGEN = 16;

type Hacia = "arriba" | "abajo";

export function Compartir({ titulo, url, compacto = false }: {
  titulo: string;
  url: string;
  /** Solo el icono por debajo de `md` (con el nombre accesible intacto): la
   *  banda de una tarjeta de /redes tiene alto contado en el telefono. */
  compacto?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  /** Donde cae el borde izquierdo del panel respecto del boton, y donde
   *  queda el centro del boton dentro del panel (el origen del crecimiento). */
  const [x, setX] = useState({ izquierda: 0, origen: 24 });
  const [hacia, setHacia] = useState<Hacia>("arriba");
  const [copiado, setCopiado] = useState<"si" | "fallo" | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  function abrir() {
    const r = boton.current?.getBoundingClientRect();
    if (r) {
      // Contra la caja que recorta, no contra la ventana: en los lectores la
      // barra y las pestanas tapan la parte de arriba, y medido contra la
      // ventana el panel abria hacia arriba y «Copiar enlace» quedaba debajo
      // de la fila de temas (1 de octubre de 2026, a 800x600).
      const marco = boton.current?.closest(".recorrido-lector, .hoja-lector")?.getBoundingClientRect();
      const techo = marco?.top ?? 0;
      const suelo = marco?.bottom ?? window.innerHeight;
      // Ni pegado al borde izquierdo del boton ni al derecho: en el telefono
      // el de /redes cae a media fila (x 136 de 375) y los dos se salian de la
      // pantalla, por 17 y por 47 px. El panel se corre lo justo para caber.
      const ancho = Math.min(ANCHO_PANEL, window.innerWidth - 2 * MARGEN);
      const izquierda = Math.min(Math.max(r.left, MARGEN), window.innerWidth - MARGEN - ancho);
      setX({ izquierda: izquierda - r.left, origen: r.left + r.width / 2 - izquierda });
      const arriba = r.top - techo - MARGEN;
      const abajo = suelo - r.bottom - MARGEN;
      setHacia(arriba >= ALTO_PANEL || arriba >= abajo ? "arriba" : "abajo");
    }
    setCopiado(null);
    setAbierto(true);
  }

  function cerrar(devolverFoco: boolean) {
    setAbierto(false);
    if (devolverFoco) boton.current?.focus({ preventScroll: true });
  }

  // Al abrir, el foco va a la primera opcion: quien abrio con teclado sigue
  // con Tab, y quien abrio con el dedo no nota nada.
  useEffect(() => {
    if (!abierto) return;
    panel.current?.querySelector<HTMLElement>("a, button")?.focus({ preventScroll: true });
    const fuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, [abierto]);

  // «Enlace copiado» se queda un momento y vuelve a decir «Copiar enlace»: si
  // se quedara, copiar otra vez no cambiaria nada en pantalla ni se anunciaria.
  useEffect(() => {
    if (copiado === null) return;
    const t = window.setTimeout(() => setCopiado(null), 2000);
    return () => window.clearTimeout(t);
  }, [copiado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado("si");
    } catch {
      setCopiado("fallo");
    }
  }

  const texto = encodeURIComponent(titulo);
  const enlace = encodeURIComponent(url);
  const redes: readonly { nombre: string; href: string; icono: ReactNode }[] = [
    { nombre: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${titulo} ${url}`)}`, icono: <WhatsappLogo size={18} aria-hidden /> },
    { nombre: "X", href: `https://x.com/intent/post?text=${texto}&url=${enlace}`, icono: <XLogo size={18} aria-hidden /> },
    { nombre: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enlace}`, icono: <FacebookLogo size={18} aria-hidden /> },
    { nombre: "Correo", href: `mailto:?subject=${texto}&body=${enlace}`, icono: <Correo size={18} aria-hidden /> },
  ];

  return (
    <div
      ref={caja}
      className="compartir"
      onKeyDown={(e) => {
        if (e.key === "Escape" && abierto) {
          e.stopPropagation();
          cerrar(true);
        }
      }}
    >
      <button
        ref={boton}
        type="button"
        className={clasesBoton(abierto)}
        aria-expanded={abierto}
        aria-controls={id}
        aria-label={compacto ? "Compartir" : undefined}
        onClick={() => (abierto ? cerrar(false) : abrir())}
      >
        <IconoCompartir size={16} aria-hidden />
        <span className={compacto ? "max-md:sr-only" : undefined}>Compartir</span>
      </button>

      {abierto ? (
        <div ref={panel} id={id} role="group" aria-label="Compartir" className="panel-compartir" data-hacia={hacia}
          style={{ left: x.izquierda, transformOrigin: `${x.origen}px ${hacia === "arriba" ? "100%" : "0"}` }}>
          <button type="button" className="opcion-compartir" onClick={() => void copiar()}>
            {copiado === "si" ? <Hecho size={18} weight="bold" aria-hidden /> : <Enlace size={18} aria-hidden />}
            <span>{copiado === "si" ? "Enlace copiado" : copiado === "fallo" ? "No se pudo copiar" : "Copiar enlace"}</span>
          </button>
          <span className="filo-compartir" aria-hidden />
          {redes.map((r) => (
            <a key={r.nombre} href={r.href} className="opcion-compartir"
              // El cierre espera un turno: desmontar el enlace dentro de su
              // propio clic lo saca del documento antes de que el navegador lo
              // siga, y un enlace desconectado no navega.
              onClick={() => window.setTimeout(() => setAbierto(false), 0)}
              {...(r.href.startsWith("mailto:") ? {} : { target: "_blank", rel: "noopener noreferrer" })}>
              {r.icono}
              <span>{r.nombre}</span>
            </a>
          ))}
        </div>
      ) : null}
      <span role="status" className="sr-only">
        {copiado === "si" ? "Enlace copiado." : copiado === "fallo" ? "No se pudo copiar el enlace." : ""}
      </span>
    </div>
  );
}
