"use client";

import { ArrowClockwise as Actualizar, ArrowDown as Bajar, ArrowLeft as Volver, ArrowSquareOut as Abrir, Sparkle as IA, Trash as Papelera, X as Cerrar } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useSWRConfig } from "swr";

import { MedioSocial } from "@/components/paneles/medio-social";
import { Bisel } from "@/components/ui/bisel";
import { ChipSentimiento } from "@/components/ui/chip-sentimiento";
import { CifraTono } from "@/components/ui/cifra-tono";
import { clasesBoton, clasesInsignia } from "@/components/ui/clases";
import { EstadoCarga } from "@/components/ui/estado-carga";
import { Hoja } from "@/components/ui/hoja";
import { CON_COLUMNA_LIKES as CON_COLUMNA, LikesComentario as Likes } from "@/components/ui/likes-comentario";
import { Chip, Hueco } from "@/components/ui/primitivas";
import { Segmentado } from "@/components/ui/segmentado";
import { TiraTono } from "@/components/ui/tira-tono";
import { ErrorDatos } from "@/lib/datos/fetcher";
import { serieTono } from "@/lib/dominio/consultas";
import { fechaLarga, hora, numero, pluralizar } from "@/lib/dominio/formato";
import { NOMBRE_RED } from "@/lib/dominio/publicaciones";
import type { Actualizacion, ComentarioSeguido, RespuestaSeguimiento, TemaComentarios, TonoComentario } from "@/lib/seguimiento/contrato";
import { diferencia, metricasDe, momento, nombreLikes, ordenarComentarios, publicacionVisual, type OrdenComentarios } from "@/lib/seguimiento/formato";
import { useActualizar, useBorrar, useFichaSeguimiento, useResumir } from "@/lib/seguimiento/use-seguimiento";

/**
 * /seguimiento/[id]: una publicacion y todo lo que se sabe de ella.
 *
 * El orden es el de la pregunta del cliente (28 de septiembre de 2026): lo que
 * dicen los comentarios, en dos o tres frases y sus temas (el «Customers say»
 * de Amazon que pidio el 29), como suena lo que se comenta, como se movio la publicacion entre una
 * lectura y otra, y los comentarios, que son los que se vienen a leer: los de
 * mas likes primero (30 de septiembre), y despues la historia de lecturas. El
 * embed va al lado en escritorio y al final en el telefono, donde mide mas que
 * una pantalla y empujaria todo lo demas.
 *
 * Lo que la forma sostiene de PRODUCT.md:
 *  - Conteos y nunca porcentajes: la tarjeta de tono es la de la ficha de un
 *    termino (ui/cifra-tono.tsx), un cuadro por comentario.
 *  - «Sin dato» donde la red no dio la cifra, nunca cero: una cuenta que oculta
 *    sus likes, o una lectura que fallo.
 *  - El tono se muestra aunque el titulo nombre a una figura del roster: es la
 *    excepcion a la regla 5 que el cliente decidio para esta pagina el 29 de
 *    septiembre de 2026, y por eso la tarjeta lleva SALVEDAD_TONO, que no se
 *    quita: sin pie de pagina es lo unico que dice que el modelo lee como
 *    suena una frase y no la postura hacia nadie.
 *  - El resumen es de IA y lo dice, con su salvedad fija (SALVEDAD_RESUMEN),
 *    como las fichas de Analizar.
 *
 * A diferencia de la tarjeta de /redes, aqui SI hay cifras de la plataforma.
 * Alla se quitaron el 17 de septiembre de 2026 porque el embed de al lado
 * mostraba las mismas, en vivo, y las nuestras llevaban hasta seis horas; aqui
 * cada cifra va con la hora de su lectura, que es justo lo que se viene a
 * comparar.
 */

const ANCHO = "mx-auto w-full max-w-[88rem] px-4 md:px-8";

/** Los que se ven al abrir, y cuantos mas trae cada «Ver más». */
const TOPE_INICIAL = 8;
const MAS_POR_VEZ = 20;

/** Fijas, en pantalla y no en el prompt: lo que el modelo no puede decir
 *  bien sin nombrar lo que reglas.ts le prohibe (ver AGENTS.md, «The sampling
 *  caveat is the page's»). */
