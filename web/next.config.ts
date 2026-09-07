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
