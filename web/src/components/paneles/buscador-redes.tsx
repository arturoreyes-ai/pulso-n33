"use client";

import Link from "next/link";

import { clasesChip } from "@/components/ui/clases";
import { FormularioBusqueda } from "@/components/ui/formulario-busqueda";
import { useConsultas } from "@/lib/datos/hooks";
import { plegar } from "@/lib/dominio/formato";
import { rutaDeConsulta } from "@/lib/dominio/consultas";

/**
 * El cuerpo del dialogo de busqueda de Redes.
 *
 * Era un gemelo copiado de ahora/buscador-ahora.tsx; desde el 23 de
 * septiembre de 2026 los dos montan ui/formulario-busqueda.tsx y aqui queda
 * solo lo propio: la etiqueta, la salida y los terminos en seguimiento.
 *
 * Debajo del campo van los TERMINOS EN SEGUIMIENTO (data/consultas.json), como
 * enlaces: la direccion del cliente no tiene que saber como se escribe
 * «Grupo Concordia» para llegar a su ficha. Si el archivo no esta —se escribe a
 * mano y un despliegue puede no traerlo— no hay fila y no hay frase: el campo
 * sigue sirviendo para filtrar lo cargado.
 */
export function BuscadorRedes({ accion, consulta }: { accion: string; consulta: string | null }) {
  const consultas = useConsultas();
  const terminos = consultas.data?.consultas ?? [];
  const activa = plegar(consulta ?? "");
  // «En todas las publicaciones» y no «de toda la región»: un termino no es un
  // lugar, asi que la busqueda no se acota a la zona que se este viendo.
  return (
    <FormularioBusqueda accion={accion} idCampo="consulta-redes" etiqueta="En todas las publicaciones" consulta={consulta}
      placeholder="Vive la Baja, garita, agua…" salida="Volver a las publicaciones">
      {terminos.length === 0 ? null : (
        <div className="grid gap-3">
          <p className="text-meta text-tinta-meta">Términos en seguimiento</p>
          <ul className="flex flex-wrap gap-2">
            {terminos.map((c) => {
              const activo = plegar(c.termino) === activa;
              return (
                <li key={c.id}>
                  <Link href={rutaDeConsulta(c.termino)} aria-current={activo ? "page" : undefined} className={clasesChip(activo)}>
                    {c.termino}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </FormularioBusqueda>
  );
}
