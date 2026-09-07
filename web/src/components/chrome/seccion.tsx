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
 * `py-24` es una regla de SECCION. Leida como regla de fila convertiria el
 * muro en sesenta pantallas de alto.
 */
export function Seccion({
  id,
  titulo,
  entrada,
  children,
}: {
  id: string;
  titulo: string;
  entrada?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mx-auto w-full max-w-[88rem] px-4 py-12 md:px-8 md:py-20">
      <h2 className="font-titular text-seccion text-tinta-titulo">{titulo}</h2>
      {entrada === undefined ? null : (
        <p className="mt-4 max-w-[65ch] text-lectura text-tinta-prosa">{entrada}</p>
      )}
      <div className="mt-8">
        <Revelar>{children}</Revelar>
      </div>
    </section>
  );
}
