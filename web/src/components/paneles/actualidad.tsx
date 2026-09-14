"use client";

import { useState } from "react";

import { textoCaidos, textoIdiomas } from "@/lib/busqueda/avisos";
import { NOMBRE_RUBRO, type Rubro } from "@/lib/busqueda/rubros";
import { useActualidad, type ActualidadViva } from "@/lib/busqueda/use-actualidad";
import { hora, numero } from "@/lib/dominio/formato";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";
import { FilaExterna } from "@/components/muro/fila-externa";
import { SelectorRubro } from "@/components/muro/selector-rubro";
import { Bisel } from "@/components/ui/bisel";
import { Esqueleto } from "@/components/ui/primitivas";

/**
 * Lo que destaca ahora para el lugar de la pagina.
 *
 * Seccion de la portada desde el 11 de septiembre de 2026, a peticion del
 * cliente: "que esta sonando en las noticias", con el mismo lector de Google
 * Noticias que ya usan la busqueda y el muro. Con la pastilla "Todo" es la
 * seccion LOCAL que Google arma para la zona (o, en la region, las de Tijuana
 * y San Diego, intercaladas), en el orden de Google y en este momento.
 *
 * Las otras pastillas -- Clima, Seguridad, Deportes, Politica, Economia --
 * vienen de la caja "Trending topics" de la pagina local de Google Noticias,
 * que el cliente mostro. El RSS no expone esa clasificacion ni sus imagenes,
 * asi que cada rubro es una BUSQUEDA en Google Noticias (lib/busqueda/
 * rubros.ts): los terminos del rubro mas los del lugar, ultimos dos dias, en
 * el orden de Google. La primera linea del panel lo dice como busqueda.
 *
 * La INTERFAZ no nombra a Google, a peticion del cliente (12 de septiembre de
 * 2026). El codigo y los docs si: de ahi sale el dato y quien lo mantenga
 * tiene que saberlo. Cada fila si nombra al medio, que es la fuente real.
 *
 * Es OTRA cosa que "De que se habla esta semana", que esta justo arriba: eso
 * es conteo sobre lo cosechado en siete dias; esto es una lectura en vivo,
 * ahora. Y otra cosa que el muro: estas filas no pasaron por el pipeline y no
 * se suman a nada. Por eso la fila es FilaExterna, con su marca `en vivo`.
 *
 * Quince filas como mucho (TOPE_ACTUALIDAD) y sin "mostrar mas": el cliente
 * pidio acortar la cola, y una lista corta que cabe entera no necesita pie.
 */

/** La primera linea del panel: de donde sale la lista y como esta. */
function fraseFuente(zona: ZonaRuta | null, rubro: Rubro | null, a: ActualidadViva): string {
  const idiomas = textoIdiomas(a.idiomas);
  const enIdiomas = idiomas === "" ? "" : `, ${idiomas}`;
  const partes: string[] = [];

  if (rubro === null) {
    partes.push(
      zona === null
        ? "Lo que destaca en este momento sobre Tijuana y San Diego, en español e inglés."
        : `Lo que destaca en este momento sobre ${NOMBRE_CORTO[zona]}${enIdiomas}.`,
    );
  } else {
    const donde = zona === null ? "en el corredor" : `sobre ${NOMBRE_CORTO[zona]}`;
    partes.push(
      `Titulares de «${NOMBRE_RUBRO[rubro]}» ${donde}${enIdiomas}, de los últimos dos días.`,
    );
  }

  const caidos = textoCaidos(a.caidos);
  if (caidos !== null) partes.push(caidos);
  if (a.truncada) partes.push(`Se muestran los primeros ${numero(a.resultados.length)}.`);
  if (a.consultado !== null) partes.push(`Actualizado a las ${hora(a.consultado)}.`);
  return partes.join(" ");
}

function textoVacio(zona: ZonaRuta | null, rubro: Rubro | null): string {
  if (rubro === null) return "Sin titulares destacados en este momento.";
  const donde = zona === null ? "en el corredor" : `sobre ${NOMBRE_CORTO[zona]}`;
  return `Sin titulares de «${NOMBRE_RUBRO[rubro]}» ${donde} en los últimos dos días.`;
}

export function PanelActualidad({ zona }: { zona: ZonaRuta | null }) {
  const [rubro, setRubro] = useState<Rubro | null>(null);
  const a = useActualidad(
    zona === null ? { ambito: "region", rubro } : { zona, rubro },
  );

  if (!a.activa) {
    return (
      <p className="text-lectura text-tinta-prosa">
        Los titulares en vivo no están disponibles en esta vista.
      </p>
    );
  }

  const total = a.resultados.length;

  return (
    <Bisel interior="p-6 md:p-8">
      {/* Las pastillas se quedan mientras la lista carga, para que cambiar de
          rubro no mueva el panel entero. */}
      <SelectorRubro activo={rubro} onElegir={setRubro} />

      {a.cargando && total === 0 ? (
        <Esqueleto className="mt-5 h-[360px]" />
      ) : a.fallo && total === 0 ? (
        <p className="mt-5 text-lectura text-baja">
          No se pudo traer lo que destaca ahora.
        </p>
      ) : (
        <>
          <p className="mt-5 max-w-[70ch] text-meta text-tinta-prosa">
            {fraseFuente(zona, rubro, a)}
          </p>

          {total === 0 ? (
            // Un hueco se rotula, no se rellena: San Felipe traia UN titular
            // el dia del sondeo, y un rubro en una zona chica puede traer cero.
            <p className="mt-6 text-lectura text-tinta-prosa">{textoVacio(zona, rubro)}</p>
          ) : (
            <div className="mt-4">
              {a.resultados.map((r) => (
                <FilaExterna key={r.url} r={r} />
              ))}
            </div>
          )}
        </>
      )}

    </Bisel>
  );
}
