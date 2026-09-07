import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { preload } from "react-dom";

import { Malla } from "@/components/chrome/malla";
import { Velo } from "@/components/chrome/velo";
import { MISMO_ORIGEN, RUTAS } from "@/lib/datos/config";

import "./globals.css";

export const metadata: Metadata = {
  title: "Pulso N33",
  description:
    "Inteligencia regional del corredor Tijuana y San Diego: prensa, precios, crimen y percepción por zona.",
  // Igual que el tablero anterior: esto no se indexa mientras los datos y las
  // salvedades no esten revisados.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // React 19 iza el link al <head> antes de que exista JS de cliente, asi que
  // el archivo mas grande empieza a bajar sin esperar la hidratacion.
  //
  // `as: "fetch"` es quisquilloso: si el modo CORS del preload no coincide con
  // el del fetch que lo consume, el navegador DESCARTA la descarga y avisa
  // "preloaded but not used", o sea que se paga dos veces y no sirve. Mismo
  // origen quiere SIN crossOrigin; un host remoto lo quiere y ademas necesita
  // cabeceras CORS.
  preload(RUTAS.notas, {
    as: "fetch",
    fetchPriority: "high",
    ...(MISMO_ORIGEN ? {} : { crossOrigin: "anonymous" }),
  });

  return (
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-[100dvh] font-sans antialiased">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:top-6 focus:left-6 focus:z-[var(--z-portal)] focus:rounded-full focus:bg-white focus:px-6 focus:py-3 focus:font-medium focus:text-black"
        >
          Saltar al contenido
        </a>

        <Malla />
        {/* La nav flotante vive dentro de cada pagina (tablero.tsx): necesita
            saber la zona, y la zona es un segmento de ruta por debajo de este
            layout. */}

        <main
          id="contenido"
          tabIndex={-1}
          className="relative z-[var(--z-base)] pt-28 outline-none md:pt-32"
        >
          {/* Primero en el DOM a proposito: comparte `--z-elevado` con la
              barra pegajosa del muro y el orden decide quien tapa a quien. */}
          <Velo />
          {children}
        </main>
      </body>
    </html>
  );
}
