/**
 * Errores con estado HTTP para las rutas de la API.
 *
 * Todo lo que hay debajo (sesion.ts, usuarios.ts) lanza `ErrorApi`, y toda
 * ruta termina en `catch (error) { return respuestaError(error); }`. Un error
 * que no es `ErrorApi` es un bug, se registra completo en el servidor y sale
 * como 500 sin detalle: el mensaje interno no es para el navegador.
 */
export class ErrorApi extends Error {
  constructor(
    public readonly estado: number,
    mensaje: string,
    public readonly detalles?: unknown,
  ) {
    super(mensaje);
    this.name = "ErrorApi";
  }
}

export function respuestaError(error: unknown): Response {
  if (error instanceof ErrorApi) {
    return jsonSinCache(
      { detalle: error.message, detalles: error.detalles },
      { status: error.estado },
    );
  }
  console.error(error);
  return jsonSinCache({ detalle: "Error interno" }, { status: 500 });
}

/** JSON que depende de quien pregunta: nunca lo puede guardar un cache compartido. */
export function jsonSinCache(valor: unknown, init?: ResponseInit): Response {
  const cabeceras = new Headers(init?.headers);
  cabeceras.set("Cache-Control", "no-store");
  return Response.json(valor, { ...init, headers: cabeceras });
}

export async function cuerpoJson(peticion: Request): Promise<unknown> {
  try {
    return await peticion.json();
  } catch {
    throw new ErrorApi(400, "Se esperaba un cuerpo JSON válido");
  }
}
