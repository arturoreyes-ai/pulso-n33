"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";

/**
 * El recorrido a pantalla completa: que tarjeta esta asentada y como ir a otra.
 *
 * Nacio dentro del visor de redes (14 de septiembre de 2026) y salio de ahi el
 * mismo dia, cuando /ahora necesito lo mismo para titulares. La primera version
 * ajustaba el DOCUMENTO por proximidad, y en el telefono dejaba medias
 * tarjetas: arriba de la primera estaban las pastillas y abajo de la ultima el
 * pie, ninguno era un punto de ajuste, y con `mandatory` el navegador los
 * volvia inalcanzables. /ahora lo resolvio con una caja propia (`.lector`,
 * globals.css) que ES la pantalla en el telefono; el 15 de septiembre el visor
 * de redes se monto en la misma caja y la caja paso a ser la pantalla tambien
 * en escritorio. Desde entonces solo hay un modo: la caja desplaza, la pagina
 * no.
 *
 * Contrato con el DOM: el contenedor vive dentro de un `.lector`; cada tarjeta
 * lleva `data-indice="n"` y mide la caja (`--alto-tarjeta`). Solo se publica
 * el indice al ASENTAR, nunca en cada cuadro del movimiento: la tarjeta que
 * sale sigue viva mientras el dedo la arrastra y la que entra monta su medio
 * ya quieta.
 */
const RETARDO = 160;

/** Bajo `md` la barra del navegador cambia el viewport visual durante el
 *  gesto (iOS); ahi el alto del lector se fija en pixeles al asentar. */
const CONSULTA_ESCRITORIO = "(min-width: 48rem)";

function desplazar(raiz: HTMLElement, tarjeta: HTMLElement, suave: boolean, interior = 0) {
  const behavior = suave && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "instant";
  const distancia = tarjeta.getBoundingClientRect().top - raiz.getBoundingClientRect().top + interior;
  raiz.scrollTo({ top: raiz.scrollTop + distancia, behavior });
}

export interface Recorrido {
  /** Indice asentado, desde 0. */
  actual: number;
  /** Alguna tarjeta toca la caja. */
  enPantalla: boolean;
  /** Ir a una tarjeta. */
  ir: (indice: number) => void;
}

