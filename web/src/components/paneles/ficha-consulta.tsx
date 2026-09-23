"use client";

import { ArrowDown as FlechaAbajo, ChatCircle as Globo, DownloadSimple as Descargar, MagnifyingGlass as Lupa } from "@phosphor-icons/react";
import { useRef, useState, type MouseEvent, type ReactNode } from "react";


import { Bisel } from "@/components/ui/bisel";
import { clasesBoton } from "@/components/ui/clases";
import { Hueco } from "@/components/ui/primitivas";
import { Cuadro, TiraTono } from "@/components/ui/tira-tono";
import { useConsultasComentarios } from "@/lib/datos/hooks";
import { ComentariosPublicacion, type Textos } from "./comentarios-publicacion";
import type { Consulta, DocConsultas, TonoTitular } from "@/lib/datos/tipos";
import {
  CLASE_DE_TITULAR,
  cifrasConsulta,
  NOMBRE_TONO_TITULAR,
  noticiasDeConsulta,
  publicacionesConComentarios,
  palabraTono,
  reunirPublicacionesConsulta,
  rutaDeBusquedaEnVivo,
  rotulosConsulta,
  tramosDeMedio,
  type Genero,
  type NoticiaConsulta,
  type TonoSerie,
} from "@/lib/dominio/consultas";
import { fechaConAnio, fechaLarga, numero, pluralizar } from "@/lib/dominio/formato";
import { rutaDeInforme } from "@/lib/informe/contrato";
import { Hoja } from "@/components/ui/hoja";

/**
 * La ficha de un termino en seguimiento: la PRIMERA tarjeta del recorrido de
 * su busqueda, antes de las publicaciones.
 *
 * Lo que la direccion del cliente viene a ver, dicho en su vocabulario:
 * cuantas noticias, publicaciones y comentarios sobre el termino son
 * POSITIVOS y cuantos NEGATIVOS. Dos pedidos lo decidieron. El 22 de
 * septiembre de 2026, que lo primero al entrar fueran los numeros: la ficha
 * abria con el nombre, dos ventanas y cuatro frases, y la cifra que se buscaba
 * iba dentro de la segunda oracion. El 23, que esos numeros fueran positivo y
 * negativo, sin «adversos, favorables», sin la salvedad del tono y sin
 * tecnicismos: la version del 22 abria con «2 titulares» en grande y el tono
 * en una leyenda chica, que es justo al reves de lo que se lee arriba.
 *
 * Lo que la forma sigue sosteniendo del registro de PRODUCT.md, porque sin
 * pie de pagina esta ficha es lo unico que lo dice:
 *  - Conteos, nunca porcentajes: una publicacion tiene entre 1 y 20
 *    comentarios, debajo del piso de 30. La tira pinta un cuadro por pieza
 *    (ui/tira-tono.tsx dice por que no una barra).
 *  - «Sin dato» donde no se leyo, nunca cero: una serie sin lectura pinta
 *    «Sin dato» en lugar de los dos numeros.
 *  - Noticias, publicaciones y comentarios en tarjetas separadas y sin un
 *    total: la regla 3 no deja sumar prensa y comentarios. Que las tres digan
 *    «positivo» no las vuelve una sola serie.
 *  - El neutro y lo que quedo sin tono se dicen en gris al pie de cada
 *    tarjeta, para que las cuentas cuadren con el total.
 *
 * La salvedad del tono (`salvedad_tono`) sigue en el dato, que el validador
 * exige palabra por palabra, y sigue en el PDF; la pantalla dejo de pintarla
 * el 23 de septiembre de 2026 a pedido del cliente, con lo de «archivo
 * propio», la `muestra` de la prensa y la lista de redes «sin dato», que
 * explicaban el mecanismo. Las cuentas salen de
 * lib/dominio/consultas.ts::cifrasConsulta.
 *
 * Ese mismo dia salieron «En resumen» —las frases repetian las tarjetas— y la
 * seccion y la tarjeta «Agregadas a mano»: la direccion quiere las noticias
 * del termino, no como llego cada una. Tambien ese dia la tarjeta de noticias
 * paso a un TOTAL, sin separar seis meses de lo anterior, y las tarjetas
 * perdieron la ventana del rotulo; un agregado que es post de red cuenta como
 * publicacion y sale en el recorrido (redDeAgregado). En el dato y en el PDF
 * siguen aparte.
 */

