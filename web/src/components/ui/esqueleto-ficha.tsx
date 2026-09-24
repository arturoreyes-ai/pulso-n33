/**
 * La forma de una ficha de «Analizar con IA» mientras el modelo lee.
 *
 * Antes la hoja mostraba el titular y una linea de carga, y a los cinco o
 * diez segundos crecia de golpe unas cuatro veces su alto (captura del
 * cliente, 24 de septiembre de 2026, sobre «Super El Niño is coming…»). Con
 * las secciones ya puestas la hoja mide al abrir lo que va a medir, y quien
 * espera sabe que viene un resumen y una idea para redes y no otra cosa.
 *
 * `aria-hidden` entero: el aviso para el lector de pantalla es el
 * `role="status"` de EstadoCarga, y leer tres rotulos vacios no dice nada. El
 * pulso va con `motion-safe:`, asi que con movimiento reducido las barras
 * quedan quietas.
 */
const ANCHOS = [["w-full", "w-11/12", "w-2/3"], ["w-5/6", "w-3/4", "w-4/5"]] as const;

export function EsqueletoFicha({ secciones, caja }: { secciones: readonly string[]; caja: string }) {
  return (
    <div aria-hidden className="grid max-w-[65ch] gap-5">
      {secciones.map((rotulo, i) => (
        <div key={rotulo} className="grid gap-2">
          <span className="text-meta text-tinta-meta">{rotulo}</span>
          <Barras anchos={ANCHOS[i % ANCHOS.length]!} />
        </div>
      ))}
      <div className="grid gap-3 rounded-nucleo border border-filo bg-vela p-4">
        <span className="text-meta text-tinta-meta">{caja}</span>
        <div className="grid gap-2 motion-safe:animate-pulse">
          <div className="h-4 w-2/5 rounded-full bg-filo" />
          <div className="h-3 w-4/5 rounded-full bg-filo" />
        </div>
      </div>
    </div>
  );
}

function Barras({ anchos }: { anchos: readonly string[] }) {
  return (
    <div className="grid gap-2 motion-safe:animate-pulse">
      {anchos.map((ancho) => <div key={ancho} className={`h-3 ${ancho} rounded-full bg-vela`} />)}
    </div>
  );
}
