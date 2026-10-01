"use client";

import { ArrowRight as Flecha, ArrowUpRight as Salir, Check as Hecho, Copy as Copiar, DownloadSimple as Descargar, Play as Clip, Sparkle as IA } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import useSWRImmutable from "swr/immutable";

import { clasesBoton, clasesChip } from "@/components/ui/clases";
import { EstadoCarga } from "@/components/ui/estado-carga";
import {
  CONSEJO_IA,
  DESCRIPCION_PROGRAMA,
  NOMBRE_EJE,
  NOMBRE_PROGRAMA,
  ORIGENES_GUION,
  PROGRAMAS_GUION,
  ROTULO_IA,
  VERSION_GUION,
  type ClipGuion,
  type Guion,
  type OrigenGuion,
  type ProgramaGuion,
} from "@/lib/analisis/contrato-guion";
import { documentoWord, seccionesDelGuion, textoPlano, TIPO_DOCX, VACIO_GUION } from "@/lib/analisis/documento-guion";
import { piezaDeGaritas } from "@/lib/analisis/nota-garitas";
import { rutaGuion } from "@/lib/analisis/ruta-guion";
import { useFacebook, useRedes, useTikTok, useYouTube } from "@/lib/datos/hooks";
import { hora } from "@/lib/dominio/formato";
import type { RespuestaGaritas } from "@/lib/garitas/tipos";

/**
 * Guion para locucion: la pagina /guion, con un enlace por programa del
 * canal. El guion lo escribe lib/analisis/guion-mixto.ts: lo mas popular de las
 * redes con los titulares que cuentan lo mismo (28 de septiembre de 2026, a
 * pedido del cliente: antes hacian falta dos guiones por programa, uno de
 * noticias y otro de redes). guion-prensa.ts, guion-redes.ts y guion-tiktok.ts
 * siguen respondiendo, y nada en pantalla los llama.
 *
 * TIENE PAGINA DESDE EL 28 DE SEPTIEMBRE DE 2026 (cliente). Vivio tres dias en
 * dos hojas, una en la barra de la portada y otra en la de Redes, detras de un
 * icono solo. Tres cosas lo sacaron: el guion es una mesa de trabajo del
 * equipo (elegir, leer, ampliar, copiar, descargar) y no una lectura de la
 * pagina de abajo, que no le cambia nada; el programa elegido vivia en memoria
 * y no se podia guardar ni mandar; y el icono no decia que hacia, porque los
 * destellos son tambien los de Analizar en cada tarjeta. Las barras guardan un
 * atajo: los destellos son un enlace a esta pagina con su material elegido.
 * El microfono que llevaban hasta ese dia, junto a la lupa, se leia como
 * buscar por voz.
 *
 * NADA SE PIDE SIN ELEGIR. Sin `?p=` la pagina monta con los enlaces y nada
 * mas; con `?p=` el enlace fue la pulsacion (lib/analisis/ruta-guion.ts). Los
 * programas ya pedidos quedan en la cache de SWR, asi que ir y volver entre
 * ellos no vuelve a pagar. Sin `shouldRetryOnError: false` SWR reintentaria
 * sola una llamada de pago.
 *
 * LA LLAVE es la HORA en que se eligio el programa, porque los titulares son
 * en vivo y la ruta cachea una hora, junto con el corte de los cuatro
 * archivos de redes (`generado`), que cambia con el cron. Volver al mismo
 * programa dentro de la hora lee la copia; a la hora siguiente, o con redes
 * nuevas, otro guion.
 *
 * LAS GARITAS LAS PONE ESTA TARJETA, no la ruta (25 de septiembre de 2026). En
 * Noticias 33 la primera nota son los tiempos de /api/garitas, armados con
 * lib/analisis/nota-garitas.ts al mostrarse el guion: el guion pagado se
 * cachea una hora en prensa y seis en TikTok, y una espera dicha con ese
 * atraso es falsa. /api/garitas es gratis. Si CBP no responde o no trae una
 * cifra al dia, la nota no sale y se dice «No se pudieron leer: Garitas».
 *
 * «AMPLIAR», en cada nota de prensa (el mismo dia): lee esa nota entera y la
 * reescribe para decirse (lib/analisis/ampliar.ts), con un boton por nota y
 * nunca solo. Es la excepcion de Analizar: una nota por pulsacion. La nota
 * ampliada reemplaza a la corta en pantalla, al copiar y al descargar.
 *
 * EL GUION ES PARA DECIRSE, y eso decide la tipografia, la de un guion de
 * television: lo que el conductor dice va en cuerpo de lectura y tinta de
 * titulo (apertura, entrada, salida, pregunta a la mesa, cierre); las
 * acotaciones —el eje, el titular de escaleta, el pase y la marca del clip—
 * van en pequeño y en tinta de meta, porque se leen pero no se dicen igual. El
 * pase va en cursiva: es la frase que da paso, dicha, pero corta. La marca del
 * clip es el enlace a la publicacion que se extrae, con la cuenta como texto:
 * es para el equipo, y el guion ya no dice la cuenta. Un clip con nota de
 * prensa lleva al lado «Abrir en <medio>» y «Ampliar»; uno sin nota lo dice en
 * su rotulo, «sin nota de prensa», para que el equipo sepa que al aire va como
 * lo que circula y no como lo que se informa. Fue un boton
 * que buscaba su tarjeta en el recorrido hasta que el guion salio de las
 * hojas; sin recorrido era un boton que solo abria una URL, sin clic central
 * ni «copiar enlace», y con un nombre accesible («Ir al video de…») que no
 * decia lo que se leia en pantalla. Una nota leida —en prensa, y la de
 * garitas en los dos— termina con «Abrir en <medio>», o «Abrir Garitas», que
 * es nuestra.
 * «Copiar guion» deja el texto entero en el portapapeles, con el enlace de
 * cada pieza, para el equipo que edita; «Descargar en Word» lo guarda como un
 * .docx con los estilos de la pantalla, para que el conductor lo edite con su
 * propio giro (25 de septiembre de 2026, a pedido del cliente; un .txt hasta
 * el 28, cuando lo pidio en Word). Los dos salen de la misma estructura
 * (lib/analisis/documento-guion.ts), y ninguno nombra medios.
 *
 * Un eje sin material se dice en una linea («Sin videos hoy: California»). Es
 * un hueco medido por el codigo, no un clip vacio ni uno de otro eje. Uno que
 * no se pudo leer se dice aparte y como falla («No se pudieron leer: ...»).
 */

