"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChatCircle as IconoComentarios } from "@phosphor-icons/react";
import { useRedes, useRedesComentarios, useTikTok, useTikTokComentarios, useYouTube } from "@/lib/datos/hooks";
import type { ComentarioPublicado } from "@/lib/datos/tipos";
import { NOMBRE_RED, ordenarPublicaciones, reunirPublicaciones, type CubetaRegion, type OrdenLectura, type PublicacionVisual, type RedVisual } from "@/lib/dominio/publicaciones";
import { MINIMO_VIDEOS_RESUMEN } from "@/lib/analisis/contrato-publicacion";
import { filtrarPorTexto, SIN_FILAS_BUSQUEDA } from "@/lib/dominio/consultas";
import { fechaCorta, hace, hora } from "@/lib/dominio/formato";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";
import { teclasDelRecorrido, useRecorrido } from "@/lib/pantalla/recorrido";
import { clasesBoton } from "@/components/ui/clases";
import { BotonAnalizar, FichaPublicacion } from "./analisis-publicacion";
import { ComentariosPublicacion, VistaPreviaComentarios, type Textos } from "./comentarios-publicacion";
import { EsqueletoMedio, MedioSocial } from "./medio-social";
import { ResumenTikTokBloque } from "./resumen-tiktok";
import { Hoja } from "@/components/ui/hoja";

/** Las tres pestanas que caen aqui; YouTube y X son otras hojas del lector. */
export type FiltroVisual = "todas" | RedVisual;

const SIN_FILAS = "No hay publicaciones disponibles para esta selección. Es un hueco, no un cero.";

/** Corte de cada plataforma (`generado` de su archivo). La antiguedad se mide
 *  contra el, nunca contra el reloj del navegador: ver formato.ts::hace. */
export type Cortes = Partial<Record<RedVisual, string>>;

/** El visor reproduce un solo medio: ocultar treinta iframes con CSS deja
 * treinta reproductores vivos. Los metadatos si permanecen para poder
 * recorrerlos. Desde el 22 de septiembre de 2026 monta DOS: el asentado y,
 * si es de Instagram o TikTok, el siguiente, precargado y en pausa (ver
 * `PRECARGA`). Montar solo el asentado cobraba el arranque entero despues de
 * cada gesto -- 1.3 a 1.9 s el reproductor de TikTok, 1.5 s solo el documento
 * del embed de Instagram --; con la siguiente ya cargada, TikTok pasa de
 * pausa a reproducir en 42 ms, medido.
 *
 * ES UNA TARJETA POR PANTALLA, dentro del lector (components/lector) en todo
 * ancho desde el 15 de septiembre de 2026. El 14 nacio como Visual del
 * telefono junto a una Lista que en escritorio era la entrada; la Lista se
 * fue y con ella la barra Anterior / Siguiente y el desplazamiento de pagina.
 * Cada tarjeta mide la caja (`--alto-tarjeta`): en el telefono el titular va
 * debajo del medio con las cifras en una columna al costado; en escritorio el
 * medio va a la izquierda y a la derecha el titular, las cifras, «Ver
 * original», «Comentarios» y una vista previa de los dos comentarios mas
 * votados. El mismo arbol JSX sirve a los dos con clases `md:`; nada se monta
 * dos veces. La altura y el ancho del medio los fija globals.css
 * (`.publicacion-visual`, `.medio-visual`), no clases arbitrarias, porque el
 * numero de la reserva tiene que vivir en un solo lugar.
 *
 * Los comentarios viven en la tarjeta desde que no hay Lista: el texto es lo
 * que la direccion pidio ver el 8 de septiembre de 2026. Una sola hoja
 * (`<dialog>`) para todo el recorrido, nunca una por tarjeta; su cuerpo esta
 * en paneles/comentarios-publicacion.tsx. */
