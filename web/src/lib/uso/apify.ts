/**
 * Lo que Apify COBRO, preguntado a Apify.
 *
 * Por que no sumar los libros del tablero: la cosecha de cada seis horas
 * (pulso redes, tiktok, facebook, tendencias) y los comandos a mano
 * (consultas, expediente-redes) anotan RESULTADOS, no dolares
 * (pulso/apify.py::Presupuesto), y son la mayor parte del gasto: el 26 de
 * octubre de 2026 la cuenta llevaba 158.06 USD del ciclo y la busqueda en
 * vivo y /seguimiento juntos no llegaban a una fraccion de eso. La cuenta de
 * Apify es la factura; los libros dicen de quien fue una parte.
 *
 * Tres llamadas de solo lectura, con el token que ya usa la busqueda en
 * vivo (redes-en-vivo/config.ts::tokenApify):
 *  - `users/me/limits`: el tope mensual de la cuenta y lo gastado del ciclo.
 *  - `users/me/usage/monthly?date=`: el cobro por dia del ciclo que contiene
 *    esa fecha. Los dias de Apify son UTC, los del tablero de Tijuana: un
 *    periodo puede correrse unas horas en el borde, y se dice.
 *  - `actor-runs`: cada corrida con `usageTotalUsd`, para repartir por actor.
 *    Se pagina hacia atras hasta salir del periodo, con tope de paginas: el
 *    26 de octubre la cuenta tenia 11,262 corridas.
 */

import { tokenApify } from "@/lib/redes-en-vivo/config";
import { diaSiguiente, medianocheEnZona, type Periodo } from "./periodo";

const API = "https://api.apify.com/v2";
const POR_PAGINA = 1000;
const PAGINAS_MAXIMO = 15;
const MS_LIMITE = 20_000;

/** Para que el presidente lea «Instagram» y no un id. Lo que no esta aqui
 *  sale con el nombre que da Apify. */
const RED_DE_ACTOR: Record<string, string> = {
  // Un solo actor para publicaciones, comentarios y etiquetas: cambia
  // `resultsType`, no el actor.
  "apify/instagram-scraper": "Instagram: publicaciones y comentarios",
  "clockworks/tiktok-scraper": "TikTok: videos",
  "clockworks/tiktok-comments-scraper": "TikTok: comentarios",
  "apify/facebook-posts-scraper": "Facebook: publicaciones",
  "apify/facebook-comments-scraper": "Facebook: comentarios",
  "automation-lab/twitter-trends-scraper": "X: tendencias",
  "scraper_one/facebook-posts-search": "Facebook: búsqueda por palabra (búsqueda en vivo)",
};

export class SinApify extends Error {}

