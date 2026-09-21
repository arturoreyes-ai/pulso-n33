import { leerConsulta } from "@/lib/analisis/consulta";
import { json, SIN_CACHE } from "@/lib/busqueda/respuesta";
import { leerDatoPublicado, type LeerDatos } from "@/lib/datos/publicado";
import type { Consulta, DocConsultas, DocRedesComentarios } from "@/lib/datos/tipos";
import { CACHE_INFORME } from "@/lib/analisis/consulta";
import { armarDocumentoInforme, nombreArchivoInforme, type DocumentoInforme } from "./modelo";

/**
 * /api/informe-consulta?c=<id>: el informe de un termino en PDF.
 *
 * Es la tercera ruta de la familia de redes y comparte su postura entera: lee
 * los archivos publicados DEL DISCO (lib/datos/publicado.ts explica por que no
 * por HTTP), hace una sola salida de red —la del modelo, para «lo que se
 * repite», y solo si la lectura automatica esta encendida y hay al menos diez
 * comentarios— y no guarda nada. `c` es una LLAVE contra `consultas.json`,
 * nunca una direccion que el servidor visite.
 *
 * Lo que devuelve y por que:
 *  - 400 `consulta`: un id que no tiene la forma de uno.
 *  - 503 `datos`: `consultas.json` no se pudo leer. Nunca un PDF vacio: seria
 *    afirmar que no hay nada que decir del termino, que es la regla 4 al reves.
 *  - 404 `consulta`: el id no esta en el corte.
 *  - 503 `informe`: el motor fallo. Tampoco un PDF a medias.
 *  - 200 `application/pdf` con nombre de archivo del corte, `noindex`, y seis
 *    horas de cache: cuesta lo mismo que la lectura de conjunto y por la misma
 *    razon —la primera persona que descargue en un ciclo paga la llamada y las
 *    demas leen la copia—. El proxy corre antes del cache, asi que la copia
 *    sigue detras de la sesion.
 *
 * El archivo de texto puede faltar (vive fuera de git): el informe se arma
 * igual y la seccion de comentarios lo dice.
 *
 * `solicitar`, `leer` y `renderizar` se inyectan: probar-informe.cjs prueba
 * los codigos y las cabeceras con un motor de mentira, y el render de verdad
 * aparte.
 */

export type Renderizar = (modelo: DocumentoInforme) => Promise<Uint8Array>;

const RE_ID = /^[a-z0-9_]{2,40}$/;

function esDocConsultas(v: unknown): v is DocConsultas {
  return typeof v === "object" && v !== null && Array.isArray((v as { consultas?: unknown }).consultas);
}

function esDocTextos(v: unknown): v is DocRedesComentarios {
  return typeof v === "object" && v !== null && typeof (v as { por_post?: unknown }).por_post === "object";
}

export async function responderInformeConsulta(
  params: { c: string | null },
  solicitar: typeof fetch = fetch,
  leer: LeerDatos = leerDatoPublicado,
  renderizar: Renderizar | null = null,
): Promise<Response> {
  const id = params.c ?? "";
  if (!RE_ID.test(id)) {
    return json({ codigo: "consulta", mensaje: "No hay un informe para ese término." }, 400, SIN_CACHE);
  }
  const crudo = await leer("consultas.json");
  if (!esDocConsultas(crudo)) {
    return json({ codigo: "datos", mensaje: "El informe no está disponible en esta vista." }, 503, SIN_CACHE);
  }
  const consulta: Consulta | undefined = crudo.consultas.find((c) => c.id === id);
  if (consulta === undefined) {
    return json({ codigo: "consulta", mensaje: "No hay un informe para ese término." }, 404, SIN_CACHE);
  }
  const textosCrudos = await leer("consultas-comentarios.json");
  const textos = esDocTextos(textosCrudos) ? textosCrudos : null;

  const lectura = await leerConsulta(consulta, textos, solicitar);
  const modelo = armarDocumentoInforme(crudo, consulta, textos, lectura);

  let bytes: Uint8Array;
  try {
    // El motor se importa aqui y no arriba: el modulo de reglas se carga sin
    // WASM en la prueba offline, que inyecta su propio `renderizar`.
    const motor = renderizar ?? (await import("./render")).renderizarInforme;
    bytes = await motor(modelo);
  } catch {
    return json({ codigo: "informe", mensaje: "El informe no se pudo armar esta vez." }, 503, SIN_CACHE);
  }

  // Copia a un ArrayBuffer propio: el motor devuelve una vista sobre memoria
  // del WASM, que `Response` no acepta como cuerpo en el tipado actual.
  const cuerpo = new Uint8Array(bytes).buffer;
  return new Response(cuerpo, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${nombreArchivoInforme(consulta, crudo)}"`,
      "cache-control": CACHE_INFORME,
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex",
    },
  });
}