export default function VisorRedes({ zona, filtro, cubeta = "corredor", analisis = false, filtroTexto = null, orden = "recientes" }: {
  zona: ZonaRuta | null;
  filtro: FiltroVisual;
  cubeta?: CubetaRegion;
  analisis?: boolean;
  /** Populares o recientes primero (lector-redes.tsx lo elige). Recientes por
   *  omision, que es lo que la busqueda por texto siempre leyo. */
  orden?: OrdenLectura;
  /** La busqueda de Redes cuando lo escrito no es un termino en seguimiento:
   *  filtra por texto lo que ya esta cargado (pies y comentarios), sin pedir
   *  nada a nadie. Ver lib/dominio/consultas.ts. */
  filtroTexto?: string | null;
}) {
  const instagram = useRedes();
  const tiktok = useTikTok();
  const youtube = useYouTube();
  const textosInstagram = useRedesComentarios();
  const textosTikTok = useTikTokComentarios();
  // YouTube NO tiene entrada: su feed publico no trae comentarios, asi que no
  // hay archivo de texto que pedir. El visor lo decide por
  // `cosecha_comentarios` del documento y no por la red, para que encenderlos
  // despues sea un cambio de datos y no de codigo.
  const textos: Partial<Record<RedVisual, Textos>> = { instagram: textosInstagram, tiktok: textosTikTok };
  const publicaciones = useMemo(() => reunirPublicaciones(instagram.data, tiktok.data, youtube.data, zona, cubeta), [instagram.data, tiktok.data, youtube.data, zona, cubeta]);
  const q = (filtroTexto ?? "").trim();
  const filas = useMemo(() => {
    // El orden DESPUES del filtro de pestana: «populares» reparte puestos por
    // red, y en una pestana de una red eso es su orden de merito.
    const porRed = ordenarPublicaciones(publicaciones.filter((fila) => filtro === "todas" || fila.red === filtro), orden);
    return q === "" ? porRed : filtrarPorTexto(porRed, { instagram: textosInstagram.data, tiktok: textosTikTok.data }, q);
  }, [publicaciones, filtro, q, orden, textosInstagram.data, textosTikTok.data]);
  // «Resumen con IA», plegado y primero en la pestana TikTok, con los videos
  // debajo (23 de septiembre de 2026). Cuenta lo mismo que la ruta: videos
  // con pie y con URL canonica. Debajo del piso no hay resumen ni peticion;
  // los videos siguen ahi, asi que no hay hueco que rotular. Nunca en la
  // busqueda por texto.
  const resumible = filtro === "tiktok" && analisis && q === "" && tiktok.data?.generado !== undefined
    && filas.filter((fila) => fila.url !== null && fila.post.titulo.trim() !== "").length >= MINIMO_VIDEOS_RESUMEN;
  const resumen = resumible
    ? (irA: (clave: string) => boolean) => <ResumenTikTokBloque zona={zona} cubeta={cubeta} generado={tiktok.data!.generado} irA={irA} />
    : undefined;
  const cortes: Cortes = { instagram: instagram.data?.generado, tiktok: tiktok.data?.generado, youtube: youtube.data?.generado };
  // `cosecha_comentarios` ausente se lee como true: un corte anterior al 18 de
  // septiembre de 2026 no lo trae y si cosechaba.
  const conComentarios: Partial<Record<RedVisual, boolean>> = {
    instagram: instagram.data?.cosecha_comentarios ?? true,
    tiktok: tiktok.data?.cosecha_comentarios ?? true,
    youtube: youtube.data?.cosecha_comentarios ?? true,
  };
  // Una plataforma del filtro actual sin datos y sin error: todavia carga.
  const pide = (red: RedVisual) => filtro === "todas" || filtro === red;
  const cargando =
    (pide("instagram") && !instagram.data && !instagram.error) ||
    (pide("tiktok") && !tiktok.data && !tiktok.error) ||
    (pide("youtube") && !youtube.data && !youtube.error);
  const estados = ([
    ["instagram", instagram, "Instagram"],
    ["tiktok", tiktok, "TikTok"],
    ["youtube", youtube, "YouTube"],
  ] as const).map(([red, r, nombre]) =>
    pide(red) && !r.data
      ? r.error ? `Las publicaciones de ${nombre} no están disponibles.` : `Cargando ${nombre}…`
      : null,
  ).filter((estado): estado is string => estado !== null);
  return (
    <>
      {/* El estado se dice pero no ocupa lugar: la caja es la pantalla y una
          linea encima encogeria las tarjetas. */}
      {estados.map((estado) => <p key={estado} role="status" className="sr-only">{estado}</p>)}
      <RecorridoPublicaciones key={`${filtro}:${q}:${filas.map((fila) => fila.clave).join("|")}`} publicaciones={filas} cortes={cortes} cargando={cargando} textos={textos} conComentarios={conComentarios} analisis={analisis}
        sinFilas={q === "" ? undefined : SIN_FILAS_BUSQUEDA(q)} resumen={resumen} />
    </>
  );
}

