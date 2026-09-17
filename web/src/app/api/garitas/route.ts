import { responderGaritas } from "@/lib/garitas/cbp";

export const maxDuration = 15;

/** JSON público para consumidores externos; la normalización y las cabeceras
 *  de caché/CORS viven juntas en `responderGaritas`. */
export async function GET() {
  return responderGaritas();
}
