import type { ReactNode } from "react";

import { palabraTono, type Genero, type TonoSerie } from "@/lib/dominio/consultas";
import { numero, pluralizar } from "@/lib/dominio/formato";
import { Bisel } from "./bisel";
import { Hueco } from "./primitivas";
import { TiraTono } from "./tira-tono";

/**
 * La tarjeta de tono: positivos y negativos en grande, un cuadro por pieza y
 * el resto en gris al pie. Nacio en la ficha de un termino
 * (paneles/ficha-consulta.tsx, 22 y 23 de septiembre de 2026) y se saco aqui
 * el 28, cuando el seguimiento de publicaciones necesito la misma tarjeta
 * para el tono de los comentarios: el mismo dato no puede verse de dos formas
 * en dos pantallas.
 *
 * Lo que la forma sostiene de PRODUCT.md, porque sin pie de pagina la
 * tarjeta es lo unico que lo dice: conteos y nunca porcentajes (la tira pinta
 * un cuadro por pieza, ver tira-tono.tsx), «Sin dato» donde no se leyo en vez
 * de dos ceros, y el neutro y lo que quedo sin tono al pie para que las
 * cuentas cuadren con el total.
 */

/** Un numero grande con su flecha y su palabra. El color es el dato y no el
 *  unico portador: van la flecha y la palabra. Un cero va en gris para que el
 *  ojo caiga en lo que si hay. */
function Numero({ n, clase, genero }: { n: number; clase: "positivo" | "negativo"; genero: Genero }) {
  const color = clase === "positivo" ? "text-sube" : "text-baja";
  return (
    <div className="min-w-0">
      <p className={`flex items-baseline gap-2 font-titular text-hero tabular-nums ${n === 0 ? "text-tinta-meta" : color}`}>
        <span aria-hidden className={`text-rotulo ${color}`}>{clase === "positivo" ? "▲" : "▼"}</span>
        {numero(n)}
      </p>
      <p className="text-lectura text-tinta-dato">{palabraTono(clase, n, genero)}</p>
    </div>
  );
}

/** Lo que no es ni positivo ni negativo, en gris y al pie, con el total al
 *  que suman las cuatro cubetas. */
function Pie({ serie, unidad, genero }: { serie: TonoSerie; unidad: [string, string, string]; genero: Genero }) {
  if (serie.total === 0) return <p className="text-cuerpo text-tinta-meta">{unidad[2]}</p>;
  const resto = [
    serie.neutral > 0 ? `${numero(serie.neutral)} ${palabraTono("neutral", serie.neutral, genero)}` : null,
    serie.sinTono > 0 ? `${numero(serie.sinTono)} sin tono` : null,
  ].filter((x): x is string => x !== null);
  return (
    <p className="text-cuerpo text-tinta-meta">
      de {numero(serie.total)} {pluralizar(serie.total, unidad[0], unidad[1])}{resto.length > 0 ? ` · ${resto.join(" · ")}` : ""}
    </p>
  );
}

/** Una tarjeta: positivos y negativos en grande, un cuadro por pieza, el
 *  resto en gris. `serie` null es «sin dato» y no pinta un solo numero. */
export function CifraTono({ rotulo, serie, genero, unidad, sinTono, enlace, children }: {
  rotulo: string;
  serie: TonoSerie | null;
  genero: Genero;
  /** Singular, plural y la frase del cero: «noticia», «noticias», «ninguna noticia». */
  unidad: [string, string, string];
  /** La serie se leyo pero su tono no: pinta el total y dice «sin dato» del
   *  tono, en vez de dos ceros. Solo las publicaciones de un corte viejo. */
  sinTono?: number;
  /** El enlace al pie de la tarjeta: a la lista, al recorrido o a la hoja. */
  enlace?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Bisel as="li" nivel="panel" className="min-w-0" interior="flex h-full flex-col gap-3 p-4 sm:gap-4 sm:p-6">
      <p className="text-cuerpo font-medium text-tinta-prosa">{rotulo}</p>
      {sinTono !== undefined ? (
        <>
          <p className="font-titular text-hero tabular-nums text-tinta-titulo">{numero(sinTono)}</p>
          <p className="text-cuerpo text-tinta-meta">{pluralizar(sinTono, unidad[0], unidad[1])} · tono <Hueco>sin dato</Hueco></p>
        </>
      ) : serie === null ? (
        <p className="text-rotulo italic text-aviso/85">Sin dato</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <Numero n={serie.positivo} clase="positivo" genero={genero} />
            <Numero n={serie.negativo} clase="negativo" genero={genero} />
          </div>
          <TiraTono tramos={serie.tramos} />
          <Pie serie={serie} unidad={unidad} genero={genero} />
        </>
      )}
      {children}
      {enlace === undefined ? null : <div className="mt-auto pt-2">{enlace}</div>}
    </Bisel>
  );
}
