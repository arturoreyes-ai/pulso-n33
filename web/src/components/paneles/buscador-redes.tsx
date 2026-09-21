"use client";

import { ArrowRight as Flecha } from "@phosphor-icons/react";
import Link from "next/link";

import { clasesChip } from "@/components/ui/clases";
import { LARGO_MAXIMO_CONSULTA, MINIMO_CONSULTA } from "@/lib/busqueda/tipos";
import { useConsultas } from "@/lib/datos/hooks";
import { plegar } from "@/lib/dominio/formato";
import { rutaDeConsulta } from "@/lib/dominio/consultas";

/**
 * El cuerpo del dialogo de busqueda de Redes.
 *
 * Gemelo deliberado de ahora/buscador-ahora.tsx, no una generalizacion: el de
 * la portada busca titulares en un lugar y este busca publicaciones en toda la
 * region, y los dos textos que los distinguen —la etiqueta, el destino, la
 * salida— son justo lo que un componente compartido tendria que parametrizar.
 * Mismo formulario `GET` de verdad, por las mismas razones escritas alla: no
 * reconstruye la pila de tarjetas al teclear, funciona sin JavaScript y queda
 * en la URL.
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
  return (
    <div className="grid gap-5 px-4 pt-5 pb-6">
      <form method="get" action={accion} className="grid gap-3">
        <label htmlFor="consulta-redes" className="text-meta text-tinta-meta">
          En las publicaciones de toda la región
        </label>
        <input
          id="consulta-redes"
          name="q"
          type="search"
          defaultValue={consulta ?? ""}
          required
          minLength={MINIMO_CONSULTA}
          maxLength={LARGO_MAXIMO_CONSULTA}
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Vive la Baja, garita, agua…"
          className="w-full rounded-nucleo border border-filo bg-vanta px-4 py-3 text-cuerpo text-tinta-titulo placeholder:text-tinta-inerte"
        />
        <button
          type="submit"
          className="group inline-flex items-center justify-between gap-3 rounded-full bg-realce py-2 pl-5 pr-2 text-cuerpo text-tinta-titulo transition-[background-color,transform] duration-[var(--dur-toque)] ease-firma hover:bg-filo active:scale-[0.99]"
        >
          <span>Buscar</span>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-vanta transition-transform duration-[var(--dur-cambio)] ease-firma group-hover:translate-x-0.5">
            <Flecha size={16} weight="light" aria-hidden />
          </span>
        </button>
      </form>

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

      {consulta === null ? null : (
        <Link
          href={accion}
          className="justify-self-start text-meta text-tinta-meta underline decoration-filo underline-offset-4 transition-colors duration-[var(--dur-toque)] ease-firma hover:text-tinta-titulo"
        >
          Volver a las publicaciones
        </Link>
      )}
    </div>
  );
}
