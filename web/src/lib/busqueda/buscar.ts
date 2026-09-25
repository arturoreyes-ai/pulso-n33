import {
  ambitoPorOmision,
  componerConsulta,
  esAmbito,
  localesDe,
  usaCorpus,
} from "./ambito";
import { archivoPublicado, atarTodas, delArchivo, type LeerArchivo } from "./archivo";
import { buscarEnMedios, robotsCon, type Robotero } from "./buscadores";
import { catalogoPublicado, type LeerCatalogo } from "./catalogo";
import { cosecharFeeds, urlDeFeed } from "./google-noticias";
import { fusionarLocales } from "./fusionar";
import { CACHE_CDN, SIN_CACHE, json } from "./respuesta";
import { TOPE_RESULTADOS, VENTANA_PRENSA_DIAS, type RespuestaBusqueda } from "./tipos";
import { validarConsulta } from "./validar";
import { zonaDeSlug } from "@/lib/dominio/zonas";

/**
 * Busqueda en vivo: Google Noticias en espanol y en ingles, el buscador
 * propio de los medios verificados y el archivo del pipeline.
 *
 * Vivia dentro de app/api/buscar/route.ts hasta el 18 de septiembre de 2026.
 * Se saco por la misma razon que actualidad.ts esta fuera de su ruta: para que
 * scripts/probar-busqueda.cjs pueda ejercerlo sin red y sin disco, inyectando
 * `solicitar` y `leerArchivo`. Un route handler no se puede cargar asi.
 *
 * Hasta el 23 de septiembre de 2026 solo preguntaba a Google, y el archivo
 * solo ponia la miniatura. Dos huecos que eran nuestros: Blanco y Negro
 * Noticias, que Google no indexa, y las notas que el pipeline ya tenia y no
 * salian al buscarlas. Los dos caminos entran por turnos con los locales de
 * Google (fusionarLocales), asi que ninguno se come el tope de los demas, y el
 * titular repetido se queda con el primero que salio.
 *
 * Y desde el 25 de septiembre de 2026, en el corredor, la cabeza es la de
 * Google Noticias TAL CUAL (CABEZA_GOOGLE). El cliente busco «mañanera» y
 * no obtuvo lo que Google Noticias le daba: la consulta salia como
 * `mañanera ("Baja California" OR Tijuana OR ...)`, y medido ese dia los
 * primeros resultados eran notas de hace 9 a 45 dias sobre una alerta en
 * Mexicali, con uno en ingles en el segundo lugar y los medios y el archivo en
 * el tercero y el cuarto, por los turnos. La misma palabra sin lugar, en la
 * edicion mexicana, devolvia exactamente la lista de Google Noticias: El
 * Universal, Infobae, Milenio, El Informador, Sin Embargo, todas de ese dia.
 * Asi que primero va eso, y despues, por turnos, lo acotado al corredor, el
 * ingles, los medios y el archivo: lo local sigue apareciendo, debajo de lo
 * que cualquiera veria en Google. Una ZONA sigue acotada (/tijuana busca en
 * Tijuana: lo dice la etiqueta), y Mexico e Internacional no llevan lugar,
 * que es lo mismo que Google.
 *
 * Los buscadores de los medios solo en el ambito `region`: son medios del
 * corredor que no se leen por zona, y mezclarlos en /tijuana?q= le acreditaria
 * a Tijuana lo que un medio de Ensenada publico. El archivo si entra en la
 * zona, filtrado por las zonas que NOMBRA cada nota.
 */

export interface ConsultaBusqueda {
  q: string | null;
  z: string | null;
  a: string | null;
  actualizar: boolean;
}

/** Lo que las pruebas inyectan ademas de la red y el archivo. */
export interface DependenciasBusqueda {
  leerCatalogo?: LeerCatalogo;
  robots?: Robotero;
  ahora?: () => Date;
}

/**
 * Lo que la portada espera a un medio: tres segundos, no los doce de Redes.
 * Medido el 23 de septiembre de 2026 con «sheinbaum»: Rosarito Noticias 1.3 s,
 * Said Betanzos 1.4 s, Blanco y Negro 2.6 s, Jornada BC 5.9 s y Zeta 9.6 s,
 * contra medio segundo de Google. Con seis la busqueda de la portada paso de
 * 0.5 a 6.1 s; con tres entra Blanco y Negro, que es el que Google no indexa,
 * y los dos lentos quedan para la ficha de Redes, que si los espera.
 */
