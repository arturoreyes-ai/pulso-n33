import Link from "next/link";
import { House } from "@phosphor-icons/react/dist/ssr";
import { ViewTransition, type ReactNode } from "react";

import { MenuLector } from "@/components/chrome/menu-lector";
import { MenuCinta } from "@/components/chrome/menu-cinta";
import { Cinta } from "@/components/chrome/cinta";
import { OpcionesZona } from "@/components/chrome/opciones-zona";
import { CuentaPastilla } from "@/components/chrome/quien-mira";
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
 * pagina. Hoy son cinco enlaces y ninguno es ancla. Lo que cambio no
 * es el recorte sino la estructura: el tablero tiene DOS EJES —que miras y
 * donde— y la pildora los muestra separados por un filo, en vez de
 * mezclarlos en una sola tira que en movil habia que arrastrar.
 *
 *   [ ⌂ Pulso | Redes  Indicadores | Garitas  Gasto electoral  (AR) ]
 *     inicio    las vistas            las sueltas               la cuenta
 *
 * El segundo filo separa las VISTAS, que viven en la rejilla lugar x vista,
 * de las SUELTAS, que no: sin el, la tira decia en una sola fila dos cosas
 * que el resto del tablero trata distinto.
 *
 * (AR) son las iniciales de quien mira; al pulsarlas la pastilla crece con su
 * nombre y «Salir» (chrome/quien-mira.tsx). Salir sin decir QUIEN sale era la
 * mitad de la informacion.
 *
 * Las cuatro vistas del centro CONSERVAN la zona, y los chips del selector
 * conservan la vista (ver lib/dominio/secciones.ts::ruta). Cruzar de
 * /ensenada/redes a /tecate/redes es un clic, no tres.
 *
 * La casa ES la portada. Hasta el 24 de septiembre de 2026 la pastilla
 * llevaba la casa, que iba a `/`, y ademas «En Tendencia», que iba a la
 * portada de la zona: dos enlaces a casi lo mismo en una tira de siete. Salio
 * «En Tendencia» a pedido del cliente, y la casa heredo lo suyo: CONSERVA la
 * zona (`ruta(zona, null)`) y lleva el `aria-current` en la portada. Cambiar
 * de zona ya es un toque en la barra de cada pagina. En el menu del telefono
 * «En Tendencia» sigue como renglon, porque alli no hay casa.
 *
 * Componente de servidor. El unico cliente es next/link, cuyo chunk ya lo
 * carga el selector de zona en cada pagina, asi que el costo marginal es cero
 * y cambiar de vista es instantaneo sobre el cache de SWR: los JSON de la
 * vista anterior siguen ahi.
 *
 * "Salir" es un <form> con una accion de servidor (lib/acceso/acciones.ts),
 * no un boton de cliente: cerrar sesion tampoco necesita JavaScript propio.
 */

const PASTILLA =
  "block rounded-full px-3 py-2 text-meta transition-[color,background-color,scale] duration-[var(--dur-toque)] ease-out active:scale-[0.97] md:px-4";

/** El filo que separa los dos ejes. Decorativo: no va al arbol accesible. */
function Filo() {
  return <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-filo" />;
}

/**
 * El fondo de la pestana activa, compartido entre paginas.
 *
 * Cada pagina monta su propia `Navegacion`, asi que una transicion de CSS no
 * tiene de donde partir: la pestana nueva es otro nodo. Con el mismo `name`
 * en la pagina vieja y en la nueva, `<ViewTransition>` de React empareja los
 * dos fondos y el navegador desliza uno hasta el otro durante la navegacion.
 * `default="none"` con `share` explicito es la pareja que dice la guia de
 * Next: sin `share`, con `none`, deja de morfear en silencio. Donde no hay
 * View Transitions, o la pagina de destino suspende antes de pintarse, el
 * fondo aparece en su lugar, como antes.
 */
function Realce() {
  return (
    <ViewTransition name="pestana-activa" share="pestana-activa" default="none">
      <span aria-hidden className="absolute inset-0 rounded-full bg-realce" />
    </ViewTransition>
  );
}

function Pestana({ href, actual, children }: { href: string; actual: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={actual ? "page" : undefined}
      className={`${PASTILLA} relative ${
        actual ? "text-tinta-titulo" : "text-tinta-prosa hover:bg-filo hover:text-tinta-titulo"
      }`}
    >
      {actual ? <Realce /> : null}
      <span className="relative">{children}</span>
    </Link>
  );
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
  const enPortada = fuera === undefined && pagina === undefined && vista === null;
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
          href={ruta(zona, null)}
          aria-label={zona === null ? "Pulso, inicio" : `Pulso, inicio en ${NOMBRE_CORTO[zona]}`}
          aria-current={enPortada ? "page" : undefined}
          className={`${PASTILLA} relative inline-flex shrink-0 items-center gap-1.5 font-medium ${
            enPortada ? "text-tinta-titulo" : "text-tinta-titulo hover:bg-filo"
          }`}
        >
          {enPortada ? <Realce /> : null}
          <House size={14} weight="light" aria-hidden className="relative" />
          <span className="relative max-sm:sr-only">Pulso</span>
        </Link>

        <Filo />

        <ul className="flex shrink-0 items-center gap-1 whitespace-nowrap">
          {VISTAS.filter((v) => v !== null).map((v) => {
            const actual = enRejilla && v === vista;
            return (
              <li key={v} className="shrink-0">
                <Pestana href={ruta(zona, v)} actual={actual}>
                  {nombreVista(v)}
                </Pestana>
              </li>
            );
          })}
        </ul>

        <Filo />

        <ul className="flex shrink-0 items-center gap-1 whitespace-nowrap">
          {SUELTAS.map((s) => (
            <li key={s.ruta} className="shrink-0">
              <Pestana href={s.ruta} actual={pagina === s.id}>
                {s.nombre}
              </Pestana>
            </li>
          ))}
        </ul>

        <CuentaPastilla>
          <form action={cerrarSesion} className="shrink-0">
            <button
              type="submit"
              className={`${PASTILLA} text-tinta-prosa hover:bg-filo hover:text-tinta-titulo`}
            >
              Salir
            </button>
          </form>
        </CuentaPastilla>
      </nav>
    </div>
    </>
  );
}
