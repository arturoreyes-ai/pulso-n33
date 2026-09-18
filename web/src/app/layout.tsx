import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { Malla } from "@/components/chrome/malla";
import { Velo } from "@/components/chrome/velo";

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
 * es un salto de layout grande sobre el elemento LCP. Y el tablero ya precarga
 * notas.json con prioridad alta (components/paginas/pagina.tsx): una segunda
 * peticion prioritaria de 90 KB le quita ancho de banda al dato que la pagina
 * existe para mostrar.
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
  title: "Pulso",
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
  return (
    // `suppressHydrationWarning` esta aqui por una EXTENSION del navegador, no
    // por un desajuste de este arbol. LanguageTool escribe
    // data-lt-installed="true" sobre <html> antes de que React hidrate, y el
    // diff reporto ademas suppresshydrationwarning="true" en minusculas;
    // ninguno de los dos sale de este repo (`suppressHydrationWarning` no
    // aparecia en todo web/src, y no hay Date.now, Math.random, toLocale* ni
    // ramas typeof window: el reloj se INYECTA, ver lib/datos/tipos.ts).
    //
    // Solo tapa UN nivel, los atributos de <html> y nada mas: <body> y todo el
    // arbol de abajo siguen avisando, asi que esto no puede esconder un
    // desajuste real de la app. Si algun dia aparece uno en <body>, sera otra
    // extension (Grammarly pone data-gr-* ahi) y se decide entonces, no ahora.
    <html
      lang="es"
      className={`${GeistSans.variable} ${GeistMono.variable} ${Archivo.variable}`}
      suppressHydrationWarning
    >
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
          // El relleno de arriba es para la PASTILLA FLOTANTE, que es fija y no
          // ocupa flujo. Desde el 18 de septiembre de 2026 solo flota a partir
          // de 48rem: debajo de ese ancho la nav es `.cinta-pagina`, que va EN
          // FLUJO y reserva su propio alto, asi que un relleno aqui la
          // empujaria hacia abajo y la despegaria de la orilla, que es
          // justamente lo que la distingue de la pastilla. Con los 112px que
          // habia, una cinta de 71 dejaba 41px de banda muerta arriba de cada
          // pagina.
          //
          // La unica pagina sin nav es /entrar, y desde hoy pone su respiro
          // ella misma.
          className="relative z-[var(--z-base)] outline-none md:pt-32"
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
