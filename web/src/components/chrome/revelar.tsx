"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Entrada al hacer scroll, a nivel de SECCION.
 *
 * Nunca por fila. El muro tiene ~669 filas y 669 IntersectionObserver mas 669
 * transiciones de opacidad es la version del arquetipo que funde un telefono.
 * Ademas el propio arquetipo prohibe filtros de blur sobre contenido que hace
 * scroll, y la transicion de entrada lleva blur. Las filas usan
 * content-visibility, que resuelve el mismo problema sin animar nada.
 *
 * ADITIVO, nunca sustractivo: el HTML del servidor sale VISIBLE y el estado
 * que oculta lo pone el JS solo despues de comprobar prefers-reduced-motion y
 * justo antes de observar. Si el JS no corre, si el observer no dispara, o si
 * algo interactua raro, el contenido se ve. El modo de falla es "sin
 * animacion", no "pagina en blanco".
 *
 * Sin listeners de scroll: eso provoca reflows continuos.
 */
export function Revelar({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Pestana en segundo plano: no se produce ningun frame, y sin frames
    // IntersectionObserver NUNCA entrega su callback. Ocultar aqui dejaria el
    // contenido en opacity 0 indefinidamente. Y de todos modos no hay
    // animacion que apreciar en una pestana que nadie esta viendo.
    if (document.hidden) return;

    // Solo aqui es seguro ocultar.
    el.dataset.revelar = "pendiente";

    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.revelar = "listo";
            io.unobserve(e.target);
          }
        }
      },
      // `threshold: 0` y no un porcentaje. Un umbral porcentual es imposible
      // de cumplir para un elemento alto: el muro mide ~82,000 px, asi que
      // 0.05 exigiria 4,100 px visibles y ninguna pantalla los tiene. La
      // seccion se quedaba en opacity 0 para siempre.
      //
      // El rootMargin negativo abajo hace que revele un poco despues de que
      // el borde superior entra, que es el efecto que se busca.
      { rootMargin: "0px 0px -8% 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return <div ref={ref}>{children}</div>;
}
