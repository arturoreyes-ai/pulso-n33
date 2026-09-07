"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import {
  useConversacion,
  useEstado,
  useIndicadores,
  useNotas,
  useTemas,
} from "@/lib/datos/hooks";
import type {
  DocConversacion,
  DocEstado,
  DocIndicadores,
  DocNotas,
  DocTemas,
  Tema,
} from "@/lib/datos/tipos";
import { dolares, fechaLarga, hora, nombreMes, numero, pesos, pluralizar } from "@/lib/dominio/formato";
import * as F from "@/lib/dominio/frases";
import { ZIPS_FRONTERA, claveShf, periodoLegible, ultimoYPrevio } from "@/lib/dominio/indicadores";
import { tonoPorZona } from "@/lib/dominio/tono";
import {
  MUNICIPIOS_BC,
  NOMBRE_CORTO,
  ZONAS_RUTA,
  rutaDeZona,
  type ZonaRuta,
} from "@/lib/dominio/zonas";
import { Bisel } from "@/components/ui/bisel";
import { Esqueleto, Hueco, Kpi, Signo } from "@/components/ui/primitivas";
import { BarraSentimiento, BarraTono } from "@/components/ui/sentimiento";

/**
 * El resumen de la zona: las cifras que importan, cada una con su frase.
 *
 * Orden para quien invierte primero y para quien reportea despues: vivienda,
 * suelo, delitos, percepcion; luego el tema de la semana, la prensa con su
 * tono y la conversacion con su sentimiento. La brecha entre prensa y
 * comentarios solo aparece cuando los dos lados tienen volumen, y siempre en
 * palabras.
 *
 * Todo lo que falta se dice ("sin dato", "fuera de muestra"); la tira nunca
 * se esconde porque falte un archivo.
 */

interface Datos {
  estado: DocEstado;
  ind: DocIndicadores | undefined;
  temas: DocTemas | undefined;
  conv: DocConversacion | undefined;
  notas: DocNotas | undefined;
}

interface Tarjeta {
  etiqueta: string;
  valor: ReactNode;
  frase: string;
  fuente?: string;
  hueco?: boolean;
  extra?: ReactNode;
}

/* ------------------------------------------------------------ tarjetas comunes */

function temaDe(temas: DocTemas | undefined, zona: ZonaRuta | null): Tema | undefined {
  if (temas === undefined) return undefined;
  if (zona === null) return temas.temas[0];
  const bloque = temas.por_zona?.[zona];
  if (bloque !== undefined) return bloque.temas[0];
  return temas.temas.find((t) => (t.zonas[zona] ?? 0) > 0);
}

function tarjetaTema(d: Datos, zona: ZonaRuta | null, sujeto: string): Tarjeta {
  const t = temaDe(d.temas, zona);
  const dias = d.temas?.ventana_dias ?? 7;
  const ejemplo = t?.ejemplos[0];
  return {
    etiqueta: `Tema con más notas en ${dias} días`,
    valor: t === undefined ? "sin tema" : <span className="text-2xl">«{t.termino}»</span>,
    hueco: t === undefined,
    frase:
      d.temas === undefined ? "Sin temas en este corte." : F.fraseTemaPrincipal(t, sujeto, dias),
    extra:
      ejemplo === undefined ? undefined : (
        <p className="text-xs leading-snug text-tinta-prosa">Titular de ejemplo: {ejemplo}</p>
      ),
    fuente: "Titulares de prensa regional; conteo por documento, sin modelo.",
  };
}

function tarjetaPrensa(d: Datos, zona: ZonaRuta | null, sujeto: string): Tarjeta {
  const dias = d.estado.ventana_dias;
  const n = zona === null ? d.estado.notas_ventana : (d.estado.por_zona[zona] ?? 0);
  const tono = tonoPorZona(d.notas, zona);
  const prensa =
    zona === null
      ? `${numero(n)} notas de prensa en los últimos ${dias} días.`
      : F.frasePrensa(n, dias, sujeto);
  const tonoFrase =
    tono === undefined
      ? n === 0 || d.notas === undefined
        ? ""
        : " Sin clasificación de tono en este corte."
      : ` ${F.fraseTono(tono, sujeto, dias)}`;
  return {
    etiqueta: `Notas de prensa en ${dias} días`,
    valor: numero(n),
    frase: prensa + tonoFrase,
    extra: tono === undefined ? undefined : <BarraTono t={tono} ariaLabel={tonoFrase.trim()} />,
    fuente:
      "Titulares de medios regionales. El tono lo asigna un modelo local: es tono de la frase, no postura hacia una persona.",
  };
}

