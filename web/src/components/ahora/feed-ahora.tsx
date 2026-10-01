"use client";

import { ArrowClockwise as Recargar } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { CONTROL, Lector } from "@/components/lector/lector";
import { ListaRelacionadas, TITULO_RELACIONADAS } from "@/components/paneles/relacionadas-titular";
import { Buscador } from "@/components/busqueda/buscador";
import { LectorBusqueda } from "@/components/busqueda/lector-busqueda";
import { debeActivar, esEdicion, fraseFinal, type Capitulos, type Entrada, type Tarjeta } from "@/lib/busqueda/capitulos";
import { entradaDe, PARAM_EDICION, rubroDe, rutaDeEntrada } from "@/lib/busqueda/entrada";
import type { Rubro } from "@/lib/busqueda/rubros";
import { useImagenesVivas } from "@/lib/busqueda/use-imagen-viva";
import { useRelacionadas, type RelacionadasVivas } from "@/lib/busqueda/use-relacionadas";
import { useCapitulos } from "@/lib/busqueda/use-capitulos";
import { ruta } from "@/lib/dominio/secciones";
import { PestanasRubro } from "./pestanas-rubro";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";
import { teclasDelRecorrido, useRecorrido } from "@/lib/pantalla/recorrido";
import { OpcionesAhora } from "./controles-ahora";
import { nombreDe } from "./nombre-ahora";
import { EsqueletoTitular, TarjetaDivisor, TarjetaFinal, TarjetaHueco, TarjetaTitular } from "./tarjetas-ahora";
import { Hoja } from "@/components/ui/hoja";

/**
 * El recorrido de titulares en vivo: un titular por pantalla. ES la portada
 * desde el 15 de septiembre de 2026.
 *
 * La entrada —un lugar, Mexico o Internacional— decide el primer capitulo y
 * acota los cinco rubros; las otras dos secciones vienen despues en todos los
 * casos. Ya no es estado de cliente: se DERIVA de la ruta y de `?e=`
 * (lib/busqueda/entrada.ts), asi que se comparte y sobrevive a una recarga.
 * Cambiarla cambia la llave del recorrido, que es lo que descongela las listas
 * y vuelve a la primera tarjeta. Esa llave es la que sostiene el caso de la
 * faceta: `?e=mexico` NO remonta la pagina —es la misma ruta— y sin ella se
 * verian los capitulos de la region bajo la etiqueta «Mexico».
 *
 * Los capitulos se piden de a uno, con uno adelantado, cuando el lector se
 * acerca al final de lo que hay (capitulos.ts::debeActivar). Es el
 * `rootMargin` de WikiTok, pero sobre una cadena finita y ordenada, no sobre
 * un pozo aleatorio.
 *
 * Vive dentro del lector (components/lector) en todo ancho: una caja fija con
 * su barra y su propio desplazamiento, porque ajustar la pagina por proximidad
 * dejaba medias tarjetas. El Visual de redes usa el mismo lector y el mismo
 * hook.
 */

/**
 * De MODULO, no un `useRef`. Cambiar de zona es cambiar de ruta, y eso
 * desmonta `FeedAhora` entero: un ref se reinicia y el aviso de devolver el
 * foco se pierde. El manejador de foco de Next salta lo que es `position:
 * fixed`, asi que sin esto quien elige otra zona con teclado o lector de
 * pantalla acaba en `<body>` y sin anuncio. Mismo recurso que `ultimaPestana`
 * en paneles/lector-redes.tsx.
 *
 * Nota para el futuro: esto da por hecho que cambiar de ruta desmonta. Si
 * algun dia se enciende `cacheComponents`, Next retiene arboles anteriores en
 * un `<Activity>` oculto y este razonamiento cambia.
 */
const restaurarFoco = { current: false };

type Titular = Extract<Tarjeta, { tipo: "titular" }>;

/** El nombre accesible del recorrido. Aparte de `nombreDe` por la
 *  contraccion: «Titulares de El corredor» no es espanol. Con tema elegido lo
 *  dice el titulo del primer capitulo, que ya esta escrito para el lugar
 *  («Seguridad sobre Tijuana») y no hay por que redactarlo dos veces. */
const tituloRecorrido = (entrada: Entrada, capitulos: Capitulos, rubro: Rubro | null): string => {
  if (rubro !== null) return capitulos[0].titulo;
  return entrada === "region" ? "Titulares del corredor" : `Titulares de ${nombreDe(entrada)}`;
};

/** Donde busca la lupa, dicho como se dice. Es la ENTRADA desde el 25 de
 *  septiembre de 2026 (use-busqueda.ts): antes era solo la zona, y en
 *  `/?e=mexico` buscaba el corredor. En el corredor la cabeza es lo que da
 *  Google Noticias para el termino, sin lugar (buscar.ts), asi que ahi el
 *  rotulo no dice «el corredor»: diria menos de lo que sale. Y desde el 30 de
 *  septiembre de 2026 dice «redes» tambien: la busqueda trae publicaciones. */