/** Las redes cuya tarjeta siguiente se monta por adelantado. YouTube NO: su
 *  iframe se reproduce solo y no tiene aqui canal para pausarlo, asi que
 *  precargarlo seria un segundo video sonando fuera de pantalla. Facebook no
 *  aparece mas que en las consultas por termino. */
const PRECARGA: ReadonlySet<RedVisual> = new Set(["instagram", "tiktok"]);

/** El medio montado cambia cuando el desplazamiento ASIENTA, nunca a mitad
 *  del gesto (useRecorrido): la tarjeta que sale sigue viva mientras el dedo
 *  la arrastra y la que entra monta su medio ya quieta en su sitio.
 *
 *  Sin filas, la caja sigue ahi con una tarjeta que mide lo mismo: el
 *  esqueleto mientras carga, y si no hay nada, el hueco dicho como hueco. La
 *  caja ES la pantalla, y una linea suelta en su lugar dejaria el lector
 *  vacio. */
export function RecorridoPublicaciones({ publicaciones, cortes, cargando, textos, conComentarios, analisis, sinFilas = SIN_FILAS, cabecera, resumen, lugar = true, vistaPrevia = true }: {
  publicaciones: PublicacionVisual[];
  cortes: Cortes;
  cargando: boolean;
  /** Parcial: una plataforma sin cosecha de comentarios no tiene archivo de
   *  texto que pedir. Ver `conComentarios`. */
  textos: Partial<Record<RedVisual, Textos>>;
  conComentarios: Partial<Record<RedVisual, boolean>>;
  analisis: boolean;
  /** El hueco, dicho como hueco. La busqueda por texto trae el suyo. */
  sinFilas?: string;
  /** Una PRIMERA tarjeta que no es publicacion: la ficha de un termino en
   *  seguimiento (paneles/ficha-consulta.tsx). Ocupa el indice 0 del ajuste y
   *  las publicaciones se corren una; el contador «n de total» sigue contando
   *  solo publicaciones. */
  cabecera?: ReactNode;
  /** El resumen de la pestana TikTok (paneles/resumen-tiktok.tsx): tambien
   *  el indice 0, pero del alto de su CONTENIDO y no de la caja
   *  (`.resumen-recorrido`), para que el primer video asome en la misma
   *  pantalla. Recibe `irA`, que lleva el recorrido a la tarjeta de una
   *  `clave`: cada fuente del resumen lleva a su video. Se pasa uno u otro,
   *  nunca los dos; si llegaran ambos, gana `cabecera`. */
  resumen?: (irA: (clave: string) => boolean) => ReactNode;
  /** Si la banda dice el lugar («sobre Tijuana»). La consulta por termino lo
   *  apaga (23 de septiembre de 2026): un termino no es un lugar, la ficha
   *  nunca lee `zona`, y «sobre un lugar sin precisar» era ruido. */
  lugar?: boolean;
  /** Si la columna de escritorio adelanta dos comentarios. La consulta lo
   *  apaga el mismo dia, a pedido del cliente: los comentarios se abren con
   *  el boton, cuando quien lee los pide. */
  vistaPrevia?: boolean;
}) {
  const desplazamiento = cabecera === undefined && resumen === undefined ? 0 : 1;
  const contenedor = useRef<HTMLDivElement>(null);
  const { actual, enPantalla, ir } = useRecorrido(contenedor);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const cambiar = () => setVisible(document.visibilityState === "visible");
    cambiar();
    document.addEventListener("visibilitychange", cambiar);
    return () => document.removeEventListener("visibilitychange", cambiar);
  }, []);
  // ABRIR CUENTA TURNOS, NO LA PUBLICACION. El efecto colgaba de la fila y
  // `onClose` la devolvia a null, asi que abrir, cerrar y volver a pulsar la
  // MISMA tarjeta escribia el mismo valor dos veces: React no re-renderiza, el
  // efecto no vuelve a correr y la hoja no abria nunca mas para esa
  // publicacion. Habia que pasar por otra y volver. El turno siempre cambia.
  const hoja = useRef<HTMLDialogElement>(null);
  const [abierta, setAbierta] = useState<PublicacionVisual | null>(null);
  const [turnoComentarios, setTurnoComentarios] = useState(0);
  useEffect(() => {
    if (turnoComentarios > 0) hoja.current?.showModal();
  }, [turnoComentarios]);
  // La ficha de IA: OTRA hoja unica, por el mismo motivo escrito arriba. Una
  // por tarjeta serian noventa y ocho dialogos montados.
  const hojaIA = useRef<HTMLDialogElement>(null);
  const [analizada, setAnalizada] = useState<PublicacionVisual | null>(null);
  const [turnoIA, setTurnoIA] = useState(0);
  useEffect(() => {
    if (turnoIA > 0) hojaIA.current?.showModal();
  }, [turnoIA]);
  const total = publicaciones.length;
  const irA = (clave: string): boolean => {
    const indice = publicaciones.findIndex((fila) => fila.clave === clave);
    if (indice === -1) return false;
    ir(indice + desplazamiento);
    return true;
  };
  return <>
    <div ref={contenedor} className="recorrido-lector" tabIndex={0} role="region" aria-label="Publicaciones"
      onKeyDown={(evento) => teclasDelRecorrido(evento, actual, total + desplazamiento, ir)}>
      {cabecera === undefined ? null : (
        <article data-indice={0} aria-label="Ficha del término" className="publicacion-visual mx-auto flex w-full max-w-[88rem] flex-col justify-center overflow-y-auto px-4 py-6 md:px-8">
          {cabecera}
        </article>
      )}
      {cabecera !== undefined || resumen === undefined ? null : (
        <div data-indice={0} className="resumen-recorrido border-b border-filo px-4 pt-6 pb-8 md:px-8">
          {resumen(irA)}
        </div>
      )}
      {publicaciones.map((fila, indice) => (
        <Publicacion key={fila.clave} lugar={lugar} vistaPrevia={vistaPrevia} fila={fila} indice={indice} posicion={indice + desplazamiento} total={total} corte={cortes[fila.red]}
          activo={indice + desplazamiento === actual && visible && enPantalla}
          preparado={indice + desplazamiento === actual + 1 && visible && enPantalla && PRECARGA.has(fila.red)}
          comentarios={textos[fila.red]?.data?.por_post[fila.post.url]}
          conComentarios={conComentarios[fila.red] ?? true}
          analisis={analisis}
          onComentarios={() => { setAbierta(fila); setTurnoComentarios((t) => t + 1); }}
          onAnalizar={() => { setAnalizada(fila); setTurnoIA((t) => t + 1); }} />
      ))}
      {total === 0
        ? cargando
          ? <EsqueletoPublicacion />
          : <div className="publicacion-visual flex items-center px-4 md:px-8"><p className="mx-auto w-full max-w-[88rem] text-lectura text-tinta-meta">{sinFilas}</p></div>
        : null}
    </div>
    <Hoja ref={hoja} titulo="Comentarios" rotuloCerrar="Cerrar comentarios" onClose={() => setAbierta(null)}>
      {abierta === null || textos[abierta.red] === undefined
        ? null
        : <ComentariosPublicacion key={abierta.clave} fila={abierta} textos={textos[abierta.red]!} />}
    </Hoja>
    <Hoja ref={hojaIA} titulo="Lectura automática" rotuloCerrar="Cerrar lectura" onClose={() => setAnalizada(null)}>
      {/* `key` por publicacion: la ficha no debe heredar el estado de la
          anterior, ni su confirmacion ya pulsada. */}
      {analizada === null ? null : <FichaPublicacion key={analizada.clave} fila={analizada} />}
    </Hoja>
  </>;
}

