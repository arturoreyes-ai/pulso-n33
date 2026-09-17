/**
 * El dominio editorial de una nota, sin la variante inocua `www`.
 *
 * No usa dominio registrable: `evil-example.com` no puede parecerse a
 * `example.com`, y una nota resuelta para un medio no se entrega a otro por
 * compartir las ultimas palabras del host.
 */

const sinWww = (host: string): string =>
  host.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");

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
