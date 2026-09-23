"use client";

import { FunnelSimple as Filtro } from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";
import { preload } from "swr";

import { CONTROL, Lector } from "@/components/lector/lector";
import { BuscadorRedes } from "./buscador-redes";
import { BusquedaRedes } from "./busqueda-redes";
import { OpcionesLugar } from "@/components/ui/opciones-lugar";
import { FilaPestanas } from "@/components/ui/pestanas";
import { RUTAS } from "@/lib/datos/config";
import { leerJson } from "@/lib/datos/fetcher";
import { ruta } from "@/lib/dominio/secciones";
import { NOMBRE_CORTO, NOMBRE_TODA_REGION, ZONAS_RUTA, type ZonaRuta } from "@/lib/dominio/zonas";
import { CUBETAS, cubetasDisponibles, rotuloRegion, type CubetaRegion, type OrdenLectura } from "@/lib/dominio/publicaciones";
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

/**
 * El ORDEN del recorrido, con la misma memoria de modulo y nunca en la URL (la
 * ruta de zona esta prerenderizada; `useSearchParams` ahi cuelga, ver arriba).
 *
 * Lo mas popular primero es la omision desde el 23 de septiembre de 2026, a
 * pedido del cliente, con «Más recientes» a un toque. Aplica a las cuatro
 * pestanas del visor y no a X, donde el orden es el ranking de X y ese es el
 * dato. El cambio remonta el recorrido y lo devuelve a la primera tarjeta,
 * que es lo correcto: es otra lectura, no la misma desplazada.
 */
let ultimoOrden: OrdenLectura = "populares";

/** `null` primero, que es toda la region, y luego las zonas. Local y no
 *  importado de chrome/selector-zona.tsx: ese modulo trae ConteoZona y aqui
 *  entraria al bundle de cliente. */
const OPCIONES_ZONA: readonly (ZonaRuta | null)[] = [null, ...ZONAS_RUTA];

interface PropsLector {
  zona: ZonaRuta | null;
  paneles: { x: ReactNode };
  menu: ReactNode;
  /** Si se pinta el boton de lectura automatica. Lo decide el servidor
   *  (`analisisHabilitado`): ANTHROPIC_API_KEY no lleva NEXT_PUBLIC_, asi que
   *  en cliente valdria "" y la guarda diria que no siempre. */
  analisis?: boolean;
}

/**
 * La bifurcacion entre el panel de medios y el modo de busqueda, SIN hooks.
 *
 * Existe por un error real: la primera version decidia dentro del componente
 * de abajo, con un `return` entre sus hooks. Al pasar de /redes a /redes?q=…
 * por navegacion de cliente, React reusa la misma instancia y la ve pintar
 * menos hooks que la vez anterior («Rendered fewer hooks than expected»).
 * Cada rama es un componente propio con sus propios hooks, y el `key` hace
 * que cambiar de termino monte una busqueda nueva.
 */
export function LectorRedes({ consulta = null, ...resto }: PropsLector & {
  /** La busqueda de la lupa (`?q=`), leida en el servidor por la ruta de
   *  region. Con texto, la pagina entera es el modo de busqueda
   *  (paneles/busqueda-redes.tsx). */
  consulta?: string | null;
}) {
  const q = (consulta ?? "").trim();
  if (q !== "") return <BusquedaRedes key={`q:${q}`} consulta={q} menu={resto.menu} />;
  return <LectorRedesMedios {...resto} />;
}

