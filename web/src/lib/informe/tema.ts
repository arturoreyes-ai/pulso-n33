import type { PdfcnTheme } from "@/pdfcn/components/pdf/theme-provider";
import { professionalTheme } from "@/pdfcn/components/pdf/theme-professional";

/**
 * El tema del informe: el «professional» de pdfcn con la tipografia y los
 * acentos del tablero.
 *
 * `fontFamily` TIENE que ser Geist: el tema de pdfcn nombra Helvetica y
 * Times-Roman, que son las catorce fuentes base del PDF que el otro motor de
 * pdfcn (Forme) trae dentro. Takumi no las tiene y no lee las del sistema, asi
 * que con esos nombres no habria una sola letra. Las de Geist se registran en
 * lib/informe/fuentes.ts desde el paquete `geist`, que el sitio ya usa.
 *
 * Los colores son hexadecimales por contrato del tema (nada de tokens CSS: un
 * PDF no tiene hoja de estilos del tablero), y son los del tablero sobre
 * blanco: el acento rojo de las series, verde y rosa de sube/baja.
 */
export const TEMA_INFORME: PdfcnTheme = {
  ...professionalTheme,
  name: "pulso",
  colors: {
    ...professionalTheme.colors,
    accent: "#E0342B",
    primary: "#18181b",
    success: "#0f9f6e",
    destructive: "#c2415a",
    info: "#0284c7",
  },
  typography: {
    body: { ...professionalTheme.typography.body, fontFamily: "Geist" },
    heading: { ...professionalTheme.typography.heading, fontFamily: "Geist", fontWeight: 600 },
  },
};

/** Las series de las graficas, en el mismo orden en que se listan las redes. */
export const COLORES_GRAFICA = ["#E0342B", "#0284c7", "#0f9f6e"];
