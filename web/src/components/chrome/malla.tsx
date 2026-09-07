/**
 * La malla radial: orbes violeta y esmeralda sobre negro OLED.
 *
 * Componente de servidor, cero JavaScript.
 *
 * DESVIACION deliberada: sin filtro `blur()`. La lectura ingenua de "orbes
 * brillantes" es un `blur-[120px]` sobre un div grande, y el costo de un
 * filtro de 120px sobre 70vmax en un Android de rango medio es real incluso
 * con la capa fija. Un gradiente radial de varias paradas da la misma
 * suavidad gratis.
 *
 * Y la restriccion que importa: los orbes viven detras del encabezado y del
 * pie, NUNCA detras de datos. El interior de las tarjetas es opaco. Un brillo
 * detras de una barra cambia el valor que la barra parece tener.
 */
export function Malla() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[var(--z-fondo)] overflow-hidden"
    >
      <div
        className="absolute -top-[25%] -left-[15%] h-[70vmax] w-[70vmax] rounded-full opacity-[0.20]"
        style={{
          background:
            "radial-gradient(circle at center, rgb(var(--color-orbe-violeta) / 0.55) 0%, rgb(var(--color-orbe-violeta) / 0.18) 35%, transparent 70%)",
        }}
      />
      <div
        className="absolute -right-[10%] -bottom-[30%] h-[60vmax] w-[60vmax] rounded-full opacity-[0.16]"
        style={{
          background:
            "radial-gradient(circle at center, rgb(var(--color-orbe-esmeralda) / 0.45) 0%, rgb(var(--color-orbe-esmeralda) / 0.14) 35%, transparent 70%)",
        }}
      />
      {/* Grano. Solo en una capa fija y sin eventos, nunca sobre algo que
          hace scroll. */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage: "url(/ruido.svg)",
          backgroundSize: "180px 180px",
        }}
      />
    </div>
  );
}
