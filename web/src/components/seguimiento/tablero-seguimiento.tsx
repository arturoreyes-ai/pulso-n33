"use client";

import { ArrowRight as Flecha, Plus as Mas } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

import { Bisel } from "@/components/ui/bisel";
import { EstadoCarga } from "@/components/ui/estado-carga";
import { Segmentado } from "@/components/ui/segmentado";
import { ErrorDatos } from "@/lib/datos/fetcher";
import { numero, pluralizar } from "@/lib/dominio/formato";
import { NOMBRE_RED } from "@/lib/dominio/publicaciones";
import type { IdiomaSeguido, ResumenSeguimiento } from "@/lib/seguimiento/contrato";
import { momento } from "@/lib/seguimiento/formato";
import { useAgregar, useListaSeguimiento } from "@/lib/seguimiento/use-seguimiento";

/**
 * /seguimiento: las publicaciones que el equipo sigue, y el campo para seguir
 * otra.
 *
 * Lo pidio el cliente el 28 de septiembre de 2026 (docs/PLAN.md): pegar el
 * enlace de una publicacion y volver a ella cuantas veces haga falta para ver
 * lo ultimo que se comenta y como suena. La lista es del EQUIPO, no de cada
 * persona: lo que uno agrega lo ven todos, como una pizarra de redaccion.
 *
 * Seguir cuesta —la primera lectura arranca al pulsar—, asi que el boton solo
 * se pinta con la compuerta encendida, y sin ella la lista se sigue viendo:
 * lo que ya se leyo no se pierde porque el gasto este apagado. Lo que la
 * pantalla dice es QUE pasa, nunca como (AGENTS.md): ni el proveedor, ni el
 * tope, ni el precio.
 *
 * El idioma se DECLARA al agregar y no se adivina (regla de PRODUCT.md): el
 * modelo de tono habla espanol, y a un comentario en ingles le devolveria una
 * etiqueta plausible y falsa.
 */

const ANCHO = "mx-auto w-full max-w-[88rem] px-4 md:px-8";

function Agregar() {
  const router = useRouter();
  const id = useId();
  const [url, setUrl] = useState("");
  const [idioma, setIdioma] = useState<IdiomaSeguido>("es");
  const { correr, enviando, fallo } = useAgregar();

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const cuerpo = await correr(url, idioma);
    if (cuerpo !== null && typeof cuerpo.id === "string") router.push(`/seguimiento/${cuerpo.id}`);
  }

  return (
    <Bisel nivel="panel" interior="grid gap-4 p-4 sm:p-6">
      <form onSubmit={(e) => void enviar(e)} className="grid gap-4">
        <label htmlFor={`${id}-url`} className="text-cuerpo font-medium text-tinta-prosa">Seguir una publicación</label>
        <input
          id={`${id}-url`}
          type="url"
          inputMode="url"
          required
          maxLength={500}
          autoComplete="off"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enlace de Instagram, TikTok o Facebook"
          className="w-full rounded-nucleo border border-filo bg-vanta px-4 py-3 text-cuerpo text-tinta-titulo placeholder:text-tinta-inerte"
        />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-meta text-tinta-meta">Idioma de los comentarios</span>
            <Segmentado
              etiqueta="Idioma de los comentarios"
              ancho="justo"
              opciones={[
                { id: "es", nombre: "Español", activo: idioma === "es", onElegir: () => setIdioma("es") },
                { id: "en", nombre: "Inglés", activo: idioma === "en", onElegir: () => setIdioma("en") },
              ]}
            />
          </div>
          {/* La pastilla con su flecha en circulo, la del boton «Buscar» de
              la hoja de busqueda hasta el 28 de septiembre de 2026. */}
          <button
            type="submit"
            disabled={enviando}
            className="group inline-flex items-center justify-between gap-3 rounded-full bg-realce py-2 pl-5 pr-2 text-cuerpo text-tinta-titulo transition-[color,background-color,scale] duration-[var(--dur-toque)] ease-out hover:bg-filo active:scale-[0.97] disabled:opacity-60 max-sm:w-full"
          >
            <span>{enviando ? "Agregando…" : "Seguir"}</span>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-vanta transition-transform duration-[var(--dur-cambio)] ease-firma group-hover:translate-x-0.5">
              <Mas size={16} aria-hidden />
            </span>
          </button>
        </div>
        {fallo === null ? null : <p role="alert" className="text-cuerpo text-baja">{fallo.mensaje}</p>}
      </form>
    </Bisel>
  );
}

function estadoDe(p: ResumenSeguimiento): string {
  if (p.enCurso) return "Leyendo comentarios…";
  if (p.ultima === null) return "Sin leer todavía";
  return `Actualizada ${momento(p.ultima.fecha)}`;
}

function Fila({ p }: { p: ResumenSeguimiento }) {
  return (
    <li>
      <Link href={`/seguimiento/${p.id}`}
        className="group grid gap-1 border-b border-vela py-5 transition-colors duration-[var(--dur-toque)] ease-out first:pt-0 hover:border-filo">
        <span className="text-meta text-tinta-meta">
          {NOMBRE_RED[p.red]}{p.creador === null ? "" : ` · ${p.creador}`}
        </span>
        <span className="flex items-baseline justify-between gap-4">
          <span className="min-w-0 break-words text-lectura text-tinta-titulo group-hover:underline group-hover:decoration-filo group-hover:underline-offset-4">
            {p.titulo || "Publicación sin título"}
          </span>
          <Flecha size={16} aria-hidden className="shrink-0 text-tinta-meta transition-transform duration-[var(--dur-cambio)] ease-firma group-hover:translate-x-0.5" />
        </span>
        <span className="text-meta text-tinta-meta">
          {estadoDe(p)}
          {p.comentarios > 0 ? ` · ${numero(p.comentarios)} ${pluralizar(p.comentarios, "comentario", "comentarios")}` : ""}
        </span>
      </Link>
    </li>
  );
}

export function TableroSeguimiento() {
  const { data, error } = useListaSeguimiento();
  const sinBase = error instanceof ErrorDatos && error.status === 401;
  return (
    <div className={`${ANCHO} grid gap-10 pb-16 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:gap-16`}>
      <div className="lg:sticky lg:top-[var(--respiro-superior)] lg:self-start">
        {data === undefined ? null : data.disponible ? (
          <Agregar />
        ) : (
          <p className="text-cuerpo text-tinta-meta">El seguimiento de publicaciones no está disponible por ahora.</p>
        )}
      </div>

      <section aria-labelledby="seguimiento-lista">
        <h2 id="seguimiento-lista" className="text-rotulo text-tinta-titulo">En seguimiento</h2>
        <div className="mt-6">
          {error !== undefined ? (
            <p className="text-cuerpo text-baja">{sinBase ? "Inicia sesión para ver el seguimiento." : "No se pudo cargar la lista."}</p>
          ) : data === undefined ? (
            <EstadoCarga etiqueta="Cargando" />
          ) : data.publicaciones.length === 0 ? (
            <p className="text-cuerpo text-tinta-meta">Todavía no hay publicaciones en seguimiento.</p>
          ) : (
            <ul>
              {data.publicaciones.map((p) => <Fila key={p.id} p={p} />)}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