const MS_MEDIO_PORTADA = 3_000;

/** La primera pagina de Google Noticias: diez, que es lo que muestra antes de
 *  «mas resultados». Con la lista entera, un termino con mucha cobertura
 *  llenaria los cuarenta y lo del corredor no saldria nunca. */
export const CABEZA_GOOGLE = 10;

/** La fecha AAAA-MM-DD que abre la ventana de la prensa. */
export function desdeVentana(ahora: Date, dias = VENTANA_PRENSA_DIAS): string {
  return new Date(ahora.getTime() - dias * 86_400_000).toISOString().slice(0, 10);
}

export async function responderBusqueda(
  consulta: ConsultaBusqueda,
  solicitar: typeof fetch = fetch,
  leerArchivo: LeerArchivo = archivoPublicado,
  dependencias: DependenciasBusqueda = {},
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
  const leerCatalogo = dependencias.leerCatalogo ?? catalogoPublicado;
  const desde = desdeVentana((dependencias.ahora ?? (() => new Date()))());

  // Los locales y los medios en paralelo; que se caiga uno no tumba los demas
  // (ver cosecharFeeds y buscarEnMedios). En el corredor, primero la consulta
  // tal cual en la edicion mexicana: es la cabeza (ver el docstring).
  const talCual = ambito === "region";
  const catalogo = await leerCatalogo();
  const [cosechas, medios, indices] = await Promise.all([
    cosecharFeeds(
      [
        ...(talCual ? [{ url: urlDeFeed(veredicto.q, "es"), idioma: "es" as const }] : []),
        ...locales.map((idioma) => ({ url: urlDeFeed(q, idioma), idioma })),
      ],
      TOPE_RESULTADOS,
      solicitar,
    ),
    ambito === "region" && catalogo !== null
      ? buscarEnMedios(catalogo.buscadores, veredicto.q, desde, solicitar, dependencias.robots ?? robotsCon(solicitar), MS_MEDIO_PORTADA)
      : Promise.resolve([]),
    leerArchivo(),
  ]);

  const deArchivo = usaCorpus(ambito)
    ? delArchivo(indices, veredicto.q, catalogo, {
        zona: ambito === "zona" ? zona : null,
        desde,
        tope: TOPE_RESULTADOS,
      }).map((c) => c.fila)
    : [];

  const deMedios = medios.flatMap((m) => m.resultados).sort((a, b) => (b.publicado ?? "").localeCompare(a.publicado ?? ""));
  const [primera, ...acotadas] = cosechas;
  const cabeza = talCual && primera !== undefined ? primera.resultados.slice(0, CABEZA_GOOGLE) : [];
  const resto = fusionarLocales([
    ...(talCual && primera !== undefined ? [primera.resultados.slice(CABEZA_GOOGLE), ...acotadas.map((c) => c.resultados)] : cosechas.map((c) => c.resultados)),
    deMedios,
    deArchivo,
  ]);
  // Un solo lote: la cabeza en su orden y el resto detras, sin repetir titular.
  const fusionados = fusionarLocales([[...cabeza, ...resto]]);

  // Como en actualidad.ts: el cruce contra el archivo va despues del corte.
  const cuerpo: RespuestaBusqueda = {
    // Lo que escribio la persona, no la consulta compuesta: los terminos de
    // lugar son plomeria y no tienen por que volver al cliente.
    consulta: veredicto.q,
    resultados: atarTodas(fusionados.slice(0, TOPE_RESULTADOS), indices),
    fuentes: cosechas.map((c) => c.salud),
    medios: medios.map((m) => m.salud),
    truncada: fusionados.length > TOPE_RESULTADOS,
  };

  // Nunca un 502: un problema rio arriba viaja como 200 con la salud dentro,
  // para que la pagina pueda DECIR que paso en vez de mostrarse rota.
  //
  // Y nunca se cachea un resultado parcial DE GOOGLE: una falla pasajera
  // clavada cinco minutos en el CDN es peor que la falla. Los medios no
  // cuentan para eso, a proposito: en la portada son un agregado de mejor
  // esfuerzo con seis segundos, y Zeta tarda diez en contestar su buscador,
  // asi que contarlos dejaria la busqueda sin cache para siempre. La lista
  // completa, que si los espera, es la de Redes (termino.ts).
  const todoBien = cosechas.every((c) => c.salud.estado === "ok");
  return json(cuerpo, 200, todoBien && !consulta.actualizar ? CACHE_CDN : SIN_CACHE);
}
