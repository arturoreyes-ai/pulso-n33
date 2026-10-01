import Link from "next/link";
import { Binoculars, Files, Megaphone, PiggyBank, TrendUp } from "@phosphor-icons/react/dist/ssr";
import { ViewTransition } from "react";

import { IconoAutos, IconoGuion } from "@/components/chrome/iconos-nav";
import { MenuLector } from "@/components/chrome/menu-lector";
import { SoloAdmin } from "@/components/chrome/quien-mira";
import { CuentaRiel, PestanaMas } from "@/components/chrome/riel-cliente";
import { cerrarSesion } from "@/lib/acceso/acciones";
import { analisisHabilitado } from "@/lib/analisis/config";
import { esSoloAdmin, nombreVista, ruta, sueltasVisibles, type PaginaSuelta, type Vista } from "@/lib/dominio/secciones";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";

/**
 * La navegacion del sitio: un RIEL a la izquierda en escritorio y una BARRA
 * DE PESTANAS abajo en el telefono.
 *
 * EL CASO, 28 de septiembre de 2026. La pastilla flotante de arriba decia en
 * una tira «Pulso | Redes | Garitas  Gasto electoral  Seguimiento  Guion (UD)
 * Usuario de desarrollo · Accesos  Salir», y el cliente la vio apretada. La
 * primera respuesta, ese mismo dia, fue esconder cuatro destinos detras de un
 * boton de menu, y el cliente no quedo convencido, con razon: escondia las
 * herramientas de trabajo diario para que la tira se viera ordenada.
 *
 * La razon de fondo no era el ancho sino el ALTO. Las dos paginas principales
 * —En Tendencia y Redes— son lectores verticales de una pieza por pantalla, y
 * una barra arriba les quita alto, que en escritorio es lo que escasea: lo que
 * sobra es ancho. Por eso TikTok, Instagram y YouTube en la web ponen la
 * navegacion en un riel lateral. Aqui igual: el riel ocupa 6rem de un ancho
 * que el lector no usa, y la caja del lector recupera los 80px de la pastilla.
 *
 * DOS GRUPOS, por lo que se hace y no por donde vive la pagina:
 *
 *   PULSO          la marca (a la portada de la zona)
 *   En Tendencia   ─┐
 *   Redes           ├ leer: lo que pasa ahora
 *   Garitas        ─┘
 *   ─────
 *   Guion          ─┐
 *   Seguimiento     ├ producir y consultar
 *   Gasto electoral─┘
 *   (AR)           la cuenta, abajo
 *
 * En Tendencia va primero porque es la que el equipo usa todos los dias
 * (cliente, 28 de septiembre de 2026). Garitas sube al primer grupo aunque
 * sea una suelta: es un briefing de lo que pasa ahora, como las otras dos. La
 * rejilla lugar x vista sigue intacta por dentro (`ruta`, `sueltasVisibles`);
 * lo que cambia es como se AGRUPA en pantalla.
 *
 * EN EL TELEFONO, cuatro pestanas al alcance del pulgar: En Tendencia, Redes,
 * Guion y «Más», que abre la hoja con Garitas, Seguimiento, Gasto electoral y
 * la cuenta. Hasta el 30 de septiembre de 2026 la tercera era Garitas y Guion
 * iba en «Más»; ese dia el cliente pidio cambiarlas. Sin la lectura con IA la
 * pagina de Guion no existe, y entonces Garitas vuelve a su lugar
 * (`pestanasDe`): la barra es una rejilla de cuatro columnas
 * (`.barra-inferior`), y una pestana que simplemente desapareciera dejaria un
 * hueco y moveria «Más».
 *
 * El marcador activo es una pastilla detras del ICONO, no un bloque detras del
 * renglon entero (29 de septiembre de 2026): el bloque de 84x66 pesaba mas que
 * todo lo que tenia al lado y era otra gramatica que la de la barra del
 * telefono, que ya marcaba asi. Es el fondo `Realce`, compartido entre paginas
 * por View Transitions: al navegar se desliza de un icono al siguiente. Dos
 * nombres, uno por superficie, porque React avisa si dos `<ViewTransition>`
 * montados a la vez comparten nombre, aunque uno este en `display: none`.
 *
 * Quien decide cual se ve es globals.css (`.riel`, `.barra-inferior`), junto a
 * la regla que esconde todo lo demas de <main> bajo un lector a pantalla
 * completa y a las dos excepciones que devuelven estas barras.
 *
 * Componente de servidor. Lo unico de cliente es la cuenta (un tramo que
 * aparece bajo el nombre y se cierra al navegar) y «Más» (un `<dialog>` modal), y las dos reciben su
 * contenido de aqui: «Salir» es una accion de servidor y no se puede
 * renderizar desde un modulo de cliente.
 */

