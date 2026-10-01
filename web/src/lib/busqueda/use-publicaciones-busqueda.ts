"use client";

import { useMemo } from "react";

import { useFacebook, useRedes, useTikTok, useYouTube } from "@/lib/datos/hooks";
import { filtrarPorTexto } from "@/lib/dominio/consultas";
import { canonizarPublicacion, compararPublicaciones, fuenteDePublicacion, nombresDeCuentas, type PublicacionVisual, type RedVisual } from "@/lib/dominio/publicaciones";

/**
 * Las publicaciones cosechadas cuyo titulo nombra lo buscado, de las cuatro
 * redes que traen publicaciones.
 *
 * Sale de components/reportes/resultados-reportes.tsx (29 de septiembre de
 * 2026), donde nacio, para que la portada y Redes busquen lo mismo: TODAS las
 * publicaciones disponibles, antes del recorte del lector por lugar o
 * popularidad, sin descargar comentarios ni pedir nada a ninguna red. Una
 * misma publicacion en dos archivos (misma red y URL canonica) cuenta una vez.
 */
export function usePublicacionesBusqueda(consulta: string) {
  const instagram = useRedes();
  const tiktok = useTikTok();
  const facebook = useFacebook();
  const youtube = useYouTube();
  const filas = useMemo(() => {
    const docs = { instagram: instagram.data, tiktok: tiktok.data, facebook: facebook.data, youtube: youtube.data };
    const todas: PublicacionVisual[] = [];
    const vistas = new Set<string>();
    for (const red of Object.keys(docs) as RedVisual[]) {
      const doc = docs[red];
      if (doc === undefined) continue;
      const nombres = nombresDeCuentas(doc);
      for (const post of doc.destacados ?? []) {
        const url = canonizarPublicacion(post.url, red);
        const clave = `${red}:${url ?? post.url}`;
        if (vistas.has(clave)) continue;
        vistas.add(clave);
        todas.push({ post, red, clave, url, fuente: fuenteDePublicacion(post, red, nombres) });
      }
    }
    return filtrarPorTexto(todas, {}, consulta).sort((a, b) => compararPublicaciones(a.post, b.post));
  }, [instagram.data, tiktok.data, facebook.data, youtube.data, consulta]);
  const redes = [
    { nombre: "Instagram", ...instagram }, { nombre: "TikTok", ...tiktok },
    { nombre: "Facebook", ...facebook }, { nombre: "YouTube", ...youtube },
  ];
  return {
    filas,
    cargando: redes.some((r) => r.data === undefined && r.error === undefined),
    fallidas: redes.filter((r) => r.error !== undefined && r.data === undefined),
    disponibles: redes.filter((r) => r.data !== undefined),
  };
}
