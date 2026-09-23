"use client";

import { MagnifyingGlass as Lupa, TrendUp as Tendencia } from "@phosphor-icons/react";

import { clasesBoton } from "@/components/ui/clases";
import { EstadoCarga } from "@/components/ui/estado-carga";
import type { TendenciaTermino } from "@/lib/busqueda/termino";
import type { useRedesEnVivo } from "@/lib/busqueda/use-termino";
import { numero } from "@/lib/dominio/formato";

/**
 * Lo que la busqueda en vivo de un termino agrega a su ficha, entre las
 * tarjetas y las noticias: el boton de la busqueda en redes y las tendencias
 * de X que lo nombran.
 *
 * El boton existe por la decision del cliente del 23 de septiembre de 2026:
 * la busqueda en TikTok, Instagram y Facebook se paga por termino y tarda
 * minutos, asi que no se dispara sola al buscar —como Analizar, nadie paga si
 * nadie pulsa—. Lo que dice la pantalla es QUE pasa, nunca como: ni el
 * proveedor, ni el tope, ni el precio (AGENTS.md, «The UI says what, never
 * how»). Sin la compuerta encendida el boton no se pinta, y no se explica por
 * que: la ficha de lo gratuito ya es una respuesta completa.
 *
 * Las tendencias son el ranking de X y se dicen asi, con la misma salvedad del
 * panel de X (paneles/tendencias.tsx): nunca un tuit, nunca una medida de la
 * ciudad.
 */

type EnVivo = ReturnType<typeof useRedesEnVivo>;

export function AccionesEnVivo({ disponible, vivo, tendencias }: {
  disponible: boolean;
  vivo: EnVivo;
  tendencias: readonly TendenciaTermino[];
}) {
  const buscando = vivo.iniciando || (vivo.iniciada && (vivo.respuesta === null || vivo.respuesta.estado === "buscando"));
  const termino = vivo.respuesta?.estado;
  if (!disponible && tendencias.length === 0) return null;
  return (
    <section aria-label="Redes y tendencias" className="grid max-w-[72ch] gap-6">
      {!disponible ? null : vivo.fallo !== null ? (
        <p role="status" className="text-cuerpo text-tinta-meta">{vivo.fallo.mensaje}</p>
      ) : buscando ? (
        <div className="grid gap-2">
          <EstadoCarga etiqueta="Buscando en redes" />
          <p className="text-cuerpo text-tinta-meta">Puede tardar unos minutos. Lo que llega se suma arriba.</p>
        </div>
      ) : termino === "fallo" || vivo.errorLectura ? (
        <p className="text-cuerpo text-tinta-meta">La búsqueda en redes no está disponible por ahora.</p>
      ) : vivo.iniciada ? null : (
        <p>
          <button type="button" onClick={() => void vivo.iniciar()} className={clasesBoton(true)}>
            <Lupa size={16} aria-hidden /> Buscar también en TikTok, Instagram y Facebook
          </button>
        </p>
      )}

      {tendencias.length === 0 ? null : (
        <div>
          <h3 className="text-cuerpo font-medium text-tinta-prosa">En tendencia en X</h3>
          <ul className="mt-2 grid gap-1">
            {tendencias.map((t) => (
              <li key={`${t.lugar}:${t.nombre}`} className="flex flex-wrap items-baseline gap-x-2 text-cuerpo">
                <Tendencia size={14} aria-hidden className="text-tinta-dato" />
                <a href={t.url} target="_blank" rel="noopener noreferrer nofollow" className="text-tinta-titulo underline decoration-filo underline-offset-4 hover:decoration-tinta-prosa">
                  {t.nombre}
                </a>
                <span className="text-tinta-meta">puesto {numero(t.puesto)} en {t.lugar}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-meta text-tinta-meta">Es el ranking de X, no una medida de la ciudad.</p>
        </div>
      )}
    </section>
  );
}
