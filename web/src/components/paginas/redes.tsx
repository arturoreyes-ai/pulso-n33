import type { ReactNode } from "react";

import { EncabezadoSeccion } from "@/components/cabecera/encabezado";
import { Seccion } from "@/components/chrome/seccion";
import { PanelConversacion } from "@/components/paneles/conversacion";
import { PanelRedes, PanelTikTok } from "@/components/paneles/redes";
import { SelectorRed } from "@/components/paneles/selector-red";
import { PanelTendencias } from "@/components/paneles/tendencias";
import { tituloSeccion } from "@/lib/dominio/secciones";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";

/**
 * REDES: las cuatro plataformas en un solo lugar.
 *
 * Eran tres secciones seguidas de la pagina unica —Instagram, TikTok y
 * YouTube—, y TikTok ademas tenia pastilla propia en la nav. Se leen como una
 * sola pregunta hecha en tres lugares, asi que se eligen con una faceta y no
 * scrolleando. El detalle de por que estan tan separadas por dentro esta en
 * `components/paneles/selector-red.tsx`.
 *
 * Las cuatro NO son la misma fuente y la pagina no finge que lo sean:
 *
 *   Instagram — cuentas de medios verificadas una por una. La zona es la SEDE
 *               de la cuenta. Publica el texto de los comentarios. Ventana de
 *               24 horas desde el 10 de septiembre de 2026 (antes, la semana).
 *   TikTok    — una busqueda, «tijuana noticias». La zona sale del PIE del
 *               video, porque una consulta no tiene lugar. Publica el @ del
 *               creador; es la unica que trae compartidos y guardados.
 *   YouTube   — solo conteos y sentimiento agregado. Nunca el texto de un
 *               comentario: las Politicas para Desarrolladores limitan el
 *               almacenamiento a 30 dias y un repositorio de git no borra.
 *   X         — el ranking de tendencias de X por ubicacion (Tijuana,
 *               Mexicali, San Diego, Mexico y el mundo), leido sin sesion
 *               desde el 11 de septiembre de 2026. Ni tuits ni identidad:
 *               nombre, puesto y liga. Es lo que X destaca, no la ciudad.
 *
 * NADA DE ESO SE LE DICE AL LECTOR, y este bloque es el unico lugar donde
 * vive. El 13 de septiembre de 2026 el cliente pidio que la interfaz dejara de
 * explicar como obtiene los datos: la faceta de TikTok llegaba a nombrar la
 * consulta literal («tijuana noticias»), la regla de zona («la da el pie del
 * video, no el creador») y hasta git. Es la regla del 12 de septiembre —la
 * interfaz no nombra a Google— extendida del proveedor a todo el mecanismo.
 *
 * Lo que el lector si ve: que esta mirando y que NO afirma. La distincion
 * decide cada cadena de esta pagina. «Es el ranking de X, no una medida de la
 * ciudad» se queda porque es significado; «leido sin iniciar sesion» se fue
 * porque es procedimiento. Las cinco reglas de PRODUCT.md siguen enteras y
 * visibles en cada pagina: las dice el pie (`chrome/pie.tsx`), en HTML de
 * servidor, no cada panel por su cuenta.
 *
 * Por eso ya no hay «Cómo leer este dato» aqui. Lo tenian las cuatro facetas y
 * era prosa de metodologia; su contenido esta en PRODUCT.md. El panel de
 * indicadores conserva el suyo, que explica que mide el SHF o la ENSU —el
 * significado de la fuente, no el de nuestro codigo.
 */
export function PaginaRedes({ zona }: { zona: ZonaRuta | null }) {
  const nombre = zona === null ? null : NOMBRE_CORTO[zona];

  return (
    <>
      <EncabezadoSeccion
        zona={zona}
        vista="redes"
        titulo={tituloSeccion("redes", nombre)}
        entrada={
          nombre === null
            ? "Lo que publican las cuentas de noticias de la región y lo que la gente comenta debajo, en Instagram, TikTok y YouTube, y lo que X marca como tendencia. Se publica lo que se dijo; nunca quién lo dijo."
            : `Lo que se publica desde ${nombre} o nombra a ${nombre}, lo que la gente comenta debajo y lo que X marca como tendencia. Se publica lo que se dijo; nunca quién lo dijo.`
        }
      />

      <Seccion id="redes">
        <SelectorRed
          paneles={{
            instagram: (
              <>
                <Intro>
                  {nombre === null
                    ? "Los posts con más likes de las últimas 24 horas en las cuentas de noticias de la región, y los comentarios más votados en cada uno."
                    : `Los posts con más likes de las últimas 24 horas en cuentas de noticias con sede en ${nombre}, y los comentarios más votados en cada uno.`}
                </Intro>
                <PanelRedes zona={zona} />
              </>
            ),
            tiktok: (
              <>
                <Intro>
                  {nombre === null
                    ? "Videos de las últimas 24 horas que hablan de la región, de cualquier creador, y los comentarios más votados en cada uno."
                    : `Videos de las últimas 24 horas que hablan de ${nombre}, de cualquier creador, y los comentarios más votados en cada uno.`}
                </Intro>
                <PanelTikTok zona={zona} />
              </>
            ),
            youtube: (
              <>
                <Intro>
                  {nombre === null
                    ? "Comentarios en canales de noticias de la región, con su sentimiento. Aquí solo hay cifras, nunca el texto."
                    : `Comentarios en canales de noticias sobre ${nombre}, con su sentimiento. Aquí solo hay cifras, nunca el texto.`}
                </Intro>
                <PanelConversacion zona={zona} />
              </>
            ),
            x: (
              <>
                <Intro>
                  {nombre === null
                    ? "Lo que X marca como tendencia en Tijuana, Mexicali y San Diego, en México y en el mundo. Es el ranking de X, no una medida de la ciudad: aquí no hay tuits, solo el nombre de cada tendencia y la liga a su búsqueda."
                    : `Lo que X marca como tendencia en ${nombre}, en México y en el mundo. Es el ranking de X, no una medida de la ciudad: aquí no hay tuits, solo el nombre de cada tendencia y la liga a su búsqueda.`}
                </Intro>
                <PanelTendencias zona={zona} />
              </>
            ),
          }}
        />
      </Seccion>
    </>
  );
}

/** El parrafo que enmarca una plataforma. Va entre la faceta y el panel, en
 *  el sitio donde estaba la entrada de la seccion que cada una tenia. */
function Intro({ children }: { children: ReactNode }) {
  return <p className="mb-6 max-w-[65ch] text-lectura text-tinta-prosa">{children}</p>;
}
