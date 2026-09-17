import { MenuLector } from "@/components/chrome/menu-lector";
import { analisisHabilitado } from "@/lib/analisis/config";
import { Pie } from "@/components/chrome/pie";
import { Seccion } from "@/components/chrome/seccion";
import { PanelConversacion } from "@/components/paneles/conversacion";
import { LectorRedes } from "@/components/paneles/lector-redes";
import { PanelTendencias } from "@/components/paneles/tendencias";
import { tituloSeccion } from "@/lib/dominio/secciones";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";

/**
 * REDES: las cuatro plataformas en un solo lector.
 *
 * Eran tres secciones seguidas de la pagina unica —Instagram, TikTok y
 * YouTube—, y TikTok ademas tenia pastilla propia en la nav. Luego fueron
 * facetas de una pagina con encabezado y una pareja Lista / Visual. Desde el
 * 15 de septiembre de 2026 la pagina ES el lector a pantalla completa
 * (components/lector, paneles/lector-redes.tsx): barra con el lugar y la
 * informacion, pestanas para elegir plataforma, y una caja que recorre las
 * publicaciones una por pantalla. Las listas de Instagram y TikTok se
 * retiraron; los comentarios mas votados viven en la tarjeta
 * (paneles/comentarios-publicacion.tsx). En escritorio la pildora flotante
 * sigue arriba; el encabezado y el pie de la pagina se ocultan y su prosa
 * viaja en el dialogo de informacion del lector.
 *
 * Las cuatro NO son la misma fuente y la pagina no finge que lo sean:
 *
 *   Instagram — cuentas de medios verificadas una por una. La zona es la SEDE
 *               de la cuenta. Publica el texto de los comentarios. Ventana de
 *               24 horas desde el 10 de septiembre de 2026 (antes, la semana).
 *               El corte reparte una vuelta por cuenta antes del merito desde
 *               el 17: entre el 15 y el 17 una sola cuenta tuvo entre siete y
 *               diez de los quince de Tijuana. Eso NO se le dice al lector;
 *               la linea del dialogo solo dice que no caben todas y que
 *               ninguna cuenta llena la lista sola, que es lo que el lector
 *               puede comprobar desplazandose.
 *   TikTok    — busquedas: una por lugar del corredor mas una de Mexico y
 *               una del mundo, desde el 15 de septiembre de 2026. La zona
 *               sale del PIE del video, porque una consulta no tiene lugar;
 *               el `ambito` de cada busqueda decide SOLO el residuo, nunca la
 *               zona de un pie que nombra lugar. Publica el @ del creador; es
 *               la unica que trae compartidos y guardados.
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
 * De ahi salen los nombres de las pastillas de la vista de region: Corredor,
 * Mexico y Mundo son LUGARES, no ambitos de una consulta, y el id de una
 * busqueda no se imprime en ninguna parte — por eso `fuente` ya no cae a
 * `cuenta` cuando falta el creador.
 *
 * Lo que el lector si ve: que esta mirando y que NO afirma. La distincion
 * decide cada cadena de esta pagina. «Es el ranking de X, no una medida de la
 * ciudad» se queda porque es significado; «leido sin iniciar sesion» se fue
 * porque es procedimiento. Las cinco reglas de PRODUCT.md siguen enteras y
 * visibles en cada pagina: las dice el pie (`chrome/pie.tsx`), en HTML de
 * servidor, aqui dentro del dialogo de informacion.
 *
 * Por eso no hay «Cómo leer este dato» aqui. Lo tenian las cuatro facetas y
 * era prosa de metodologia; su contenido esta en PRODUCT.md. El panel de
 * indicadores conserva el suyo, que explica que mide el SHF o la ENSU —el
 * significado de la fuente, no el de nuestro codigo.
 */
export function PaginaRedes({ zona }: { zona: ZonaRuta | null }) {
  const nombre = zona === null ? null : NOMBRE_CORTO[zona];
  const entrada =
    nombre === null
      ? "Lo que publican las cuentas de noticias de la región y lo que la gente comenta debajo, en Instagram, TikTok y YouTube, y lo que X marca como tendencia. Se publica lo que se dijo; nunca quién lo dijo."
      : `Lo que se publica desde ${nombre} o nombra a ${nombre}, lo que la gente comenta debajo y lo que X marca como tendencia. Se publica lo que se dijo; nunca quién lo dijo.`;

  return (
    // Sin revelado: el lector es fijo y el transform de Revelar lo
    // desplazaria (ver chrome/seccion.tsx).
    <Seccion id="redes" revelar={false}>
      <h1 className="sr-only">{tituloSeccion("redes", nombre)}</h1>
      <LectorRedes
        zona={zona}
        menu={<MenuLector zona={zona} vista="redes" />}
        informacion={<Informacion entrada={entrada} nombre={nombre} />}
        paneles={{ youtube: <PanelConversacion zona={zona} />, x: <PanelTendencias zona={zona} /> }}
        analisis={analisisHabilitado()}
      />
    </Seccion>
  );
}

/** El dialogo «Acerca de Redes»: la entrada de la pagina, una frase por
 *  pestana sobre que se ve y que no se afirma, y el pie con las cinco reglas.
 *  Todo HTML de servidor. */
function Informacion({ entrada, nombre }: { entrada: string; nombre: string | null }) {
  const donde = nombre ?? "la región";
  return (
    <>
      <div className="grid gap-4 px-4 pt-6 pb-6 text-lectura text-tinta-prosa">
        <p className="max-w-[65ch]">{entrada}</p>
        <p className="max-w-[65ch]">
          Instagram y TikTok: publicaciones de las últimas 24 horas, de la más nueva a la más antigua,
          con el pie del medio o la descripción del video y el texto de los comentarios más votados;
          nunca quién los escribió. No caben todas, y ninguna cuenta llena la lista por sí sola.
          Lo que la plataforma no publica se dice «sin dato», no cero.
        </p>
        <p className="max-w-[65ch]">
          YouTube: comentarios en canales de noticias {nombre === null ? "de la región" : `sobre ${donde}`}, con su
          sentimiento. Aquí solo hay cifras, nunca el texto.
        </p>
        <p className="max-w-[65ch]">
          X: lo que X marca como tendencia. Es el ranking de X, no una medida de la ciudad: aquí no hay tuits,
          solo el nombre de cada tendencia y la liga a su búsqueda.
        </p>
      </div>
      <Pie />
    </>
  );
}
