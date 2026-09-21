import {
  ambitoPorOmision,
  componerConsulta,
  esAmbito,
  localesDe,
} from "./ambito";
import { archivoPublicado, atarTodas, type LeerArchivo } from "./archivo";
import { cosecharFeeds, urlDeFeed } from "./google-noticias";
import { fusionarLocales } from "./fusionar";
import { CACHE_CDN, SIN_CACHE, json } from "./respuesta";
import { TOPE_RESULTADOS, type RespuestaBusqueda } from "./tipos";
import { validarConsulta } from "./validar";
import { zonaDeSlug } from "@/lib/dominio/zonas";

/**
 * Busqueda en vivo en Google Noticias, en espanol y en ingles.
 *
 * Vivia dentro de app/api/buscar/route.ts hasta el 18 de septiembre de 2026.
 * Se saco por la misma razon que actualidad.ts esta fuera de su ruta: para que
 * scripts/probar-busqueda.cjs pueda ejercerlo sin red y sin disco, inyectando
 * `solicitar` y `leerArchivo`. Un route handler no se puede cargar asi.
 */

export interface ConsultaBusqueda {
  q: string | null;
  z: string | null;
  a: string | null;
  actualizar: boolean;
}

export async function responderBusqueda(
  consulta: ConsultaBusqueda,
  solicitar: typeof fetch = fetch,
  leerArchivo: LeerArchivo = archivoPublicado,
): Promise<Response> {
  const veredicto = validarConsulta(consulta.q);
  if (!veredicto.ok) return json(veredicto.error, 400, SIN_CACHE);

  // El ambito se compone AQUI, despues de validar: asi los 120 caracteres que
  // mide validar.ts son enteros para lo que escribio la persona, y no se los
  // comen los ocho terminos de lugar de San Diego. Ambos parametros se
  // relegen contra su lista; cualquier otra cosa cae al valor por omision en
  // vez de viajar a la consulta.
  const zona = zonaDeSlug(consulta.z ?? "");
  const ambito = esAmbito(consulta.a) ? consulta.a : ambitoPorOmision(zona);
  const q = componerConsulta(veredicto.q, ambito, zona);
  const locales = localesDe(ambito);

  // Los dos locales en paralelo; que se caiga uno no tumba el otro (ver
  // cosecharFeeds).
  const cosechas = await cosecharFeeds(
    locales.map((idioma) => ({ url: urlDeFeed(q, idioma), idioma })),
    TOPE_RESULTADOS,
    solicitar,
  );

  const fusionados = fusionarLocales(cosechas.map((c) => c.resultados));

  // Como en actualidad.ts: el cruce contra el archivo va despues del corte.
  const indices = await leerArchivo();
  const cuerpo: RespuestaBusqueda = {
    // Lo que escribio la persona, no la consulta compuesta: los terminos de
    // lugar son plomeria y no tienen por que volver al cliente.
    consulta: veredicto.q,
    resultados: atarTodas(fusionados.slice(0, TOPE_RESULTADOS), indices),
    fuentes: cosechas.map((c) => c.salud),
    truncada: fusionados.length > TOPE_RESULTADOS,
  };

  // Nunca un 502: un problema rio arriba viaja como 200 con la salud dentro,
  // para que la pagina pueda DECIR que paso en vez de mostrarse rota.
  //
  // Y nunca se cachea un resultado parcial: una falla pasajera de Google
  // clavada cinco minutos en el CDN es peor que la falla.
  const todoBien = cosechas.every((c) => c.salud.estado === "ok");
  return json(cuerpo, 200, todoBien && !consulta.actualizar ? CACHE_CDN : SIN_CACHE);
}
