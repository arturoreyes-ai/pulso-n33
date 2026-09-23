import Link from "next/link";
import { House } from "@phosphor-icons/react/dist/ssr";

import { MenuLector } from "@/components/chrome/menu-lector";
import { MenuCinta } from "@/components/chrome/menu-cinta";
import { Cinta } from "@/components/chrome/cinta";
import { OpcionesZona } from "@/components/chrome/opciones-zona";
import { cerrarSesion } from "@/lib/acceso/acciones";
import {
  SUELTAS,
  VISTAS,
  nombreVista,
  ruta,
  tituloSeccion,
  type PaginaSuelta,
  type Vista,
} from "@/lib/dominio/secciones";
import { NOMBRE_CORTO, NOMBRE_TODA_REGION, type ZonaRuta } from "@/lib/dominio/zonas";

/**
 * La navegacion del sitio: una cinta en el telefono, una pastilla de cristal
 * en escritorio.
 *
 * DEVUELVE DOS NAVEGACIONES, una por ancho, y solo una se ve. A partir de
 * 48rem, la pastilla de aqui abajo; debajo de ese ancho, la CINTA
 * (chrome/cinta.tsx), que es la misma barra que llevan la portada y redes. El
 * caso, medido el 18 de septiembre de 2026 en /tijuana/indicadores a 375px: la
 * tira pedia 635px de ancho en 350px disponibles, asi que 285px —el 45% de la
 * nav— vivian detras de un desplazamiento horizontal que nada anuncia.
 * «Garitas» salia partida por la mitad; «Gasto electoral» y «Salir» no
 * aparecian, o sea que cerrar sesion desde un telefono no habia forma de
 * descubrirlo. La primera respuesta fue una pastilla chica y propia para el
 * telefono, y el cliente señalo lo que eso dejaba: dos gramaticas de barra a un
 * toque una de otra. Esta es la segunda respuesta.
 *
 * Quien decide cual se ve es globals.css, no este archivo: `.nav-flotante`
 * tiene su `display` alli, junto a la exencion que la devuelve sobre un lector
 * en escritorio, y `.cinta-pagina` se apaga a partir de 48rem. Las dos reglas
 * tienen que leerse juntas y por eso viven juntas.
 *
 * Las dos salen de la MISMA lista —`VISTAS` y `SUELTAS`—, la pastilla como
 * tira y la cinta a traves de `MenuLector`, asi que la nav sigue teniendo una
 * sola declaracion.
 *
 * `backdrop-blur-xl` es legitimo aqui: elemento fijo, area chica, se pinta una
 * vez. Lo que el arquetipo prohibe es blur sobre contenedores que hacen scroll
 * o sobre areas grandes de contenido.
 *
 * No se sostiene sola: `Velo` apaga el contenido que sube hacia esta orilla.
 * Sin el velo, `bg-black/40` deja leer los titulares a traves de la pildora.
 * Su alto lo publica `--nav-alto` en globals.css; si cambia el padding o la
 * escala de este nav, ese token se ajusta. Los separadores son `h-4`, mas
 * bajos que las pastillas, asi que no lo mueven.
 *
 * LLEVABA DIEZ PASTILLAS y ocho de ellas eran anclas a secciones de la misma
 * pagina. Ahora son siete y la unica ancla es la del lugar. Lo que cambio no
 * es el recorte sino la estructura: el tablero tiene DOS EJES —que miras y
 * donde— y la pildora los muestra separados por un filo, en vez de
 * mezclarlos en una sola tira que en movil habia que arrastrar.
 *
 *   [ ⌂ Pulso ] | Tendencias  Redes  Indicadores  Garitas | [ Tijuana ] | Salir
 *      inicio          la vista, con la actual marcada, y las sueltas   el lugar    la sesion
 *
 * Las cuatro vistas del centro CONSERVAN la zona, y los chips del selector
 * conservan la vista (ver lib/dominio/secciones.ts::ruta). Cruzar de
 * /ensenada/redes a /tecate/redes es un clic, no tres.
 *
 * La casa lleva a `/`, o sea a la region completa y a la portada: es el unico
 * elemento que suelta la zona, y de ahi que no comparta el `aria-current` con
 * "Tendencias", que en /tijuana apunta a /tijuana.
 *
 * Componente de servidor. El unico cliente es next/link, cuyo chunk ya lo
 * carga el selector de zona en cada pagina, asi que el costo marginal es cero
 * y cambiar de vista es instantaneo sobre el cache de SWR: los JSON de la
 * vista anterior siguen ahi.
 *
 * "Salir" es un <form> con una accion de servidor (lib/acceso/acciones.ts),
 * no un boton de cliente: cerrar sesion tampoco necesita JavaScript propio.
 */

