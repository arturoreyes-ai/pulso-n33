/**
 * Que URL se puede abrir para leerla.
 *
 * La URL llega del cliente. Sin este filtro la ruta es un SSRF: cualquiera con
 * sesion podria pedirle al servidor que trajera `http://169.254.169.254/` —el
 * endpoint de metadatos de la nube— o cualquier servicio interno, y la
 * respuesta volveria resumida por un modelo.
 *
 * El filtro es por NOMBRE DE HOST y no fija la IP resuelta, asi que un dominio
 * publico que apunte a una direccion privada lo pasa. Esa es la limitacion que
 * queda, y esta escrita aqui a proposito: cerrarla de verdad pide resolver y
 * anclar la IP, que en el `fetch` de la plataforma no se puede. Lo que la acota
 * es que proxy.ts ya exige sesion para llegar a la ruta.
 */

/** Rangos que no se piden nunca, por nombre o por literal. */
const PROHIBIDOS = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /\.localhost$/i,
  /^\[?::1\]?$/,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  // 172.16.0.0 - 172.31.255.255
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
  // IPv6 unica local (fc00::/7) y enlace local (fe80::/10), con o sin corchetes
  /^\[?f[cd][0-9a-f]{2}:/i,
  /^\[?fe[89ab][0-9a-f]:/i,
];

export function urlSegura(crudo: string | null): URL | null {
  if (crudo === null || crudo === "") return null;
  let u: URL;
  try {
    u = new URL(crudo);
  } catch {
    return null;
  }
  // Solo https. Un http: abre la puerta a un intermediario que decide que lee
  // el modelo, y ningun medio del catalogo lo necesita.
  if (u.protocol !== "https:") return null;
  // Credenciales en la URL: nunca se reenvian desde aqui.
  if (u.username !== "" || u.password !== "") return null;
  if (PROHIBIDOS.some((p) => p.test(u.hostname))) return null;
  // Un host sin punto no es un dominio publico: es una maquina de la red.
  if (!u.hostname.includes(".")) return null;
  return u;
}