const lugarDeBusqueda = (entrada: Entrada): string =>
  entrada === "region" ? "noticias y redes" : entrada === "mexico" ? "México" : entrada === "internacional" ? "el mundo" : NOMBRE_CORTO[entrada];

/** La edicion viaja en un campo oculto (25 de septiembre de 2026): sin ella
 *  enviar desde Mexico buscaba en el corredor. */
const ocultosDe = (entrada: Entrada): Record<string, string> =>
  esEdicion(entrada) ? { [PARAM_EDICION]: entrada } : {};

export function FeedAhora({ zona, edicion, consulta, rubro, analisis }: {
  zona: ZonaRuta | null;
  /** El `?e=` de la URL, ya leido en el servidor. */
  edicion: string | null;
  /** El `?t=`, tambien crudo. A diferencia de `?e=`, una zona SI lo trae: el
   *  tema acota el lugar en vez de competir con el. */
  rubro: string | null;
  /** El `?q=`. Con consulta el lector deja de recorrer capitulos y muestra
   *  resultados: es un modo, no un capitulo mas. */
  consulta: string | null;
  /** Si el boton de lectura automatica se pinta. Lo decide el servidor. */
  analisis: boolean;
}) {
  const entrada = entradaDe(zona, edicion);
  const tema = rubroDe(rubro);
  const [generacion, setGeneracion] = useState(0);
  function recargar() {
    restaurarFoco.current = true;
    setGeneracion((g) => g + 1);
  }
  const q = (consulta ?? "").trim();
  if (q !== "") {
    return (
      <RecorridoBusqueda key={`q:${q}:${entrada}`} consulta={q} zona={zona} entrada={entrada} />
    );
  }
  // El tema entra en la LLAVE: cambiarlo tiene que descongelar las listas de
  // use-capitulos.ts y volver a la primera tarjeta, igual que cambiar de lugar.
  return (
    <RecorridoAhora key={`${entrada}:${tema ?? ""}:${generacion}`} entrada={entrada} rubro={tema} zona={zona} onRecargar={recargar}
      analisis={analisis} />
  );
}

/**
 * La hoja de notas relacionadas: UNA para todo el recorrido.
 *
 * Misma forma que visor-redes.tsx, incluida la razon del contador de turnos:
 * si el efecto colgara de la tarjeta, `onClose` la devolveria a null y abrir,
 * cerrar y volver a pulsar la MISMA tarjeta escribiria el mismo valor dos
 * veces -- React no re-renderiza, el efecto no corre y la hoja no vuelve a
 * abrir para esa tarjeta. El turno siempre cambia.
 *
 * La lista se pide AL ABRIR (use-relacionadas.ts). Antes salia de un indice
 * que el recorrido armaba con las 6,020 notas que la portada descargaba; de
 * las ~135 tarjetas que encadena, casi ninguna llega a abrir su hoja.
 */
function useHojaRelacionadas() {
  const hoja = useRef<HTMLDialogElement>(null);
  const [abierta, setAbierta] = useState<Titular | null>(null);
  const [turno, setTurno] = useState(0);
  useEffect(() => {
    if (turno > 0) hoja.current?.showModal();
  }, [turno]);
  const abrir = (t: Titular) => {
    setAbierta(t);
    setTurno((n) => n + 1);
  };
  const vivas = useRelacionadas(abierta === null ? null : abierta.r.titulo);
  return { hoja, abierta, setAbierta, abrir, vivas };
}

function HojaRelacionadas({ hoja, abierta, setAbierta, vivas }: {
  hoja: RefObject<HTMLDialogElement | null>;
  abierta: Titular | null;
  setAbierta: (t: Titular | null) => void;
  vivas: RelacionadasVivas;
}) {
  return (
    <Hoja ref={hoja} titulo={TITULO_RELACIONADAS} rotuloCerrar="Cerrar notas relacionadas" onClose={() => setAbierta(null)}>
      {/* `key` por tarjeta: la lista no hereda la de la anterior. */}
      {abierta === null ? null : (
        <ListaRelacionadas key={abierta.clave} notas={vivas.notas}
          cargando={vivas.cargando} fallo={vivas.fallo} />
      )}
    </Hoja>
  );
}

