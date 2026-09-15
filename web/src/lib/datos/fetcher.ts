export class ErrorDatos extends Error {
  constructor(
    readonly ruta: string,
    readonly status: number,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorDatos";
  }
}

/**
 * Lector unico para todos los JSON.
 *
 * Sin `cache: "no-store"` a proposito. El tablero anterior lo usaba porque no
 * tenia cache de cliente; aqui derrotaria el cache del navegador Y el
 * s-maxage del CDN, y SWR en modo inmutable ya garantiza una sola peticion
 * por sesion.
 */
export async function leerJson<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  const r = await fetch(ruta, opciones);
  if (!r.ok) {
    throw new ErrorDatos(ruta, r.status, `${ruta} respondio ${r.status}`);
  }
  // Un 200 con HTML es el modo de falla real de estas rutas: un host mal
  // configurado devuelve su pagina de error. Sin este chequeo el mensaje que
  // ve el usuario es un SyntaxError de JSON, que no dice nada.
  const tipo = r.headers.get("content-type") ?? "";
  if (!tipo.includes("json")) {
    throw new ErrorDatos(ruta, r.status, `${ruta} devolvio ${tipo || "sin tipo"}, no JSON`);
  }
  return (await r.json()) as T;
}
