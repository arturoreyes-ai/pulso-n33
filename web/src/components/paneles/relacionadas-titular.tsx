"use client";

import { ClockCounterClockwise as Historial } from "@phosphor-icons/react";

import { clasesChip } from "@/components/ui/clases";
import type { Nota } from "@/lib/datos/tipos";
import { fechaCorta } from "@/lib/dominio/formato";

/**
 * «Notas relacionadas»: lo que el archivo ya publicó sobre lo mismo.
 *
 * EL CASO: una tarjeta del recorrido es titular, fuente y enlace, sin cuerpo
 * ni extracto, y no hay desde donde seguir un tema. El archivo que el navegador
 * ya descarga en la portada -- el mismo que da las miniaturas y el enlace del
 * medio -- tiene las semanas anteriores del corredor, y ahi esta la respuesta.
 * El emparejado vive en lib/busqueda/relacionadas.ts y es puro.
 *
 * EL BOTON Y EL CUERPO VAN SEPARADOS, como en analisis-publicacion.tsx y por
 * la misma razon: el recorrido monta una sola hoja para todas las tarjetas.
 * Un `<dialog>` por tarjeta serian treinta dialogos montados, y ese es el
 * error que visor-redes.tsx ya documenta.
 *
 * TRES COSAS QUE NO HACE, cada una por una regla de PRODUCT.md:
 *
 *  - No muestra `postura`. El tono es de la frase, no de nadie; pegarlo a una
 *    nota junto a la figura que nombra fabrica una afirmacion que el modelo no
 *    sostiene (regla 5).
 *  - No suma estas notas con los conteos de prensa, ni saca porcentajes: son
 *    seis como mucho, muy por debajo del piso de 30 (reglas 2 y 3).
 *  - Sin coincidencias no rellena. Dice que no hay y ya (regla 4). Es el caso
 *    comun fuera del corredor, y no es un fallo que disimular.
 *
 * Y no nombra el mecanismo: ni corpus, ni corrida, ni archivo como sistema.
 * Sitúa en el tiempo, que es lo que el lector necesita saber.
 */

export const TITULO_RELACIONADAS = "Notas relacionadas";

const SIN_COINCIDENCIAS =
  "No encontramos notas anteriores sobre esto. La cobertura no es pareja en todo el corredor.";

const ESPERANDO = "Buscando notas anteriores…";

/** El chip de la fila de acciones. Solo abre la hoja; no calcula nada. */
export function BotonRelacionadas({ onAbrir }: { onAbrir: () => void }) {
  return (
    <button type="button" className={clasesChip(false)} onClick={onAbrir}>
      <Historial size={16} weight="light" aria-hidden className="shrink-0 self-center" />
      Relacionadas
    </button>
  );
}

/**
 * El cuerpo de la hoja. Solo se monta cuando ya se abrió, así que no necesita
 * estado propio: recibe la lista ya calculada.
 *
 * `listo` en false es el archivo que todavía no llega — se pide con prioridad
 * baja y el recorrido no lo espera, igual que las miniaturas.
 */
export function ListaRelacionadas({ notas, listo }: { notas: readonly Nota[]; listo: boolean }) {
  return (
    <div className="grid gap-4 px-4 pt-6 pb-8 text-lectura text-tinta-prosa">
      {!listo ? (
        <p role="status" className="max-w-[65ch] text-tinta-meta">{ESPERANDO}</p>
      ) : notas.length === 0 ? (
        <p role="status" className="max-w-[65ch] text-tinta-meta">{SIN_COINCIDENCIAS}</p>
      ) : (
        <ul className="grid gap-4">
          {notas.map((n) => (
            <li key={n.id} className="border-t border-filo pt-4 first:border-t-0 first:pt-0">
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block max-w-[65ch] text-tinta-titulo underline-offset-4 hover:underline"
              >
                {n.titulo}
              </a>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-meta text-tinta-meta">
                <span className="text-tinta-dato">{n.dominio}</span>
                {n.fecha === null ? null : <time dateTime={n.fecha}>{fechaCorta(n.fecha)}</time>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