type Clave = "portada" | "redes" | PaginaSuelta;

/**
 * El icono de cada destino. Redes es un megafono, Garitas son autos en fila,
 * Guion una hoja de guion con un destello de IA y Gasto electoral una alcancia
 * (cliente, 28 de septiembre de 2026). Megafono con asa y no `MegaphoneSimple`:
 * relleno, en el renglon activo, el simple es una barra con una punta y se leia
 * como un banderin; los dos primeros no existen en Phosphor y se componen
 * de sus trazos (chrome/iconos-nav.tsx). `superficie` va en el id de sus
 * mascaras: el riel y la barra pintan el mismo icono en la misma pagina.
 */
function Icono({ clave, actual, superficie }: { clave: Clave; actual: boolean; superficie: "riel" | "barra" }) {
  // 20 en el riel y 22 en la barra del telefono (28 de septiembre de 2026,
  // cliente: a 22 el riel se veia pesado junto a rotulos de 12px). En el
  // telefono el icono es lo que se apunta con el pulgar y se queda en 22.
  const props = { size: superficie === "riel" ? 20 : 22, weight: actual ? ("fill" as const) : ("regular" as const), className: "relative" };
  switch (clave) {
    case "portada": return <TrendUp {...props} aria-hidden />;
    case "redes": return <Megaphone {...props} aria-hidden />;
    case "garitas": return <IconoAutos {...props} id={`${superficie}-garitas`} />;
    case "guion": return <IconoGuion {...props} id={`${superficie}-guion`} />;
    case "seguimiento": return <Binoculars {...props} aria-hidden />;
    case "reportes": return <Files {...props} aria-hidden />;
    case "gasto-electoral": return <PiggyBank {...props} aria-hidden />;
  }
}

interface Destino {
  clave: Clave;
  href: string;
  nombre: string;
  actual: boolean;
  /** Solo lo ve un administrador (`SoloAdmin`); la pagina se protege sola. */
  soloAdmin?: boolean;
}

/** Los dos grupos, en su orden de pantalla. */
const LEER: readonly Clave[] = ["portada", "redes", "garitas"];
const PRODUCIR: readonly Clave[] = ["reportes", "guion", "seguimiento", "gasto-electoral"];
/** Lo que el telefono tiene como pestana; el resto va en «Más». Guion si
 *  existe en este entorno, y si no Garitas, para que sean siempre tres. */
const pestanasDe = (mapa: Map<Clave, Destino>): readonly Clave[] =>
  ["portada", "redes", mapa.has("guion") ? "guion" : "garitas"];

function destinos(zona: ZonaRuta | null, vista: Vista, pagina: PaginaSuelta | undefined, fuera: boolean): Map<Clave, Destino> {
  const enVista = !fuera && pagina === undefined;
  const mapa = new Map<Clave, Destino>([
    ["portada", { clave: "portada", href: ruta(zona, null), nombre: nombreVista(null), actual: enVista && vista === null }],
    ["redes", { clave: "redes", href: ruta(zona, "redes"), nombre: nombreVista("redes"), actual: enVista && vista === "redes" }],
  ]);
  for (const s of sueltasVisibles(analisisHabilitado())) {
    mapa.set(s.id, { clave: s.id, href: s.ruta, nombre: s.nombre, actual: pagina === s.id, soloAdmin: esSoloAdmin(s) });
  }
  return mapa;
}

