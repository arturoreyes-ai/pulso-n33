"use client";

import { Sparkle as IA } from "@phosphor-icons/react";
import { useId, useRef, useState } from "react";

import { clasesBoton } from "@/components/ui/clases";
import { EsqueletoFicha } from "@/components/ui/esqueleto-ficha";
import { EstadoCarga } from "@/components/ui/estado-carga";
import { IdeaRedes } from "@/components/ui/idea-redes";
import { VERSION_ANALISIS_PUBLICACION, type AnalisisPublicacion } from "@/lib/analisis/contrato-publicacion";
import type { SugerenciaSocial } from "@/lib/analisis/contrato";
import { NOMBRE_RED, type PublicacionVisual } from "@/lib/dominio/publicaciones";

/**
 * La lectura automatica de una publicacion, en la hoja del lector.
 *
 * GEMELO DELIBERADO de ahora/analisis-titular.tsx y no una generalizacion suya.
 * probar-analisis.cjs lee aquel archivo COMO TEXTO y afirma literales exactos
 * suyos; sacarlos a un componente compartido romperia esas pruebas sin que
 * cambie un solo comportamiento. La duplicacion sale mas barata que esa pelea,
 * y lo que si se comparte es lo que importa: la disciplina de que `abrir()` no
 * llama a nada.
 *
 * El boton y el cuerpo van SEPARADOS —`BotonAnalizar` en la tarjeta, `Ficha` en
 * la hoja— porque el visor monta una sola hoja para todo el recorrido: montar
 * un `<dialog>` por tarjeta serian noventa y ocho dialogos. Es la misma regla
 * que ya cumplen los comentarios en visor-redes.tsx.
 *
 * La ficha NO se pinta dentro de la tarjeta. Una tarjeta es un punto de ajuste
 * de altura fija y meterle prosa moveria el contenido bajo el dedo de quien
 * esta leyendo.
 *
 * `leidos` y `reportados` se pintan UNO AL LADO DEL OTRO y jamas divididos:
 * dividirlos seria un porcentaje sobre menos de treinta comentarios (regla 2) y
 * mezclaria dos mediciones distintas (regla 3).
 *
 * El rotulo dice solo «Generado con IA»: la interfaz dice que, nunca como.
 */

type Estado =
  | { fase: "quieto" }
  | { fase: "confirmar" }
  | { fase: "cargando" }
  | { fase: "listo"; analisis: AnalisisPublicacion }
  | { fase: "fallo"; mensaje: string };

const SIN_COMENTARIOS = "No hay comentarios disponibles para esta publicación.";

/**
 * La salvedad de muestreo es NUESTRA y es fija, no del modelo.
 *
 * El caso que lo decidio: se le pedia al modelo que dijera «esto no es lo que
 * piensa una ciudad», y esa frase, para ser correcta, tiene que NOMBRAR lo que
 * la regla prohibe —«la opinion publica», «la mayoria», «la gente»—. El
 * validador de reglas.ts la rechazaba entera y el lector veia «No se pudo hacer
 * la lectura»: cuatro de cada seis salvedades correctas morian asi. El
 * validador vigila AFIRMACIONES; una advertencia que las niega no puede vivir
 * bajo la misma prohibicion. Asi que el modelo ya no la escribe: dice solo que
 * no establece el material, y de esta advertencia se encarga la pagina, que
 * ademas asi no puede omitirla ni suavizarla. Es lo mismo que hace
 * chrome/pie.tsx con las cinco reglas.
 */
const SALVEDAD_FIJA = "Son los comentarios más votados de una publicación, no una muestra de nadie.";

/** El chip de la fila de acciones. Solo abre la hoja; no pide nada. */
export function BotonAnalizar({ onAbrir }: { onAbrir: () => void }) {
  return (
    <button type="button" className={clasesBoton(false)} onClick={onAbrir}>
      <IA size={16} aria-hidden />
      Analizar
    </button>
  );
}

