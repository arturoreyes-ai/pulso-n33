import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { Carril, Cruce, RespuestaGaritas } from "./tipos";

export const FUENTE_CBP = "https://bwt.cbp.gov/xml/bwt.xml";
type Nodo = Record<string, unknown>;
const nodo = (valor: unknown): Nodo => valor !== null && typeof valor === "object" && !Array.isArray(valor) ? valor as Nodo : {};
const cadena = (valor: unknown): string => typeof valor === "string" ? valor.trim() : "";
const entero = (valor: unknown): number | null => {
  const texto = cadena(valor);
  return /^\d+$/.test(texto) && Number.isSafeInteger(Number(texto)) ? Number(texto) : null;
};

/** CBP fecha cada puerto y cada carril por separado; la hora de descarga no es una observacion. */
export function fechaObservada(fecha: string, hora: string): string | null {
  const dia = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(fecha);
  const reloj = /^At (?:(\d{1,2}):(\d{2}) (am|pm)|(Noon|Midnight)) (PDT|PST)$/i.exec(hora);
  if (!dia || !reloj) return null;
  const mes = Number(dia[1]), numero = Number(dia[2]), anio = Number(dia[3]);
  const prueba = new Date(Date.UTC(anio, mes - 1, numero));
  if (prueba.getUTCMonth() !== mes - 1 || prueba.getUTCDate() !== numero) return null;
  let horas = reloj[4]?.toLowerCase() === "noon" ? 12 : 0;
  const minutos = Number(reloj[2] ?? 0);
  if (reloj[1]) {
    const valor = Number(reloj[1]);
    if (valor < 1 || valor > 12 || minutos > 59) return null;
    horas = valor % 12 + (reloj[3]?.toLowerCase() === "pm" ? 12 : 0);
  }
  const desfase = reloj[5]?.toUpperCase() === "PDT" ? 7 : 8;
  return new Date(Date.UTC(anio, mes - 1, numero, horas + desfase, minutos)).toISOString();
}

function carriles(puerto: Nodo, viajero: Carril["viajero"], acceso: string): Carril[] {
  const grupo = nodo(puerto[viajero === "vehiculo" ? "passenger_vehicle_lanes" : "pedestrian_lanes"]);
  const categorias = [
    ["standard_lanes", "general", "General"],
    ["ready_lanes", "ready", "Ready Lane"],
    ...(viajero === "vehiculo" ? [["NEXUS_SENTRI_lanes", "sentri", "SENTRI"]] : []),
  ] as const;
  return categorias.map(([clave, categoria, nombre]) => {
    const datos = nodo(grupo[clave!]);
    const estado = cadena(datos.operational_status).toLowerCase();
    const cerrado = cadena(puerto.port_status).toLowerCase() === "closed" || estado === "closed";
    const reportado = estado === "delay" || estado === "no delay";
    return {
      categoria: categoria as Carril["categoria"], nombre: nombre!, viajero, acceso,
      estado: cerrado ? "cerrado" : reportado ? "reportado" : estado === "update pending" ? "pendiente" : "no_disponible",
      // Incluso "no delay" puede traer 5 minutos: nunca inferir cero del rotulo.
      minutos: !cerrado && reportado ? entero(datos.delay_minutes) : null,
      abiertos: !cerrado && reportado ? entero(datos.lanes_open) : null,
      observado: fechaObservada(cadena(puerto.date), cadena(datos.update_time)),
    };
  });
}

export function parsearCbp(xml: string, ahora: string): RespuestaGaritas {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error("XML inválido");
  const raiz = nodo(new XMLParser({ parseTagValue: false, processEntities: false }).parse(xml));
  const documento = nodo(raiz.border_wait_time);
  const lista = Array.isArray(documento.port) ? documento.port : documento.port ? [documento.port] : [];
  if (!lista.length) throw new Error("CBP no devolvió puertos");
  const puertos = lista.map(nodo);
  const buscar = (id: string) => {
    const encontrados = puertos.filter((p) => cadena(p.port_number) === id);
    if (encontrados.length > 1) throw new Error("Puerto duplicado");
    return encontrados[0] ?? {};
  };
  // Verificados contra el XML el 8-sep-2026. Otay 250609/250608 son registros pendientes; CBX es otro cruce.
  const cruces: Cruce[] = [
    { id: "san_ysidro", nombre: "San Ysidro", direccion: "norte", carriles: [
      ...carriles(buscar("250401"), "vehiculo", "Principal"),
      ...carriles(buscar("250401"), "peaton", "Principal"),
      ...carriles(buscar("250407"), "peaton", "PedWest"),
    ] },
    { id: "otay_mesa", nombre: "Otay Mesa", direccion: "norte", carriles: [
      ...carriles(buscar("250601"), "vehiculo", "Principal"),
      ...carriles(buscar("250601"), "peaton", "Principal"),
    ] },
  ];
  if (!puertos.some((p) => ["250401", "250601"].includes(cadena(p.port_number)))) throw new Error("Faltan los cruces esperados");
  return { consultado: ahora, fuente: "https://bwt.cbp.gov/", cruces };
}

export async function responderGaritas(solicitar: typeof fetch = fetch, ahora = new Date().toISOString()): Promise<Response> {
  const cabeceras = { "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" };
  try {
    const respuesta = await solicitar(FUENTE_CBP, {
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000),
      headers: { Accept: "application/xml, text/xml" },
    });
    if (!respuesta.ok || !respuesta.body) throw new Error("Fuente no disponible");
    const lector = respuesta.body.getReader();
    const decodificador = new TextDecoder();
    let xml = "", bytes = 0;
    try {
      for (;;) {
        const { done: terminado, value: bloque } = await lector.read();
        if (terminado) break;
        bytes += bloque.byteLength;
        if (bytes > 2 * 1024 * 1024) throw new Error("Respuesta demasiado grande");
        xml += decodificador.decode(bloque, { stream: true });
      }
      xml += decodificador.decode();
    } finally { await lector.cancel(); }
    return Response.json(parsearCbp(xml, ahora), {
      headers: { ...cabeceras, "Cache-Control": "public, max-age=0, s-maxage=300, must-revalidate" },
    });
  } catch {
    return Response.json({ error: "No fue posible consultar CBP. Intenta de nuevo en un minuto." }, {
      status: 502, headers: { ...cabeceras, "Cache-Control": "no-store" },
    });
  }
}
