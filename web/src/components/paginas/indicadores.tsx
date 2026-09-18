import { EncabezadoSeccion } from "@/components/cabecera/encabezado";
import { Seccion } from "@/components/chrome/seccion";
import { PanelIndicadores } from "@/components/paneles/indicadores";
import { tituloSeccion } from "@/lib/dominio/secciones";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";

/**
 * INDICADORES: las cifras que este tablero no calcula.
 *
 * Es la unica pagina cuyo dato no sale del pipeline de prensa: cinco fuentes
 * oficiales con cadencias distintas, leidas y etiquetadas.
 *
 * Tuvo un desplegable «Como leer este dato» con la cadencia de cada fuente y lo
 * que cada una NO mide. Era el ultimo que quedaba de los siete, y se fue el 18
 * de septiembre de 2026 con el pie del sitio, el mismo dia y por lo mismo: el
 * cliente pidio que la pantalla no explique. Lo que decia esta en PRODUCT.md,
 * en la tabla «Los indicadores y lo que cada uno NO dice», que es ahora donde
 * vive. Lo que NO se fue es la etiqueta de cada cifra —su fuente y su fecha—,
 * que va pegada al numero y no es metodologia: es lo que ese numero es. Por eso esta
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
        <PanelIndicadores zona={zona} />
      </Seccion>
    </>
  );
}
