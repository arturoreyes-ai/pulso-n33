"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";

import { Bisel } from "@/components/ui/bisel";
import { Barra, Esqueleto } from "@/components/ui/primitivas";
import { duracion, fechaLocal, horaLocal, resumen, vigente } from "@/lib/garitas/formato";
import type { Carril, RespuestaGaritas } from "@/lib/garitas/tipos";

/**
 * Las esperas de CBP en San Ysidro y Otay Mesa.
 *
 * ESTA PAGINA ERA OTRO SITIO. Se construyo aparte del tablero y lo parecia:
 * traia su propia `<nav>` («← Pulso N33 | Garitas»), su propia hoja de estilos
 * (`garitas.module.css`, 40 reglas con tamanos en px sueltos) y un
 * `margin-top: -88px` sobre `z-index: var(--z-nav)` con el que se metia
 * ENCIMA de la pildora del tablero. De ahi que la nav no se viera aqui: no se
 * habia olvidado, estaba tapada a proposito por una pagina que se creia sola.
 *
 * Ahora es una pagina mas del tablero. La nav la monta el servidor en
 * `app/garitas/page.tsx`, como en `/gasto-electoral`, y todo lo de aqui usa
 * los mismos contenedores y fichas que el resto: `max-w-[88rem]` con
 * `px-4 md:px-8`, `Bisel` para los paneles, `Barra` para las barras y las
 * fichas de tipografia (`text-hero`, `text-seccion`, `text-cifra`,
 * `text-lectura`, `text-meta`) en vez de px.
 *
 * `Barra` ademas corrige algo: escala con `transform`, no con `width`, que es
 * la regla del tablero para no provocar reflow en cada tick del reloj.
 *
 * Lo que NO cambio es el producto: una consulta al entrar y despues solo el
 * boton (el endpoint de CBP no se golpea en cada foco), la hora de reporte por
 * carril, los reportes de mas de 90 minutos fuera del resumen para locucion, y
 * la distincion entre «sin dato» y cero que rige todo el tablero.
 */

const CBP = "https://bwt.cbp.gov/";

/** El ancho de la pagina, identico al de `chrome/seccion.tsx`. */
const ANCHO = "mx-auto w-full max-w-[88rem] px-4 md:px-8";

async function consultar(ruta: string): Promise<RespuestaGaritas> {
  const respuesta = await fetch(ruta);
  if (!respuesta.ok) throw new Error("CBP no disponible");
  return respuesta.json();
}

/** El estado de un carril sin cifra, en palabras. Nunca un cero: un cero aqui
 *  se leeria como «no hay espera» y lo que significa es «no lo reportaron». */
function sinCifra(carril: Carril): string {
  if (carril.estado === "cerrado") return "Cerrado";
  if (carril.estado === "pendiente") return "Actualización pendiente";
  return "Sin dato";
}

/** Los minutos solo cuando CBP los reporto. Devolver `null` en vez de afirmar
 *  con `!` es lo que deja que el resto de la fila se escriba sin ramas. */
function minutosDe(carril: Carril): number | null {
  return carril.estado === "reportado" ? carril.minutos : null;
}

