import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";

import { auth } from "@/auth";
import { acceso } from "@/lib/acceso/config";
import { esRutaPublica } from "@/lib/acceso/rutas-publicas";
import { buscarUsuarioPorCorreo } from "@/lib/acceso/usuarios";

/**
 * Custodia HTML estatico, JSON y API antes del cache de Vercel. Cada peticion
 * autenticada consulta activo y aprobado: un JWT vigente no conserva acceso
 * revocado. Las rutas API comprueban permisos tambien junto a los datos.
 * Esta consulta es necesaria porque public/data no tiene un handler propio.
 * Si la base falla, no se entrega contenido protegido.
 */
const proxyAutenticado = auth(async (peticion, _evento: NextFetchEvent) => {
  const { pathname, search } = peticion.nextUrl;
  const esPuerta = pathname === "/entrar" || pathname.startsWith("/entrar/");
  if (esRutaPublica(pathname)) {
    const respuesta = NextResponse.next();
    respuesta.headers.set("Access-Control-Allow-Origin", "*");
    respuesta.headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    return respuesta;
  }
  if (esPuerta || acceso.sinEntra) {
    return NextResponse.next();
  }

  if (peticion.auth?.user) {
    try {
      const correo = peticion.auth.user.email?.trim().toLowerCase();
      const usuario = correo ? await buscarUsuarioPorCorreo(correo) : null;
      if (usuario?.activo && usuario.aprobado) return NextResponse.next();
      if (pathname.startsWith("/api/") || pathname.startsWith("/data/")) {
        return NextResponse.json({ detalle: "Tu acceso requiere aprobación de un administrador" },
          { status: 403, headers: { "Cache-Control": "no-store" } });
      }
      const destino = new URL("/entrar", peticion.nextUrl);
      destino.searchParams.set("error", usuario?.activo ? "ApprovalRequired" : "AccessDenied");
      destino.searchParams.set("volver", `${pathname}${search}`);
      return NextResponse.redirect(destino);
    } catch {
      return NextResponse.json({ detalle: "No se pudo verificar el acceso. Intenta de nuevo." },
        { status: 503, headers: { "Cache-Control": "no-store" } });
    }
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

export function proxy(peticion: NextRequest, evento: NextFetchEvent) {
  // Fuera del envoltorio de Auth.js: sin Entra no hay sesion que descifrar.
  if (acceso.sinEntra) {
    const respuesta = NextResponse.next();
    if (esRutaPublica(peticion.nextUrl.pathname)) {
      respuesta.headers.set("Access-Control-Allow-Origin", "*");
      respuesta.headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    }
    return respuesta;
  }
  return proxyAutenticado(peticion, evento);
}

export const config = {
  // Fuera del proxy, y por que:
  //  - api/auth: es Auth.js mismo; custodiar su callback bloquearia la entrada.
  //  - _next/static, _next/image: bundles e imagenes con hash; no dicen nada.
  //  - favicon.ico y ruido.svg: los pide el navegador antes de saber quien es.
  // Todo lo demas, /data incluido, pasa por aqui.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|ruido.svg).*)"],
};
