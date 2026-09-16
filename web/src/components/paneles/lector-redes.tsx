"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { preload } from "swr";

import { Lector } from "@/components/lector/lector";
import { clasesChip } from "@/components/ui/clases";
import { RUTAS } from "@/lib/datos/config";
import { leerJson } from "@/lib/datos/fetcher";
import { ruta } from "@/lib/dominio/secciones";
import { NOMBRE_CORTO, ZONAS_RUTA, type ZonaRuta } from "@/lib/dominio/zonas";

const VisorRedes = dynamic(() => import("./visor-redes"), {
  loading: () => <p role="status" className="p-8 text-lectura text-tinta-meta">Cargando publicaciones…</p>,
});

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
 */

const PESTANAS = [
  { id: "todas", nombre: "Todas", datos: [RUTAS.redes, RUTAS.tiktok, RUTAS.redesComentarios, RUTAS.tiktokComentarios] },
  { id: "instagram", nombre: "Instagram", datos: [RUTAS.redes, RUTAS.redesComentarios] },
  { id: "tiktok", nombre: "TikTok", datos: [RUTAS.tiktok, RUTAS.tiktokComentarios] },
  { id: "youtube", nombre: "YouTube", datos: [RUTAS.conversacion] },
  { id: "x", nombre: "X", datos: [RUTAS.tendencias] },
] as const;

type Pestana = (typeof PESTANAS)[number]["id"];

/** La pestana elegida sobrevive al cambio de lugar: /tijuana/redes en X y
 *  elegir Ensenada debe abrir /ensenada/redes en X. El lugar es ruta y
 *  remonta la pagina, asi que el recuerdo vive en el modulo, no en el estado.
 *  En una carga completa el modulo nace en «todas» en servidor y cliente. */
let ultimaPestana: Pestana = "todas";

/** `null` primero, que es toda la region, y luego las zonas. Local y no
 *  importado de chrome/selector-zona.tsx: ese modulo trae ConteoZona y aqui
 *  entraria al bundle de cliente. */
const OPCIONES_ZONA: readonly (ZonaRuta | null)[] = [null, ...ZONAS_RUTA];

export function LectorRedes({ zona, paneles, menu, informacion }: {
  zona: ZonaRuta | null;
  paneles: { youtube: ReactNode; x: ReactNode };
  menu: ReactNode;
  informacion: ReactNode;
}) {
  const [pestana, setPestana] = useState<Pestana>(() => ultimaPestana);
  useEffect(() => {
    ultimaPestana = pestana;
  }, [pestana]);
  const lugar = zona === null ? "Toda la región" : NOMBRE_CORTO[zona];
  return (
    // `volver` va a la PORTADA de esta zona, por decision del cliente. Apunto
    // un dia a Prensa, cuando el muro tenia pagina propia, con el argumento de
    // que salir de un lector para caer en otro se lee como un callejon sin
    // salida. Prensa ya no existe y el destino es de nuevo un lector: quien
    // quiera otra pagina la tiene en el menu de la barra.
    <Lector volver={ruta(zona, null)} rotulo="Redes" valor={lugar} tituloOpciones="Lugar"
      opciones={<OpcionesLugar zona={zona} />} menu={menu}
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
      }
      informacion={informacion}>
      {pestana === "youtube" || pestana === "x"
        ? <div className="hoja-lector" tabIndex={0}><div className="mx-auto w-full max-w-[88rem] px-4 py-8 md:px-8">{paneles[pestana]}</div></div>
        : <VisorRedes key={zona ?? "region"} zona={zona} filtro={pestana} />}
    </Lector>
  );
}

/** El cuerpo del dialogo «Lugar»: enlaces, porque el lugar es el eje de la
 *  ruta y conserva la vista, como el selector del encabezado. El lector cierra
 *  el dialogo al pulsar uno. */
function OpcionesLugar({ zona }: { zona: ZonaRuta | null }) {
  return (
    <ul className="grid gap-2 p-4">
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
  );
}
