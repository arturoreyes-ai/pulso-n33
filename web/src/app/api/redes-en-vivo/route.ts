import type { NextRequest } from "next/server";

import { responderEstado, responderInicio } from "@/lib/redes-en-vivo/responder";

/**
 * La busqueda PAGADA de un termino en TikTok, Instagram y Facebook.
 *
 * POST con `{ q }` la arranca y vuelve con su id; GET con `id` y `q` dice como
 * va y trae lo que ya se tiene. Es POST y no GET porque cuesta: un GET se
 * puede disparar solo —una precarga, un rastreador, un enlace pegado— y aqui
 * cada disparo es dinero. El GET de estado no cuesta nada que no se haya
 * pagado ya.
 *
 * Delgada como las demas: la logica, los topes y la razon de cada uno viven
 * en lib/redes-en-vivo/responder.ts, que scripts/probar-redes-en-vivo.cjs
 * prueba sin red ni base de datos. proxy.ts exige sesion para llegar aqui, y
 * el POST ademas la lee para contar el tope diario por persona.
 *
 * 60 s: el POST arranca tres corridas y el GET puede leer seis conjuntos de
 * datos y esperar al servicio de tono.
 */
export const maxDuration = 60;

export async function POST(peticion: NextRequest): Promise<Response> {
  let cuerpo: unknown = null;
  try {
    cuerpo = await peticion.json();
  } catch {
    cuerpo = null;
  }
  return responderInicio(cuerpo);
}

export async function GET(peticion: NextRequest): Promise<Response> {
  const params = peticion.nextUrl.searchParams;
  return responderEstado(params.get("id"), params.get("q"));
}
