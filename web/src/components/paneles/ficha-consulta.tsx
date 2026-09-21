"use client";

import { DownloadSimple as Descargar, MagnifyingGlass as Lupa } from "@phosphor-icons/react";

import { clasesChip } from "@/components/ui/clases";
import { Hueco } from "@/components/ui/primitivas";
import type { BloqueRedConsulta, Consulta, DocConsultas, RedConsulta, RedSinDatoConsulta, ResultadoPrensaConsulta, TonoTitular } from "@/lib/datos/tipos";
import { frasesConsulta, NOMBRE_TONO_TITULAR, rotuloVentana, rutaDeBusquedaEnVivo } from "@/lib/dominio/consultas";
import { fechaConAnio, fechaLarga, numero, pluralizar } from "@/lib/dominio/formato";
import { NOMBRE_RED } from "@/lib/dominio/publicaciones";
import { rutaDeInforme } from "@/lib/informe/contrato";

/**
 * La ficha de un termino en seguimiento: la PRIMERA tarjeta del recorrido de
 * su busqueda, antes de las publicaciones.
 *
 * Dice que se esta viendo y que no afirma, en el registro de PRODUCT.md:
 * conteos y nunca porcentajes (una publicacion tiene entre 1 y 20 comentarios,
 * debajo del piso de 30); «sin dato» donde no se leyo, nunca cero; la prensa y
 * los comentarios uno al lado del otro, sin sumarse; y el tono como conteos con
 * la salvedad que viene EN EL DATO (`salvedad_tono`), que aqui se pinta tal
 * cual porque el validador del pipeline la exige palabra por palabra. Es la
 * decision del cliente del 18 de septiembre de 2026 sobre la regla 5, y esta
 * ficha es donde se lee.
 *
 * Dos ventanas, dichas las dos: redes 30 dias, prensa seis meses. La prensa
 * trae el tono de cada titular (favorable | adversa | neutral, el vocabulario
 * del muro) y de que medio viene cada uno; los titulares anteriores a la
 * ventana van aparte, con fecha, porque esconderlos seria perder lo que el
 * buscador del medio ya devolvio. Arriba de todo, «En resumen»: las frases
 * que lib/dominio/consultas.ts::frasesConsulta saca de los conteos, sin «la
 * mayoria» ni un porcentaje.
 *
 * Donde una plataforma no se leyo dice solo «sin dato», sin explicar por que
 * (pedido del cliente del mismo dia: la pantalla no explica el mecanismo ni
 * para decir lo que no hace). El enlace de un titular del buscador de
 * noticias es opaco y se abre tal cual; el de un titular del buscador del
 * medio es la nota en el sitio del medio. «Descargar PDF» va a la ruta del
 * informe, que se arma en el servidor con estos mismos datos.
 */

const NOMBRE_TIPO: Record<Consulta["tipo"], string> = {
  persona: "persona", empresa: "empresa", tema: "tema",
};

const REDES: readonly RedConsulta[] = ["instagram", "tiktok", "facebook"];
const SIN_DATO: readonly RedSinDatoConsulta[] = ["youtube", "x"];
const NOMBRE_SIN_DATO: Record<RedSinDatoConsulta, string> = { youtube: "YouTube", x: "X" };

const CLASE_TONO: Record<TonoTitular, string> = {
  favorable: "text-sube", adversa: "text-baja", neutral: "text-tinta-meta",
};

function FilaRed({ nombre, bloque }: { nombre: string; bloque: BloqueRedConsulta }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-vela py-2 text-cuerpo last:border-0">
      <span className="min-w-[6rem] text-tinta-dato">{nombre}</span>
      {bloque.estado === "sin_dato" ? (
        <Hueco>sin dato</Hueco>
      ) : bloque.estado !== "ok" && bloque.publicaciones === 0 ? (
        <Hueco>no disponible</Hueco>
      ) : (
        <span className="ml-auto flex flex-wrap gap-x-3 tabular-nums text-tinta-titulo">
          <span>{numero(bloque.publicaciones)} {pluralizar(bloque.publicaciones, "publicación", "publicaciones")}</span>
          <span className="text-tinta-meta">·</span>
          <span>{numero(bloque.comentarios_cosechados)} {pluralizar(bloque.comentarios_cosechados, "comentario leído", "comentarios leídos")}</span>
        </span>
      )}
    </li>
  );
}

