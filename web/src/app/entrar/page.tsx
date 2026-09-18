import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth, hayEntra } from "@/auth";
import { FondoLed } from "@/components/acceso/fondo-led";
import { Letrero } from "@/components/acceso/letrero";
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
 *
 * ES UNA PANTALLA desde el 18 de septiembre de 2026: la reticula de diodos no
 * es un bloque dentro de la pagina sino el fondo de toda la ventana
 * (acceso/fondo-led.tsx), y la marca son los diodos encendidos de ese mismo
 * panel (acceso/letrero.tsx). Antes era una tarjeta de 36rem centrada que se
 * parecia a la puerta de cualquier producto. Y con la letra chica fuera, por el mismo criterio del
 * 13 y el 18 de septiembre que se llevo el pie y los «Acerca de»: la pantalla
 * no esta para explicarse. Lo que decia —que no hay contrasena propia, que no
 * hay registro, quien te identifica y cuanto dura la cookie— es procedimiento
 * y vive en docs/acceso.md, que es donde lo busca quien puede cambiarlo.
 *
 * El boton SI conserva «Microsoft», que no es mecanismo sino QUE VA A PASAR:
 * lo siguiente que se ve es una pantalla de Microsoft. Quitarlo dejaria un
 * boton que miente sobre a donde lleva.
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
 *
 * Esa misma regla se aplico al texto de `Configuration` el 13 de septiembre de
 * 2026: decia "Este despliegue no tiene configurada la entrada con Microsoft.
 * Revisa docs/acceso.md" y mandaba a un archivo del repo a quien esta parado
 * en la puerta. Quien lee esto no siempre es quien puede arreglarlo, asi que
 * la frase dice el estado y a quien acudir; el procedimiento —las variables
 * AUTH_MICROSOFT_ENTRA_ID_* y docs/acceso.md— vive en este comentario y en el
 * README, que es donde lo busca quien si puede arreglarlo.
 */
const MENSAJE: Record<string, string> = {
  AccessDenied: "Tu cuenta está desactivada. Pide a un administrador del tablero que la reactive.",
  Configuration:
    "La entrada con Microsoft no está disponible. Avisa a un administrador del tablero.",
};

const MENSAJE_GENERICO = "No se pudo completar la entrada. Intenta de nuevo.";

export default async function PaginaEntrar({ searchParams }: Props) {
  const { volver, error, salida } = await searchParams;
  const destino = rutaDeRegreso(volver);

  const sesion = await auth();
  if (sesion?.user || acceso.sinEntra) redirect(destino);

  const aviso = error ? MENSAJE[error] ?? MENSAJE_GENERICO : null;

  return (
    // Tres medidas con motivo, porque ninguna se deduce del resto del sitio.
    //
    // El -mt-16 y los 8rem van JUNTOS y salen de la misma cuenta. <main> pone
    // md:pt-32 (128px) para la pastilla flotante, y esta es la unica pagina que
    // no la tiene: ahi ese relleno es espacio muerto y empujaba la composicion
    // 64px por debajo del centro optico (medido a 1440x900: 306px de aire
    // arriba contra 178 abajo). Se recupera la MITAD, no el total: `Velo` es
    // fijo, mide 136px y pinta vanta solido en sus primeros 68, asi que
    // cancelar los 128 enteros meteria la ceja del letrero debajo de una banda
    // negra. Con la mitad, el bloque queda centrado de verdad y su borde
    // superior cae en 242px, muy por debajo del velo.
    //
    // `svh` y no `dvh`, como en `.lector`: dvh cambia de valor cuando el
    // navegador esconde su barra, y eso recolocaria la puerta bajo el pulgar
    // de quien ya va a pulsar.
    //
    // El respiro de arriba en el telefono lo pone ella, como antes, pero ahora
    // por `env()`: en el resto del sitio la muesca la despeja `.cinta`, y esta
    // es la unica pagina que no la tiene. Sin eso la marca se mete debajo.
    //
    // Y el alto completo va en los DOS anchos. Mientras la reticula fue una
    // caja, su min-height era lo que le daba cuerpo a la columna en el
    // telefono; al pasar a fondo, la marca es solo texto y todo se apelotono
    // en los primeros 349px de una pantalla de 812, con 463 de vacio debajo.
    // Con el panel ocupando la ventana entera, lo que corresponde es que la
    // puerta flote en su centro.
    //
    // UNA SOLA COLUMNA CENTRADA, y no el reparto en dos de antes. Con la
    // reticula de fondo ya no hay dos objetos que equilibrar —un panel a un
    // lado y una puerta al otro—, hay una pantalla y lo que esta escrito en
    // ella; partirlo en dos columnas invitaba a leerlo como dos cosas. La
    // marca arriba y la entrada debajo es la forma de un letrero, que es lo
    // que esta pagina es.
    //
    // `text-center` cae por herencia sobre los tres bloques de texto, y por
    // eso el parrafo lleva `mx-auto`: su `max-w` lo dejaria pegado a la
    // izquierda de una columna de 34rem aunque el texto fuera centrado.
    <div
      className="mx-auto flex min-h-[100svh] w-full max-w-[88rem] flex-col items-center justify-center gap-10 px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-16 text-center md:-mt-16 md:min-h-[calc(100svh-8rem)] md:gap-12 md:px-8 md:pt-0 md:pb-0"
    >
      {/* Primero en el DOM: dentro de <main>, que es su propio contexto de
          apilamiento, eso ya basta para que quede debajo de todo. `fixed` lo
          saca del flujo, asi que no es un item de este flex y no cuenta para
          el gap. */}
      <FondoLed />

      <Letrero />

      <section aria-labelledby="entrar-titulo" className="entrada w-full max-w-[34rem]">
        <h1 id="entrar-titulo" className="font-titular text-seccion text-tinta-titulo">
          {salida === "1" ? "Sesión cerrada." : "Inteligencia regional, con llave."}
        </h1>
        <p className="mx-auto mt-4 max-w-[38ch] text-lectura text-tinta-prosa">
          {salida === "1"
            ? "Puedes cerrar esta ventana o volver a entrar."
            : "Entra con tu cuenta de la organización."}
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
              className="inline-flex w-full items-center justify-center rounded-full md:w-auto bg-tinta-titulo px-6 py-3.5 text-cuerpo font-medium text-vanta transition-colors hover:bg-white active:translate-y-px"
            >
              Entrar con Microsoft
            </button>
          </form>
        ) : (
          // Faltan AUTH_MICROSOFT_ENTRA_ID_*; ver docs/acceso.md. El nombre de
          // las variables no sale a pantalla: ver el comentario de MENSAJE.
          <p className="mt-8 rounded-nucleo border border-filo px-4 py-3 text-cuerpo text-tinta-meta">
            La entrada con Microsoft no está disponible todavía. Avisa a un administrador
            del tablero.
          </p>
        )}
      </section>
    </div>
  );
}