function tarjetaConversacion(d: Datos, zona: ZonaRuta | null, sujeto: string): Tarjeta {
  const conv = d.conv;
  if (conv === undefined) {
    return {
      etiqueta: "Comentarios en YouTube",
      valor: "sin panel",
      hueco: true,
      frase: "Sin panel de conversación en este corte.",
    };
  }
  const dias = conv.retencion_dias;
  const n = zona === null ? conv.comentarios_vigentes : (conv.por_zona[zona] ?? 0);
  const s = zona === null ? conv.sentimiento : conv.por_zona_detalle?.[zona]?.sentimiento;
  const clasificados = s === undefined ? 0 : F.totalSentimiento(s);

  let frase: string;
  if (n === 0) {
    frase =
      zona === null
        ? `Sin comentarios vigentes en los últimos ${dias} días.`
        : `Sin comentarios atribuidos a ${sujeto} en los últimos ${dias} días.`;
  } else if (s === undefined || clasificados === 0) {
    frase = `${numero(n)} ${pluralizar(n, "comentario", "comentarios")} sobre ${sujeto} en ${dias} días; sin clasificación de sentimiento en este corte.`;
  } else {
    frase = F.fraseSentimiento(s, sujeto, dias);
    if (zona === null && conv.sentimiento !== undefined && conv.sentimiento.sin_clasificar > 0) {
      frase += ` ${numero(conv.sentimiento.sin_clasificar)} siguen sin clasificar.`;
    }
  }
  return {
    etiqueta: `Comentarios en YouTube, ${dias} días`,
    valor: numero(n),
    frase,
    extra:
      s !== undefined && clasificados > 0 ? <BarraSentimiento s={s} ariaLabel={frase} /> : undefined,
    fuente: "Canales de noticias en YouTube. Volumen de conversación, no opinión pública.",
  };
}

/* --------------------------------------------------------------- municipio */

