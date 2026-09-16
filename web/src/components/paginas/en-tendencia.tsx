import { FeedAhora } from "@/components/ahora/feed-ahora";
import { MenuLector } from "@/components/chrome/menu-lector";
import { Pie } from "@/components/chrome/pie";
import { Seccion } from "@/components/chrome/seccion";
import { analisisHabilitado } from "@/lib/analisis/config";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";

/**
 * EN TENDENCIA: la portada. Un titular en vivo por pantalla.
 *
 * Fue la suelta /ahora del 14 al 15 de septiembre de 2026, y ese dia paso a ser
 * la portada a peticion del cliente. La portada anterior abria con una seccion
 * titulada «En Tendencia» que mostraba estos mismos titulares en una lista: eran
 * la misma fuente con dos disenos, y de las dos se quedo esta. El muro, los
 * temas y las cifras que la acompanaban no se quitaron, se mudaron a `prensa`.
 *
 * La pagina ES el lector (components/lector): una caja fija a pantalla completa.
 * De ahi tres cosas que parecen detalles y no lo son:
 *
 *  - `revelar={false}`. `Revelar` anima con `transform`, que crearia un bloque
 *    contenedor para el `position: fixed` del lector y lo sacaria de la
 *    pantalla (ver chrome/seccion.tsx).
 *  - El `<Pie>` va DENTRO del dialogo de informacion. El de la pagina lo oculta
 *    el CSS mientras el lector esta arriba, y las cinco reglas de PRODUCT.md
 *    tienen que estar en cada pagina; este dialogo es el unico sitio donde
 *    caben.
 *  - La faceta `?e=` se lee en el SERVIDOR, en app/page.tsx, y baja como prop.
 *    La primera version la leia con `useSearchParams` bajo un `<Suspense>`, que
 *    es lo que documenta Next, y no funciono: en esta ruta prerenderizada el
 *    limite se quedaba pendiente para siempre —la tarjeta de relleno en su
 *    sitio y el lector de verdad en un contenedor suelto colgado del body—, asi
 *    que `main:has(.lector)` no encajaba, y en el telefono eso deja la pildora
 *    y el pie visibles encima del lector. Leerla en el servidor quita el limite
 *    y de paso hace que la faceta funcione sin JavaScript.
 */
function IntroduccionEnTendencia({ nombre }: { nombre: string | null }) {
  return (
    <p className="mt-6 max-w-[65ch] text-lectura text-tinta-prosa">
      Un titular por pantalla. Desliza para pasar al siguiente: primero lo que destaca
      {nombre === null ? " donde elijas empezar —una zona, el corredor, México o el mundo—" : ` en ${nombre}`},
      luego cada rubro ahí, y después las otras dos secciones. Cada tarjeta nombra al
      medio y enlaza a su nota; nada de aquí se suma a las cifras de prensa.
    </p>
  );
}

export function PaginaEnTendencia({ zona, edicion, consulta }: { zona: ZonaRuta | null; edicion: string | null; consulta: string | null }) {
  const nombre = zona === null ? null : NOMBRE_CORTO[zona];

  return (
    <Seccion id="en-tendencia" pegada revelar={false}>
      <h1 className="sr-only">{nombre === null ? "En Tendencia" : `En Tendencia · ${nombre}`}</h1>
      <FeedAhora
        zona={zona}
        edicion={edicion}
        consulta={consulta}
        analisis={analisisHabilitado()}
        menu={<MenuLector zona={zona} vista={null} />}
        informacion={<><div className="px-4 pb-6"><IntroduccionEnTendencia nombre={nombre} /></div><Pie /></>}
      />
    </Seccion>
  );
}
