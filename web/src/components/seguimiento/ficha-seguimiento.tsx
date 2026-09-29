"use client";

import { ArrowClockwise as Actualizar, ArrowLeft as Volver, ArrowSquareOut as Abrir, Trash as Papelera } from "@phosphor-icons/react";
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
import { Hueco } from "@/components/ui/primitivas";
import { Segmentado } from "@/components/ui/segmentado";
import { TiraTono } from "@/components/ui/tira-tono";
import { ErrorDatos } from "@/lib/datos/fetcher";
import { serieTono } from "@/lib/dominio/consultas";
import { fechaLarga, hora, numero, pluralizar } from "@/lib/dominio/formato";
import { NOMBRE_RED } from "@/lib/dominio/publicaciones";
import type { Actualizacion, ComentarioSeguido, RespuestaSeguimiento, TonoComentario } from "@/lib/seguimiento/contrato";
import { diferencia, metricasDe, momento, publicacionVisual } from "@/lib/seguimiento/formato";
import { useActualizar, useBorrar, useFichaSeguimiento } from "@/lib/seguimiento/use-seguimiento";

/**
 * /seguimiento/[id]: una publicacion y todo lo que se sabe de ella.
 *
 * El orden es el de la pregunta del cliente (28 de septiembre de 2026): como
 * suena lo que se comenta, como se movio la publicacion entre una lectura y
 * otra, y los comentarios mas recientes, que son los que se vienen a leer. El
 * embed va al lado en escritorio y al final en el telefono, donde mide mas que
 * una pantalla y empujaria todo lo demas.
 *
 * Lo que la forma sostiene de PRODUCT.md:
 *  - Conteos y nunca porcentajes: la tarjeta de tono es la de la ficha de un
 *    termino (ui/cifra-tono.tsx), un cuadro por comentario.
 *  - «Sin dato» donde la red no dio la cifra, nunca cero: una cuenta que oculta
 *    sus likes, o una lectura que fallo.
 *  - Sin tono junto a una figura del roster (regla 5): la API no manda ninguna
 *    etiqueta y la tarjeta dice «Sin dato».
 *
 * A diferencia de la tarjeta de /redes, aqui SI hay cifras de la plataforma.
 * Alla se quitaron el 17 de septiembre de 2026 porque el embed de al lado
 * mostraba las mismas, en vivo, y las nuestras llevaban hasta seis horas; aqui
 * cada cifra va con la hora de su lectura, que es justo lo que se viene a
 * comparar.
 */

const ANCHO = "mx-auto w-full max-w-[88rem] px-4 md:px-8";

const TOPE_INICIAL = 50;

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
 *  pregunta de un seguimiento, «¿se movio?». */