type Respuesta = { fase: "listo"; guion: Guion } | { fase: "fallo"; mensaje: string };
type RespuestaAmpliada = { fase: "listo"; entrada: string } | { fase: "fallo"; mensaje: string };
type Cache = ReturnType<typeof useSWRConfig>["cache"];

/** El enlace a la fuente, en la fila de la pieza: texto subrayado con la
 *  flecha de salida y los 44px de alto del blanco de toque (globals.css,
 *  `.guion-enlace`). Fue una pastilla hasta el 28 de septiembre de 2026, y tres
 *  pastillas seguidas entre dos parlamentos se leian como botones sueltos. */
const CLASES_FUENTE = "guion-enlace";

/** La hora UTC en que se eligio, como llave: «2026-09-25T18». */
const horaActual = () => new Date().toISOString().slice(0, 13);

/**
 * Las garitas con la llave y la forma de /garitas (tablero-garitas.tsx): si ya
 * se leyeron en esta visita, SWR las tiene. Una lectura al montar y ninguna al
 * volver el foco: el texto no se mueve bajo quien lo esta leyendo.
 */
async function consultarGaritas(ruta: string): Promise<RespuestaGaritas> {
  const respuesta = await fetch(ruta);
  if (!respuesta.ok) throw new Error("CBP no disponible");
  return respuesta.json();
}
const OPCIONES_GARITAS = { revalidateOnMount: true, revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false } as const;

