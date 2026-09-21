// @ts-nocheck -- copia de pdfcn (MIT), escrita por scripts/sincronizar-pdfcn.mjs.
// No se edita a mano: la siguiente sincronizacion la pisa. Ver src/pdfcn/README.md.
import type { ReactNode } from "react";

/** CSS-like style object compatible with both Takumi and Forme */
export type Style = Record<string, unknown>;

/**
 * Base props shared by all pdfcn PDF components.
 */
export interface PDFComponentProps {
  style?: Style;
  children: ReactNode;
}
