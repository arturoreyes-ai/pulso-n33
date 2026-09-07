"use client";

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";

import { useEstado, useNotas } from "@/lib/datos/hooks";
import type { Nota } from "@/lib/datos/tipos";
import {
  contarDelegaciones,
  tieneDelegacion,
  type FiltroDelegacion,
} from "@/lib/dominio/delegaciones";
import { plegar } from "@/lib/dominio/formato";
import { elegirDelegacion as escribirDelegacion, useFiltroDelegacion } from "./filtro-delegacion";
import { limpiarTema, useFiltroTema } from "./filtro-tema";
import { INDICE_VACIO, indexar, type Grupo } from "./indexar";

export type { Grupo } from "./indexar";

const SIN_NOTAS: readonly Nota[] = [];
const SIN_GRUPOS: readonly Grupo[] = [];

const POR_RECIENTE = (a: Nota, b: Nota) =>
  (b.publicado ?? b.fecha ?? "").localeCompare(a.publicado ?? a.fecha ?? "");

const COMPARADORES = {
  reciente: POR_RECIENTE,
  antiguo: (a: Nota, b: Nota) => POR_RECIENTE(b, a),
} as const;

export type Orden = keyof typeof COMPARADORES;

/**
 * El estado del muro. La ZONA ya no vive aqui: es la pagina (app/[zona]) y
 * llega como parametro. Lo que sigue siendo estado local es el texto de
 * busqueda y el orden.
 */
export function useMuro(zona: string | null) {
  const { data: doc, error, isLoading } = useNotas();
  const { data: estado } = useEstado();

  const [orden, setOrden] = useState<Orden>("reciente");
  const [consulta, setConsulta] = useState("");
  const [pendiente, iniciar] = useTransition();

  // El filtro por tema vive en una tienda externa porque lo escribe el panel
  // de temas, que es otra isla de cliente.
  const temaIds = useFiltroTema();

  // El filtro por delegacion vive en la URL (?d=) y solo aplica en Tijuana.
  const delegacion = useFiltroDelegacion(zona);

  // La tienda de temas es de MODULO y sobrevive a la navegacion entre zonas.
  // Sin esto, un tema tocado en Tijuana (ids de notas de Tijuana) filtraria
  // el muro de Mexicali hasta dejarlo vacio. Al desmontar, se limpia.
  useEffect(() => () => limpiarTema(), []);

  // Escribir se mantiene instantaneo; el trabajo de las ~700 filas corre
  // contra el valor diferido.
  const consultaDiferida = useDeferredValue(consulta);

  // (1) BASE. toSorted() y no sort(): SWR entrega el MISMO objeto de arreglo a
  //     todos los consumidores, y ordenarlo en sitio corromperia el cache
  //     para todos, incluidos los paneles de graficas.
  const base = useMemo(
    () => (doc !== undefined ? doc.notas.toSorted(POR_RECIENTE) : SIN_NOTAS),
    [doc],
  );

  // (2) El pajar de busqueda, construido una vez por base y con los acentos
  //     plegados igual que en Python.
  const corpus = useMemo(
    () => base.map((n) => ({ n, h: `${plegar(n.titulo)} ${n.dominio}` })),
    [base],
  );

  // (3) FILTRO de texto y de tema. No depende de `zona` ni de `orden`, asi que
  //     cambiar el orden no vuelve a filtrar.
  const filtradas = useMemo(() => {
    const q = plegar(consultaDiferida.trim());
    if (q === "" && temaIds.size === 0) return base;
    const salida: Nota[] = [];
    for (let i = 0; i < corpus.length; i++) {
      const par = corpus[i];
      if (par === undefined) continue;
      // Lo mas selectivo primero, y salida temprana.
      if (temaIds.size > 0 && !temaIds.has(par.n.id)) continue;
      if (q !== "" && !par.h.includes(q)) continue;
      salida.push(par.n);
    }
    return salida;
  }, [base, corpus, consultaDiferida, temaIds]);

  // (4) ORDEN, en su propio memo. Reordenar nunca vuelve a filtrar.
  const ordenadas = useMemo(
    () => (orden === "reciente" ? filtradas : filtradas.toSorted(COMPARADORES[orden])),
    [filtradas, orden],
  );

  // (5) LA PASADA UNICA. Llaveada solo por la lista, no por `zona`.
  const indice = useMemo(
    () => (ordenadas.length > 0 ? indexar(ordenadas) : INDICE_VACIO),
    [ordenadas],
  );

  // (6) La zona es una BUSQUEDA en el indice, no un recalculo.
  const grupos = useMemo(() => {
    if (zona === null) return indice.grupos;
    const g = indice.porZona.get(zona);
    return g === undefined ? SIN_GRUPOS : [g];
  }, [indice, zona]);

  // (6b) La delegacion es un filtro SOBRE el grupo de Tijuana, no otra
  //      dimension del indice: solo una zona la tiene y solo ~8% de sus notas
  //      la traen. Fuera de Tijuana `delegacion` es null y esto no hace nada.
  const gruposFinales = useMemo(() => {
    if (delegacion === null) return grupos;
    const salida: Grupo[] = [];
    for (const g of grupos) {
      const notas = g.notas.filter((n) => tieneDelegacion(n, delegacion));
      if (notas.length > 0) salida.push({ zona: g.zona, notas });
    }
    return salida;
  }, [grupos, delegacion]);

  // (6c) Conteo por delegacion para los chips. Sigue al filtro de texto y de
  //      tema, igual que `conteo`, y trae las nueve claves aunque sean cero.
  const conteoDelegaciones = useMemo(
    () =>
      zona === "Tijuana"
        ? contarDelegaciones(indice.porZona.get("Tijuana")?.notas ?? SIN_NOTAS)
        : null,
    [indice, zona],
  );

  // (7) El reloj. Las edades se miden contra el corte y no contra el
  //     navegador, para que una pestana abierta desde ayer no mienta.
  const corte = useMemo(
    () => (estado !== undefined ? Date.parse(estado.generado) : Number.NaN),
    [estado],
  );

  const elegirOrden = (o: Orden) => iniciar(() => setOrden(o));
  // Volver a tocar la delegacion activa la limpia. La escritura va en la
  // transicion para que la lista se atenue en vez de bloquear el chip.
  const elegirDelegacion = (f: FiltroDelegacion | null) =>
    iniciar(() => escribirDelegacion(f === delegacion ? null : f));

  const visiblesZona = zona === null ? indice.visibles : (indice.conteo.get(zona) ?? 0);

  return {
    grupos: gruposFinales,
    conteo: indice.conteo,
    visibles:
      delegacion === null ? visiblesZona : (conteoDelegaciones?.get(delegacion) ?? 0),
    delegacion,
    conteoDelegaciones,
    elegirDelegacion,
    fuera: indice.fuera,
    nacionales: indice.nacionales,
    totalVentana: doc?.total ?? 0,
    ventanaDias: doc?.ventana_dias ?? null,
    orden,
    elegirOrden,
    consulta,
    setConsulta,
    temaIds,
    corte,
    pendiente,
    error: error as Error | undefined,
    cargando: isLoading,
    /** True mientras el render diferido va atras de lo que se escribio. */
    desfasado: consulta !== consultaDiferida,
  };
}
