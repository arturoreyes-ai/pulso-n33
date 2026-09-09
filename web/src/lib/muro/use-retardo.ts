"use client";

import { useEffect, useState } from "react";

/**
 * El valor, pero tarde. Para efectos con costo real: escribir la URL y salir
 * a la red.
 *
 * No sustituye a useDeferredValue, que es otra cosa. useDeferredValue deja que
 * React interrumpa un render caro y no cuesta nada de mas si el trabajo cabe
 * en el cuadro: es lo correcto para filtrar el corpus en memoria, y ese filtro
 * sigue corriendo por tecla. Un retardo de reloj es lo correcto cuando el
 * efecto NO se puede interrumpir ni descartar a mitad.
 */
export function useRetardo<T>(valor: T, ms: number): T {
  const [tardio, setTardio] = useState(valor);
  useEffect(() => {
    const id = setTimeout(() => setTardio(valor), ms);
    return () => clearTimeout(id);
  }, [valor, ms]);
  return tardio;
}

/**
 * 400 ms: por encima del intervalo entre teclas al escribir de corrido (~250
 * ms), asi que una palabra genera una peticion y no seis; y por debajo del
 * segundo, donde la espera empieza a leerse como que no funciona.
 */
export const RETARDO_BUSQUEDA = 400;
