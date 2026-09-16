import type { RespuestaGaritas } from "./tipos";

/**
 * La descarga del reporte que esta en pantalla.
 *
 * Se exporta la respuesta tal como llego, no la tabla que se dibuja. La tabla
 * es una lectura: omite el Ready Lane peatonal de Otay —que repite al general
 * con la misma cifra— y convierte los huecos en palabras («Sin dato»,
 * «Actualizacion pendiente»). Un archivo que tradujera de vuelta esas palabras
 * a numeros pondria un 0 donde CBP no reporto nada, que es justo el relleno de
 * huecos que el producto no hace: `minutos` y `abiertos` viajan en `null`.
 *
 * Tampoco lleva la hora de la descarga. La que importa ya esta dentro:
 * `consultado` dice cuando se pregunto, y cada carril trae su `observado`, que
 * es la unica de las dos que fecha el dato. Una tercera solo haria que dos
 * descargas del mismo reporte se vieran distintas.
 */

/**
 * El nombre lleva la hora de Tijuana, la misma que muestra la pagina. Con UTC
 * el archivo se llamaria con una hora que no aparece en ninguna parte de la
 * pantalla, y son siete horas de diferencia: bastante para cambiar el dia.
 */
const NOMBRE = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Tijuana",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function nombreArchivo(consultado: string): string {
  const fecha = new Date(consultado);
  if (Number.isNaN(fecha.getTime())) return "garitas.json";
  const partes = new Map(NOMBRE.formatToParts(fecha).map((p) => [p.type, p.value]));
  const pieza = (tipo: Intl.DateTimeFormatPart["type"]) => partes.get(tipo) ?? "";
  return `garitas-${pieza("year")}${pieza("month")}${pieza("day")}-${pieza("hour")}${pieza("minute")}.json`;
}

/**
 * Con sangria de un espacio y salto final, como el resto del JSON del proyecto
 * (`pulso/pipeline.py`), para que un archivo descargado y uno del repositorio
 * se puedan comparar linea a linea.
 */
export const serializar = (datos: RespuestaGaritas): string => `${JSON.stringify(datos, null, 1)}\n`;

/** Devuelve el nombre del archivo entregado, para poder anunciarlo. */
export function descargar(datos: RespuestaGaritas): string {
  const nombre = nombreArchivo(datos.consultado);
  const url = URL.createObjectURL(new Blob([serializar(datos)], { type: "application/json" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  // Revocar en el mismo tick cancela la descarga en algunos navegadores: el
  // click la inicia, pero el blob se lee despues. Se libera en el siguiente.
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return nombre;
}
