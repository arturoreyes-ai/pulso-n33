"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Lector } from "@/components/lector/lector";
import { EstadoCarga } from "@/components/ui/estado-carga";
import { FilaPestanas } from "@/components/ui/pestanas";
import { useRedesEnVivo, useTermino } from "@/lib/busqueda/use-termino";
import { useConsultas } from "@/lib/datos/hooks";
import type { Consulta } from "@/lib/datos/tipos";
import { buscarConsulta, reunirPublicacionesConsulta } from "@/lib/dominio/consultas";
import { ruta } from "@/lib/dominio/secciones";
import { armarConsulta, documentoDe, fundirPiezas, fundirTextos } from "@/lib/dominio/termino-vivo";
import { AccionesEnVivo } from "./busqueda-en-vivo";
import { BuscadorRedes } from "./buscador-redes";
import { OpcionesLugarRedes } from "./lector-redes";
import { VisorConsulta, type FiltroConsulta } from "./visor-consulta";

/**
 * Redes en modo BUSQUEDA (`/redes?q=`): un termino en seguimiento o la
 * busqueda en vivo de cualquier otro. Es un modo del lector, no una pestana:
 * la misma barra con «Búsqueda» como rotulo del valor, para no mover los ids
 * de sus dialogos.
 *
 * Dos casos, decididos por lib/dominio/consultas.ts::buscarConsulta:
 *
 *  - Lo escrito ES un termino de data/consultas.json: se muestra su cosecha de
 *    30 dias con la ficha del termino de primera tarjeta (VisorConsulta).
 *  - No lo es: la BUSQUEDA EN VIVO, desde el 23 de septiembre de 2026. Hasta
 *    ese dia lo escrito solo filtraba las publicaciones que el lector ya tenia
 *    delante; el cliente pidio que la lupa trajera, de cualquier termino,
 *    noticias, publicaciones y comentarios. Se arma una `Consulta` con la
 *    misma forma (lib/dominio/termino-vivo.ts) y se pinta con el MISMO visor y
 *    la MISMA ficha, sin PDF: la mitad gratuita al entrar (/api/termino) y la
 *    pagada detras del boton de la ficha (/api/redes-en-vivo).
 *
 * Las pestanas son las redes que traen publicaciones, en los dos casos
 * (pedido del cliente del 23 de septiembre de 2026): una pestana que abre
 * «sin dato» no sirve de nada, y «sin dato» sigue en la tarjeta de la ficha.
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

/** La pestana sobrevive a cambiar de termino, como en el panel de medios. */
let ultimaPestana: FiltroConsulta = "todas";

export function BusquedaRedes({ consulta, menu }: { consulta: string; menu: ReactNode }) {
  const consultas = useConsultas();
  const [pestana, setPestana] = useState<FiltroConsulta>(() => ultimaPestana);
  useEffect(() => {
    ultimaPestana = pestana;
  }, [pestana]);
  const hallada = buscarConsulta(consultas.data, consulta);
  const cargandoConsultas = consultas.data === undefined && consultas.error === undefined;
  // La busqueda en vivo solo cuando ya se sabe que NO es un termino en
  // seguimiento: si no, cada termino del cliente pediria las dos cosas.
  const enVivo = !cargandoConsultas && hallada === null;
  const termino = useTermino(enVivo ? consulta : "");
  const vivo = useRedesEnVivo(consulta);
  const viva = useMemo(() => {
    if (termino.data === undefined) return null;
    const piezas = fundirPiezas(termino.data.piezas, vivo.respuesta?.piezas ?? null);
    const c = armarConsulta(piezas);
    return {
      c,
      doc: documentoDe(c, piezas.generado),
      textos: fundirTextos(termino.data.textos, vivo.respuesta?.textos ?? null, piezas.figura, piezas.generado),
    };
  }, [termino.data, vivo.respuesta]);
  const cargando = cargandoConsultas || (enVivo && termino.cargando);

  const actual: Consulta | null = hallada ?? viva?.c ?? null;
  const conPublicaciones = new Set<string>(actual === null ? [] : reunirPublicacionesConsulta(actual).map((f) => f.red));
  const pestanas = PESTANAS_CONSULTA.filter((p) => p.id === "todas" || conPublicaciones.has(p.id));
  const activa: FiltroConsulta = pestanas.some((p) => p.id === pestana) ? pestana : "todas";
  const accion = ruta(null, "redes");

  return (
    <Lector volver={accion} rotulo="Redes" rotuloValor="Búsqueda" valor={consulta} tituloOpciones="Lugar"
      opciones={<OpcionesLugarRedes zona={null} cubetas={[]} activa="corredor" onCubeta={() => undefined} />}
      menu={menu}
      busqueda={<BuscadorRedes accion={accion} consulta={consulta} />}
      rotuloBusqueda="Buscar publicaciones"
      pestanas={
        <FilaPestanas etiqueta="Plataforma" pestanas={pestanas.map((p) => ({
          id: p.id, nombre: p.nombre, activa: p.id === activa, onElegir: () => setPestana(p.id),
        }))} />
      }>
      {cargando
        ? <div className="hoja-lector flex items-center justify-center py-16"><EstadoCarga etiqueta="Buscando" /></div>
        : hallada !== null && consultas.data !== undefined
          ? <VisorConsulta key={`${hallada.id}:${activa}`} c={hallada} doc={consultas.data} filtro={activa} />
          : viva !== null && termino.data !== undefined
            ? (
              <VisorConsulta
                key={`vivo:${consulta}:${activa}`}
                c={viva.c}
                doc={viva.doc}
                filtro={activa}
                textos={{ data: viva.textos, error: undefined }}
                informe={false}
                rotuloTipo="Búsqueda"
                sinFilas={`No hay publicaciones que nombren ${consulta} entre las que se leyeron.`}
                extra={<AccionesEnVivo disponible={termino.data.redesEnVivo} vivo={vivo} tendencias={termino.data.tendencias} />}
              />
            )
            : (
              <div className="hoja-lector">
                <div className="mx-auto w-full max-w-[88rem] px-4 py-8 md:px-8">
                  <p className="text-lectura text-tinta-meta">La búsqueda no está disponible en esta vista.</p>
                </div>
              </div>
            )}
    </Lector>
  );
}
