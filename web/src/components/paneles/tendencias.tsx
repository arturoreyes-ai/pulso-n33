"use client";

import type { ReactNode } from "react";
import { ArrowSquareOut as Abrir } from "@phosphor-icons/react";

import { useTendencias } from "@/lib/datos/hooks";
import type { DocTendencias, Tendencia, UbicacionTendencias } from "@/lib/datos/tipos";
import { hora, numero } from "@/lib/dominio/formato";
import { NOMBRE_CORTO, rango, type ZonaRuta } from "@/lib/dominio/zonas";
import { Esqueleto, Hueco } from "@/components/ui/primitivas";

/**
 * Tendencias de X por ubicacion: el ranking de X, no una medida de la ciudad.
 *
 * Cuarta faceta de la pagina de redes desde el 11 de septiembre de 2026. No
 * trae comentarios: trae la lista que X publica para cada ubicacion, en el
 * orden de X, con el nombre de cada tendencia y la liga a su busqueda. Ni
 * tuits ni quien los escribio; las promocionadas (anuncios) ya vienen fuera.
 *
 * La ubicacion manda. X publica lista por ciudad solo para Tijuana, Mexicali
 * y San Diego; para las otras cinco zonas el archivo trae una fila apagada
 * (`sin_lista`) y aqui se rotula el hueco. NUNCA se muestra la lista nacional
 * en lugar de la local: eso le acreditaria a Ensenada lo que es tendencia en
 * todo el pais. En la vista de region van las ciudades con lista, Mexico y el
 * mundo; en la de una zona, su ciudad (o su hueco), Mexico y el mundo.
 *
 * `volumen` casi nunca esta: X lo retiro para la mayoria de las tendencias en
 * enero de 2026. Donde falta no se pinta nada -- ni un cero -- y el panel lo
 * dice una vez, arriba.
 *
 * Una ciudad puede traer la MISMA lista que Mexico. El sondeo del 11 de
 * septiembre de 2026 devolvio para Tijuana, Mexicali y Mexico exactamente las
 * mismas cinco tendencias en el mismo orden: X publica el WOEID de la ciudad
 * pero, al menos ese dia, lo llena con la lista nacional. Se muestra igual y
 * se dice debajo del titulo, porque callarlo haria pasar por local lo que es
 * del pais.
 *
 * LA FORMA ES LA DE LA PAGINA DE TENDENCIAS DE X, con los tokens de Pulso
 * (15 de septiembre de 2026, a peticion del cliente): una linea de contexto
 * en meta —puesto, «Tendencia», el volumen si X lo publica—, el nombre
 * debajo, filas holgadas sin divisorias, y sin bisel alrededor: el lector ya
 * es la superficie. La primera tendencia de cada ubicacion va en la voz de
 * titular (Archivo, tamano de seccion) y justo debajo la salvedad de siempre,
 * porque un nombre a ese tamano pide decir en la misma mirada de quien es el
 * ranking. Lo que X resuelve con una imagen de portada aqui lo resuelve la
 * tipografia: no hay imagen que hotlinkear y el producto es nombre, puesto y
 * liga.
 */

const MENSAJE_SIN_DISPONIBILIDAD =
  "El panel de X no está disponible en este momento. El resto del tablero funciona igual.";

const PIE =
  "Se publican el nombre de cada tendencia, el puesto que X le dio y la liga a su búsqueda en X; nunca un tuit ni quién lo escribió. Las tendencias promocionadas son anuncios y no aparecen.";

const FILA = "group -mx-3 block rounded-nucleo px-3 py-3 transition-colors hover:bg-vela";

function esZonaRuta(z: string | null): z is ZonaRuta {
  return z !== null && z in NOMBRE_CORTO;
}

/** El nombre corto de la zona cuando la ubicacion es una; si no, el suyo. */
function titulo(u: UbicacionTendencias): string {
  return u.ambito === "zona" && esZonaRuta(u.zona) ? NOMBRE_CORTO[u.zona] : u.nombre;
}

/** «en Tijuana», «en México», «en el mundo». */
function donde(u: UbicacionTendencias): string {
  return u.ambito === "mundial" ? "en el mundo" : `en ${titulo(u)}`;
}

/** De quien NO es medida el ranking, para la salvedad bajo la primera
 *  tendencia: «de la ciudad», «del país», «del mundo». */
function deQuien(u: UbicacionTendencias): string {
  return u.ambito === "zona" ? "de la ciudad" : u.ambito === "nacional" ? "del país" : "del mundo";
}

