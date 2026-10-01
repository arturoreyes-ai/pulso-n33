"use client";

import { ArrowUpRight } from "@phosphor-icons/react";
import { useId, useMemo, useState, type ReactNode } from "react";

import { clasesBoton } from "@/components/ui/clases";
import { EstadoCarga } from "@/components/ui/estado-carga";
import { FilaPestanas } from "@/components/ui/pestanas";
import type { Entrada } from "@/lib/busqueda/capitulos";
import { useBusquedaViva } from "@/lib/busqueda/use-busqueda";
import { usePublicacionesBusqueda } from "@/lib/busqueda/use-publicaciones-busqueda";
import { fechaConAnio, numero } from "@/lib/dominio/formato";
import { NOMBRE_RED } from "@/lib/dominio/publicaciones";
import type { ZonaRuta } from "@/lib/dominio/zonas";

/**
 * Los resultados de UNA busqueda, los mismos en la portada, en Redes y en
 * /reportes: noticias y publicaciones lado a lado, nunca sumadas (regla 3).
 *
 * EL CASO, 30 de septiembre de 2026: la portada buscaba solo titulares, una
 * tarjeta por pantalla, y Redes abria la ficha de tono de un termino con la
 * busqueda pagada detras de un boton; /reportes, que habia salido el dia
 * anterior, mostraba las dos cosas en una lista. El cliente pidio que las
 * tres buscaran igual y eligio la de /reportes, sin la ficha. Antes de esto la
 * lista vivia en components/reportes/resultados-reportes.tsx.
 *
 * Las noticias siguen la entrada de quien busca (use-busqueda.ts: /tijuana
 * busca en Tijuana, `?e=mexico` en Mexico); las publicaciones no, porque un
 * termino no es un lugar y el recorte por lugar es del lector, no de la
 * busqueda. Nada de esto pide cosechas pagadas.
 */

export const VISTAS_BUSQUEDA = [{ id: "todo", nombre: "Todo" }, { id: "noticias", nombre: "Noticias" }, { id: "publicaciones", nombre: "Publicaciones" }] as const;
export type VistaBusqueda = (typeof VISTAS_BUSQUEDA)[number]["id"];

export function PestanasBusqueda({ vista, onVista }: { vista: VistaBusqueda; onVista: (v: VistaBusqueda) => void }) {
  return (
    <FilaPestanas etiqueta="Tipo de resultado" pestanas={VISTAS_BUSQUEDA.map((v) => ({ id: v.id, nombre: v.nombre, activa: v.id === vista, onElegir: () => onVista(v.id) }))} />
  );
}

/** La vista sobrevive a cambiar de termino y de pagina, como la pestana de
 *  Redes: quien lee solo noticias no tiene que volver a elegirlo. */
let ultimaVista: VistaBusqueda = "todo";

export function useVistaBusqueda(): [VistaBusqueda, (v: VistaBusqueda) => void] {
  const [vista, setVista] = useState<VistaBusqueda>(() => ultimaVista);
  return [vista, (v) => {
    ultimaVista = v;
    setVista(v);
  }];
}

function Resultado({ titulo, url, fuente, fecha, plataforma }: {
  titulo: string; url: string; fuente: string; fecha: string | null; plataforma?: string;
}) {
  // El enlace se describe con su titular: sin eso, la lista de enlaces de un
  // lector de pantalla era «Abrir en Zeta» repetido, sin saber cual es cual.
  const idTitulo = useId();
  return (
    <li className="border-b border-vela py-5 first:pt-0 last:border-0">
      <p className="mb-2 flex flex-wrap gap-x-2 text-meta text-tinta-meta">
        <span>{plataforma === undefined ? fuente : `${plataforma} · ${fuente}`}</span>
        <span aria-hidden>·</span>
        {fecha ? <time dateTime={fecha}>{fechaConAnio(fecha.slice(0, 10))}</time> : <span>Sin fecha</span>}
      </p>
      <h4 id={idTitulo} className="break-words text-lectura text-tinta-titulo">{titulo || "Publicación sin título"}</h4>
      <a href={url} target="_blank" rel="noopener noreferrer nofollow" aria-describedby={idTitulo} className="mt-3 inline-flex min-h-11 items-center gap-2 text-cuerpo text-tinta-dato underline decoration-filo underline-offset-4 hover:decoration-tinta-dato">
        Abrir en {plataforma ?? fuente}<ArrowUpRight size={16} aria-hidden />
      </a>
    </li>
  );
}

function Grupo({ titulo, cantidad, children }: { titulo: string; cantidad: number | null; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <h3 className="mb-6 flex items-baseline justify-between gap-4 border-b border-filo pb-4 text-rotulo text-tinta-titulo">
        {titulo}{cantidad === null ? null : <span className="font-mono text-cuerpo tabular-nums text-tinta-meta">{numero(cantidad)}</span>}
      </h3>
      {children}
    </section>
  );
}

/** Las publicaciones que se ven al abrir y cuantas mas trae cada «Ver más». */
const POR_VEZ = 20;

/** Cada fuente conserva sus fallos y su fecha: una red que no cargo se dice
 *  por nombre y no se cuenta como cero. */
