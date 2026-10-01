"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import useSWR from "swr";

/**
 * Quien esta mirando: las iniciales del boton de menu y el renglon del menu.
 *
 * Es de CLIENTE a proposito, y lee `/api/yo` en vez de llamar a `auth()` desde
 * `Navegacion`. `auth()` lee las cookies, y leerlas en la nav volveria dinamica
 * cada pagina que la monta: las zonas y las sueltas se prerrenderizan, y el nombre de una persona no
 * vale un render por peticion. Esto cuesta una peticion por carga, que SWR
 * comparte entre el boton y el renglon.
 *
 * No `/api/auth/session`: sin Entra (el modo de desarrollo) Auth.js no tiene
 * proveedores y ese endpoint responde 500 en cada carga, asi que en local
 * nunca se veria un nombre. `/api/yo` pasa por lib/acceso/sesion.ts, que ya
 * sabe del modo sin Entra.
 *
 * No es un SessionProvider ni `useSession`: nada del tablero depende de esto.
 * Si la respuesta no llega (sin sesion, red caida), el boton pinta un circulo
 * sin letras y el renglon no se pinta. «Salir» sigue en el menu, que es lo que
 * importa.
 */

interface Yo {
  rol?: string;
  nombre?: string;
  correo?: string;
}

const leer = (url: string): Promise<Yo | null> =>
  fetch(url, { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null));

function useCuenta(): { nombre: string; correo: string; admin: boolean } | null {
  const { data } = useSWR("/api/yo", leer, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const correo = data?.correo?.trim() ?? "";
  const nombre = data?.nombre?.trim() || correo;
  return nombre ? { nombre, correo, admin: data?.rol === "admin" } : null;
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
 * Las iniciales de quien mira, dentro del boton del menu de escritorio
 * (chrome/menu-pastilla.tsx).
 *
 * Hasta el 28 de septiembre de 2026 eran su propio boton, que al pulsarse
 * alargaba la pastilla con el nombre, «Accesos» y «Salir» (CuentaPastilla).
 * Con la pastilla ya llena, ese tramo era lo que la desbordaba; la cuenta vive
 * ahora en el menu, y las iniciales se quedan en el boton para decir QUIEN
 * esta mirando sin abrir nada.
 *
 * El circulo existe antes de que llegue el nombre: sin el, el boton cambiaria
 * de ancho al cargar.
 */
export function InicialesCuenta() {
  const cuenta = useCuenta();
  return (
    <span aria-hidden className="inicial-cuenta" title={cuenta?.nombre}>
      {cuenta ? iniciales(cuenta.nombre) : null}
    </span>
  );
}

/**
 * Lo que el pie del riel pinta: el primer nombre como rotulo y el nombre
 * entero con el correo en el `title`. Sin nombre, la parte del correo antes
 * de la arroba: un correo entero no cabe en 96px.
 */
export function useCuentaRiel(): { corto: string; titulo: string; admin: boolean } | null {
  const cuenta = useCuenta();
  if (!cuenta) return null;
  const corto = cuenta.nombre.includes("@")
    ? (cuenta.nombre.split("@")[0] ?? cuenta.nombre)
    : (cuenta.nombre.split(/\s+/)[0] ?? cuenta.nombre);
  const titulo = cuenta.correo && cuenta.correo !== cuenta.nombre ? `${cuenta.nombre} · ${cuenta.correo}` : cuenta.nombre;
  return { corto, titulo, admin: cuenta.admin };
}

/**
 * Lo que solo un administrador ve en la nav: hoy el renglon de Reportes
 * (lib/dominio/secciones.ts, `soloAdmin`). Esconder un enlace no protege
 * nada; la pagina responde 404 por su cuenta. Mientras `/api/yo` no responde
 * no se pinta, asi que para un administrador el renglon aparece un instante
 * despues que los demas.
 */
export function SoloAdmin({ children }: { children: ReactNode }) {
  return useCuenta()?.admin ? children : null;
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
      {cuenta.admin ? <Link href="/admin/usuarios" className="ml-auto text-meta text-tinta-titulo underline decoration-filo underline-offset-4 hover:decoration-tinta-titulo">Accesos</Link> : null}
    </div>
  );
}