const SALVEDAD_TONO = "Mide cómo suena cada comentario, no la postura hacia una persona.";
const SALVEDAD_RESUMEN = "Son los comentarios que se leyeron de esta publicación, no una muestra de nadie.";

type Filtro = "todos" | TonoComentario;

function Cifras({ a, previa, p }: { a: Actualizacion; previa: Actualizacion | undefined; p: RespuestaSeguimiento["publicacion"] }) {
  if (a.metricas === null) return <p className="text-cuerpo text-tinta-meta">La publicación no dio sus cifras en esta lectura.</p>;
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-cuerpo">
      {metricasDe(p).map(({ clave, nombre }) => {
        const v = a.metricas?.[clave] ?? null;
        const d = diferencia(a.metricas, previa?.metricas ?? null, clave);
        return (
          <li key={clave} className="text-tinta-dato">
            {v === null ? (
              <>{nombre[1]} <Hueco>sin dato</Hueco></>
            ) : (
              <>
                <span className="tabular-nums text-tinta-titulo">{numero(v)}</span> {pluralizar(v, nombre[0], nombre[1])}
                {d === null || d === 0 ? null : <span className="tabular-nums text-tinta-meta"> ({d > 0 ? "+" : "−"}{numero(Math.abs(d))})</span>}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** La ultima lectura en grande, con lo que cambio desde la anterior: es la
 *  pregunta de un seguimiento, «¿se movio?». La hora va junto al rotulo,
 *  porque dice DE CUANDO son las cifras, y la lectura contra la que se mide
 *  el cambio va al pie, que es donde se busca al leer un «+53». */
function Ahora({ datos }: { datos: RespuestaSeguimiento }) {
  const listas = datos.actualizaciones.filter((a) => a.estado === "listo");
  const ultima = listas[0];
  const previa = listas[1];
  const cifras = metricasDe(datos.publicacion).slice(0, 4).map(({ clave, nombre }) => ({
    clave,
    nombre,
    v: ultima?.metricas?.[clave] ?? null,
    d: diferencia(ultima?.metricas ?? null, previa?.metricas ?? null, clave),
  }));
  const cambio = cifras.some((c) => c.d !== null && c.d !== 0);
  return (
    <Bisel as="li" nivel="panel" className="min-w-0" interior="flex h-full flex-col gap-4 p-4 sm:p-6">
      <div>
        <p className="text-cuerpo font-medium text-tinta-prosa">Última actualización</p>
        {ultima === undefined ? null : <p className="text-meta text-tinta-meta">{momento(ultima.fecha)}</p>}
      </div>
      {ultima === undefined ? (
        <p><Hueco tamano="text-rotulo">Sin dato</Hueco></p>
      ) : ultima.metricas === null ? (
        <p className="text-cuerpo text-tinta-meta">La publicación no dio sus cifras.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-6 gap-y-5">
          {cifras.map(({ clave, nombre, v, d }) => (
            <li key={clave} className="min-w-0">
              {v === null ? <p><Hueco tamano="text-cifra">Sin dato</Hueco></p> : (
                <p className="font-titular text-cifra tabular-nums text-tinta-titulo">{numero(v)}</p>
              )}
              <p className="mt-1 text-cuerpo text-tinta-dato">{v === null ? nombre[1] : pluralizar(v, nombre[0], nombre[1])}</p>
              {d === null || d === 0 ? null : (
                <p className="text-meta tabular-nums text-tinta-meta">{d > 0 ? "+" : "−"}{numero(Math.abs(d))}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {previa === undefined || !cambio ? null : (
        <p className="mt-auto text-meta text-tinta-meta">Cambio desde la lectura del {momento(previa.fecha)}</p>
      )}
    </Bisel>
  );
}

function Lectura({ a, previa, p }: { a: Actualizacion; previa: Actualizacion | undefined; p: RespuestaSeguimiento["publicacion"] }) {
  return (
    <li className="grid gap-2 border-b border-vela py-4 first:pt-0 last:border-0 last:pb-0">
      <p className="text-meta text-tinta-meta">{momento(a.fecha)}</p>
      {a.estado === "leyendo" ? (
        <p className="text-cuerpo text-tinta-meta">Leyendo…</p>
      ) : a.estado === "fallo" ? (
        <p className="text-cuerpo text-baja">No se pudo leer la publicación.</p>
      ) : (
        <>
          <Cifras a={a} previa={previa} p={p} />
          <p className="text-cuerpo text-tinta-prosa">
            {a.leidos === null || a.leidos === 0
              ? "Ningún comentario con texto."
              : `${numero(a.leidos)} ${pluralizar(a.leidos, "comentario leído", "comentarios leídos")}${a.nuevos !== null && previa !== undefined ? `, ${numero(a.nuevos)} ${pluralizar(a.nuevos, "nuevo", "nuevos")}` : ""}`}
          </p>
          {a.tono !== null ? <TiraTono tramos={serieTono(a.tono, "m").tramos} tamano="chico" /> : null}
        </>
      )}
    </li>
  );
}

function Comentario({ c, likes, columna }: { c: ComentarioSeguido; likes: [string, string]; columna: boolean }) {
  return (
    <li className={`py-4 first:pt-0 ${columna ? CON_COLUMNA : ""}`}>
      {columna ? <p className="text-cuerpo"><Likes n={c.likes} nombre={likes} /></p> : null}
      <div className="min-w-0">
        <blockquote className="max-w-[65ch] break-words text-lectura text-tinta-dato">{c.texto}</blockquote>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-meta text-tinta-meta">
          {c.escrito === null ? <Hueco>sin fecha</Hueco> : <span>{momento(c.escrito)}</span>}
          <ChipSentimiento s={c.sentimiento} />
          {c.nuevo ? <span className={clasesInsignia("dato")}>nuevo</span> : null}
        </p>
      </div>
    </li>
  );
}

const TONOS: readonly { id: TonoComentario; nombre: string }[] = [
  { id: "positivo", nombre: "Positivos" },
  { id: "negativo", nombre: "Negativos" },
  { id: "neutral", nombre: "Neutrales" },
];

/**
 * Los comentarios. Abren por los de mas likes y con pocos a la vista
 * (cliente, 30 de septiembre de 2026: «muestra muchos desde el inicio»):
 * hasta ese dia eran los cincuenta mas recientes, y en un telefono eso son
 * veinte pantallas antes de llegar a las actualizaciones.
 *
 * Tres filtros que son tres gestos distintos: el TEMA llega desde el resumen
 * («Ver los 11 comentarios») y se quita con su pastilla; el tono es un filtro
 * con su cuenta (ui/primitivas.tsx::Chip, que alinea la etiqueta con su
 * numero por la linea base); el orden es un interruptor de dos
 * (ui/segmentado.tsx). Se combinan.
 *
 * Un control que no cambiaria nada no se ofrece: un tono sin comentarios (la
 * tarjeta de arriba ya dice el cero), el filtro entero cuando todos caen en el
 * mismo (una publicacion en ingles no tiene tono), y el orden por likes cuando
 * ningun comentario trae likes.
 */
function Comentarios({ datos, tema, alQuitarTema }: {
  datos: RespuestaSeguimiento;
  tema: TemaComentarios | null;
  alQuitarTema: () => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [orden, setOrden] = useState<OrdenComentarios>("likes");
  const [tope, setTope] = useState(TOPE_INICIAL);
  // Un tema nuevo vuelve a abrir la lista desde arriba. Es el ajuste de
  // estado al cambiar una prop que recomienda React: sin efecto, en el render.
  const [temaVisto, setTemaVisto] = useState(tema);
  if (temaVisto !== tema) {
    setTemaVisto(tema);
    setTope(TOPE_INICIAL);
  }
  const todos = datos.comentarios;
  const likes = nombreLikes(datos.publicacion.red);
  const tonos = TONOS.map((t) => ({ ...t, n: todos.filter((c) => c.sentimiento === t.id).length })).filter((t) => t.n > 0);
  const filtrable = tonos.some((t) => t.n < todos.length);
  const ordenable = todos.length > 1 && todos.some((c) => c.likes > 0);
  const delTema = tema === null ? todos : todos.filter((c) => tema.huellas.includes(c.huella));
  const lista = ordenarComentarios(filtro === "todos" ? delTema : delTema.filter((c) => c.sentimiento === filtro), ordenable ? orden : "recientes");
  const filtrar = (f: Filtro) => { setFiltro(f); setTope(TOPE_INICIAL); };
  const ordenar = (o: OrdenComentarios) => { setOrden(o); setTope(TOPE_INICIAL); };
  const resto = lista.length - tope;
  return (
    <section id="seguimiento-comentarios" aria-labelledby="seguimiento-comentarios-titulo" className="scroll-mt-24 border-t border-filo pt-8">
      <h2 id="seguimiento-comentarios-titulo" className="text-rotulo text-tinta-titulo">Comentarios</h2>
      <p className="mt-1 text-cuerpo text-tinta-meta">Se borran {datos.retencionDias} días después de la última actualización que los trajo.</p>
      {filtrable || ordenable || tema !== null ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {tema === null ? null : (
              <button type="button" onClick={alQuitarTema} aria-label={`Quitar el tema ${tema.nombre}`} className={clasesBoton(true)}>
                {tema.nombre} <Cerrar size={16} aria-hidden />
              </button>
            )}
            {filtrable ? (
              <div role="group" aria-label="Tono de los comentarios" className="flex flex-wrap gap-2">
                <Chip activo={filtro === "todos"} onClick={() => filtrar("todos")} cuenta={delTema.length}>Todos</Chip>
                {tonos.map((t) => (
                  <Chip key={t.id} activo={filtro === t.id} onClick={() => filtrar(t.id)} cuenta={delTema.filter((c) => c.sentimiento === t.id).length}>{t.nombre}</Chip>
                ))}
              </div>
            ) : null}
          </div>
          {ordenable ? (
            <Segmentado etiqueta="Orden de los comentarios" ancho="justo" opciones={[
              { id: "likes", nombre: `Más ${likes[1]}`, activo: orden === "likes", onElegir: () => ordenar("likes") },
              { id: "recientes", nombre: "Más recientes", activo: orden === "recientes", onElegir: () => ordenar("recientes") },
            ]} />
          ) : null}
        </div>
      ) : null}
      {todos.length === 0 ? (
        <p className="mt-6 text-cuerpo text-tinta-meta">
          {datos.actualizaciones.some((a) => a.estado === "listo") ? "No hay comentarios con texto guardados." : "Todavía no se leen los comentarios."}
        </p>
      ) : lista.length === 0 ? (
        <p className="mt-6 text-cuerpo text-tinta-meta">Ningún comentario con ese tono.</p>
      ) : (
        <>
          <ul className="mt-6 divide-y divide-vela">
            {lista.slice(0, tope).map((c) => <Comentario key={c.huella} c={c} likes={likes} columna={ordenable} />)}
          </ul>
          {resto > 0 ? (
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <button type="button" onClick={() => setTope((t) => t + MAS_POR_VEZ)} className={clasesBoton(false)}>
                Ver {numero(Math.min(MAS_POR_VEZ, resto))} más
              </button>
              <p className="text-meta tabular-nums text-tinta-meta">{numero(tope)} de {numero(lista.length)}</p>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

/** Cuantos comentarios de un tema se asoman en el resumen antes de ir a la
 *  lista: los de mas likes, como las resenas bajo un tema de Amazon. */
const ASOMAN_POR_TEMA = 3;

/**
 * Un tema abierto dentro del resumen: lo que se dice de el y sus comentarios
 * de mas likes, recortados a tres renglones, y el paso a la lista entera. Va
 * separado por un filo y no en otra caja: una tarjeta dentro de la tarjeta.
 */
function TemaAbierto({ tema, datos, alVerTodos }: { tema: TemaComentarios; datos: RespuestaSeguimiento; alVerTodos: () => void }) {
  const likes = nombreLikes(datos.publicacion.red);
  const suyos = ordenarComentarios(datos.comentarios.filter((c) => tema.huellas.includes(c.huella)), "likes");
  const columna = suyos.some((c) => c.likes > 0);
  return (
    <div className="grid gap-4 border-t border-vela pt-4 aparicion-suave">
      <p className="max-w-[60ch] text-lectura text-tinta-dato">{tema.detalle}</p>
      <ul className="grid gap-3">
        {suyos.slice(0, ASOMAN_POR_TEMA).map((c) => (
          <li key={c.huella} className={columna ? CON_COLUMNA : ""}>
            {columna ? <p className="text-cuerpo"><Likes n={c.likes} nombre={likes} /></p> : null}
            <blockquote className="line-clamp-3 max-w-[60ch] break-words text-cuerpo text-tinta-prosa">{c.texto}</blockquote>
          </li>
        ))}
      </ul>
      {suyos.length > ASOMAN_POR_TEMA ? (
        <p>
          <button type="button" onClick={alVerTodos} className={clasesBoton(false)}>
            Ver los {numero(suyos.length)} comentarios <Bajar size={16} aria-hidden />
          </button>
        </p>
      ) : null}
    </div>
  );
}

/**
 * «Lo que dicen los comentarios», con la forma del «Customers say» de Amazon
 * que el cliente mando (29 y 30 de septiembre de 2026): dos o tres frases de
 * conjunto y, debajo, los temas que reaparecen como pastillas con su cuenta.
 * Tocar una la abre aqui mismo; «Ver los N» lleva a la lista filtrada. La
 * cuenta de cada tema es cuantos comentarios cita el modelo y existen: la
 * pone el codigo (lib/analisis/seguimiento.ts), nunca el modelo.
 *
 * Un resumen de antes del 30 de septiembre era un solo parrafo, sin temas: se
 * pinta como estaba y se ofrece rehacerlo. Sin resumen se ofrece el boton;
 * nunca se pide solo.
 */
function ResumenComentarios({ datos, alResumir, alVerTema }: {
  datos: RespuestaSeguimiento;
  alResumir: () => Promise<unknown>;
  alVerTema: (t: TemaComentarios) => void;
}) {
  const resumir = useResumir();
  const [abierto, setAbierto] = useState<string | null>(null);
  const r = datos.resumen;
  if (r === null && !datos.resumible) return null;
  const temas = r?.temas ?? [];
  const tema = temas.find((t) => t.nombre === abierto) ?? null;
  async function pedir() {
    if ((await resumir.correr(datos.publicacion.id)) !== null) await alResumir();
  }
  const boton = (texto: string) => (
    <div className="grid justify-items-start gap-3">
      {resumir.enviando ? <EstadoCarga etiqueta="Resumiendo comentarios" /> : (
        <button type="button" onClick={() => void pedir()} className={clasesBoton(false)}>
          <IA size={16} aria-hidden /> {texto}
        </button>
      )}
      {resumir.fallo === null ? null : <p role="alert" className="text-cuerpo text-baja">{resumir.fallo.mensaje}</p>}
    </div>
  );
  return (
    <section aria-labelledby="seguimiento-resumen">
      <Bisel nivel="panel" interior="grid gap-5 p-4 sm:p-6">
        <h2 id="seguimiento-resumen" className="text-cuerpo font-medium text-tinta-prosa">Lo que dicen los comentarios</h2>
        {r === null ? boton("Resumir comentarios") : (
          <>
            <p className="max-w-[60ch] break-words text-pretty text-lectura font-normal text-tinta-titulo aparicion-suave sm:text-rotulo sm:font-normal">{r.texto}</p>
            {temas.length > 0 ? (
              <div className="grid gap-4">
                <div role="group" aria-label="Temas que reaparecen" className="flex flex-wrap gap-2">
                  {temas.map((t) => (
                    <Chip key={t.nombre} activo={abierto === t.nombre} onClick={() => setAbierto((a) => (a === t.nombre ? null : t.nombre))} cuenta={t.huellas.length}>
                      {t.nombre}
                    </Chip>
                  ))}
                </div>
                {tema === null ? null : <TemaAbierto tema={tema} datos={datos} alVerTodos={() => alVerTema(tema)} />}
              </div>
            ) : null}
            {r.temas === null && datos.resumible ? boton("Rehacer el resumen") : null}
            <div className="grid gap-1 text-meta text-tinta-meta">
              <p className="flex items-start gap-2">
                <IA size={14} aria-hidden className="mt-px shrink-0" />
                <span>Generado con IA a partir del texto de {numero(r.leidos)} {pluralizar(r.leidos, "comentario", "comentarios")} · {momento(r.fecha)}</span>
              </p>
              <p>{SALVEDAD_RESUMEN}</p>
            </div>
          </>
        )}
      </Bisel>
    </section>
  );
}

function Acciones({ datos, alActualizar }: { datos: RespuestaSeguimiento; alActualizar: () => Promise<unknown> }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const actualizar = useActualizar();
  const borrar = useBorrar();
  const hoja = useRef<HTMLDialogElement>(null);
  const id = datos.publicacion.id;

  async function pedirActualizacion() {
    const r = await actualizar.correr(id);
    if (r !== null) await alActualizar();
  }

  async function confirmarBorrado() {
    const r = await borrar.correr(id);
    if (r === null) return;
    hoja.current?.close();
    await mutate("/api/seguimiento");
    router.push("/seguimiento");
  }

  const fallo = actualizar.fallo ?? null;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {!datos.disponible ? null : datos.enCurso ? (
          <EstadoCarga etiqueta="Leyendo comentarios" />
        ) : (
          <button type="button" onClick={() => void pedirActualizacion()} disabled={actualizar.enviando || datos.proxima !== null}
            className={`${clasesBoton(true)} disabled:opacity-60`}>
            <Actualizar size={16} aria-hidden /> {actualizar.enviando ? "Actualizando…" : "Actualizar"}
          </button>
        )}
        <a href={datos.publicacion.url} target="_blank" rel="noopener noreferrer" className={clasesBoton(false)}>
          <Abrir size={16} aria-hidden /> Abrir en {NOMBRE_RED[datos.publicacion.red]}
        </a>
        {/* Al otro extremo: borra para siempre, y no se lee como un paso mas
            junto a Actualizar. */}
        <button type="button" onClick={() => hoja.current?.showModal()} className={`${clasesBoton(false)} sm:ml-auto`}>
          <Papelera size={16} aria-hidden /> Dejar de seguir
        </button>
      </div>
      {/* Con la compuerta apagada el boton no se pinta, y se dice. Hasta el 29
          de septiembre de 2026 solo desaparecia: en un servidor local contra
          la base de produccion, sin SEGUIMIENTO_HABILITADO, se leyo como que
          el boton se habia quitado. Es la misma frase de la lista. */}
      {!datos.disponible ? <p className="text-cuerpo text-tinta-meta">Las actualizaciones no están disponibles por ahora.</p> : null}
      {datos.enCurso ? <p className="text-cuerpo text-tinta-meta">Puede tardar unos minutos.</p> : null}
      {!datos.enCurso && datos.proxima !== null && datos.disponible ? (
        <p className="text-cuerpo text-tinta-meta">Se podrá actualizar de nuevo a las {hora(datos.proxima)}.</p>
      ) : null}
      {fallo === null ? null : <p role="alert" className="text-cuerpo text-baja">{fallo.mensaje}</p>}

      <Hoja ref={hoja} titulo="Dejar de seguir" rotuloCerrar="Cerrar sin borrar">
        <div className="grid gap-5 px-4 pt-5 pb-6">
          <p className="max-w-[55ch] text-lectura text-tinta-prosa">
            Se borran para siempre la historia de esta publicación y sus comentarios guardados. No se puede deshacer.
          </p>
          {borrar.fallo === null ? null : <p role="alert" className="text-cuerpo text-baja">{borrar.fallo.mensaje}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void confirmarBorrado()} disabled={borrar.enviando}
              className={`${clasesBoton(true)} disabled:opacity-60`}>
              <Papelera size={16} aria-hidden /> {borrar.enviando ? "Borrando…" : "Borrar para siempre"}
            </button>
            <button type="button" onClick={() => hoja.current?.close()} className={clasesBoton(false)}>Cancelar</button>
          </div>
        </div>
      </Hoja>
    </div>
  );
}

export function FichaSeguimiento({ id }: { id: string }) {
  const { data, error, mutate } = useFichaSeguimiento(id);
  // El tema que filtra la lista, elegido desde el resumen. Por nombre y no
  // por objeto: cada vuelta de SWR trae objetos nuevos del mismo tema.
  const [tema, setTema] = useState<string | null>(null);

  if (data === undefined) {
    const noExiste = error instanceof ErrorDatos && error.status === 404;
    return (
      <div className={`${ANCHO} grid gap-6 pb-16`}>
        <VolverALista />
        {error === undefined ? <EstadoCarga etiqueta="Cargando" /> : (
          <p className="text-cuerpo text-baja">{noExiste ? "Esa publicación ya no está en seguimiento." : "No se pudo cargar la publicación."}</p>
        )}
      </div>
    );
  }

  const p = data.publicacion;
  const listas = data.actualizaciones;
  const previaDe = (i: number) => listas.slice(i + 1).find((a) => a.estado === "listo");
  const temaActivo = data.resumen?.temas?.find((t) => t.nombre === tema) ?? null;
  function verTema(t: TemaComentarios) {
    setTema(t.nombre);
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("seguimiento-comentarios")?.scrollIntoView({ behavior: quieto ? "auto" : "smooth", block: "start" });
  }
  // El titulo es la primera linea del pie, recortada: en un telefono, al
  // tamano de seccion, ocupaba diez renglones y empujaba todo bajo el
  // pliegue. De `sm` en adelante vuelve a su tamano. La red y la fecha van
  // DEBAJO, como firma: arriba del titulo se leian como un rotulo.
  return (
    <div className={`${ANCHO} grid gap-8 pb-16`}>
      <VolverALista />
      <div className="grid gap-6">
        <header className="grid gap-2">
          <h1 className="max-w-[40ch] break-words text-balance font-titular text-rotulo text-tinta-titulo sm:text-seccion">{p.titulo || "Publicación sin título"}</h1>
          <p className="text-meta text-tinta-meta">
            {NOMBRE_RED[p.red]}{p.creador === null ? "" : ` · ${p.creador}`}
            {p.publicado === null ? "" : ` · publicada el ${fechaLarga(p.publicado)}`}
            {p.idioma === "en" ? " · en inglés" : ""}
          </p>
        </header>
        <Acciones datos={data} alActualizar={() => mutate()} />
      </div>

      {/* El resumen va en la columna y no a todo lo ancho: a todo lo ancho su
          parrafo de 70ch dejaba medio panel vacio y bajaba el embed. */}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-16">
        <div className="grid min-w-0 content-start gap-10">
          <div className="grid gap-3">
            <ResumenComentarios datos={data} alResumir={() => mutate()} alVerTema={verTema} />
            <ul className="grid gap-3 md:grid-cols-2">
              <CifraTono
                rotulo="Tono de los comentarios"
                serie={serieTono(data.tono.conteo, "m")}
                genero="m"
                unidad={["comentario", "comentarios", "Ningún comentario"]}
              >
                {data.tono.conteo.positivo + data.tono.conteo.negativo + data.tono.conteo.neutral + data.tono.conteo.sinTono === 0
                  ? null
                  : <p className="text-meta text-tinta-meta">{SALVEDAD_TONO}</p>}
              </CifraTono>
              <Ahora datos={data} />
            </ul>
          </div>

          {/* Los comentarios antes que la historia de lecturas: son lo que
              se viene a leer, y la historia es para comparar. */}
          <Comentarios datos={data} tema={temaActivo} alQuitarTema={() => setTema(null)} />

          <section aria-labelledby="seguimiento-lecturas" className="border-t border-filo pt-8">
            <h2 id="seguimiento-lecturas" className="text-rotulo text-tinta-titulo">Actualizaciones</h2>
            {listas.length === 0 ? (
              <p className="mt-4 text-cuerpo text-tinta-meta">Todavía no se ha leído esta publicación.</p>
            ) : (
              <ul className="mt-6">
                {listas.map((a, i) => <Lectura key={a.id} a={a} previa={previaDe(i)} p={p} />)}
              </ul>
            )}
          </section>
        </div>

        <aside aria-label="La publicación" className="min-w-0 lg:sticky lg:top-[var(--respiro-superior)] lg:self-start">
          <Bisel nivel="panel" interior="overflow-hidden">
            <MedioSocial publicacion={publicacionVisual(p)} />
          </Bisel>
        </aside>
      </div>
    </div>
  );
}

function VolverALista() {
  return (
    <p>
      <Link href="/seguimiento" className={clasesBoton(false)}>
        <Volver size={16} aria-hidden /> Todas las publicaciones
      </Link>
    </p>
  );
}
