import { render } from "takumi-pdf/next";

import { InformeExpediente, PieExpediente } from "@/components/informe/informe-expediente";
import { cargarFuentesInforme } from "@/lib/informe/fuentes";
import { TEMA_INFORME } from "@/lib/informe/tema";
import { SALVEDAD_RESUMEN } from "@/lib/seguimiento/formato";
import { PdfcnThemeProvider } from "@/pdfcn/components/pdf/theme-provider";
import type { Expediente } from "./expedientes";
import type { ResumenesPdf } from "./pdf";

/**
 * El expediente → bytes de PDF. Copia de lib/informe/render.tsx en todo lo
 * que importa (por que `takumi-pdf/next`, por que un solo componente bajo el
 * proveedor del tema, por que el pie aparte); vive aqui para que la ruta del
 * expediente no cargue el modelo del informe de un termino.
 */
export async function renderizarExpediente(e: Expediente, resumenes: ResumenesPdf, generado: string): Promise<Uint8Array> {
  const fuentes = await cargarFuentesInforme();
  return render(
    <PdfcnThemeProvider theme={TEMA_INFORME}>
      <InformeExpediente e={e} resumenes={resumenes} salvedadResumen={SALVEDAD_RESUMEN} />
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
        title: `Pulso N33 · ${e.persona}`,
        description: `Lo que más se publicó sobre ${e.persona}, ${e.desde} a ${e.hasta}.`,
        creator: "Pulso N33",
        creationDate: generado.slice(0, 19),
      },
      footer: <PieExpediente e={e} generado={generado} />,
    },
  );
}
