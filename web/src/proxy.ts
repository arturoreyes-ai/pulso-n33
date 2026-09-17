import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { acceso } from "@/lib/acceso/config";
import { esRutaPublica } from "@/lib/acceso/rutas-publicas";

/**
 * La puerta del tablero. Corre antes de TODO lo que no sea Auth.js o un
 * asset de Next, y hace dos cosas:
 *
 *  1. Refresca la cookie de sesion rodante de Auth.js. Es el motivo por el
 *     que va envuelto en `auth`: los Server Components y las rutas no pueden
 *     escribir cookies, y sin este paso la sesion caduca a las 8 h contadas
 *     desde la entrada aunque la persona la use todo el dia.
 *
 *  2. Exige sesión, salvo en el JSON público de garitas. Esto es una
 *     DIFERENCIA deliberada respecto a SmartNote,
 *     donde el proxy no impone nada y cada ruta se custodia sola. Ahi la
 *     portada es dinamica y decide en el servidor; aqui las nueve paginas se
 *     prerrenderizan como HTML estatico (`generateStaticParams` en [zona]) y
 *     los datos son archivos bajo /data, sin ninguna ruta que pueda mirar la
 *     sesion. El unico punto por el que pasa TODO —HTML estatico, JSON de
 *     public/ y la API— es este, y en Vercel corre antes del cache de borde,
 *     asi que ni una copia cacheada de /data/notas.json se sirve sin sesion.
 *
 * Lo que NO hace: mirar el rol. Aqui solo hay un JWT; la tabla `usuarios` se
 * consulta en las rutas (lib/acceso/sesion.ts). Una baja se aplica al volver
 * a entrar (auth.ts, callbacks.signIn) y en la siguiente peticion a la API.
 *
 * Sin sesion, una pagina redirige a /entrar con la ruta pedida en `volver`;
 * una peticion de datos o de API recibe 401 en JSON, que es lo que su cliente
 * sabe leer. Una redireccion a HTML habria roto el panel con un error de
 * parseo en vez de decir "inicia sesión". `/api/garitas` es la única salida:
 * publica datos oficiales sin cuenta para que otros sistemas los consuman.
 */
export const proxy = auth((peticion) => {
  const { pathname, search } = peticion.nextUrl;
  const esPuerta = pathname === "/entrar" || pathname.startsWith("/entrar/");
  if (esRutaPublica(pathname)) {
    const respuesta = NextResponse.next();
    respuesta.headers.set("Access-Control-Allow-Origin", "*");
    respuesta.headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    return respuesta;
  }
  if (esPuerta || acceso.sinEntra || peticion.auth?.user) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/") || pathname.startsWith("/data/")) {
    return NextResponse.json(
      { detalle: "Inicia sesión con Microsoft Entra" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const destino = new URL("/entrar", peticion.nextUrl);
  destino.searchParams.set("volver", `${pathname}${search}`);
  return NextResponse.redirect(destino);
});

export const config = {
  // Fuera del proxy, y por que:
  //  - api/auth: es Auth.js mismo; custodiar su callback bloquearia la entrada.
  //  - _next/static, _next/image: bundles e imagenes con hash; no dicen nada.
  //  - favicon.ico y ruido.svg: los pide el navegador antes de saber quien es.
  // Todo lo demas, /data incluido, pasa por aqui.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|ruido.svg).*)"],
};
