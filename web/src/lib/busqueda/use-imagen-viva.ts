"use client";

import { useEffect, useRef, useState } from "react";

import { enlaceParaAnalisis } from "./enlaces";
import { imagenPara } from "./imagenes";
import { leerApi, useHayServidor } from "./disponible";
import type { Tarjeta } from "./capitulos";

/**
 * Las miniaturas que no estan en el corpus, pedidas de a una.
 *
 * POR QUE PEREZOSO Y NO EN LA LISTA. El recorrido encadena hasta nueve
 * capitulos de quince filas: pedir la imagen de todas serian ~135 vueltas al
 * medio por lector, la mayoria de tarjetas que nadie llega a ver. Se piden solo
 * la tarjeta ASENTADA y la siguiente, contra el indice que publica
 * lib/pantalla/recorrido.ts —que se emite al asentar y no en cada cuadro del
 * gesto—, asi que desplazarse rapido de una punta a otra no dispara nada.
 *
 * EL CORPUS GANA. Si imagenes.ts ya trae la miniatura del feed del propio
 * medio, no se pide nada: esa ya esta, es gratis y no depende de que la pagina
 * del medio conteste.
 *
 * UNA SOLA VEZ POR TARJETA. `pedidas` recuerda las llaves intentadas, con
 * exito o sin el. Un fallo NO se reintenta: la tarjeta se queda con su placa,
 * que es un estado valido y no un error que reparar a costa del medio.
 *
 * SIN AbortController, Y ESTO NO ES DESCUIDO. La primera version cortaba las
 * peticiones en vuelo al desmontar, y en desarrollo no pedia NADA: StrictMode
 * monta, desmonta y vuelve a montar, asi que la limpieza abortaba el
 * controlador que el segundo pase reutilizaba —ya abortado— mientras `pedidas`
 * impedia reintentar. Cero peticiones, cero errores en consola y todas las
 * tarjetas con placa: se veia igual que si la funcion estuviera apagada. Lo
 * que se gana cortando es poco (son GET cacheados) y lo que se arriesga es
 * eso, asi que solo se guarda si el componente sigue vivo.
 */

const VACIO: ReadonlyMap<string, string> = new Map();

type Titular = Extract<Tarjeta, { tipo: "titular" }>;

const esTitular = (t: Tarjeta | undefined): t is Titular =>
  t !== undefined && t.tipo === "titular";

export function useImagenesVivas(
  tarjetas: readonly Tarjeta[],
  actual: number,
  corpus: ReadonlyMap<string, string>,
  enlaces: ReadonlyMap<string, string>,
): ReadonlyMap<string, string> {
  const hayServidor = useHayServidor();
  const [vivas, setVivas] = useState<ReadonlyMap<string, string>>(VACIO);
  const pedidas = useRef(new Set<string>());
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  useEffect(() => {
    if (!hayServidor) return;
    // La asentada y la siguiente. Una sola de adelanto: la de mas alla cambia
    // de identidad en cuanto llega otro capitulo.
    for (const i of [actual, actual + 1]) {
      const t = tarjetas[i];
      if (!esTitular(t)) continue;
      if (pedidas.current.has(t.clave)) continue;
      if (imagenPara(t.r, corpus) !== null) continue;
      const ref = enlaceParaAnalisis(t.r, enlaces);
      if (ref === null) continue;
      pedidas.current.add(t.clave);
      const clave = t.clave;
      const ruta = `/api/imagen?u=${encodeURIComponent(ref.url)}&d=${encodeURIComponent(ref.dominio)}`;
      void leerApi<{ imagen: string | null }>(ruta)
        .then((r) => {
          const imagen = r.imagen;
          if (!vivo.current || imagen === null) return;
          setVivas((previas) => {
            if (previas.get(clave) === imagen) return previas;
            const siguiente = new Map(previas);
            siguiente.set(clave, imagen);
            return siguiente;
          });
        })
        // Un medio que no contesta no es un error del lector. La placa queda.
        .catch(() => undefined);
    }
  }, [hayServidor, tarjetas, actual, corpus, enlaces]);

  return vivas;
}
