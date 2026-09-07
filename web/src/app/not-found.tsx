import { NavPildora } from "@/components/chrome/nav-pildora";
import { SelectorZona } from "@/components/chrome/selector-zona";

export default function NoEncontrada() {
  return (
    <>
      <NavPildora zona={null} />
      <div className="mx-auto w-full max-w-[88rem] px-4 pb-24 md:px-8">
        <h1 className="text-4xl tracking-tight text-tinta-titulo md:text-5xl">
          Esa zona no está en el tablero.
        </h1>
        <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-tinta-prosa">
          Pulso N33 cubre ocho zonas del corredor Tijuana y San Diego. Elige una,
          o vuelve a la región completa.
        </p>
        <div className="mt-8">
          <SelectorZona zona={null} />
        </div>
      </div>
    </>
  );
}
