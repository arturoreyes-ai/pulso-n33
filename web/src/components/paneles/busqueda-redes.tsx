"use client";

import { useEffect, useState, type ReactNode } from "react";

import { Lector } from "@/components/lector/lector";
import { useConsultas } from "@/lib/datos/hooks";
import { buscarConsulta } from "@/lib/dominio/consultas";
import { ruta } from "@/lib/dominio/secciones";
import { BuscadorRedes } from "./buscador-redes";
import { OpcionesLugar } from "./lector-redes";
import { VisorConsulta, type FiltroConsulta } from "./visor-consulta";
import VisorRedes, { type FiltroVisual } from "./visor-redes";

/**
 * Redes en modo BUSQUEDA (`/redes?q=`): un termino en seguimiento o un filtro
 * sobre lo cargado. Es un modo del lector, no una pestana: la misma barra con
 * «Búsqueda» como rotulo del valor, para no mover los ids de sus dialogos.
 *
 * Dos casos, decididos por lib/dominio/consultas.ts::buscarConsulta:
 *
 *  - Lo escrito ES un termino de data/consultas.json: se muestra su cosecha de
 *    30 dias con la ficha del termino de primera tarjeta (VisorConsulta), y las
 *    pestanas incluyen Facebook.
 *  - No lo es, o el archivo no esta: se filtran por texto las publicaciones
 *    del panel de medios (VisorRedes con `filtroTexto`), sin Facebook ni X,
 *    porque ahi no hay que filtrar.
 *
 * Sin «De que se habla» en la barra: ese boton suma los documentos del panel de
 * medios, no los de un termino. Y sin Analizar en las tarjetas de un termino,
 * por lo escrito en visor-consulta.tsx.
 */

const PESTANAS_CONSULTA: readonly { id: FiltroConsulta; nombre: string }[] = [
  { id: "todas", nombre: "Todas" },
  { id: "instagram", nombre: "Instagram" },
  { id: "tiktok", nombre: "TikTok" },
  { id: "facebook", nombre: "Facebook" },
  { id: "youtube", nombre: "YouTube" },
  { id: "x", nombre: "X" },
];

const PESTANAS_FILTRO: readonly { id: FiltroVisual; nombre: string }[] = [
  { id: "todas", nombre: "Todas" },
  { id: "instagram", nombre: "Instagram" },
  { id: "tiktok", nombre: "TikTok" },
  { id: "youtube", nombre: "YouTube" },
];

/** La pestana sobrevive a cambiar de termino, como en el panel de medios. */
let ultimaPestana: FiltroConsulta = "todas";

export function BusquedaRedes({ consulta, menu }: { consulta: string; menu: ReactNode }) {
  const consultas = useConsultas();
  const [pestana, setPestana] = useState<FiltroConsulta>(() => ultimaPestana);
  useEffect(() => {
    ultimaPestana = pestana;
  }, [pestana]);
  const hallada = buscarConsulta(consultas.data, consulta);
  const cargando = consultas.data === undefined && consultas.error === undefined;
  const esConsulta = hallada !== null;
  const pestanas = esConsulta ? PESTANAS_CONSULTA : PESTANAS_FILTRO;
  const activa: FiltroConsulta = pestanas.some((p) => p.id === pestana) ? pestana : "todas";
  const accion = ruta(null, "redes");

  return (
    <Lector volver={accion} rotulo="Redes" rotuloValor="Búsqueda" valor={consulta} tituloOpciones="Lugar"
      opciones={<OpcionesLugar zona={null} cubetas={[]} activa="corredor" onCubeta={() => undefined} />}
      menu={menu}
      busqueda={<BuscadorRedes accion={accion} consulta={consulta} />}
      rotuloBusqueda="Buscar publicaciones"
      pestanas={
        <div role="group" aria-label="Plataforma" className="pestanas-lector">
          {pestanas.map((p) => (
            <button key={p.id} type="button" className="pestana-lector text-cuerpo" aria-pressed={p.id === activa}
              onClick={() => setPestana(p.id)}>
              {p.nombre}
            </button>
          ))}
        </div>
      }>
      {cargando
        ? <div className="hoja-lector"><p role="status" className="mx-auto w-full max-w-[88rem] px-4 py-8 text-lectura text-tinta-meta md:px-8">Buscando…</p></div>
        : hallada !== null && consultas.data !== undefined
          ? <VisorConsulta key={`${hallada.id}:${activa}`} c={hallada} doc={consultas.data} filtro={activa} />
          : <VisorRedes key={`q:${consulta}:${activa}`} zona={null} filtro={activa === "facebook" || activa === "x" ? "todas" : activa} cubeta="corredor" analisis={false} filtroTexto={consulta} />}
    </Lector>
  );
}
