"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { preload } from "swr";

import { Lector } from "@/components/lector/lector";
import { ConversacionRedes } from "./conversacion-redes";
import { clasesChip } from "@/components/ui/clases";
import { RUTAS } from "@/lib/datos/config";
import { leerJson } from "@/lib/datos/fetcher";
import { ruta } from "@/lib/dominio/secciones";
import { NOMBRE_CORTO, ZONAS_RUTA, type ZonaRuta } from "@/lib/dominio/zonas";
import { CUBETAS, cubetasDisponibles, type CubetaRegion } from "@/lib/dominio/publicaciones";
import { useRedes, useTikTok, useYouTube } from "@/lib/datos/hooks";
import VisorRedes from "./visor-redes";

/**
 * La pagina de redes como lector: una barra, cinco pestanas, una caja.
 *
 * POR QUE EXISTE. Instagram, TikTok, YouTube y X eran facetas de una pagina
 * con encabezado, pastillas y una pareja Lista / Visual (selector-red.tsx,
 * 14 de septiembre de 2026). El 15 de septiembre las listas de Instagram y
 * TikTok se retiraron: el Visual es la unica presentacion, en el telefono y
 * en escritorio, y la pagina entera es el lector que ya tenia el telefono
 * (components/lector). Las plataformas se eligen con pestanas bajo la barra,
 * a la manera de la pagina de tendencias de X —texto y un subrayado corto—,
 * porque son la misma pregunta —de que se habla— en cinco lugares.
 *
 * SE PINTA UNA SOLA. Cada pestana es una isla que pide su propio JSON, asi
 * que montarlas todas para esconder cuatro cuesta peticiones para nada. Con
 * `preload` al pasar el puntero o al enfocar, la que sigue ya esta en el
 * cache de SWR antes de que el clic se resuelva.
 *
 * Grupo de `aria-pressed` y no un `tablist`: es el patron de todo selector
 * del tablero y no inventa un manejo de flechas propio. El estilo de pestana
 * lo da `.pestana-lector` en globals.css.
 *
 * YouTube y X llegan COMO NODOS desde la pagina de servidor: su prosa es la
 * honestidad del producto y viaja en el HTML aunque el bundle tarde.
 *
 * EL VISOR SE IMPORTA DERECHO, NUNCA CON next/dynamic. Lo tuvo hasta el 17 de
 * septiembre de 2026 y colgaba la pagina de una zona: en /tijuana/redes cargada
 * en frio -- escribiendo la direccion o recargando -- el limite de Suspense que
 * `dynamic` monta se quedaba pendiente PARA SIEMPRE y la caja se quedaba en su
 * rotulo de carga. Medido: tres de tres cargas en frio atascadas en /<zona>
 * /redes, cero de dos en /redes.
 *
 * Las dos diferencias que lo explican, y por eso no se arregla con un `ssr`:
 * entrar por un enlace SI funcionaba -- el chunk ya estaba en memoria, asi que
 * el limite resolvia en el mismo render y nadie lo veia --, y la ruta de zona
 * es la unica prerenderizada por `generateStaticParams` con `dynamicParams`
 * apagado. Es la misma forma del fallo que ya esta escrito en paginas/
 * en-tendencia.tsx: un limite de Suspense sobre una ruta prerenderizada se
 * queda colgado, compila y se ve bien en una laptop.
 *
 * Y no costaba nada partirlo: la pestana de omision es «todas», que monta el
 * visor, asi que su chunk se pedia en CADA visita. `dynamic` no ahorraba una
 * descarga, agregaba una cascada -- primero la pagina, luego el visor -- y un
 * limite que se podia colgar. Solo YouTube y X viven sin el, y esos llegan
 * como nodos de servidor.
 */

