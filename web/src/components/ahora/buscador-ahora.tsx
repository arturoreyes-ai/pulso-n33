"use client";

import { BusquedaEnBarra } from "@/components/ui/busqueda-en-barra";
import { esEdicion, type Entrada } from "@/lib/busqueda/capitulos";
import { PARAM_EDICION, rutaDeEntrada } from "@/lib/busqueda/entrada";

/**
 * La busqueda de la portada, en la barra del lector (ui/busqueda-en-barra.tsx).
 *
 * Es un `<form method="get">` de verdad y no un campo que busca al teclear.
 * Dos razones, y la segunda es la que manda: en un lector a pantalla completa
 * cada tecla reconstruiria la pila de tarjetas bajo el dedo de quien lee, y
 * ademas asi la busqueda funciona sin JavaScript y queda en la URL, que es lo
 * que la hace compartible y la conserva al recargar.
 *
 * `accion` es la ruta del lugar donde se esta leyendo, asi que enviar desde
 * /tijuana busca en Tijuana. La edicion (`?e=mexico`) viaja en un campo
 * oculto desde el 25 de septiembre de 2026: hasta entonces enviar la soltaba
 * y buscar desde Mexico buscaba en el corredor, que es por lo que «mañanera»
 * no daba lo que da Google Noticias.
 *
 * TRES ARREGLOS de la primera version, los tres visibles en pantalla:
 *
 *  1. El campo era `bg-vela` CON borde, y encima cae el anillo de foco de
 *     globals.css (2px de chart-3 con 2px de separacion). Tres lineas
 *     concentricas alrededor de una caja de texto. Desde el 28 de septiembre
 *     de 2026 el anillo va en la pastilla entera (`:focus-within`) y el campo
 *     de adentro no pinta el suyo.
 *  2. El aspa: `type="search"` pinta la suya en WebKit en cuanto hay texto, y
 *     quedaban dos maneras de vaciar el campo que no eran la misma. Se apaga
 *     en globals.css; el campo se vacia seleccionando, como cualquier otro.
 *  3. «Salir de la búsqueda» era una pastilla del mismo ancho y peso que
 *     «Buscar», al lado del aspa de cerrar el dialogo: tres controles que
 *     parecian el mismo. El dialogo ya no existe; durante una busqueda la ×
 *     del campo ES la salida, y su nombre accesible dice a donde lleva
 *     («Volver al recorrido»), no la accion.
 */
export function BuscadorAhora({ accion, entrada, lugar, consulta }: {
  accion: string;
  /** La entrada del recorrido: su edicion se conserva al buscar. */
  entrada: Entrada;
  /** Donde se busca, para decirlo en vez de hacerlo adivinar. */
  lugar: string;
  consulta: string | null;
}) {
  // La forma vive en ui/busqueda-en-barra.tsx y la comparte Redes.
  return (
    <BusquedaEnBarra accion={accion} rotulo="Buscar titulares" etiqueta={`En ${lugar}`} consulta={consulta}
      ocultos={esEdicion(entrada) ? { [PARAM_EDICION]: entrada } : {}} destinoSalida={rutaDeEntrada(entrada)}
      salida="Volver al recorrido" />
  );
}
