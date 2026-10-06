import { ArrowLeft as Volver } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";

import { Bisel } from "@/components/ui/bisel";
import { clasesBoton, clasesInsignia } from "@/components/ui/clases";
import { Barra } from "@/components/ui/primitivas";
import { BotonPdf } from "@/components/ui/boton-pdf";
import { rutaDelPdf, type Expediente, type Historia, type Segmento } from "@/lib/expedientes/expedientes";
import { MESES_CORTOS, fechaConAnio, numero } from "@/lib/dominio/formato";
import { ReporteRedes } from "./reporte-redes";

/**
 * Un expediente (lib/expedientes/expedientes.ts) en pantalla. Componente de
 * servidor de punta a punta: el JSON no viaja al navegador y lo unico
 * interactivo son los `<details>` nativos de cada lista de titulares.
 *
 * La lectura va en un orden fijo y en bandas a todo lo ancho: en corto,
 * alcance, cuando, las historias ordenadas por polemica y alcance, lo menor,
 * y redes. Hasta el 2 de octubre de 2026 el alcance vivia en una columna
 * lateral fija y la pagina se leia apretada (cliente): titulo, barra y
 * cifras en 21rem, y «En corto» como un muro de parrafos. Ahora cada banda
 * tiene su ancho y el aire entre bandas es varias veces el de dentro.
 *
 * Sin tono en ninguna parte (regla 5) y sin porcentajes: con 26 medios en una
 * historia y 1 en otra, una proporcion diria mas de lo que se midio.
 */

const ENLACE = "text-tinta-dato underline decoration-filo underline-offset-[3px] transition-colors duration-[var(--dur-toque)] hover:text-tinta-titulo hover:decoration-realce";

function Texto({ segmentos }: { segmentos: readonly Segmento[] }) {
  return segmentos.map((s, i) => {
    if (typeof s === "string") return s;
    if (s.url !== undefined) return <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className={ENLACE}>{s.t}</a>;
    return <strong key={i} className="font-medium text-tinta-titulo">{s.t}</strong>;
  });
}

function Seccion({ id, titulo, children, className = "" }: { id: string; titulo: string; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={`min-w-0 scroll-mt-[var(--respiro-superior)] ${className}`}>
      <h2 id={id} className="mb-8 text-balance font-titular text-seccion text-tinta-titulo md:mb-10">{titulo}</h2>
      {children}
    </section>
  );
}

/** Titulares por mes. Columnas y no una linea: son conteos de meses
 *  distintos, no una serie continua, y el tramo de polemica se lee dentro de
 *  su mes. La escala es una sola para las trece columnas. */
function PorMes({ meses }: { meses: Expediente["meses"] }) {
  const tope = Math.ceil(Math.max(...meses.map((m) => m.titulares)) / 20) * 20;
  const ultimo = meses.at(-1)?.mes;
  return (
    <figure className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-meta text-tinta-meta" aria-hidden>
        <li className="inline-flex items-center gap-2"><span className="inline-block size-2 rounded-full bg-realce" />Titulares que lo nombran</li>
        <li className="inline-flex items-center gap-2"><span className="inline-block size-2 rounded-full bg-chart-1" />De ellos, sobre las polémicas</li>
      </ul>
      <div className="overflow-x-auto">
        <ol className="grid min-w-[34rem] grid-cols-[repeat(13,minmax(0,1fr))] gap-2" aria-label={`Titulares por mes, de ${fechaConAnio(meses[0]?.mes + "-01")} a ${fechaConAnio(ultimo + "-01")}`}>
          {meses.map((m) => {
            const indice = Number(m.mes.slice(5, 7)) - 1;
            const nombre = MESES_CORTOS[indice] ?? m.mes;
            const anio = indice === 0 || m === meses[0] ? m.mes.slice(0, 4) : "";
            return (
              <li key={m.mes} className="grid gap-2">
                {/* El conteo va encima de SU columna: posicionado sobre la
                    altura de la barra, no en una fila comun que lo separe. */}
                <div className="relative mt-6 h-48" aria-hidden>
                  <span className="absolute inset-x-0 bottom-0 flex flex-col justify-end overflow-hidden rounded-t-[0.25rem] bg-realce" style={{ height: `${(m.titulares / tope) * 100}%` }}>
                    <span className="block bg-chart-1" style={{ height: m.titulares === 0 ? 0 : `${(m.polemica / m.titulares) * 100}%` }} />
                  </span>
                  <span className="absolute inset-x-0 text-center font-mono text-meta tabular-nums text-tinta-dato" style={{ bottom: `calc(${(m.titulares / tope) * 100}% + 0.25rem)` }}>{m.titulares}</span>
                </div>
                <span className="text-center text-meta text-tinta-meta">
                  {nombre}{m.mes === ultimo ? "*" : ""}
                  <span className="block font-mono text-tinta-inerte">{anio}&nbsp;</span>
                </span>
                <span className="sr-only">{`${nombre} ${m.mes.slice(0, 4)}: ${m.titulares} titulares, ${m.polemica} sobre las polémicas`}</span>
              </li>
            );
          })}
        </ol>
      </div>
      <figcaption className="max-w-[65ch] text-meta text-tinta-meta">
        *Octubre de 2026 cubre dos días. Los titulares crecen en el año en parte porque fue candidato en todo el estado.
      </figcaption>
    </figure>
  );
}

