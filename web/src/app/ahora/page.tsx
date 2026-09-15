import type { Metadata } from "next";
import { preload } from "react-dom";

import { FeedAhora } from "@/components/ahora/feed-ahora";
import { NavPildora } from "@/components/chrome/nav-pildora";
import { Pie } from "@/components/chrome/pie";
import { Seccion } from "@/components/chrome/seccion";
import { RUTAS } from "@/lib/datos/config";

/**
 * Ahora es una pagina SUELTA: esta en la nav pero no en la rejilla lugar x
 * vista (ver `lib/dominio/secciones.ts::SUELTAS`). La entrada —zona, corredor,
 * Mexico o Internacional— se elige dentro del recorrido y gobierna el primer
 * capitulo y sus rubros.
 *
 * La nav se monta aqui, en el servidor, igual que en /garitas: `NavPildora`
 * lleva la accion de cerrar sesion y el icono `dist/ssr`.
 *
 * El pie SI se monta, a diferencia de las otras dos sueltas: esta pagina es
 * toda filas en vivo, y las cinco reglas de PRODUCT.md se dicen enteras en
 * cada pagina que muestre un dato. Eso es lo que permite que las tarjetas
 * callen el mecanismo.
 */
export const metadata: Metadata = {
  title: "Ahora · Pulso",
  description:
    "Titulares en vivo del corredor Tijuana–San Diego, uno por pantalla: lo que destaca en el lugar elegido, por rubro, en México y en el mundo, cada uno con su medio y su enlace.",
};

export default function PaginaAhora() {
  // Prioridad baja, al reves que en la rejilla: aqui notas.json solo aporta
  // las miniaturas y el recorrido no debe esperar sus tres megas.
  preload(RUTAS.notas, { as: "fetch", fetchPriority: "low", crossOrigin: "anonymous" });
  return (
    <>
      <NavPildora zona={null} vista={null} pagina="ahora" />
      <header className="mx-auto w-full max-w-[88rem] px-4 pb-6 md:px-8">
        <div className="entrada">
          <h1 className="max-w-[18ch] font-titular text-hero [font-stretch:112%] text-tinta-titulo">Ahora</h1>
          <p className="mt-4 text-meta text-tinta-meta">Titulares en vivo · Corredor Tijuana–San Diego</p>
          <p className="mt-6 max-w-[65ch] text-lectura text-tinta-prosa">
            Un titular por pantalla. Desliza para pasar al siguiente: primero lo que destaca
            donde elijas empezar —una zona, el corredor, México o el mundo—, luego cada rubro
            ahí, y después las otras dos secciones. Cada tarjeta nombra al medio y enlaza a su
            nota; nada de aquí se suma a las cifras de prensa.
          </p>
        </div>
      </header>

      <Seccion id="ahora" pegada>
        <FeedAhora />
      </Seccion>

      <Pie />
    </>
  );
}
