import Link from "next/link";
import { House } from "@phosphor-icons/react/dist/ssr";

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
 * escala de este nav, ese token se ajusta.
 *
 * El primer elemento es la casa: vuelve a la region completa desde cualquier
 * pagina, incluida la 404. Antes no habia camino de regreso mas que el chip
 * "Toda la region" del selector, que se va con el scroll. El segundo dice en
 * que zona esta el lector y lleva al selector.
 *
 * Componente de servidor. El unico cliente es next/link, cuyo chunk ya lo
 * carga el selector de zona en cada pagina, asi que el costo marginal es
 * cero y volver al inicio es instantaneo sobre el cache de SWR.
 */

const CLASES_PILDORA =
  "block rounded-full bg-filo px-3 py-2 text-[12px] font-medium text-tinta-titulo transition-all duration-700 ease-firma hover:bg-realce md:px-4 md:text-[13px]";

const SECCIONES = [
  { id: "indicadores", nombre: "Indicadores" },
  { id: "temas", nombre: "Temas" },
  { id: "conversacion", nombre: "Conversación" },
  { id: "cobertura", nombre: "Cobertura" },
  { id: "muro", nombre: "Muro" },
] as const;

export function NavPildora({ zona }: { zona: ZonaRuta | null }) {
  return (
    // El contenedor solo centra: mide todo el ancho de la ventana, asi que sin
    // `pointer-events-none` se traga los clics en los ~280px de vacio a cada
    // lado de la pastilla. La pastilla los vuelve a aceptar.
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[var(--z-nav)] mt-4 flex justify-center px-3 md:mt-6 md:px-4">
      <nav
        aria-label="Secciones"
        className="pointer-events-auto mx-auto max-w-full overflow-x-auto rounded-full border border-filo bg-black/40 px-2 py-2 shadow-bisel backdrop-blur-xl [scrollbar-width:none]"
      >
        <ul className="flex items-center gap-1 whitespace-nowrap">
          <li>
            <Link
              href="/"
              aria-label="Pulso N33, toda la región"
              aria-current={zona === null ? "page" : undefined}
              className={`${CLASES_PILDORA} inline-flex items-center gap-1.5`}
            >
              <House size={14} weight="light" aria-hidden />
              <span className="max-sm:sr-only">Pulso N33</span>
            </Link>
          </li>
          <li>
            <a href="#zonas" className={CLASES_PILDORA}>
              {zona === null ? "Toda la región" : NOMBRE_CORTO[zona]}
            </a>
          </li>
          {SECCIONES.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="block rounded-full px-3 py-2 text-[12px] text-tinta-prosa transition-all duration-700 ease-firma hover:bg-filo hover:text-tinta-titulo md:px-4 md:text-[13px]"
              >
                {s.nombre}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
