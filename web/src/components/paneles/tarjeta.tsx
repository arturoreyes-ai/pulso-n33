import type { ReactNode } from "react";

import { Bisel } from "@/components/ui/bisel";

/**
 * La tarjeta de un panel. Titulo, procedencia, contenido y la salvedad.
 *
 * `aviso` se renderiza como TEXTO VISIBLE, nunca como tooltip. Es lo que
 * impide leer mal la cifra, y una salvedad escondida en un title no cumple esa
 * funcion. Cada fuente mide algo distinto y confundirlas es el error facil.
 *
 * Interior opaco siempre: aqui hay datos, y un orbe detras de una barra
 * cambia el valor que la barra parece tener.
 */
export function Tarjeta({
  titulo,
  fuente,
  periodo,
  aviso,
  className = "",
  extra,
  children,
}: {
  titulo: string;
  fuente: string;
  periodo?: string | null;
  aviso?: string;
  className?: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Bisel as="section" nivel="panel" className={className} interior="flex h-full flex-col p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-rotulo text-tinta-titulo">{titulo}</h3>
          <p className="mt-1 text-meta text-tinta-meta">
            {fuente}
            {periodo === null || periodo === undefined ? "" : ` · ${periodo}`}
          </p>
        </div>
        {extra}
      </div>

      <div className="mt-5 flex-1">{children}</div>

      {aviso === undefined ? null : (
        <p className="mt-5 border-t border-vela pt-4 text-meta text-tinta-prosa">
          {aviso}
        </p>
      )}
    </Bisel>
  );
}
