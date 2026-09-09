import { EncabezadoSeccion } from "@/components/cabecera/encabezado";
import { Seccion } from "@/components/chrome/seccion";
import { PanelIndicadores } from "@/components/paneles/indicadores";
import { tituloSeccion } from "@/lib/dominio/secciones";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";

/**
 * INDICADORES: las cifras que este tablero no calcula.
 *
 * Es la unica pagina cuyo dato no sale del pipeline de prensa: cinco fuentes
 * oficiales con cadencias distintas, leidas y etiquetadas. Por eso esta
 * separada del "corte de hoy" de la portada, que resume LA CORRIDA. Las dos
 * son cifras y no son la misma clase de cifra: una se mide sola cada seis
 * horas, la otra la publica el INEGI cuando le toca.
 */
export function PaginaIndicadores({ zona }: { zona: ZonaRuta | null }) {
  const nombre = zona === null ? null : NOMBRE_CORTO[zona];
  const sd = zona === "San Diego";

  return (
    <>
      <EncabezadoSeccion
        zona={zona}
        vista="indicadores"
        titulo={tituloSeccion("indicadores", nombre)}
        entrada={
          nombre === null
            ? "Precios de vivienda y suelo, crimen y percepción. Cinco fuentes oficiales con cadencias distintas: cada panel dice de dónde viene su cifra y qué no se puede concluir de ella."
            : sd
              ? "Para San Diego la fuente es el padrón catastral del condado. Los indicadores mexicanos —SHF, predial, SESNSP y ENSU— no aplican de este lado de la línea."
              : `Las cifras oficiales que existen para ${nombre}, y las que no. Cada panel dice de dónde viene su dato y qué no se puede concluir de él.`
        }
      />

      <Seccion id="indicadores">
        <PanelIndicadores zona={zona} lectura={<LecturaIndicadores />} />
      </Seccion>
    </>
  );
}

function LecturaIndicadores() {
  return (
    <>
      <p>
        Cada fuente tiene su propia cadencia: SHF y ENSU trimestrales, SESNSP
        mensual con unas tres semanas de rezago, predial anual, SANDAG mensual.
        Ninguna de estas cifras la calcula este tablero: se leen y se etiquetan.
      </p>
      <p>
        El índice SHF mide vivienda comprada con crédito hipotecario, no terrenos
        ni operaciones al contado, y solo existe para Tijuana y Mexicali. El
        predial mide recaudación, no valor: sirve para comparar un municipio
        consigo mismo, no para rankear. El SESNSP cuenta delitos reportados, no
        ocurridos, y no es per cápita. La ENSU es la única medición de percepción
        con muestra probabilística y solo cubre dos ciudades.
      </p>
    </>
  );
}