const de = (mapa: Map<Clave, Destino>, claves: readonly Clave[]) =>
  claves.flatMap((c) => {
    const d = mapa.get(c);
    return d === undefined ? [] : [d];
  });

/** El fondo activo. `nombre` empareja la copia vieja con la nueva entre
 *  paginas; `clase` es la de View Transitions, que globals.css usa para
 *  pintar el grupo con su radio (`::view-transition-group(.pestana-activa)`).
 *  El riel y la barra usan la misma desde que los dos marcan con una pastilla
 *  detras del icono (29 de septiembre de 2026). */
function Realce({ nombre, clase, className }: { nombre: string; clase: string; className: string }) {
  return (
    <ViewTransition name={nombre} share={clase} default="none">
      <span aria-hidden className={className} />
    </ViewTransition>
  );
}

function RenglonRiel({ d }: { d: Destino }) {
  const renglon = (
    <li>
      <Link href={d.href} aria-current={d.actual ? "page" : undefined} className="renglon-riel">
        {/* La pastilla detras del icono, como en la barra del telefono: una
            sola gramatica de «estas aqui» en los dos anchos. */}
        <span className="icono-riel">
          {d.actual ? <Realce nombre="activa-riel" clase="pestana-activa" className="realce-riel" /> : null}
          <Icono clave={d.clave} actual={d.actual} superficie="riel" />
        </span>
        <span>{d.nombre}</span>
      </Link>
    </li>
  );
  return d.soloAdmin ? <SoloAdmin>{renglon}</SoloAdmin> : renglon;
}

function PestanaBarra({ d }: { d: Destino }) {
  const pestana = (
    <li>
      <Link href={d.href} aria-current={d.actual ? "page" : undefined} className="pestana-barra">
        <span className="icono-barra">
          {d.actual ? <Realce nombre="activa-barra" clase="pestana-activa" className="realce-barra" /> : null}
          <Icono clave={d.clave} actual={d.actual} superficie="barra" />
        </span>
        <span>{d.nombre}</span>
      </Link>
    </li>
  );
  return d.soloAdmin ? <SoloAdmin>{pestana}</SoloAdmin> : pestana;
}

export function Riel({
  zona,
  vista,
  pagina,
  fuera = false,
}: {
  zona: ZonaRuta | null;
  vista: Vista;
  pagina?: PaginaSuelta;
  /** Una pagina que no esta en la nav (404, Accesos): nada lleva `aria-current`. */
  fuera?: boolean;
}) {
  const mapa = destinos(zona, vista, pagina, fuera);
  const pestanas = pestanasDe(mapa);
  const enMas = pagina !== undefined && !pestanas.includes(pagina);
  const salir = (
    <form action={cerrarSesion}>
      <button type="submit" className="renglon-cuenta">Salir</button>
    </form>
  );

  return (
    <>
      <nav aria-label="Tablero" className="riel">
        <Link
          href={ruta(zona, null)}
          aria-label={zona === null ? "Pulso, inicio" : `Pulso, inicio en ${NOMBRE_CORTO[zona]}`}
          className="marca-riel"
        >
          <span aria-hidden className="letrero-marca">Pulso</span>
        </Link>

        <ul className="grupo-riel">
          {de(mapa, LEER).map((d) => <RenglonRiel key={d.clave} d={d} />)}
        </ul>
        <span aria-hidden className="filo-riel" />
        <ul className="grupo-riel">
          {de(mapa, PRODUCIR).map((d) => <RenglonRiel key={d.clave} d={d} />)}
        </ul>

        <div className="pie-riel">
          <CuentaRiel>{salir}</CuentaRiel>
        </div>
      </nav>

      <nav aria-label="Tablero" className="barra-inferior">
        <ul>
          {de(mapa, pestanas).map((d) => <PestanaBarra key={d.clave} d={d} />)}
          <li>
            <PestanaMas actual={enMas}>
              <MenuLector zona={zona} vista={vista} pagina={pagina} fuera={fuera} conVistas={false} excepto={pestanas} />
            </PestanaMas>
          </li>
        </ul>
      </nav>
    </>
  );
}