function Ahora({ datos }: { datos: RespuestaSeguimiento }) {
  const listas = datos.actualizaciones.filter((a) => a.estado === "listo");
  const ultima = listas[0];
  const previa = listas[1];
  return (
    <Bisel as="li" nivel="panel" className="min-w-0" interior="flex h-full flex-col gap-3 p-4 sm:gap-4 sm:p-6">
      <p className="text-cuerpo font-medium text-tinta-prosa">Última actualización</p>
      {ultima === undefined ? (
        <p className="text-rotulo italic text-aviso/85">Sin dato</p>
      ) : ultima.metricas === null ? (
        <p className="text-cuerpo text-tinta-meta">La publicación no dio sus cifras.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-6 gap-y-4">
          {metricasDe(datos.publicacion).slice(0, 4).map(({ clave, nombre }) => {
            const v = ultima.metricas?.[clave] ?? null;
            const d = diferencia(ultima.metricas, previa?.metricas ?? null, clave);
            return (
              <li key={clave} className="min-w-0">
                {v === null ? <p className="text-cifra italic text-aviso/85">Sin dato</p> : (
                  <p className="font-titular text-cifra tabular-nums text-tinta-titulo">{numero(v)}</p>
                )}
                <p className="text-cuerpo text-tinta-dato">
                  {v === null ? nombre[1] : pluralizar(v, nombre[0], nombre[1])}
                  {d === null || d === 0 ? null : <span className="tabular-nums text-tinta-meta"> {d > 0 ? "+" : "−"}{numero(Math.abs(d))}</span>}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      {ultima === undefined ? null : <p className="mt-auto text-cuerpo text-tinta-meta">{momento(ultima.fecha)}{previa === undefined ? "" : ` · cambio desde ${momento(previa.fecha)}`}</p>}
    </Bisel>
  );
}

function Lectura({ a, previa, p, tonoMostrado }: { a: Actualizacion; previa: Actualizacion | undefined; p: RespuestaSeguimiento["publicacion"]; tonoMostrado: boolean }) {
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
          {tonoMostrado && a.tono !== null ? <TiraTono tramos={serieTono(a.tono, "m").tramos} tamano="chico" /> : null}
        </>
      )}
    </li>
  );
}

function Comentario({ c }: { c: ComentarioSeguido }) {
  return (
    <li className="py-4 first:pt-0">
      <blockquote className="max-w-[65ch] break-words text-lectura text-tinta-dato">{c.texto}</blockquote>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-meta text-tinta-meta">
        {c.escrito === null ? <Hueco>sin fecha</Hueco> : <span>{momento(c.escrito)}</span>}
        <ChipSentimiento s={c.sentimiento} />
        {c.nuevo ? <span className={clasesInsignia("dato")}>nuevo</span> : null}
      </p>
    </li>
  );
}

function Comentarios({ datos }: { datos: RespuestaSeguimiento }) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [tope, setTope] = useState(TOPE_INICIAL);
  const lista = filtro === "todos" ? datos.comentarios : datos.comentarios.filter((c) => c.sentimiento === filtro);
  const cuantos = (f: Filtro) => (f === "todos" ? datos.comentarios.length : datos.comentarios.filter((c) => c.sentimiento === f).length);
  const opcion = (id: Filtro, nombre: string) => ({ id, nombre: `${nombre} ${numero(cuantos(id))}`, activo: filtro === id, onElegir: () => { setFiltro(id); setTope(TOPE_INICIAL); } });
  return (
    <section aria-labelledby="seguimiento-comentarios" className="border-t border-filo pt-8">
      <h2 id="seguimiento-comentarios" className="text-rotulo text-tinta-titulo">Comentarios más recientes</h2>
      <p className="mt-1 text-cuerpo text-tinta-meta">Se borran {datos.retencionDias} días después de la última actualización que los trajo.</p>
      {datos.tono.mostrado && datos.comentarios.length > 0 ? (
        <div className="mt-4">
          <Segmentado etiqueta="Tono de los comentarios" ancho="justo"
            opciones={[opcion("todos", "Todos"), opcion("positivo", "Positivos"), opcion("negativo", "Negativos"), opcion("neutral", "Neutrales")]} />
        </div>
      ) : null}
      {datos.comentarios.length === 0 ? (
        <p className="mt-6 text-cuerpo text-tinta-meta">
          {datos.actualizaciones.some((a) => a.estado === "listo") ? "No hay comentarios con texto guardados." : "Todavía no se leen los comentarios."}
        </p>
      ) : lista.length === 0 ? (
        <p className="mt-6 text-cuerpo text-tinta-meta">Ningún comentario con ese tono.</p>
      ) : (
        <>
          <ul className="mt-6 divide-y divide-vela">
            {lista.slice(0, tope).map((c) => <Comentario key={c.huella} c={c} />)}
          </ul>
          {lista.length > tope ? (
            <p className="mt-4">
              <button type="button" onClick={() => setTope((t) => t + 100)} className={clasesBoton(false)}>
                Ver {numero(Math.min(100, lista.length - tope))} más
              </button>
            </p>
          ) : null}
        </>
      )}
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
        <button type="button" onClick={() => hoja.current?.showModal()} className={clasesBoton(false)}>
          <Papelera size={16} aria-hidden /> Dejar de seguir
        </button>
      </div>
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
              <Papelera size={16} aria-hidden /> {borrar.enviando ? "Borrando…" : "Borrar"}
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
  return (
    <div className={`${ANCHO} grid gap-8 pb-16`}>
      <VolverALista />
      <header className="grid gap-3">
        <p className="text-meta text-tinta-meta">
          {NOMBRE_RED[p.red]}{p.creador === null ? "" : ` · ${p.creador}`}
          {p.publicado === null ? "" : ` · publicada el ${fechaLarga(p.publicado)}`}
          {p.idioma === "en" ? " · en inglés" : ""}
        </p>
        <h1 className="max-w-[40ch] break-words font-titular text-seccion text-tinta-titulo">{p.titulo || "Publicación sin título"}</h1>
      </header>
      <Acciones datos={data} alActualizar={() => mutate()} />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-16">
        <div className="grid min-w-0 content-start gap-10">
          <ul className="grid gap-3 md:grid-cols-2">
            <CifraTono
              rotulo="Tono de los comentarios"
              serie={data.tono.mostrado ? serieTono(data.tono.conteo, "m") : null}
              genero="m"
              unidad={["comentario", "comentarios", "Ningún comentario"]}
            />
            <Ahora datos={data} />
          </ul>

          <section aria-labelledby="seguimiento-lecturas" className="border-t border-filo pt-8">
            <h2 id="seguimiento-lecturas" className="text-rotulo text-tinta-titulo">Actualizaciones</h2>
            {listas.length === 0 ? (
              <p className="mt-4 text-cuerpo text-tinta-meta">Todavía no se ha leído esta publicación.</p>
            ) : (
              <ul className="mt-6">
                {listas.map((a, i) => <Lectura key={a.id} a={a} previa={previaDe(i)} p={p} tonoMostrado={data.tono.mostrado} />)}
              </ul>
            )}
          </section>

          <Comentarios datos={data} />
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