export function FichaPublicacion({ fila }: { fila: PublicacionVisual }) {
  const solicitudEnCurso = useRef(false);
  const id = useId();
  const [estado, setEstado] = useState<Estado>(
    // Sin enlace canonico no hay nada que buscar en el corte, y se dice sin
    // pedir nada: la llamada es de pago.
    fila.url === null
      ? { fase: "fallo", mensaje: "Esta publicación no se puede leer desde aquí." }
      // El primer toque solo abre la confirmacion. La tarjeta vive en un
      // recorrido vertical y un roce accidental no debe costar una llamada.
      : { fase: "confirmar" },
  );

  async function analizar() {
    if (fila.url === null || solicitudEnCurso.current) return;
    solicitudEnCurso.current = true;
    setEstado({ fase: "cargando" });
    try {
      const params = new URLSearchParams({ v: VERSION_ANALISIS_PUBLICACION, r: fila.red, u: fila.url });
      const r = await fetch(`/api/analizar-publicacion?${params}`);
      if (!r.ok) {
        const cuerpo = (await r.json()) as unknown;
        setEstado({ fase: "fallo", mensaje: mensajeDeError(cuerpo) });
        return;
      }
      const cuerpo = (await r.json()) as unknown;
      const analisis = leerAnalisisPublicacion(cuerpo);
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
    <div className="grid gap-4 px-4 pt-6 pb-8 text-lectura text-tinta-prosa">
      <div className="max-w-[65ch]">
        <p className="text-meta text-tinta-meta">{fila.fuente} · {NOMBRE_RED[fila.red]}</p>
        <p className="mt-1 break-words font-titular text-rotulo text-tinta-titulo">
          {fila.post.titulo || "Publicación sin título"}
        </p>
      </div>

      {estado.fase === "confirmar" ? (
        <section aria-labelledby={`${id}-confirmacion`} className="grid max-w-[65ch] gap-4">
          <div className="grid gap-2">
            <h3 id={`${id}-confirmacion`} className="text-cuerpo text-tinta-dato">¿Analizar esta publicación con IA?</h3>
            <p className="text-tinta-meta">Confirma para generar la lectura, lo que se repite en los comentarios y una idea para redes.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={clasesBoton(true)} onClick={analizar}>
              <IA size={16} aria-hidden />
              Analizar con IA
            </button>
            {/* «Cancelar», como la hoja de una nota (ahora/analisis-titular.tsx). */}
            <button type="button" className={clasesBoton(false)} onClick={(e) => e.currentTarget.closest("dialog")?.close()}>
              Cancelar
            </button>
          </div>
        </section>
      ) : null}

      {estado.fase === "cargando" ? (
        <div className="aparicion-suave grid gap-6">
          <EstadoCarga etiqueta="Leyendo la publicación" />
          <EsqueletoFicha secciones={["Qué dice la publicación", "En los comentarios"]} caja="Idea para redes" />
        </div>
      ) : null}

      {estado.fase === "fallo" ? (
        <p role="status" className="aparicion-suave max-w-[65ch] text-baja">{estado.mensaje}</p>
      ) : null}

      {estado.fase === "listo" ? <div className="aparicion-suave grid gap-4"><Resultado id={id} a={estado.analisis} /></div> : null}
    </div>
  );
}

function mensajeDeError(valor: unknown): string {
  if (valor !== null && typeof valor === "object" && "mensaje" in valor && typeof valor.mensaje === "string") {
    return valor.mensaje;
  }
  return "No se pudo hacer la lectura.";
}

function Resultado({ id, a }: { id: string; a: AnalisisPublicacion }) {
  return (
    <>
      <section aria-labelledby={`${id}-lectura`} className="grid max-w-[65ch] gap-2 break-words">
        <h3 id={`${id}-lectura`} className="text-meta text-tinta-dato">Qué dice la publicación</h3>
        <p>{a.lectura}</p>
      </section>

      <section aria-labelledby={`${id}-conversacion`} className="grid max-w-[65ch] gap-2 break-words">
        <h3 id={`${id}-conversacion`} className="text-meta text-tinta-dato">En los comentarios</h3>
        {a.conversacion === null
          ? <p className="text-tinta-meta">{SIN_COMENTARIOS}</p>
          : <>
              <p>{a.conversacion}</p>
              {/* Los dos conteos, lado a lado y sin dividir. */}
              <p className="text-meta text-tinta-meta">
                Se leyeron {a.leidos} de los comentarios más votados. La plataforma reporta {a.reportados}.
              </p>
            </>}
      </section>

      <IdeaRedes id={id} s={a.sugerenciaSocial} />

      <section aria-labelledby={`${id}-salvedad`} className="grid max-w-[65ch] gap-2 break-words text-tinta-meta">
        <h3 id={`${id}-salvedad`} className="text-meta text-tinta-dato">Lo que no establece</h3>
        <p>{a.salvedad}</p>
        <p>{SALVEDAD_FIJA}</p>
      </section>

      <p className="max-w-[65ch] border-t border-filo pt-4 text-meta text-tinta-meta">
        Generado con IA.
      </p>
    </>
  );
}

function esSugerenciaSocial(valor: unknown): valor is SugerenciaSocial {
  if (valor === null || typeof valor !== "object") return false;
  const s = valor as Record<string, unknown>;
  return typeof s.formato === "string" && s.formato.trim() !== ""
    && typeof s.enfoque === "string" && s.enfoque.trim() !== ""
    && typeof s.gancho === "string" && s.gancho.trim() !== "";
}

/** Se revalida en cliente para que un `{codigo, mensaje}` no pueda confundirse
 *  con una ficha. */
function leerAnalisisPublicacion(valor: unknown): AnalisisPublicacion | null {
  if (valor === null || typeof valor !== "object") return null;
  const a = valor as Record<string, unknown>;
  if (
    typeof a.lectura !== "string" || a.lectura === ""
    || !(a.conversacion === null || (typeof a.conversacion === "string" && a.conversacion !== ""))
    || typeof a.salvedad !== "string" || a.salvedad === ""
    || typeof a.fuente !== "string"
    || (a.red !== "instagram" && a.red !== "tiktok")
    || typeof a.leidos !== "number" || typeof a.reportados !== "number"
    || !esSugerenciaSocial(a.sugerenciaSocial)
  ) return null;
  return {
    lectura: a.lectura,
    conversacion: a.conversacion as string | null,
    salvedad: a.salvedad,
    sugerenciaSocial: a.sugerenciaSocial,
    red: a.red,
    fuente: a.fuente,
    leidos: a.leidos,
    reportados: a.reportados,
  };
}