export function ResultadosBusqueda({ consulta, vista, zona = null, entrada }: {
  consulta: string;
  vista: VistaBusqueda;
  /** El lugar de las noticias. Sin el, el corredor, como /reportes y Redes. */
  zona?: ZonaRuta | null;
  entrada?: Entrada;
}) {
  const noticias = useBusquedaViva(consulta, zona, entrada);
  const { filas, cargando, fallidas, disponibles } = usePublicacionesBusqueda(consulta);
  const [limite, setLimite] = useState(POR_VEZ);
  const [reintentando, setReintentando] = useState(false);
  async function reintentar() {
    setReintentando(true);
    try {
      await Promise.all(fallidas.map((r) => r.mutate()));
    } finally {
      setReintentando(false);
    }
  }
  // Un mismo enlace puede llegar dos veces (el buscador del medio y el
  // archivo): se muestra una. El caso, 30 de septiembre de 2026, una nota de
  // El Imparcial repetida en «sheinbaum», con la llave de React duplicada.
  const titulares = useMemo(() => {
    const vistos = new Set<string>();
    return noticias.resultados.filter((n) => !vistos.has(n.url) && Boolean(vistos.add(n.url)));
  }, [noticias.resultados]);

  return (
    <div className={vista === "todo" ? "grid gap-10 lg:grid-cols-2 lg:gap-12" : "max-w-[64rem]"}>
      {vista === "publicaciones" ? null : (
        <Grupo titulo="Noticias" cantidad={noticias.cargando || noticias.fallo || !noticias.activa ? null : titulares.length}>
          {noticias.cargando ? <EstadoCarga etiqueta="Buscando noticias" /> : null}
          {noticias.fallo ? <div role="status" className="mb-4 grid justify-items-start gap-2"><p className="text-cuerpo text-baja">No se pudieron cargar todas las noticias.</p><button type="button" disabled={noticias.actualizando} className={clasesBoton(false)} onClick={() => void noticias.actualizar()}>{noticias.actualizando ? "Buscando…" : "Reintentar"}</button></div> : !noticias.activa ? <p role="status" className="text-cuerpo text-tinta-meta">La búsqueda de noticias no está disponible por ahora.</p> : null}
          {noticias.avisoActualizacion ? <p role="status" className="mb-4 text-cuerpo text-tinta-meta">{noticias.avisoActualizacion}</p> : null}
          {noticias.caidos.length > 0 && !noticias.fallo ? <p className="mb-4 text-cuerpo text-tinta-meta">Algunas fuentes de noticias no respondieron. Se muestran los resultados disponibles.</p> : null}
          <ul>{titulares.map((n) => <Resultado key={n.url} titulo={n.titulo} url={n.url} fuente={n.medio} fecha={n.publicado} />)}</ul>
          {!noticias.cargando && noticias.activa && !noticias.fallo && titulares.length === 0 ? <p className="text-cuerpo text-tinta-meta">No se encontraron noticias para este término. Prueba con otro nombre o una frase más corta.</p> : null}
          {noticias.truncada ? <p className="mt-4 text-meta text-tinta-meta">Se muestra una selección de resultados. Precisa el término para acotar la búsqueda.</p> : null}
        </Grupo>
      )}
      {vista === "noticias" ? null : (
        <Grupo titulo="Publicaciones" cantidad={cargando || disponibles.length === 0 ? null : filas.length}>
          {cargando ? <EstadoCarga etiqueta="Buscando publicaciones" /> : null}
          {fallidas.length === 0 ? null : <div role="status" className="mb-4 grid justify-items-start gap-2"><p className="text-cuerpo text-baja">No se pudieron cargar las publicaciones de {fallidas.map((r) => r.nombre).join(", ")}.</p><button type="button" disabled={reintentando} className={clasesBoton(false)} onClick={() => void reintentar()}>{reintentando ? "Buscando…" : "Reintentar"}</button></div>}
          <ul>{filas.slice(0, limite).map((f) => <Resultado key={f.clave} titulo={f.post.titulo} url={f.url ?? f.post.url} fuente={f.fuente} plataforma={NOMBRE_RED[f.red]} fecha={f.post.publicado ?? f.post.fecha} />)}</ul>
          {!cargando && disponibles.length > 0 && filas.length === 0 ? <p className="text-cuerpo text-tinta-meta">No hay coincidencias en el texto de las publicaciones disponibles. Prueba con una frase más corta.</p> : null}
          {filas.length > limite ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <button type="button" className={clasesBoton(false)} onClick={() => setLimite((n) => n + POR_VEZ)}>Ver {numero(Math.min(POR_VEZ, filas.length - limite))} más</button>
              <p className="text-meta tabular-nums text-tinta-meta">{numero(limite)} de {numero(filas.length)}</p>
            </div>
          ) : null}
          {disponibles.length === 0 ? null : <p className="mt-6 text-meta text-tinta-meta">Última lectura: {disponibles.map((r) => `${r.nombre}, ${fechaConAnio(r.data!.generado.slice(0, 10))}`).join(" · ")}.</p>}
        </Grupo>
      )}
    </div>
  );
}
