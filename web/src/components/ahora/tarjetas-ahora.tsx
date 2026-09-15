"use client";

import { useState } from "react";

import { clasesChip } from "@/components/ui/clases";
import type { Tarjeta } from "@/lib/busqueda/capitulos";
import { fechaCorta, hora } from "@/lib/dominio/formato";

/**
 * Las tarjetas del recorrido /ahora. Todas a pantalla completa.
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
 * desconocido. Si la imagen no carga, la figura desaparece y la tarjeta queda
 * como las demas; el medio es quien la sirve, y puede dejar de hacerlo.
 *
 * Comparten `.publicacion-visual` con el visor de redes (globals.css): es lo
 * que las hace medir la pantalla y ajustarse al desplazar, y el numero del
 * margen vive solo ahi. Los divisores, los huecos y la tarjeta final miden lo
 * mismo que un titular a proposito: un punto de ajuste de otra altura rompe el
 * ritmo de «un gesto, una tarjeta».
 *
 * Las marcas `en vivo` e `inglés` son las de muro/fila-externa.tsx, letra por
 * letra: es el mismo tipo de dato con la misma salvedad.
 */

const TARJETA = "publicacion-visual flex flex-col justify-center border-b border-filo py-8 md:py-12";

type Titular = Extract<Tarjeta, { tipo: "titular" }>;
type Divisor = Extract<Tarjeta, { tipo: "divisor" }>;
type Hueco = Extract<Tarjeta, { tipo: "hueco" }>;

export function TarjetaTitular({ t, titulares, indice, imagen = null }: { t: Titular; titulares: number; indice: number; imagen?: string | null }) {
  const iso = t.r.publicado;
  const valida = iso !== null && !Number.isNaN(Date.parse(iso));
  const [rota, setRota] = useState<string | null>(null);
  const conFigura = imagen !== null && imagen !== rota;
  return (
    <article data-indice={indice} aria-label={`Titular ${t.orden} de ${titulares}`} className={TARJETA}>
      {conFigura ? (
        <figure className="mb-6 max-h-[42svh] w-full overflow-hidden rounded-nucleo bg-vela md:max-h-[40svh]">
          {/* alt vacio y aria-hidden: la imagen no tiene pie propio y el
              titular ya es el texto. no-referrer: el medio la sirve, la
              pagina no se le presenta. */}
          <img src={imagen} alt="" aria-hidden loading="lazy" decoding="async" referrerPolicy="no-referrer"
            className="h-full w-full object-cover" onError={() => setRota(imagen)} />
        </figure>
      ) : null}
      <p className={`text-meta ${t.acento}`}>{t.rotulo}</p>
      <h2 className={`mt-4 max-w-[24ch] break-words font-titular text-seccion text-tinta-titulo ${conFigura ? "" : "md:text-hero md:[font-stretch:112%]"}`}>
        {t.r.titulo}
      </h2>
      <p className="mt-6 flex flex-wrap items-center gap-2 text-cuerpo text-tinta-meta">
        <span className="text-tinta-dato">{t.r.medio}</span>
        {iso !== null && valida ? (
          <time dateTime={iso}>{fechaCorta(iso)} · {hora(iso)}</time>
        ) : (
          <span>s/f</span>
        )}
        <span
          title="Resultado en vivo: no tiene zona, tono ni figura, y no cuenta en las cifras de prensa."
          className="inline-block rounded-full border border-dashed border-filo px-2 py-px text-meta whitespace-nowrap text-tinta-meta"
        >
          en vivo
        </span>
        {t.r.idioma === "en" ? (
          <span className="inline-block rounded-full border border-filo bg-vela px-2 py-px text-meta whitespace-nowrap text-tinta-dato">
            inglés
          </span>
        ) : null}
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        {/* nofollow: es un enlace que devolvio un buscador, no una cita. */}
        <a href={t.r.url} target="_blank" rel="noopener nofollow noreferrer" className={clasesChip(true)}>
          Leer en {t.r.medio}
        </a>
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
      <button type="button" className={clasesChip(false)} onClick={compartir}>Compartir</button>
      <span role="status" className="text-meta text-tinta-meta">{aviso}</span>
    </>
  );
}

export function TarjetaDivisor({ t, indice }: { t: Divisor; indice: number }) {
  return (
    <article data-indice={indice} aria-label={t.titulo} className={TARJETA}>
      <p className={`text-meta ${t.acento}`}>{t.rotulo}</p>
      <h2 className="mt-4 max-w-[24ch] font-titular text-seccion text-tinta-titulo">{t.titulo}</h2>
      <p className="mt-4 max-w-[65ch] text-lectura text-tinta-prosa">
        {t.n === 1 ? "Un titular" : `${t.n} titulares`}
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

export function TarjetaFinal({ frase, indice, onInicio }: { frase: string; indice: number; onInicio: () => void }) {
  return (
    <article data-indice={indice} aria-label="Final del recorrido" className={TARJETA}>
      <h2 className="max-w-[24ch] font-titular text-seccion text-tinta-titulo">Llegaste al final de lo que destaca ahora.</h2>
      <p className="mt-4 max-w-[65ch] text-lectura text-tinta-prosa">{frase}</p>
      <div className="mt-8">
        <button type="button" className={clasesChip(false)} onClick={onInicio}>Volver al inicio</button>
      </div>
    </article>
  );
}

/** Mientras un capitulo carga, una tarjeta con la geometria de una real, para
 *  que el primer titular sustituya al esqueleto en su sitio y no empuje la
 *  pagina. Sin data-indice: no es un destino del recorrido. */
export function EsqueletoTitular() {
  return (
    <article aria-hidden className={`${TARJETA} animate-pulse`}>
      <div className="h-3 w-32 rounded-etiqueta bg-vela" />
      <div className="mt-6 h-9 w-11/12 rounded-etiqueta bg-vela" />
      <div className="mt-3 h-9 w-10/12 rounded-etiqueta bg-vela" />
      <div className="mt-3 h-9 w-7/12 rounded-etiqueta bg-vela" />
      <div className="mt-8 h-3 w-1/2 rounded-etiqueta bg-vela" />
    </article>
  );
}
