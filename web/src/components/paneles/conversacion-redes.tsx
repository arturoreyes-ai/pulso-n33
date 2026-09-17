"use client";

import { ChatsCircle as Hablar, Sparkle as IA, X as Cerrar } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";

import { CONTROL } from "@/components/lector/lector";
import { clasesChip } from "@/components/ui/clases";
import { useRedes, useTikTok } from "@/lib/datos/hooks";
import type { DocRedes } from "@/lib/datos/tipos";
import { VERSION_ANALISIS_CONVERSACION, type AnalisisConversacion } from "@/lib/analisis/contrato-publicacion";
import { seleccionarPublicaciones, type CubetaRegion, type RedVisual } from "@/lib/dominio/publicaciones";
import { numero, pluralizar } from "@/lib/dominio/formato";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";

/**
 * «De qué se habla»: los comentarios de toda la seleccion, no de una tarjeta.
 *
 * DOS MEDICIONES, UNA AL LADO DE LA OTRA, y esa es la forma de la hoja. Arriba
 * van los conteos que el pipeline ya calcula gratis en cada corrida con el
 * modelo local, que ademas viven en git y por tanto tienen historico. Debajo,
 * detras de un boton, la lectura de un modelo de pago. No se funden en una
 * cifra ni la segunda sustituye a la primera: son dos maneras distintas de
 * mirar el mismo texto, y la distancia entre ellas es informacion. Es la regla
 * 3 de PRODUCT.md aplicada a algo que no es prensa contra comentarios.
 *
 * Los conteos NO son porcentajes y no se pueden dividir: `opinion` y
 * `reportados` miden cosas distintas —lo que se leyo y lo que la plataforma
 * dice tener—, y su cociente seria una tasa de muestreo que nadie midio.
 *
 * El boton se pinta aunque la lectura automatica este apagada: sin ella la
 * hoja sigue diciendo los conteos, que es lo que costaba cero desde el
 * principio y no tenia pantalla.
 */

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
const SALVEDAD_FIJA = "Son los comentarios más votados de las publicaciones de las últimas 24 horas, no una muestra de ninguna ciudad.";

type Estado =
  | { fase: "quieto" }
  | { fase: "cargando" }
  | { fase: "listo"; analisis: AnalisisConversacion }
  | { fase: "fallo"; mensaje: string };

/** Lo que el pipeline ya sabe de la seleccion, sumado en el cliente sobre las
 *  MISMAS publicaciones que el visor pinta y que la ruta lee. */
interface Conteos {
  publicaciones: number;
  opinion: number;
  reportados: number;
  positivo: number;
  negativo: number;
  neutral: number;
  sinModelo: number;
}

/** Los documentos llegan EMPAREJADOS con su red, no en un arreglo posicional:
 *  `seleccionarPublicaciones` reparte por cuenta solo en Instagram, asi que
 *  perder de vista cual es cual sumaria sobre una seleccion distinta de la que
 *  el visor pinta, que es justo lo que el comentario de arriba promete. */
function sumar(
  docs: readonly (readonly [RedVisual, DocRedes | undefined])[],
  zona: string | null,
  cubeta: CubetaRegion,
): Conteos {
  const c: Conteos = { publicaciones: 0, opinion: 0, reportados: 0, positivo: 0, negativo: 0, neutral: 0, sinModelo: 0 };
  for (const [red, d] of docs) {
    if (!d) continue;
    for (const post of seleccionarPublicaciones(d, zona, red, cubeta)) {
      c.publicaciones += 1;
      c.opinion += post.opinion;
      c.reportados += post.comentarios;
      c.positivo += post.sentimiento.positivo;
      c.negativo += post.sentimiento.negativo;
      c.neutral += post.sentimiento.neutral;
      c.sinModelo += post.sentimiento.sin_modelo_idioma;
    }
  }
  return c;
}

export function ConversacionRedes({ zona, cubeta, analisis }: {
  zona: ZonaRuta | null;
  cubeta: CubetaRegion;
  analisis: boolean;
}) {
  const hoja = useRef<HTMLDialogElement>(null);
  const [turno, setTurno] = useState(0);
  const solicitudEnCurso = useRef(false);
  const id = useId();
  const [estado, setEstado] = useState<Estado>({ fase: "quieto" });
  const instagram = useRedes();
  const tiktok = useTikTok();
  const conteos = sumar([["instagram", instagram.data], ["tiktok", tiktok.data]] as const, zona, cubeta);
  const lugar = zona === null ? "Toda la región" : NOMBRE_CORTO[zona];

  // El turno, no el estado: abrir, cerrar y volver a pulsar tiene que volver a
  // abrir. Ver visor-redes.tsx, donde el mismo fallo dejaba la hoja muerta.
  useEffect(() => {
    if (turno > 0) hoja.current?.showModal();
  }, [turno]);

  // Cambiar de lugar o de ambito invalida la lectura: hablaba de otra cosa.
  useEffect(() => {
    setEstado({ fase: "quieto" });
  }, [zona, cubeta]);

  async function leer() {
    if (solicitudEnCurso.current) return;
    solicitudEnCurso.current = true;
    setEstado({ fase: "cargando" });
    try {
      const params = new URLSearchParams({ v: VERSION_ANALISIS_CONVERSACION, z: zona ?? "", c: cubeta });
      const r = await fetch(`/api/analizar-conversacion?${params}`);
      const cuerpo = (await r.json()) as unknown;
      const leido = leerAnalisisConversacion(cuerpo);
      if (leido !== null) {
        setEstado({ fase: "listo", analisis: leido });
      } else {
        const mensaje = cuerpo !== null && typeof cuerpo === "object" && "mensaje" in cuerpo
          && typeof cuerpo.mensaje === "string" ? cuerpo.mensaje : "No se pudo hacer la lectura.";
        setEstado({ fase: "fallo", mensaje });
      }
    } catch {
      setEstado({ fase: "fallo", mensaje: "No se pudo hacer la lectura." });
    } finally {
      solicitudEnCurso.current = false;
    }
  }

  return (
    <>
      <button type="button" className={CONTROL} aria-label="De qué se habla" aria-haspopup="dialog"
        onClick={() => setTurno((t) => t + 1)}>
        <Hablar size={22} aria-hidden />
      </button>

      <dialog ref={hoja} className="dialogo-lector" aria-labelledby={`${id}-titulo`}>
        <div className="cabecera-dialogo-lector">
          <h2 id={`${id}-titulo`} className="text-rotulo text-tinta-titulo">De qué se habla</h2>
          <button type="button" className={CONTROL} aria-label="Cerrar" onClick={() => hoja.current?.close()}>
            <Cerrar size={20} aria-hidden />
          </button>
        </div>

        <div className="grid gap-6 px-4 pt-6 pb-8 text-lectura text-tinta-prosa">
          <p className="text-meta text-tinta-meta">{lugar}</p>

          {conteos.publicaciones === 0 ? (
            <p className="max-w-[65ch] text-tinta-meta">
              No hay publicaciones en esta selección. Es un hueco, no un cero.
            </p>
          ) : (
            <>
              <Conteo c={conteos} id={id} />
              {analisis ? <Lectura id={id} estado={estado} onLeer={leer} /> : null}
            </>
          )}
        </div>
      </dialog>
    </>
  );
}

