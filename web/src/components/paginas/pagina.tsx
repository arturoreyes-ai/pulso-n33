import { preload } from "react-dom";

import { Navegacion } from "@/components/chrome/navegacion";
import { RUTAS } from "@/lib/datos/config";
import type { Vista } from "@/lib/dominio/secciones";
import type { ZonaRuta } from "@/lib/dominio/zonas";
import { PaginaEnTendencia } from "./en-tendencia";
import { PaginaIndicadores } from "./indicadores";
import { PaginaRedes } from "./redes";

/**
 * Una celda de la rejilla lugar x vista: 9 lugares por 3 vistas.
 *
 * Todas las rutas del tablero terminan aqui, y por eso la nav y el pie se
 * escriben UNA vez. Antes esto era `tablero.tsx`, que componia las nueve
 * secciones seguidas y las servia iguales en las nueve zonas: una pagina de
 * ~9 pantallas donde el 80% de lo que bajaba no era lo que se venia a ver.
 *
 * El cuerpo se elige por tabla y no por una escalera de ternarios, que es lo
 * que crece mal cuando se agrega otra vista.
 */
const CUERPOS = {
  redes: PaginaRedes,
  indicadores: PaginaIndicadores,
} as const;

/**
 * La PORTADA queda fuera de la tabla, y no por descuido: es la unica vista que
 * tiene una ENTRADA —Mexico o Internacional, en `?e=`— y por lo tanto la unica
 * con una prop que las otras tres no pueden recibir. Meterla en la tabla
 * obligaria a darles a las tres un `edicion` que ninguna lee, que es peor
 * mentira que esta rama.
 */
export function Pagina({ zona, vista, edicion = null, consulta = null, rubro = null }: { zona: ZonaRuta | null; vista: Vista; edicion?: string | null; consulta?: string | null; rubro?: string | null }) {
  const Cuerpo = vista === null ? null : CUERPOS[vista];

  // React 19 iza el link al <head> antes de que exista JS de cliente, asi que
  // el archivo mas grande empieza a bajar sin esperar la hidratacion.
  //
  // Vivia en app/layout.tsx, y de ahi se pedia tambien en /garitas y en
  // /entrar, que no leen notas.json. En /entrar es peor que un desperdicio:
  // no hay sesion, proxy.ts responde 401 al JSON, y la pantalla de entrada
  // abria con un error en consola. Aqui lo piden exactamente las paginas que
  // lo consumen, que son las de la rejilla.
  //
  // Solo la PORTADA, y con prioridad BAJA. Al quitarse el muro, notas.json se
  // quedo con un unico consumidor: el recorrido, que lo usa para las miniaturas
  // y para el enlace del propio medio del boton Analizar. Redes e Indicadores
  // no lo abren, asi que pedirlo ahi son tres megas que nadie lee; y en la
  // portada va en baja porque su contenido viene de otro sitio y las figuras
  // pueden aparecer cuando lleguen.
  //
  // `as: "fetch"` es quisquilloso: si el modo de CREDENCIALES del preload no
  // coincide con el del fetch que lo consume, el navegador DESCARTA la
  // descarga y avisa "preloaded but not used", o sea que se paga dos veces y
  // no sirve.
  //
  // Va SIEMPRE con crossOrigin, tambien en mismo origen. La version anterior
  // lo omitia cuando el origen coincidia, y Chrome tiraba el preload de
  // notas.json en cada carga: "A preload for '/data/notas.json' is found, but
  // is not used because the request credentials mode does not match". Justo el
  // archivo mas grande y el unico con fetchPriority alto.
  //
  // Las reglas no son simetricas, y de ahi el error:
  //
  //   <link rel=preload as=fetch> sin crossorigin  -> credenciales "include"
  //   ...con crossorigin="anonymous"               -> credenciales "same-origin"
  //   fetch(url) sin opciones                      -> credenciales "same-origin"
  //
  // El consumidor es `leerJson`, un fetch pelado (lib/datos/fetcher.ts), asi
  // que lo que empareja es "anonymous". En mismo origen no cuesta nada: una
  // peticion al propio origen no pasa por CORS. Un host remoto ya lo queria, y
  // ademas necesita cabeceras CORS en la respuesta.
  if (vista === null) {
    preload(RUTAS.notas, {
      as: "fetch",
      fetchPriority: "low",
      crossOrigin: "anonymous",
    });
  }

  return (
    <>
      <Navegacion zona={zona} vista={vista} />
      {Cuerpo === null ? <PaginaEnTendencia zona={zona} edicion={edicion} consulta={consulta} rubro={rubro} /> : <Cuerpo zona={zona} />}
      {/* El pie se repite en las tres paginas a proposito. Es prosa de
          servidor, no pesa un byte de bundle, y es la integridad del producto:
          recortarlo por pagina obligaria a decidir en cual se puede omitir que
          esto mide volumen de prensa y no opinion publica. Ninguna. */}
    </>
  );
}
