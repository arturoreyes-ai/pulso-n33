import { responderGaritas } from "@/lib/garitas/cbp";

export const maxDuration = 15;
export async function GET() {
  return responderGaritas();
}