function RecorridoAhora({ entrada, rubro, zona, onRecargar, analisis }: {
  entrada: Entrada; rubro: Rubro | null; zona: ZonaRuta | null; onRecargar: () => void;
  analisis: boolean;
}) {
  const [activados, setActivados] = useState(1);
  const { capitulos, hilado, disponible, hayNuevos } = useCapitulos(entrada, rubro, activados);
  const rel = useHojaRelacionadas();
  const contenedor = useRef<HTMLDivElement>(null);
  const { actual, ir } = useRecorrido(contenedor);
  useEffect(() => {
    // El estado se consulta dentro del updater, que tambien es el guardia. Si
    // StrictMode repite este efecto con el mismo cierre, la segunda llamada ve
    // el valor ya activado y no vuelve a pedir un capitulo.
    setActivados((a) => debeActivar(hilado, actual, a, capitulos.length) ? a + 1 : a);
  }, [hilado, actual, capitulos.length]);

  const { tarjetas, completo } = hilado;
  // Lo que el archivo no tiene se pide a la pagina del propio medio, solo para
  // la tarjeta asentada y la siguiente.
  const vivas = useImagenesVivas(tarjetas, actual);
  const total = tarjetas.length + (completo ? 1 : 0);
  return (
    // Sin `volver`: esto ES la portada, no hay pagina detras.
    <Lector rotulo="En Tendencia" valor={nombreDe(entrada)} tituloOpciones="Por dónde empezar"
      opciones={<OpcionesAhora entrada={entrada} rubro={rubro} />}
      pestanas={<PestanasRubro entrada={entrada} rubro={rubro} />}
      acciones={<>
        <span role="status" className="sr-only">{hayNuevos ? "Hay titulares nuevos." : ""}</span>
        {hayNuevos ? (
          <button type="button" className={CONTROL} data-nuevos aria-label="Hay titulares nuevos. Recargar" title="Hay titulares nuevos · Recargar" onClick={onRecargar}>
            <Recargar size={20} aria-hidden />
          </button>
        ) : null}
        {/* Aqui estuvo el atajo al guion para locucion: una hoja del 25 al
            28 de septiembre de 2026 y despues unos destellos que enlazaban a
            /guion. Salio de la barra el 28 de septiembre (cliente): el guion
            tiene su pagina en la navegacion. */}
      </>}
      busqueda={<Buscador accion={ruta(zona, null)} etiqueta={`En ${lugarDeBusqueda(entrada)}`} consulta={null}
        salida="Volver al recorrido" ocultos={ocultosDe(entrada)} />}
      restaurarFoco={restaurarFoco}>
      <div ref={contenedor} className="recorrido-lector" tabIndex={0} role="region" aria-label={tituloRecorrido(entrada, capitulos, rubro)}
        onKeyDown={(evento) => teclasDelRecorrido(evento, actual, total, ir)}>
        {!disponible ? <p className="tarjeta-ahora flex items-center text-lectura text-tinta-prosa">Los titulares en vivo no están disponibles en esta vista.</p> : <>
        {tarjetas.map((t, i) => {
          if (t.tipo === "titular") return <TarjetaTitular key={t.clave} t={t} titulares={hilado.titulares} indice={i} imagen={t.r.imagen ?? vivas.get(t.clave) ?? null} analisis={analisis} referencia={t.r.referencia} onRelacionadas={() => rel.abrir(t)} />;
          if (t.tipo === "divisor") return <TarjetaDivisor key={`divisor:${t.capitulo}`} t={t} indice={i} />;
          return <TarjetaHueco key={`hueco:${t.capitulo}`} t={t} indice={i} />;
        })}
        {completo
          ? <TarjetaFinal indice={tarjetas.length} frase={fraseFinal(capitulos, hilado)} onInicio={() => ir(0)} />
          : <>
              <EsqueletoTitular indice={tarjetas.length} />
              <p role="status" className="sr-only">Cargando titulares…</p>
            </>}
        </>}
      </div>
      <HojaRelacionadas hoja={rel.hoja} abierta={rel.abierta} setAbierta={rel.setAbierta}
        vivas={rel.vivas} />
    </Lector>
  );
}

/**
 * El lector en modo BUSQUEDA: la misma de Redes (busqueda/lector-busqueda.tsx).
 *
 * Hasta el 30 de septiembre de 2026 era un recorrido de titulares, uno por
 * pantalla, con Analizar y Relacionadas en cada tarjeta; desde ese dia la
 * portada busca noticias Y publicaciones en una lista, como /reportes, por
 * pedido del cliente. Las noticias siguen buscando donde se entro: `/tijuana`
 * en Tijuana y `?e=mexico` en Mexico.
 */
function RecorridoBusqueda({ consulta, zona, entrada }: {
  consulta: string; zona: ZonaRuta | null; entrada: Entrada;
}) {
  return (
    <LectorBusqueda rotulo="En Tendencia" consulta={consulta} volver={rutaDeEntrada(entrada)}
      accion={ruta(zona, null)} etiqueta={`En ${lugarDeBusqueda(entrada)}`} salida="Volver al recorrido"
      ocultos={ocultosDe(entrada)} zona={zona} entrada={entrada}
      tituloOpciones="Por dónde empezar" opciones={<OpcionesAhora entrada={entrada} rubro={null} />} />
  );
}
