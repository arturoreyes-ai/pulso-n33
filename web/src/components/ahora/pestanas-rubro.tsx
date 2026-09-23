"use client";

import { FilaPestanas } from "@/components/ui/pestanas";
import type { Entrada } from "@/lib/busqueda/capitulos";
import { rutaDeEntrada } from "@/lib/busqueda/entrada";
import { NOMBRE_RUBRO, RUBROS, type Rubro } from "@/lib/busqueda/rubros";

/**
 * La fila de temas del recorrido: Todo, Clima, Seguridad, Deportes, Politica y
 * Economia.
 *
 * Existe porque los cinco rubros llevaban desde el 15 de septiembre de 2026
 * encerrados en mitad de la cadena —capitulos 2 a 6, detras de los quince
 * titulares del capitulo local— y no habia forma de pedir uno. La caja
 * "Trending topics" que el cliente mostro el 11 de septiembre es una fila de
 * pastillas, y esto es esa fila.
 *
 * ENLACES, no botones. Las pestanas de redes (paneles/lector-redes.tsx) son
 * botones con `aria-pressed` porque alli la pestana es estado de cliente y no
 * cambia de pagina; aqui elegir es NAVEGAR, igual que en el dialogo de lugares
 * (controles-ahora.tsx). Eso da tres cosas de balde: la eleccion se comparte y
 * sobrevive a una recarga, `aria-current` es de verdad y no una imitacion, y
 * funciona sin JavaScript. Y una cuarta que no es de balde sino el motivo: al
 * cambiar la URL cambia la llave del recorrido, que es lo unico que descongela
 * las listas de use-capitulos.ts y devuelve a la primera tarjeta.
 *
 * El lugar NO se pierde al elegir tema ni el tema al elegir lugar: los dos
 * controles componen la misma URL (entrada.ts::rutaDeEntrada).
 *
 * `scroll={false}`: el lector es una caja fija con su propio desplazamiento, y
 * el de la pagina ya esta arriba. Restaurarlo no mueve nada y de paso evita que
 * Next intente ajustar mientras el recorrido se remonta.
 */

/** Null es «Todo»: la cadena tal cual, empezando por la seccion del lugar. */
const PESTANAS: readonly (Rubro | null)[] = [null, ...RUBROS];

const nombre = (r: Rubro | null): string => (r === null ? "Todo" : NOMBRE_RUBRO[r]);

export function PestanasRubro({ entrada, rubro }: { entrada: Entrada; rubro: Rubro | null }) {
  return (
    <FilaPestanas etiqueta="Tema" pestanas={PESTANAS.map((r) => ({
      id: r ?? "todo",
      nombre: nombre(r),
      href: rutaDeEntrada(entrada, r),
      activa: r === rubro,
    }))} />
  );
}