/**
 * El cuerpo de /guion, en dos estados.
 *
 * SIN PROGRAMA, la parrilla: los cuatro programas como un indice a todo el
 * ancho, el nombre en la letra de los titulos y su linea al lado. Hasta el 28
 * de septiembre de 2026 era una columna de 20rem con cuatro tarjetas chicas y,
 * a su derecha, «Elige un programa.» en un vacio de mil pixeles; el cliente lo
 * vio como espacio en blanco, y lo era: lo unico que se puede hacer en esa
 * pantalla es elegir, asi que elegir ocupa la pantalla.
 *
 * CON PROGRAMA, dos columnas: los programas a la izquierda, fijos al bajar y
 * compactos, y el guion en la columna de lectura, para cambiar de programa sin
 * subir. El contenedor mide 64rem y no los 88 del resto del tablero: el guion
 * es una columna de lectura y a 88 le sobraban 400px vacios a la derecha. En
 * el telefono, uno sobre otro, y cada programa es una pastilla: la descripcion
 * del elegido va encima del guion.
 *
 * Cada programa es un ENLACE: sirve con clic central y sin JavaScript, y la
 * URL es lo que se guarda. Hubo un segmentado Noticias · Redes del 28 de
 * septiembre de 2026 a la noche del mismo dia, cuando el guion se hizo uno.
 */
