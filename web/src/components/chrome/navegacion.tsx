import { Cinta } from "@/components/chrome/cinta";
import { OpcionesZona } from "@/components/chrome/opciones-zona";
import { Riel } from "@/components/chrome/riel";
import { SUELTAS, nombreVista, ruta, type PaginaSuelta, type Vista } from "@/lib/dominio/secciones";
import { NOMBRE_CORTO, NOMBRE_TODA_REGION, type ZonaRuta } from "@/lib/dominio/zonas";

/**
 * La navegacion de una pagina: la CINTA arriba en el telefono, que dice donde
 * se esta y elige el lugar, y la navegacion del sitio (chrome/riel.tsx), que
 * es un riel a la izquierda en escritorio y una barra de pestanas abajo en el
 * telefono.
 *
 * Hasta el 28 de septiembre de 2026 aqui vivia la PASTILLA flotante de
 * escritorio, con las vistas, las sueltas y la cuenta en una tira, y la cinta
 * traia un boton de menu con la misma lista. La pastilla se fue al riel (el
 * porque esta en chrome/riel.tsx) y el menu de la cinta a la cuarta pestana,
 * «Más». La cinta se queda con lo que ninguna de las dos dice: el nombre de la
 * pagina, el lugar y la flecha a la pagina padre. En escritorio la cinta no se
 * pinta (`.cinta-pagina` en globals.css): alli cada pagina tiene su h1.
 *
 * Las dos salen de la MISMA lista —`VISTAS` y `SUELTAS`—, asi que la nav sigue
 * teniendo una sola declaracion. Las vistas CONSERVAN la zona (ver
 * lib/dominio/secciones.ts::ruta): cruzar de /ensenada a /ensenada/redes es un
 * toque, y cambiar de zona es un toque en la barra de cada pagina.
 *
 * Componente de servidor: se monta desde el `page.tsx` de cada ruta, nunca
 * desde un tablero de cliente, que arrastraria la accion de «Salir» y los
 * iconos de `dist/ssr` al bundle (el error que AGENTS.md documenta para
 * /garitas).
 */

/**
 * El rotulo y el valor de la cinta: la pagina arriba, el lugar abajo.
 *
 * El rotulo sale de `nombreVista`/`SUELTAS` y no de una plantilla nueva, que es
 * lo que evita que la cinta diga «Indicadores en Tijuana» mientras la pestana
 * del navegador dice «Indicadores de Tijuana».
 *
 * El valor de una suelta no es su nombre repetido: es el LUGAR del que habla.
 * «El corredor» ya existe en lib/busqueda/capitulos.ts, que ademas deja escrito
 * que no es «toda la región» sino sus dos polos, Tijuana y San Diego — que es
 * literalmente lo que /garitas mide. Y el gasto electoral es de Baja
 * California: decir «toda la región» seria falso, porque la region incluye San
 * Diego y ahi no hay dictamen del INE.
 */
const LUGAR_SUELTA: Record<PaginaSuelta, string> = {
  garitas: "El corredor",
  "gasto-electoral": "Baja California",
  // No es un lugar: son las publicaciones que el equipo eligio, de donde sean.
  seguimiento: "Publicaciones",
  // Tampoco: un programa no es de un lugar. Rotulo y valor dicen el nombre
  // entero, «Guion / Para locución».
  guion: "Para locución",
  reportes: "Términos en seguimiento",
};

function rotuloDe(vista: Vista, pagina: PaginaSuelta | undefined, fuera: string | undefined): string {
  if (fuera !== undefined) return "Pulso";
  if (pagina !== undefined) return SUELTAS.find((s) => s.id === pagina)?.nombre ?? nombreVista(vista);
  return nombreVista(vista);
}

function valorDe(zona: ZonaRuta | null, pagina: PaginaSuelta | undefined, fuera: string | undefined): string {
  if (fuera !== undefined) return fuera;
  if (pagina !== undefined) return LUGAR_SUELTA[pagina];
  return zona === null ? NOMBRE_TODA_REGION : NOMBRE_CORTO[zona];
}

export function Navegacion({
  zona,
  vista,
  pagina,
  fuera,
}: {
  zona: ZonaRuta | null;
  vista: Vista;
  pagina?: PaginaSuelta;
  /**
   * Una pagina que NO esta en la nav: la de 404 y Accesos.
   *
   * Sin esto, `vista: null` se lee como la portada: la cinta decia «En
   * Tendencia» estando en un 404 y la nav ponia `aria-current="page"` sobre el
   * enlace de la portada, o sea que anunciaba al lector que estaba en una
   * pagina en la que no estaba. Compila, typechequea y se ve bien.
   */
  fuera?: string;
}) {
  // El eje de LUGAR solo existe en la rejilla: una suelta y la de 404 no
  // tienen zona que elegir, y un caret que no abre nada seria una mentira
  // sobre el glifo (ver chrome/lugar-cinta.tsx).
  const enRejilla = fuera === undefined && pagina === undefined && vista !== null;
  return (
    <>
      <Cinta
        // La flecha lleva a la portada de esta zona, que es la pagina padre en
        // la rejilla. Una suelta no tiene padre: ahi no se pinta.
        volver={enRejilla ? ruta(zona, null) : undefined}
        rotulo={rotuloDe(vista, pagina, fuera)}
        valor={valorDe(zona, pagina, fuera)}
        tituloLugar="Lugar"
        lugares={enRejilla ? <OpcionesZona zona={zona} vista={vista} /> : undefined}
      />
      <Riel zona={zona} vista={vista} pagina={pagina} fuera={fuera !== undefined} />
    </>
  );
}
