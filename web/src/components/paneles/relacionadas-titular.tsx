"use client";

import { ClockCounterClockwise as Historial } from "@phosphor-icons/react";

import { clasesChip } from "@/components/ui/clases";
import type { NotaRelacionada } from "@/lib/busqueda/tipos";
import { fechaCorta } from "@/lib/dominio/formato";

/**
 * «Notas relacionadas»: lo que el archivo ya publicó sobre lo mismo.
 *
 * EL CASO: una tarjeta del recorrido es titular, fuente y enlace, sin cuerpo
 * ni extracto, y no hay desde donde seguir un tema. El archivo tiene las
 * semanas anteriores del corredor, y ahi esta la respuesta. El emparejado vive
 * en lib/busqueda/relacionadas.ts, es puro, y desde el 18 de septiembre de
 * 2026 corre en el servidor: la hoja pide /api/relacionadas al abrirse en vez
 * de que la portada descargue el archivo entero por si acaso.
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

/**
 * El tercer estado, y la razon de que exista.
 *
 * SIN_COINCIDENCIAS afirma algo: que se miro y no habia. Cuando lo que pasa es
 * que no se pudo mirar, esa frase inventa un hueco de cobertura — la regla 4
 * de PRODUCT.md al reves, que prohibe rellenar un hueco pero tambien fabricarlo.
 * Dice QUE falta y no por que: nada de rutas, archivos ni despliegues.
 */
const SIN_ARCHIVO = "Las notas anteriores no están disponibles en esta vista.";

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
 * estado propio: recibe la lista ya pedida.
 *
 * Tres estados, y el orden en que se preguntan importa: primero si falló
 * —porque entonces la lista vacía no significa nada—, luego si sigue en
 * camino, y sólo al final «no hay».
 */
export function ListaRelacionadas({ notas, cargando, fallo }: {
  notas: readonly NotaRelacionada[];
  cargando: boolean;
  fallo: boolean;
}) {
  return (
    <div className="grid gap-4 px-4 pt-6 pb-8 text-lectura text-tinta-prosa">
      {fallo ? (
        <p role="status" className="max-w-[65ch] text-tinta-meta">{SIN_ARCHIVO}</p>
      ) : cargando ? (
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
