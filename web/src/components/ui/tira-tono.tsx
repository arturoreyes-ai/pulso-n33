import type { ClaseTono, TramoTono } from "@/lib/dominio/consultas";
import { numero } from "@/lib/dominio/formato";

/**
 * La tira de tono de una ficha: UN CUADRO POR PIEZA, agrupados por tono.
 * Sin leyenda por omision desde el 23 de septiembre de 2026: la tarjeta ya
 * dice los conteos positivo/negativo en grande, y una leyenda debajo repetia
 * las mismas cifras en chico.
 *
 * Por que cuadros y no la barra de partes de primitivas.tsx: una barra dice
 * «tanto por ciento», y la ficha de un termino trae 1, 2 o 7 titulares. Con
 * dos titulares la barra pinta una mitad roja y se lee «la mitad de la prensa
 * es negativa», que es el porcentaje que PRODUCT.md (regla 2) prohibe debajo
 * de 30 metido por la puerta de atras. Dos cuadros dicen dos. Por encima de
 * TOPE_CUADROS los cuadros dejan de contarse de un vistazo y ahi si va la
 * barra: pasado 30 la proporcion ya es un dato que se puede decir.
 *
 * El color es el dato (sube/baja, como BarraSentimiento) y no es el unico
 * portador: la leyenda dice la palabra y el numero, y sin leyenda la tira
 * lleva su frase en `aria-label`. «Sin tono» es un cuadro HUECO y no gris: lo
 * gris es neutro, que es una lectura; lo hueco es que no hubo lectura (regla 4).
 */

const TOPE_CUADROS = 100;

/** Hasta aqui el cuadro va grande, a la escala de la cifra que tiene encima:
 *  con dos titulares, dos cuadros de 14px debajo de un «2» de 72px no se ven. */
const TOPE_GRANDES = 24;

/** El relleno de cada clase. El neutral va en `inerte` y no en un color: no
 *  es una tercera postura, es la ausencia de las otras dos. */
const CLASE_CUADRO: Record<ClaseTono, string> = {
  positivo: "bg-sube",
  negativo: "bg-baja",
  neutral: "bg-tinta-inerte",
  sin_tono: "border border-tinta-meta",
};

const COLOR_BARRA: Record<ClaseTono, string> = {
  positivo: "var(--color-sube)",
  negativo: "var(--color-baja)",
  neutral: "var(--color-tinta-inerte)",
  sin_tono: "var(--color-realce)",
};

/** `chico` es el de la leyenda y el de junto a un titular; `grande`, el de una
 *  tira corta. */
const TAMANO = { chico: "size-2", normal: "size-3.5", grande: "size-5" } as const;

/** Un cuadro suelto, para atar un titular de la lista a la leyenda. Se
 *  exporta el componente y no la tabla de clases: un .tsx que exporta algo que
 *  no es componente rompe el limite de Fast Refresh (ver ui/clases.ts). */
export function Cuadro({ clase, tamano = "normal" }: { clase: ClaseTono; tamano?: keyof typeof TAMANO }) {
  return <span aria-hidden className={`inline-block shrink-0 ${TAMANO[tamano]} ${CLASE_CUADRO[clase]}`} />;
}

function fraseTramos(tramos: readonly TramoTono[]): string {
  return tramos.map((t) => `${numero(t.n)} ${t.etiqueta}`).join(", ");
}

/** `tamano` fuerza el cuadro; sin el, la tira lo elige por cuantas piezas hay. */
export function TiraTono({ tramos, leyenda = false, tamano }: { tramos: readonly TramoTono[]; leyenda?: boolean; tamano?: keyof typeof TAMANO }) {
  const total = tramos.reduce((n, t) => n + t.n, 0);
  if (total === 0) return null;
  const cuadro = tamano ?? (total > TOPE_GRANDES ? "normal" : "grande");
  // Con leyenda la tira es decoracion de la lista que la sigue; sin ella, la
  // tira ES el dato y lleva la frase. Las dos a la vez se leerian dos veces.
  const rotulo = leyenda ? { "aria-hidden": true } : { role: "img", "aria-label": fraseTramos(tramos) };
  return (
    <div className="grid gap-3">
      {total > TOPE_CUADROS ? (
        <div {...rotulo} className="flex h-3.5 w-full overflow-hidden rounded-full bg-vela">
          {tramos.map((t) => t.n === 0 ? null : (
            <span key={t.clase} style={{ flexGrow: t.n, backgroundColor: COLOR_BARRA[t.clase] }} />
          ))}
        </div>
      ) : (
        <div {...rotulo} className={`flex flex-wrap ${cuadro === "grande" ? "gap-1.5" : "gap-1"}`}>
          {tramos.flatMap((t) => Array.from({ length: t.n }, (_, i) => (
            <Cuadro key={`${t.clase}-${i}`} clase={t.clase} tamano={cuadro} />
          )))}
        </div>
      )}
      {leyenda ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-meta">
          {tramos.map((t) => (
            <li key={t.clase} className={`inline-flex items-center gap-1.5 ${t.n === 0 ? "text-tinta-meta" : "text-tinta-dato"}`}>
              <Cuadro clase={t.clase} tamano="chico" />
              <span className="tabular-nums">{numero(t.n)}</span> {t.etiqueta}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