const NOMBRE_TIPO: Record<Consulta["tipo"], string> = {
  persona: "Persona", empresa: "Empresa", tema: "Tema",
};

const SIN_COMENTARIOS_NOTICIAS = "Las noticias no incluyen comentarios.";

const CLASE_TONO: Record<TonoTitular, string> = {
  favorable: "text-sube", adversa: "text-baja", neutral: "text-tinta-meta",
};

/** Un numero grande con su flecha y su palabra. El color es el dato y no el
 *  unico portador: van la flecha y la palabra. Un cero va en gris para que el
 *  ojo caiga en lo que si hay. */
function Numero({ n, clase, genero }: { n: number; clase: "positivo" | "negativo"; genero: Genero }) {
  const color = clase === "positivo" ? "text-sube" : "text-baja";
  return (
    <div className="min-w-0">
      <p className={`flex items-baseline gap-2 font-titular text-hero tabular-nums ${n === 0 ? "text-tinta-meta" : color}`}>
        <span aria-hidden className={`text-rotulo ${color}`}>{clase === "positivo" ? "▲" : "▼"}</span>
        {numero(n)}
      </p>
      <p className="text-lectura text-tinta-dato">{palabraTono(clase, n, genero)}</p>
    </div>
  );
}

/** Lo que no es ni positivo ni negativo, en gris y al pie, con el total al
 *  que suman las cuatro cubetas. */
function Pie({ serie, unidad, genero }: { serie: TonoSerie; unidad: [string, string, string]; genero: Genero }) {
  if (serie.total === 0) return <p className="text-cuerpo text-tinta-meta">{unidad[2]}</p>;
  const resto = [
    serie.neutral > 0 ? `${numero(serie.neutral)} ${palabraTono("neutral", serie.neutral, genero)}` : null,
    serie.sinTono > 0 ? `${numero(serie.sinTono)} sin tono` : null,
  ].filter((x): x is string => x !== null);
  return (
    <p className="text-cuerpo text-tinta-meta">
      de {numero(serie.total)} {pluralizar(serie.total, unidad[0], unidad[1])}{resto.length > 0 ? ` · ${resto.join(" · ")}` : ""}
    </p>
  );
}

/** Una tarjeta: positivos y negativos en grande, un cuadro por pieza, el
 *  resto en gris. `serie` null es «sin dato» y no pinta un solo numero. */
function Cifra({ rotulo, serie, genero, unidad, sinTono, enlace, children }: {
  rotulo: string;
  serie: TonoSerie | null;
  genero: Genero;
  /** Singular, plural y la frase del cero: «noticia», «noticias», «ninguna noticia». */
  unidad: [string, string, string];
  /** La serie se leyo pero su tono no: pinta el total y dice «sin dato» del
   *  tono, en vez de dos ceros. Solo las publicaciones de un corte viejo. */
  sinTono?: number;
  /** El enlace al pie de la tarjeta: a la lista, al recorrido o a la hoja. */
  enlace?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Bisel as="li" nivel="panel" className="min-w-0" interior="flex h-full flex-col gap-3 p-4 sm:gap-4 sm:p-6">
      <p className="text-cuerpo font-medium text-tinta-prosa">{rotulo}</p>
      {sinTono !== undefined ? (
        <>
          <p className="font-titular text-hero tabular-nums text-tinta-titulo">{numero(sinTono)}</p>
          <p className="text-cuerpo text-tinta-meta">{pluralizar(sinTono, unidad[0], unidad[1])} · tono <Hueco>sin dato</Hueco></p>
        </>
      ) : serie === null ? (
        <p className="text-rotulo italic text-aviso/85">Sin dato</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <Numero n={serie.positivo} clase="positivo" genero={genero} />
            <Numero n={serie.negativo} clase="negativo" genero={genero} />
          </div>
          <TiraTono tramos={serie.tramos} />
          <Pie serie={serie} unidad={unidad} genero={genero} />
        </>
      )}
      {children}
      {enlace === undefined ? null : <div className="mt-auto pt-2">{enlace}</div>}
    </Bisel>
  );
}