/** Instagram: la zona es la sede de la cuenta («desde»). TikTok: la zona sale
 *  del texto del video («sobre»). Una preposicion cada una, sin oracion.
 *
 *  `fuera` y `nacional` son los dos residuos y NO son lo mismo: uno nombro un
 *  lugar que este tablero no cubre y el otro no nombro ninguno. El alcance los
 *  separa; un corte anterior al 15 de septiembre de 2026 no lo trae y los dos
 *  caen en «un lugar sin precisar», que es lo que se decia antes.
 *
 *  En Mundo pasa lo mismo desde el 22 de septiembre de 2026: la cubeta junta
 *  lo que nombro el extranjero (`extranjero`) con lo que vino de una fuente
 *  del mundo sin nombrar nada (`nacional`). Solo lo primero dice «el mundo»;
 *  lo segundo no se verifico, y decirlo seria afirmar lo que nadie midio. */
function lugarDe(fila: PublicacionVisual): string {
  const { zona, alcance } = fila.post;
  // «desde» cuando la zona es la sede declarada de la cuenta (Instagram en el
  // panel de medios, que no publica `alcance`); «sobre» cuando salio del texto
  // con el gacetero: TikTok, YouTube, Facebook, las cuentas de Instagram con
  // `ambito` y las tres redes de una consulta por termino. Lo decide el dato,
  // no la red.
  const porTexto = fila.red !== "instagram" || alcance !== undefined;
  // `estatal` con alcance `nacional` es la pieza de un medio del corredor que
  // no nombro lugar (22 de septiembre de 2026, pulso/redes.py::
  // residuo_de_medio): va en Corredor, pero decir «Baja California» seria
  // afirmar lo que la pieza no dice.
  const nombre = NOMBRE_CORTO[zona as ZonaRuta]
    ?? (zona === "estatal" && alcance !== "nacional"
      ? "Baja California"
      : zona === "internacional" && alcance !== "nacional"
        ? "el mundo"
        : alcance === "fuera"
          ? "un lugar fuera del corredor"
          : "un lugar sin precisar");
  return `${porTexto ? "sobre" : "desde"} ${nombre}`;
}

