/**
 * Busqueda en vivo en Google Noticias, en espanol y en ingles.
 *
 * Existe porque el muro solo puede buscar en lo que la ultima corrida del cron
 * ya cosecho, y el cron corre cada seis horas. Esto contesta "que hay ahora
 * mismo", que es otra pregunta.
 *
 * Sale del navegador y no de la pagina por dos razones: el feed de Google no
 * manda CORS, y la llave del cache del CDN es la URL, asi que una racha de
 * gente buscando lo mismo despues de una noticia es UNA llamada rio arriba.
 *
 * NO se exporta `dynamic` ni `revalidate`. Desde Next 15 un GET ya es dinamico
 * por omision, leer `nextUrl` lo confirma, y las dos opciones son legado que
 * desaparece si algun dia se enciende Cache Components: escribirlas seria
 * ruido que alguien tendria que borrar.
 */

import type { NextRequest } from "next/server";

import {
  ambitoPorOmision,
  componerConsulta,
  esAmbito,
  localesDe,
} from "@/lib/busqueda/ambito";
import { traerFeed } from "@/lib/busqueda/google-noticias";
import { fusionarLocales } from "@/lib/busqueda/fusionar";
import { TOPE_RESULTADOS, type RespuestaBusqueda } from "@/lib/busqueda/tipos";
import { validarConsulta } from "@/lib/busqueda/validar";
import { zonaDeSlug } from "@/lib/dominio/zonas";

/**
 * Tope de la plataforma. El presupuesto interno son 6 s por feed y los dos van
 * en paralelo, asi que queda holgado por debajo: un feed lento sale como
 * 'fallo' legible en el cuerpo y no como un 504 del host.
 */
export const maxDuration = 15;

const SIN_CACHE = "private, no-store";

function json(cuerpo: unknown, status: number, cache: string): Response {
  return Response.json(cuerpo, {
    status,
    headers: {
      "Cache-Control": cache,
      "X-Content-Type-Options": "nosniff",
      // layout.tsx pone robots:noindex para las PAGINAS; un route handler no
      // queda cubierto por eso.
      "X-Robots-Tag": "noindex",
    },
  });
}

export async function GET(peticion: NextRequest): Promise<Response> {
  const params = peticion.nextUrl.searchParams;
  const veredicto = validarConsulta(params.get("q"));
  if (!veredicto.ok) return json(veredicto.error, 400, SIN_CACHE);

  // El ambito se compone AQUI, despues de validar: asi los 120 caracteres que
  // mide validar.ts son enteros para lo que escribio la persona, y no se los
  // comen los ocho terminos de lugar de San Diego. Ambos parametros se
  // relegen contra su lista; cualquier otra cosa cae al valor por omision en
  // vez de viajar a la consulta.
  const zona = zonaDeSlug(params.get("z") ?? "");
  const crudo = params.get("a");
  const ambito = esAmbito(crudo) ? crudo : ambitoPorOmision(zona);
  const q = componerConsulta(veredicto.q, ambito, zona);
  const locales = localesDe(ambito);

  // allSettled y no all: que se caiga un locale no puede tumbar el otro. Es la
  // misma postura de pulso/fetch.py, "una fuente caida no tumba la corrida".
  const acuerdos = await Promise.allSettled(
    locales.map((idioma) => traerFeed(q, idioma, TOPE_RESULTADOS)),
  );

  const cosechas = acuerdos.map((a, i) =>
    a.status === "fulfilled"
      ? a.value
      : {
          salud: {
            idioma: locales[i]!,
            estado: "fallo" as const,
            obtenidas: 0,
            ms: 0,
            error: String(a.reason).slice(0, 300),
          },
          resultados: [],
        },
  );

  const fusionados = fusionarLocales(cosechas.map((c) => c.resultados));
  const cuerpo: RespuestaBusqueda = {
    // Lo que escribio la persona, no la consulta compuesta: los terminos de
    // lugar son plomeria y no tienen por que volver al cliente.
    consulta: veredicto.q,
    resultados: fusionados.slice(0, TOPE_RESULTADOS),
    fuentes: cosechas.map((c) => c.salud),
    truncada: fusionados.length > TOPE_RESULTADOS,
  };

  // Nunca un 502: un problema rio arriba viaja como 200 con la salud dentro,
  // para que la pagina pueda DECIR que paso en vez de mostrarse rota.
  //
  // Y nunca se cachea un resultado parcial: una falla pasajera de Google
  // clavada cinco minutos en el CDN es peor que la falla.
  const todoBien = cosechas.every((c) => c.salud.estado === "ok");
  const cache = todoBien
    ? "public, max-age=0, s-maxage=300, stale-while-revalidate=600"
    : SIN_CACHE;
  return json(cuerpo, 200, cache);
}
