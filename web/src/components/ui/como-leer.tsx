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
    <details className="mt-6 border-t border-white/[0.06] pt-4">
      <summary className="cursor-pointer text-xs text-white/55 select-none hover:text-white/85">
        {titulo}
      </summary>
      <div className="mt-3 max-w-[80ch] space-y-3 text-sm leading-relaxed text-white/60">
        {children}
      </div>
    </details>
  );
}
