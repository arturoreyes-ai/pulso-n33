import type { ReactNode } from "react";

/**
 * La prosa metodologica de un panel, plegada. Sigue siendo HTML de servidor
 * (llega como `lectura` desde tablero.tsx) y sigue estando en la pagina para
 * quien la busque; solo deja de competir con la cifra por la primera lectura.
 *
 * Sin hooks: lo importan componentes de servidor y de cliente.
 */
export function ComoLeer({
  children,
  titulo = "Cómo leer este dato",
}: {
  children?: ReactNode;
  titulo?: string;
}) {
  if (children === undefined || children === null) return null;
  return (
    <details className="mt-6 border-t border-vela pt-4">
      <summary className="cursor-pointer text-xs text-tinta-prosa select-none hover:text-tinta-dato">
        {titulo}
      </summary>
      <div className="mt-3 max-w-[80ch] space-y-3 text-sm leading-relaxed text-tinta-prosa">
        {children}
      </div>
    </details>
  );
}
