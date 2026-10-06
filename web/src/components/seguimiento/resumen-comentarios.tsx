"use client";

import { ArrowDown as Bajar, Sparkle as IA } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";

import { Bisel } from "@/components/ui/bisel";
import { clasesBoton } from "@/components/ui/clases";
import { EstadoCarga } from "@/components/ui/estado-carga";
import { CON_COLUMNA_LIKES as CON_COLUMNA, LikesComentario as Likes } from "@/components/ui/likes-comentario";
import { Chip } from "@/components/ui/primitivas";
import { numero, pluralizar } from "@/lib/dominio/formato";
import type { RespuestaSeguimiento, TemaComentarios } from "@/lib/seguimiento/contrato";
import { SALVEDAD_RESUMEN, momento, nombreLikes, ordenarComentarios } from "@/lib/seguimiento/formato";
import { useResumir } from "@/lib/seguimiento/use-seguimiento";

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
 *
 * Vivia dentro de ficha-seguimiento.tsx. Salio el 2 de octubre de 2026 porque
 * el expediente de /reportes abre cada publicacion por aqui y no por la lista
 * de comentarios (cliente: «en vez de mostrar cada comentario, un resumen de
 * lo que dice la gente»). El 5 de octubre se partio en dos: `VistaResumen`
 * pinta un resumen cualquiera y `ResumenComentarios` es la de /seguimiento,
 * con su boton de pedirlo. La hoja de «El año en redes» usa la vista con
 * resumenes escritos de antemano (reportes/hoja-comentarios-ano.tsx): el
 * mismo gesto no puede verse distinto en dos pantallas.
 */

/** Cuantos comentarios de un tema se asoman antes de ir a la lista: los de
 *  mas likes, como las resenas bajo un tema de Amazon. */
const ASOMAN_POR_TEMA = 3;

/** Un tema de un resumen, con sus comentarios ya resueltos. `clave` solo es la
 *  llave de React. */
export interface TemaVisto {
  nombre: string;
  detalle: string;
  comentarios: { clave: string; texto: string; likes: number }[];
}

/** Un tema abierto: lo que se dice de el y sus comentarios de mas likes,
 *  recortados a tres renglones, y el paso a la lista entera. Separado por un
 *  filo y no en otra caja: una tarjeta dentro de la tarjeta. */
function TemaAbierto({ tema, likes, alVerTodos }: { tema: TemaVisto; likes: readonly [string, string]; alVerTodos?: () => void }) {
  const suyos = ordenarComentarios(tema.comentarios, "likes");
  const columna = suyos.some((c) => c.likes > 0);
  return (
    <div className="grid gap-4 border-t border-vela pt-4 aparicion-suave">
      <p className="max-w-[60ch] text-lectura text-tinta-dato">{tema.detalle}</p>
      <ul className="grid gap-3">
        {suyos.slice(0, ASOMAN_POR_TEMA).map((c) => (
          <li key={c.clave} className={columna ? CON_COLUMNA : ""}>
            {columna ? <p className="text-cuerpo"><Likes n={c.likes} nombre={likes} /></p> : null}
            <blockquote className="line-clamp-3 max-w-[60ch] break-words text-cuerpo text-tinta-prosa">{c.texto}</blockquote>
          </li>
        ))}
      </ul>
      {alVerTodos !== undefined && suyos.length > ASOMAN_POR_TEMA ? (
        <p>
          <button type="button" onClick={alVerTodos} className={clasesBoton(false)}>
            Ver los {numero(suyos.length)} comentarios <Bajar size={16} aria-hidden />
          </button>
        </p>
      ) : null}
    </div>
  );
}

/** Un resumen ya escrito, venga de donde venga. `accion` va bajo los temas
 *  (el «Rehacer el resumen» de /seguimiento); `alVerTema` hace aparecer el
 *  «Ver los N» de cada tema. */