function Publicacion({ fila, indice, posicion, total, corte, activo, preparado, comentarios, conComentarios, analisis, onComentarios, onAnalizar, lugar, vistaPrevia }: {
  lugar: boolean;
  vistaPrevia: boolean;
  fila: PublicacionVisual;
  /** Lugar entre las publicaciones, para el contador. */
  indice: number;
  /** Lugar en el ajuste (`data-indice`): el mismo, o uno mas si hay ficha. */
  posicion: number;
  total: number;
  corte: string | undefined;
  activo: boolean;
  /** La tarjeta siguiente a la asentada: monta su medio sin reproducirlo. */
  preparado: boolean;
  comentarios: ComentarioPublicado[] | undefined;
  /** Si la plataforma cosecha comentarios. Cuando no, la tarjeta no ofrece ni
   *  la hoja ni Analizar: no hay texto que abrir ni que leerle a un modelo, y
   *  un boton que abre "no hay comentarios" en TODAS las tarjetas es peor que
   *  no tenerlo. Sale de `cosecha_comentarios` del documento, no de la red. */
  conComentarios: boolean;
  analisis: boolean;
  onComentarios: () => void;
  onAnalizar: () => void;
}) {
  const iso = fila.post.publicado ?? fila.post.fecha;
  const antiguedad = corte ? hace(iso, corte) : "";
  const cuando = antiguedad ? `hace ${antiguedad}` : `${fechaCorta(iso)}${fila.post.publicado ? ` · ${hora(fila.post.publicado)}` : ""}`;
  return <article data-indice={posicion} aria-label={`Publicación ${indice + 1} de ${total}`}
    className="publicacion-visual mx-auto flex w-full max-w-[88rem] flex-col md:grid md:grid-cols-2 md:items-center md:gap-12 md:px-8 md:py-8">
    <EspacioMedio publicacion={fila} activo={activo} preparado={preparado} />
    {/* La banda del titular va DEBAJO del medio, en flujo, no encima: encima
        taparia el pie propio de Instagram (autor, enlace) y exigiria juegos de
        pointer-events sobre el iframe. En telefono cabe en dos lineas de
        titular; la columna de escritorio lo muestra entero. */}
    <div className="relative min-w-0 px-4 pb-6 md:static md:px-0 md:pb-0">
      <h2 className="line-clamp-2 break-words text-cuerpo text-tinta-titulo md:line-clamp-none md:text-rotulo">{fila.post.titulo || "Publicación sin título"}</h2>
      <p className="mt-2 text-meta text-tinta-meta md:mt-4 md:text-cuerpo md:text-tinta-prosa">
        {fila.fuente} · {NOMBRE_RED[fila.red]} · <time dateTime={iso}>{cuando}</time>{lugar ? ` · ${lugarDe(fila)}` : ""}
      </p>
      {/* AQUI VIVIAN CINCO CIFRAS y se fueron el 17 de septiembre de 2026, a
          peticion del cliente: el embed las trae al lado y las trae mejor, que
          las lee en vivo mientras el corte tiene hasta seis horas. En su
          captura el video decia 3,944 likes y la tarjeta 3,635 -- dos numeros
          para lo mismo en la misma pantalla, y el nuestro el equivocado.
          Tampoco queda el contador del boton de comentarios ni el de likes de
          cada comentario (comentarios-publicacion.tsx).

          No rompe la regla 4: prohibe RELLENAR un hueco con un cero, no obliga
          a pintar una cifra. Sin la fila no hay afirmacion que matizar, y el
          «sin dato» de compartidos y guardados de Instagram se va con ella.
          El pie del sitio sigue diciendo las cinco reglas enteras. */}
      <div className="mt-3 flex flex-wrap items-center gap-3 md:mt-6">
        {fila.url
          ? <a href={fila.url} target="_blank" rel="noopener noreferrer nofollow" className={clasesBoton(true)}>Abrir en {NOMBRE_RED[fila.red]}</a>
          : <p className="text-meta text-tinta-meta md:text-cuerpo">Enlace no disponible.</p>}
        {conComentarios
          ? <button type="button" className={clasesBoton(false)} onClick={onComentarios}>
              <IconoComentarios size={16} aria-hidden />
              Comentarios
            </button>
          : null}
        {analisis && conComentarios ? <BotonAnalizar onAbrir={onAnalizar} /> : null}
        <p className="ml-auto text-meta tabular-nums text-tinta-meta">{indice + 1} de {total}</p>
      </div>
      {conComentarios && vistaPrevia
        ? <div className="mt-6 hidden md:block"><VistaPreviaComentarios comentarios={comentarios} /></div>
        : null}
    </div>
  </article>;
}

