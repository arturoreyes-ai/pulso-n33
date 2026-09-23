"use client";

import { CaretDown as Desplegar, Sparkle as IA } from "@phosphor-icons/react";
import { useId, useState } from "react";
import useSWRImmutable from "swr/immutable";

import { clasesBoton } from "@/components/ui/clases";
import { EstadoCarga } from "@/components/ui/estado-carga";
import { VERSION_RESUMEN_TIKTOK, type ResumenTikTok } from "@/lib/analisis/contrato-publicacion";
import { rotuloRegion, type CubetaRegion } from "@/lib/dominio/publicaciones";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";

/**
 * «Resumen con IA»: lo primero de la pestana TikTok, PLEGADO, con los videos
 * justo debajo. Es el patron de la busqueda de TikTok, que el cliente mando el
 * 23 de septiembre de 2026: titulo, «Resumen con IA de…», la entrada entera, el
 * primer asunto desvaneciendose y «Ver más». Menos la seccion de usuarios.
 *
 * Tercera forma del mismo dia, y conviene saber por que las otras dos no:
 *  - Una TARJETA A PANTALLA COMPLETA, la primera del recorrido. El primer
 *    video quedaba a un gesto entero; el cliente: «la prioridad son los
 *    TikToks».
 *  - Una FRANJA de una linea encima de la caja, con el resto en un panel
 *    flotante. Resolvia la prioridad, pero era un mecanismo propio —una
 *    capa encima de los videos— para algo que TikTok resuelve con el flujo
 *    de la pagina.
 * Ahora es un punto de ajuste mas del recorrido, del alto de su CONTENIDO y no
 * de la caja (`.resumen-recorrido` en globals.css): plegado mide lo que la
 * entrada y el desvanecido, y el primer video asoma debajo en la misma
 * pantalla, montado y en pausa (`PRECARGA` de visor-redes.tsx), a un gesto de
 * reproducirse. «Ver más» lo despliega EN SU LUGAR y empuja los videos, como
 * en TikTok; desplegado puede medir mas que la caja, y un punto de ajuste mas
 * alto que el visor se recorre libremente, que es lo que ya hace la ficha de
 * un termino.
 *
 * PLEGADO NO ES OCULTO A MEDIAS. Lo que queda bajo el desvanecido lleva
 * `inert`: sin eso, el tabulador entraria a una pastilla recortada y el
 * navegador desplazaria la caja recortada para mostrarla. La entrada queda
 * fuera del `inert`, porque es lo que el pliegue deja leer.
 *
 * SIN SALVEDADES EN PANTALLA, a pedido del cliente ese dia: ni la del modelo
 * («que no establece el material») ni la fija que ponia la pagina. La del
 * modelo sigue en la respuesta y reglas.ts la sigue vigilando; no se pinta.
 * Lo que queda diciendo que es esto es «Generado con IA» y la forma de cada
 * vineta, que el prompt obliga a atribuir («un video dice…»).
 *
 * SE PIDE AL MONTARSE, sin boton, por decision del cliente. Dos cosas la
 * mantienen barata: el CDN guarda la respuesta seis horas por lugar y corte
 * (`g` es el `generado` del archivo), y SWR la guarda en la pestana, asi que
 * cambiar el orden o volver de otra red —que remontan el recorrido— no la
 * vuelve a pedir. Sin `shouldRetryOnError: false` SWR reintentaria sola una
 * llamada de pago.
 *
 * Cada fuente es un boton que lleva a SU tarjeta en el recorrido, no un enlace
 * a TikTok: el video esta aqui abajo. Solo si no esta (el recorrido cambio) se
 * abre el original.
 */

/** La pastilla de una fuente: un paso mas chica que `clasesBoton`, porque va
 *  bajo cada vineta y hay varias, pero con los 44px de alto del blanco de
 *  toque (ui/clases.ts dice por que 44). No se le agregan clases a
 *  `clasesBoton`: dos utilidades del mismo tipo las decide el orden del CSS,
 *  no el de la cadena. */