function tarjetasMunicipio(zona: ZonaRuta, d: Datos): Tarjeta[] {
  const nombre = NOMBRE_CORTO[zona];
  const I = d.ind?.indicadores;
  const shf = I?.shf;
  const predial = I?.predial;
  const sesnsp = I?.sesnsp;
  const ensu = I?.ensu;

  const serie = shf?.series[claveShf(zona)];
  const vivienda: Tarjeta = {
    etiqueta: "Precio de vivienda, variación anual",
    valor: serie === undefined ? "sin dato" : <Signo v={serie.variacion_anual_pct} />,
    hueco: serie === undefined,
    frase:
      shf === undefined
        ? "Sin indicadores oficiales en este corte."
        : F.fraseVivienda(serie, nombre, shf.periodo),
    fuente:
      shf === undefined
        ? undefined
        : `${shf.fuente}, ${periodoLegible(shf.periodo)}. Vivienda con crédito hipotecario, no terrenos.`,
  };

  const m = predial?.municipios[zona];
  const suelo: Tarjeta = {
    etiqueta: "Predial pagado por cuenta",
    valor: m === undefined ? "sin dato" : pesos(m.por_cuenta_mxn),
    hueco: m === undefined,
    frase:
      m === undefined
        ? `Sin dato de predial para ${nombre} en este corte.`
        : F.frasePredial(m, nombre),
    fuente:
      predial === undefined
        ? undefined
        : `${predial.fuente}, ${predial.periodo ?? "sin periodo"}. Mide recaudación, no valor del suelo.`,
  };

  const c = sesnsp?.municipios[zona];
  const { ultimo, previo, indice } = ultimoYPrevio(c?.por_mes ?? []);
  const crimen: Tarjeta = {
    etiqueta:
      ultimo === undefined ? "Delitos reportados" : `Delitos reportados en ${nombreMes(indice)}`,
    valor:
      ultimo === undefined ? (
        "sin dato"
      ) : (
        <>
          {numero(ultimo)}{" "}
          <span className="text-base">
            <Signo v={F.variacionPct(ultimo, previo)} invertir />
          </span>
        </>
      ),
    hueco: ultimo === undefined,
    frase:
      c === undefined
        ? `Sin serie de delitos para ${nombre} en este corte.`
        : `${F.fraseCrimen(c, nombre)} ${F.fraseDelitosClave(c)}`,
    fuente:
      sesnsp === undefined
        ? undefined
        : `${sesnsp.fuente}, ${sesnsp.periodo ?? "sin periodo"}. Delitos reportados, no ocurridos; no es per cápita.`,
  };

  const e = ensu?.ciudades[zona];
  const pctInseguro = e === undefined ? null : e.pct_inseguro;
  const percepcion: Tarjeta = {
    etiqueta: "Se sienten inseguros, 18 años y más",
    valor: pctInseguro === null ? "fuera de muestra" : `${F.decimal(pctInseguro)}%`,
    hueco: pctInseguro === null,
    frase:
      ensu === undefined
        ? "Sin ENSU en este corte."
        : F.frasePercepcion(e, nombre, ensu.nacional.pct_inseguro, ensu.periodo),
    fuente:
      ensu === undefined
        ? undefined
        : `${ensu.fuente}, ${periodoLegible(ensu.periodo)}. Muestra probabilística; la única medición real de percepción.`,
  };

  return [
    vivienda,
    suelo,
    crimen,
    percepcion,
    tarjetaTema(d, zona, nombre),
    tarjetaPrensa(d, zona, nombre),
    tarjetaConversacion(d, zona, nombre),
  ];
}

/* ------------------------------------------------------------------ region */