async function pedir<T>(ruta: string, token: string): Promise<T> {
  const r = await fetch(`${API}/${ruta}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(MS_LIMITE),
  });
  if (!r.ok) throw new Error(`Apify contestó ${r.status} a ${ruta.split("?")[0]}`);
  return ((await r.json()) as { data: T }).data;
}

type Servicio = { baseAmountUsd?: number; amountAfterVolumeDiscountUsd?: number };
type Mensual = {
  usageCycle: { startAt: string; endAt: string };
  dailyServiceUsages: { date: string; serviceUsage: Record<string, Servicio> }[];
  monthlyServiceUsage: Record<string, Servicio>;
  totalUsageCreditsUsdAfterVolumeDiscount: number;
};
type Limites = {
  monthlyUsageCycle: { startAt: string; endAt: string };
  limits: { maxMonthlyUsageUsd: number };
  current: { monthlyUsageUsd: number };
};

const redondo = (n: number) => Math.round(n * 100) / 100;

export type CuentaApify = {
  ciclo: { inicio: string; fin: string; usd_gastado: number; usd_tope: number; usd_disponible: number };
  periodo_usd: number;
  por_dia: { dia: string; usd: number }[];
  por_servicio_del_ciclo: { servicio: string; usd: number }[];
};

export async function cuentaApify(p: Periodo): Promise<CuentaApify> {
  const token = tokenApify();
  if (token === "") throw new SinApify("No hay token de Apify en este despliegue.");
  // El ciclo de cada extremo del periodo; casi siempre es uno solo.
  const fechas = [...new Set([p.desde, p.hasta])];
  const [limites, ...mensuales] = await Promise.all([
    pedir<Limites>("users/me/limits", token),
    ...fechas.map((f) => pedir<Mensual>(`users/me/usage/monthly?date=${f}`, token)),
  ]);
  const dias = new Map<string, number>();
  for (const m of mensuales) {
    for (const d of m.dailyServiceUsages) {
      const dia = d.date.slice(0, 10);
      if (dia < p.desde || dia > p.hasta) continue;
      const usd = Object.values(d.serviceUsage).reduce((s, v) => s + (v.amountAfterVolumeDiscountUsd ?? v.baseAmountUsd ?? 0), 0);
      dias.set(dia, usd);
    }
  }
  const porDia = [...dias.entries()].toSorted(([a], [b]) => a.localeCompare(b)).map(([dia, usd]) => ({ dia, usd: redondo(usd) }));
  const ciclo = mensuales.find((m) => m.usageCycle.startAt === limites.monthlyUsageCycle.startAt) ?? mensuales.at(-1);
  return {
    ciclo: {
      inicio: limites.monthlyUsageCycle.startAt.slice(0, 10),
      fin: limites.monthlyUsageCycle.endAt.slice(0, 10),
      usd_gastado: redondo(limites.current.monthlyUsageUsd),
      usd_tope: limites.limits.maxMonthlyUsageUsd,
      usd_disponible: redondo(limites.limits.maxMonthlyUsageUsd - limites.current.monthlyUsageUsd),
    },
    periodo_usd: redondo([...dias.values()].reduce((s, v) => s + v, 0)),
    por_dia: porDia,
    por_servicio_del_ciclo: Object.entries(ciclo?.monthlyServiceUsage ?? {})
      .map(([servicio, v]) => ({ servicio, usd: redondo(v.amountAfterVolumeDiscountUsd ?? v.baseAmountUsd ?? 0) }))
      .filter((s) => s.usd > 0)
      .toSorted((a, b) => b.usd - a.usd),
  };
}

type Corrida = { actId: string; startedAt: string; usageTotalUsd?: number; status: string };

export type FilaActor = { actor: string; que_es: string; corridas: number; usd_total: number; usd_por_corrida: number };

export async function gastoPorActor(p: Periodo, limiteMs: number): Promise<{ actores: FilaActor[]; completo: boolean }> {
  const inicioReloj = Date.now();
  const token = tokenApify();
  if (token === "") throw new SinApify("No hay token de Apify en este despliegue.");
  const inicio = medianocheEnZona(p.desde).toISOString();
  const fin = medianocheEnZona(diaSiguiente(p.hasta)).toISOString();
  const suma = new Map<string, { corridas: number; usd: number }>();
  let completo = false;
  for (let pagina = 0; pagina < PAGINAS_MAXIMO && Date.now() - inicioReloj < limiteMs; pagina++) {
    const datos = await pedir<{ items: Corrida[] }>(`actor-runs?desc=1&limit=${POR_PAGINA}&offset=${pagina * POR_PAGINA}`, token);
    for (const c of datos.items) {
      if (c.startedAt >= fin || c.startedAt < inicio) continue;
      const s = suma.get(c.actId) ?? { corridas: 0, usd: 0 };
      s.corridas += 1;
      s.usd += c.usageTotalUsd ?? 0;
      suma.set(c.actId, s);
    }
    const ultima = datos.items.at(-1);
    if (datos.items.length < POR_PAGINA || ultima === undefined || ultima.startedAt < inicio) {
      completo = true;
      break;
    }
  }
  const nombres = await Promise.all([...suma.keys()].map(async (id) => {
    try {
      const a = await pedir<{ username: string; name: string; title?: string }>(`acts/${id}`, token);
      return [id, `${a.username}/${a.name}`, a.title ?? ""] as const;
    } catch {
      return [id, id, ""] as const;
    }
  }));
  const actores = nombres.map(([id, nombre, titulo]) => {
    const s = suma.get(id) ?? { corridas: 0, usd: 0 };
    return {
      actor: nombre,
      que_es: RED_DE_ACTOR[nombre] ?? titulo,
      corridas: s.corridas,
      usd_total: redondo(s.usd),
      usd_por_corrida: s.corridas > 0 ? Math.round((s.usd / s.corridas) * 10_000) / 10_000 : 0,
    };
  });
  return { actores: actores.toSorted((a, b) => b.usd_total - a.usd_total), completo };
}
