import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth, hayEntra } from "@/auth";
import { entrarConMicrosoft } from "@/lib/acceso/acciones";
import { acceso } from "@/lib/acceso/config";
import { rutaDeRegreso } from "@/lib/acceso/regreso";

/**
 * La puerta. Es la unica pagina que proxy.ts deja pasar sin sesion, y la
 * unica del tablero que no es una celda de la rejilla lugar x vista ni esta
 * en la nav: se llega aqui por redireccion, con la ruta pedida en `volver`.
 *
 * Es un componente de servidor con un <form>: no hay SessionProvider ni
 * useSession en ningun lado. Con sesion ya abierta, redirige a `volver` en
 * vez de ensenar el boton, para que recargar esta URL no deje a nadie en una
 * pantalla de entrada estando dentro.
 */
export const metadata: Metadata = {
  title: "Entrar · Pulso",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ volver?: string; error?: string; salida?: string }>;
}

/**
 * `error` lo pone Auth.js (pages.error apunta aqui). Los dos que importan
 * tienen texto propio; el resto es "intenta de nuevo", porque el codigo
 * interno (OAuthCallbackError, Configuration...) no le dice nada a quien
 * entra y si a quien lee los logs de Vercel.
 */
const MENSAJE: Record<string, string> = {
  AccessDenied: "Tu cuenta está desactivada. Pide a un administrador del tablero que la reactive.",
  Configuration:
    "Este despliegue no tiene configurada la entrada con Microsoft. Revisa docs/acceso.md.",
};

const MENSAJE_GENERICO = "No se pudo completar la entrada. Intenta de nuevo.";

export default async function PaginaEntrar({ searchParams }: Props) {
  const { volver, error, salida } = await searchParams;
  const destino = rutaDeRegreso(volver);

  const sesion = await auth();
  if (sesion?.user || acceso.sinEntra) redirect(destino);

  const aviso = error ? MENSAJE[error] ?? MENSAJE_GENERICO : null;

  return (
    <div className="mx-auto w-full max-w-[88rem] px-4 pb-24 md:px-8">
      <section
        aria-labelledby="entrar-titulo"
        className="mx-auto max-w-[36rem] rounded-panel border border-filo bg-carta p-8 shadow-bisel md:p-12"
      >
        <p className="text-meta uppercase text-tinta-meta">Pulso N33</p>
        <h1 id="entrar-titulo" className="mt-3 font-titular text-seccion text-tinta-titulo">
          {salida === "1" ? "Sesión cerrada." : "Inteligencia regional, con llave."}
        </h1>
        <p className="mt-4 text-lectura text-tinta-prosa">
          {salida === "1"
            ? "Puedes cerrar esta ventana o volver a entrar con tu cuenta de Microsoft."
            : "El tablero es privado. Entra con la cuenta de Microsoft de la organización; no hay contraseña propia ni registro."}
        </p>

        {aviso && (
          <p
            role="alert"
            className="mt-6 rounded-nucleo border border-aviso/40 bg-aviso/10 px-4 py-3 text-cuerpo text-tinta-dato"
          >
            {aviso}
          </p>
        )}

        {hayEntra ? (
          <form action={entrarConMicrosoft} className="mt-8">
            <input type="hidden" name="volver" value={destino} />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-tinta-titulo px-6 py-3.5 text-cuerpo font-medium text-vanta transition-colors hover:bg-white"
            >
              Entrar con Microsoft
            </button>
          </form>
        ) : (
          <p className="mt-8 rounded-nucleo border border-filo px-4 py-3 text-cuerpo text-tinta-meta">
            Este despliegue no tiene configurada la entrada con Microsoft. Faltan las variables
            AUTH_MICROSOFT_ENTRA_ID_* (ver docs/acceso.md).
          </p>
        )}

        <p className="mt-8 text-meta text-tinta-inerte">
          Microsoft es quien te identifica; aquí solo se guarda tu nombre, tu correo y tu rol.
          La sesión dura ocho horas.
        </p>
      </section>
    </div>
  );
}
