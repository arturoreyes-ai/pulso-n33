import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Leer un archivo de /data DESDE EL DISCO, en el servidor.
 *
 * Vivio dentro de lib/analisis/datos-redes.ts hasta que /api/actualidad y
 * /api/buscar necesitaron lo mismo para cruzar una fila en vivo contra el
 * archivo. Lo que se saco aqui es la infraestructura; el argumento legal de
 * aquel modulo —que la URL que manda el cliente es una LLAVE DE BUSQUEDA y
 * jamas un destino— se quedo alla, porque es de aquella ruta y no de esta
 * lectura.
 *
 * SE LEE DEL DISCO Y NO POR HTTP, que es el diseno obvio y el equivocado:
 *
 *  1. `proxy.ts` exige sesion tambien para `/data/`, a proposito y con el
 *     motivo escrito ahi. Una peticion del servidor a su propio sitio no lleva
 *     cookie, asi que recibiria 401 SIEMPRE, en produccion y nunca en la
 *     prueba offline, que es la peor forma de fallar.
 *  2. El origen saldria de la cabecera `Host`, que la pone quien llama.
 *
 * El precio, y queda escrito porque es una excepcion real: `datos/config.ts`
 * dice que mover los datos a otro host es una variable y un redespliegue. Eso
 * sigue siendo cierto para todos los lectores menos los que pasan por aqui. Si
 * algun dia `NEXT_PUBLIC_DATOS_URL` apunta afuera, estas lecturas hay que
 * mudarlas a HTTP y este parrafo es el aviso.
 *
 * Y una consecuencia que falla en silencio: cada archivo que se lea asi tiene
 * que estar en `outputFileTracingIncludes` de `next.config.ts` o no viaja al
 * bundle de la funcion. Sin eso todo funciona en `next dev` y en produccion no
 * hay dato, sin ninguna prueba que lo atrape.
 */

// Importacion con nombre y no `import path from`: probar-analisis.cjs
// transpila sin `esModuleInterop` y un default de un modulo de Node sale
// undefined ahi.
const CARPETA = join(process.cwd(), "public", "data");

/** Un archivo publicado bajo /data, ya parseado, o `null` si no esta. */
export type LeerDatos = (nombre: string) => Promise<unknown | null>;

export const leerDatoPublicado: LeerDatos = async (nombre) => {
  try {
    // Un ENOENT y un JSON roto son el MISMO estado para quien llama: no hay
    // dato. Distinguirlos solo daria dos mensajes que dicen lo mismo.
    return JSON.parse(await readFile(join(CARPETA, nombre), "utf8")) as unknown;
  } catch {
    return null;
  }
};
