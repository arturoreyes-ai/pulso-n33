import { ArrowSquareOut as Abrir, CaretDown as Desplegar } from "@phosphor-icons/react/dist/ssr";

import { Bisel } from "@/components/ui/bisel";
import { Barra } from "@/components/ui/primitivas";
import { MESES, MESES_CORTOS, numero, pluralizar } from "@/lib/dominio/formato";
import { REDES_DEL_ANO, type AnoEnRedes, type PublicacionDelMes, type RedDelAno } from "@/lib/expedientes/expedientes";
import { BotonComentariosAno, ProveedorHojaAno } from "./hoja-comentarios-ano";

/**
 * «Lo más visto, mes por mes»: el año de un expediente en sus cuentas y en
 * TikTok (pulso/expediente_redes.py, 2 de octubre de 2026: «lo más popular,
 * lo más visto, lo de más likes, en todo el año», con unos 50 comentarios).
 *
 * Primero la respuesta y después el detalle (cliente, 5 de octubre de 2026,
 * «un diseño más amigable para ver las publicaciones»). La primera versión
 * eran trece meses por tres redes por tres filas, 117 publicaciones del mismo
 * peso en ocho pantallas de escritorio: lo más visto del año —un reel de 452
 * mil vistas, dos TikToks de 300 mil— quedaba enterrado en su mes. Ahora:
 *
 * 1. Lo más visto del año, una publicación por red.
 * 2. Un renglón por mes con el #1 de cada red y una barra en la escala de esa
 *    red en el año, para ver los picos de un vistazo. El pico del año va en
 *    el color de la serie y es la misma publicación de arriba.
 * 3. Abrir el mes da el #1 al #3 de cada red, con `<details>` nativo.
 * 4. «N comentarios» abre la hoja de esa publicación (hoja-comentarios-ano.tsx):
 *    lo que dicen sus comentarios, en el resumen de IA, cómo suenan y la
 *    lista. Era un `<details>` en la columna, sin resumen; el 5 de octubre de
 *    2026 el cliente pidió el resumen por publicación de «En redes», que
 *    salió de la página, y en una columna angosta no cabía.
 *
 * Componente de servidor: lo único del cliente es la hoja y su botón.
 *
 * Lo que la forma sostiene, porque no hay pie de página que lo diga:
 * - Cada red con SU unidad (vistas, likes, reacciones), su propia barra y
 *   nunca sumadas: la escala de una columna no se compara con la de otra.
 * - Una red cuya lectura falló dice «Sin dato»; un mes vacío de una red leída
 *   dice que no hubo nada, que es un cero medido de lo leído.
 * - Tono contado, nunca porcentaje, con la salvedad del documento al pie.
 */

const NOMBRE: Record<RedDelAno, string> = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook" };
const UNIDAD: Record<RedDelAno, readonly [string, string]> = {
  tiktok: ["vista", "vistas"],
  instagram: ["like", "likes"],
  facebook: ["reacción", "reacciones"],
};
/** Instagram y Facebook son siempre sus cuentas; en TikTok publica cualquiera. */
const DE_QUIEN: Record<RedDelAno, string> = { tiktok: "videos que lo nombran", instagram: "su cuenta", facebook: "su página" };
const VACIO: Record<RedDelAno, string> = {
  tiktok: "Ningún video que lo nombre.",
  instagram: "No publicó.",
  facebook: "No publicó.",
};

const ENLACE = "text-tinta-titulo transition-colors duration-[var(--dur-toque)] hover:underline hover:decoration-realce hover:underline-offset-[3px]";
const SUMARIO = "cursor-pointer list-none [&::-webkit-details-marker]:hidden";

function cifra(red: RedDelAno, p: PublicacionDelMes): number {
  return red === "tiktok" ? (p.reproducciones ?? p.likes) : p.likes;
}

/** TikTok sin vistas (no vino la cifra) se mide en likes, y lo dice. */
function unidad(red: RedDelAno, p: PublicacionDelMes): readonly [string, string] {
  return red === "tiktok" && p.reproducciones === undefined ? UNIDAD.instagram : UNIDAD[red];
}