/** El alcance de cada historia: medios en una escala comun. Banda propia y
 *  a todo lo ancho, con medios y nacionales en columnas separadas: en la
 *  columna lateral de 21rem que tuvo primero, titulo, barra y cifras se
 *  apretaban en tres renglones por fila. Cada fila sigue siendo el enlace a
 *  su historia. */
function Alcance({ historias }: { historias: readonly Historia[] }) {
  const escala = Math.ceil(Math.max(...historias.map((h) => h.medios)) / 10) * 10;
  return (
    <Bisel interior="px-5 py-6 sm:px-8 sm:py-8">
      <div className="mb-4 hidden grid-cols-[1.5rem_minmax(0,20rem)_minmax(0,1fr)_4.5rem_4.5rem] gap-x-6 text-meta text-tinta-meta md:grid" aria-hidden>
        <span />
        <span>Historia</span>
        <span>Medios, en una escala de 0 a {escala}</span>
        <span className="text-right">Medios</span>
        <span className="text-right">Nacionales</span>
      </div>
      <p className="mb-4 text-meta text-tinta-meta md:hidden">Medios que publicaron cada historia, en una escala de 0 a {escala}.</p>
      <ol className="grid">
        {historias.map((h, i) => (
          <li key={h.id} className="border-t border-vela">
            <a href={`#exp-${h.id}`} className="group -mx-3 grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-nucleo px-3 py-4 transition-colors duration-[var(--dur-toque)] hover:bg-vela md:grid-cols-[1.5rem_minmax(0,20rem)_minmax(0,1fr)_4.5rem_4.5rem] md:gap-x-6">
              <span className="font-mono text-meta tabular-nums text-tinta-inerte">{i + 1}</span>
              <span className="text-cuerpo text-tinta-prosa transition-colors group-hover:text-tinta-titulo">{h.titulo}</span>
              <span className="col-start-2 md:col-start-auto"><Barra fraccion={h.medios / escala} /></span>
              <span className="col-start-2 flex items-baseline gap-5 md:contents">
                <span className="font-mono text-cuerpo tabular-nums text-tinta-dato md:text-right">{h.medios}<span className="text-meta text-tinta-meta md:hidden"> medios</span></span>
                <span className="font-mono text-cuerpo tabular-nums text-tinta-meta md:text-right">{h.nacionales.length}<span className="text-meta md:hidden"> nacionales</span></span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </Bisel>
  );
}

function Cifras({ h }: { h: Historia }) {
  const filas = [
    { n: h.medios, dice: h.medios === 1 ? "medio" : "medios" },
    { n: h.nacionales.length, dice: h.nacionales.length === 1 ? "nacional" : "nacionales" },
    { n: h.titulares.length, dice: h.titulares.length === 1 ? "titular" : "titulares" },
  ];
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-2">
      {filas.map((f) => (
        <div key={f.dice} className="flex items-baseline gap-2">
          <dd className="font-mono text-lectura tabular-nums text-tinta-dato">{numero(f.n)}</dd>
          <dt className="text-meta text-tinta-meta">{f.dice}</dt>
        </div>
      ))}
    </dl>
  );
}

/** Una historia: el puesto en su propio margen (en el telefono, junto al
 *  titulo) y lo demas en una sola columna de lectura, con el aire repartido
 *  por funcion: poco entre titulo y cifras, mas antes del cuerpo y mas aun
 *  antes de la lista de titulares. */
function HistoriaExpediente({ h, puesto }: { h: Historia; puesto: number }) {
  const nacionales = new Set(h.nacionales);
  return (
    <article aria-labelledby={`exp-${h.id}`} className="grid gap-x-10 border-t border-vela pt-10 md:grid-cols-[4rem_minmax(0,1fr)]">
      <span aria-hidden className="hidden font-mono text-cifra tabular-nums text-tinta-inerte md:block">{puesto}</span>
      <div className="grid max-w-[46rem] gap-8">
        <header className="grid gap-4">
          <h3 id={`exp-${h.id}`} className="scroll-mt-[var(--respiro-superior)] text-balance font-titular text-rotulo text-tinta-titulo">
            <span className="mr-3 font-mono font-normal text-tinta-inerte md:sr-only">{puesto}</span>{h.titulo}
          </h3>
          <Cifras h={h} />
        </header>
        <div className="grid max-w-[65ch] gap-5 text-lectura text-tinta-prosa">
          {h.cuerpo.map((b, i) => "parrafo" in b ? (
            <p key={i}><Texto segmentos={b.parrafo} /></p>
          ) : (
            <ol key={i} className="my-2 grid gap-7 border-l border-filo pl-7">
              {b.oleadas.map((o) => (
                <li key={o.cuando} className="relative grid gap-2">
                  <span aria-hidden className="absolute -left-[2.1rem] top-[0.4rem] size-2 rounded-full bg-chart-1 ring-4 ring-carta" />
                  <span className="font-mono text-meta text-tinta-dato">{o.cuando}</span>
                  <span><Texto segmentos={o.texto} /></span>
                </li>
              ))}
            </ol>
          ))}
        </div>
        <details className="group">
          <summary className={`${clasesBoton(false)} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
            <span className="group-open:hidden">Ver los {h.titulares.length} titulares</span>
            <span className="hidden group-open:inline">Ocultar los titulares</span>
          </summary>
          <ol className="mt-6 grid">
            {h.titulares.map((t) => (
              <li key={t.url} className="grid gap-1 border-t border-vela py-4 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-5">
                <span className="font-mono text-meta tabular-nums text-tinta-meta sm:pt-px">{fechaConAnio(t.fecha)}</span>
                <span className="grid gap-1.5">
                  <a href={t.url} target="_blank" rel="noopener noreferrer nofollow" className="break-words text-cuerpo text-tinta-dato transition-colors duration-[var(--dur-toque)] hover:text-tinta-titulo hover:underline hover:decoration-realce hover:underline-offset-[3px]">{t.titulo}</a>
                  <span className="flex flex-wrap items-center gap-2 text-meta text-tinta-meta">
                    {t.medio}
                    {nacionales.has(t.medio) ? <span className={clasesInsignia("tenue")}>nacional</span> : null}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </details>
      </div>
    </article>
  );
}

/** Lo menor, con la gramatica de las listas de titulares de cada historia:
 *  fecha en su columna, el titular real enlazado y su medio debajo. Hasta el
 *  2 de octubre de 2026 eran parafrasis mezcladas con titulares entre
 *  comillas, en dos columnas de alturas disparejas. Van en orden de fecha. */
function Otros({ otros }: { otros: Expediente["otros"] }) {
  const ordenados = [...otros].sort((a, b) => a.fecha.localeCompare(b.fecha));
  return (
    <ol className="grid max-w-[52rem]">
      {ordenados.map((o) => (
        <li key={o.url} className="grid gap-2 border-t border-vela py-6 first:border-t-0 first:pt-0 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-6">
          <span className="font-mono text-meta tabular-nums text-tinta-meta sm:pt-1">{fechaConAnio(o.fecha)}</span>
          <div className="grid gap-2">
            <a href={o.url} target="_blank" rel="noopener noreferrer nofollow" className="text-balance text-lectura text-tinta-titulo transition-colors duration-[var(--dur-toque)] hover:underline hover:decoration-realce hover:underline-offset-[3px]">{o.titulo}</a>
            <p className="text-meta text-tinta-meta">{o.medio}</p>
            {o.detalle === null ? null : <p className="max-w-[60ch] text-cuerpo text-tinta-prosa">{o.detalle}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function VistaExpediente({ e }: { e: Expediente }) {
  const enHistorias = e.historias.reduce((n, h) => n + h.titulares.length, 0);
  const figuras = [
    { dice: "Titulares que lo nombran", valor: numero(e.titulares), cifra: true },
    { dice: "Medios", valor: numero(e.medios), cifra: true },
    ...(e.proximo === null ? [] : [{ dice: e.proximo.evento, valor: fechaConAnio(e.proximo.fecha), cifra: false }]),
  ];
  return (
    <div className="mx-auto w-full max-w-[88rem] px-4 pb-28 md:px-8">
      <div className="mb-10 flex flex-wrap items-start justify-between gap-3">
        <Link href="/reportes" className={clasesBoton(false)}><Volver size={16} aria-hidden /> Reportes</Link>
        <BotonPdf href={rutaDelPdf(e.id)} etiqueta="Descargar PDF" archivo={`pulso-expediente-${e.id}.pdf`} descripcion={`Descargar el expediente de ${e.persona} en PDF`} />
      </div>

      <header className="grid max-w-[56rem] gap-8 pb-20 md:pb-28">
        <div className="grid gap-6">
          <h1 className="text-balance font-titular text-hero text-tinta-titulo [font-stretch:112%]">{e.persona}</h1>
          <p className="max-w-[60ch] text-lectura text-tinta-prosa">
            Lo que más se publicó sobre el {e.cargo.charAt(0).toLowerCase() + e.cargo.slice(1)} entre el {fechaConAnio(e.desde)} y el {fechaConAnio(e.hasta)}: las historias que más medios llevaron, las polémicas detrás de ellas y lo que ya se ve en redes.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-12 gap-y-6 border-t border-vela pt-6 sm:grid-cols-[auto_auto_minmax(0,1fr)]">
          {figuras.map((f) => (
            <div key={f.dice} className={`grid content-start gap-2 ${f.cifra ? "" : "col-span-2 sm:col-span-1"}`}>
              <dt className="text-meta text-tinta-meta">{f.dice}</dt>
              <dd className={f.cifra ? "font-mono text-cifra tabular-nums text-tinta-titulo" : "text-rotulo text-tinta-dato"}>{f.valor}</dd>
            </div>
          ))}
        </dl>
      </header>

      {/* Bandas a todo lo ancho, una debajo de otra. El aire entre bandas es
          varias veces el de dentro de cada una: eso las separa, no un borde
          ni una tarjeta por seccion. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-24 md:gap-28">
        <Seccion id="exp-corto" titulo="En corto">
          <ul className="grid gap-x-12 gap-y-10 md:grid-cols-2 xl:grid-cols-4">
            {e.enCorto.map((punto, i) => (
              <li key={punto.titulo} className={`grid content-start gap-3 border-t pt-6 ${i === 0 ? "border-chart-1 md:col-span-2 xl:col-span-4" : "border-vela"}`}>
                <p className={`text-balance font-titular text-tinta-titulo ${i === 0 ? "text-rotulo" : "text-lectura font-medium"}`}>{punto.titulo}</p>
                <p className={`max-w-[65ch] text-tinta-prosa ${i === 0 ? "text-lectura" : "text-cuerpo"}`}><Texto segmentos={punto.texto} /></p>
              </li>
            ))}
          </ul>
        </Seccion>

        <Seccion id="exp-alcance" titulo="Hasta dónde llegó cada historia">
          <Alcance historias={e.historias} />
        </Seccion>

        <Seccion id="exp-cuando" titulo="Cuándo">
          <Bisel interior="px-5 py-6 sm:px-8 sm:py-8"><PorMes meses={e.meses} /></Bisel>
        </Seccion>

        <Seccion id="exp-historias" titulo="Las historias, por polémica y alcance">
          <p className="mb-12 max-w-[65ch] text-lectura text-tinta-prosa">
            Qué publicó cada medio y qué respondió él. Cuentan los titulares que lo nombran; {numero(e.titulares - enHistorias)} más son su agenda de gobierno y no se desglosan aquí.
          </p>
          <div className="grid gap-16">
            {e.historias.map((h, i) => <HistoriaExpediente key={h.id} h={h} puesto={i + 1} />)}
          </div>
        </Seccion>

        <Seccion id="exp-otros" titulo="Otros asuntos">
          <Otros otros={e.otros} />
        </Seccion>

        {/* «En redes» (las publicaciones de los medios desde el 14 de
            septiembre, leidas por /seguimiento) salio el 5 de octubre de
            2026: el cliente la dejo por «El año en redes», que es lo que se
            pidio. Su resumen por publicacion vive ahora en la hoja de cada
            publicacion del año. Sus lecturas siguen en /seguimiento. */}
        {e.ano === null ? null : (
          <Seccion id="exp-ano-redes" titulo="El año en redes">
            <ReporteRedes id={e.id} ano={e.ano} />
          </Seccion>
        )}

        <p className="max-w-[65ch] border-t border-vela pt-6 text-meta text-tinta-meta">
          Cuenta los medios que publicaron cada historia, no a quienes la leyeron. Varias historias descansan en un solo medio y se le atribuyen. Corte al {fechaConAnio(e.hasta)}.
        </p>
      </div>
    </div>
  );
}
