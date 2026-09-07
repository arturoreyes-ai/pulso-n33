import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

/**
 * El boton con la flecha en su propio circulo.
 *
 * La flecha nunca va desnuda al lado del texto: vive en un circulo propio,
 * a ras del padding interior derecho. El `pr-1.5` que iguala el `1.5` del
 * circulo es lo que lo deja a ras.
 *
 * Hover magnetico: el boton entero baja un poco al presionar y el circulo
 * interior se desplaza en diagonal, lo que produce la tension interna.
 */

const CLASES_BASE = [
  "group inline-flex items-center gap-4 rounded-full",
  "bg-white/10 py-1.5 pr-1.5 pl-6 text-sm text-white",
  "transition-all duration-700 ease-firma",
  "hover:bg-white/[0.16] active:scale-[0.98]",
].join(" ");

const CLASES_CIRCULO = [
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10",
  "transition-transform duration-700 ease-firma",
  "group-hover:translate-x-1 group-hover:-translate-y-[1px] group-hover:scale-105",
].join(" ");

interface Props {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  externo?: boolean;
}

export function Boton({ children, href, onClick, externo = false }: Props) {
  const interior = (
    <>
      <span className="py-1.5">{children}</span>
      <span aria-hidden className={CLASES_CIRCULO}>
        <ArrowUpRight size={14} weight="light" />
      </span>
    </>
  );

  if (href !== undefined) {
    return (
      <a
        href={href}
        className={CLASES_BASE}
        {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {interior}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={CLASES_BASE}>
      {interior}
    </button>
  );
}
