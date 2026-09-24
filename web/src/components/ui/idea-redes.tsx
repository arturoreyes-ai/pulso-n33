import type { SugerenciaSocial } from "@/lib/analisis/contrato";
import { formatoSocial } from "@/lib/analisis/formatos";

/**
 * La «Idea para redes» de una ficha, igual en la nota y en la publicacion.
 *
 * Estaba escrita dos veces (ahora/analisis-titular.tsx y paneles/analisis-
 * publicacion.tsx) con el mismo marcado. Desde el 24 de septiembre de 2026 el
 * formato sale de una lista cerrada (lib/analisis/formatos.ts), y la linea
 * que describe la pieza la escribe esa lista, no el modelo: un solo lugar la
 * pinta. Una ficha guardada en el CDN antes de la lista trae un formato libre;
 * se muestra tal cual y sin detalle, en vez de fallar.
 */
export function IdeaRedes({ id, s }: { id: string; s: SugerenciaSocial }) {
  const formato = formatoSocial(s.formato);
  return (
    <section aria-labelledby={`${id}-redes`} className="grid max-w-[65ch] gap-4 rounded-nucleo border border-filo bg-vela p-4 break-words">
      <h3 id={`${id}-redes`} className="text-meta text-tinta-dato">Idea para redes</h3>
      <div className="grid gap-1">
        <p className="text-cuerpo font-medium text-tinta-titulo">{s.formato}</p>
        {formato === null ? null : <p className="text-meta text-tinta-meta">{formato.detalle}</p>}
      </div>
      <dl className="grid gap-3 border-t border-filo pt-4">
        <div className="grid gap-1">
          <dt className="text-meta text-tinta-meta">Enfoque</dt>
          <dd>{s.enfoque}</dd>
        </div>
        <div className="grid gap-1">
          <dt className="text-meta text-tinta-meta">Gancho</dt>
          <dd className="text-tinta-titulo">{s.gancho}</dd>
        </div>
      </dl>
    </section>
  );
}
