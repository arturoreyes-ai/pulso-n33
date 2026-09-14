"use client";

import { Esqueleto } from "@/components/ui/primitivas";
import { useComunicados } from "@/lib/datos/hooks";
import { fechaLarga, hora } from "@/lib/dominio/formato";

export function PanelComunicados() {
  const { data: datos, error, isLoading: cargando } = useComunicados();
  if (cargando) return <Esqueleto className="h-[180px]" />;
  if (error || !datos) return <p role="status" className="text-tinta-meta">Comunicados no disponibles.</p>;
  return (
    <div>
      <p className="mb-4 text-meta text-tinta-meta">
        <a href={datos.fuente.url} className="underline underline-offset-4">Gobierno de Tecate</a>
        {datos.ultimo_exito ? ` · Última lectura correcta: ${fechaLarga(datos.ultimo_exito)}, ${hora(datos.ultimo_exito)} (Tijuana)` : ""}
      </p>
      {datos.modo === "sin_red" ? <p role="status" className="mb-4 text-aviso">Ejemplo sin red. Estos titulares son datos de prueba.</p> : null}
      {datos.estado === "fallo" ? (
        <p role="status" className="mb-4 text-aviso">
          No se pudo actualizar la fuente.{datos.comunicados.length ? " Se conserva la última lectura correcta." : " Todavía no hay una lectura correcta disponible."}
        </p>
      ) : null}
      {datos.comunicados.length ? (
        <ul className="divide-y divide-vela">
          {datos.comunicados.map((comunicado) => (
            <li key={comunicado.url} className="flex flex-col gap-2 py-4 sm:flex-row sm:gap-6">
              <span className="shrink-0 text-meta tabular-nums text-tinta-meta sm:w-28">
                {comunicado.fecha ? <time dateTime={comunicado.fecha}>{comunicado.fecha}</time> : "Sin fecha"}
              </span>
              <a href={comunicado.url} target="_blank" rel="noopener noreferrer" className="font-medium underline-offset-4 hover:underline focus-visible:underline">
                {comunicado.titulo}
              </a>
            </li>
          ))}
        </ul>
      ) : <p className="text-tinta-meta">Sin comunicados disponibles.</p>}
    </div>
  );
}