function tarjetasRegion(d: Datos): Tarjeta[] {
  const I = d.ind?.indicadores;
  const shf = I?.shf;
  const sesnsp = I?.sesnsp;
  const ensu = I?.ensu;

  const bc = shf?.series["Baja California"];
  const nac = shf?.series["Nacional"];
  const vivienda: Tarjeta = {
    etiqueta: "Vivienda en Baja California, variación anual",
    valor: bc === undefined ? "sin dato" : <Signo v={bc.variacion_anual_pct} />,
    hueco: bc === undefined,
    frase:
      shf === undefined
        ? "Sin indicadores oficiales en este corte."
        : F.fraseViviendaRegion(bc, nac, shf.periodo),
    fuente:
      shf === undefined
        ? undefined
        : `${shf.fuente}, ${periodoLegible(shf.periodo)}. Solo Tijuana y Mexicali tienen índice municipal.`,
  };

  let crimen: Tarjeta;
  if (sesnsp === undefined) {
    crimen = {
      etiqueta: "Delitos reportados",
      valor: "sin dato",
      hueco: true,
      frase: "Sin serie de delitos en este corte.",
    };
  } else {
    const series = MUNICIPIOS_BC.map((z) => sesnsp.municipios[z]).filter(
      (x): x is NonNullable<typeof x> => x !== undefined && x.por_mes.length > 0,
    );
    const n = series.length === 0 ? 0 : Math.min(...series.map((x) => x.por_mes.length));
    const suma = (i: number) => series.reduce((acc, x) => acc + (x.por_mes[i] ?? 0), 0);
    const ultimo = n === 0 ? undefined : suma(n - 1);
    const previo = n < 2 ? undefined : suma(n - 2);
    crimen = {
      etiqueta:
        ultimo === undefined
          ? "Delitos reportados"
          : `Delitos reportados en ${nombreMes(n - 1)}, siete municipios`,
      valor:
        ultimo === undefined ? (
          "sin dato"
        ) : (
          <>
            {numero(ultimo)}{" "}
            <span className="text-base">
              <Signo v={F.variacionPct(ultimo, previo)} invertir />
            </span>
          </>
        ),
      hueco: ultimo === undefined,
      frase: F.fraseCrimenRegion(sesnsp, MUNICIPIOS_BC),
      fuente: `${sesnsp.fuente}, ${sesnsp.periodo ?? "sin periodo"}. Delitos reportados, no ocurridos; no es per cápita.`,
    };
  }

  let percepcion: Tarjeta;
  if (ensu === undefined) {
    percepcion = {
      etiqueta: "Se sienten inseguros",
      valor: "sin dato",
      hueco: true,
      frase: "Sin ENSU en este corte.",
    };
  } else {
    const tj = ensu.ciudades["Tijuana"]?.pct_inseguro ?? null;
    const mx = ensu.ciudades["Mexicali"]?.pct_inseguro ?? null;
    const nacional = ensu.nacional.pct_inseguro;
    const partes: string[] = [];
    if (tj !== null) partes.push(`en Tijuana ${F.decimal(tj)}%`);
    if (mx !== null) partes.push(`en Mexicali ${F.decimal(mx)}%`);
    const cuerpo =
      partes.length === 0
        ? "Sin cifra de percepción en este corte."
        : `Se sienten inseguros ${partes.join(" y ")} de quienes tienen 18 años y más${
            nacional === null ? "" : `; el promedio nacional es ${F.decimal(nacional)}%`
          } (ENSU, ${periodoLegible(ensu.periodo)}).`;
    percepcion = {
      etiqueta: "Se sienten inseguros, Tijuana y Mexicali",
      valor:
        tj === null && mx === null
          ? "sin dato"
          : `${tj === null ? "s/d" : `${F.decimal(tj)}%`} y ${mx === null ? "s/d" : `${F.decimal(mx)}%`}`,
      hueco: tj === null && mx === null,
      frase: `${cuerpo} Las otras cinco zonas nunca han estado en la muestra.`,
      fuente: `${ensu.fuente}, ${periodoLegible(ensu.periodo)}. La única medición de percepción con muestra probabilística.`,
    };
  }

  return [
    vivienda,
    crimen,
    percepcion,
    tarjetaTema(d, null, "la región"),
    tarjetaPrensa(d, null, "la región"),
    tarjetaConversacion(d, null, "la región"),
  ];
}

/* --------------------------------------------------------------- san diego */

function tarjetasSanDiego(d: Datos): Tarjeta[] {
  const sd = d.ind?.indicadores.san_diego;
  const z = sd?.zips["92173"];
  const catastral: Tarjeta = {
    etiqueta: "Valor catastral mediano en San Ysidro (92173)",
    valor: z === undefined ? "sin dato" : dolares(z.mediana_usd),
    hueco: z === undefined,
    frase:
      sd === undefined
        ? "Sin padrón catastral en este corte."
        : F.fraseSanDiego(sd.zips, ZIPS_FRONTERA),
    fuente:
      sd === undefined
        ? undefined
        : `${sd.fuente}. La Proposición 13 congela la base gravable hasta que la casa cambia de dueño.`,
  };
  return [
    catastral,
    tarjetaTema(d, "San Diego", "San Diego"),
    tarjetaPrensa(d, "San Diego", "San Diego"),
    tarjetaConversacion(d, "San Diego", "San Diego"),
  ];
}

/* ------------------------------------------------------------- comparativo */

