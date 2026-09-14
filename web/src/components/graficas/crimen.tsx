"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { PanelSesnsp } from "@/lib/datos/tipos";
import { MESES_CORTOS, nombreMes, numero } from "@/lib/dominio/formato";
import { fraseCrimen } from "@/lib/dominio/frases";
import { EJE, SERIES } from "@/lib/graficas/paleta";
import { Marco } from "./marco";

const ESTILO_TOOLTIP = {
  background: "var(--color-carta)",
  border: "1px solid var(--color-filo)",
  borderRadius: "var(--radius-etiqueta)",
  fontSize: 11,
} as const;

const ESTILO_ETIQUETA = { color: "var(--color-tinta-prosa)" } as const;

/**
 * Delitos reportados por mes. Es la UNICA serie de tiempo real del conjunto
 * de datos, y por eso es donde una grafica se gana su lugar.
 *
 * Con `municipio` es una sola grafica, con eje de meses, para la pagina de
 * una zona. Sin el, son pequenos multiplos: uno por municipio, y no una sola
 * grafica comparativa porque los totales NO son per capita. La lectura
 * honesta es la tendencia de cada municipio contra si mismo.
 */
export default function Crimen({
  panel,
  municipio,
}: {
  panel: PanelSesnsp;
  municipio?: string;
}) {
  if (municipio !== undefined) return <CrimenZona panel={panel} municipio={municipio} />;

  const municipios = Object.entries(panel.municipios)
    .filter(([, m]) => m.por_mes.length > 1)
    .toSorted((a, b) => b[1].total - a[1].total);

  if (municipios.length === 0) {
    return <p className="text-meta text-tinta-meta">Sin serie mensual.</p>;
  }

  const filas = municipios.map(([nombre, m]) => ({
    etiqueta: nombre,
    valor: `${numero(m.total)} en el año; ${m.por_mes.map((v) => numero(v)).join(" / ")}`,
  }));

  const resumen =
    "Delitos reportados por mes en cada municipio de Baja California, de enero a " +
    (panel.periodo ?? "el último mes disponible") +
    ". " +
    municipios.map(([n, m]) => `${n}: ${numero(m.total)} en el año`).join("; ") +
    ".";

  return (
    <Marco
      id="g-crimen"
      titulo={`Delitos reportados por mes, ${panel.periodo ?? ""}`}
      resumen={resumen}
      filas={filas}
    >
      <div className="h-full w-full overflow-x-auto">
        {/* Cuatro columnas fijas: el min-w garantiza el espacio y el scroll
            horizontal lo resuelve en pantallas chicas. */}
        <div className="grid min-w-[640px] grid-cols-4 gap-x-6 gap-y-2">
          {municipios.map(([nombre, m], i) => {
            const datos = m.por_mes.map((v, k) => ({
              mes: MESES_CORTOS[k] ?? String(k + 1),
              n: v,
            }));
            const color = SERIES[i % SERIES.length];
            return (
              <div key={nombre} className="min-w-0">
                <p className="truncate text-meta text-tinta-meta">{nombre}</p>
                <p className="text-cuerpo tabular-nums text-tinta-titulo">{numero(m.total)}</p>
                {/* Altura en PIXELES: ResponsiveContainer mide con
                    ResizeObserver y solo el ancho tiene que ser responsivo. */}
                <div className="h-[76px]">
                  <ResponsiveContainer width="100%" height={76}>
                    <AreaChart data={datos} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
                      <defs>
                        <linearGradient id={`g-${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="mes" hide />
                      <YAxis hide domain={[0, "dataMax"]} />
                      <Tooltip
                        contentStyle={ESTILO_TOOLTIP}
                        labelStyle={ESTILO_ETIQUETA}
                        formatter={(v) => [numero(Number(v)), "delitos"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="n"
                        stroke={color}
                        strokeWidth={1.5}
                        fill={`url(#g-${i})`}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Marco>
  );
}

function CrimenZona({ panel, municipio }: { panel: PanelSesnsp; municipio: string }) {
  const m = panel.municipios[municipio];
  if (m === undefined || m.por_mes.length === 0) {
    return (
      <p className="text-meta text-tinta-meta">Sin serie mensual para {municipio}.</p>
    );
  }
  const datos = m.por_mes.map((v, k) => ({ mes: MESES_CORTOS[k] ?? String(k + 1), n: v }));
  const filas = m.por_mes.map((v, k) => ({ etiqueta: nombreMes(k), valor: numero(v) }));
  const color = SERIES[0];

  return (
    <Marco
      id="g-crimen-zona"
      titulo={`Delitos reportados por mes en ${municipio}`}
      resumen={fraseCrimen(m, municipio)}
      filas={filas}
      alto="h-[220px]"
    >
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="g-zona" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 11, fill: EJE }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide domain={[0, "dataMax"]} />
          <Tooltip
            contentStyle={ESTILO_TOOLTIP}
            labelStyle={ESTILO_ETIQUETA}
            formatter={(v) => [numero(Number(v)), "delitos"]}
          />
          <Area
            type="monotone"
            dataKey="n"
            stroke={color}
            strokeWidth={1.5}
            fill="url(#g-zona)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Marco>
  );
}