function Fila({ carril, escala, ahora }: { carril: Carril; escala: number; ahora: number }) {
  const minutos = minutosDe(carril);
  const actual = vigente(carril, ahora);
  const nombre = `${carril.acceso === "PedWest" ? "PedWest · " : ""}${carril.nombre}`;

  return (
    <li className="border-b border-vela py-4 last:border-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-lectura text-tinta-dato">{nombre}</span>
        {minutos === null ? (
          <span className="shrink-0 text-right text-cuerpo text-tinta-meta">
            {sinCifra(carril)}
          </span>
        ) : (
          <span
            aria-label={duracion(minutos, true)}
            className="inline-flex shrink-0 items-baseline gap-1.5 text-cifra tabular-nums whitespace-nowrap text-tinta-titulo"
          >
            {/* La cifra grande y la unidad chica. El espacio lo pone `gap` y no
                un margen por pieza: `duracion` devuelve «3 h 30 min», o sea
                cuatro partes, y al marginar solo las no numericas el «30» se
                pegaba a la «h». El lector de pantalla no lee este troceado: el
                aria-label de arriba lleva la version hablada. */}
            {duracion(minutos)
              .split(" ")
              .map((parte, i) =>
                /^\d+$/.test(parte) ? (
                  <span key={i}>{parte}</span>
                ) : (
                  <span key={i} className="text-meta font-normal text-tinta-prosa">
                    {parte}
                  </span>
                ),
              )}
          </span>
        )}
      </div>

      {minutos === null ? null : (
        <div className="mt-2.5" aria-hidden="true">
          <Barra
            fraccion={minutos / escala}
            color={actual ? "var(--color-chart-3)" : "var(--color-aviso)"}
          />
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap justify-between gap-x-3 gap-y-1 text-meta text-tinta-meta">
        <span>
          {carril.abiertos === null
            ? "Carriles abiertos: sin dato"
            : carril.abiertos === 1
              ? "1 carril abierto"
              : `${carril.abiertos} carriles abiertos`}
        </span>
        <span>
          {carril.observado ? `Reporte: ${fechaLocal(carril.observado)}` : "Sin hora de reporte"}
        </span>
      </div>

      {carril.estado === "no_disponible" ? (
        <p className="mt-2 text-meta text-tinta-meta">
          CBP no publica un reporte para este carril.
        </p>
      ) : null}

      {minutos !== null && !carril.observado ? (
        <p className="mt-2 text-meta text-aviso">Vigencia desconocida · fuera del resumen</p>
      ) : null}
    </li>
  );
}

function Grupo({
  titulo,
  carriles,
  escala,
  ahora,
}: {
  titulo: string;
  carriles: Carril[];
  escala: number;
  ahora: number;
}) {
  if (carriles.length === 0) return null;
  return (
    <div className="mt-6 first:mt-0">
      <h3 className="text-meta text-tinta-prosa">{titulo}</h3>
      <ul className="mt-1">
        {carriles.map((c) => (
          <Fila key={`${c.acceso}-${c.categoria}`} carril={c} escala={escala} ahora={ahora} />
        ))}
      </ul>
    </div>
  );
}

export function TableroGaritas() {
  // Una consulta al entrar; despues solo el boton. Foco, reconexion y error no
  // consultan: cada peticion pega al servicio de CBP.
  const {
    data: datos,
    error,
    isValidating: consultando,
    mutate: actualizar,
  } = useSWR<RespuestaGaritas>("/api/garitas", consultar, {
    refreshInterval: 0,
    revalidateOnMount: true,
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
    keepPreviousData: true,
  });

  const [ahora, fijarAhora] = useState(0);
  const [confirmacion, fijarConfirmacion] = useState("");

  async function actualizarManual() {
    fijarConfirmacion("");
    try {
      const resultado = await actualizar();
      if (!resultado) return;
      fijarConfirmacion(
        `Consulta completada a las ${horaLocal(new Date().toISOString())}. Revisa la hora de reporte de cada carril; CBP puede mantener las mismas cifras.`,
      );
    } catch {
      fijarConfirmacion(
        "No se pudo actualizar. Intenta de nuevo; conservamos el último reporte recibido.",
      );
    }
  }

  // El reloj se inyecta desde aqui y no se lee dentro de `vigente`, para que la
  // frescura de un carril no dependa del momento en que React decida repintar.
  useEffect(() => {
    fijarAhora(Date.now());
    const reloj = setInterval(() => fijarAhora(Date.now()), 15_000);
    return () => clearInterval(reloj);
  }, []);

  const escala = Math.max(
    180,
    ...(datos?.cruces ?? []).flatMap((cruce) =>
      cruce.carriles.map((c) => Math.ceil((c.minutos ?? 0) / 30) * 30),
    ),
  );
  const lectura = datos && ahora ? resumen(datos.cruces, ahora) : "";

  return (
    <>
      <header className={`${ANCHO} pb-6`}>
        <div className="entrada">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <h1 className="max-w-[16ch] font-titular text-hero [font-stretch:112%] text-tinta-titulo">
              El pulso de las garitas
            </h1>
            <button
              type="button"
              onClick={() => void actualizarManual()}
              disabled={consultando}
              aria-busy={consultando}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-filo bg-vela px-5 text-cuerpo text-tinta-titulo transition-colors duration-[var(--dur-cambio)] ease-firma hover:bg-filo disabled:cursor-wait disabled:opacity-60 max-sm:w-full"
            >
              {consultando ? "Consultando…" : "Actualizar"}
            </button>
          </div>

          <p className="mt-6 max-w-[65ch] text-lectura text-tinta-prosa">
            San Ysidro y Otay Mesa. Esperas reportadas por CBP para vehículos y peatones.
          </p>

          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-meta text-tinta-meta">
            <span>Hora local de Tijuana</span>
            <span>Se consulta al abrir; después, con Actualizar</span>
            <a
              href={CBP}
              target="_blank"
              rel="noreferrer"
              className="text-tinta-dato transition-colors hover:text-tinta-titulo"
            >
              Fuente: CBP ↗
            </a>
          </div>

          <p role="status" className="mt-3 min-h-9 max-w-[65ch] text-meta text-tinta-dato">
            {consultando ? "Consultando el último reporte disponible…" : confirmacion}
          </p>
        </div>
      </header>

      <section className={`${ANCHO} pt-4 pb-12 md:pt-6 md:pb-20`}>
        {error ? (
          <p
            role="alert"
            className="rounded-nucleo border border-aviso/40 bg-aviso/10 px-4 py-3 text-cuerpo text-tinta-dato"
          >
            {datos
              ? "Falló la actualización. Se conserva el último reporte recibido; comprueba la hora de cada carril."
              : "No fue posible consultar CBP. Los tiempos no están disponibles. Puedes reintentar con Actualizar."}
          </p>
        ) : null}

        {!datos && !error ? (
          consultando ? (
            <Esqueleto className="h-[420px]" />
          ) : (
            <p className="py-16 text-center text-lectura text-tinta-prosa">
              Pulsa Actualizar para consultar los tiempos de cruce.
            </p>
          )
        ) : null}

        {datos ? (
          <>
            <Bisel interior="p-6 md:p-8">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h2 className="text-meta font-semibold text-tinta-titulo">Para leer al aire</h2>
                <span className="text-meta text-tinta-meta">Vehículos · carriles generales</span>
              </div>
              <p className="mt-3 max-w-[70ch] text-rotulo text-tinta-titulo">
                {error
                  ? "Actualización interrumpida. Verifica los reportes antes de leer cifras al aire."
                  : lectura ||
                    "No hay reportes vigentes con hora verificable para los carriles generales. Consulta el detalle de cada cruce."}
              </p>
            </Bisel>

            <div className="mt-8 flex flex-wrap justify-between gap-x-4 gap-y-1 text-meta text-tinta-meta">
              <span>Las barras representan tiempo de espera, no longitud de la fila.</span>
              <span>Escala compartida: 0–{duracion(escala)}</span>
            </div>

            <div className="mt-4 grid items-start gap-6 md:grid-cols-2">
              {datos.cruces.map((cruce) => (
                <Bisel as="section" nivel="panel" key={cruce.id} interior="p-6 md:p-7">
                  <header className="border-b border-filo pb-5">
                    <h2 className="font-titular text-seccion text-tinta-titulo">{cruce.nombre}</h2>
                    <p className="mt-1 text-meta text-tinta-meta">Hacia Estados Unidos</p>
                  </header>
                  <div className="pt-5">
                    <Grupo
                      titulo="Vehículos"
                      carriles={cruce.carriles.filter((c) => c.viajero === "vehiculo")}
                      escala={escala}
                      ahora={ahora}
                    />
                    <Grupo
                      titulo="Peatones"
                      // Otay Mesa publica un carril peatonal Ready Lane que
                      // duplica al general con la misma cifra; se omite para no
                      // contar dos veces la misma fila.
                      carriles={cruce.carriles.filter(
                        (c) =>
                          c.viajero === "peaton" &&
                          !(cruce.id === "otay_mesa" && c.categoria === "ready"),
                      )}
                      escala={escala}
                      ahora={ahora}
                    />
                  </div>
                </Bisel>
              ))}
            </div>

            <p className="mt-10 max-w-[80ch] border-t border-vela pt-5 text-meta text-tinta-prosa">
              Consulta a CBP: {fechaLocal(datos.consultado)}. Cada carril conserva su propia hora
              de reporte. Los reportes de más de 90 minutos se excluyen del resumen para locución.
              Las estimaciones no garantizan el tiempo de cruce.
            </p>
          </>
        ) : null}
      </section>
    </>
  );
}
