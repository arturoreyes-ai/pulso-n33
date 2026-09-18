"use client";

import { Sparkle as IA, X as Cerrar } from "@phosphor-icons/react";
import { useId, useRef, useState } from "react";

import { CONTROL } from "@/components/lector/lector";
import { clasesChip } from "@/components/ui/clases";
import { VERSION_ANALISIS, type Analisis, type SugerenciaSocial } from "@/lib/analisis/contrato";
import type { ReferenciaAnalisis } from "@/lib/busqueda/enlaces";

/**
 * La lectura automatica de un titular, en un dialogo.
 *
 * NO se pinta dentro de la tarjeta. Una tarjeta es un punto de ajuste de
 * altura fija y meterle prosa moveria el titular bajo el dedo de quien esta
 * leyendo -- la misma razon por la que `.aviso-compartir` esta posicionado
 * absoluto en globals.css. Se abre en la hoja del lector, como los comentarios
 * de una publicacion (paneles/comentarios-publicacion.tsx).
 *
 * El rotulo dice solo «Generado con IA». La ficha ya separa hechos, salvedad e
 * idea para redes; repetir aqui el medio, las limitaciones y las cifras que no
 * toca convertia una atribucion breve en otra pieza de metodologia.
 */
type Estado =
  | { fase: "quieto" }
  | { fase: "confirmar" }
  | { fase: "cargando" }
  | { fase: "listo"; analisis: Analisis }
  | { fase: "fallo"; mensaje: string };