/** Los conteos del modelo local. Enteros y nunca un porcentaje: con este
 *  volumen por publicacion una proporcion se mueve con un comentario. */
function Conteo({ c, id }: { c: Conteos; id: string }) {
  return (
    <section aria-labelledby={`${id}-conteo`} className="grid max-w-[65ch] gap-2">
      <h3 id={`${id}-conteo`} className="text-meta text-tinta-dato">Cómo suenan los comentarios</h3>
      <p className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
        <span className="text-baja">negativo {numero(c.negativo)}</span>
        <span className="text-tinta-meta">neutral {numero(c.neutral)}</span>
        <span className="text-sube">positivo {numero(c.positivo)}</span>
      </p>
      {c.sinModelo === 0 ? null : (
        <p className="text-meta text-tinta-meta">
          {numero(c.sinModelo)} en un idioma que el analizador no lee, sin clasificar.
        </p>
      )}
      {/* Los dos números van al lado, jamás divididos. */}
      <p className="text-meta text-tinta-meta">
        Se leyeron {numero(c.opinion)} {pluralizar(c.opinion, "comentario", "comentarios")} de {numero(c.publicaciones)}{" "}
        {pluralizar(c.publicaciones, "publicación", "publicaciones")}. Las plataformas reportan {numero(c.reportados)}.
      </p>
      <p className="text-meta text-tinta-meta">
        Mide cómo suena cada frase, no la postura de nadie hacia una persona.
      </p>
    </section>
  );
}

function Lectura({ id, estado, onLeer }: { id: string; estado: Estado; onLeer: () => void }) {
  return (
    <section aria-labelledby={`${id}-lectura`} className="grid max-w-[65ch] gap-3 border-t border-filo pt-6">
      <h3 id={`${id}-lectura`} className="text-meta text-tinta-dato">Qué se repite</h3>

      {estado.fase === "quieto" ? (
        <>
          <p className="text-tinta-meta">Genera una lectura de los comentarios de esta selección.</p>
          <div>
            <button type="button" className={clasesChip(true)} onClick={onLeer}>
              <IA size={16} weight="light" aria-hidden className="shrink-0 self-center" />
              Leer con IA
            </button>
          </div>
        </>
      ) : null}

      {estado.fase === "cargando" ? <p role="status" className="text-tinta-meta">Leyendo los comentarios…</p> : null}
      {estado.fase === "fallo" ? <p role="status" className="text-baja">{estado.mensaje}</p> : null}

      {estado.fase === "listo" ? (
        <>
          <p className="break-words">{estado.analisis.lectura}</p>
          {/* Las dos cifras, porque casi nunca coinciden: el texto solo existe
              para algunas publicaciones, y decirlo es rotular el hueco. */}
          <p className="text-meta text-tinta-meta">
            De {numero(estado.analisis.leidos)} {pluralizar(estado.analisis.leidos, "comentario", "comentarios")}{" "}
            de los más votados, en {numero(estado.analisis.publicacionesConTexto)} de las{" "}
            {numero(estado.analisis.publicaciones)} publicaciones de esta selección.
          </p>
          <p className="break-words text-tinta-meta">{estado.analisis.salvedad}</p>
          <p className="break-words text-tinta-meta">{SALVEDAD_FIJA}</p>
          <p className="border-t border-filo pt-3 text-meta text-tinta-meta">Generado con IA.</p>
        </>
      ) : null}
    </section>
  );
}

function leerAnalisisConversacion(valor: unknown): AnalisisConversacion | null {
  if (valor === null || typeof valor !== "object") return null;
  const a = valor as Record<string, unknown>;
  if (
    typeof a.lectura !== "string" || a.lectura === ""
    || typeof a.salvedad !== "string" || a.salvedad === ""
    || typeof a.leidos !== "number" || typeof a.publicaciones !== "number"
    || typeof a.publicacionesConTexto !== "number" || typeof a.reportados !== "number"
  ) return null;
  return {
    lectura: a.lectura,
    salvedad: a.salvedad,
    leidos: a.leidos,
    publicaciones: a.publicaciones,
    publicacionesConTexto: a.publicacionesConTexto,
    reportados: a.reportados,
  };
}
