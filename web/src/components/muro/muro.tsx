"use client";

import { useMemo } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";

import type { Ambito } from "@/lib/busqueda/ambito";
import { textoCaidos } from "@/lib/busqueda/avisos";
import { NOMBRE_RUBRO, type Rubro } from "@/lib/busqueda/rubros";
import { LARGO_MAXIMO_CONSULTA } from "@/lib/busqueda/tipos";
import { useRoster } from "@/lib/datos/hooks";
import { nombreDeFiltro } from "@/lib/dominio/delegaciones";
import { hora, numero, pluralizar } from "@/lib/dominio/formato";
import { indexarRoster } from "@/lib/dominio/roster";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";
import { limpiarTema } from "@/lib/muro/filtro-tema";
import { useMuro } from "@/lib/muro/use-muro";
import { Bisel } from "@/components/ui/bisel";
import { FilaExterna } from "./fila-externa";
import { GrupoZona } from "./grupo-zona";
import { MuroEsqueleto } from "./muro-esqueleto";
import { NotaFila } from "./nota-fila";
import { SelectorDelegacion } from "./selector-delegacion";
import { SelectorRubro } from "./selector-rubro";

/**
 * Cuantas filas abre cada grupo.
 *
 * En la vista regional hay NUEVE grupos a la vez, asi que el corte tiene que
 * dejar llegar a Tecate sin scrollear las 205 de Tijuana. En la pagina de una
 * zona hay un solo grupo y el corte puede ser mas generoso.
 */
const INICIAL_REGION = 6;
const INICIAL_ZONA = 25;
const PASO = 25;

type EstadoMuro = ReturnType<typeof useMuro>;

/** El sujeto de la cifra en modo actualidad: de que lista es, y de que rubro. */
function rotuloActualidad(ambito: Ambito, rubro: Rubro | null): string {
  const mexico = ambito === "mexico";
  if (rubro === null) return mexico ? "actualidad de México" : "actualidad internacional";
  return `«${NOMBRE_RUBRO[rubro]}» ${mexico ? "en México" : "en el mundo"}`;
}

/**
 * La linea de conteo, como una frase y no como cinco interpolaciones.
 *
 * Eran cinco expresiones seguidas en el JSX, tres de ellas ternarios, y para
 * saber que decia habia que armarla mentalmente.
 */
function textoConteo(m: EstadoMuro, sujeto: string | null): string {
  if (m.enActualidad) {
    const a = m.actualidad;
    if (a.cargando && a.resultados.length === 0) return "Cargando…";
    if (a.resultados.length === 0) return "Sin titulares";
    return `${numero(a.resultados.length)} en vivo · ${rotuloActualidad(m.ambito, m.rubro)}`;
  }
  // Buscando, la cifra se parte en dos y NO se suma en una sola: no es lo
  // mismo una nota clasificada por zona, tono y figura que un enlace traido
  // hace un segundo. Al lector se le dice cuantos son en vivo, que es la
  // pastilla que ya trae cada fila; antes decia "N del corpus", que es el
  // complemento y ademas una palabra del pipeline.
  if (m.buscando) {
    const n = numero(m.visibles);
    if (m.visibles === 0) return "Sin resultados";
    if (!m.usaCorpus) return `${n} en vivo`;
    const vivos = m.visibles - m.delCorpus;
    const cuenta = `${n} ${m.visibles === 1 ? "resultado" : "resultados"}`;
    return vivos > 0 ? `${cuenta} · ${numero(vivos)} en vivo` : cuenta;
  }
  const de = sujeto === null ? " de " : ` notas sobre ${sujeto} de `;
  const ventana = m.ventanaDias === null ? "" : ` en ${m.ventanaDias} días`;
  return `${numero(m.visibles)}${de}${numero(m.totalVentana)}${ventana}`;
}

/**
 * Por que no hay filas. Tres casos distintos, como guardas.
 *
 * Antes eran dos ternarios anidados, que es de donde salia la profundidad 3
 * del archivo: hay que leerlos de adentro hacia afuera para saber cual gana.
 */