export function AnalisisTitular({ titulo, referencia, medio }: {
  titulo: string;
  referencia: ReferenciaAnalisis | null;
  medio: string;
}) {
  const hoja = useRef<HTMLDialogElement>(null);
  const solicitudEnCurso = useRef(false);
  const id = useId();
  const [estado, setEstado] = useState<Estado>({ fase: "quieto" });

  function abrir() {
    hoja.current?.showModal();
    if (estado.fase === "listo" || estado.fase === "cargando") return;
    // `null` solo significa que la fila no trae una referencia verificable.
    // Un token valido del buscador llega hasta la ruta y se resuelve despues
    // de esta confirmacion (lib/busqueda/enlaces.ts).
    if (referencia === null) {
      setEstado({ fase: "fallo", mensaje: `Esta nota de ${medio} no se puede abrir desde aquí.` });
      return;
    }
    // El primer toque solo abre la confirmacion: la lectura tiene costo y no
    // debe empezar por un roce accidental en el recorrido vertical.
    setEstado({ fase: "confirmar" });
  }

  async function analizar() {
    if (referencia === null || solicitudEnCurso.current) return;
    solicitudEnCurso.current = true;
    setEstado({ fase: "cargando" });
    try {
      const params = new URLSearchParams({ v: VERSION_ANALISIS, u: referencia.url, m: medio, d: referencia.dominio });
      const r = await fetch(`/api/analizar?${params}`);
      if (!r.ok) {
        const cuerpo = (await r.json()) as unknown;
        setEstado({ fase: "fallo", mensaje: mensajeDeError(cuerpo) });
        return;
      }
      const cuerpo = (await r.json()) as unknown;
      const analisis = leerAnalisis(cuerpo);
      if (analisis !== null) {
        setEstado({ fase: "listo", analisis });
      } else {
        setEstado({ fase: "fallo", mensaje: mensajeDeError(cuerpo) });
      }
    } catch {
      setEstado({ fase: "fallo", mensaje: "No se pudo hacer la lectura." });
    } finally {
      solicitudEnCurso.current = false;
    }
  }

  return (
    <>
      <button type="button" className={clasesChip(false)} onClick={abrir}>
        <IA size={16} weight="light" aria-hidden className="shrink-0 self-center" />
        Analizar
      </button>

      <dialog
        ref={hoja}
        className="dialogo-lector"
        aria-labelledby={`${id}-titulo`}
        onClose={() => { if (estado.fase === "confirmar") setEstado({ fase: "quieto" }); }}
      >
        <div className="cabecera-dialogo-lector">
          <h2 id={`${id}-titulo`} className="text-rotulo text-tinta-titulo">Lectura automática</h2>
          <button type="button" className={CONTROL} aria-label="Cerrar lectura" onClick={() => hoja.current?.close()}>
            <Cerrar size={20} aria-hidden />
          </button>
        </div>

        <div className="grid gap-4 px-4 pt-6 pb-8 text-lectura text-tinta-prosa">
          <p className="max-w-[65ch] font-titular text-rotulo text-tinta-titulo">{titulo}</p>

          {estado.fase === "confirmar" ? (
            <section aria-labelledby={`${id}-confirmacion`} className="grid max-w-[65ch] gap-4">
              <div className="grid gap-2">
                <h3 id={`${id}-confirmacion`} className="text-cuerpo text-tinta-dato">¿Analizar esta nota con IA?</h3>
                <p className="text-tinta-meta">Confirma para generar el resumen y la idea para redes.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className={clasesChip(true)} onClick={analizar}>
                  <IA size={16} weight="light" aria-hidden className="shrink-0 self-center" />
                  Analizar con IA
                </button>
                <button type="button" className={clasesChip(false)} onClick={() => hoja.current?.close()}>
                  Cancelar
                </button>
              </div>
            </section>
          ) : null}

          {estado.fase === "cargando" ? (
            <p role="status" className="max-w-[65ch] text-tinta-meta">Leyendo la nota…</p>
          ) : null}

          {estado.fase === "fallo" ? (
            <p role="status" className="max-w-[65ch] text-baja">{estado.mensaje}</p>
          ) : null}

          {estado.fase === "listo" ? (
            <>
              <section aria-labelledby={`${id}-resumen`} className="grid max-w-[65ch] gap-2 break-words">
                <h3 id={`${id}-resumen`} className="text-meta text-tinta-dato">Resumen</h3>
                <p>{estado.analisis.lectura}</p>
              </section>

              <section aria-labelledby={`${id}-puntos`} className="grid max-w-[65ch] gap-2 break-words">
                <h3 id={`${id}-puntos`} className="text-meta text-tinta-dato">Puntos clave</h3>
                <ul className="grid list-disc gap-2 pl-5">
                  {estado.analisis.puntos.map((p) => <li key={p}>{p}</li>)}
                </ul>
              </section>

              <section aria-labelledby={`${id}-redes`} className="grid max-w-[65ch] gap-3 rounded-nucleo border border-filo bg-vela p-4 break-words">
                <h3 id={`${id}-redes`} className="text-meta text-tinta-dato">Idea para redes</h3>
                <dl className="grid gap-3">
                  <div>
                    <dt className="text-meta text-tinta-meta">Formato</dt>
                    <dd>{estado.analisis.sugerenciaSocial.formato}</dd>
                  </div>
                  <div>
                    <dt className="text-meta text-tinta-meta">Enfoque</dt>
                    <dd>{estado.analisis.sugerenciaSocial.enfoque}</dd>
                  </div>
                  <div>
                    <dt className="text-meta text-tinta-meta">Gancho</dt>
                    <dd>{estado.analisis.sugerenciaSocial.gancho}</dd>
                  </div>
                </dl>
              </section>

              <section aria-labelledby={`${id}-salvedad`} className="grid max-w-[65ch] gap-2 break-words text-tinta-meta">
                <h3 id={`${id}-salvedad`} className="text-meta text-tinta-dato">Lo que no establece</h3>
                <p>{estado.analisis.salvedad}</p>
              </section>
            </>
          ) : null}

          {estado.fase === "listo" ? (
            <p className="max-w-[65ch] border-t border-filo pt-4 text-meta text-tinta-meta">
              Generado con IA.
            </p>
          ) : null}
        </div>
      </dialog>
    </>
  );
}

function mensajeDeError(valor: unknown): string {
  if (valor !== null && typeof valor === "object" && "mensaje" in valor && typeof valor.mensaje === "string") {
    return valor.mensaje;
  }
  return "No se pudo hacer la lectura.";
}

function esSugerenciaSocial(valor: unknown): valor is SugerenciaSocial {
  if (valor === null || typeof valor !== "object") return false;
  const s = valor as Record<string, unknown>;
  return typeof s.formato === "string" && s.formato.trim() !== ""
    && typeof s.enfoque === "string" && s.enfoque.trim() !== ""
    && typeof s.gancho === "string" && s.gancho.trim() !== "";
}

function leerAnalisis(valor: unknown): Analisis | null {
  if (valor === null || typeof valor !== "object") return null;
  const a = valor as Record<string, unknown>;
  if (
    typeof a.lectura !== "string" || a.lectura === ""
    || !Array.isArray(a.puntos) || a.puntos.length < 3 || a.puntos.length > 5
    || !a.puntos.every((p) => typeof p === "string" && p.trim() !== "")
    || typeof a.salvedad !== "string" || a.salvedad === ""
    || typeof a.medio !== "string" || !esSugerenciaSocial(a.sugerenciaSocial)
  ) return null;
  return {
    lectura: a.lectura,
    puntos: a.puntos,
    salvedad: a.salvedad,
    sugerenciaSocial: a.sugerenciaSocial,
    medio: a.medio,
  };
}