const PESTANAS = [
  { id: "todas", nombre: "Todas", datos: [RUTAS.redes, RUTAS.tiktok, RUTAS.youtube, RUTAS.redesComentarios, RUTAS.tiktokComentarios] },
  { id: "instagram", nombre: "Instagram", datos: [RUTAS.redes, RUTAS.redesComentarios] },
  { id: "tiktok", nombre: "TikTok", datos: [RUTAS.tiktok, RUTAS.tiktokComentarios] },
  // Hasta el 18 de septiembre de 2026 esta pestana era el panel agregado de
  // comentarios (conversacion.json), congelado desde el 4 de septiembre porque
  // el cron no lo refresca. Ahora es un visor como los dos de arriba, con los
  // Shorts y los videos de los canales del corredor. Sin par de comentarios:
  // el feed publico no los trae.
  { id: "youtube", nombre: "YouTube", datos: [RUTAS.youtube] },
  { id: "x", nombre: "X", datos: [RUTAS.tendencias] },
] as const;

type Pestana = (typeof PESTANAS)[number]["id"];

/** La pestana elegida sobrevive al cambio de lugar: /tijuana/redes en X y
 *  elegir Ensenada debe abrir /ensenada/redes en X. El lugar es ruta y
 *  remonta la pagina, asi que el recuerdo vive en el modulo, no en el estado.
 *  En una carga completa el modulo nace en «todas» en servidor y cliente. */
let ultimaPestana: Pestana = "todas";

/**
 * El AMBITO de la vista de region, con la misma memoria de modulo.
 *
 * Un video del mundo trae ordenes de magnitud mas likes que uno de Tecate, asi
 * que sin separarlos el corredor desaparecia de su propia portada. Vivia en
 * las pastillas de la Lista; al retirarse esa vista el 15 de septiembre de
 * 2026 se habria perdido con ella, y baja aqui.
 *
 * Va en el dialogo de LUGAR y no sobre el recorrido: la caja ES la pantalla, y
 * visor-redes.tsx deja por escrito que una linea encima encogeria las
 * tarjetas. Ademas es el eje de lugar, que es justo lo que ese dialogo elige.
 */
let ultimaCubeta: CubetaRegion = "corredor";

/** `null` primero, que es toda la region, y luego las zonas. Local y no
 *  importado de chrome/selector-zona.tsx: ese modulo trae ConteoZona y aqui
 *  entraria al bundle de cliente. */
const OPCIONES_ZONA: readonly (ZonaRuta | null)[] = [null, ...ZONAS_RUTA];

