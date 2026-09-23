"use client";

import { X as Cerrar } from "@phosphor-icons/react";
import { useId, type ReactNode, type Ref } from "react";

import { CONTROL, ICONO_ESTRECHO } from "@/components/chrome/medidas-cinta";

/**
 * La hoja del tablero: un `<dialog>` modal con `.dialogo-lector`, su cabecera
 * y el aspa de cerrar. Todas las hojas —lugar, menú, búsqueda, comentarios,
 * lectura automática, notas relacionadas, «De qué se habla»— son esta.
 *
 * Hasta el 23 de septiembre de 2026 el marco estaba escrito once veces a mano:
 * el aspa a 20 px en unas y a `ICONO_ESTRECHO` en otras, y una que se llamaba
 * solo «Cerrar» para el lector de pantalla mientras las demas decian que
 * cerraban. El cliente pidio que todo se viera del mismo proyecto.
 *
 * El aspa cierra el `<dialog>` que la contiene, asi que la hoja no necesita
 * `ref` para eso; quien la abre si la necesita (`showModal()`), y la pasa por
 * `ref`, que en React 19 es una prop mas. `rotuloCerrar` nombra lo que se
 * cierra: «Cerrar comentarios», no «Cerrar».
 */
export function Hoja({ ref, id, titulo, rotuloCerrar, onClose, children }: {
  ref?: Ref<HTMLDialogElement>;
  id?: string;
  titulo: ReactNode;
  rotuloCerrar: string;
  onClose?: () => void;
  children?: ReactNode;
}) {
  const idTitulo = `${useId()}-titulo`;
  return (
    <dialog ref={ref} id={id} className="dialogo-lector" aria-labelledby={idTitulo} onClose={onClose}>
      <div className="cabecera-dialogo-lector">
        <h2 id={idTitulo} className="text-rotulo text-tinta-titulo">{titulo}</h2>
        <button type="button" className={CONTROL} aria-label={rotuloCerrar}
          onClick={(evento) => evento.currentTarget.closest("dialog")?.close()}>
          <Cerrar size={ICONO_ESTRECHO} aria-hidden />
        </button>
      </div>
      {children}
    </dialog>
  );
}
