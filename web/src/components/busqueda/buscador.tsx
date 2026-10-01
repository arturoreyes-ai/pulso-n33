"use client";

import { BusquedaEnBarra } from "@/components/ui/busqueda-en-barra";

/**
 * EL buscador de la portada y de Redes, en la barra del lector.
 *
 * Eran dos (ahora/buscador-ahora.tsx, «Buscar titulares», y
 * paneles/buscador-redes.tsx, «Buscar publicaciones») que buscaban cosas
 * distintas con la misma forma. Desde el 30 de septiembre de 2026 las dos
 * paginas buscan lo mismo, noticias y publicaciones
 * (busqueda/resultados-busqueda.tsx), y el buscador es uno: cada pagina pone
 * solo a donde envia y a donde vuelve.
 *
 * `ocultos` conserva la edicion de la portada (`e=mexico`): sin ella buscar
 * desde Mexico buscaba en el corredor, que es por lo que «mañanera» no daba
 * lo que da Google Noticias (25 de septiembre de 2026).
 *
 * Sin bandeja de TERMINOS EN SEGUIMIENTO bajo el campo desde el mismo dia
 * (cliente: «muy confuso»). Estaba en Redes desde el 18 de septiembre para
 * llegar a la ficha de cada termino sin saber escribirlo; con la busqueda
 * comun eran unas pastillas bajo un campo vacio que no se sabia si eran
 * sugerencias, filtros o historial. Los terminos y sus reportes estan en
 * /reportes.
 */
export function Buscador({ accion, etiqueta, consulta, salida, destinoSalida, ocultos = {} }: {
  accion: string;
  /** Donde buscan las noticias: «En Tijuana», «En noticias y redes». */
  etiqueta: string;
  consulta: string | null;
  /** Lo que hace la × durante una busqueda: «Volver al recorrido». */
  salida: string;
  destinoSalida?: string;
  ocultos?: Readonly<Record<string, string>>;
}) {
  return (
    <BusquedaEnBarra accion={accion} rotulo="Buscar noticias y publicaciones" etiqueta={etiqueta} consulta={consulta}
      ocultos={ocultos} destinoSalida={destinoSalida} salida={salida} />
  );
}
