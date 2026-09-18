import { MenuLector } from "@/components/chrome/menu-lector";
import { analisisHabilitado } from "@/lib/analisis/config";
import { Seccion } from "@/components/chrome/seccion";
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
 * porque es procedimiento.
 *
 * El dialogo «Acerca de Redes» se fue el 18 de septiembre de 2026, y con el la
 * entrada de la pagina y las cuatro frases de pestana: el cliente pidio no
 * explicarle al lector como funciona esto. Ninguna afirmacion se perdio con
 * ellas. La salvedad de X vivia ADEMAS en su panel, que es donde se lee
 * (`paneles/tendencias.tsx`: «Es el ranking de X, no una medida...»), y los
 * huecos los rotula cada panel. Las cinco reglas de PRODUCT.md siguen enteras
 * en cada pagina: las dice el pie (`chrome/pie.tsx`), en HTML de servidor, y
 * dentro del lector viaja en el dialogo del menu (chrome/menu-lector.tsx).
 *
 * Por eso no hay «Cómo leer este dato» aqui. Lo tenian las cuatro facetas y
 * era prosa de metodologia; su contenido esta en PRODUCT.md. El panel de
 * indicadores conserva el suyo, que explica que mide el SHF o la ENSU —el
 * significado de la fuente, no el de nuestro codigo.
 */
export function PaginaRedes({ zona }: { zona: ZonaRuta | null }) {
  const nombre = zona === null ? null : NOMBRE_CORTO[zona];

  return (
    // Sin revelado: el lector es fijo y el transform de Revelar lo
    // desplazaria (ver chrome/seccion.tsx).
    <Seccion id="redes" revelar={false}>
      <h1 className="sr-only">{tituloSeccion("redes", nombre)}</h1>
      <LectorRedes
        zona={zona}
        menu={<MenuLector zona={zona} vista="redes" />}
        paneles={{ x: <PanelTendencias zona={zona} /> }}
        analisis={analisisHabilitado()}
      />
    </Seccion>
  );
}
