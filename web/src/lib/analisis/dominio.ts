/**
 * El dominio editorial de una nota, sin la variante inocua `www`.
 *
 * No usa dominio registrable: `evil-example.com` no puede parecerse a
 * `example.com`, y una nota resuelta para un medio no se entrega a otro por
 * compartir las ultimas palabras del host.
 */

/**
 * Hosts que SON el dominio editorial de otro, escritos a mano y exactos, por
 * la misma razon del parrafo de arriba: un parecido de nombre no basta.
 *
 * El caso, 25 de septiembre de 2026: Google rotulaba "Inteligencia artificial
 * comienza a utilizarse en proyectos de construccion en Tijuana" con
 * <source> elimparcial-elimparcial-prod.web.arc-cdn.net, el servidor de
 * origen de Arc XP, la plataforma de El Imparcial, en la url Y en el nombre.
 * La tarjeta decia "Abrir en elimparcial-elimparcial-prod.web.arc-cdn.net",
 * no hallaba la foto ni el enlace del archivo (que es de elimparcial.com) y el
 * token llevaba a esa direccion. La pagina es la del medio: su og:url es
 * www.elimparcial.com con la misma ruta. Aqui entra solo lo que se comprobo
 * asi. `medio` es el nombre de su fila en config/medios.json, y la misma
 * llave va en `publicadores` de config/busquedas.json para el pipeline;
 * scripts/probar-busqueda.cjs exige que las tres cosas coincidan.
 */
export const DOMINIOS_ALTERNOS: Readonly<Record<string, { dominio: string; medio: string }>> = {
  "elimparcial-elimparcial-prod.web.arc-cdn.net": { dominio: "elimparcial.com", medio: "El Imparcial" },
};

/** El alterno declarado para un host ya sin `www`, o null. `hasOwn` porque
 *  "constructor" es un host valido y una llave heredada de Object. */
export function alternoDe(host: string): { dominio: string; medio: string } | null {
  return Object.hasOwn(DOMINIOS_ALTERNOS, host) ? DOMINIOS_ALTERNOS[host]! : null;
}

const sinWww = (host: string): string => {
  const h = host.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  return alternoDe(h)?.dominio ?? h;
};

export function normalizarDominio(crudo: string): string | null {
  const limpio = crudo.trim().toLowerCase().replace(/\.$/, "");
  if (limpio === "" || limpio.includes("/") || limpio.includes("@") || limpio.includes(":")) {
    return null;
  }
  try {
    const u = new URL(`https://${limpio}`);
    if (u.hostname !== limpio || u.pathname !== "/" || u.search !== "" || u.hash !== "") return null;
    return sinWww(u.hostname);
  } catch {
    return null;
  }
}

export function dominioDeUrl(crudo: string | URL): string | null {
  try {
    const u = typeof crudo === "string" ? new URL(crudo) : crudo;
    if (u.protocol !== "https:" || u.username !== "" || u.password !== "" || u.port !== "") return null;
    return sinWww(u.hostname);
  } catch {
    return null;
  }
}