const PASTILLA = "block rounded-full px-3 py-2 text-meta transition-colors md:px-4";

/** El filo que separa los dos ejes. Decorativo: no va al arbol accesible. */
function Filo() {
  return <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-filo" />;
}

/** El cristal de la pastilla. Solo existe a partir de 48rem: debajo de ese
 *  ancho la nav es la cinta (chrome/cinta.tsx). */
const VIDRIO = "pointer-events-auto flex items-center rounded-full border border-filo bg-black/40 px-2 py-2 shadow-bisel backdrop-blur-xl";

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
   * Una pagina que NO esta en la nav; hoy solo la de 404.
   *
   * Sin esto, `vista: null` se lee como la portada: la cinta decia «En
   * Tendencia» estando en un 404 y la pastilla ponia `aria-current="page"`
   * sobre el enlace de la portada, o sea que anunciaba al lector que estaba en
   * una pagina en la que no estaba. Compila, typechequea y se ve bien.
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
        // la rejilla. Una suelta no tiene padre: ahi no se pinta, y «En
        // Tendencia» esta a un renglon dentro del menu.
        volver={enRejilla ? ruta(zona, null) : undefined}
        rotulo={rotuloDe(vista, pagina, fuera)}
        valor={valorDe(zona, pagina, fuera)}
        tituloLugar="Lugar"
        lugares={enRejilla ? <OpcionesZona zona={zona} vista={vista} /> : undefined}
        menu={
          <MenuCinta>
            <MenuLector zona={zona} vista={vista} pagina={pagina} fuera={fuera !== undefined} />
          </MenuCinta>
        }
      />

      {/* El contenedor solo centra: mide todo el ancho de la ventana, asi que
          sin `pointer-events-none` se traga los clics en los ~280px de vacio a
          cada lado de la pastilla. La pastilla los vuelve a aceptar.

          `nav-flotante` es el asidero de globals.css, y ahi vive su `display`:
          la pastilla solo flota a partir de 48rem, y cuando una pagina monta el
          lector a pantalla completa es la unica excepcion a la regla que oculta
          todo lo demas de <main>. */}
      <div className="nav-flotante pointer-events-none fixed inset-x-0 top-0 z-[var(--z-nav)] mt-4 justify-center px-3 md:mt-6 md:px-4">
      <nav
        aria-label="Tablero"
        className={`${VIDRIO} mx-auto max-w-full overflow-x-auto [scrollbar-width:none]`}
      >
        <Link
          href="/"
          aria-label="Pulso, toda la región"
          className={`${PASTILLA} inline-flex shrink-0 items-center gap-1.5 font-medium text-tinta-titulo hover:bg-filo`}
        >
          <House size={14} weight="light" aria-hidden />
          <span className="max-sm:sr-only">Pulso</span>
        </Link>

        <Filo />

        <ul className="flex shrink-0 items-center gap-1 whitespace-nowrap">
          {VISTAS.map((v) => {
            // `fuera` tambien: en la de 404 `vista` es null y sin esta
            // guarda la pastilla marcaba la portada como pagina actual.
            const actual = fuera === undefined && pagina === undefined && v === vista;
            return (
              <li key={v ?? "portada"} className="shrink-0">
                <Link
                  href={ruta(zona, v)}
                  aria-current={actual ? "page" : undefined}
                  className={`${PASTILLA} ${
                    actual
                      ? "bg-realce text-tinta-titulo"
                      : "text-tinta-prosa hover:bg-filo hover:text-tinta-titulo"
                  }`}
                >
                  {nombreVista(v)}
                </Link>
              </li>
            );
          })}
          {SUELTAS.map((s) => (
            <li key={s.ruta} className="shrink-0">
              <Link
                href={s.ruta}
                aria-current={pagina === s.id ? "page" : undefined}
                className={`${PASTILLA} ${
                  pagina === s.id
                    ? "bg-realce text-tinta-titulo"
                    : "text-tinta-prosa hover:bg-filo hover:text-tinta-titulo"
                }`}
              >
                {s.nombre}
              </Link>
            </li>
          ))}
        </ul>

        {/* Aqui iba la pastilla del LUGAR, un ancla a #zonas. Salio el 23 de
            septiembre de 2026 a pedido del cliente: la portada ya no la
            pintaba, y en Redes repetia en la pildora lo que la barra del
            lector dice y elige («Tijuana»), con otra forma. Cada pagina de la
            rejilla elige su lugar en su propia barra (lector o cinta). */}

        <Filo />

        <form action={cerrarSesion} className="shrink-0">
          <button
            type="submit"
            className={`${PASTILLA} text-tinta-prosa hover:bg-filo hover:text-tinta-titulo`}
          >
            Salir
          </button>
        </form>
      </nav>
    </div>
    </>
  );
}
