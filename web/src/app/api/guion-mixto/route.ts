import { responderGuionMixto } from "@/lib/analisis/guion-mixto";

/**
 * El guion para locucion de /guion: las redes con los titulares que cuentan
 * lo mismo (lib/analisis/guion-mixto.ts). Lee los feeds de Google en vivo y
 * los archivos publicados de las cuatro redes, y llama al modelo una vez.
 * Sesenta segundos como las otras rutas de guion: los feeds mas el modelo
 * tardan de 15 a 20.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return responderGuionMixto({ p: searchParams.get("p") });
}