function Comparativo({ d }: { d: Datos }) {
  const sesnsp = d.ind?.indicadores.sesnsp;
  const largo = sesnsp === undefined
    ? 0
    : Math.max(0, ...Object.values(sesnsp.municipios).map((m) => m.por_mes.length));
  const mes = largo === 0 ? "último mes" : nombreMes(largo - 1);
  return (
    <div className="mt-8 border-t border-vela pt-6">
      <h3 className="text-base tracking-tight text-tinta-titulo">Comparativo por zona</h3>
      <p className="mt-1 text-xs text-tinta-prosa">
        Toca una zona para ver solo sus cifras. Los delitos no son per cápita: comparan
        volumen, no riesgo.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
          <thead>
            <tr className="text-left text-2xs text-tinta-meta">
              <th className="py-2 font-normal">Zona</th>
              <th className="py-2 text-right font-normal">Notas, {d.estado.ventana_dias} días</th>
              <th className="py-2 text-right font-normal">Delitos en {mes}</th>
              <th className="py-2 text-right font-normal">Comentarios</th>
            </tr>
          </thead>
          <tbody>
            {ZONAS_RUTA.map((z) => {
              const m = sesnsp?.municipios[z];
              const ultimo = m === undefined ? undefined : m.por_mes[m.por_mes.length - 1];
              return (
                <tr key={z} className="border-t border-vela">
                  <td className="py-2">
                    <Link
                      href={rutaDeZona(z)}
                      className="text-tinta-dato transition-colors duration-700 ease-firma hover:text-chart-1"
                    >
                      {NOMBRE_CORTO[z]}
                    </Link>
                  </td>
                  <td className="py-2 text-right tabular-nums text-tinta-dato">
                    {numero(d.estado.por_zona[z] ?? 0)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-tinta-dato">
                    {ultimo === undefined ? (
                      <Hueco titulo="El SESNSP mide municipios de Baja California">no aplica</Hueco>
                    ) : (
                      numero(ultimo)
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums text-tinta-dato">
                    {numero(d.conv?.por_zona[z] ?? 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- resumen */

export function ResumenZona({ zona }: { zona: ZonaRuta | null }) {
  const { data: estado, error } = useEstado();
  const { data: ind } = useIndicadores();
  const { data: temas } = useTemas();
  const { data: conv } = useConversacion();
  const { data: notas } = useNotas();

  if (estado === undefined) {
    // Sin estado.json la banda ya lo dice en rojo; aqui no hay nada que resumir.
    return error === undefined ? <Esqueleto className="h-[360px]" /> : null;
  }

  const d: Datos = { estado, ind, temas, conv, notas };
  const sujeto = zona === null ? "la región" : NOMBRE_CORTO[zona];
  const tarjetas =
    zona === null
      ? tarjetasRegion(d)
      : zona === "San Diego"
        ? tarjetasSanDiego(d)
        : tarjetasMunicipio(zona, d);

  const tono = tonoPorZona(notas, zona);
  const sentimiento =
    zona === null ? conv?.sentimiento : conv?.por_zona_detalle?.[zona]?.sentimiento;
  const brecha = F.fraseBrecha(tono, sentimiento, sujeto);
  const totalFuentes = estado.fuentes_ok + estado.fuentes_fallo;

  return (
    <Bisel opaco interior="p-6 md:p-8">
      <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map((t) => (
          <Kpi key={t.etiqueta} {...t} />
        ))}
      </div>

      {brecha === null || tono === undefined || sentimiento === undefined ? null : (
        <div className="mt-8 rounded-nucleo border border-filo p-5">
          <p className="max-w-[70ch] text-sm leading-snug text-tinta-dato">{brecha}</p>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-2xs text-tinta-meta">Tono de los titulares</p>
              <div className="mt-2">
                <BarraTono t={tono} ariaLabel={`Tono de los titulares sobre ${sujeto}`} />
              </div>
            </div>
            <div>
              <p className="text-2xs text-tinta-meta">Sentimiento de los comentarios</p>
              <div className="mt-2">
                <BarraSentimiento
                  s={sentimiento}
                  ariaLabel={`Sentimiento de los comentarios sobre ${sujeto}`}
                />
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-tinta-prosa">
            Titulares y comentarios miden cosas distintas; no se suman.
          </p>
        </div>
      )}

      {zona === null ? <Comparativo d={d} /> : null}

      <p className="mt-8 border-t border-vela pt-4 text-xs leading-relaxed text-tinta-meta">
        Corte del {fechaLarga(estado.generado)} a las {hora(estado.generado)}.{" "}
        {estado.fuentes_ok} de {totalFuentes} fuentes respondieron. Archivo:{" "}
        {numero(estado.notas_archivadas)} notas en {estado.archivos} meses.
      </p>
    </Bisel>
  );
}
