import { render } from "takumi-pdf/next";

import { InformeConsulta, PieInforme } from "@/components/informe/informe-consulta";
import { PdfcnThemeProvider } from "@/pdfcn/components/pdf/theme-provider";
import { cargarFuentesInforme } from "./fuentes";
import type { DocumentoInforme } from "./modelo";
import { TEMA_INFORME } from "./tema";

/**
 * El modelo del informe → bytes de PDF.
 *
 * `takumi-pdf/next` y no `takumi-pdf`: la entrada de Next importa el WASM con
 * `?module`, que el empaquetador resuelve en el build, asi que la funcion no
 * lee ningun archivo del disco para arrancar el motor. Por eso NO va en
 * `serverExternalPackages`: ahi se quedaria sin empaquetar y el `?module` no
 * significaria nada. Si algun dia Turbopack lo rechaza, la alternativa es la
 * entrada de Node (`takumi-pdf`) mas `serverExternalPackages: ["takumi-pdf"]`
 * y `./node_modules/takumi-pdf/pkg/**` en `outputFileTracingIncludes`.
 *
 * Solo se importa desde lib/informe/informe.ts, que solo importa la ruta: el
 * motor, los componentes de pdfcn y el documento nunca entran al bundle del
 * navegador. `grep -ril takumi .next/static` tiene que seguir vacio.
 *
 * `PdfcnThemeProvider` exige que su hijo sea UN elemento de funcion —lo llama
 * directamente y fija el tema en una variable de modulo— asi que el documento
 * entero es un solo componente. El pie va aparte como banda de pagina, con los
 * contadores que el motor rellena; su tema es el mismo porque se serializa
 * despues del cuerpo.
 */
export async function renderizarInforme(modelo: DocumentoInforme): Promise<Uint8Array> {
  const fuentes = await cargarFuentesInforme();
  return render(
    <PdfcnThemeProvider theme={TEMA_INFORME}>
      <InformeConsulta modelo={modelo} />
    </PdfcnThemeProvider>,
    {
      size: "a4",
      margin: { top: 48, right: 48, bottom: "auto", left: 48 },
      fonts: fuentes,
      fontFamilies: ["Geist"],
      lang: "es",
      outline: true,
      backgroundColor: "#ffffff",
      metadata: {
        title: `Pulso N33 · ${modelo.termino}`,
        description: `Qué se dice de ${modelo.termino} en redes y prensa, últimos ${modelo.ventanaDias} días.`,
        creator: "Pulso N33",
        creationDate: modelo.corte.slice(0, 19),
      },
      footer: <PieInforme modelo={modelo} />,
    },
  );
}