const mesLargo = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1] ?? mes} de ${mes.slice(0, 4)}`;
const mesCorto = (mes: string) => MESES_CORTOS[Number(mes.slice(5, 7)) - 1] ?? mes;
/** El mismo renglon para la cabecera, cada mes y su detalle: alinea las tres. */
const COLUMNAS = "grid-cols-[3rem_repeat(3,minmax(0,1fr))_1rem] gap-x-3 md:grid-cols-[5rem_repeat(3,minmax(0,1fr))_1rem] md:gap-x-10";

function Cifra({ red, p, clase = "", claseUnidad = "" }: { red: RedDelAno; p: PublicacionDelMes; clase?: string; claseUnidad?: string }) {
  const n = cifra(red, p);
  const [uno, varios] = unidad(red, p);
  return <span className={`font-mono tabular-nums ${clase}`}>{numero(n)} <span className={`font-sans text-tinta-meta ${claseUnidad}`}>{pluralizar(n, uno, varios)}</span></span>;
}

/** La cifra ya escrita, para la hoja: «296,500 vistas». */
function cifraEscrita(red: RedDelAno, p: PublicacionDelMes): string {
  const n = cifra(red, p);
  return `${numero(n)} ${pluralizar(n, ...unidad(red, p))}`;
}

function Titulo({ p, clase }: { p: PublicacionDelMes; clase: string }) {
  return (
    <a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className={`${ENLACE} ${clase}`}>
      {p.titulo || "Sin texto"}
      <Abrir size={12} aria-hidden className="ml-1 inline align-baseline text-tinta-meta" />
    </a>
  );
}

/** Lo más visto del año: una por red. La respuesta va antes que el detalle. */
function DelAno({ ano }: { ano: AnoEnRedes }) {
  return (
    <ul className="grid gap-x-10 gap-y-10 md:grid-cols-3">
      {REDES_DEL_ANO.map((red) => {
        const todas = ano.meses.flatMap((m) => (m.redes[red] ?? []).map((p) => ({ p, mes: m.mes })));
        const mejor = todas.reduce<(typeof todas)[number] | null>((a, b) => (a === null || cifra(red, b.p) > cifra(red, a.p) ? b : a), null);
        return (
          <li key={red} className="grid content-start gap-3 border-t border-filo pt-5">
            <p className="text-meta text-tinta-meta">{NOMBRE[red]} · {DE_QUIEN[red]}</p>
            {ano.sin_dato.includes(red) || mejor === null ? (
              <p className="text-cuerpo text-tinta-meta">{ano.sin_dato.includes(red) ? "Sin dato." : VACIO[red]}</p>
            ) : (
              <>
                <Cifra red={red} p={mejor.p} clase="text-cifra text-tinta-titulo" claseUnidad="text-lectura" />
                <Titulo p={mejor.p} clase="line-clamp-3 text-balance text-lectura" />
                <p className="text-meta text-tinta-meta">
                  {mesLargo(mejor.mes)}{red === "tiktok" ? ` · ${mejor.p.cuenta}` : ""}
                </p>
                <BotonComentariosAno publicacion={{ ...mejor.p, red, cifra: cifraEscrita(red, mejor.p) }} />
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Un mes abierto: del #1 al #3 de cada red, con sus comentarios. */
function DetalleMes({ m, ano }: { m: AnoEnRedes["meses"][number]; ano: AnoEnRedes }) {
  return (
    // La rejilla de escritorio de COLUMNAS, escrita entera: Tailwind no ve una
    // clase armada en tiempo de ejecucion.
    <div className="al-abrir grid gap-8 pb-8 pt-2 md:grid-cols-[5rem_repeat(3,minmax(0,1fr))_1rem] md:gap-x-10">
      <span aria-hidden className="hidden md:block" />
      {REDES_DEL_ANO.map((red) => {
        const lista = m.redes[red];
        return (
          <section key={red} aria-label={`${NOMBRE[red]}, ${mesLargo(m.mes)}`} className="grid content-start gap-4">
            <p className="text-meta text-tinta-meta md:hidden">{NOMBRE[red]}</p>
            {ano.sin_dato.includes(red) || lista === undefined ? (
              <p className="text-meta text-tinta-meta">Sin dato.</p>
            ) : lista.length === 0 ? (
              <p className="text-meta text-tinta-meta">{VACIO[red]}</p>
            ) : (
              <ol className="grid gap-5">
                {lista.map((p, i) => (
                  <li key={p.url} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2">
                    <span className="pt-px font-mono text-meta tabular-nums text-tinta-inerte">{i + 1}</span>
                    <div className="grid min-w-0 gap-1.5">
                      <Titulo p={p} clase="line-clamp-3 text-cuerpo" />
                      <p className="text-meta">
                        <Cifra red={red} p={p} clase="text-tinta-dato" />
                        {red === "tiktok" ? <span className="text-tinta-meta"> · {p.cuenta}</span> : null}
                      </p>
                      <BotonComentariosAno publicacion={{ ...p, red, cifra: cifraEscrita(red, p) }} />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** La celda de un mes y una red en el renglon cerrado: barra y cifra del #1. */
function Celda({ red, p, tope, pico, sinDato }: { red: RedDelAno; p: PublicacionDelMes | undefined; tope: number; pico: boolean; sinDato: boolean }) {
  if (sinDato) return <span className="text-meta text-tinta-meta">Sin dato</span>;
  if (p === undefined) return <span className="text-meta text-tinta-inerte">—<span className="sr-only">{VACIO[red]}</span></span>;
  const n = cifra(red, p);
  return (
    <span className="grid min-w-0 gap-1.5">
      <span aria-hidden><Barra fraccion={tope > 0 ? n / tope : 0} color={pico ? undefined : "var(--color-realce)"} /></span>
      <span className="font-mono text-meta tabular-nums text-tinta-dato">
        <span className="sr-only">{NOMBRE[red]}: </span>{numero(n)}<span className="sr-only"> {pluralizar(n, ...unidad(red, p))}</span>
      </span>
      {/* Abierto el mes, el titulo ya esta abajo con su enlace: aqui sobraria. */}
      <span className="hidden truncate text-meta text-tinta-meta md:block md:group-open/mes:invisible">{p.titulo}</span>
    </span>
  );
}

function PorMes({ ano }: { ano: AnoEnRedes }) {
  const meses = [...ano.meses].reverse();
  const tope = Object.fromEntries(REDES_DEL_ANO.map((red) => [red, Math.max(0, ...ano.meses.flatMap((m) => (m.redes[red] ?? []).slice(0, 1).map((p) => cifra(red, p))))])) as Record<RedDelAno, number>;
  return (
    <Bisel interior="px-5 py-6 sm:px-8 sm:py-8">
      <div className={`grid ${COLUMNAS} mb-4 text-meta text-tinta-meta`} aria-hidden>
        <span />
        {REDES_DEL_ANO.map((red) => <span key={red} className="truncate">{NOMBRE[red]}<span className="hidden md:inline"> · {UNIDAD[red][1]}</span></span>)}
        <span />
      </div>
      <ol className="grid">
        {meses.map((m) => (
          <li key={m.mes} className="border-t border-vela">
            <details className="pliegue group/mes">
              {/* El renglon con la misma gramatica que «Hasta donde llego cada
                  historia»: sangrado negativo para que el fondo del hover no
                  pegue el texto al borde, y la cifra del #1 de cada red. */}
              <summary className={`${SUMARIO} -mx-3 grid ${COLUMNAS} items-center rounded-nucleo px-3 py-4 transition-colors duration-[var(--dur-toque)] hover:bg-vela`}>
                <span className="grid">
                  <span className="text-cuerpo font-medium text-tinta-titulo first-letter:uppercase">{mesCorto(m.mes)}</span>
                  <span className="font-mono text-meta tabular-nums text-tinta-meta">{m.mes.slice(0, 4)}</span>
                  <span className="sr-only">: lo más visto de cada red</span>
                </span>
                {REDES_DEL_ANO.map((red) => {
                  const p = m.redes[red]?.[0];
                  const pico = p !== undefined && cifra(red, p) === tope[red];
                  return <Celda key={red} red={red} p={p} tope={tope[red]} pico={pico} sinDato={ano.sin_dato.includes(red) || m.redes[red] === undefined} />;
                })}
                <Desplegar size={16} aria-hidden className="text-tinta-meta transition-transform duration-[var(--dur-toque)] group-open/mes:rotate-180 group-hover/mes:text-tinta-titulo" />
              </summary>
              <DetalleMes m={m} ano={ano} />
            </details>
          </li>
        ))}
      </ol>
      <p className="mt-4 flex items-center gap-2 border-t border-vela pt-4 text-meta text-tinta-meta">
        <span aria-hidden className="inline-block h-[7px] w-5 rounded-full bg-chart-1" />
        Lo más visto del año en cada red. Cada barra se mide contra el pico de su red.
      </p>
    </Bisel>
  );
}

export function ReporteRedes({ id, ano }: { id: string; ano: AnoEnRedes }) {
  return (
    <ProveedorHojaAno expediente={id} salvedad={ano.salvedad_tono}>
      <div className="grid gap-16">
      <p className="max-w-[65ch] text-lectura text-tinta-prosa">
        En sus cuentas y en los videos de TikTok que lo nombran. Cada red se mide con su propia cifra y no se suman.
      </p>
      <section aria-labelledby="ano-del-ano" className="grid gap-6">
        <h3 id="ano-del-ano" className="text-rotulo text-tinta-titulo">Lo más visto del año</h3>
        <DelAno ano={ano} />
      </section>
      <section aria-labelledby="ano-por-mes" className="grid gap-6">
        <h3 id="ano-por-mes" className="text-rotulo text-tinta-titulo">Mes por mes</h3>
        <PorMes ano={ano} />
      </section>
      <p className="max-w-[65ch] border-t border-vela pt-6 text-meta text-tinta-meta">{ano.salvedad_tono}</p>
    </div>
    </ProveedorHojaAno>
  );
}
