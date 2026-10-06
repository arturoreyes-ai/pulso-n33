"use client";

import { Check as Listo, DownloadSimple as Descargar, WarningCircle as Fallo } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { clasesBoton } from "./clases";

/**
 * Descargar un PDF que el servidor arma al momento (2 de octubre de 2026,
 * para el expediente de /reportes; sirve igual para el de un termino).
 *
 * Por que no un `<a download>` como la tarjeta de un termino: el expediente
 * tarda de dos a seis segundos en armarse y un enlace no dice nada mientras
 * tanto; se pulsaba dos veces. Aqui el boton cuenta lo que pasa en su mismo
 * lugar, «PDF» → «Preparando» → «Listo», y se baja con el nombre que manda el
 * servidor.
 *
 * Lo que sostiene que se sienta bien, y su razon:
 *  - Las tres etiquetas viven APILADAS en la misma celda y solo se ve una: el
 *    boton mide siempre lo de la mas larga y no salta de ancho al cambiar.
 *  - El cambio es opacidad y un desenfoque de 2px, no un deslizamiento: el
 *    desenfoque une las dos etiquetas y se lee como una sola que se
 *    transforma, no como dos que se cruzan. Con la curva de firma en
 *    --dur-cambio; el bloque de movimiento reducido de globals.css lo vuelve
 *    instantaneo.
 *  - Al pulsar cede a 0.97 (clasesChip): responde aunque el servidor tarde.
 *  - «Listo» se queda 1.6 s y vuelve solo; un fallo se queda hasta el
 *    siguiente intento y lo dice en texto, no solo en el icono.
 *  - El anillo de «Preparando» gira rapido (700 ms por vuelta): uno lento
 *    hace sentir lenta la espera aunque dure lo mismo.
 */

type Estado = "quieto" | "preparando" | "listo" | "fallo";

const DURACION_LISTO_MS = 1600;

/** El nombre de archivo de la cabecera, o el de reserva. */
function nombreDe(cabecera: string | null, reserva: string): string {
  const m = cabecera?.match(/filename="([^"]+)"/);
  return m?.[1] ?? reserva;
}

function Capa({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <span
      aria-hidden={!visible}
      className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-2 transition-[opacity,filter] duration-[var(--dur-cambio)] ease-firma ${visible ? "opacity-100 blur-0" : "pointer-events-none opacity-0 blur-[2px]"}`}
    >
      {children}
    </span>
  );
}

export function BotonPdf({ href, etiqueta = "PDF", archivo = "informe.pdf", descripcion }: {
  href: string;
  etiqueta?: string;
  /** El nombre si el servidor no manda uno. */
  archivo?: string;
  /** El nombre accesible: «Descargar PDF del expediente de …». */
  descripcion: string;
}) {
  const [estado, setEstado] = useState<Estado>("quieto");
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (reloj.current !== null) clearTimeout(reloj.current); }, []);

  async function descargar() {
    if (estado === "preparando") return;
    if (reloj.current !== null) clearTimeout(reloj.current);
    setEstado("preparando");
    try {
      const r = await fetch(href, { cache: "no-store" });
      if (!r.ok || !(r.headers.get("content-type") ?? "").includes("pdf")) throw new Error(String(r.status));
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombreDe(r.headers.get("content-disposition"), archivo);
      document.body.append(a);
      a.click();
      a.remove();
      // El navegador ya tomo el archivo; se suelta en el siguiente turno.
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setEstado("listo");
      reloj.current = setTimeout(() => setEstado("quieto"), DURACION_LISTO_MS);
    } catch {
      setEstado("fallo");
    }
  }

  return (
    <span className="inline-grid gap-2">
      <button
        type="button"
        onClick={() => void descargar()}
        aria-label={descripcion}
        aria-busy={estado === "preparando"}
        // Rejilla y no flex: las tres etiquetas comparten UNA celda. Con el
        // inline-flex de clasesBoton quedaban en fila y las invisibles
        // ocupaban su ancho (el boton media 320px por «PDF»).
        className={clasesBoton(false).replace("inline-flex", "inline-grid")}
      >
        <Capa visible={estado === "quieto" || estado === "fallo"}>
          {estado === "fallo" ? <Fallo size={16} aria-hidden className="text-baja" /> : <Descargar size={16} aria-hidden />}
          {estado === "fallo" ? "Reintentar" : etiqueta}
        </Capa>
        <Capa visible={estado === "preparando"}>
          <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-filo border-t-tinta-titulo [animation-duration:700ms]" />
          Preparando
        </Capa>
        <Capa visible={estado === "listo"}>
          <Listo size={16} aria-hidden className="text-sube" />
          Listo
        </Capa>
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {estado === "preparando" ? "Preparando el PDF" : estado === "listo" ? "PDF descargado" : ""}
      </span>
      {estado === "fallo" ? <span role="alert" className="text-meta text-baja">No se pudo armar el PDF. Vuelve a intentarlo.</span> : null}
    </span>
  );
}
