"use client";

import { useMemo, type ReactNode } from "react";

import type { Consulta, DocConsultas } from "@/lib/datos/tipos";
import { useConsultasComentarios } from "@/lib/datos/hooks";
import { reunirPublicacionesConsulta, SIN_FILAS_CONSULTA } from "@/lib/dominio/consultas";
import type { RedVisual } from "@/lib/dominio/publicaciones";
import type { Textos } from "./comentarios-publicacion";
import { FichaConsulta } from "./ficha-consulta";
import { RecorridoPublicaciones, type Cortes } from "./visor-redes";

/** Las pestanas de una consulta. YouTube y X caen aqui como hoja de prosa. */
export type FiltroConsulta = "todas" | RedVisual | "x";

/**
 * El visor de un termino en seguimiento: la ficha del termino como primera
 * tarjeta y sus publicaciones de las tres redes detras, en el MISMO recorrido
 * que el panel de medios (visor-redes.tsx::RecorridoPublicaciones), con la
 * misma hoja de comentarios.
 *
 * Sin «Analizar»: la ruta de una publicacion busca la URL en los archivos del
 * panel de medios, y una publicacion de una consulta no esta ahi. Encenderlo
 * es ensenarle a esa ruta el archivo de consultas, no copiar el boton.
 *
 * YouTube y X no tienen publicaciones que recorrer: el documento los trae
 * `sin_dato` con su razon, y la pestana la pinta tal cual.
 */
export function VisorConsulta({ c, doc, filtro, textos: textosDados, informe = true, extra, rotuloTipo, sinFilas }: {
  c: Consulta;
  doc: DocConsultas;
  filtro: FiltroConsulta;
  /** Ver FichaConsulta: la busqueda en vivo trae su propio texto, su boton y
   *  ningun PDF. */
  textos?: Textos;
  informe?: boolean;
  extra?: ReactNode;
  rotuloTipo?: string;
  sinFilas?: string;
}) {
  const propios = useConsultasComentarios();
  const textos = textosDados ?? propios;
  const filas = useMemo(() => {
    const todas = reunirPublicacionesConsulta(c);
    return todas.filter((fila) => filtro === "todas" || fila.red === filtro);
  }, [c, filtro]);
  // YouTube sale como hoja de prosa solo si no se leyo: la busqueda en vivo SI
  // trae los videos de los canales del panel que nombran el termino.
  if (filtro === "x" || (filtro === "youtube" && c.plataformas.youtube.estado === "sin_dato")) {
    // Solo «sin dato»: la razon viaja en el archivo para quien lo lea, y la
    // pantalla no explica el mecanismo ni para decir lo que no hace (pedido
    // del cliente del 18 de septiembre de 2026).
    const nombre = filtro === "x" ? "X" : "YouTube";
    return (
      <div className="hoja-lector">
        <div className="mx-auto w-full max-w-[88rem] px-4 py-8 md:px-8">
          <p className="text-lectura text-tinta-meta">{nombre}: sin dato.</p>
        </div>
      </div>
    );
  }
  const par: Textos = { data: textos.data, error: textos.error };
  const porRed: Partial<Record<RedVisual, Textos>> = { instagram: par, tiktok: par, facebook: par };
  const cortes: Cortes = { instagram: doc.generado, tiktok: doc.generado, facebook: doc.generado, youtube: doc.generado };
  return (
    <RecorridoPublicaciones
      key={`${c.id}:${filtro}:${filas.map((fila) => fila.clave).join("|")}`}
      publicaciones={filas}
      cortes={cortes}
      cargando={false}
      textos={porRed}
      conComentarios={{ instagram: true, tiktok: true, facebook: true }}
      analisis={false}
      sinFilas={sinFilas ?? SIN_FILAS_CONSULTA(c.termino, doc.ventana_dias)}
      cabecera={filtro === "todas"
        ? <FichaConsulta c={c} doc={doc} textos={textosDados} informe={informe} extra={extra} rotuloTipo={rotuloTipo} />
        : undefined}
      lugar={false}
      vistaPrevia={false}
    />
  );
}
