"use client";

import { useEffect, useState } from "react";

import { Buscador } from "@/components/busqueda/buscador";
import { LectorBusqueda } from "@/components/busqueda/lector-busqueda";
import { Lector } from "@/components/lector/lector";
import { EstadoCarga } from "@/components/ui/estado-carga";
import { FilaPestanas } from "@/components/ui/pestanas";
import { useConsultas } from "@/lib/datos/hooks";
import { buscarConsulta, reunirPublicacionesConsulta } from "@/lib/dominio/consultas";
import { ruta } from "@/lib/dominio/secciones";
import { VisorConsulta, type FiltroConsulta } from "./visor-consulta";

/**
 * Redes en modo BUSQUEDA (`/redes?q=`) y el REPORTE de un termino en
 * seguimiento (`/redes?reporte=`).
 *
 * La busqueda es la misma de la portada (busqueda/lector-busqueda.tsx):
 * noticias y publicaciones en una lista, como /reportes. Hasta el 30 de
 * septiembre de 2026 la lupa de Redes abria la FICHA de lo escrito —las
 * tarjetas de tono de un termino en seguimiento, o la de una busqueda en vivo
 * con el boton de la pasada pagada—, y ese dia el cliente pidio que buscar
 * hiciera en las dos paginas lo que hace /reportes, sin la ficha. La pasada
 * pagada ya no tiene boton en pantalla; sus rutas (/api/termino,
 * /api/redes-en-vivo) y su libro siguen y nadie las llama.
 *
 * La ficha de un termino en seguimiento sigue existiendo porque /reportes la
 * abre («Ver reporte», lib/dominio/consultas.ts::rutaDeConsulta), con su PDF
 * al lado. Es otro parametro y no `?q=` a proposito: una busqueda no se
 * convierte en un reporte por coincidir con un termino. Un `?reporte=` que no
 * es un termino en seguimiento cae en la busqueda de lo escrito.
 *
 * Las pestanas del reporte son las redes que traen publicaciones (pedido del
 * cliente del 23 de septiembre de 2026): una pestana que abre «sin dato» no
 * sirve de nada, y «sin dato» sigue en la tarjeta de la ficha.
 */

const accion = ruta(null, "redes");

// Sin dialogo de lugar en ninguno de los dos (30 de septiembre de 2026): ni
// la busqueda ni el reporte dependen del lugar, y elegir una zona desde ahi
// salia de lo buscado sin decirlo. La barra muestra el termino como rotulo.

export function BusquedaRedes({ consulta }: { consulta: string }) {
  // «En noticias y redes» y no «de toda la región»: un termino no es un
  // lugar, asi que la busqueda no se acota a la zona que se este viendo.
  return (
    <LectorBusqueda rotulo="Redes" consulta={consulta} volver={accion} accion={accion}
      etiqueta="En noticias y redes" salida="Volver a las publicaciones" />
  );
}

const PESTANAS_CONSULTA: readonly { id: FiltroConsulta; nombre: string }[] = [
  { id: "todas", nombre: "Todas" },
  { id: "instagram", nombre: "Instagram" },
  { id: "tiktok", nombre: "TikTok" },
  { id: "facebook", nombre: "Facebook" },
  { id: "youtube", nombre: "YouTube" },
  { id: "x", nombre: "X" },
];

/** La pestana sobrevive a cambiar de termino, como en el panel de medios. */
let ultimaPestana: FiltroConsulta = "todas";

export function ReporteRedes({ termino }: { termino: string }) {
  const consultas = useConsultas();
  const [pestana, setPestana] = useState<FiltroConsulta>(() => ultimaPestana);
  useEffect(() => {
    ultimaPestana = pestana;
  }, [pestana]);
  const hallada = buscarConsulta(consultas.data, termino);
  const cargando = consultas.data === undefined && consultas.error === undefined;
  if (!cargando && hallada === null) return <BusquedaRedes consulta={termino} />;

  const conPublicaciones = new Set<string>(hallada === null ? [] : reunirPublicacionesConsulta(hallada).map((f) => f.red));
  const pestanas = PESTANAS_CONSULTA.filter((p) => p.id === "todas" || conPublicaciones.has(p.id));
  const activa: FiltroConsulta = pestanas.some((p) => p.id === pestana) ? pestana : "todas";

  return (
    <Lector volver={accion} rotulo="Redes" rotuloValor="Reporte" valor={termino}
      busqueda={<Buscador accion={accion} etiqueta="En noticias y redes" consulta={null} salida="Volver a las publicaciones" />}
      pestanas={
        <FilaPestanas etiqueta="Plataforma" pestanas={pestanas.map((p) => ({
          id: p.id, nombre: p.nombre, activa: p.id === activa, onElegir: () => setPestana(p.id),
        }))} />
      }>
      {hallada !== null && consultas.data !== undefined
        ? <VisorConsulta key={`${hallada.id}:${activa}`} c={hallada} doc={consultas.data} filtro={activa} />
        : cargando
          ? <div className="hoja-lector flex items-center justify-center py-16"><EstadoCarga etiqueta="Cargando reporte" /></div>
          : (
            <div className="hoja-lector">
              <div className="mx-auto w-full max-w-[88rem] px-4 py-8 md:px-8">
                <p className="text-lectura text-tinta-meta">El reporte no está disponible en esta vista.</p>
              </div>
            </div>
          )}
    </Lector>
  );
}
