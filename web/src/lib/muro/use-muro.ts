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
import type { ZonaRuta } from "@/lib/dominio/zonas";
import { ambitosDe, esAmbitoActualidad, usaCorpus, type Ambito } from "@/lib/busqueda/ambito";
import type { Rubro } from "@/lib/busqueda/rubros";
import { MINIMO_CONSULTA, type ResultadoExterno } from "@/lib/busqueda/tipos";
import { useActualidad } from "@/lib/busqueda/use-actualidad";
import { useBusquedaViva } from "@/lib/busqueda/use-busqueda";
import { elegirAmbito as escribirAmbito, useAmbito } from "./filtro-ambito";
import { elegirDelegacion as escribirDelegacion, useFiltroDelegacion } from "./filtro-delegacion";
import { escribirConsulta, useConsultaUrl } from "./filtro-consulta";
import { limpiarTema, useFiltroTema } from "./filtro-tema";
import { RETARDO_BUSQUEDA, useRetardo } from "./use-retardo";
import { INDICE_VACIO, indexar, type Grupo } from "./indexar";

export type { Grupo } from "./indexar";

const SIN_NOTAS: readonly Nota[] = [];
const SIN_GRUPOS: readonly Grupo[] = [];
const SIN_TITULOS: ReadonlySet<string> = new Set();

/**
 * Una fila del muro en modo busqueda. El corpus y lo que llega en vivo son el
 * mismo resultado para quien pregunta, asi que van en una sola lista; la
 * diferencia se dice en la fila, no partiendo la respuesta en dos.
 */
export type FilaMuro =
  | { clave: string; fecha: string; nota: Nota; externo?: undefined }
  | { clave: string; fecha: string; externo: ResultadoExterno; nota?: undefined };

const SIN_FILAS: readonly FilaMuro[] = [];

/**
 * El unico orden del muro: del mas reciente al mas antiguo. Hubo una pastilla
 * "Antiguas" que lo invertia y se quito el 11 de septiembre de 2026 a peticion
 * del cliente: un muro de prensa se lee de hoy hacia atras, y en el modo
 * actualidad el orden ni siquiera es nuestro, es el de Google.
 */
const POR_RECIENTE = (a: Nota, b: Nota) =>
  (b.publicado ?? b.fecha ?? "").localeCompare(a.publicado ?? a.fecha ?? "");

/**
 * Las tres formas del muro. `corpus` agrupa por zona lo cosechado; `busqueda`
 * aplana y suma lo que llega en vivo; `actualidad` es la seccion de Google
 * Noticias de un ambito sin corpus, cuando no hay consulta.
 */
export type ModoMuro = "corpus" | "busqueda" | "actualidad";

/**
 * El estado del muro. La ZONA ya no vive aqui: es la pagina (app/[zona]) y
 * llega como parametro. Lo que sigue siendo estado local es el texto de
 * busqueda.
 */
