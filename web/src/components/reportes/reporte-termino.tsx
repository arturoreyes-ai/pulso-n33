"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Buscador } from "@/components/busqueda/buscador";
import { Lector } from "@/components/lector/lector";
import { VisorConsulta, type FiltroConsulta } from "@/components/paneles/visor-consulta";
import { EstadoCarga } from "@/components/ui/estado-carga";
import { FilaPestanas } from "@/components/ui/pestanas";
import { useConsultas } from "@/lib/datos/hooks";
import { buscarConsulta, reunirPublicacionesConsulta } from "@/lib/dominio/consultas";

/**
 * El REPORTE de un termino en seguimiento (`/reportes?reporte=`): la ficha con
 * sus tarjetas de tono, sus noticias, publicaciones y comentarios.
 *
 * Vivio en Redes (`/redes?reporte=`) del 30 de septiembre al 2 de octubre de
 * 2026, y el cliente lo vio: la URL decia «redes», la barra decia «Redes» y la
 * flecha volvia al lector de publicaciones, cuando a un reporte solo se llega
 * desde /reportes («Ver reporte»). Ahora es de /reportes en las tres cosas, y
 * `/redes?reporte=` redirige aqui para que no se rompa un enlace guardado.
 *
 * Es otro parametro y no `?q=` a proposito: una busqueda no se convierte en
 * un reporte por coincidir con un termino. Un `?reporte=` que no es un
 * termino en seguimiento se reemplaza por la busqueda de lo escrito
 * (`/reportes?q=`), que es lo que era antes en Redes.
 *
 * Las pestanas son las redes que traen publicaciones (pedido del cliente del
 * 23 de septiembre de 2026): una pestana que abre «sin dato» no sirve de
 * nada, y «sin dato» sigue en la tarjeta de la ficha.
 */

const PESTANAS_CONSULTA: readonly { id: FiltroConsulta; nombre: string }[] = [
  { id: "todas", nombre: "Todas" },
  { id: "instagram", nombre: "Instagram" },
  { id: "tiktok", nombre: "TikTok" },
  { id: "facebook", nombre: "Facebook" },
  { id: "youtube", nombre: "YouTube" },
  { id: "x", nombre: "X" },
];

const REPORTES = "/reportes";

/** La pestana sobrevive a cambiar de termino, como en el panel de medios. */
let ultimaPestana: FiltroConsulta = "todas";

export function ReporteTermino({ termino }: { termino: string }) {
  const router = useRouter();
  const consultas = useConsultas();
  const [pestana, setPestana] = useState<FiltroConsulta>(() => ultimaPestana);
  useEffect(() => {
    ultimaPestana = pestana;
  }, [pestana]);
  const hallada = buscarConsulta(consultas.data, termino);
  const cargando = consultas.data === undefined && consultas.error === undefined;
  const noEsTermino = !cargando && consultas.data !== undefined && hallada === null;
  useEffect(() => {
    if (noEsTermino) router.replace(`${REPORTES}?${new URLSearchParams({ q: termino }).toString()}`);
  }, [noEsTermino, router, termino]);

  const conPublicaciones = new Set<string>(hallada === null ? [] : reunirPublicacionesConsulta(hallada).map((f) => f.red));
  const pestanas = PESTANAS_CONSULTA.filter((p) => p.id === "todas" || conPublicaciones.has(p.id));
  const activa: FiltroConsulta = pestanas.some((p) => p.id === pestana) ? pestana : "todas";

  return (
    // La lupa busca en /reportes, que lee `?q=`: la misma busqueda que la
    // pagina de la que se vino, y no la de Redes.
    <Lector volver={REPORTES} rotulo="Reportes" rotuloValor="Reporte" valor={termino}
      busqueda={<Buscador accion={REPORTES} etiqueta="En noticias y redes" consulta={null} salida="Volver al reporte" />}
      pestanas={
        <FilaPestanas etiqueta="Plataforma" pestanas={pestanas.map((p) => ({
          id: p.id, nombre: p.nombre, activa: p.id === activa, onElegir: () => setPestana(p.id),
        }))} />
      }>
      {hallada !== null && consultas.data !== undefined
        ? <VisorConsulta key={`${hallada.id}:${activa}`} c={hallada} doc={consultas.data} filtro={activa} />
        : cargando || noEsTermino
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
