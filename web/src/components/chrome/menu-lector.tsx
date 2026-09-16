import Link from "next/link";

import { cerrarSesion } from "@/lib/acceso/acciones";
import {
  SUELTAS,
  VISTAS,
  nombreVista,
  ruta,
  type PaginaSuelta,
  type Vista,
} from "@/lib/dominio/secciones";
import type { ZonaRuta } from "@/lib/dominio/zonas";

/**
 * La navegacion del sitio dentro del lector.
 *
 * Existe porque el lector a pantalla completa oculta todo lo demas
 * (globals.css, `main:has(.lector)`) y la pildora flotante solo vuelve a
 * partir de 48rem. Mientras el lector fue una pagina interior daba igual: la
 * flecha de volver llevaba a una pagina normal con su nav. Desde el 15 de
 * septiembre de 2026 la PORTADA es un lector, y en un telefono esto es la
 * unica salida hacia Prensa, Redes, Indicadores, las sueltas y Salir.
 *
 * Componente de SERVIDOR, y baja al lector como prop `menu`, por el mismo
 * canal que `informacion` y el Pie que va dentro. No es un detalle de estilo:
 * el lector es un componente de cliente, y una accion de servidor —la de
 * Salir— no se puede renderizar desde un modulo de cliente. Construir esta
 * lista alli dejaria «Salir» fuera del telefono, que es justo el sitio donde
 * es la unica manera de cerrar sesion. Importar `NavPildora` tampoco vale: es
 * el error que AGENTS.md documenta para /garitas, y arrastraria sus iconos de
 * `dist/ssr` al bundle.
 *
 * Es el MISMO par de listas que la pildora —`VISTAS` y `SUELTAS`— para que la
 * nav siga saliendo de una sola declaracion. Lo que no trae es el eje de
 * LUGAR: ese se elige en el otro dialogo de la barra, y mezclarlos aqui
 * volveria a juntar los dos ejes que la pildora separa a proposito.
 */
const RENGLON = "flex w-full items-center justify-between rounded-nucleo px-4 py-3 text-cuerpo transition-colors";

export function MenuLector({
  zona,
  vista,
  pagina,
}: {
  zona: ZonaRuta | null;
  vista: Vista;
  pagina?: PaginaSuelta;
}) {
  return (
    <nav aria-label="Páginas" className="p-2 pb-4">
      <ul>
        {VISTAS.map((v) => {
          const actual = pagina === undefined && v === vista;
          return (
            <li key={v ?? "portada"}>
              <Link
                href={ruta(zona, v)}
                aria-current={actual ? "page" : undefined}
                className={`${RENGLON} ${actual ? "bg-realce text-tinta-titulo" : "text-tinta-prosa hover:bg-vela hover:text-tinta-titulo"}`}
              >
                {nombreVista(v)}
                {actual ? <span aria-hidden>✓</span> : null}
              </Link>
            </li>
          );
        })}
        {SUELTAS.map((s) => (
          <li key={s.ruta}>
            <Link
              href={s.ruta}
              aria-current={pagina === s.id ? "page" : undefined}
              className={`${RENGLON} ${pagina === s.id ? "bg-realce text-tinta-titulo" : "text-tinta-prosa hover:bg-vela hover:text-tinta-titulo"}`}
            >
              {s.nombre}
              {pagina === s.id ? <span aria-hidden>✓</span> : null}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-2 border-t border-filo pt-2">
        <form action={cerrarSesion}>
          <button type="submit" className={`${RENGLON} text-tinta-prosa hover:bg-vela hover:text-tinta-titulo`}>
            Salir
          </button>
        </form>
      </div>
    </nav>
  );
}