/** "Tijuana, Mexicali y San Diego". */
function enumerar(nombres: string[]): string {
  if (nombres.length <= 1) return nombres.join("");
  return `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1) ?? ""}`;
}

/** El volumen solo cuando X lo publica; donde no, nada, ni un cero. */
function volumen(t: Tendencia): string {
  return t.volumen === undefined ? "" : ` · ${numero(t.volumen)} posts`;
}

const porZona = (a: UbicacionTendencias, b: UbicacionTendencias) =>
  rango(a.zona ?? "") - rango(b.zona ?? "") || a.id.localeCompare(b.id);

interface ModeloTendencias {
  sinToken: boolean;
  listas: UbicacionTendencias[];
  conLista: string;
  huecos: string[];
  sinVolumen: boolean;
  nacional: UbicacionTendencias | null;
  cabeza: string;
}

function prepararTendencias(data: DocTendencias, zona: ZonaRuta | null): ModeloTendencias {
  const activas = data.ubicaciones.filter((u) => u.activa);
  const sinToken = activas.length > 0 && activas.every((u) => u.estado === "sin_token");
  const listas = elegir(data, zona);
  const conLista = enumerar(
    data.ubicaciones.filter((u) => u.ambito === "zona" && u.activa).sort(porZona).map(titulo),
  );
  const huecos = data.ubicaciones
    .filter((u) => u.ambito === "zona" && !u.activa)
    .sort(porZona)
    .map(titulo);
  const sinVolumen = listas.every((u) => u.tendencias.every((t) => t.volumen === undefined));
  const propia = zona === null ? null : (listas.find((u) => u.zona === zona) ?? null);
  const nacional = data.ubicaciones.find((u) => u.ambito === "nacional") ?? null;
  const nombreZona = zona === null ? "la región" : NOMBRE_CORTO[zona];
  const cabeza =
    zona === null
      ? `Lo que X marca como tendencia ahora en ${conLista}, en México y en el mundo, en el orden de X.`
      : propia !== null && propia.activa
        ? `Lo que X marca como tendencia ahora en ${nombreZona}, en México y en el mundo, en el orden de X.`
        : `X no publica una lista de tendencias para ${nombreZona}; abajo, México y el mundo.`;
  return { sinToken, listas, conLista, huecos, sinVolumen, nacional, cabeza };
}

/**
 * Que ubicaciones se muestran y en que orden. El archivo va por id para que
 * el diff sea estable; aqui se lee por zona (el orden del producto), luego
 * Mexico, luego el mundo.
 */
function elegir(data: DocTendencias, zona: ZonaRuta | null): UbicacionTendencias[] {
  const locales = data.ubicaciones.filter((u) => u.ambito === "zona");
  const propias = (
    zona === null ? locales.filter((u) => u.activa) : locales.filter((u) => u.zona === zona)
  ).sort(porZona);
  const nacional = data.ubicaciones.filter((u) => u.ambito === "nacional");
  const mundial = data.ubicaciones.filter((u) => u.ambito === "mundial");
  return [...propias, ...nacional, ...mundial];
}

/** Misma lista, mismo orden: X no distinguio esa ciudad del pais ese dia. */
function mismaLista(a: UbicacionTendencias, b: UbicacionTendencias): boolean {
  return (
    a.tendencias.length > 0 &&
    a.tendencias.length === b.tendencias.length &&
    a.tendencias.every((t, i) => t.nombre === b.tendencias[i]?.nombre)
  );
}

