import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { Bisel } from "@/components/ui/bisel";
import { BotonPdf } from "@/components/ui/boton-pdf";
import { clasesBoton } from "@/components/ui/clases";
import { fechaConAnio, numero } from "@/lib/dominio/formato";
import { EXPEDIENTES, rutaDeExpediente, rutaDelPdf, type Expediente } from "@/lib/expedientes/expedientes";

/**
 * Los expedientes en /reportes. Componente de SERVIDOR que la pagina le pasa
 * al tablero (cliente) como `expedientes`: asi el JSON de cada uno no entra
 * al bundle, solo lo que esta tarjeta pinta.
 *
 * La tarjeta es la de un termino en seguimiento (tablero-reportes.tsx), con
 * el mismo bisel, la misma lista de tres cifras y el boton en el mismo
 * lugar: son dos clases de reporte en la misma pagina y se leen igual.
 */
function TarjetaExpediente({ e }: { e: Expediente }) {
  const cifras = [
    { nombre: "Titulares", n: e.titulares },
    { nombre: "Medios", n: e.medios },
    { nombre: "Historias", n: e.historias.length },
  ];
  return (
    <Bisel as="article" nivel="panel" interior="flex flex-col p-5 sm:p-6">
      <p className="text-meta text-tinta-meta">{fechaConAnio(e.desde)} – {fechaConAnio(e.hasta)}</p>
      <h3 className="mt-3 break-words font-titular text-rotulo text-tinta-titulo">{e.persona}</h3>
      <dl className="my-6 grid gap-3 border-y border-vela py-5">
        {cifras.map(({ nombre, n }) => (
          <div key={nombre} className="flex items-baseline justify-between gap-4">
            <dt className="text-cuerpo text-tinta-prosa">{nombre}</dt>
            <dd className="font-mono text-rotulo tabular-nums text-tinta-dato">{numero(n)}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Link href={rutaDeExpediente(e.id)} className={clasesBoton(true)} aria-label={`Leer expediente de ${e.persona}`}>Leer expediente <ArrowRight size={16} aria-hidden /></Link>
        <BotonPdf href={rutaDelPdf(e.id)} archivo={`pulso-expediente-${e.id}.pdf`} descripcion={`Descargar el expediente de ${e.persona} en PDF`} />
      </div>
    </Bisel>
  );
}

export function ExpedientesReportes() {
  if (EXPEDIENTES.length === 0) return null;
  return (
    <section aria-labelledby="expedientes-reportes">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="expedientes-reportes" className="font-titular text-rotulo text-tinta-titulo">Expedientes</h2>
        <p className="text-meta text-tinta-meta">Un año de prensa por persona, por historia y alcance</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">{EXPEDIENTES.map((e) => <TarjetaExpediente key={e.id} e={e} />)}</div>
    </section>
  );
}
