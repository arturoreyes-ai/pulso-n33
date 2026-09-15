"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { clasesChip } from "@/components/ui/clases";
import { debeActivar, fraseFinal, type Entrada } from "@/lib/busqueda/capitulos";
import { imagenPara, indiceDeImagenes } from "@/lib/busqueda/imagenes";
import { useCapitulos } from "@/lib/busqueda/use-capitulos";
import { useNotas } from "@/lib/datos/hooks";
import { NOMBRE_CORTO, ZONAS_RUTA } from "@/lib/dominio/zonas";
import { reiniciarLlegada, useLlegada, useMemoriaLlegada, useRecorrido, type MemoriaLlegada } from "@/lib/pantalla/recorrido";
import { EsqueletoTitular, TarjetaDivisor, TarjetaFinal, TarjetaHueco, TarjetaTitular } from "./tarjetas-ahora";

/**
 * El recorrido de titulares en vivo: un titular por pantalla.
 *
 * La entrada —un lugar, Mexico o Internacional— es estado de cliente y no
 * ruta: decide el primer capitulo y acota los cinco rubros; las otras dos
 * secciones vienen despues en todos los casos. Cambiarla remonta el recorrido
 * con otra llave, que es lo que descongela las listas y vuelve a la primera
 * tarjeta.
 *
 * Los capitulos se piden de a uno, con uno adelantado, cuando el lector se
 * acerca al final de lo que hay (capitulos.ts::debeActivar). Es el
 * `rootMargin` de WikiTok, pero sobre una cadena finita y ordenada, no sobre
 * un pozo aleatorio.
 *
 * La barra Anterior / Siguiente y el «n de M» son los del visor de redes; el
 * ajuste al desplazar y la llegada en el telefono son el mismo hook.
 */

/** El corredor, las ocho zonas y las dos ediciones. Las ediciones van al
 *  final y separadas por un filo: son otra escala, no otro municipio. */
const OPCIONES: readonly Entrada[] = ["region", ...ZONAS_RUTA, "mexico", "internacional"];

function nombreDe(entrada: Entrada): string {
  if (entrada === "region") return "Toda la región";
  if (entrada === "mexico") return "México";
  if (entrada === "internacional") return "Internacional";
  return NOMBRE_CORTO[entrada];
}

export function FeedAhora() {
  const [entrada, setEntrada] = useState<Entrada>("region");
  const [generacion, setGeneracion] = useState(0);
  const memoria = useMemoriaLlegada();
  function recargar() {
    reiniciarLlegada(memoria);
    setGeneracion((g) => g + 1);
  }
  return (
    <>
      <div role="group" aria-label="Por dónde empezar" className="-mx-4 px-4 md:mx-0 md:px-0">
        <ul className="flex snap-x items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible">
          {OPCIONES.map((e) => (
            <li key={e} className={`shrink-0 snap-start ${e === "mexico" ? "ml-2 border-l border-filo pl-3.5" : ""}`}>
              <button type="button" className={clasesChip(e === entrada)} aria-pressed={e === entrada} onClick={() => setEntrada(e)}>
                {nombreDe(e)}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <RecorridoAhora key={`${entrada}:${generacion}`} entrada={entrada} memoria={memoria} onRecargar={recargar} />
    </>
  );
}

function RecorridoAhora({ entrada, memoria, onRecargar }: { entrada: Entrada; memoria: MemoriaLlegada; onRecargar: () => void }) {
  const [activados, setActivados] = useState(1);
  const { capitulos, hilado, disponible, hayNuevos } = useCapitulos(entrada, activados);
  // Las miniaturas vienen del corpus, no de la fila en vivo. El recorrido no
  // espera a notas.json: las figuras aparecen cuando llega, y una tarjeta ya
  // mide la pantalla con o sin ellas.
  const notas = useNotas();
  const imagenes = useMemo(() => indiceDeImagenes(notas.data?.notas ?? []), [notas.data]);
  const contenedor = useRef<HTMLDivElement>(null);
  const { actual, ir } = useRecorrido(contenedor);
  useLlegada(contenedor, hilado.tarjetas.length > 0, memoria);
  useEffect(() => {
    // Idempotente a proposito: en desarrollo StrictMode corre el efecto dos
    // veces con el mismo cierre, y `a + 1` dos veces pedia tres capitulos al
    // abrir en vez de dos.
    if (!debeActivar(hilado, actual, activados)) return;
    const siguiente = activados + 1;
    setActivados((a) => Math.max(a, siguiente));
  }, [hilado, actual, activados]);

  if (!disponible) {
    return <p className="mt-6 text-lectura text-tinta-prosa">Los titulares en vivo no están disponibles en esta vista.</p>;
  }

  const { tarjetas, completo } = hilado;
  const total = tarjetas.length + (completo ? 1 : 0);
  return (
    <>
      {hayNuevos ? (
        <p role="status" className="mt-4 flex flex-wrap items-center gap-3 text-cuerpo text-tinta-meta">
          Hay titulares nuevos.
          <button type="button" className={clasesChip(false)} onClick={onRecargar}>Recargar</button>
        </p>
      ) : null}
      <div className="sticky top-[var(--nav-alto)] z-[var(--z-elevado)] my-6 hidden flex-wrap items-center justify-between gap-3 bg-vanta py-3 md:flex" aria-label="Recorrer titulares">
        <button type="button" className={`${clasesChip(false)} disabled:opacity-50`} disabled={actual === 0} onClick={() => ir(actual - 1)}>Anterior</button>
        <p aria-live="polite" className="text-cuerpo tabular-nums text-tinta-meta">{Math.min(actual + 1, Math.max(total, 1))} de {total}</p>
        <button type="button" className={`${clasesChip(false)} disabled:opacity-50`} disabled={total === 0 || actual >= total - 1} onClick={() => ir(actual + 1)}>Siguiente</button>
      </div>
      <div ref={contenedor} className="recorrido-visual">
        {tarjetas.map((t, i) => {
          if (t.tipo === "titular") return <TarjetaTitular key={t.clave} t={t} titulares={hilado.titulares} indice={i} imagen={imagenPara(t.r, imagenes)} />;
          if (t.tipo === "divisor") return <TarjetaDivisor key={`divisor:${t.capitulo}`} t={t} indice={i} />;
          return <TarjetaHueco key={`hueco:${t.capitulo}`} t={t} indice={i} />;
        })}
        {completo
          ? <TarjetaFinal indice={tarjetas.length} frase={fraseFinal(capitulos, hilado)} onInicio={() => ir(0)} />
          : <>
              <EsqueletoTitular />
              <p role="status" className="sr-only">Cargando titulares…</p>
            </>}
      </div>
    </>
  );
}
