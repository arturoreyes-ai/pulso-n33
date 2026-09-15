import Link from "next/link";
import { House } from "@phosphor-icons/react/dist/ssr";

import { cerrarSesion } from "@/lib/acceso/acciones";
import {
  SUELTAS,
  VISTAS,
  nombreVista,
  ruta,
  type PaginaSuelta,
  type Vista,
} from "@/lib/dominio/secciones";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";

/**
 * Nav flotante en pastilla de cristal, despegada de la orilla superior.
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

export function NavPildora({
  zona,
  vista,
  pagina,
}: {
  zona: ZonaRuta | null;
  vista: Vista;
  pagina?: PaginaSuelta;
}) {
  return (
    // El contenedor solo centra: mide todo el ancho de la ventana, asi que sin
    // `pointer-events-none` se traga los clics en los ~280px de vacio a cada
    // lado de la pastilla. La pastilla los vuelve a aceptar.
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[var(--z-nav)] mt-4 flex justify-center px-3 md:mt-6 md:px-4">
      <nav
        aria-label="Tablero"
        className="pointer-events-auto mx-auto flex max-w-full items-center overflow-x-auto rounded-full border border-filo bg-black/40 px-2 py-2 shadow-bisel backdrop-blur-xl [scrollbar-width:none]"
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
            const actual = pagina === undefined && v === vista;
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

        {pagina === undefined ? (
          <>
            <Filo />

            {/* El otro eje. Es un ancla y no un enlace: el selector de zona esta
                en el encabezado de ESTA pagina, unas lineas mas abajo, y llevarlo
                a la pildora significaria repetir nueve chips en cada corte. */}
            <a
              href="#zonas"
              className={`${PASTILLA} shrink-0 whitespace-nowrap text-tinta-dato hover:bg-filo hover:text-tinta-titulo`}
            >
              {zona === null ? "Toda la región" : NOMBRE_CORTO[zona]}
            </a>
          </>
        ) : null}

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
  );
}
