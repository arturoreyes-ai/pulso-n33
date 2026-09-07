import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { preload } from "react-dom";

import { Malla } from "@/components/chrome/malla";
import { Velo } from "@/components/chrome/velo";
import { MISMO_ORIGEN, RUTAS } from "@/lib/datos/config";

import "./globals.css";

/**
 * Archivo, la voz de titular. Solo h1 y h2.
 *
 * VENDORIZADA a proposito, no `next/font/google`. El binario sale de
 * @fontsource-variable/archivo v25 (OFL-1.1, licencia junto al .woff2) y se
 * carga igual que Geist, que tambien es `next/font/local` sobre un woff2 de
 * node_modules. Dos razones:
 *
 * 1. `next/font/google` mete la PRIMERA dependencia de red en el build. Hoy
 *    `pnpm build` es sincronizar-datos + next build, y ese script es puro
 *    node:fs. El loader de Next no cachea la fuente en disco, y falla de
 *    forma asimetrica: en dev se traga el error y cae a Arial en silencio, en
 *    `next build` revienta. En un proyecto con modo --sin-red documentado, es
 *    el intercambio equivocado.
 *
 * 2. Asi elegimos el ARCHIVO. El entry por defecto del paquete
 *    (`index.css`, 34,928 B) trae solo el eje de peso y NINGUN descriptor
 *    font-stretch: pedirle wdth 112 se aplica limpio, se lee de vuelta bien
 *    con getComputedStyle, y renderiza a 100. Un fallo mudo. El que sirve es
 *    `archivo-latin-wdth-normal.woff2`, 90,104 B.
 *
 * `declarations` es NECESARIO: el binario trae el eje, pero la regla
 * @font-face que genera next/font no lo declara sin esto.
 *
 * `display: "optional"` y sin preload, en vez de "swap": Archivo a wdth 112
 * es ~20% mas ancha por glifo que el Arial ajustado que hace de respaldo, asi
 * que a 375px el h1 puede CAMBIAR DE NUMERO DE LINEAS al intercambiar, y eso
 * es un salto de layout grande sobre el elemento LCP. Y abajo ya se precarga
 * notas.json con prioridad alta: una segunda peticion prioritaria de 90 KB le
 * quita ancho de banda al dato que la pagina existe para mostrar.
 */
const Archivo = localFont({
  src: "./fonts/archivo-latin-wdth-normal.woff2",
  variable: "--font-archivo",
  weight: "100 900",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
  display: "optional",
  preload: false,
  adjustFontFallback: "Arial",
});

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
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable} ${Archivo.variable}`}>
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