function LectorRedesMedios({ zona, paneles, menu, analisis = false }: PropsLector) {
  const [pestana, setPestana] = useState<Pestana>(() => ultimaPestana);
  useEffect(() => {
    ultimaPestana = pestana;
  }, [pestana]);
  const [cubeta, setCubeta] = useState<CubetaRegion>(() => ultimaCubeta);
  useEffect(() => {
    ultimaCubeta = cubeta;
  }, [cubeta]);
  const [orden, setOrden] = useState<OrdenLectura>(() => ultimoOrden);
  useEffect(() => {
    ultimoOrden = orden;
  }, [orden]);
  // Las cubetas solo existen en la vista de region: en una pagina de zona el
  // filtro ES la zona. Si solo una tiene filas, no hay nada que elegir.
  const instagram = useRedes();
  const tiktok = useTikTok();
  const youtube = useYouTube();
  const disponibles = zona === null ? cubetasDisponibles(instagram.data, tiktok.data, youtube.data) : [];
  const activa = disponibles.includes(cubeta) ? cubeta : (disponibles[0] ?? "corredor");
  // El rotulo de la barra mira las DOS cosas que el dialogo elige. Salia solo
  // de `zona`, asi que elegir Mexico o Mundo dejaba la barra diciendo «Toda la
  // región» y el cambio parecia no haber ocurrido. En una pagina de zona
  // `disponibles` es [] y `activa` colapsa a `corredor`, asi que el primer
  // caso gana sin necesitar guarda.
  const lugar = zona !== null ? NOMBRE_CORTO[zona] : rotuloRegion(activa);
  return (
    // `volver` va a la PORTADA de esta zona, por decision del cliente. Apunto
    // un dia a Prensa, cuando el muro tenia pagina propia, con el argumento de
    // que salir de un lector para caer en otro se lee como un callejon sin
    // salida. Prensa ya no existe y el destino es de nuevo un lector: quien
    // quiera otra pagina la tiene en el menu de la barra.
    <Lector volver={ruta(zona, null)} rotulo="Redes" valor={lugar} tituloOpciones="Lugar"
      opciones={<OpcionesLugarRedes zona={zona} cubetas={disponibles} activa={activa} onCubeta={setCubeta} />} menu={menu}
      // La lupa, tambien en una pagina de zona: el formulario envia siempre a
      // la vista de region, porque un termino no es un lugar.
      busqueda={<BuscadorRedes accion={ruta(null, "redes")} consulta={null} />}
      rotuloBusqueda="Buscar publicaciones"
      // Solo el orden. «De qué se habla» (conversacion-redes.tsx) vivia aqui,
      // con un icono de globos de dialogo, y salio de la barra el 23 de
      // septiembre de 2026 a pedido del cliente: los comentarios se leen desde
      // cada tarjeta. X son tendencias y no tiene orden que elegir.
      acciones={pestana === "x" ? null : <BotonOrden orden={orden} onCambiar={setOrden} />}
      pestanas={
        <FilaPestanas etiqueta="Plataforma" pestanas={PESTANAS.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          activa: p.id === pestana,
          onElegir: () => setPestana(p.id),
          // Un 404 aqui es un estado normal que el panel ya rotula -- el
          // archivo de texto vive fuera de git y el de tendencias llega con la
          // primera corrida --, no una promesa suelta que deba tumbar el
          // overlay de desarrollo ni ensuciar la consola.
          onCalentar: () => { for (const archivo of p.datos) void preload(archivo, leerJson).catch(() => undefined); },
        }))} />
      }>
      {/* X sigue siendo una hoja de prosa: son tendencias, no publicaciones
          que se puedan recorrer una por pantalla. Las otras cuatro caen en el
          visor. */}
      {pestana === "x"
        ? <div className="hoja-lector"><div className="mx-auto w-full max-w-[88rem] px-4 py-8 md:px-8">{paneles[pestana]}</div></div>
        : <VisorRedes key={`${zona ?? "region"}:${activa}`} zona={zona} filtro={pestana} cubeta={activa} analisis={analisis} orden={orden} />}
    </Lector>
  );
}

/**
 * «Más recientes»: un interruptor de la barra, `aria-pressed` como todo
 * selector del tablero. Apagado es la omision, lo mas popular primero; el
 * nombre accesible dice que hace al encenderlo y el `title` lo dice al pasar
 * el puntero, porque la barra es de iconos y un icono solo no se explica.
 * El icono es el embudo de filtro, el comun, desde el 23 de septiembre de
 * 2026 (cliente); antes era un reloj con flecha.
 */
function BotonOrden({ orden, onCambiar }: { orden: OrdenLectura; onCambiar: (o: OrdenLectura) => void }) {
  const recientes = orden === "recientes";
  return (
    <button type="button" className={CONTROL} aria-pressed={recientes} aria-label="Más recientes primero"
      title={recientes ? "Mostrando lo más reciente primero" : "Mostrando lo más popular primero"}
      onClick={() => onCambiar(recientes ? "populares" : "recientes")}>
      <Filtro size={22} weight={recientes ? "fill" : "regular"} aria-hidden />
    </button>
  );
}

/** El cuerpo del dialogo «Lugar». La forma es la de la portada
 *  (ui/opciones-lugar.tsx): las cubetas son el segmentado de alcance y las
 *  zonas las pastillas de debajo. Las zonas son enlaces, porque el lugar es el
 *  eje de la ruta y conserva la vista; las cubetas eligen sin navegar, porque
 *  son estado del visor. México e Internacional no se subdividen por ciudad:
 *  ofrecerlas dejaba «Todas» marcada bajo el ambito que se acababa de elegir. */
export function OpcionesLugarRedes({ zona, cubetas, activa, onCubeta }: {
  zona: ZonaRuta | null;
  cubetas: CubetaRegion[];
  activa: CubetaRegion;
  onCubeta: (c: CubetaRegion) => void;
}) {
  const cubetasConDatos = new Set(cubetas);
  return (
    <OpcionesLugar
      alcances={CUBETAS.filter((c) => cubetasConDatos.has(c.id)).map((c) => ({
        id: c.id,
        nombre: c.nombre,
        activo: c.id === activa,
        onElegir: () => onCubeta(c.id),
      }))}
      lugares={activa === "corredor"
        ? OPCIONES_ZONA.map((z) => ({
          id: z ?? "region",
          nombre: z === null ? NOMBRE_TODA_REGION : NOMBRE_CORTO[z],
          href: ruta(z, "redes"),
          activo: z === zona,
        }))
        : null}
    />
  );
}