export function LectorRedes({ zona, paneles, menu, analisis = false }: {
  zona: ZonaRuta | null;
  paneles: { x: ReactNode };
  menu: ReactNode;
  /** Si se pinta el boton de lectura automatica. Lo decide el servidor
   *  (`analisisHabilitado`): ANTHROPIC_API_KEY no lleva NEXT_PUBLIC_, asi que
   *  en cliente valdria "" y la guarda diria que no siempre. */
  analisis?: boolean;
}) {
  const [pestana, setPestana] = useState<Pestana>(() => ultimaPestana);
  useEffect(() => {
    ultimaPestana = pestana;
  }, [pestana]);
  const [cubeta, setCubeta] = useState<CubetaRegion>(() => ultimaCubeta);
  useEffect(() => {
    ultimaCubeta = cubeta;
  }, [cubeta]);
  // Las cubetas solo existen en la vista de region: en una pagina de zona el
  // filtro ES la zona. Si solo una tiene filas, no hay nada que elegir.
  const instagram = useRedes();
  const tiktok = useTikTok();
  const youtube = useYouTube();
  const disponibles = zona === null ? cubetasDisponibles(instagram.data, tiktok.data, youtube.data) : [];
  const activa = disponibles.includes(cubeta) ? cubeta : (disponibles[0] ?? "corredor");
  const lugar = zona === null ? "Toda la región" : NOMBRE_CORTO[zona];
  return (
    // `volver` va a la PORTADA de esta zona, por decision del cliente. Apunto
    // un dia a Prensa, cuando el muro tenia pagina propia, con el argumento de
    // que salir de un lector para caer en otro se lee como un callejon sin
    // salida. Prensa ya no existe y el destino es de nuevo un lector: quien
    // quiera otra pagina la tiene en el menu de la barra.
    <Lector volver={ruta(zona, null)} rotulo="Redes" valor={lugar} tituloOpciones="Lugar"
      opciones={<OpcionesLugar zona={zona} cubetas={disponibles} activa={activa} onCubeta={setCubeta} />} menu={menu}
      // «De que se habla» va en la barra y no en una pestana: las pestanas son
      // plataformas y esta pregunta las cruza. Solo con Instagram o TikTok
      // delante -- YouTube no cosecha comentarios y X son tendencias, no
      // comentarios.
      acciones={pestana === "youtube" || pestana === "x" ? null
        : <ConversacionRedes key={`${zona ?? "region"}:${activa}`} zona={zona} cubeta={activa} analisis={analisis} />}
      pestanas={
        <div role="group" aria-label="Plataforma" className="pestanas-lector">
          {PESTANAS.map((p) => {
            const calentar = () => {
              // Un 404 aqui es un estado normal que el panel ya rotula -- el
              // archivo de texto vive fuera de git y el de tendencias llega
              // con la primera corrida --, no una promesa suelta que deba
              // tumbar el overlay de desarrollo ni ensuciar la consola.
              for (const archivo of p.datos) void preload(archivo, leerJson).catch(() => undefined);
            };
            return (
              <button key={p.id} type="button" className="pestana-lector text-cuerpo" aria-pressed={p.id === pestana}
                onClick={() => setPestana(p.id)} onPointerEnter={calentar} onFocus={calentar}>
                {p.nombre}
              </button>
            );
          })}
        </div>
      }>
      {/* X sigue siendo una hoja de prosa: son tendencias, no publicaciones
          que se puedan recorrer una por pantalla. Las otras cuatro caen en el
          visor. */}
      {pestana === "x"
        ? <div className="hoja-lector"><div className="mx-auto w-full max-w-[88rem] px-4 py-8 md:px-8">{paneles[pestana]}</div></div>
        : <VisorRedes key={`${zona ?? "region"}:${activa}`} zona={zona} filtro={pestana} cubeta={activa} analisis={analisis} />}
    </Lector>
  );
}

/** El cuerpo del dialogo «Lugar»: enlaces, porque el lugar es el eje de la
 *  ruta y conserva la vista, como el selector del encabezado. El lector cierra
 *  el dialogo al pulsar uno. */
function OpcionesLugar({ zona, cubetas, activa, onCubeta }: {
  zona: ZonaRuta | null;
  cubetas: CubetaRegion[];
  activa: CubetaRegion;
  onCubeta: (c: CubetaRegion) => void;
}) {
  const cubetasConDatos = new Set(cubetas);

  return (
    <div className="grid gap-4 p-4">
      {/* El ambito primero, como en el dialogo de la portada: son tres y
          siempre caben, y las zonas fluyen debajo. */}
      {cubetas.length > 1 ? (
        <div role="group" aria-label="Ámbito" className="grid grid-cols-3 gap-1 rounded-full border border-filo bg-vanta p-1">
          {CUBETAS.filter((c) => cubetasConDatos.has(c.id)).map((c) => (
            <button key={c.id} type="button" aria-pressed={c.id === activa}
              onClick={() => onCubeta(c.id)}
              className={[
                "rounded-full px-3 py-2 text-center text-cuerpo",
                "transition-colors duration-[var(--dur-toque)] ease-firma",
                c.id === activa ? "bg-realce text-tinta-titulo" : "text-tinta-prosa hover:bg-vela hover:text-tinta-titulo",
              ].join(" ")}>
              {c.nombre}
            </button>
          ))}
        </div>
      ) : null}
    <ul className="grid gap-2">
      {OPCIONES_ZONA.map((z) => {
        const activo = z === zona;
        return (
          <li key={z ?? "region"}>
            <Link href={ruta(z, "redes")} aria-current={activo ? "page" : undefined} className={`${clasesChip(activo)} w-full justify-between`}>
              {z === null ? "Toda la región" : NOMBRE_CORTO[z]}
              {activo ? <span aria-hidden>✓</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
    </div>
  );
}
