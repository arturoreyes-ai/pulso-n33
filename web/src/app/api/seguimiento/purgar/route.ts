import type { NextRequest } from "next/server";

import { responderPurga } from "@/lib/seguimiento/responder";

/**
 * El borrado diario del texto vencido (15 dias), que llama el cron de Vercel
 * (web/vercel.json). Es la UNICA ruta de la API sin sesion ademas de
 * /api/garitas, porque el cron no la trae (lib/acceso/rutas-publicas.ts);
 * la protege `CRON_SECRET`, que Vercel manda como `Authorization: Bearer`.
 * Sin esa variable la ruta contesta 401 siempre, y el texto se sigue borrando
 * en cada visita a /seguimiento.
 */
export async function GET(peticion: NextRequest): Promise<Response> {
  return responderPurga(peticion.headers.get("authorization"));
}
