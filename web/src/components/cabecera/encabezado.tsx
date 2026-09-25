import { SelectorZona } from "@/components/chrome/selector-zona";
import type { Seccion } from "@/lib/dominio/secciones";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";

/**
 * El encabezado de una pagina interior: titulo, fechado, entrada y el selector
 * de zona. Nada mas.
 *
 * Fueron DOS encabezados hasta el 15 de septiembre de 2026. El otro,
 * `Encabezado`, era el de la portada —titulo a `text-hero`, conteos de notas
 * junto a cada zona y las pastillas de alcance que escribian `?a=`— y se fue
 * con el muro, que era su unica pagina. Lo que queda es el de seccion, y ahora
 * es el unico: la portada es un lector a pantalla completa con su propia barra
 * y no lleva encabezado de ningun tipo.
 *
 * La banda de salud ("Ingesta automatica. 23 de 25 fuentes respondieron...")
 * VIVIA aqui, debajo de la navegacion, y se quito el 11 de septiembre de 2026
 * a peticion del cliente: era una franja entre las pastillas y el primer
 * titular, y en una portada de un medio los titulares van pegados a la
 * navegacion.
 *
 * El `titulo` que recibe ES el h1, asi que la seccion de abajo ya no lleva h2:
 * dos titulos que dicen lo mismo, uno debajo del otro, era el eco que dejaba la
 * pagina unica al partirse.
 */

/**
 * La linea de FECHADO. Antes esto era una cejilla —un rotulo en mayusculas
 * con tracking, ARRIBA del titulo—, que es el unico movimiento que el piso de
 * oficio prohibe sin excepcion. El contenido si valia, asi que baja: debajo
 * del titular se lee como el fechado de un boletin, que es un recurso
 * editorial de verdad y con otro significado. Y de paso dice lo que el
 * producto necesita decir y no decia: de que lado de la linea esta esta zona.
 */
function Fechado({ zona }: { zona: ZonaRuta | null }) {
  const lugar =
    zona === null
      ? "Corredor Tijuana–San Diego"
      : zona === "San Diego"
        ? "California, Estados Unidos"
        : "Baja California, México";
  return <p className="mt-4 text-meta text-tinta-meta">{lugar}</p>;
}

const MARCO = "mx-auto w-full max-w-[88rem] px-4 pb-6 md:px-8";

export function EncabezadoSeccion({
  zona,
  vista,
  titulo,
  entrada,
}: {
  zona: ZonaRuta | null;
  vista: Seccion;
  titulo: string;
  entrada: string;
}) {
  return (
    <header className={MARCO}>
      <div>
        <h1 className="font-titular text-seccion text-tinta-titulo">{titulo}</h1>

        <Fechado zona={zona} />

        <p className="mt-6 max-w-[65ch] text-lectura text-tinta-prosa">{entrada}</p>

        {/* Lo ultimo del encabezado a proposito: la primera seccion de la
            pagina va pegada a estas pastillas. */}
        <div className="mt-8">
          <SelectorZona zona={zona} vista={vista} />
        </div>
      </div>
    </header>
  );
}
