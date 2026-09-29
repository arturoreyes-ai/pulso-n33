import type { SUELTAS } from "@/lib/dominio/secciones";
import { PROGRAMAS_GUION, type ProgramaGuion } from "./contrato-guion";

/**
 * La URL de /guion: que programa. Pura, para que la pagina de servidor la lea
 * y los botones de las barras y los enlaces de la pagina la construyan con la
 * misma funcion.
 *
 * EL ESTADO VA EN LA URL (28 de septiembre de 2026), y es la razon de que el
 * guion tenga pagina: en la hoja el programa elegido vivia en memoria, asi que
 * «el guion de Minuta Política» no se podia guardar ni mandarse al equipo.
 * `?p=` es el programa, corto como `?e=`, `?q=` y `?t=` de la portada, y el
 * mismo nombre que ya lleva /api/guion-*.
 *
 * Hubo `?f=` unas horas ese mismo dia, el material (noticias o redes), hasta
 * que el cliente pidio un solo guion con los dos (guion-mixto.ts). Un enlace
 * guardado con `?f=` abre el mismo programa: el parametro se ignora.
 *
 * ABRIR UNA URL CON PROGRAMA PIDE SU GUION: el enlace es la pulsacion. Sin
 * `?p=` la pagina monta con los enlaces y no pide nada, como la hoja. Un
 * `<Link>` que prefetchea /guion?p=… no paga: el prefetch trae el arbol de
 * servidor, y el guion lo pide el cliente al montar.
 */
export const PARAM_PROGRAMA = "p";

/** La ruta de la suelta, comprobada contra la lista de la nav: si alguien la
 *  renombra alli, esto deja de compilar. */
const RUTA = "/guion" satisfies (typeof SUELTAS)[number]["ruta"];

export function rutaGuion(programa: ProgramaGuion | null = null): string {
  return programa === null ? RUTA : `${RUTA}?${new URLSearchParams({ [PARAM_PROGRAMA]: programa })}`;
}

/** Lo que dice la URL. Un valor desconocido es ninguno, no un error: un
 *  enlace viejo o mal copiado abre la pagina, sin pedir un guion que no es. */
export function leerRutaGuion(params: { [clave: string]: string | string[] | undefined }): { programa: ProgramaGuion | null } {
  const p = params[PARAM_PROGRAMA];
  return { programa: PROGRAMAS_GUION.find((x) => x === p) ?? null };
}
