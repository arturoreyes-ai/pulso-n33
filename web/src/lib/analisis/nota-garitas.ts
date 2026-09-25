import { SUELTAS } from "@/lib/dominio/secciones";
import { notaGaritas } from "@/lib/garitas/formato";
import type { Cruce } from "@/lib/garitas/tipos";
import { NOMBRE_EJE, type ClipGuion } from "./contrato-guion";

/**
 * La nota de garitas de Noticias 33, escrita por el codigo con los tiempos de
 * CBP y no por el modelo con un titular. El caso, 25 de septiembre de 2026: el
 * eje de prensa leia la busqueda de Google y el guion decia «San Ysidro
 * registra demoras de hasta 90 minutos... segun datos actualizados a la 1:00
 * de la tarde publicados por tijuanaenlinea.com», con CBP en /api/garitas. El
 * cliente lo pidio desde aqui, y el mismo dia tambien en TikTok, donde el eje
 * era un clip: acepto un clip menos.
 *
 * LA ARMA LA TARJETA, NO LA RUTA (paneles/guion-locucion.tsx). El guion pagado
 * se cachea una hora en prensa y seis en TikTok; una espera metida ahi se diria
 * al aire con horas de atraso. /api/garitas es gratis y cachea cinco minutos,
 * asi que la nota se arma al mostrarse el guion, y al copiarlo o descargarlo
 * sale con lo que se ve.
 *
 * Las lineas son las de la ficha de /garitas (lib/garitas/formato.ts::
 * notaGaritas), solo con cifras al dia respecto de cuando se leyo CBP
 * (`consultado`), y la hora se dice porque la espera caduca. La salida es fija
 * y es un paso, como las del modelo en prensa. El enlace es /garitas, para el
 * equipo; al aire no se cita. Null si no hay una cifra al dia.
 */
const GARITAS: Extract<(typeof SUELTAS)[number], { id: "garitas" }> = SUELTAS[0];

export function piezaDeGaritas(cruces: readonly Cruce[], ahora: number): ClipGuion | null {
  const nota = notaGaritas(cruces, ahora);
  if (nota === null) return null;
  const articulo = nota.hora.startsWith("1:") ? "la" : "las";
  return {
    eje: NOMBRE_EJE.garitas,
    libre: false,
    titular: "Tiempos de espera en las garitas",
    entrada: [`Así están los cruces hacia Estados Unidos, con el reporte de ${articulo} ${nota.hora}.`, ...nota.lineas].join(" "),
    pase: null,
    salida: "Pasamos a otras noticias.",
    pregunta: null,
    fuente: { url: GARITAS.ruta, fuente: GARITAS.nombre },
    ampliable: null,
  };
}
