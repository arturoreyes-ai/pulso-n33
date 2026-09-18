"use client";

import { List as Menu, X as Cerrar } from "@phosphor-icons/react";
import { useRef, type ReactNode } from "react";

import { CONTROL, ICONO_CONTROL, ICONO_ESTRECHO } from "@/components/chrome/medidas-cinta";

/**
 * El boton de menu de la cinta, y su hoja de paginas.
 *
 * EL CASO, medido el 18 de septiembre de 2026 en /tijuana/indicadores a 375
 * px: la pastilla flotante pedia 635 px de contenido en 350 px de ancho, o sea
 * que 285 px -- el 45% de la navegacion -- quedaban fuera de la pantalla
 * detras de un desplazamiento horizontal que nada anuncia. «Garitas» salia
 * cortada por la mitad, y «Gasto electoral» y «Salir» no se veian en absoluto:
 * cerrar sesion desde un telefono no habia forma de descubrirlo.
 *
 * La portada y redes nunca lo tuvieron porque son lectores: su barra ya llevaba
 * este mismo boton. Lo que faltaba era eso mismo en las paginas que NO son
 * lectores -- indicadores, garitas, gasto electoral y la de 404 --, que son las
 * que se quedaban con la tira que no cabe.
 *
 * Es de CLIENTE porque un `<dialog>` modal necesita `showModal()`, y por eso la
 * lista de paginas entra como `children` en vez de construirse aqui:
 * `MenuLector` es de servidor y lleva la accion de servidor de «Salir», que no
 * se puede renderizar desde un modulo de cliente. Es el mismo canal por el que
 * `Lector` recibe su prop `menu`, y existe por la misma razon.
 *
 * El boton usa `.control-lector`, como los del lector. La primera version
 * escribio su geometria a mano —`size-11 rounded-full … hover:bg-filo`— para
 * poder esconderse con `md:hidden`, porque el `display` de esa clase esta fuera
 * de la capa de utilidades y le gana; el precio fue un radio y un lavado de
 * hover que no coincidian con ningun otro control del sitio. Ya no hace falta:
 * lo que se esconde por ancho es la cinta entera (`.cinta-pagina`), no este
 * boton.
 *
 * Reusa `.dialogo-lector` a proposito: es la hoja del sitio -- nace del borde
 * inferior en el telefono y flota centrada en escritorio -- y darle una clase
 * propia seria una segunda copia de esas reglas para que se vieran igual. El
 * nombre dice «lector» porque ahi nacio, no porque sea suya.
 */
export function MenuCinta({ children }: { children: ReactNode }) {
  const hoja = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        className={CONTROL}
        aria-label="Ir a otra página"
        aria-haspopup="dialog"
        aria-controls="menu-navegacion"
        onClick={() => hoja.current?.showModal()}
      >
        <Menu size={ICONO_CONTROL} aria-hidden />
      </button>

      {/* Cierra al pulsar cualquier enlace o boton: aqui dentro todo navega o
          envia, igual que la hoja de lugares del lector. */}
      <dialog
        ref={hoja}
        id="menu-navegacion"
        className="dialogo-lector"
        aria-labelledby="titulo-menu-navegacion"
        onClick={(evento) => {
          if ((evento.target as HTMLElement).closest("a, button")) hoja.current?.close();
        }}
      >
        <div className="cabecera-dialogo-lector">
          <h2 id="titulo-menu-navegacion" className="text-rotulo text-tinta-titulo">Ir a</h2>
          <button type="button" className={CONTROL} aria-label="Cerrar menú">
            <Cerrar size={ICONO_ESTRECHO} aria-hidden />
          </button>
        </div>
        {children}
      </dialog>
    </>
  );
}
