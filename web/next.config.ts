import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // La raiz del proyecto es web/, no el repo. Sin esto Turbopack sube hasta la
  // raiz del repo buscando el lockfile y avisa en cada build.
  turbopack: { root: import.meta.dirname },

  // `output` se queda SIN definir a proposito. 'export' prohibiria headers(),
  // route handlers e ISR, que es justo la opcionalidad por la que se eligio
  // Vercel en vez de un sitio estatico. Sin definirlo, `/` se prerrenderiza
  // igual (la salida del build debe decir "○ (Static)") y el servidor sigue
  // disponible el dia que cambien los requisitos.

  // /api/analizar-publicacion lee estos cuatro archivos DEL DISCO, no por HTTP
  // (el motivo esta en lib/analisis/datos-redes.ts). El trazado automatico no
  // los ve, porque el nombre se arma en tiempo de ejecucion, y sin esto no
  // viajan al bundle de la funcion.
  //
  // FALLA EN SILENCIO Y EN LA DIRECCION MALA: con `next dev` todo funciona, y
  // en produccion la ruta devuelve `codigo: "datos"` siempre. No hay prueba
  // que pueda atraparlo. Los dos `*-comentarios.json` vienen de efimero/,
  // fuera de git, y en un despliegue construido desde el repositorio no
  // existen; un patron que no empareja nada simplemente no se incluye, que es
  // el comportamiento que se quiere.
  outputFileTracingIncludes: {
    "/api/analizar-publicacion": [
      "./public/data/redes.json",
      "./public/data/tiktok.json",
      "./public/data/redes-comentarios.json",
      "./public/data/tiktok-comentarios.json",
    ],
    // El guion de la pestana TikTok lee solo los pies: nada de comentarios.
    "/api/guion-tiktok": ["./public/data/tiktok.json"],
    // Las tres rutas que cruzan un titular en vivo contra el archivo
    // (lib/busqueda/archivo.ts). Sin esto la miniatura y el enlace del propio
    // medio salen null en toda fila y la hoja de relacionadas dice que no se
    // pudo consultar: degradado correcto, pero degradado, y solo en
    // produccion. notas.json SI esta en git, asi que aqui el patron siempre
    // empareja; si alguna vez no lo hiciera, el sintoma es ese.
    "/api/actualidad": ["./public/data/notas.json"],
    // Desde el 23 de septiembre de 2026 la busqueda lee tambien los buscadores
    // de los medios, que llegan en catalogo-busqueda.json (lo arma
    // scripts/sincronizar-datos.mjs desde config/). Sin el, la busqueda sigue
    // con Google y el archivo, sin Blanco y Negro: degradado y en silencio.
    "/api/buscar": ["./public/data/notas.json", "./public/data/catalogo-busqueda.json"],
    "/api/relacionadas": ["./public/data/notas.json"],
    // La busqueda de un termino en Redes (lib/busqueda/termino.ts): prensa,
    // archivo, lo que el panel de redes ya cosecho y su texto de comentarios,
    // las tendencias de X y el roster, que decide si el tono se puede mostrar
    // (regla 5). Los *-comentarios.json estan fuera de git: si no viajan, las
    // publicaciones salen sin texto y la ficha lo dice.
    "/api/termino": [
      "./public/data/notas.json",
      "./public/data/catalogo-busqueda.json",
      "./public/data/redes.json",
      "./public/data/tiktok.json",
      "./public/data/youtube.json",
      "./public/data/redes-comentarios.json",
      "./public/data/tiktok-comentarios.json",
      "./public/data/tendencias.json",
      "./public/data/roster.json",
    ],
    // El pase pagado solo necesita el roster, por la misma regla 5.
    "/api/redes-en-vivo": ["./public/data/roster.json"],
    // El informe en PDF de un termino (lib/informe/informe.ts) lee los dos
    // archivos de consultas del disco y registra Geist desde node_modules:
    // el motor de PDF no lee las fuentes del sistema. Sin esto la ruta
    // devuelve 503 en produccion y solo en produccion; el segundo archivo
    // vive fuera de git y puede no estar, y entonces el informe lo dice.
    "/api/informe-consulta": [
      "./public/data/consultas.json",
      "./public/data/consultas-comentarios.json",
      "./node_modules/geist/dist/fonts/geist-sans/Geist-Regular.woff2",
      "./node_modules/geist/dist/fonts/geist-sans/Geist-Medium.woff2",
      "./node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.woff2",
      "./node_modules/geist/dist/fonts/geist-sans/Geist-Bold.woff2",
    ],
  },

  experimental: {
    // CRITICO. Los dos son barriles: sin esto, un solo import de un icono
    // arrastra ~1,500 modulos y un import de Recharts mete la libreria
    // completa al bundle de entrada. Ninguno esta en la lista que Next trae
    // por omision. El fallo es SILENCIOSO: la app funciona, el bundle pesa
    // 400 KB mas. Hay que revisarlo con el analizador, no confiar.
    optimizePackageImports: [
      "@phosphor-icons/react",
      "@phosphor-icons/react/dist/ssr",
      "recharts",
    ],
  },

  async headers() {
    return [
      {
        // Cada despliegue de Vercel tiene su propio ambito de cache inmutable
        // y un commit de datos produce un despliegue nuevo, asi que un
        // s-maxage largo nunca sirve datos viejos entre despliegues.
        source: "/data/:archivo*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