/** De que medio viene cada noticia, sobre la MISMA lista que se cuenta
 *  arriba. `prensa.por_medio` solo cubre los seis meses y las anteriores
 *  quedaban fuera: dos cifras distintas en la misma pantalla. */
function porMedioDe(noticias: readonly NoticiaConsulta[]) {
  const por = new Map<string, { fuente: string; titulares: number; favorable: number; adversa: number; neutral: number }>();
  for (const r of noticias) {
    const m = por.get(r.fuente) ?? { fuente: r.fuente, titulares: 0, favorable: 0, adversa: 0, neutral: 0 };
    m.titulares += 1;
    if (r.tono !== null) m[r.tono] += 1;
    por.set(r.fuente, m);
  }
  return [...por.values()].sort((a, b) => b.titulares - a.titulares || a.fuente.localeCompare(b.fuente));
}

/** Lleva a la primera publicacion: la tarjeta que sigue a la ficha en el
 *  mismo recorrido (`data-indice="1"`). El 23 de septiembre de 2026 el cliente
 *  aviso que quien entra no sabe que las publicaciones estan abajo: la ficha
 *  ocupa la pantalla entera y nada decia que hubiera algo despues. */
function irAPublicaciones(evento: MouseEvent<HTMLButtonElement>) {
  evento.currentTarget.closest(".recorrido-lector")
    ?.querySelector<HTMLElement>('[data-indice="1"]')
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Lleva a la lista de noticias de la misma ficha. */
function irANoticias(evento: MouseEvent<HTMLButtonElement>) {
  evento.currentTarget.closest("article")?.querySelector<HTMLElement>("#ficha-prensa")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function Enlace({ onClick, icono, children }: { onClick: (evento: MouseEvent<HTMLButtonElement>) => void; icono: ReactNode; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={clasesBoton(false)}>
      {icono} {children}
    </button>
  );
}

function BotonPublicaciones({ n, activo = false }: { n: number; activo?: boolean }) {
  return (
    <button type="button" onClick={irAPublicaciones} className={clasesBoton(activo)}>
      <FlechaAbajo size={16} aria-hidden /> Ver {n === 1 ? "la publicación" : `las ${numero(n)} publicaciones`}
    </button>
  );
}

function Titular({ r }: { r: NoticiaConsulta }) {
  return (
    <li className="py-4 text-lectura first:pt-0 last:pb-0">
      <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="text-tinta-titulo underline decoration-filo underline-offset-4 hover:decoration-tinta-prosa">
        {r.titulo}
      </a>
      <span className="mt-2 flex flex-wrap items-center gap-x-1.5 text-meta text-tinta-meta">
        <span>{r.fuente}</span>
        <span aria-hidden>·</span>
        {r.fecha === null ? <Hueco>sin fecha</Hueco> : <span>{fechaConAnio(r.fecha)}</span>}
        <span aria-hidden>·</span>
        {r.tono === null ? (
          <span className="inline-flex items-center gap-1.5"><Cuadro clase="sin_tono" tamano="chico" /><Hueco>sin tono</Hueco></span>
        ) : (
          <span className={`inline-flex items-center gap-1.5 ${CLASE_TONO[r.tono]}`}>
            <Cuadro clase={CLASE_DE_TITULAR[r.tono]} tamano="chico" />{NOMBRE_TONO_TITULAR[r.tono]}
          </span>
        )}
      </span>
    </li>
  );
}

export function FichaConsulta({ c, doc, textos: textosDados, informe = true, extra, rotuloTipo }: {
  c: Consulta;
  doc: DocConsultas;
  /** El texto de los comentarios, cuando no es el de data/consultas-comentarios.json:
   *  la busqueda en vivo de un termino (paneles/busqueda-en-vivo.tsx) trae el suyo. */
  textos?: Textos;
  /** Sin informe no hay «Descargar PDF»: la busqueda en vivo no esta en
   *  data/consultas.json, que es de donde el PDF se arma. */
  informe?: boolean;
  /** Lo que va entre las tarjetas y las noticias: el boton de la busqueda en
   *  redes y las tendencias, en la busqueda en vivo. */
  extra?: ReactNode;
  /** El rotulo sobre el nombre, en lugar del tipo del termino. */
  rotuloTipo?: string;
}) {
  const { prensa: cp, publicaciones: cpub, comentarios: cc } = cifrasConsulta(c);
  const prensa = c.prensa;
  const noticias = noticiasDeConsulta(c);
  const porMedio = porMedioDe(noticias);
  // Las que de verdad siguen abajo en el recorrido: las destacadas, no el
  // total de la tarjeta, que puede ser mayor.
  const filas = reunirPublicacionesConsulta(c);
  const enRecorrido = filas.length;
  // La hoja de TODOS los comentarios del termino, abierta desde su tarjeta
  // (23 de septiembre de 2026: el cliente pidio un enlace en la tarjeta para
  // leerlos ahi, sin recorrer publicacion por publicacion). Una sola hoja,
  // con un bloque por publicacion que tenga texto publicado.
  const propios = useConsultasComentarios();
  const textos = textosDados ?? propios;
  const hoja = useRef<HTMLDialogElement>(null);
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const conTexto = publicacionesConComentarios(c, textos.data);
  const publicadosTexto = conTexto.reduce((n, f) => n + (textos.data?.por_post[f.post.url] ?? []).length, 0);
  // Las tarjetas de publicaciones y de comentarios se leen igual: «· en
  // Instagram y Facebook» en las dos (pedido del cliente del 23 de septiembre
  // de 2026: dos rotulos distintos para dos tarjetas gemelas confundian). La
  // hoja lleva el titulo largo cuando junta varias publicaciones.
  const rotulos = rotulosConsulta(c, textos.data);
  return (
    <div className="mx-auto grid w-full min-w-0 max-w-[64rem] gap-6 py-2 [overflow-wrap:anywhere] sm:gap-12 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-meta text-tinta-meta">{rotuloTipo ?? NOMBRE_TIPO[c.tipo]} · al {fechaLarga(doc.generado)}</p>
          <h2 className="mt-2 font-titular text-seccion text-tinta-titulo">{c.termino}</h2>
        </div>
        {/* En un telefono el boton de arriba empujaria la ultima tarjeta
            fuera de la primera pantalla; ahi queda solo el de abajo. */}
        {informe ? (
          <div className="hidden sm:block">
            <a href={rutaDeInforme(c.id)} download className={clasesBoton(false)}>
              <Descargar size={16} aria-hidden /> Descargar PDF
            </a>
          </div>
        ) : null}
      </header>

      <section aria-labelledby="ficha-cifras">
        <h3 id="ficha-cifras" className="sr-only">Positivos y negativos</h3>
        <ul className="grid gap-3 md:grid-cols-3">
          <Cifra
            rotulo="Noticias"
            serie={cp.estado === "ok" ? cp.tono : null}
            genero="f"
            unidad={["noticia", "noticias", "Ninguna noticia"]}
            enlace={cp.estado === "ok" && cp.tono.total > 0
              ? <Enlace onClick={irANoticias} icono={<FlechaAbajo size={18} aria-hidden />}>Ver noticias</Enlace>
              : undefined}
          >
            {/* De una noticia se guarda titular, medio y enlace, nunca la pagina
                ni sus comentarios (AGENTS.md, «Headline, source and link
                only»). El cliente pidio que se dijera, el 23 de septiembre de
                2026: sin esto se esperaban comentarios de prensa en la tercera
                tarjeta. */}
            {cp.estado === "ok" ? <p className="text-cuerpo text-tinta-meta">{SIN_COMENTARIOS_NOTICIAS}</p> : null}
          </Cifra>
          <Cifra
            rotulo={rotulos.publicaciones}
            serie={cpub.estado === "ok" ? cpub.tono : null}
            sinTono={cpub.estado === "ok" && cpub.tono === null ? cpub.total : undefined}
            genero="f"
            unidad={["publicación", "publicaciones", "Ninguna publicación"]}
            enlace={enRecorrido === 0 ? undefined : <BotonPublicaciones n={enRecorrido} />}
          />
          <Cifra
            rotulo={rotulos.comentarios}
            serie={cc.estado === "ok" ? cc.tono : null}
            genero="m"
            unidad={["comentario", "comentarios", "Ningún comentario"]}
            enlace={conTexto.length === 0 ? undefined : (
              <Enlace onClick={() => { setHojaAbierta(true); hoja.current?.showModal(); }} icono={<Globo size={18} aria-hidden />}>
                {publicadosTexto === 1 ? "Ver el comentario" : `Ver los ${numero(publicadosTexto)} comentarios`}
              </Enlace>
            )}
          />
        </ul>
      </section>

      {extra}

      <section aria-labelledby="ficha-prensa" className="max-w-[72ch] border-t border-filo pt-8 sm:pt-10">
        <h3 id="ficha-prensa" className="text-rotulo text-tinta-titulo">Noticias</h3>
        <p className="mt-1 text-cuerpo text-tinta-meta">{SIN_COMENTARIOS_NOTICIAS}</p>
        {cp.estado !== "ok" ? (
          <p className="mt-2 text-cuerpo text-tinta-meta">Sin dato</p>
        ) : (
          <>
            {porMedio.length < 2 ? null : (
              <div className="mt-6">
                <h4 className="text-cuerpo font-medium text-tinta-prosa">De dónde vienen</h4>
                <ul className="mt-3 grid">
                  {porMedio.map((m) => (
                    <li key={m.fuente} className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] items-center gap-4 border-b border-vela py-3 text-cuerpo last:border-0">
                      <span className="text-tinta-dato">{m.fuente}</span>
                      <TiraTono tramos={tramosDeMedio(m)} tamano="normal" />
                      <span className="tabular-nums text-tinta-titulo">{numero(m.titulares)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {noticias.length === 0 ? (
              <p className="mt-2 text-cuerpo text-tinta-meta">Ninguna noticia menciona a {c.termino}.</p>
            ) : (
              <ul className="mt-6 grid divide-y divide-vela">
                {noticias.map((r) => <Titular key={r.url} r={r} />)}
              </ul>
            )}
          </>
        )}
        <p className="mt-6">
          <a href={rutaDeBusquedaEnVivo(c.termino)} className={clasesBoton(false)}>
            <Lupa size={16} aria-hidden /> Ver en la prensa en vivo
          </a>
        </p>
      </section>

      {c.temas.temas.length === 0 ? null : (
        <section aria-labelledby="ficha-temas" className="max-w-[72ch] border-t border-filo pt-8 sm:pt-10">
          <h3 id="ficha-temas" className="text-rotulo text-tinta-titulo">Lo que se repite en los comentarios</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {c.temas.temas.map((tema) => (
              <li key={tema.termino} className="inline-flex items-baseline gap-2 rounded-full bg-vela px-3 py-1 text-cuerpo text-tinta-prosa">
                {tema.termino} <span className="text-meta tabular-nums text-tinta-meta">{numero(tema.n)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {informe || enRecorrido > 0 ? (
        <div className="flex max-w-[72ch] flex-col items-start gap-4 border-t border-filo pt-6 sm:flex-row sm:items-center sm:gap-6">
          {informe ? (
            <a href={rutaDeInforme(c.id)} download className={clasesBoton(true)}>
              <Descargar size={16} aria-hidden /> Descargar PDF
            </a>
          ) : null}
          {enRecorrido === 0 ? null : <BotonPublicaciones n={enRecorrido} />}
        </div>
      ) : null}

      <Hoja ref={hoja} titulo={rotulos.hoja} rotuloCerrar="Cerrar comentarios" onClose={() => setHojaAbierta(false)}>
        {hojaAbierta
          ? conTexto.map((f) => (
            <div key={f.clave} className="border-b border-vela last:border-0">
              <ComentariosPublicacion fila={f} textos={{ data: textos.data, error: textos.error }} />
            </div>
          ))
          : null}
      </Hoja>
    </div>
  );
}
