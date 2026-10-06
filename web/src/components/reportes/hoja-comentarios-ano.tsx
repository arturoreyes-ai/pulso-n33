"use client";

import { ArrowSquareOut as Abrir, CaretRight as Seguir, ChatCircleText as Charla, X as Quitar } from "@phosphor-icons/react";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import useSWR from "swr";

import { VistaResumen, type TemaVisto } from "@/components/seguimiento/resumen-comentarios";
import { CifraTono } from "@/components/ui/cifra-tono";
import { clasesBoton } from "@/components/ui/clases";
import { EstadoCarga } from "@/components/ui/estado-carga";
import { Hoja } from "@/components/ui/hoja";
import { CON_COLUMNA_LIKES, LikesComentario } from "@/components/ui/likes-comentario";
import { serieTono } from "@/lib/dominio/consultas";
import { numero, pluralizar } from "@/lib/dominio/formato";
import type { ComentariosDePublicacion } from "@/lib/expedientes/comentarios";
import type { PublicacionDelMes, RedDelAno } from "@/lib/expedientes/expedientes";

/**
 * La hoja de UNA publicacion de «El año en redes»: lo que dicen sus
 * comentarios, como suenan y la lista, a un toque del mes.
 *
 * El caso, 5 de octubre de 2026: el cliente queria el resumen por publicacion
 * de «En redes» (que salio de la pagina ese dia) en el año, y un mes abierto
 * son tres columnas angostas donde ese resumen no cabe. La hoja es la del
 * tablero (ui/hoja.tsx: abajo en el telefono, al centro en escritorio), una
 * sola para todas las publicaciones, como la de comentarios del lector de
 * /redes: un <dialog> por publicacion serian 117.
 *
 * El texto no viaja en la pagina: la hoja lo pide al abrirse
 * (/api/expediente/comentarios), del archivo de texto que no va a git. El
 * tono va contado, con la salvedad del documento: la excepcion de consultas
 * y seguimiento a la regla 5, no una nueva.
 */

const NOMBRE: Record<RedDelAno, string> = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook" };
const LIKES: Record<RedDelAno, readonly [string, string]> = {
  tiktok: ["like", "likes"],
  instagram: ["like", "likes"],
  facebook: ["reacción", "reacciones"],
};

/** Lo que el boton le pasa a la hoja: la publicacion como ya se pinto en el
 *  mes, mas su cifra ya escrita («296,500 vistas»). */
export interface PublicacionAbierta extends PublicacionDelMes {
  red: RedDelAno;
  cifra: string;
}

type Respuesta = ({ disponible: true } & ComentariosDePublicacion) | { disponible: false };

const Contexto = createContext<((p: PublicacionAbierta) => void) | null>(null);

async function pedir(url: string): Promise<Respuesta> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(String(r.status));
  return r.json() as Promise<Respuesta>;
}

