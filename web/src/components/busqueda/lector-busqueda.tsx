"use client";

import type { ReactNode } from "react";

import { Lector } from "@/components/lector/lector";
import type { Entrada } from "@/lib/busqueda/capitulos";
import type { ZonaRuta } from "@/lib/dominio/zonas";
import { Buscador } from "./buscador";
import { PestanasBusqueda, ResultadosBusqueda, useVistaBusqueda } from "./resultados-busqueda";

/**
 * El modo BUSQUEDA de los lectores (`?q=`), el mismo en la portada y en Redes.
 *
 * Un modo y no un capitulo ni una pestana: la barra dice «Búsqueda» sobre lo
 * buscado, las pestanas son Todo · Noticias · Publicaciones y la caja es una
 * pagina normal (`.hoja-lector`, sin ajuste por tarjeta), porque una lista de
 * resultados se recorre leyendo, no de una en una. Lo propio de cada pagina
 * —a donde vuelve, que dice su dialogo de lugar, donde buscan las noticias—
 * llega por props.
 */
export function LectorBusqueda({ rotulo, consulta, volver, accion, etiqueta, salida, ocultos, tituloOpciones, opciones, zona = null, entrada }: {
  /** La pagina («En Tendencia», «Redes»). */
  rotulo: string;
  consulta: string;
  /** A donde llevan la flecha y la × del campo. */
  volver: string;
  /** A donde envia el buscador. */
  accion: string;
  etiqueta: string;
  salida: string;
  ocultos?: Readonly<Record<string, string>>;
  /** El dialogo de la barra. Redes no lo pasa: su busqueda no depende del
   *  lugar. */
  tituloOpciones?: string;
  opciones?: ReactNode;
  zona?: ZonaRuta | null;
  entrada?: Entrada;
}) {
  const [vista, setVista] = useVistaBusqueda();
  return (
    <Lector volver={volver} rotulo={rotulo} rotuloValor="Búsqueda" valor={consulta} tituloOpciones={tituloOpciones}
      opciones={opciones}
      busqueda={<Buscador accion={accion} etiqueta={etiqueta} consulta={consulta} salida={salida} destinoSalida={volver} ocultos={ocultos} />}
      pestanas={<PestanasBusqueda vista={vista} onVista={setVista} />}>
      <div className="hoja-lector" tabIndex={0} role="region" aria-label={`Resultados para ${consulta}`}>
        <div className="mx-auto w-full max-w-[88rem] px-4 py-8 md:px-8">
          {/* El h2 que la pagina no tenia: sin el, del h1 oculto se saltaba al
              h3 de cada grupo. /reportes pone el suyo, visible. */}
          <h2 className="sr-only">Resultados para {consulta}</h2>
          <ResultadosBusqueda consulta={consulta} vista={vista} zona={zona} entrada={entrada} />
        </div>
      </div>
    </Lector>
  );
}
