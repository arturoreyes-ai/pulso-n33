import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Navegacion } from "@/components/chrome/navegacion";
import { PaginaGuion } from "@/components/paneles/guion-locucion";
import { analisisHabilitado } from "@/lib/analisis/config";
import { MATERIAL_GUION, NOMBRE_PROGRAMA } from "@/lib/analisis/contrato-guion";
import { leerRutaGuion } from "@/lib/analisis/ruta-guion";

/**
 * El guion para locucion es una pagina SUELTA desde el 28 de septiembre de
 * 2026, a pedido del cliente: un programa del canal no es de un municipio ni
 * de una pagina (lib/dominio/secciones.ts::SUELTAS, y el porque en
 * components/paneles/guion-locucion.tsx).
 *
 * SIN LECTURA CON IA NO EXISTE. Cada guion es una llamada pagada, y las rutas
 * responden `apagado` cuando falta `ANALISIS_HABILITADO` o la llave; una
 * pagina que abriera para decir eso explicaria el mecanismo, que la interfaz
 * no hace. Es un 404, y la nav no la pinta (`sueltasVisibles`).
 *
 * `?p=` se lee AQUI, en el servidor, como `?e=` en la portada
 * (app/page.tsx): `useSearchParams` bajo un `<Suspense>` se quedo pendiente
 * para siempre en una ruta prerenderizada. Leerlo hace la ruta dinamica, y la
 * pagina funciona sin JavaScript hasta el punto de pedir el guion.
 *
 * La nav se monta aqui y no en el cliente, como en /garitas.
 *
 * LA CABECERA ES UNA CLAQUETA (28 de septiembre de 2026, el cliente la vio
 * «aburrida»): el titulo en dos tintas, «Guion» encendido y «para locución»
 * apagado, y a su derecha la fecha del programa y de que sale el guion. El
 * punto rojo junto a «Guion» es el piloto de una camara: apagado sin programa,
 * encendido al elegir uno. Es decorativo y no dice «al aire»; lo que dice lo
 * dice la fecha, que es la de Tijuana, la del programa.
 */
const FECHA = new Intl.DateTimeFormat("es-MX", { timeZone: "America/Tijuana", weekday: "long", day: "numeric", month: "long" });
export const metadata: Metadata = {
  title: "Guion para locución · Pulso",
  description: "El guion de cada programa del canal, escrito con lo más popular de las redes y los titulares que cuentan lo mismo.",
};

export default async function PaginaGuionLocucion({ searchParams }: {
  searchParams: Promise<{ [clave: string]: string | string[] | undefined }>;
}) {
  if (!analisisHabilitado()) notFound();
  const { programa } = leerRutaGuion(await searchParams);
  return (
    <>
      <Navegacion zona={null} vista={null} pagina="guion" />
      <header className="mx-auto grid w-full max-w-[64rem] gap-6 px-4 pb-10 md:px-8 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-12 lg:pb-14">
        <h1 className="font-titular text-hero [font-stretch:112%] text-tinta-titulo">
          <span className="flex items-center gap-[0.2em]">
            Guion
            <span aria-hidden className="piloto-guion" data-encendido={programa !== null || undefined} />
          </span>{" "}
          <span className="block text-tinta-inerte">para locución</span>
        </h1>
        <div className="grid max-w-[34ch] gap-2 lg:pb-2">
          <p className="text-meta text-tinta-dato first-letter:uppercase">
            {FECHA.format(new Date())}
            {programa === null ? null : <> · {NOMBRE_PROGRAMA[programa]}</>}
          </p>
          <p className="text-cuerpo text-pretty text-tinta-prosa">{MATERIAL_GUION}</p>
        </div>
      </header>
      <PaginaGuion programa={programa} />
    </>
  );
}