function Lista({ comentarios, likes, tema, alQuitar }: {
  comentarios: { clave: string; texto: string; likes: number }[];
  likes: readonly [string, string];
  tema: string | null;
  alQuitar: () => void;
}) {
  const columna = comentarios.some((c) => c.likes > 0);
  return (
    <section aria-labelledby="hoja-ano-lista" className="grid gap-4 border-t border-vela pt-6 aparicion-suave">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="hoja-ano-lista" className="text-cuerpo font-medium text-tinta-prosa">
          {tema === null ? "Los más votados primero" : <>Sobre «{tema}»</>}
        </h3>
        {tema === null ? null : (
          <button type="button" onClick={alQuitar} className={clasesBoton(false)}>
            <Quitar size={16} aria-hidden /> Ver todos
          </button>
        )}
      </div>
      <ol className="grid gap-3">
        {comentarios.map((c) => (
          <li key={c.clave} className={columna ? CON_COLUMNA_LIKES : ""}>
            {columna ? <LikesComentario n={c.likes} nombre={likes} /> : null}
            <p className="max-w-[60ch] break-words text-cuerpo text-tinta-prosa">{c.texto}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Contenido({ expediente, p, salvedad }: { expediente: string; p: PublicacionAbierta; salvedad: string }) {
  const clave = `/api/expediente/comentarios?e=${encodeURIComponent(expediente)}&u=${encodeURIComponent(p.url)}`;
  const { data, error } = useSWR(clave, pedir, { revalidateOnFocus: false, shouldRetryOnError: false });
  const [lista, setLista] = useState(false);
  const [tema, setTema] = useState<string | null>(null);
  const likes = LIKES[p.red];
  const t = p.tono;
  const conteo = t === undefined ? null : { positivo: t.positivo, negativo: t.negativo, neutral: t.neutral, sinTono: t.sin_clasificar + t.sin_modelo_idioma };

  // Entre el resumen y la lista, como en «En redes»: con la lista abierta
  // arriba, el tono quedaba cincuenta comentarios mas abajo.
  const tarjetaTono = conteo === null ? null : (
    <ul className="grid">
      <CifraTono rotulo="Tono de los comentarios" serie={serieTono(conteo, "m")} genero="m" unidad={["comentario", "comentarios", "Ningún comentario"]}>
        <p className="text-meta text-tinta-meta">{salvedad}</p>
      </CifraTono>
    </ul>
  );

  let cuerpo: ReactNode;
  if (data === undefined) {
    cuerpo = error === undefined ? <EstadoCarga etiqueta="Cargando comentarios" /> : <p className="text-cuerpo text-baja">No se pudieron cargar los comentarios.</p>;
  } else if (!data.disponible) {
    cuerpo = <p className="text-cuerpo text-tinta-meta">El texto de los comentarios no está disponible en esta vista.</p>;
  } else {
    const todos = data.comentarios.map((c, i) => ({ clave: String(i), texto: c.texto, likes: c.likes }));
    const temas: TemaVisto[] = (data.resumen?.temas ?? []).map((x) => ({
      nombre: x.nombre,
      detalle: x.detalle,
      comentarios: x.comentarios.flatMap((i) => (todos[i] === undefined ? [] : [todos[i]])),
    }));
    const deTema = tema === null ? null : temas.find((x) => x.nombre === tema) ?? null;
    cuerpo = (
      <div className="grid gap-6">
        {data.resumen === null ? (
          <p className="max-w-[60ch] text-cuerpo text-tinta-meta">
            {todos.length < 10 ? "Muy pocos comentarios para resumirlos; se leen abajo." : "Sin resumen de los comentarios de esta publicación."}
          </p>
        ) : (
          <VistaResumen
            id="hoja-ano-resumen"
            encabezado="h3"
            texto={data.resumen.texto}
            leidos={data.resumen.leidos}
            fecha={data.resumen.fecha}
            temas={temas}
            likes={likes}
            alVerTema={(nombre) => { setTema(nombre); setLista(true); }}
          />
        )}
        {tarjetaTono}
        {todos.length === 0 ? null : lista || data.resumen === null ? (
          <Lista comentarios={deTema?.comentarios ?? todos} likes={likes} tema={deTema?.nombre ?? null} alQuitar={() => setTema(null)} />
        ) : (
          <p>
            <button type="button" onClick={() => setLista(true)} className={clasesBoton(false)}>
              <Charla size={16} aria-hidden /> Ver los {numero(todos.length)} comentarios
            </button>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-8 px-5 pb-8 pt-2 sm:px-6">
      <header className="grid gap-3">
        <p className="text-meta text-tinta-meta">{NOMBRE[p.red]} · {p.propia ? "su cuenta" : p.cuenta}</p>
        <p className="text-balance text-lectura text-tinta-titulo">{p.titulo || "Sin texto"}</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <span className="font-mono text-cuerpo tabular-nums text-tinta-dato">{p.cifra}</span>
          <a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className={clasesBoton(false)}>
            <Abrir size={16} aria-hidden /> Abrir en {NOMBRE[p.red]}
          </a>
        </div>
      </header>
      {cuerpo}
      {data !== undefined && data.disponible ? null : tarjetaTono}
    </div>
  );
}

/** Envuelve la seccion: monta la hoja una vez y da a los botones con que
 *  abrirla. Lo de adentro sigue siendo del servidor. */
export function ProveedorHojaAno({ expediente, salvedad, children }: { expediente: string; salvedad: string; children: ReactNode }) {
  const hoja = useRef<HTMLDialogElement>(null);
  const [abierta, setAbierta] = useState<PublicacionAbierta | null>(null);
  function abrir(p: PublicacionAbierta) {
    setAbierta(p);
    hoja.current?.showModal();
  }
  return (
    <Contexto.Provider value={abrir}>
      {children}
      <Hoja ref={hoja} titulo="Comentarios" rotuloCerrar="Cerrar comentarios" onClose={() => setAbierta(null)}>
        {abierta === null ? null : <Contenido key={abierta.url} expediente={expediente} p={abierta} salvedad={salvedad} />}
      </Hoja>
    </Contexto.Provider>
  );
}

/** «N comentarios ›» bajo una publicacion del mes. */
export function BotonComentariosAno({ publicacion }: { publicacion: PublicacionAbierta }) {
  const abrir = useContext(Contexto);
  const n = publicacion.cosechados;
  if (n === 0 || abrir === null) return null;
  return (
    <button type="button" onClick={() => abrir(publicacion)}
      className="inline-flex items-center gap-1 justify-self-start text-meta text-tinta-dato transition-colors duration-[var(--dur-toque)] hover:text-tinta-titulo">
      <Charla size={14} aria-hidden /> {numero(n)} {pluralizar(n, "comentario", "comentarios")}
      <Seguir size={12} aria-hidden />
    </button>
  );
}
