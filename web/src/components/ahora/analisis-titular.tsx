"use client";

import { X as Cerrar } from "@phosphor-icons/react";
import { useRef, useState } from "react";

import { CONTROL } from "@/components/lector/lector";
import { clasesChip } from "@/components/ui/clases";

/**
 * La lectura automatica de un titular, en un dialogo.
 *
 * NO se pinta dentro de la tarjeta. Una tarjeta es un punto de ajuste de
 * altura fija y meterle prosa moveria el titular bajo el dedo de quien esta
 * leyendo -- la misma razon por la que `.aviso-compartir` esta posicionado
 * absoluto en globals.css. Se abre en la hoja del lector, como los comentarios
 * de una publicacion (paneles/comentarios-publicacion.tsx).
 *
 * Lo que dice el rotulo y por que: la regla del 13 de septiembre de 2026 pide
 * que la interfaz diga QUE esta viendo el lector y nunca COMO se obtuvo. Que
 * esto lo escribe una maquina a partir de la nota del medio, que puede
 * equivocarse y que no sustituye leerla es lo primero; el nombre del modelo, la
 * ruta y la clave no aparecen. Es significado, no procedimiento.
 */
interface Analisis {
  lectura: string;
  puntos: string[];
  salvedad: string;
}

type Estado =
  | { fase: "quieto" }
  | { fase: "cargando" }
  | { fase: "listo"; analisis: Analisis }
  | { fase: "fallo"; mensaje: string };

export function AnalisisTitular({ titulo, url, medio }: { titulo: string; url: string | null; medio: string }) {
  const hoja = useRef<HTMLDialogElement>(null);
  const [estado, setEstado] = useState<Estado>({ fase: "quieto" });

  async function abrir() {
    hoja.current?.showModal();
    if (estado.fase === "listo" || estado.fase === "cargando") return;
    // Sin enlace del propio medio no hay nada que abrir, y se dice sin pedir
    // nada: el enlace de la fila es un token que no lleva a la nota
    // (lib/busqueda/enlaces.ts).
    if (url === null) {
      setEstado({ fase: "fallo", mensaje: `Esta nota de ${medio} no se puede abrir desde aquí.` });
      return;
    }
    setEstado({ fase: "cargando" });
    try {
      const r = await fetch(`/api/analizar?u=${encodeURIComponent(url)}&m=${encodeURIComponent(medio)}`);
      const cuerpo = (await r.json()) as Partial<Analisis> & { mensaje?: string };
      if (typeof cuerpo.lectura === "string" && cuerpo.lectura !== "") {
        setEstado({
          fase: "listo",
          analisis: { lectura: cuerpo.lectura, puntos: cuerpo.puntos ?? [], salvedad: cuerpo.salvedad ?? "" },
        });
      } else {
        setEstado({ fase: "fallo", mensaje: cuerpo.mensaje ?? "No se pudo hacer la lectura." });
      }
    } catch {
      setEstado({ fase: "fallo", mensaje: "No se pudo hacer la lectura." });
    }
  }

  return (
    <>
      <button type="button" className={clasesChip(false)} onClick={abrir}>
        Analizar
      </button>

      <dialog ref={hoja} className="dialogo-lector" aria-labelledby="titulo-analisis">
        <div className="cabecera-dialogo-lector">
          <h2 id="titulo-analisis" className="text-rotulo text-tinta-titulo">Lectura automática</h2>
          <button type="button" className={CONTROL} aria-label="Cerrar lectura" onClick={() => hoja.current?.close()}>
            <Cerrar size={20} aria-hidden />
          </button>
        </div>

        <div className="grid gap-4 px-4 pt-6 pb-8 text-lectura text-tinta-prosa">
          <p className="max-w-[65ch] font-titular text-rotulo text-tinta-titulo">{titulo}</p>

          {estado.fase === "cargando" ? (
            <p role="status" className="max-w-[65ch] text-tinta-meta">Leyendo la nota…</p>
          ) : null}

          {estado.fase === "fallo" ? (
            <p role="status" className="max-w-[65ch] text-baja">{estado.mensaje}</p>
          ) : null}

          {estado.fase === "listo" ? (
            <>
              <p className="max-w-[65ch]">{estado.analisis.lectura}</p>
              {estado.analisis.puntos.length > 0 ? (
                <ul className="grid max-w-[65ch] list-disc gap-2 pl-5">
                  {estado.analisis.puntos.map((p) => <li key={p}>{p}</li>)}
                </ul>
              ) : null}
              {estado.analisis.salvedad !== "" ? (
                <p className="max-w-[65ch] text-tinta-meta">
                  <span className="text-tinta-dato">Lo que no dice: </span>
                  {estado.analisis.salvedad}
                </p>
              ) : null}
            </>
          ) : null}

          {/* Solo cuando hay una nota que leer: sobre una tarjeta sin enlace,
              «la escribe una maquina a partir de la nota» describiria algo que
              no ocurrio. */}
          {url === null ? null : (
            <p className="max-w-[65ch] border-t border-filo pt-4 text-meta text-tinta-meta">
              La escribe una máquina a partir de la nota de {medio}. Puede equivocarse y no
              sustituye leerla. No cuenta en las cifras de prensa.
            </p>
          )}
        </div>
      </dialog>
    </>
  );
}
