import type { ElementType, ReactNode } from "react";

/**
 * El bisel doble. Una carcasa exterior con filo de pelo y una pastilla
 * interior con su propio brillo interno y un radio concentrico.
 *
 * `p-1.5` son 0.375rem, asi que `calc(2rem - 0.375rem)` da curvas EXACTAMENTE
 * concentricas. Ese par de numeros va junto: cambiar uno sin el otro es lo
 * que hace que un bisel se vea mal sin que se sepa por que.
 *
 * Sin hooks a proposito, para que lo puedan importar tanto los componentes de
 * servidor como los de cliente.
 */

const RADIOS = {
  lg: { carcasa: "rounded-[2rem] p-1.5", nucleo: "rounded-[calc(2rem-0.375rem)]" },
  md: { carcasa: "rounded-[1.5rem] p-1.5", nucleo: "rounded-[calc(1.5rem-0.375rem)]" },
} as const;

interface Props {
  as?: ElementType;
  radio?: keyof typeof RADIOS;
  /**
   * Interior OPACO. Obligatorio donde hay datos.
   *
   * Un orbe violeta detras de una barra cambia el valor que la barra parece
   * tener, asi que esto es una restriccion de correccion disfrazada de
   * estilo. Tambien evita `backdrop-blur` sobre contenedores que hacen
   * scroll, que es lo que el propio arquetipo prohibe por rendimiento.
   */
  opaco?: boolean;
  className?: string;
  interior?: string;
  children: ReactNode;
}

export function Bisel({
  as: Tag = "div",
  radio = "lg",
  opaco = false,
  className = "",
  interior = "",
  children,
}: Props) {
  const r = RADIOS[radio];
  return (
    <Tag className={`border border-filo bg-vela ${r.carcasa} ${className}`}>
      <div
        className={[
          "h-full w-full",
          r.nucleo,
          opaco ? "bg-carta" : "bg-carta/70 backdrop-blur-2xl",
          "shadow-bisel",
          interior,
        ].join(" ")}
      >
        {children}
      </div>
    </Tag>
  );
}