/* En escritorio la celda se estira (nunca `justify-self-end`: un item que se
   encoge a su contenido deja al medio, que mide en %, con ancho cero) y el
   medio se alinea al borde de la columna de texto con `justify-end`. */
const CLASES_MARCO_MEDIO = "flex flex-1 items-center justify-center px-4 pt-4 md:flex-none md:justify-end md:px-0 md:pt-0";

/** Mantiene la altura ya medida al desmontar el medio. La reserva parte del
 * esqueleto, que es la forma esperada, y solo crece con lo medido: asi el
 * iframe de Instagram, que nace a 24px, no encoge la tarjeta ni la agranda al
 * aterrizar, y salir de un reel alto no desplaza el siguiente post bajo el
 * dedo. Las tarjetas sin medio muestran el esqueleto quieto, sin pulso: es una
 * forma en reposo, no una carga en curso.
 *
 * Preparada o asentada, el MISMO `MedioSocial` en la misma posicion del arbol:
 * asi, al asentarse, React conserva el iframe ya cargado y solo le cambia
 * `activo`. Un ternario que alternara dos elementos distintos lo recargaria y
 * la precarga no serviria de nada. Se mide tambien preparada, para que la
 * reserva de alto ya este puesta cuando la tarjeta llegue. */
function EspacioMedio({ publicacion, activo, preparado }: { publicacion: PublicacionVisual; activo: boolean; preparado: boolean }) {
  const espacio = useRef<HTMLDivElement>(null);
  const [altura, setAltura] = useState(0);
  const montado = activo || preparado;
  useEffect(() => {
    const elemento = espacio.current;
    if (!elemento || !montado) return;
    const observador = new ResizeObserver((entradas) => {
      const medida = Math.ceil(entradas[0]?.contentRect.height ?? 0);
      setAltura((anterior) => Math.max(anterior, medida));
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [montado]);
  return <div className={CLASES_MARCO_MEDIO}>
    <div className="medio-visual mx-auto md:mx-0 md:max-w-[24rem]" style={{ minHeight: altura || undefined }}>
      <div ref={espacio}>
        {montado ? <MedioSocial publicacion={publicacion} activo={activo} /> : <EsqueletoMedio red={publicacion.red} tipo={publicacion.post.tipo} formato={publicacion.post.formato} pulsar={false} />}
      </div>
    </div>
  </div>;
}

/** Mientras no hay filas, una tarjeta con la geometria de una real, para que
 *  la primera publicacion sustituya al esqueleto en su sitio y no empuje la
 *  caja. */
function EsqueletoPublicacion() {
  return <article aria-hidden className="publicacion-visual sin-ajuste mx-auto flex w-full max-w-[88rem] flex-col md:grid md:grid-cols-2 md:items-center md:gap-12 md:px-8">
    <div className={CLASES_MARCO_MEDIO}>
      <div className="medio-visual mx-auto md:mx-0 md:max-w-[24rem]"><EsqueletoMedio red="instagram" tipo="imagen" /></div>
    </div>
    <div className="animate-pulse px-4 pb-6 md:px-0">
      <div className="h-5 w-10/12 rounded-etiqueta bg-vela" />
      <div className="mt-3 h-3 w-1/2 rounded-etiqueta bg-vela" />
    </div>
  </article>;
}
