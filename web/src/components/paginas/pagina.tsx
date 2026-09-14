import { preload } from "react-dom";

import { NavPildora } from "@/components/chrome/nav-pildora";
import { Pie } from "@/components/chrome/pie";
import { RUTAS } from "@/lib/datos/config";
import type { Vista } from "@/lib/dominio/secciones";
import type { ZonaRuta } from "@/lib/dominio/zonas";
import { PaginaIndicadores } from "./indicadores";
import { PaginaRedes } from "./redes";
import { PaginaTitulares } from "./titulares";

/**
 * Una celda de la rejilla lugar x vista: 9 lugares por 3 vistas.
 *
 * Todas las rutas del tablero terminan aqui, y por eso la nav y el pie se
 * escriben UNA vez. Antes esto era `tablero.tsx`, que componia las nueve
 * secciones seguidas y las servia iguales en las nueve zonas: una pagina de
 * ~9 pantallas donde el 80% de lo que bajaba no era lo que se venia a ver.
 *
 * El cuerpo se elige por tabla y no por una escalera de ternarios, que es lo
 * que crece mal cuando se agrega la cuarta vista.
 */
const CUERPOS = {
  portada: PaginaTitulares,
  redes: PaginaRedes,
  indicadores: PaginaIndicadores,
} as const;

export function Pagina({ zona, vista }: { zona: ZonaRuta | null; vista: Vista }) {
  const Cuerpo = CUERPOS[vista ?? "portada"];

  // React 19 iza el link al <head> antes de que exista JS de cliente, asi que
  // el archivo mas grande empieza a bajar sin esperar la hidratacion.
  //
  // Vivia en app/layout.tsx, y de ahi se pedia tambien en /garitas y en
  // /entrar, que no leen notas.json. En /entrar es peor que un desperdicio:
  // no hay sesion, proxy.ts responde 401 al JSON, y la pantalla de entrada
  // abria con un error en consola. Aqui lo piden exactamente las paginas que
  // lo consumen, y siguen siendo las nueve del tablero.
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
  preload(RUTAS.notas, {
    as: "fetch",
    fetchPriority: "high",
    crossOrigin: "anonymous",
  });

  return (
    <>
      <NavPildora zona={zona} vista={vista} />
      <Cuerpo zona={zona} />
      {/* El pie se repite en las cuatro paginas a proposito. Es prosa de
          servidor, no pesa un byte de bundle, y es la integridad del producto:
          recortarlo por pagina obligaria a decidir en cual de las tres se
          puede omitir que esto mide volumen de prensa y no opinion publica.
          Ninguna. */}
      <Pie />
    </>
  );
}