export function VistaResumen({ id, encabezado: Encabezado = "h2", texto, leidos, fecha, temas, likes, alVerTema, accion }: {
  id: string;
  encabezado?: "h2" | "h3" | "h4";
  texto: string;
  leidos: number;
  fecha: string;
  temas: readonly TemaVisto[];
  likes: readonly [string, string];
  alVerTema?: (nombre: string) => void;
  accion?: ReactNode;
}) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const tema = temas.find((t) => t.nombre === abierto) ?? null;
  return (
    <section aria-labelledby={id}>
      <Bisel nivel="panel" interior="grid gap-5 p-4 sm:p-6">
        <Encabezado id={id} className="text-cuerpo font-medium text-tinta-prosa">Lo que dicen los comentarios</Encabezado>
        <p className="max-w-[60ch] break-words text-pretty text-lectura font-normal text-tinta-titulo aparicion-suave sm:text-rotulo sm:font-normal">{texto}</p>
        {temas.length > 0 ? (
          <div className="grid gap-4">
            <div role="group" aria-label="Temas que reaparecen" className="flex flex-wrap gap-2">
              {temas.map((t) => (
                <Chip key={t.nombre} activo={abierto === t.nombre} onClick={() => setAbierto((a) => (a === t.nombre ? null : t.nombre))} cuenta={t.comentarios.length}>
                  {t.nombre}
                </Chip>
              ))}
            </div>
            {tema === null ? null : (
              <TemaAbierto tema={tema} likes={likes} alVerTodos={alVerTema === undefined ? undefined : () => alVerTema(tema.nombre)} />
            )}
          </div>
        ) : null}
        {accion}
        <div className="grid gap-1 text-meta text-tinta-meta">
          <p className="flex items-start gap-2">
            <IA size={14} aria-hidden className="mt-px shrink-0" />
            <span>Generado con IA a partir del texto de {numero(leidos)} {pluralizar(leidos, "comentario", "comentarios")} · {momento(fecha)}</span>
          </p>
          <p>{SALVEDAD_RESUMEN}</p>
        </div>
      </Bisel>
    </section>
  );
}

export function ResumenComentarios({ datos, alResumir, alVerTema, id = "seguimiento-resumen", encabezado: Encabezado = "h2" }: {
  datos: RespuestaSeguimiento;
  alResumir: () => Promise<unknown>;
  alVerTema: (t: TemaComentarios) => void;
  /** Unico por pagina: el expediente monta uno por publicacion abierta. */
  id?: string;
  encabezado?: "h2" | "h4";
}) {
  const resumir = useResumir();
  const r = datos.resumen;
  if (r === null && !datos.resumible) return null;
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
  if (r === null) {
    return (
      <section aria-labelledby={id}>
        <Bisel nivel="panel" interior="grid gap-5 p-4 sm:p-6">
          <Encabezado id={id} className="text-cuerpo font-medium text-tinta-prosa">Lo que dicen los comentarios</Encabezado>
          {boton("Resumir comentarios")}
        </Bisel>
      </section>
    );
  }
  const temasSeguimiento = r.temas ?? [];
  const temas: TemaVisto[] = temasSeguimiento.map((t) => ({
    nombre: t.nombre,
    detalle: t.detalle,
    comentarios: datos.comentarios.filter((c) => t.huellas.includes(c.huella)).map((c) => ({ clave: c.huella, texto: c.texto, likes: c.likes })),
  }));
  return (
    <VistaResumen
      id={id}
      encabezado={Encabezado}
      texto={r.texto}
      leidos={r.leidos}
      fecha={r.fecha}
      temas={temas}
      likes={nombreLikes(datos.publicacion.red)}
      alVerTema={(nombre) => {
        const t = temasSeguimiento.find((x) => x.nombre === nombre);
        if (t !== undefined) alVerTema(t);
      }}
      accion={r.temas === null && datos.resumible ? boton("Rehacer el resumen") : null}
    />
  );
}
