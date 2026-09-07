import type { ElementType, ReactNode } from "react";

/**
 * El bisel doble. Una carcasa exterior con filo de pelo y una pastilla
 * interior con su propio brillo interno y un radio concentrico.
 *
 * EL NIVEL, NO EL RADIO. Antes la prop se llamaba `radio` y valia "lg" o
 * "md", o sea que invitaba a elegir una curva a ojo; y como nadie sabia
 * cuando pedir "md", los once sitios pasaban el mismo valor. Resultado: el
 * resumen de portada, el muro de 82,000px y una tarjeta de 440px llevaban la
 * MISMA esquina de 32px, que es el 2% del ancho de uno y el 7% del otro. El
 * mismo numero producia dos formas distintas y el radio no decia nada.
 *
 * Ahora dice EN QUE NIVEL de la composicion estas, y la regla para elegirlo
 * es mecanica, no de ancho a ojo:
 *
 *   marco — es hijo directo de una `Seccion`, ocupa la rejilla completa.
 *   panel — lo dibuja `Tarjeta`, o sea que vive dentro de una rejilla.
 *
 * El canal es `p-2` (8px) y no `p-1.5`, y eso hace que la escala se cierre
 * sobre si misma: 32-8=24 y 24-8=16, asi que el nucleo de un nivel ES la
 * carcasa del siguiente. Las curvas siguen exactamente concentricas y de paso
 * desaparecen 26px y 18px, que no eran numeros elegidos sino el residuo de
 * una resta. Si se cambia el canal hay que rehacer esa aritmetica: ese par de
 * numeros va junto, y cambiar uno sin el otro es lo que hace que un bisel se
 * vea mal sin que se sepa por que.
 *
 * Sin hooks a proposito, para que lo puedan importar tanto los componentes de
 * servidor como los de cliente.
 */

const NIVELES = {
  marco: { carcasa: "rounded-marco p-2", nucleo: "rounded-panel" },
  panel: { carcasa: "rounded-panel p-2", nucleo: "rounded-nucleo" },
} as const;

interface Props {
  as?: ElementType;
  nivel?: keyof typeof NIVELES;
  className?: string;
  interior?: string;
  children: ReactNode;
}

export function Bisel({
  as: Tag = "div",
  nivel = "marco",
  className = "",
  interior = "",
  children,
}: Props) {
  const n = NIVELES[nivel];
  return (
    <Tag className={`border border-filo bg-vela ${n.carcasa} ${className}`}>
      {/* Interior SIEMPRE opaco, y por eso ya no es una prop.
          Un orbe violeta detras de una barra cambia el valor que la barra
          parece tener, asi que esto es una restriccion de CORRECCION
          disfrazada de estilo; tambien evita `backdrop-blur` sobre
          contenedores que hacen scroll, que el propio arquetipo prohibe por
          rendimiento. Era `opaco?: boolean` con `false` por defecto: los once
          sitios lo pasaban, o sea que la rama translucida nunca se pintaba, y
          lo unico que hacia la prop era dejar que alguien que no leyera este
          comentario la apagara. */}
      <div className={["h-full w-full", n.nucleo, "bg-carta shadow-bisel", interior].join(" ")}>
        {children}
      </div>
    </Tag>
  );
}
