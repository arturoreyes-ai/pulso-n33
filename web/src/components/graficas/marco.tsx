import type { ReactNode } from "react";

/**
 * Envoltura accesible y dimensionada de una grafica.
 *
 * La ALTURA FIJA es obligatoria por dos razones independientes:
 * `ResponsiveContainer` de Recharts mide a su padre directo y renderiza nada
 * si el padre no tiene altura definida; y como la grafica se carga con
 * ssr:false, el hueco y la grafica tienen que medir lo mismo o cada panel
 * aporta salto de layout al hidratar. El esqueleto usa la misma clase.
 *
 * `TablaAlterna` publica los MISMOS numeros como tabla real, oculta para
 * lectores de pantalla y desplegable para todos. Es el patron mas fuerte de
 * grafica accesible y no cuesta nada, porque los numeros ya vienen como prop.
 */

export const ALTO_GRAFICA = "h-[280px]";

export function Marco({
  id,
  titulo,
  resumen,
  filas,
  alto = ALTO_GRAFICA,
  children,
}: {
  id: string;
  titulo: string;
  /** Texto que nombra las cifras de verdad. Una grafica sin alternativa
   *  textual no existe para un lector de pantalla. */
  resumen: string;
  filas: { etiqueta: string; valor: string }[];
  /** Tiene que coincidir con el esqueleto de carga de registro.tsx. */
  alto?: string;
  children: ReactNode;
}) {
  return (
    <figure className="m-0" aria-labelledby={`${id}-t`}>
      <figcaption id={`${id}-t`} className="mb-3 text-[13px] text-white/75">
        {titulo}
      </figcaption>

      <div role="img" aria-label={resumen} className={`w-full ${alto}`}>
        {children}
      </div>

      <details className="mt-3 group">
        <summary className="cursor-pointer text-xs text-white/45 hover:text-white/70">
          ver como tabla
        </summary>
        <table className="mt-3 w-full text-xs">
          <tbody>
            {filas.map((f) => (
              <tr key={f.etiqueta} className="border-b border-white/[0.05]">
                <th scope="row" className="py-1 text-left font-normal text-white/60">
                  {f.etiqueta}
                </th>
                <td className="py-1 text-right tabular-nums text-white/85">{f.valor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
