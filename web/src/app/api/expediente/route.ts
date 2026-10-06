import type { NextRequest } from "next/server";

import { respuestaError } from "@/lib/acceso/http";
import { requerirAdmin } from "@/lib/acceso/sesion";
import { responderExpedientePdf } from "@/lib/expedientes/pdf";

/**
 * El expediente de /reportes en PDF. Solo administradores, como la pagina:
 * lleva texto de comentarios leido de la base. Sin cache por la misma razon
 * (lib/expedientes/pdf.ts). Un minuto: el render va en serie con la base.
 */
export const maxDuration = 60;

export async function GET(peticion: NextRequest): Promise<Response> {
  try {
    await requerirAdmin();
  } catch (error) {
    return respuestaError(error);
  }
  return responderExpedientePdf({ e: peticion.nextUrl.searchParams.get("e") });
}
