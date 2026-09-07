import { SelectorZona } from "@/components/chrome/selector-zona";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";
import { Banda } from "./banda";
import { ResumenZona } from "./resumen-zona";

/**
 * El encabezado: la unica cejilla del tablero, el titulo, el selector de zona
 * y el resumen con las cifras que importan. La tipografia grande es de
 * servidor; el resumen y la banda son de cliente porque leen el corte.
 */
export function Encabezado({ zona }: { zona: ZonaRuta | null }) {
  const nombre = zona === null ? null : NOMBRE_CORTO[zona];

  return (
    <header className="mx-auto w-full max-w-[88rem] px-4 pb-6 md:px-8">
      <div className="entrada">
        <h1 className="font-titular text-hero [font-stretch:112%] text-tinta-titulo">
          {nombre === null ? (
            <>
              Pulso <span className="text-chart-1">N33</span>
            </>
          ) : (
            nombre
          )}
        </h1>

        {/* La linea de FECHADO. Antes esto era una cejilla —un rotulo en
            mayusculas con tracking, ARRIBA del titulo—, que es el unico
            movimiento que el piso de oficio prohibe sin excepcion. El
            contenido si valia, asi que baja: debajo del titular se lee como
            el fechado de un boletin, que es un recurso editorial de verdad y
            con otro significado. Y de paso dice lo que el producto necesita
            decir y no decia: de que lado de la linea esta esta zona. */}
        <p className="mt-4 text-meta text-tinta-meta">
          {zona === null
            ? "Corredor Tijuana–San Diego"
            : zona === "San Diego"
              ? "California, Estados Unidos"
              : "Baja California, México"}
        </p>

        <p className="mt-6 max-w-[58ch] text-lectura text-tinta-prosa md:text-lectura">
          {nombre === null
            ? "Precios de vivienda y suelo, crimen, percepción, prensa y conversación por zona. Elige una zona para ver solo sus cifras."
            : `Precios, crimen, prensa y conversación en ${nombre}. Cada cifra dice de dónde viene y qué no se puede concluir de ella.`}
        </p>

        <div className="mt-8">
          <SelectorZona zona={zona} conteos />
        </div>

        <div className="mt-8">
          <ResumenZona zona={zona} />
        </div>

        <div className="mt-6">
          <Banda />
        </div>
      </div>
    </header>
  );
}
