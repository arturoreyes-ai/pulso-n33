/**
 * El unico archivo que nombra un color de serie.
 *
 * Se consumen como `stroke={SERIES[i]}`. Recharts pinta SVG en el mismo
 * documento, asi que `var(--color-chart-1)` resuelve normalmente y el cambio
 * de tema no necesita re-render. NUNCA un hex en un dataset: eso es lo que
 * mantiene un futuro tema claro, o una paleta para daltonismo, como un cambio
 * de un solo archivo.
 *
 * Salvedad conocida: si algun dia se agrega exportacion a PNG con
 * html-to-image, las variables CSS no resuelven en el rasterizador.
 */
export const SERIES = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
] as const;

/** La etiqueta de los ejes. Es un ROTULO, asi que va en el paso `meta`. */
export const EJE = "var(--color-tinta-meta)";
