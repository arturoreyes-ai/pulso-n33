import type { ReactNode } from "react";

import { Revelar } from "./revelar";

/**
 * Envoltura de seccion: el titulo grande, la entrada y el revelado.
 *
 * Componente de servidor que envuelve a `Revelar`, que es de cliente, que a
 * su vez envuelve hijos de SERVIDOR. Los hijos llegan como payload RSC, no
 * como JavaScript de cliente.
 *
 * Sin cejilla: la unica etiqueta en mayusculas vive en el encabezado. Cinco
 * cejillas iguales arriba de cinco titulos no eran jerarquia, eran plantilla.
 *
 * `titulo` es OPCIONAL desde que el tablero se partio en cuatro paginas. En la
 * portada hay tres secciones y cada una necesita su h2; en una pagina
 * interior hay una sola y su titulo ya es el h1 del encabezado, asi que un h2
 * ahi seria el mismo texto dos veces seguidas. Lo que sigue aportando en ese
 * caso es todo lo demas: la rejilla, el ancla y el revelado.
 *
 * `py-20` es una regla de SECCION. Leida como regla de fila convertiria el
 * muro en sesenta pantallas de alto.
 *
 * `pegada` es para la PRIMERA seccion de una pagina, la que sigue al
 * encabezado: conserva el ritmo abajo y recorta el de arriba. Sin esto, entre
 * las pastillas de alcance del encabezado y el h2 "Titulares" quedaban los
 * 24px del encabezado mas los 80px de la seccion, una franja negra de cuatro
 * dedos que el cliente pidio cerrar el 11 de septiembre de 2026: los titulares
 * van pegados a la navegacion que los acota.
 */
const RITMO = "py-12 md:py-20";
const RITMO_PEGADA = "pt-4 pb-12 md:pt-6 md:pb-20";

export function Seccion({
  id,
  titulo,
  entrada,
  pegada = false,
  children,
}: {
  id: string;
  titulo?: string;
  entrada?: ReactNode;
  pegada?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`mx-auto w-full max-w-[88rem] scroll-mt-[calc(var(--nav-alto)+1.5rem)] px-4 md:px-8 ${
        pegada ? RITMO_PEGADA : RITMO
      }`}
    >
      {titulo === undefined ? null : (
        <h2 className="font-titular text-seccion text-tinta-titulo">{titulo}</h2>
      )}
      {entrada === undefined ? null : (
        <p className="mt-4 max-w-[65ch] text-lectura text-tinta-prosa">{entrada}</p>
      )}
      <div className={titulo === undefined && entrada === undefined ? "" : "mt-8"}>
        <Revelar>{children}</Revelar>
      </div>
    </section>
  );
}