const CLASES_FUENTE = [
  "inline-flex min-h-11 items-center justify-center rounded-full bg-vela px-4 text-meta text-tinta-prosa",
  "transition-colors duration-[var(--dur-cambio)] ease-firma hover:bg-filo hover:text-tinta-titulo",
].join(" ");

/** Cuantos creadores se nombran junto al titulo antes del «+N». */
const CREADORES_VISIBLES = 3;

type Respuesta = { fase: "listo"; resumen: ResumenTikTok } | { fase: "fallo"; mensaje: string };

export function ResumenTikTokBloque({ zona, cubeta, generado, irA }: {
  zona: ZonaRuta | null;
  cubeta: CubetaRegion;
  /** El corte del archivo: separa copias en el CDN y en SWR. */
  generado: string;
  /** Lleva el recorrido a la tarjeta de esa `clave`; false si no esta. */
  irA: (clave: string) => boolean;
}) {
  const id = useId();
  // Plegado de entrada, siempre: el cliente lo pidio asi. Un remontaje (otro
  // orden, otra pestana) lo vuelve a plegar, que es lo que se quiere.
  const [abierto, setAbierto] = useState(false);
  const params = new URLSearchParams({ v: VERSION_RESUMEN_TIKTOK, z: zona ?? "", c: cubeta, g: generado });
  const { data, error, mutate, isValidating } = useSWRImmutable<Respuesta>(
    `/api/resumen-tiktok?${params}`, pedirResumen, { shouldRetryOnError: false });
  const cargando = (data === undefined && error === undefined) || isValidating;
  const falla = error !== undefined ? "No se pudo preparar el resumen." : data?.fase === "fallo" ? data.mensaje : null;
  const resumen = !cargando && data?.fase === "listo" ? data.resumen : null;
  // El titulo es el LUGAR, no la consulta: la busqueda de TikTok titula con lo
  // que se escribio, y aqui la consulta es mecanismo que la UI no nombra.
  const titulo = zona === null ? rotuloRegion(cubeta) : NOMBRE_CORTO[zona];

  return (
    <section aria-labelledby={`${id}-titulo`} className="mx-auto grid w-full max-w-[72ch] gap-4 text-lectura text-tinta-prosa">
      <header className="grid gap-1">
        <h2 id={`${id}-titulo`} className="flex items-center gap-2 text-rotulo text-tinta-titulo">
          <IA size={22} weight="light" aria-hidden className="shrink-0" />
          {titulo}
        </h2>
        <p className="text-meta text-tinta-meta">
          Resumen con IA{resumen === null ? "" : ` de ${creadores(resumen)}`}
        </p>
      </header>

      {cargando ? <EstadoCarga etiqueta="Resumiendo los videos" /> : null}

      {!cargando && falla !== null ? (
        <div className="grid justify-items-start gap-3">
          <p role="status" className="text-baja">{falla}</p>
          <button type="button" className={clasesBoton(false)} onClick={() => void mutate()}>Reintentar</button>
        </div>
      ) : null}

      {resumen === null ? null : (
        <>
          <p className="break-words text-tinta-titulo">{resumen.entrada}</p>
          <div id={id} inert={!abierto} className={abierto ? "grid gap-6" : "pliegue-resumen grid gap-6"}>
            {resumen.secciones.map((seccion, i) => (
              <Seccion key={i} seccion={seccion} fuentes={resumen.fuentes} irA={irA} />
            ))}
            <p className="border-t border-filo pt-3 text-meta text-tinta-meta">Generado con IA.</p>
          </div>
          <div>
            <button type="button" className={clasesBoton(false)} aria-expanded={abierto} aria-controls={id}
              onClick={() => setAbierto((a) => !a)}>
              {abierto ? "Ver menos" : "Ver más"}
              <Desplegar size={16} aria-hidden className={abierto ? "rotate-180" : undefined} />
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function Seccion({ seccion, fuentes, irA }: {
  seccion: ResumenTikTok["secciones"][number];
  fuentes: ResumenTikTok["fuentes"];
  irA: (clave: string) => boolean;
}) {
  return (
    <section className="grid gap-3">
      <h3 className="text-cuerpo font-medium text-tinta-titulo">{seccion.titulo}</h3>
      <ul className="grid list-disc gap-4 pl-5">
        {seccion.puntos.map((punto, j) => (
          <li key={j} className="break-words">
            {punto.texto}
            <span className="mt-2 flex flex-wrap gap-2">
              {punto.fuentes.map((n) => {
                const fuente = fuentes[n];
                return fuente === undefined ? null : (
                  <button key={n} type="button" className={CLASES_FUENTE}
                    aria-label={`Ir al video de ${fuente.fuente}`}
                    onClick={() => {
                      if (!irA(`tiktok:${fuente.url}`)) window.open(fuente.url, "_blank", "noopener,noreferrer");
                    }}>
                    {fuente.fuente}
                  </button>
                );
              })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** «@a · @b · @c +2»: los creadores citados, sin repetir, del mas popular al
 *  menos, que es el orden en que llegan. */
function creadores(resumen: ResumenTikTok): string {
  const unicos = [...new Set(resumen.fuentes.map((f) => f.fuente))];
  const resto = unicos.length - CREADORES_VISIBLES;
  return unicos.slice(0, CREADORES_VISIBLES).join(" · ") + (resto > 0 ? ` +${resto}` : "");
}

async function pedirResumen(url: string): Promise<Respuesta> {
  const r = await fetch(url);
  const cuerpo = (await r.json()) as unknown;
  const resumen = leerResumen(cuerpo);
  return resumen !== null ? { fase: "listo", resumen } : { fase: "fallo", mensaje: mensajeDeError(cuerpo) };
}

function mensajeDeError(valor: unknown): string {
  if (valor !== null && typeof valor === "object" && "mensaje" in valor && typeof valor.mensaje === "string") {
    return valor.mensaje;
  }
  return "No se pudo preparar el resumen.";
}

/** Estricto a proposito, como leerAnalisisConversacion: una respuesta con otra
 *  forma se pinta como fallo, nunca a medias. `salvedad` se exige aunque no se
 *  pinte: es parte del contrato de la ruta, y una respuesta sin ella es una
 *  respuesta que no paso por el mismo camino. */
function leerResumen(valor: unknown): ResumenTikTok | null {
  if (valor === null || typeof valor !== "object") return null;
  const a = valor as Record<string, unknown>;
  if (typeof a.entrada !== "string" || a.entrada === "" || typeof a.salvedad !== "string" || a.salvedad === ""
    || typeof a.videos !== "number" || !Array.isArray(a.fuentes) || !Array.isArray(a.secciones)) return null;
  const fuentes = a.fuentes.filter((f): f is { url: string; fuente: string } =>
    f !== null && typeof f === "object" && typeof (f as Record<string, unknown>).url === "string"
    && typeof (f as Record<string, unknown>).fuente === "string");
  if (fuentes.length !== a.fuentes.length) return null;
  const secciones: ResumenTikTok["secciones"] = [];
  for (const s of a.secciones as unknown[]) {
    if (s === null || typeof s !== "object") return null;
    const { titulo, puntos } = s as Record<string, unknown>;
    if (typeof titulo !== "string" || !Array.isArray(puntos)) return null;
    const leidos: ResumenTikTok["secciones"][number]["puntos"] = [];
    for (const p of puntos as unknown[]) {
      if (p === null || typeof p !== "object") return null;
      const { texto, fuentes: citas } = p as Record<string, unknown>;
      if (typeof texto !== "string" || !Array.isArray(citas) || !citas.every((n) => Number.isInteger(n))) return null;
      leidos.push({ texto, fuentes: citas as number[] });
    }
    secciones.push({ titulo, puntos: leidos });
  }
  if (secciones.length === 0) return null;
  return { entrada: a.entrada, salvedad: a.salvedad, videos: a.videos, fuentes, secciones };
}