export function useMuro(zona: ZonaRuta | null) {
  const { data: doc, error, isLoading } = useNotas();
  const { data: estado } = useEstado();

  // La URL es SEMILLA y no fuente de verdad: el input tiene que responder en
  // el cuadro de la tecla, y escribir el historial en cada una vuelve a
  // renderizar a todos los consumidores de useSearchParams. Ver
  // filtro-consulta.ts.
  const consultaUrl = useConsultaUrl();
  const [consulta, setConsulta] = useState(consultaUrl);
  const [pendiente, iniciar] = useTransition();

  // El filtro por tema vive en una tienda externa porque lo escribe el panel
  // de temas, que es otra isla de cliente.
  const temaIds = useFiltroTema();

  // El filtro por delegacion vive en la URL (?d=) y solo aplica en Tijuana.
  const delegacion = useFiltroDelegacion(zona);

  // Hasta donde busca (?a=). Se deriva en el render, sin efecto: un valor que
  // no corresponde a esta pagina cae al de omision.
  const ambito = useAmbito(zona);

  // El rubro de la lista en vivo (Mexico, Internacional). Local, como el
  // texto: es un toque dentro de la lista, no una direccion que se comparta.
  // Se reinicia al cambiar de ambito ajustando el estado durante el render,
  // que es mas barato que un efecto (no hay un cuadro con el rubro viejo
  // sobre la lista nueva); la misma figura que grupo-zona.tsx.
  const [rubro, setRubro] = useState<Rubro | null>(null);
  const [ambitoDelRubro, setAmbitoDelRubro] = useState(ambito);
  if (ambitoDelRubro !== ambito) {
    setAmbitoDelRubro(ambito);
    setRubro(null);
  }

  // La tienda de temas es de MODULO y sobrevive a la navegacion entre zonas.
  // Sin esto, un tema tocado en Tijuana (ids de notas de Tijuana) filtraria
  // el muro de Mexicali hasta dejarlo vacio. Al desmontar, se limpia.
  useEffect(() => () => limpiarTema(), []);

  // Escribir se mantiene instantaneo; el trabajo de las ~1,500 filas corre
  // contra el valor diferido.
  const consultaDiferida = useDeferredValue(consulta);

  // Tres relojes distintos y ninguno se confunde con otro: el input va por
  // tecla, el filtro del corpus por render diferido, y la URL y la red por
  // retardo. Estas dos ultimas leen el MISMO valor a proposito: si la barra
  // de direcciones dice ?q=garita, el bloque de abajo tiene que estar
  // enseñando garita.
  const consultaTardia = useRetardo(consulta, RETARDO_BUSQUEDA);

  useEffect(() => {
    if (consultaTardia === consultaUrl) return;   // incluye la carga inicial
    escribirConsulta(consultaTardia);
  }, [consultaTardia, consultaUrl]);

  // (1) BASE. toSorted() y no sort(): SWR entrega el MISMO objeto de arreglo a
  //     todos los consumidores, y ordenarlo en sitio corromperia el cache
  //     para todos, incluidos los paneles de graficas.
  const base = useMemo(
    () => (doc !== undefined ? doc.notas.toSorted(POR_RECIENTE) : SIN_NOTAS),
    [doc],
  );

  // (2) El pajar de busqueda, construido una vez por base y con los acentos
  //     plegados igual que en Python.
  //
  //     `t` es el titular plegado a solas, y no cuesta un plegar() de mas:
  //     hoy ese valor ya se calcula y se tira dentro de `h`. Lo usa el bloque
  //     de resultados en vivo para no repetir una nota que ya esta arriba.
  const corpus = useMemo(
    () =>
      base.map((n) => {
        const t = plegar(n.titulo);
        return { n, t, h: `${t} ${n.dominio}` };
      }),
    [base],
  );

  //     Contra TODA la base y no contra lo visible: si se cruzara contra lo
  //     visible, una nota escondida por el filtro de zona o de delegacion
  //     reaparaceria en el bloque de abajo con otro sombrero.
  const titulosCorpus = useMemo(() => new Set(corpus.map((p) => p.t)), [corpus]);

  // (3) FILTRO de texto y de tema. No depende de `zona`, asi que cambiar de
  //     pagina no vuelve a filtrar. Conserva el orden de la base: la lista
  //     filtrada sigue siendo del mas reciente al mas antiguo.
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

  // (4) LA PASADA UNICA. Llaveada solo por la lista, no por `zona`.
  const indice = useMemo(
    () => (filtradas.length > 0 ? indexar(filtradas) : INDICE_VACIO),
    [filtradas],
  );

  // (5) La zona es una BUSQUEDA en el indice, no un recalculo.
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

  //      El corpus participa mientras la busqueda siga siendo regional. En
  //      'mexico' e 'internacional' no: es regional por construccion y
  //      mezclarlo volveria la cifra imposible de leer.
  const conCorpus = usaCorpus(ambito);

  // (6d) LOS TRES MODOS. Con consulta, el muro deja de agrupar por zona: la
  //      zona ya es el ambito de la busqueda, asi que agrupar por ella daria
  //      un solo grupo con el titulo repetido. Pasa a ser una lista plana por
  //      fecha donde el corpus y lo que llega en vivo son el mismo resultado.
  //
  //      Dos relojes segun el ambito, y no es descuido. Con corpus, una letra
  //      ya filtra en memoria (paso 3) y el muro cambia de forma en el render
  //      diferido. Sin corpus no hay nada que filtrar hasta que la red pueda
  //      preguntar (MINIMO_CONSULTA), y se mide con el MISMO reloj que dispara
  //      la peticion: medido con el diferido habria 400 ms de "Sin resultados"
  //      antes de "Buscando…".
  const buscando = conCorpus
    ? consultaDiferida.trim() !== ""
    : consultaTardia.trim().length >= MINIMO_CONSULTA;

  //      Sin corpus y sin consulta el muro no se queda vacio: muestra la
  //      seccion de Google Noticias de ese momento (lib/busqueda/actualidad.ts).
  const enActualidad = !conCorpus && !buscando;
  const modo: ModoMuro = buscando ? "busqueda" : enActualidad ? "actualidad" : "corpus";

  const notasBuscadas = useMemo(() => {
    if (!buscando || !conCorpus) return SIN_NOTAS;
    const soloZona: ZonaRuta | null = ambito === "zona" ? zona : null;
    const salida: Nota[] = [];
    for (const n of filtradas) {
      // Las mismas exclusiones del muro agrupado, en una pasada y sin pasar
      // por el indice: aqui una nota de dos zonas tiene que salir UNA vez.
      if (n.alcance === "fuera" || n.zonas.length === 0) continue;
      if (soloZona !== null && !n.zonas.includes(soloZona)) continue;
      if (delegacion !== null && !tieneDelegacion(n, delegacion)) continue;
      salida.push(n);
    }
    return salida;
  }, [buscando, conCorpus, ambito, zona, filtradas, delegacion]);

  //      Suprimir contra el corpus solo cuando el corpus se esta mostrando: si
  //      no, una nota en vivo desapareceria por empatar con algo que en este
  //      ambito no esta a la vista.
  const titulosParaVivo = conCorpus ? titulosCorpus : SIN_TITULOS;

  // (7) Lo que llega en vivo. Mismo ambito y misma zona que el corpus, asi que
  //     las dos mitades contestan la misma pregunta.
  const vivo = useBusquedaViva(consultaTardia, titulosParaVivo, ambito, zona);

  // (7b) La seccion en vivo. Se llama siempre porque es un hook; la llave es
  //      null cuando no toca, asi que no pide nada. `esAmbitoActualidad` es
  //      el complemento de `usaCorpus` y solo estrecha el tipo.
  const actualidad = useActualidad(
    enActualidad && esAmbitoActualidad(ambito) ? { ambito, rubro } : null,
  );

  const filas = useMemo(() => {
    if (!buscando) return SIN_FILAS;
    const salida: FilaMuro[] = [];
    for (const n of notasBuscadas) {
      salida.push({ clave: n.id, fecha: n.publicado ?? n.fecha ?? "", nota: n });
    }
    for (const r of vivo.resultados) {
      salida.push({ clave: r.url, fecha: r.publicado ?? "", externo: r });
    }
    return salida.toSorted((a, b) => b.fecha.localeCompare(a.fecha));
  }, [buscando, notasBuscadas, vivo.resultados]);

  // La escritura va en la transicion para que la lista se atenue en vez de
  // bloquear la pastilla.
  const elegirAmbito = (a: Ambito) => iniciar(() => escribirAmbito(a, zona));
  const elegirRubro = (r: Rubro | null) => iniciar(() => setRubro(r));
  // Volver a tocar la delegacion activa la limpia. La escritura va en la
  // transicion para que la lista se atenue en vez de bloquear el chip.
  const elegirDelegacion = (f: FiltroDelegacion | null) =>
    iniciar(() => escribirDelegacion(f === delegacion ? null : f));

  const visiblesZona = zona === null ? indice.visibles : (indice.conteo.get(zona) ?? 0);
  const visiblesAgrupado =
    delegacion === null ? visiblesZona : (conteoDelegaciones?.get(delegacion) ?? 0);

  return {
    modo,
    vivo,
    buscando,
    enActualidad,
    actualidad,
    rubro,
    elegirRubro,
    filas,
    /** Cuantas de las filas vienen del corpus. Se dice aparte: no es lo mismo
     *  una nota cosechada y clasificada que un enlace de hace un segundo. */
    delCorpus: notasBuscadas.length,
    ambito,
    ambitos: ambitosDe(zona),
    elegirAmbito,
    usaCorpus: conCorpus,
    zona,
    grupos: gruposFinales,
    conteo: indice.conteo,
    visibles: buscando
      ? filas.length
      : enActualidad
        ? actualidad.resultados.length
        : visiblesAgrupado,
    delegacion,
    conteoDelegaciones,
    elegirDelegacion,
    fuera: indice.fuera,
    nacionales: indice.nacionales,
    totalVentana: doc?.total ?? 0,
    ventanaDias: doc?.ventana_dias ?? null,
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
