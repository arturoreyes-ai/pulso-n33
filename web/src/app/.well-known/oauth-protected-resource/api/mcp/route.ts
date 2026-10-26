import { responderMetadatosRecurso } from "../../metadatos";

export function GET(peticion: Request): Response {
  return responderMetadatosRecurso(peticion);
}