function Lista({
  u,
  conLista,
  igualANacional,
}: {
  u: UbicacionTendencias;
  conLista: string;
  igualANacional: boolean;
}) {
  const nombre = titulo(u);
  let cuerpo: ReactNode;
  if (u.estado === "sin_lista") {
    cuerpo = (
      <p className="mt-3 text-cuerpo">
        <Hueco titulo="Hueco de cobertura, registrado a propósito">
          X no publica una lista de tendencias para {nombre}; sí para {conLista}.
        </Hueco>
      </p>
    );
  } else if (u.estado === "sin_token") {
    cuerpo = (
      <p className="mt-3 text-cuerpo">
        <Hueco>La lista de X no está disponible en este momento.</Hueco>
      </p>
    );
  } else if (u.estado === "fallo") {
    cuerpo = (
      <p className="mt-3 text-cuerpo">
        <Hueco>No se pudo traer la lista de X. Se dice; no se rellena con otra.</Hueco>
      </p>
    );
  } else if (u.estado === "sin_dato" || u.tendencias.length === 0) {
    cuerpo = (
      <p className="mt-3 text-cuerpo">
        <Hueco>X no publicó tendencias para {nombre} esta vez.</Hueco>
      </p>
    );
  } else {
    const [primera, ...resto] = u.tendencias;
    cuerpo = (
      <>
        {igualANacional ? (
          <p className="mt-2 text-meta">
            <Hueco titulo="X publica la ubicación, pero la llenó con la lista nacional">
              Idéntica a la lista de México: X no distinguió {nombre} del país.
            </Hueco>
          </p>
        ) : null}
        <ol className="mt-4">
          {primera === undefined ? null : (
            <li className="mb-4">
              <a href={primera.url} target="_blank" rel="noopener nofollow noreferrer" className={FILA}>
                <span className="block text-meta text-tinta-meta">
                  {primera.puesto} · Tendencia {donde(u)}{volumen(primera)}
                </span>
                <span className="mt-1 block max-w-[18ch] break-words font-titular text-seccion text-tinta-titulo">
                  {primera.nombre}
                </span>
              </a>
              <p className="mt-2 max-w-[40ch] text-cuerpo text-tinta-prosa">
                Es el ranking de X, no una medida {deQuien(u)}.
              </p>
            </li>
          )}
          {resto.map((t) => (
            <li key={t.puesto}>
              <a href={t.url} target="_blank" rel="noopener nofollow noreferrer" className={`${FILA} flex items-center gap-4`}>
                <span className="min-w-0 flex-1">
                  <span className="block text-meta text-tinta-meta">
                    {t.puesto} · Tendencia{volumen(t)}
                  </span>
                  <span className="mt-0.5 block break-words text-rotulo text-tinta-titulo">{t.nombre}</span>
                </span>
                <Abrir size={18} weight="light" aria-hidden className="shrink-0 text-tinta-inerte transition-colors group-hover:text-tinta-titulo" />
              </a>
            </li>
          ))}
        </ol>
      </>
    );
  }
  return (
    <section aria-label={`tendencias en X, ${nombre}`}>
      <h3 className="flex items-baseline gap-3 text-meta text-tinta-meta">
        <span className="font-medium text-tinta-dato">{nombre}</span>
        <span aria-hidden="true" className="h-px flex-1 self-center bg-vela" />
        {u.corte === null ? null : (
          <time dateTime={u.corte} className="tabular-nums">
            según X, {hora(u.corte)}
          </time>
        )}
      </h3>
      {cuerpo}
    </section>
  );
}

function VistaTendencias({ data, zona }: { data: DocTendencias; zona: ZonaRuta | null }) {
  const { sinToken, listas, conLista, huecos, sinVolumen, nacional, cabeza } = prepararTendencias(data, zona);

  return (
    <div>
      {sinToken ? (
        <p className="max-w-[70ch] text-lectura text-tinta-prosa">{MENSAJE_SIN_DISPONIBILIDAD}</p>
      ) : (
        <>
          <p className="max-w-[70ch] text-lectura text-tinta-titulo">{cabeza}</p>
        </>
      )}

      {sinToken ? null : (
        <div className="mt-10 grid gap-12 md:grid-cols-2 xl:grid-cols-3">
          {listas.map((u) => (
            <Lista
              key={u.id}
              u={u}
              conLista={conLista}
              igualANacional={u.ambito === "zona" && nacional !== null && mismaLista(u, nacional)}
            />
          ))}
        </div>
      )}

      {zona === null && huecos.length > 0 ? (
        <p className="mt-10 text-cuerpo">
          <Hueco titulo="Hueco de cobertura, registrado a propósito">
            X no publica lista de tendencias para {enumerar(huecos)}: es un hueco de cobertura,
            no un cero.
          </Hueco>
        </p>
      ) : null}

      <p className="mt-12 text-meta text-tinta-prosa">{PIE}</p>
    </div>
  );
}

export function PanelTendencias({
  zona,
}: {
  zona: ZonaRuta | null;
}) {
  const { data, error } = useTendencias();

  if (error !== undefined) {
    // El archivo lo escribe `pulso tendencias`, que corre solo con el token
    // de Apify encendido: antes de la primera corrida no existe. Al lector se
    // le dice el estado, no la causa.
    return (
      <p className="max-w-[70ch] text-lectura text-tinta-prosa">
        Todavía no hay tendencias de X. El resto del tablero funciona igual.
      </p>
    );
  }
  if (data === undefined) return <Esqueleto className="h-[320px]" />;
  return <VistaTendencias data={data} zona={zona} />;
}
