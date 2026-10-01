"use client";

import { ArrowRight as Flecha, MagnifyingGlass as Lupa, X as Cerrar } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { ICONO_CON_TEXTO } from "@/components/chrome/medidas-cinta";
import { LARGO_MAXIMO_CONSULTA, MINIMO_CONSULTA } from "@/lib/busqueda/tipos";

/**
 * La busqueda de los lectores, EN la barra: la pastilla «Buscar» se abre en su
 * sitio y se hace el campo, sin dialogo.
 *
 * EL CASO, 28 de septiembre de 2026: «Buscar» abria una hoja modal —velo sobre
 * el lector, titulo «Buscar», etiqueta, campo, un boton y la salida— para
 * escribir una palabra. El cliente la vio innecesaria: una busqueda es un
 * campo, y un campo no necesita una superficie aparte. Es el mismo gesto que
 * la cuenta del riel ese mismo dia: lo que se pulsa se abre en su lugar.
 *
 * COMO SE ABRE. La pastilla se queda en la fila, ocupando su ancho, y el campo
 * se dibuja ENCIMA de la fila, anclado a su borde derecho, donde esta la
 * pastilla: en el telefono cubre la fila entera (la barra se vuelve buscador,
 * como en cualquier aplicacion) y en escritorio mide 28rem sobre el hueco que
 * la fila ya deja libre. Nada de la barra se mueve. Se revela con `clip-path`
 * desde la derecha hacia la izquierda, asi que sale de la pastilla y no de la
 * nada (globals.css, `.campo-busqueda-barra`).
 *
 * TRES ESTADOS:
 * - Cerrada: la pastilla.
 * - Abierta sin consulta: el campo con el foco. Escape, la × o un clic fuera
 *   la cierran y devuelven el foco a la pastilla.
 * - En una busqueda (`?q=`): el campo abierto SIEMPRE, con lo que se busco.
 *   La × es entonces la salida (`salida`, «Volver al recorrido») y es un
 *   enlace; Escape solo suelta el foco. Antes la busqueda activa solo se veia
 *   abriendo la hoja.
 *
 * Sigue siendo un `<form method="get">` de verdad (sin JavaScript tambien
 * busca) y no busca al teclear: en un lector a pantalla completa cada tecla
 * rehace las tarjetas bajo el dedo. `ocultos` conserva la edicion de la
 * portada (`e=mexico`).
 *
 * Hasta el 30 de septiembre de 2026 llevaba `sugerencias`, una bandeja bajo
 * el campo con los terminos en seguimiento de Redes; el cliente la quito por
 * confusa (busqueda/buscador.tsx).
 *
 * Reemplaza a ui/formulario-busqueda.tsx, que era el cuerpo de las dos hojas.
 */
export function BusquedaEnBarra({ accion, rotulo, etiqueta, consulta, salida, ocultos = {}, destinoSalida = accion }: {
  accion: string;
  /** El nombre accesible de la pastilla: «Buscar titulares». */
  rotulo: string;
  /** Donde se busca: «En Tijuana», «En todas las publicaciones». */
  etiqueta: string;
  consulta: string | null;
  /** Lo que hace la × durante una busqueda: «Volver al recorrido». */
  salida: string;
  ocultos?: Readonly<Record<string, string>>;
  destinoSalida?: string;
}) {
  const enBusqueda = consulta !== null;
  const [abiertaAqui, setAbiertaAqui] = useState(false);
  const abierta = enBusqueda || abiertaAqui;
  const caja = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const pastilla = useRef<HTMLButtonElement>(null);
  const id = useId();
  const donde = etiqueta.charAt(0).toLocaleLowerCase("es") + etiqueta.slice(1);

  const cerrar = () => {
    setAbiertaAqui(false);
    pastilla.current?.focus({ preventScroll: true });
  };

  // Al abrir desde la pastilla, el foco va al campo. En una busqueda no: la
  // pagina llega con la consulta a la vista y nadie pidio escribir.
  useEffect(() => {
    if (abiertaAqui) campo.current?.focus({ preventScroll: true });
  }, [abiertaAqui]);

  useEffect(() => {
    if (!abierta) return;
    const fuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node) && !enBusqueda) setAbiertaAqui(false);
    };
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, [abierta, enBusqueda]);

  return (
    <div
      ref={caja}
      className="busqueda-barra"
      data-abierta={abierta || undefined}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        if (enBusqueda) campo.current?.blur();
        else if (abiertaAqui) cerrar();
      }}
    >
      <button
        ref={pastilla}
        type="button"
        data-buscar
        className="control-lector"
        aria-label={rotulo}
        aria-expanded={abierta}
        aria-controls={id}
        tabIndex={abierta ? -1 : undefined}
        onClick={() => setAbiertaAqui(true)}
      >
        <Lupa size={ICONO_CON_TEXTO} aria-hidden />
        <span>Buscar</span>
      </button>

      <form id={id} role="search" method="get" action={accion} className="campo-busqueda-barra" inert={!abierta}>
        {Object.entries(ocultos).map(([nombre, valor]) => <input key={nombre} type="hidden" name={nombre} value={valor} />)}
        <Lupa size={16} aria-hidden className="shrink-0 text-tinta-meta" />
        <input
          ref={campo}
          name="q"
          type="search"
          defaultValue={consulta ?? ""}
          required
          minLength={MINIMO_CONSULTA}
          maxLength={LARGO_MAXIMO_CONSULTA}
          autoComplete="off"
          enterKeyHint="search"
          aria-label={`Buscar ${donde}`}
          placeholder={`Buscar ${donde}…`}
          className="min-w-0 flex-1 bg-transparent text-cuerpo text-tinta-titulo outline-none placeholder:text-tinta-inerte"
        />
        {enBusqueda ? (
          <Link href={destinoSalida} className="boton-campo-busqueda" aria-label={salida} title={salida}>
            <Cerrar size={16} aria-hidden />
          </Link>
        ) : (
          <button type="button" className="boton-campo-busqueda" aria-label="Cerrar búsqueda" onClick={cerrar}>
            <Cerrar size={16} aria-hidden />
          </button>
        )}
        <button type="submit" className="enviar-busqueda" aria-label="Buscar">
          <Flecha size={16} aria-hidden />
        </button>
      </form>
    </div>
  );
}
