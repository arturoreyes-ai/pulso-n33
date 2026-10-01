import Link from "next/link";
import { Check } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

import { RenglonCuenta, SoloAdmin } from "@/components/chrome/quien-mira";
import { cerrarSesion } from "@/lib/acceso/acciones";
import { analisisHabilitado } from "@/lib/analisis/config";
import {
  VISTAS,
  esSoloAdmin,
  nombreVista,
  ruta,
  sueltasVisibles,
  type PaginaSuelta,
  type Vista,
} from "@/lib/dominio/secciones";
import type { ZonaRuta } from "@/lib/dominio/zonas";

/**
 * El contenido de «Más», la cuarta pestana del telefono (chrome/riel.tsx):
 * las herramientas que no son pestana y la cuenta con «Salir».
 *
 * Nacio el 15 de septiembre de 2026 como el menu de la barra del lector,
 * cuando la PORTADA se hizo lector y en un telefono este era la unica salida
 * hacia Redes, las sueltas y «Salir». El nombre se queda por la historia; el
 * boton del lector se retiro el 28 de septiembre de 2026 con la barra de
 * pestanas.
 *
 * Componente de SERVIDOR, y baja a la hoja como `children`. No es un detalle
 * de estilo: la hoja es de cliente, y una accion de servidor —la de «Salir»—
 * no se puede renderizar desde un modulo de cliente.
 *
 * Sale de las mismas listas que el riel —`VISTAS` y `SUELTAS`— para que la nav
 * siga teniendo una sola declaracion. No trae el eje de LUGAR: ese se elige en
 * la barra de cada pagina.
 *
 * NO lleva pie, y ya no existe ninguno. Llevo uno unas horas del 18 de
 * septiembre de 2026, cuando el dialogo «Acerca de» se quito y el pie del sitio
 * se mudo aqui; ese mismo dia el cliente pidio quitarlo de TODO el tablero, no
 * mudarlo (ver docs/PLAN.md). Aqui solo hay navegacion.
 *
 * TRES GRUPOS CON NOMBRE desde el 28 de septiembre de 2026: las vistas, las
 * herramientas y la cuenta. Era una sola lista de siete renglones iguales.
 * Desde ese mismo dia el telefono navega con una barra de pestanas abajo
 * (chrome/riel.tsx) y esto es lo que abre su cuarta pestana, «Más»: sin las
 * vistas (`conVistas={false}`) y sin las sueltas que ya son pestana
 * (`excepto`). Los lectores ya no llevan boton de menu propio. Cada suelta
 * lleva su `descripcion` (lib/dominio/secciones.ts).
 *
 * La palomita es un icono de Phosphor y no «✓»: un glifo de texto cambia de
 * grosor y de alto con la fuente y no es de la familia de iconos del sitio.
 */
const RENGLON = "flex w-full items-center justify-between gap-3 rounded-nucleo px-4 py-3 text-cuerpo transition-colors";

const claseRenglon = (actual: boolean) =>
  `${RENGLON} ${actual ? "bg-realce text-tinta-titulo" : "text-tinta-prosa hover:bg-vela hover:text-tinta-titulo"}`;

/** El nombre de un grupo. Un `<h3>`: el `<h2>` es el titulo de la hoja (o el
 *  oculto del panel de escritorio), y los grupos parten la lista en regiones
 *  que un lector de pantalla puede saltar. */
function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="grid gap-1">
      <h3 className="px-4 pt-3 pb-1 text-meta text-tinta-meta">{titulo}</h3>
      <ul>{children}</ul>
    </section>
  );
}

const Palomita = () => <Check size={16} weight="bold" aria-hidden className="shrink-0 text-tinta-titulo" />;

export function MenuLector({
  zona,
  vista,
  pagina,
  fuera = false,
  conVistas = true,
  excepto = [],
}: {
  zona: ZonaRuta | null;
  vista: Vista;
  pagina?: PaginaSuelta;
  /**
   * Esta pagina no es ninguna de la lista; hoy solo la de 404.
   *
   * Hace falta una BANDERA y no basta con pasar `vista: null`, porque `null`
   * no significa «ninguna»: significa la portada, que es una vista de pleno
   * derecho. Sin esto el menu de un 404 abria con «En Tendencia» palomeada,
   * diciendole al lector que estaba en una pagina en la que no estaba.
   */
  fuera?: boolean;
  /** Sin las vistas: en «Más» ya estan en la barra de pestanas. */
  conVistas?: boolean;
  /** Las sueltas que ya tienen pestana propia en el telefono (chrome/riel.tsx). */
  excepto?: readonly string[];
}) {
  return (
    <nav aria-label="Páginas" className="grid gap-2 p-2 pb-4">
      {conVistas ? (
        <Grupo titulo="Secciones">
          {VISTAS.map((v) => {
            const actual = !fuera && pagina === undefined && v === vista;
            return (
              <li key={v ?? "portada"}>
                <Link href={ruta(zona, v)} aria-current={actual ? "page" : undefined} className={claseRenglon(actual)}>
                  {nombreVista(v)}
                  {actual ? <Palomita /> : null}
                </Link>
              </li>
            );
          })}
        </Grupo>
      ) : null}

      <Grupo titulo="Herramientas">
        {sueltasVisibles(analisisHabilitado()).filter((s) => !excepto.includes(s.id)).map((s) => {
          const actual = pagina === s.id;
          const renglon = (
            <li key={s.ruta}>
              <Link href={s.ruta} aria-current={actual ? "page" : undefined} className={claseRenglon(actual)}>
                <span className="grid min-w-0 gap-0.5">
                  <span>{s.nombre}</span>
                  <span className="truncate text-meta text-tinta-meta">{s.descripcion}</span>
                </span>
                {actual ? <Palomita /> : null}
              </Link>
            </li>
          );
          return esSoloAdmin(s) ? <SoloAdmin key={s.ruta}>{renglon}</SoloAdmin> : renglon;
        })}
      </Grupo>

      {/* La cuenta y su salida van juntas: «Salir» sin decir quien sale era
          la mitad de la informacion. */}
      <div className="border-t border-filo pt-2">
        <RenglonCuenta className="px-4 pt-2 pb-3" />
        <form action={cerrarSesion}>
          <button type="submit" className={claseRenglon(false)}>
            Salir
          </button>
        </form>
      </div>
    </nav>
  );
}
