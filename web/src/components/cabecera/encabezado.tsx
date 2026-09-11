import { Suspense } from "react";

import { NavegacionTitulares } from "@/components/chrome/navegacion-titulares";
import { SelectorZona } from "@/components/chrome/selector-zona";
import type { Seccion } from "@/lib/dominio/secciones";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";
import { Banda } from "./banda";

/**
 * El encabezado: titulo, fechado, entrada, selector de zona y la banda de
 * salud. Nada mas.
 *
 * El resumen de cifras VIVIA aqui y se fue a su propia seccion, debajo del
 * muro. Sumaba una rejilla de cuatro tarjetas y, en el indice, la tabla
 * comparativa de nueve zonas: en conjunto casi una pantalla entre quien llega
 * y el primer titular. En un tablero de un medio los titulares van primero, y
 * eso no se logra reordenando secciones si el encabezado ocupa el viewport.
 *
 * Son DOS encabezados y no uno con banderas, porque una portada y una pagina
 * interior no dicen lo mismo:
 *
 *   `Encabezado`         — la portada. El titulo es el PRODUCTO o el LUGAR,
 *                          a `text-hero`, y los chips traen conteos de notas.
 *   `EncabezadoSeccion`  — una pagina interior. El titulo es la VISTA, a
 *                          `text-seccion`, y no hay conteos: un conteo de
 *                          notas de prensa junto a la pagina de redes dice
 *                          algo que esa pagina no mide.
 *
 * La diferencia de escala es deliberada y es la unica que hay: portada y
 * pagina interior, como en un impreso. Repetir el hero de 72px en las cuatro
 * paginas seria repetir el problema que resolvio sacar el resumen de aqui.
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

/** El pie del encabezado: donde estas y como esta la corrida. Igual en las
 *  cuatro vistas, porque las dos preguntas se hacen en las cuatro. */
function Contexto({
  zona,
  vista,
  conteos,
}: {
  zona: ZonaRuta | null;
  vista: Seccion | null;
  conteos: boolean;
}) {
  return (
    <>
      <div className="mt-8">
        {vista === null ? (
          <Suspense fallback={<div id="zonas" aria-label="Cargando navegación" className="h-24" />}>
            <NavegacionTitulares zona={zona} />
          </Suspense>
        ) : (
          <SelectorZona zona={zona} vista={vista} conteos={conteos} />
        )}
      </div>
      <div className="mt-6">
        <Banda />
      </div>
    </>
  );
}

const MARCO = "mx-auto w-full max-w-[88rem] px-4 pb-6 md:px-8";

export function Encabezado({ zona }: { zona: ZonaRuta | null }) {
  const nombre = zona === null ? null : NOMBRE_CORTO[zona];

  return (
    <header className={MARCO}>
      <div className="entrada">
        <h1 className="font-titular text-hero [font-stretch:112%] text-tinta-titulo">
          {nombre ?? "Pulso"}
        </h1>

        <Fechado zona={zona} />

        <p className="mt-6 max-w-[58ch] text-lectura text-tinta-prosa">
          {nombre === null
            ? "Precios de vivienda y suelo, crimen, percepción, prensa y conversación por zona. Elige una zona para ver solo sus cifras."
            : `Precios, crimen, prensa y conversación en ${nombre}. Cada cifra dice de dónde viene y qué no se puede concluir de ella.`}
        </p>

        <Contexto zona={zona} vista={null} conteos />
      </div>
    </header>
  );
}

/**
 * El encabezado de una pagina interior. El `titulo` que recibe ES el h1, asi
 * que la seccion de abajo ya no lleva h2: dos titulos que dicen lo mismo, uno
 * debajo del otro, era el eco que dejaba la pagina unica al partirse.
 */
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
      <div className="entrada">
        <h1 className="font-titular text-seccion text-tinta-titulo">{titulo}</h1>

        <Fechado zona={zona} />

        <p className="mt-6 max-w-[65ch] text-lectura text-tinta-prosa">{entrada}</p>

        <Contexto zona={zona} vista={vista} conteos={false} />
      </div>
    </header>
  );
}
