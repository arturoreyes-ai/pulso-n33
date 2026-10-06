"use client";

import { LectorBusqueda } from "@/components/busqueda/lector-busqueda";
import { ruta } from "@/lib/dominio/secciones";

/**
 * Redes en modo BUSQUEDA (`/redes?q=`).
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
 * La ficha de un termino en seguimiento vivio aqui como `?reporte=` hasta el
 * 2 de octubre de 2026 y hoy es de /reportes (reportes/reporte-termino.tsx);
 * app/redes/page.tsx redirige los enlaces viejos.
 */

const accion = ruta(null, "redes");

// Sin dialogo de lugar (30 de septiembre de 2026): la busqueda no depende
// del lugar, y elegir una zona desde ahi salia de lo buscado sin decirlo.
// La barra muestra el termino como rotulo.

export function BusquedaRedes({ consulta }: { consulta: string }) {
  // «En noticias y redes» y no «de toda la región»: un termino no es un
  // lugar, asi que la busqueda no se acota a la zona que se este viendo.
  return (
    <LectorBusqueda rotulo="Redes" consulta={consulta} volver={accion} accion={accion}
      etiqueta="En noticias y redes" salida="Volver a las publicaciones" />
  );
}
