"use client";

import { DotsThreeOutline } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { InicialesCuenta, useCuentaRiel } from "@/components/chrome/quien-mira";
import { Hoja } from "@/components/ui/hoja";

/**
 * Las dos piezas de cliente de la navegacion (chrome/riel.tsx).
 *
 * `CuentaRiel`: las iniciales sobre el primer nombre al pie del riel, como los
 * demas renglones, y al pulsarlas «Accesos» y «Salir» aparecen DEBAJO del
 * nombre, en su sitio. Hasta el 28 de septiembre de 2026 abria un popover a la
 * derecha del riel con las iniciales repetidas junto al nombre: una segunda
 * superficie para una sola cosa, lo mismo que el cliente rechazo el 24 de
 * septiembre. El hueco de los enlaces esta siempre reservado y solo se anima
 * opacidad y transform (globals.css, `.tramo-cuenta-riel`): si el pie
 * creciera, creceria hacia arriba, las iniciales se irian de debajo del
 * puntero y el segundo clic caeria en «Salir». Se cierra con otro clic, con
 * Escape, con un clic fuera o al navegar; lo ultimo no es un efecto: el estado
 * guarda la RUTA donde se abrio (el patron de la antigua `CuentaPastilla`).
 * Cerrado, el tramo es `inert`.
 *
 * `PestanaMas`: la cuarta pestana del telefono, que abre la hoja del sitio
 * (ui/hoja.tsx) con las herramientas y la cuenta. Una hoja y no un popover
 * porque en el telefono la hoja nace del borde de abajo, que es donde esta el
 * dedo, y es la misma que abren el lugar y la busqueda.
 *
 * Las dos reciben su contenido como `children` desde el servidor: «Salir» es
 * una accion de servidor.
 */

export function CuentaRiel({ children }: { children: ReactNode }) {
  const cuenta = useCuentaRiel();
  const ruta = usePathname();
  const [abiertaEn, setAbiertaEn] = useState<string | null>(null);
  const abierta = abiertaEn === ruta;
  const caja = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!abierta) return;
    const fuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbiertaEn(null);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbiertaEn(null);
    };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierta]);

  return (
    <div ref={caja} className="cuenta-riel" data-abierta={abierta || undefined}>
      <button
        type="button"
        aria-expanded={abierta}
        aria-controls={id}
        title={cuenta?.titulo}
        onClick={() => setAbiertaEn(abierta ? null : ruta)}
        className="boton-cuenta-riel"
      >
        <InicialesCuenta />
        <span className="nombre-cuenta-riel">{cuenta?.corto ?? "Tu cuenta"}</span>
      </button>
      <div id={id} className="tramo-cuenta-riel" inert={!abierta}>
        {cuenta?.admin ? <a href="/admin/usuarios" className="renglon-cuenta">Accesos</a> : null}
        {children}
      </div>
    </div>
  );
}

export function PestanaMas({ actual, children }: { actual: boolean; children: ReactNode }) {
  const hoja = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        className="pestana-barra"
        aria-haspopup="dialog"
        aria-controls="menu-mas"
        data-actual={actual || undefined}
        onClick={() => hoja.current?.showModal()}
      >
        <span className="icono-barra">
          {actual ? <span aria-hidden className="realce-barra" /> : null}
          <DotsThreeOutline size={22} weight={actual ? "fill" : "regular"} aria-hidden className="relative" />
        </span>
        <span>Más</span>
      </button>
      <Hoja ref={hoja} titulo="Más" rotuloCerrar="Cerrar menú" id="menu-mas">
        {children}
      </Hoja>
    </>
  );
}
