import { SelectorZona } from "@/components/chrome/selector-zona";
import { Cejilla } from "@/components/ui/primitivas";
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
        <Cejilla>
          {zona === null
            ? "Corredor Tijuana y San Diego"
            : zona === "San Diego"
              ? "Pulso N33 · California"
              : "Pulso N33 · Baja California"}
        </Cejilla>

        <h1 className="mt-5 text-5xl leading-[0.95] tracking-tighter text-tinta-titulo md:text-7xl">
          {nombre === null ? (
            <>
              Pulso <span className="text-chart-1">N33</span>
            </>
          ) : (
            nombre
          )}
        </h1>

        <p className="mt-6 max-w-[58ch] text-base leading-relaxed text-tinta-prosa md:text-lg">
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