function textoVacio(totalVentana: number, sujeto: string | null): string {
  if (totalVentana === 0) return "Todavía no hay titulares.";
  if (sujeto === null) return "Sin notas que coincidan con este filtro.";
  return `Sin notas sobre ${sujeto} que coincidan con este filtro.`;
}

/**
 * Barra de filtros. Sticky con blur: elemento fijo y area chica, que es el
 * caso donde el blur si esta permitido. Deja de ser sticky en movil porque
 * ocuparia media pantalla. La zona ya no se elige aqui: es la pagina, y el
 * alcance vive en el encabezado. Tampoco hay pastillas de orden desde el 11
 * de septiembre de 2026: "Antiguas" no tenia uso (ver use-muro.ts).
 *
 * `top` es `--nav-alto`, no un 24 a ojo: la barra atraca EXACTAMENTE contra
 * la pildora flotante. Con el 24 quedaba una banda de 20px entre las dos y
 * las filas pasaban por ahi a opacidad completa.
 */
function BarraFiltros({ m, sujeto }: { m: EstadoMuro; sujeto: string | null }) {
  return (
    <div className="sticky top-[var(--nav-alto)] z-[var(--z-elevado)] -mx-4 mb-6 border-b border-vela bg-carta/85 px-4 py-3 backdrop-blur-md md:-mx-8 md:px-8 max-sm:static max-sm:bg-transparent max-sm:backdrop-blur-none">
      <div className="flex flex-wrap items-center gap-3">
        {/* <search>, no un div con role="search": el elemento nativo ya trae
            el rol de referencia y la region queda anunciada sin ARIA. */}
        <search className="relative">
          <MagnifyingGlass
            size={14}
            weight="light"
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-meta"
          />
          <input
            type="search"
            value={m.consulta}
            onChange={(e) => m.setConsulta(e.target.value)}
            placeholder="Buscar titulares"
            aria-label="Buscar titulares"
            maxLength={LARGO_MAXIMO_CONSULTA}
            className="w-56 rounded-full border border-filo md:w-72 bg-vela py-2 pr-3 pl-8 text-cuerpo text-tinta-titulo placeholder:text-tinta-meta"
          />
        </search>

        {/* En Mexico e Internacional el muro ES la lista en vivo, y aqui van
            sus rubros: la misma pastilla que el panel de actualidad de las
            zonas, para que sea una sola implementacion en todo el tablero. */}
        {m.enActualidad ? <SelectorRubro activo={m.rubro} onElegir={m.elegirRubro} /> : null}

        {m.temaIds.size > 0 ? (
          <button
            type="button"
            onClick={limpiarTema}
            className="inline-flex items-center gap-1.5 rounded-full bg-chart-1/15 px-3 py-2 text-meta text-chart-1-texto transition-colors hover:bg-chart-1/25"
          >
            <X size={12} weight="light" aria-hidden />
            filtrado por tema
          </button>
        ) : null}

        {/* aria-live SOLO en la linea de conteo. Ponerlo en el muro
            anunciaria cientos de filas. */}
        <p aria-live="polite" className="ml-auto text-meta tabular-nums text-tinta-meta">
          {textoConteo(m, sujeto)}
        </p>
      </div>

      {/* Solo Tijuana se subdivide. La fila va junto a la lista que filtra,
          no en el encabezado, para que el efecto se vea donde se toca. Y solo
          con corpus: en Mexico e Internacional no hay notas que subdividir.

          El mapa de poligonos queda fuera POR AHORA: ver
          `mapa-delegaciones.tsx`, que sigue en el arbol sin consumidor. */}
      {m.conteoDelegaciones === null || !m.usaCorpus ? null : (
        <div className="mt-3">
          <SelectorDelegacion
            activa={m.delegacion}
            conteo={m.conteoDelegaciones}
            onElegir={m.elegirDelegacion}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Lo que hay que decir de la busqueda antes de las filas.
 *
 * Solo aparece cuando hay algo que declarar. Un hueco se rotula, no se
 * rellena: si la consulta en vivo se cayo, se dice, porque la cifra de arriba
 * seria mas corta de lo que deberia y no por falta de noticias.
 */
function AvisoBusqueda({ m }: { m: EstadoMuro }) {
  const v = m.vivo;
  const partes: string[] = [];

  if (v.fallo) {
    partes.push(
      "No se pudo completar la búsqueda en vivo; abajo solo está lo que ya estaba en la lista.",
    );
  } else {
    const caidos = textoCaidos(v.caidos);
    if (caidos !== null) partes.push(caidos);
  }
  if (v.suprimidas > 0) {
    partes.push(
      `${numero(v.suprimidas)} ${pluralizar(v.suprimidas, "resultado ya estaba", "resultados ya estaban")} en la lista.`,
    );
  }
  if (!m.usaCorpus) {
    partes.push("Fuera de la región, todo esto es en vivo.");
  }
  if (v.truncada) partes.push("Se muestran los más recientes.");

  if (partes.length === 0) return null;
  return <p className="mb-4 text-meta text-tinta-meta">{partes.join(" ")}</p>;
}

/**
 * La lista en modo busqueda: plana, por fecha, con el corpus y lo que llega en
 * vivo mezclados.
 *
 * Sin agrupar por zona a proposito. Buscando, la zona ya es el ambito de la
 * consulta, asi que agrupar por ella produciria un solo grupo con su titulo
 * repetido arriba de todo. La respuesta a una pregunta es una lista.
 */
function ListaBusqueda({
  m,
  roster,
}: {
  m: EstadoMuro;
  roster: ReturnType<typeof indexarRoster>;
}) {
  if (m.vivo.cargando && m.filas.length === 0) {
    return (
      <p aria-live="polite" className="py-16 text-center text-lectura text-tinta-prosa">
        Buscando…
      </p>
    );
  }
  if (m.filas.length === 0) {
    return (
      <>
        <AvisoBusqueda m={m} />
        <p className="py-16 text-center text-lectura text-tinta-prosa">
          Sin resultados para esta búsqueda.
        </p>
      </>
    );
  }
  return (
    <>
      <AvisoBusqueda m={m} />
      {m.filas.map((f) =>
        f.nota === undefined ? (
          <FilaExterna key={f.clave} r={f.externo} />
        ) : (
          <NotaFila key={f.clave} nota={f.nota} corte={m.corte} roster={roster} />
        ),
      )}
    </>
  );
}

/**
 * Lo que hay que decir de la actualidad antes de las filas. Siempre dice de
 * donde viene y que NO es: PRODUCT.md separa a proposito lo cosechado y
 * clasificado de lo que devuelve Google, y aqui todo es lo segundo.
 */
function AvisoActualidad({ m }: { m: EstadoMuro }) {
  const a = m.actualidad;
  const partes: string[] = [
    m.rubro === null
      ? "Titulares en vivo. No tienen zona, tono ni figura, y no cuentan en las cifras de prensa."
      : `Titulares en vivo de «${NOMBRE_RUBRO[m.rubro]}» ${m.ambito === "mexico" ? "en México" : "en el mundo"}, de los últimos dos días. No tienen zona, tono ni figura, y no cuentan en las cifras de prensa.`,
  ];

  if (a.fallo) {
    partes.push("No se pudo traer la actualidad en vivo.");
  } else {
    const caidos = textoCaidos(a.caidos);
    if (caidos !== null) partes.push(caidos);
  }
  if (a.truncada) partes.push(`Se muestran los primeros ${numero(a.resultados.length)}.`);
  if (a.consultado !== null) partes.push(`Actualizado a las ${hora(a.consultado)}.`);

  return <p className="mb-4 text-meta text-tinta-meta">{partes.join(" ")}</p>;
}

/**
 * La lista en modo actualidad: la seccion de Google, plana y en su orden.
 *
 * Sin `corte`: FilaExterna pone la hora absoluta, porque medir la edad contra
 * `estado.generado` daria edades negativas a titulares de hace diez minutos.
 */
function ListaActualidad({ m }: { m: EstadoMuro }) {
  const a = m.actualidad;
  if (!a.activa) {
    return (
      <p className="py-16 text-center text-lectura text-tinta-prosa">
        Los titulares en vivo no están disponibles en esta vista.
      </p>
    );
  }
  if (a.cargando && a.resultados.length === 0) {
    return (
      <p aria-live="polite" className="py-16 text-center text-lectura text-tinta-prosa">
        Cargando la actualidad…
      </p>
    );
  }
  if (a.resultados.length === 0) {
    return (
      <>
        <AvisoActualidad m={m} />
        <p className="py-16 text-center text-lectura text-tinta-prosa">
          {m.rubro === null
            ? "Sin titulares destacados en este momento."
            : `Sin titulares de «${NOMBRE_RUBRO[m.rubro]}» en los últimos dos días.`}
        </p>
      </>
    );
  }
  return (
    <>
      <AvisoActualidad m={m} />
      {a.resultados.map((r) => (
        <FilaExterna key={r.url} r={r} />
      ))}
    </>
  );
}

/**
 * La lista, en el modo que toque.
 *
 * `pendiente` viene de useTransition: se atenua mientras el render ancho
 * corre, en vez de bloquear el control.
 */
function Lista({
  m,
  sujeto,
  roster,
  agrupado,
}: {
  m: EstadoMuro;
  sujeto: string | null;
  roster: ReturnType<typeof indexarRoster>;
  agrupado: boolean;
}) {
  return (
    <div
      data-pendiente={m.pendiente ? "" : undefined}
      className={`transition-opacity duration-[var(--dur-cambio)] ease-firma ${
        m.pendiente ? "opacity-60" : "opacity-100"
      }`}
    >
      {m.modo === "busqueda" ? (
        <ListaBusqueda m={m} roster={roster} />
      ) : m.modo === "actualidad" ? (
        <ListaActualidad m={m} />
      ) : m.grupos.length === 0 ? (
        <p className="py-16 text-center text-lectura text-tinta-prosa">
          {textoVacio(m.totalVentana, sujeto)}
        </p>
      ) : (
        m.grupos.map((g) => (
          <GrupoZona
            key={g.zona}
            grupo={g}
            corte={m.corte}
            roster={roster}
            conCabecera={agrupado}
            inicial={agrupado ? INICIAL_REGION : INICIAL_ZONA}
            paso={PASO}
          />
        ))
      )}
    </div>
  );
}

/**
 * Lo que NO esta en el muro, dicho en el muro. Las dos exclusiones van en el
 * mismo pie porque las dos contestan la misma pregunta: por que la cifra de
 * arriba no llega al total de la ventana.
 *
 * Solo en la vista regional: en la pagina de una zona, "fuera de la region"
 * no es una categoria que signifique nada. Y solo con corpus: en Mexico e
 * Internacional las dos exclusiones hablan de una lista que no se esta viendo.
 */
function PieExclusiones({ m, agrupado }: { m: EstadoMuro; agrupado: boolean }) {
  if (!agrupado || !m.usaCorpus) return null;
  if (m.fuera === 0 && m.nacionales === 0) return null;
  return (
    <p className="mt-10 border-t border-vela pt-5 text-meta text-tinta-prosa">
      {m.fuera > 0 ? (
        <>
          {numero(m.fuera)} notas de fuera de la región no se muestran aquí.{" "}
        </>
      ) : null}
      {m.nacionales > 0 ? (
        <>
          {numero(m.nacionales)} notas nacionales no se muestran aquí.
        </>
      ) : null}
    </p>
  );
}

export function Muro({ zona }: { zona: ZonaRuta | null }) {
  const m = useMuro(zona);
  const { data: rosterDoc } = useRoster();
  const roster = useMemo(() => indexarRoster(rosterDoc), [rosterDoc]);

  if (m.error !== undefined) {
    return (
      <p className="text-lectura text-baja">No se pudieron cargar los titulares.</p>
    );
  }
  if (m.cargando) return <MuroEsqueleto />;

  const nombre = zona === null ? null : NOMBRE_CORTO[zona];
  // Con delegacion activa la linea de conteo dice cual; sin ella, la zona.
  const sujeto = m.delegacion === null ? nombre : nombreDeFiltro(m.delegacion);
  const agrupado = zona === null;

  return (
    <Bisel interior="p-4 md:p-8">
      <BarraFiltros m={m} sujeto={sujeto} />
      <Lista m={m} sujeto={sujeto} roster={roster} agrupado={agrupado} />
      <PieExclusiones m={m} agrupado={agrupado} />
    </Bisel>
  );
}