export function PaginaGuion({ programa }: { programa: ProgramaGuion | null }) {
  if (programa === null) return <Parrilla />;
  return (
    <div className="mx-auto grid w-full max-w-[64rem] gap-8 px-4 pb-16 md:px-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
      <div className="lg:sticky lg:top-[var(--respiro-superior)] lg:self-start">
        <nav aria-label="Programa">
          <ul className="flex flex-wrap gap-2 lg:grid lg:gap-1">
            {PROGRAMAS_GUION.map((p) => {
              const activo = p === programa;
              return (
                <li key={p}>
                  <Link href={rutaGuion(p)} aria-current={activo ? "page" : undefined}
                    className={`${clasesChip(activo)} lg:grid lg:w-full lg:gap-0.5 lg:rounded-nucleo lg:text-left ${activo ? "" : "lg:bg-transparent lg:hover:bg-vela"}`}>
                    <span>{NOMBRE_PROGRAMA[p]}</span>
                    <span className="hidden text-meta text-tinta-meta lg:block">{DESCRIPCION_PROGRAMA[p]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <section aria-label={`Guion de ${NOMBRE_PROGRAMA[programa]}`}
        className="grid min-w-0 content-start gap-4 text-lectura text-tinta-prosa">
        <p className="text-meta text-tinta-meta lg:hidden">{DESCRIPCION_PROGRAMA[programa]}</p>
        <GuionMixto key={programa} programa={programa} />
      </section>
    </div>
  );
}

/**
 * La parrilla: un renglon por programa, con filos entre ellos como un indice
 * impreso. La flecha se corre al pasar el puntero, solo con puntero fino
 * (globals.css, `.renglon-parrilla`): en un telefono el toque no tiene
 * «pasar». Nada se pide al llegar aqui; pedir es pulsar un renglon.
 */
function Parrilla() {
  return (
    <nav aria-label="Programa" className="mx-auto w-full max-w-[64rem] px-4 pb-16 md:px-8">
      <ul className="border-b border-filo">
        {PROGRAMAS_GUION.map((p) => (
          <li key={p} className="border-t border-filo">
            <Link href={rutaGuion(p)} className="renglon-parrilla">
              <span className="font-titular text-cifra [font-stretch:112%] text-tinta-titulo md:text-seccion">{NOMBRE_PROGRAMA[p]}</span>
              <span className="text-cuerpo text-pretty text-tinta-prosa md:max-w-[30ch] md:text-right">{DESCRIPCION_PROGRAMA[p]}</span>
              <Flecha size={20} aria-hidden className="flecha-parrilla" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * La llave del guion mixto: la hora en que se eligio el programa y el corte de
 * los cuatro archivos de redes. El guion no se pide hasta que los cuatro
 * respondieron o fallaron: con uno a medias la llave cambiaria al llegar el
 * resto, y cada llave nueva es otra llamada pagada. Por lo mismo se fija la
 * primera vez: un archivo que fallo y SWR reintenta no debe volver a pedir el
 * guion. Llegando desde Redes, SWR ya tiene los cuatro y no se descarga nada.
 */
function GuionMixto({ programa }: { programa: ProgramaGuion }) {
  const docs = [useTikTok(), useRedes(), useFacebook(), useYouTube()];
  const listos = docs.every((d) => d.data !== undefined || d.error !== undefined);
  const [corte, setCorte] = useState<string | null>(null);
  if (listos && corte === null) setCorte(`${horaActual()}~${docs.map((d) => d.data?.generado ?? "").join(",")}`);
  if (corte === null) return <EstadoCarga etiqueta="Leyendo las publicaciones" />;
  return <GuionPrograma origen="mixto" programa={programa} corte={corte} />;
}

function GuionPrograma({ origen, programa, corte }: {
  origen: OrigenGuion;
  programa: ProgramaGuion;
  /** Lo que separa copias en el CDN y en SWR (ver GuionMixto). */
  corte: string;
}) {
  const params = new URLSearchParams({ v: VERSION_GUION, p: programa, g: corte });
  const { data, error, mutate, isValidating } = useSWRImmutable<Respuesta>(
    `/api/guion-${origen}?${params}`, pedirGuion, { shouldRetryOnError: false });
  const conGaritas = programa === "noticias33";
  const garitas = useSWR<RespuestaGaritas>(conGaritas ? "/api/garitas" : null, consultarGaritas, OPCIONES_GARITAS);
  const { cache } = useSWRConfig();
  const cargando = (data === undefined && error === undefined) || isValidating;
  const falla = error !== undefined ? "No se pudo preparar el guion." : data?.fase === "fallo" ? data.mensaje : null;
  const guion = !cargando && data?.fase === "listo" ? data.guion : null;

  if (cargando) return <EstadoCarga etiqueta="La IA está escribiendo el guion" />;
  if (falla !== null || guion === null) {
    return (
      <div className="aparicion-suave grid justify-items-start gap-3">
        <p role="status" className="text-baja">{falla ?? "No se pudo preparar el guion."}</p>
        <button type="button" className={clasesBoton(false)} onClick={() => void mutate()}>Reintentar</button>
      </div>
    );
  }

  // La hora de referencia es la de la lectura de CBP, no la del reloj: una
  // cifra «al dia» lo es respecto de cuando se leyo.
  const leyendoGaritas = conGaritas && garitas.data === undefined && garitas.error === undefined;
  const notaGaritas = garitas.data === undefined ? null : piezaDeGaritas(garitas.data.cruces, Date.parse(garitas.data.consultado));
  const garitasSinLeer = conGaritas && !leyendoGaritas && notaGaritas === null;
  const primera = conGaritas && !garitasSinLeer ? 2 : 1;
  const sinLeer = garitasSinLeer ? [NOMBRE_EJE.garitas, ...guion.sinLeer] : guion.sinLeer;
  /** El guion como se copia y se descarga: con la nota de garitas delante y
   *  las notas ampliadas en su lugar, tal como se ven al pulsar. */
  const compuesto = (): Guion => ({
    ...guion,
    clips: [
      ...(notaGaritas === null ? [] : [notaGaritas]),
      ...guion.clips.map((c) => {
        const ampliada = ampliadaEnCache(cache, programa, c);
        return ampliada === null ? c : { ...c, entrada: ampliada };
      }),
    ],
    sinLeer,
  });

  return (
    <div className="aparicion-suave guion">
      {/* Antes que nada de lo que se dice: quien lo lee al aire tiene que
          saber que lo escribio un modelo (contrato-guion.ts::ROTULO_IA). */}
      <div role="note" className="grid gap-1 rounded-nucleo border border-filo bg-vela px-4 py-3">
        <p className="flex items-center gap-2 text-cuerpo text-tinta-titulo">
          <IA size={16} aria-hidden />
          {ROTULO_IA}
        </p>
        <p className="text-meta text-tinta-prosa">{CONSEJO_IA}</p>
      </div>
      {/* Arriba y no al pie (30 de septiembre de 2026): un guion de Deportes
          salio con tres notas y ningun clip porque las cuatro redes estaban
          vencidas, y la linea que lo decia quedaba debajo del cierre, donde
          nadie la vio. Lo que falto del material se lee antes del guion. */}
      {sinLeer.length === 0 ? null : (
        <p role="status" className="text-meta text-baja">No se pudieron leer: {sinLeer.join(", ")}.</p>
      )}
      <Parlamento rotulo="Apertura" texto={guion.apertura} />
      <ol className="guion-escaleta">
        {leyendoGaritas ? <li><EstadoCarga etiqueta="Leyendo las garitas" /></li> : null}
        {notaGaritas === null ? null : <Pieza n={1} origen={guion.origen} programa={programa} clip={notaGaritas} />}
        {guion.clips.map((clip, i) => <Pieza key={i} n={primera + i} origen={guion.origen} programa={programa} clip={clip} />)}
      </ol>
      <Parlamento rotulo="Cierre" texto={guion.cierre} />
      {/* El pie: lo que el equipo tiene que saber del material, en una sola
          columna de notas, y las dos salidas del guion. Descargar es la
          principal: el Word es lo que se edita antes del aire. */}
      <footer className="guion-pie">
        <div className="grid gap-1 text-meta text-tinta-meta">
          {guion.faltantes.length === 0 ? null : (
            <p>{VACIO_GUION[guion.origen]}: {guion.faltantes.join(", ")}.</p>
          )}
          {guion.hasta == null ? null : (
            <p>{hastaCuando(guion.hasta)}</p>
          )}
          <p>{ROTULO_IA}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BotonCopiar texto={() => textoPlano(seccionesDelGuion(compuesto(), enlaceEntero))} />
          <button type="button" className={clasesBoton(true)} onClick={() => descargar(compuesto())}>
            <Descargar size={16} aria-hidden />
            Descargar en Word
          </button>
        </div>
      </footer>
    </div>
  );
}

/** Lo que el conductor dice, con su rotulo de acotacion encima: el mismo
 *  rotulo para Apertura, Cierre y A la mesa (globals.css, `.guion-rotulo`). */
function Parlamento({ rotulo, texto }: { rotulo: string; texto: string }) {
  return (
    <div className="guion-parlamento">
      <p className="guion-rotulo">{rotulo}</p>
      <p className="guion-dicho">{texto}</p>
    </div>
  );
}

function Pieza({ n, origen, programa, clip }: { n: number; origen: OrigenGuion; programa: ProgramaGuion; clip: ClipGuion }) {
  const ampliada = useAmpliada(programa, clip);
  const entrada = ampliada.entrada ?? clip.entrada;
  const pregunta = clip.pregunta === null ? null : <Parlamento rotulo="A la mesa" texto={clip.pregunta} />;
  // Una pieza sin pase es una nota leida: en prensa, la de garitas y, en el
  // mixto, un titular solo. Las demas son clips.
  const leida = clip.pase === null;
  const sinNota = origen === "mixto" && !leida && clip.nota === null;
  // «Detallar» (30 de septiembre de 2026, cliente), antes «Desarrollar con
  // IA» (28 de septiembre) y antes «Ampliar», que se leia como agrandar la
  // letra. Lo que hace es que la IA lea la nota completa y reescriba ESTA
  // entrada con mas detalle; el `title` lo dice entero. Los destellos dicen
  // que es IA a la vista, y el nombre accesible lo dice en palabras
  // («Detallar con IA»), porque el icono va oculto.
  const ampliar = clip.ampliable === null || ampliada.estado === "listo" || ampliada.estado === "cargando" ? null : (
    <button type="button" className="guion-accion-ia" onClick={ampliada.pedir} aria-label="Detallar con IA"
      title="La IA lee la nota completa y agrega detalles a esta entrada">
      <IA size={16} aria-hidden />
      Detallar
    </button>
  );
  return (
    <li className="guion-pieza">
      {/* El numero de la escaleta, en su columna: el mismo que el Word y el
          texto copiado. La lista ya lo anuncia a un lector de pantalla. */}
      <span className="guion-numero" aria-hidden>{String(n).padStart(2, "0")}</span>
      <div className="guion-cuerpo">
        <div className="grid gap-1">
          {/* Solo el tipo va en versalitas: el eje entero en mayusculas pesaba
              mas que el titular que viene debajo. */}
          <p className="guion-meta">
            <span className="guion-tipo">{leida ? "Nota" : "Clip"}</span> · {clip.eje}{clip.libre ? " · libre" : ""}{sinNota ? " · sin nota de prensa" : ""}{ampliada.entrada === null ? "" : " · detallada con IA"}
          </p>
          <h3 className="guion-titular">{clip.titular}</h3>
        </div>
        <p className="guion-dicho">{entrada}</p>
        {ampliada.estado === "cargando" ? <EstadoCarga etiqueta="La IA está leyendo la nota completa" /> : null}
        {ampliada.estado === "fallo" ? <p role="status" className="text-meta text-baja">{ampliada.mensaje}</p> : null}
        {leida ? <>
          <p className="guion-dicho">{clip.salida}</p>
          {pregunta}
          {/* `nofollow`: el enlace lo devolvio un buscador, como en la tarjeta
              del titular en vivo. La nota de garitas enlaza a /garitas, que es
              nuestra: ni `nofollow` ni «en». */}
          <div className="guion-acciones">
            {propia(clip) ? (
              <a href={clip.fuente.url} target="_blank" rel="noopener" className={CLASES_FUENTE}>
                Abrir {clip.fuente.fuente}
                <Salir size={14} aria-hidden />
              </a>
            ) : (
              <a href={clip.fuente.url} target="_blank" rel="noopener noreferrer nofollow" className={CLASES_FUENTE}>
                Abrir en {clip.fuente.fuente}
                <Salir size={14} aria-hidden />
              </a>
            )}
            {ampliar}
          </div>
        </> : <>
          {/* El pase y la entrada del clip van juntos: el pase se dice y el
              clip entra. Sin cursivas: el pase es texto dicho como los demas,
              y lo que lo distingue es que lo sigue la franja del clip. */}
          <div className="grid gap-3">
            {clip.pase === null ? null : <p className="guion-dicho guion-pase">{clip.pase}</p>}
            {/* Un enlace y no un boton: abre la publicacion, y el texto que se
                lee es su nombre accesible. Sin `nofollow`: el enlace es de lo
                cosechado, no lo devolvio un buscador. La nota que lo respalda,
                en el mixto, si con `nofollow`: esa si la devolvio. */}
            <div className="guion-cue">
              <a href={clip.fuente.url} target="_blank" rel="noopener noreferrer" className={CLASES_FUENTE}>
                <Clip size={12} weight="fill" aria-hidden className="guion-cue-marca" />
                Clip: {clip.fuente.fuente}
                <Salir size={14} aria-hidden />
              </a>
              {clip.nota === null ? null : (
                <a href={clip.nota.url} target="_blank" rel="noopener noreferrer nofollow" className={CLASES_FUENTE}>
                  Abrir en {clip.nota.fuente}
                  <Salir size={14} aria-hidden />
                </a>
              )}
              {ampliar}
            </div>
          </div>
          <p className="guion-dicho">{clip.salida}</p>
          {pregunta}
        </>}
      </div>
    </li>
  );
}

/** Una pieza que no salio de la lista del modelo sino del codigo: su enlace es
 *  una ruta nuestra, relativa. */
const propia = (clip: ClipGuion) => clip.fuente.url.startsWith("/");

/** El enlace entero: en un .txt o en el portapapeles, «/garitas» no lleva a
 *  ninguna parte. */
const enlaceEntero = (url: string) => new URL(url, window.location.origin).href;

/**
 * Las notas que ya se pidieron ampliar en esta visita. SWR guarda la
 * respuesta; esto guarda que se pulso, para que al volver a un programa la
 * nota se pinte ampliada sin pulsar otra vez ni pagar.
 */
const PEDIDAS = new Set<string>();

function llaveAmpliar(programa: ProgramaGuion, clip: ClipGuion): string | null {
  const a = clip.ampliable;
  if (a === null) return null;
  // El medio que no se debe nombrar es el de la nota: en un clip del mixto,
  // `fuente` es la cuenta y el medio viene en `nota`.
  return `/api/ampliar-nota?${new URLSearchParams({ v: VERSION_GUION, p: programa, u: a.url, d: a.dominio, m: clip.nota?.fuente ?? clip.fuente.fuente, t: a.titulo })}`;
}

/** Nada se pide sin pulsar, y SWR no reintenta sola una llamada de pago. */
function useAmpliada(programa: ProgramaGuion, clip: ClipGuion) {
  const llave = llaveAmpliar(programa, clip);
  const [pedida, setPedida] = useState(() => llave !== null && PEDIDAS.has(llave));
  const { data, error, isValidating, mutate } = useSWRImmutable<RespuestaAmpliada>(
    pedida ? llave : null, pedirAmpliada, { shouldRetryOnError: false });
  const estado = !pedida ? "quieto"
    : (data === undefined && error === undefined) || isValidating ? "cargando"
      : data?.fase === "listo" ? "listo" : "fallo";
  return {
    estado,
    entrada: estado === "listo" && data?.fase === "listo" ? data.entrada : null,
    mensaje: data?.fase === "fallo" ? data.mensaje : "No se pudo detallar la nota.",
    pedir: () => {
      if (llave === null) return;
      PEDIDAS.add(llave);
      if (pedida) void mutate();
      else setPedida(true);
    },
  };
}

function ampliadaEnCache(cache: Cache, programa: ProgramaGuion, clip: ClipGuion): string | null {
  const llave = llaveAmpliar(programa, clip);
  if (llave === null || !PEDIDAS.has(llave)) return null;
  const guardada = cache.get(llave)?.data as RespuestaAmpliada | undefined;
  return guardada?.fase === "listo" ? guardada.entrada : null;
}

async function pedirAmpliada(url: string): Promise<RespuestaAmpliada> {
  const r = await fetch(url);
  const cuerpo = (await r.json()) as unknown;
  if (cuerpo !== null && typeof cuerpo === "object" && "entrada" in cuerpo && typeof cuerpo.entrada === "string" && cuerpo.entrada !== "") {
    return { fase: "listo", entrada: cuerpo.entrada };
  }
  return { fase: "fallo", mensaje: mensajeDeError(cuerpo, "No se pudo detallar la nota.") };
}

function BotonCopiar({ texto }: { texto: () => string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button type="button" className={clasesBoton(false)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto());
          setCopiado(true);
          window.setTimeout(() => setCopiado(false), 2000);
        } catch {
          setCopiado(false);
        }
      }}>
      {copiado ? <Hecho size={16} aria-hidden /> : <Copiar size={16} aria-hidden />}
      <span aria-live="polite">{copiado ? "Copiado" : "Copiar guion"}</span>
    </button>
  );
}

/** La fecha de Tijuana, que es la del programa: «2026-09-25». */
const FECHA_ARCHIVO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tijuana", year: "numeric", month: "2-digit", day: "2-digit" });

/**
 * Hasta cuando llegan las publicaciones del guion: «Publicaciones de redes
 * hasta las 6:56 am». Sin esto el conductor no sabia que lo «de hoy» podia
 * ser de anoche (28 de septiembre de 2026, guion-redes.ts). Una cosecha de
 * otro dia lo dice, porque la hora sola se leeria como de hoy.
 */
function hastaCuando(iso: string): string {
  const ayer = FECHA_ARCHIVO.format(new Date(iso)) !== FECHA_ARCHIVO.format(new Date());
  const h = hora(iso);
  return `Publicaciones de redes hasta ${h.startsWith("1:") ? "la" : "las"} ${h}${ayer ? " de ayer" : ""}.`;
}
/** La misma fecha, escrita, para el documento: «28 de septiembre de 2026». */
const FECHA_DOCUMENTO = new Intl.DateTimeFormat("es-MX", { timeZone: "America/Tijuana", day: "numeric", month: "long", year: "numeric" });

/**
 * El guion en Word: «guion-noticias-33-2026-09-25.docx», armado en el
 * navegador (lib/analisis/documento-guion.ts) con lo que se ve, la nota de
 * garitas y las ampliadas incluidas. Fue un .txt con BOM hasta el 28 de
 * septiembre de 2026; el cliente lo pidio en Word para editarlo mas facil.
 */
function descargar(guion: Guion) {
  const nombre = NOMBRE_PROGRAMA[guion.programa].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const hoy = new Date();
  const archivo = new Blob([documentoWord(seccionesDelGuion(guion, enlaceEntero), FECHA_DOCUMENTO.format(hoy))], { type: TIPO_DOCX });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = `guion-${nombre}-${FECHA_ARCHIVO.format(hoy)}.docx`;
  enlace.click();
  // Despues del clic y no en el mismo turno: revocar antes de que la descarga
  // arranque puede cancelarla.
  window.setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}

async function pedirGuion(url: string): Promise<Respuesta> {
  const r = await fetch(url);
  const cuerpo = (await r.json()) as unknown;
  const guion = leerGuion(cuerpo);
  return guion !== null ? { fase: "listo", guion } : { fase: "fallo", mensaje: mensajeDeError(cuerpo) };
}

function mensajeDeError(valor: unknown, porOmision = "No se pudo preparar el guion."): string {
  if (valor !== null && typeof valor === "object" && "mensaje" in valor && typeof valor.mensaje === "string") {
    return valor.mensaje;
  }
  return porOmision;
}

const cadenas = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const cadenaONulo = (v: unknown): v is string | null => v === null || typeof v === "string";

/** `ampliable`, o undefined si no tiene la forma: null es valido. */
function leerAmpliable(v: unknown): ClipGuion["ampliable"] | undefined {
  if (v === null) return null;
  if (v === undefined || typeof v !== "object") return undefined;
  const a = v as Record<string, unknown>;
  return typeof a.url === "string" && typeof a.dominio === "string" && typeof a.titulo === "string"
    ? { url: a.url, dominio: a.dominio, titulo: a.titulo }
    : undefined;
}

/** Estricto a proposito: una respuesta con otra forma se pinta como fallo,
 *  nunca a medias. */
/** La nota que respalda un clip del mixto: null si no hay, undefined si viene
 *  mal formada. Una copia de antes del campo no lo trae, y es null. */
function leerNotaDeClip(valor: unknown): ClipGuion["nota"] | undefined {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== "object") return undefined;
  const n = valor as Record<string, unknown>;
  return typeof n.url === "string" && typeof n.fuente === "string" ? { url: n.url, fuente: n.fuente } : undefined;
}

function leerGuion(valor: unknown): Guion | null {
  if (valor === null || typeof valor !== "object") return null;
  const a = valor as Record<string, unknown>;
  const origen = ORIGENES_GUION.find((o) => o === a.origen);
  const programa = PROGRAMAS_GUION.find((p) => p === a.programa);
  if (origen === undefined || programa === undefined || !Array.isArray(a.clips) || !cadenas(a.faltantes) || !cadenas(a.sinLeer)
    || typeof a.leidos !== "number" || typeof a.apertura !== "string" || typeof a.cierre !== "string") return null;
  const clips: ClipGuion[] = [];
  for (const c of a.clips as unknown[]) {
    if (c === null || typeof c !== "object") return null;
    const r = c as Record<string, unknown>;
    const f = r.fuente as Record<string, unknown> | null | undefined;
    const ampliable = leerAmpliable(r.ampliable);
    const nota = leerNotaDeClip(r.nota);
    if (typeof r.eje !== "string" || typeof r.libre !== "boolean" || typeof r.titular !== "string"
      || typeof r.entrada !== "string" || !cadenaONulo(r.pase) || typeof r.salida !== "string" || !cadenaONulo(r.pregunta)
      || f === null || typeof f !== "object" || typeof f.url !== "string" || typeof f.fuente !== "string" || ampliable === undefined
      || nota === undefined) return null;
    clips.push({
      eje: r.eje, libre: r.libre, titular: r.titular, entrada: r.entrada, pase: r.pase, salida: r.salida, pregunta: r.pregunta,
      fuente: { url: f.url, fuente: f.fuente }, ampliable, nota,
    });
  }
  if (clips.length === 0) return null;
  const hasta = typeof a.hasta === "string" && Number.isFinite(Date.parse(a.hasta)) ? a.hasta : null;
  return { origen, programa, apertura: a.apertura, clips, cierre: a.cierre, faltantes: a.faltantes, sinLeer: a.sinLeer, leidos: a.leidos, hasta };
}
