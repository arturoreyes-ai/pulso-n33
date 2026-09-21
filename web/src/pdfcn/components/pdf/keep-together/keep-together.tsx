// @ts-nocheck -- copia de pdfcn (MIT), escrita por scripts/sincronizar-pdfcn.mjs.
// No se edita a mano: la siguiente sincronizacion la pisa. Ver src/pdfcn/README.md.
import type { ReactNode } from "react";

import { View } from "@/pdfcn/lib/pdf-primitives";
import type { Style } from "@/pdfcn/types/pdf-components";

export interface KeepTogetherProps {
  children?: ReactNode;
  minPresenceAhead?: number;
  style?: Style;
}

export const KeepTogether = ({ children, style }: KeepTogetherProps) => (
  <View style={[{ breakInside: "avoid" }, style].filter(Boolean) as never}>
    {children}
  </View>
);
