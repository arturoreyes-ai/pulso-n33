"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import useSWR from "swr";

/**
 * Quien esta mirando: la cuenta de la pastilla y el renglon del menu del telefono.
 *
 * Es de CLIENTE a proposito, y lee `/api/yo` en vez de llamar a `auth()` desde
 * `Navegacion`. `auth()` lee las cookies, y leerlas en la nav volveria dinamica
 * cada pagina que la monta: las zonas y las sueltas se prerrenderizan, y el nombre de una persona no
 * vale un render por peticion. Esto cuesta una peticion por carga, que SWR
 * comparte entre la pastilla y el renglon.
 *
 * No `/api/auth/session`: sin Entra (el modo de desarrollo) Auth.js no tiene
 * proveedores y ese endpoint responde 500 en cada carga, asi que en local
 * nunca se veria un nombre. `/api/yo` pasa por lib/acceso/sesion.ts, que ya
 * sabe del modo sin Entra.
 *
 * No es un SessionProvider ni `useSession`: nada del tablero depende de esto.
 * Si la respuesta no llega (sin sesion, red caida), la pastilla pinta un
 * circulo sin letras y su tramo trae solo «Salir»; el renglon no se pinta.
 * «Salir» sigue ahi, que es lo que importa.
 */

interface Yo {
  nombre?: string;
  correo?: string;
}

const leer = (url: string): Promise<Yo | null> =>
  fetch(url, { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null));

function useCuenta(): { nombre: string; correo: string } | null {
  const { data } = useSWR("/api/yo", leer, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const correo = data?.correo?.trim() ?? "";
  const nombre = data?.nombre?.trim() || correo;
  return nombre ? { nombre, correo } : null;
}

/**
 * Dos letras: la primera del primer nombre y la del ultimo apellido. De un
 * correo sin nombre, la primera letra. `Intl.Segmenter` no hace falta: los
 * nombres del inquilino empiezan con una letra de un solo punto de codigo.
 */
function iniciales(nombre: string): string {
  const partes = nombre.split(/[\s@._-]+/).filter(Boolean);
  const primera = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 && !nombre.includes("@") ? (partes.at(-1)?.[0] ?? "") : "";
  return (primera + ultima).toLocaleUpperCase("es");
}

/**
 * La cuenta en la pastilla de escritorio: las iniciales y, al pulsarlas, un
 * tramo que CRECE DENTRO de la pastilla con el nombre y «Salir».
 *
 * EL CASO, 24 de septiembre de 2026: la primera version abria un panel
 * flotante bajo la pastilla —una tarjeta con otro circulo de iniciales, un
 * filo y «Salir»— y el cliente lo vio desordenado: dos superficies para una
 * sola cosa, y las iniciales repetidas a un dedo de distancia. Aqui no hay
 * segunda superficie; la pastilla se alarga.
 *
 * `children` es el <form> de «Salir», que llega del servidor: es una accion de
 * servidor y se renderiza alli, el mismo canal de `MenuCinta`.
 *
 * Se cierra con otro clic, con Escape, con un clic fuera o al navegar. Lo
 * ultimo no es un efecto: el estado guarda la RUTA donde se abrio, y en otra
 * ruta simplemente no esta abierto. Cerrado, el tramo es `inert`, asi que el
 * tabulador no cae en un «Salir» de ancho cero.
 *
 * La pastilla esta centrada, asi que al crecer se recentra y las pestanas se
 * corren a la izquierda la mitad de lo que crece el tramo. Es el precio
 * aceptado de crecer en su sitio.
 */
export function CuentaPastilla({ children }: { children: ReactNode }) {
  const cuenta = useCuenta();
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

  const titulo = cuenta
    ? cuenta.correo && cuenta.correo !== cuenta.nombre
      ? `${cuenta.nombre} · ${cuenta.correo}`
      : cuenta.nombre
    : undefined;

  return (
    <div ref={caja} className="cuenta-pastilla" data-abierta={abierta || undefined}>
      <button
        type="button"
        aria-label="Tu cuenta"
        aria-expanded={abierta}
        aria-controls={id}
        title={abierta ? undefined : titulo}
        onClick={() => setAbiertaEn(abierta ? null : ruta)}
        className="boton-cuenta shrink-0 rounded-full p-1 hover:bg-filo"
      >
        {/* El circulo existe antes de que llegue el nombre: sin el, la
            pastilla cambiaria de ancho al cargar. */}
        <span aria-hidden className="inicial-cuenta">
          {cuenta ? iniciales(cuenta.nombre) : null}
        </span>
      </button>
      <div id={id} className="tramo-cuenta" inert={!abierta}>
        <div className="flex min-w-0 items-center overflow-hidden">
          {cuenta ? (
            <span title={titulo} className="nombre-cuenta truncate pl-2 text-meta text-tinta-titulo">
              {cuenta.nombre}
            </span>
          ) : null}
          {cuenta ? <span aria-hidden className="px-1 text-meta text-tinta-meta">·</span> : null}
          {children}
        </div>
      </div>
    </div>
  );
}

export function RenglonCuenta({ className = "" }: { className?: string }) {
  const cuenta = useCuenta();
  if (!cuenta) return null;
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span aria-hidden className="inicial-cuenta">
        {iniciales(cuenta.nombre)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-cuerpo text-tinta-titulo">{cuenta.nombre}</span>
        {cuenta.correo && cuenta.correo !== cuenta.nombre ? (
          <span className="block truncate text-meta text-tinta-meta">{cuenta.correo}</span>
        ) : null}
      </span>
    </div>
  );
}