function Titular({ r }: { r: ResultadoPrensaConsulta }) {
  return (
    <li className="text-cuerpo">
      <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="text-tinta-titulo underline decoration-filo underline-offset-4 hover:decoration-tinta-prosa">
        {r.titulo}
      </a>
      <span className="block text-meta text-tinta-meta">
        {r.fuente} · {fechaConAnio(r.fecha)} ·{" "}
        {r.tono === null ? <Hueco>sin tono</Hueco> : <span className={CLASE_TONO[r.tono]}>{NOMBRE_TONO_TITULAR[r.tono]}</span>}
      </span>
    </li>
  );
}

export function FichaConsulta({ c, doc }: { c: Consulta; doc: DocConsultas }) {
  const t = c.tono;
  const prensa = c.prensa;
  const resultados = prensa.estado === "ok" ? (prensa.resultados ?? []) : [];
  const anteriores = prensa.estado === "ok" ? (prensa.anteriores ?? []) : [];
  const tonoPrensa = prensa.estado === "ok" ? prensa.tono : undefined;
  const porMedio = prensa.estado === "ok" ? (prensa.por_medio ?? []) : [];
  const ventanaPrensa = rotuloVentana(prensa.ventana_dias ?? doc.ventana_prensa_dias);
  const ventanaRedes = rotuloVentana(doc.ventana_dias);
  return (
    <div className="mx-auto grid w-full max-w-[65ch] gap-6">
      <header>
        <p className="text-meta text-tinta-meta">Término en seguimiento · {NOMBRE_TIPO[c.tipo]}</p>
        <h2 className="mt-1 text-rotulo text-tinta-titulo">{c.termino}</h2>
        <p className="mt-2 text-cuerpo text-tinta-prosa">
          Redes: últimos {ventanaRedes} · Prensa: últimos {ventanaPrensa} · al {fechaLarga(doc.generado)}
        </p>
      </header>

      <section aria-labelledby="ficha-resumen">
        <h3 id="ficha-resumen" className="text-meta text-tinta-meta">En resumen</h3>
        <ul className="mt-2 grid gap-1 text-cuerpo text-tinta-prosa">
          {frasesConsulta(c, doc).map((frase) => <li key={frase}>{frase}</li>)}
        </ul>
      </section>

      <section aria-labelledby="ficha-prensa">
        <h3 id="ficha-prensa" className="text-meta text-tinta-meta">En la prensa · últimos {ventanaPrensa}</h3>
        {prensa.estado !== "ok" ? (
          <p className="mt-2 text-cuerpo text-tinta-meta"><Hueco>sin dato</Hueco></p>
        ) : (
          <>
            {tonoPrensa === undefined || tonoPrensa.titulares === 0 ? null : (
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-cuerpo tabular-nums">
                <span className="text-baja">adversos {numero(tonoPrensa.adversa)}</span>
                <span className="text-sube">favorables {numero(tonoPrensa.favorable)}</span>
                <span className="text-tinta-meta">neutrales {numero(tonoPrensa.neutral)}</span>
                {tonoPrensa.sin_clasificar + tonoPrensa.sin_modelo_idioma > 0
                  ? <span className="text-tinta-meta">sin tono {numero(tonoPrensa.sin_clasificar + tonoPrensa.sin_modelo_idioma)}</span>
                  : null}
              </p>
            )}
            {resultados.length === 0 ? (
              <p className="mt-2 text-cuerpo text-tinta-meta">Ningún titular nombra «{c.termino}» en los últimos {ventanaPrensa}.</p>
            ) : (
              <ul className="mt-2 grid gap-2">
                {resultados.map((r) => <Titular key={r.url} r={r} />)}
              </ul>
            )}
            {porMedio.length < 2 ? null : (
              <ul className="mt-3 grid gap-1 text-meta text-tinta-meta tabular-nums">
                {porMedio.map((m) => (
                  <li key={m.fuente}>
                    {m.fuente}: {numero(m.titulares)} {pluralizar(m.titulares, "titular", "titulares")}
                    {m.adversa > 0 ? ` · ${numero(m.adversa)} ${pluralizar(m.adversa, "adverso", "adversos")}` : ""}
                    {m.favorable > 0 ? ` · ${numero(m.favorable)} ${pluralizar(m.favorable, "favorable", "favorables")}` : ""}
                  </li>
                ))}
              </ul>
            )}
            {anteriores.length === 0 ? null : (
              <div className="mt-4">
                <h4 className="text-meta text-tinta-meta">Anteriores a los últimos {ventanaPrensa}</h4>
                <ul className="mt-2 grid gap-2">
                  {anteriores.map((r) => <Titular key={r.url} r={r} />)}
                </ul>
                <p className="mt-2 text-meta text-tinta-meta">No entran en el conteo de arriba; son los que el buscador de cada medio devolvió más atrás.</p>
              </div>
            )}
            {prensa.muestra ? <p className="mt-3 text-meta text-tinta-meta">{prensa.muestra}.</p> : null}
          </>
        )}
        {prensa.archivo === undefined ? null : (
          <p className="mt-2 text-meta text-tinta-meta">
            {numero(prensa.archivo.coincidencias)} {pluralizar(prensa.archivo.coincidencias, "titular", "titulares")} del archivo propio
            {" "}{prensa.archivo.coincidencias === 1 ? "nombra" : "nombran"} el término · {prensa.archivo.muestra}.
          </p>
        )}
        <p className="mt-3">
          <a href={rutaDeBusquedaEnVivo(c.termino)} className={clasesChip(false)}>
            <Lupa size={16} aria-hidden /> Ver en la prensa en vivo
          </a>
        </p>
      </section>

      <section aria-labelledby="ficha-redes">
        <h3 id="ficha-redes" className="text-meta text-tinta-meta">Publicaciones y comentarios leídos · últimos {ventanaRedes}</h3>
        <ul className="mt-2">
          {REDES.map((red) => <FilaRed key={red} nombre={NOMBRE_RED[red]} bloque={c.plataformas[red]} />)}
          {SIN_DATO.map((red) => <FilaRed key={red} nombre={NOMBRE_SIN_DATO[red]} bloque={c.plataformas[red]} />)}
        </ul>
      </section>

      <section aria-labelledby="ficha-tono">
        <h3 id="ficha-tono" className="text-meta text-tinta-meta">Tono de los comentarios</h3>
        {t.comentarios === 0 ? (
          <p className="mt-2 text-cuerpo text-tinta-meta"><Hueco>sin dato</Hueco></p>
        ) : (
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-cuerpo tabular-nums">
            <span className="text-sube">positivo {numero(t.positivo)}</span>
            <span className="text-baja">negativo {numero(t.negativo)}</span>
            <span className="text-tinta-meta">neutral {numero(t.neutral)}</span>
            {t.sin_clasificar > 0 ? <span className="text-tinta-meta">sin clasificar {numero(t.sin_clasificar)}</span> : null}
            {t.sin_modelo_idioma > 0 ? <span className="text-tinta-meta">en otro idioma {numero(t.sin_modelo_idioma)}</span> : null}
          </p>
        )}
        <p className="mt-2 max-w-[65ch] text-meta text-tinta-meta">{t.salvedad_tono}</p>
      </section>

      {c.temas.temas.length === 0 ? null : (
        <section aria-labelledby="ficha-temas">
          <h3 id="ficha-temas" className="text-meta text-tinta-meta">Lo que se repite en los comentarios</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {c.temas.temas.map((tema) => (
              <li key={tema.termino} className="inline-flex items-baseline gap-2 rounded-full bg-vela px-3 py-1 text-cuerpo text-tinta-prosa">
                {tema.termino} <span className="text-meta tabular-nums text-tinta-meta">{numero(tema.n)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <a href={rutaDeInforme(c.id)} download className={clasesChip(true)}>
          <Descargar size={16} aria-hidden /> Descargar PDF
        </a>
        <p className="text-meta text-tinta-meta">Las publicaciones siguen abajo.</p>
      </div>
    </div>
  );
}
