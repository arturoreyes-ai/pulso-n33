"use client";

import { ShareNetwork as IconoCompartir, TrendUp as Tendencia } from "@phosphor-icons/react";
import { useState } from "react";

import { BotonRelacionadas } from "@/components/paneles/relacionadas-titular";
import { clasesChip } from "@/components/ui/clases";
import type { ReferenciaAnalisis } from "@/lib/busqueda/enlaces";
import type { Tarjeta } from "@/lib/busqueda/capitulos";
import { fechaCorta, hora } from "@/lib/dominio/formato";
import { AnalisisTitular } from "./analisis-titular";

/**
 * Las tarjetas del recorrido de la portada. Todas a pantalla completa.
 *
 * Son tipograficas por omision: la fuente en vivo no publica miniatura ni
 * extracto, y el producto es titular, fuente y enlace (PRODUCT.md). Lo que
 * WikiTok resuelve con una foto de fondo aqui lo resuelve el titular a tamano
 * de seccion, en la voz de titular, con la cejilla del capitulo arriba.
 *
 * Desde el 14 de septiembre de 2026 una tarjeta lleva figura cuando la misma
 * nota esta en el corpus con la miniatura del propio medio (lib/busqueda/
 * imagenes.ts). Va ARRIBA del titular, acotada y sin texto encima: el texto
 * sigue sobre los tokens de tinta y no sobre una foto de contraste
 * desconocido. Si la imagen no carga, conserva su espacio: quitar la figura
 * desplazaba el titular bajo el dedo. El medio puede dejar de servirla.
 *
 * Desde el 17 de septiembre de 2026 la figura NUNCA va vacia. Antes, sin
 * miniatura, esta caja reservaba hasta 14rem transparentes y la tarjeta se
 * veia en blanco —que era el caso comun, no el raro: de 503 notas llegadas
 * por busqueda, ninguna recupera imagen del corpus—. Ahora lleva una placa
 * con el nombre del medio (`.placa-ahora` en globals.css), y encima de ella
 * puede llegar el `og:image` del propio medio (lib/busqueda/use-imagen-viva.ts).
 * La placa es tambien el estado en vuelo y el de fallo, asi que el lector no
 * ve el hueco en ningun momento.
 *
 * `.tarjeta-ahora` mide la caja del lector, no la pagina ni el visor de redes.
 * Los divisores, los huecos y la tarjeta final miden lo
 * mismo que un titular a proposito: un punto de ajuste de otra altura rompe el
 * ritmo de «un gesto, una tarjeta».
 *
 * La flecha de tendencia sustituye el rotulo `en vivo`: el nombre accesible
 * conserva el significado sin sumar otra palabra a la fila de metadatos.
 */

/* El relleno vive en `.tarjeta-ahora` (globals.css), no aqui: una utilidad
   `py-*` perderia contra esa regla, que no esta en la capa de utilidades. */
const TARJETA = "tarjeta-ahora mx-auto flex w-full max-w-[88rem] flex-col justify-center";

type Titular = Extract<Tarjeta, { tipo: "titular" }>;
type Divisor = Extract<Tarjeta, { tipo: "divisor" }>;
type Hueco = Extract<Tarjeta, { tipo: "hueco" }>;

