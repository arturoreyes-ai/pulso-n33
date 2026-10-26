import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { usuarioActual } from "@/lib/acceso/sesion";
import { decidirAutorizacion } from "@/lib/mcp/oauth/acciones";
import { firmarSolicitud, revisarSolicitud } from "@/lib/mcp/oauth/autorizacion";
import { origenPublico, secretoMcp } from "@/lib/mcp/oauth/servidor";

/**
 * Donde una persona le da permiso a su Claude para leer el gasto del tablero
 * (el MCP de lib/mcp/). Es el `authorization_endpoint` del OAuth del MCP.
 *
 * No es publica a proposito: proxy.ts la trata como cualquier pagina, asi que
 * sin sesion manda a /entrar y vuelve aqui con la misma URL. Esa es toda la
 * identidad: la de Microsoft Entra que ya usa el tablero.
 *
 * Nombra a la aplicacion por el host de su `client_id` y no por el nombre que
 * dice su documento, que lo escribe ella misma (guia de Anthropic y la
 * especificacion de MCP), y dice a donde vuelve. Sin «Permitir» no hay
 * codigo: llegar aqui con un enlace no conecta nada.
 */
export const metadata: Metadata = {
  title: "Conectar Claude · Pulso",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

function Marco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[100svh] w-full max-w-[34rem] flex-col justify-center px-4 py-16 md:px-8">
      <section aria-labelledby="autorizar-titulo" className="entrada">
        <h1 id="autorizar-titulo" className="font-titular text-seccion text-tinta-titulo">{titulo}</h1>
        {children}
      </section>
    </div>
  );
}

export default async function PaginaAutorizar({ searchParams }: Props) {
  const secreto = secretoMcp();
  if (secreto === null) notFound();
  const p = await searchParams;
  if (p.vencida === "1") {
    return (
      <Marco titulo="La solicitud venció.">
        <p className="mt-4 text-lectura text-tinta-prosa">Vuelve a Claude y pide conectar otra vez.</p>
      </Marco>
    );
  }
  const origen = origenPublico(await headers());
  const revision = await revisarSolicitud(p, origen);
  if (revision.tipo === "regreso") redirect(revision.url);
  if (revision.tipo === "pantalla") {
    return (
      <Marco titulo="No se puede conectar.">
        <p className="mt-4 text-lectura text-tinta-prosa">{revision.mensaje}</p>
      </Marco>
    );
  }

  const usuario = await usuarioActual();
  const esAdmin = usuario.activo && usuario.aprobado && usuario.rol === "admin";
  const s = revision.solicitud;
  const destino = new URL(s.redirectUri).host;

  return (
    <Marco titulo={esAdmin ? "¿Conectar Claude al tablero?" : "Solo un administrador puede conectar Claude."}>
      {esAdmin ? (
        <>
          <p className="mt-4 text-lectura text-tinta-prosa">
            <strong className="text-tinta-dato">{s.clienteHost}</strong> pide leer, con la cuenta de{" "}
            <strong className="text-tinta-dato">{usuario.nombre}</strong>, cuánto cuesta operar Pulso: el gasto por acción, por
            persona y por proveedor.
          </p>
          <p className="mt-3 text-cuerpo text-tinta-meta">
            Solo lectura. No incluye comentarios, términos buscados ni titulares. Al permitir, vuelves a {destino}.
          </p>
        </>
      ) : (
        <p className="mt-4 text-lectura text-tinta-prosa">
          Tu cuenta ({usuario.correo}) no es administradora del tablero. Pide a un administrador que te dé el rol y vuelve a intentarlo.
        </p>
      )}
      <form action={decidirAutorizacion} className="mt-8 flex flex-wrap gap-3">
        <input type="hidden" name="solicitud" value={firmarSolicitud(s, usuario.id, secreto)} />
        {esAdmin && (
          <button
            type="submit"
            name="decision"
            value="permitir"
            className="inline-flex items-center justify-center rounded-full bg-tinta-titulo px-6 py-3.5 text-cuerpo font-medium text-vanta transition-colors hover:bg-white active:translate-y-px"
          >
            Permitir
          </button>
        )}
        <button type="submit" name="decision" value="cancelar" className="rounded-full border border-filo px-6 py-3 text-cuerpo">
          {esAdmin ? "Cancelar" : "Volver a Claude"}
        </button>
      </form>
    </Marco>
  );
}
