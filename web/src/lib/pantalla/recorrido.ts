"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { useEsMovil } from "./movil";

/**
 * El recorrido a pantalla completa: que tarjeta esta asentada, y la llegada.
 *
 * Nacio dentro del visor de redes (14 de septiembre de 2026) y salio de ahi
 * el mismo dia, cuando /ahora necesito exactamente lo mismo para titulares:
 * saber que tarjeta esta en pantalla cuando el desplazamiento ASIENTA, pasar
 * con Anterior / Siguiente, y colocar la primera tarjeta al llegar en el
 * telefono. Lo que es del medio —montar un solo iframe— se quedo en el visor.
 *
 * Contrato con el DOM: cada tarjeta lleva `data-indice="n"` y su
 * scroll-margin-top viene del CSS (`.publicacion-visual` en globals.css), que
 * es el UNICO lugar donde vive ese numero.
 */

/** Margen de ajuste de la primera tarjeta, leido del CSS en cada llamada: es
 *  distinto en telefono y en escritorio, y leerlo aqui en vez de repetir el
 *  numero hace que un cambio de ancho se recoja solo. */
function margenDeAjuste(raiz: HTMLElement): number {
  const primera = raiz.querySelector<HTMLElement>("[data-indice]");
  return primera ? parseFloat(getComputedStyle(primera).scrollMarginTop) || 0 : 0;
}

/** Indice de la tarjeta cuyo borde superior queda mas cerca del margen de
 *  ajuste, entre las que tocan la pantalla; null si ninguna la toca. */
function tarjetaMasCercana(raiz: HTMLElement): number | null {
  const margen = margenDeAjuste(raiz);
  const candidatas = [...raiz.querySelectorAll<HTMLElement>("[data-indice]")]
    .map((elemento) => ({ elemento, rectangulo: elemento.getBoundingClientRect() }))
    .filter(({ rectangulo }) => rectangulo.bottom > margen && rectangulo.top < window.innerHeight)
    .sort((a, b) => Math.abs(a.rectangulo.top - margen) - Math.abs(b.rectangulo.top - margen));
  const primera = candidatas[0];
  return primera ? Number(primera.elemento.dataset.indice) : null;
}

/** Sin eventos de scroll durante este tiempo se considera que el gesto
 *  termino. Safari no emite `scrollend`; donde existe, adelanta el asiento. */
const RETARDO_ASENTAR = 140;

export interface Recorrido {
  /** Indice asentado, desde 0. */
  actual: number;
  /** Alguna tarjeta toca la pantalla. */
  enPantalla: boolean;
  /** Ir a una tarjeta. Ese destino manda al asentar aunque no alcance el
   *  margen, que es lo que le pasa a la ultima. */
  ir: (indice: number) => void;
}

/** La tarjeta actual cambia cuando el desplazamiento ASIENTA, nunca a mitad
 *  del gesto: la que sale sigue viva mientras el dedo la arrastra y la que
 *  entra se da por llegada ya quieta en su sitio. Antes lo decidia un
 *  IntersectionObserver en cada umbral, y el medio saliente desaparecia con
 *  media tarjeta todavia en pantalla. Todo lo que se lee aqui sale del DOM o
 *  de refs, asi que no hay cierres viejos que arrastrar. */
export function useRecorrido(contenedor: RefObject<HTMLElement | null>): Recorrido {
  const objetivo = useRef<number | null>(null);
  const [actual, setActual] = useState(0);
  const [enPantalla, setEnPantalla] = useState(false);
  useEffect(() => {
    const raiz = contenedor.current;
    if (!raiz) return;
    let temporizador: number | undefined;
    const asentar = () => {
      window.clearTimeout(temporizador);
      let indice = tarjetaMasCercana(raiz);
      // Si el lector pulso Anterior / Siguiente, ese destino manda mientras
      // toque la pantalla: la ultima tarjeta puede no alcanzar el margen.
      if (objetivo.current !== null) {
        const pedido = raiz.querySelector<HTMLElement>(`[data-indice="${objetivo.current}"]`)?.getBoundingClientRect();
        if (pedido && pedido.bottom > 0 && pedido.top < window.innerHeight) indice = objetivo.current;
        objetivo.current = null;
      }
      setEnPantalla(indice !== null);
      if (indice !== null) setActual(indice);
    };
    const aplazar = () => {
      window.clearTimeout(temporizador);
      temporizador = window.setTimeout(asentar, RETARDO_ASENTAR);
    };
    window.addEventListener("scroll", aplazar, { passive: true });
    window.addEventListener("resize", aplazar);
    if ("onscrollend" in window) window.addEventListener("scrollend", asentar);
    asentar();
    return () => {
      window.clearTimeout(temporizador);
      window.removeEventListener("scroll", aplazar);
      window.removeEventListener("resize", aplazar);
      window.removeEventListener("scrollend", asentar);
    };
  }, [contenedor]);
  function ir(indice: number) {
    objetivo.current = indice;
    contenedor.current?.querySelector<HTMLElement>(`[data-indice="${indice}"]`)?.scrollIntoView({ behavior: "instant", block: "start" });
    setActual(indice);
  }
  return { actual, enPantalla, ir };
}

/** Lo que la llegada necesita recordar entre remontajes del recorrido: si ya
 *  se llego una vez y donde estaba la pagina al abrir. Vive en el componente
 *  que NO se remonta al cambiar de filtro o de lugar. */
export interface MemoriaLlegada {
  llegada: RefObject<boolean>;
  desplazamientoInicial: RefObject<number>;
}

export function useMemoriaLlegada(): MemoriaLlegada {
  const llegada = useRef(false);
  const desplazamientoInicial = useRef(0);
  useEffect(() => {
    desplazamientoInicial.current = window.scrollY;
  }, []);
  return { llegada, desplazamientoInicial };
}

/** Vuelve a permitir la llegada, desde donde este la pagina ahora. Para
 *  cuando el lector pide recargar el recorrido a proposito. */
export function reiniciarLlegada(memoria: MemoriaLlegada): void {
  memoria.llegada.current = false;
  memoria.desplazamientoInicial.current = window.scrollY;
}

/** Al llegar en el telefono, la primera tarjeta se coloca sola en su sitio en
 *  cuanto hay filas (`listo`): el lector empieza dentro del recorrido y el
 *  encabezado queda arriba, a un gesto. Una vez por memoria, nunca al cambiar
 *  de filtro, y nunca si el lector ya se movio mientras cargaba. */
export function useLlegada(contenedor: RefObject<HTMLElement | null>, listo: boolean, memoria: MemoriaLlegada): void {
  const esMovil = useEsMovil();
  const { llegada, desplazamientoInicial } = memoria;
  useEffect(() => {
    if (!esMovil || !listo || llegada.current) return;
    llegada.current = true; // una vez por memoria, nunca al cambiar de filtro
    const raiz = contenedor.current;
    const primera = raiz?.querySelector<HTMLElement>('[data-indice="0"]');
    if (!raiz || !primera) return;
    // No pelear con el lector: si ya se desplazo mientras cargaba, o si la
    // primera tarjeta ya esta en su sitio o mas arriba, la pagina es suya.
    if (Math.abs(window.scrollY - desplazamientoInicial.current) > 24) return;
    if (primera.getBoundingClientRect().top <= margenDeAjuste(raiz) + 1) return;
    // El apagado global de movimiento del CSS no alcanza a un scroll pedido
    // desde JS, asi que se consulta aqui.
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    primera.scrollIntoView({ block: "start", behavior: reducido ? "instant" : "smooth" });
  }, [esMovil, listo, contenedor, llegada, desplazamientoInicial]);
}