export function TarjetaTitular({ t, titulares, indice, imagen = null, analisis = false, referencia = null, onRelacionadas }: {
  t: Titular;
  titulares: number;
  indice: number;
  imagen?: string | null;
  analisis?: boolean;
  referencia?: ReferenciaAnalisis | null;
  /** Abre la hoja de notas relacionadas, que vive UNA sola en el recorrido. */
  onRelacionadas?: (() => void) | undefined;
}) {
  const iso = t.r.publicado;
  const valida = iso !== null && !Number.isNaN(Date.parse(iso));
  // Un comunicado del Ayuntamiento no es una lectura en vivo ni trae hora: su
  // `fecha` es solo el dia, y `hora()` pintaria medianoche. Tampoco lleva
  // `nofollow`, que estaba porque el enlace venia de un buscador; este es el
  // del propio emisor.
  const oficial = t.capitulo === "comunicados";
  const [rota, setRota] = useState<string | null>(null);
  const conFigura = imagen !== null && imagen !== rota;
  return (
    <article data-indice={indice} aria-label={`Titular ${t.orden} de ${titulares}`} className={TARJETA}>
        <figure className="figura-ahora overflow-hidden rounded-nucleo" aria-hidden>
          {conFigura ? (
            /* alt vacio y aria-hidden: la imagen no tiene pie propio y el
               titular ya es el texto. no-referrer: el medio la sirve, la
               pagina no se le presenta. */
            <img src={imagen} alt="" aria-hidden loading="lazy" decoding="async" referrerPolicy="no-referrer"
              className="h-full w-full object-cover" onError={() => setRota(imagen)} />
          ) : (
            /* Sin foto la caja NO se deja vacia. El porque, en `.placa-ahora`. */
            <div className={`placa-ahora ${t.acento}`}>
              <span className="placa-ahora-marca">{t.r.medio}</span>
            </div>
          )}
        </figure>
      <p className={`text-meta ${t.acento}`}>{t.rotulo}</p>
      <h2 className="mt-4 max-w-[24ch] break-words font-titular text-seccion text-tinta-titulo md:text-hero md:[font-stretch:112%]">
        {t.r.titulo}
      </h2>
      <p className="mt-6 flex flex-wrap items-center gap-2 text-cuerpo text-tinta-meta">
        <span className="text-tinta-dato">{t.r.medio}</span>
        {iso !== null && valida ? (
          <time dateTime={iso}>{fechaCorta(iso)}{oficial ? null : <> · {hora(iso)}</>}</time>
        ) : (
          <span>s/f</span>
        )}
        {oficial ? (
          <span
            title="Boletín publicado por el Ayuntamiento. No es prensa y no cuenta en las cifras de prensa."
            className="inline-block rounded-full border border-dashed border-filo px-2 py-px text-meta whitespace-nowrap text-tinta-meta"
          >
            comunicado
          </span>
        ) : (
          <span
            role="img"
            aria-label="Noticia en tendencia."
            title="Noticia en tendencia."
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-filo text-tinta-dato"
          >
            <Tendencia size={16} weight="light" aria-hidden />
          </span>
        )}
        {t.r.idioma === "en" ? (
          <span className="inline-block rounded-full border border-filo bg-vela px-2 py-px text-meta whitespace-nowrap text-tinta-dato">
            inglés
          </span>
        ) : null}
      </p>
      <div className="acciones-ahora mt-8 flex flex-wrap items-center gap-3">
        {/* nofollow: es un enlace que devolvio un buscador, no una cita. Un
            comunicado no pasa por ahi: es el enlace del propio emisor. */}
        <a href={t.r.url} target="_blank" rel={oficial ? "noopener noreferrer" : "noopener nofollow noreferrer"} className={`${clasesChip(true)} min-w-0 break-words`}>
          Leer en {t.r.medio}
        </a>
        {/* La referencia prefiere el enlace del medio. Si la nota acaba de
            aparecer conserva el token para resolverlo solo tras confirmar. */}
        {analisis ? <AnalisisTitular titulo={t.r.titulo} referencia={referencia} medio={t.r.medio} /> : null}
        {/* Antes del contador, que es quien lleva el `ml-auto`. */}
        {onRelacionadas ? <BotonRelacionadas onAbrir={onRelacionadas} /> : null}
        <Compartir titulo={t.r.titulo} url={t.r.url} />
        <p className="ml-auto text-meta tabular-nums text-tinta-meta">{t.orden} de {titulares}</p>
      </div>
    </article>
  );
}