export function useRecorrido(contenedor: RefObject<HTMLElement | null>): Recorrido {
  const [actual, setActual] = useState(0);
  const [enPantalla, setEnPantalla] = useState(false);
  const asentado = useRef(0);

  useEffect(() => {
    const raiz = contenedor.current;
    const lector = raiz?.closest<HTMLElement>(".lector");
    if (!raiz || !lector) return;
    let temporizador: number | undefined;
    let tocando = false;
    let redimensionando = false;
    let interior = 0;
    let iniciado = false;
    let tocaPantalla = false;
    let ancho = raiz.clientWidth;
    let alto = raiz.clientHeight;
    let anchoVentana = window.innerWidth;
    let mantenerIndice = false;

    const tarjetaActual = () => raiz.querySelector<HTMLElement>(`[data-indice="${asentado.current}"]`);
    const localizar = () => {
      const caja = raiz.getBoundingClientRect();
      const limite = caja.top;
      const fondo = caja.bottom;
      let cercana: HTMLElement | null = null;
      let distancia = Infinity;
      for (const tarjeta of raiz.querySelectorAll<HTMLElement>("[data-indice]")) {
        const rectangulo = tarjeta.getBoundingClientRect();
        if (rectangulo.bottom <= limite || rectangulo.top >= fondo) continue;
        // Una tarjeta larga sigue siendo actual al leer su parte inferior.
        const separacion = rectangulo.top <= limite + 1 && rectangulo.bottom >= fondo - 1
          ? 0 : Math.abs(rectangulo.top - limite);
        if (separacion < distancia) {
          cercana = tarjeta;
          distancia = separacion;
        }
      }
      tocaPantalla = cercana !== null;
      if (cercana) {
        asentado.current = Number(cercana.dataset.indice);
        interior = Math.max(0, limite - cercana.getBoundingClientRect().top);
        iniciado = true;
      }
    };
    const medir = () => {
      if (window.matchMedia(CONSULTA_ESCRITORIO).matches) {
        lector.style.removeProperty("--alto-lector");
      } else {
        // La barra del navegador puede cambiar DURANTE un gesto. Aplicamos
        // su nuevo alto al asentar; el punto de ajuste no huye del dedo.
        const ventana = window.visualViewport;
        if (!ventana || ventana.scale === 1) {
          lector.style.setProperty("--alto-lector", `${ventana?.height ?? window.innerHeight}px`);
        }
      }
      raiz.style.setProperty("--alto-tarjeta", `${raiz.clientHeight}px`);
    };
    const asentar = () => {
      window.clearTimeout(temporizador);
      if (tocando) return;
      if (redimensionando) {
        redimensionando = false;
        // Al plegarse la barra del navegador el lector pudo avanzar. Medir
        // primero su destino evita devolverlo a la tarjeta anterior al gesto.
        // Un cambio de ANCHO conserva el indice previo al nuevo layout.
        if (!mantenerIndice) localizar();
        mantenerIndice = false;
        medir();
        const tarjeta = tarjetaActual();
        if (iniciado && tarjeta) {
          desplazar(raiz, tarjeta, false, Math.min(interior, Math.max(0, tarjeta.offsetHeight - raiz.clientHeight)));
        }
      }
      localizar();
      setEnPantalla(tocaPantalla);
      setActual(asentado.current);
    };
    const aplazar = () => {
      window.clearTimeout(temporizador);
      temporizador = window.setTimeout(asentar, RETARDO);
    };
    const redimensionar = () => {
      mantenerIndice ||= anchoVentana !== window.innerWidth;
      anchoVentana = window.innerWidth;
      redimensionando = true;
      aplazar();
    };
    const empezar = () => { tocando = true; };
    const terminar = () => { tocando = false; aplazar(); };
    // Observar solo la caja, nunca todas las imagenes o todas las tarjetas.
    // Tambien su ALTO: la primera medida puede caer antes de que la caja
    // tenga su tamano (18px, con el CSS aun en camino) y `--alto-tarjeta`
    // se quedaria ahi hasta un cambio de ancho.
    const tamano = new ResizeObserver(() => {
      if (ancho !== raiz.clientWidth || alto !== raiz.clientHeight) {
        ancho = raiz.clientWidth;
        alto = raiz.clientHeight;
        redimensionar();
      }
    });
    const contenido = new MutationObserver(aplazar);
    medir();
    asentar();
    tamano.observe(raiz);
    contenido.observe(raiz, { childList: true });
    raiz.addEventListener("scroll", aplazar, { passive: true });
    raiz.addEventListener("scrollend", asentar);
    raiz.addEventListener("touchstart", empezar, { passive: true });
    raiz.addEventListener("touchend", terminar, { passive: true });
    raiz.addEventListener("touchcancel", terminar, { passive: true });
    window.addEventListener("resize", redimensionar);
    window.visualViewport?.addEventListener("resize", redimensionar);
    return () => {
      window.clearTimeout(temporizador);
      tamano.disconnect();
      contenido.disconnect();
      raiz.removeEventListener("scroll", aplazar);
      raiz.removeEventListener("scrollend", asentar);
      raiz.removeEventListener("touchstart", empezar);
      raiz.removeEventListener("touchend", terminar);
      raiz.removeEventListener("touchcancel", terminar);
      window.removeEventListener("resize", redimensionar);
      window.visualViewport?.removeEventListener("resize", redimensionar);
    };
  }, [contenedor]);

  const ir = useCallback((indice: number) => {
    const raiz = contenedor.current;
    const tarjeta = raiz?.querySelector<HTMLElement>(`[data-indice="${indice}"]`);
    if (raiz && tarjeta) desplazar(raiz, tarjeta, true);
  }, [contenedor]);

  return { actual, enPantalla, ir };
}

/** Teclado del recorrido, para el contenedor enfocable. Las flechas conservan
 *  el desplazamiento nativo para leer tarjetas largas; Re Pag / Av Pag, Inicio
 *  y Fin ofrecen destinos explicitos. */
export function teclasDelRecorrido(evento: KeyboardEvent<HTMLElement>, actual: number, total: number, ir: (indice: number) => void): void {
  if (evento.target !== evento.currentTarget || evento.altKey || evento.ctrlKey || evento.metaKey) return;
  if (evento.key !== "PageDown" && evento.key !== "PageUp" && evento.key !== "Home" && evento.key !== "End") return;
  evento.preventDefault();
  const destino = evento.key === "Home" ? 0 : evento.key === "End" ? total - 1 : actual + (evento.key === "PageDown" ? 1 : -1);
  ir(Math.max(0, Math.min(total - 1, destino)));
}