/** Compartir con la hoja del sistema donde exista; si no, copiar el enlace.
 *  `navigator` solo se toca en el manejador: el servidor pinta lo mismo. */
function Compartir({ titulo, url }: { titulo: string; url: string }) {
  const [aviso, setAviso] = useState("");
  async function compartir() {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: titulo, url });
        setAviso("");
      } else {
        await navigator.clipboard.writeText(url);
        setAviso("Enlace copiado.");
      }
    } catch (error) {
      // Cerrar la hoja sin elegir no es un fallo.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setAviso("No se pudo compartir.");
    }
  }
  return (
    <>
      <button type="button" className={clasesChip(false)} onClick={compartir}>
        <IconoCompartir size={16} weight="light" aria-hidden className="shrink-0 self-center" />
        Compartir
      </button>
      <span role="status" className="aviso-compartir text-meta text-tinta-meta">{aviso}</span>
    </>
  );
}

export function TarjetaDivisor({ t, indice }: { t: Divisor; indice: number }) {
  return (
    <article data-indice={indice} aria-label={t.titulo} className={TARJETA}>
      <p className={`text-meta ${t.acento}`}>{t.rotulo}</p>
      <h2 className="mt-4 max-w-[24ch] font-titular text-seccion text-tinta-titulo">{t.titulo}</h2>
      <p className="mt-4 max-w-[65ch] text-lectura text-tinta-prosa">
        {t.n === 1 ? `Un ${t.sustantivo}` : `${t.n} ${t.sustantivo}s`}
        {t.nota === null ? "." : ` · ${t.nota}`}
      </p>
    </article>
  );
}

/** Un capitulo que no llego. Se dice y se sigue: un hueco rotulado, no cero. */
export function TarjetaHueco({ t, indice }: { t: Hueco; indice: number }) {
  return (
    <article data-indice={indice} aria-label={t.titulo} className={TARJETA}>
      <p className={`text-meta ${t.acento}`}>{t.rotulo}</p>
      <h2 className="mt-4 max-w-[24ch] font-titular text-seccion text-tinta-titulo">{t.titulo}</h2>
      <p className="mt-4 max-w-[65ch] text-lectura text-baja">No se pudo traer esta lista. El recorrido sigue.</p>
    </article>
  );
}

export function TarjetaFinal({ frase, indice, onInicio, titulo = "Llegaste al final de lo que destaca ahora." }: { frase: string; indice: number; onInicio: () => void; titulo?: string }) {
  return (
    <article data-indice={indice} aria-label="Final del recorrido" className={TARJETA}>
      <h2 className="max-w-[24ch] font-titular text-seccion text-tinta-titulo">{titulo}</h2>
      <p className="mt-4 max-w-[65ch] text-lectura text-tinta-prosa">{frase}</p>
      <div className="mt-8">
        <button type="button" className={clasesChip(false)} onClick={onInicio}>Volver al inicio</button>
      </div>
    </article>
  );
}

/** Mientras un capitulo carga, una tarjeta con la geometria de una real, para
 *  que el primer titular sustituya al esqueleto en su sitio y no empuje la
 *  pagina. Su indice es el que ocupara la siguiente tarjeta al llegar.
 *  `sin-ajuste`: no es un punto de ajuste (globals.css explica el salto al
 *  final que provocaba serlo). */
export function EsqueletoTitular({ indice }: { indice: number }) {
  return (
    <article data-indice={indice} aria-hidden className={`${TARJETA} sin-ajuste motion-safe:animate-pulse`}>
      <div className="h-3 w-32 rounded-etiqueta bg-vela" />
      <div className="mt-6 h-9 w-11/12 rounded-etiqueta bg-vela" />
      <div className="mt-3 h-9 w-10/12 rounded-etiqueta bg-vela" />
      <div className="mt-3 h-9 w-7/12 rounded-etiqueta bg-vela" />
      <div className="mt-8 h-3 w-1/2 rounded-etiqueta bg-vela" />
    </article>
  );
}
