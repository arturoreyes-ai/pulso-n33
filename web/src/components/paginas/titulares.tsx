import { Suspense, type ReactNode } from "react";

import { Encabezado } from "@/components/cabecera/encabezado";
import { ResumenZona } from "@/components/cabecera/resumen-zona";
import { Seccion } from "@/components/chrome/seccion";
import { SeccionMuro } from "@/components/muro/seccion-muro";
import { Muro } from "@/components/muro/muro";
import { MuroEsqueleto } from "@/components/muro/muro-esqueleto";
import { SoloConCorpus } from "@/components/muro/solo-con-corpus";
import { PanelActualidad } from "@/components/paneles/actualidad";
import { PanelComunicados } from "@/components/paneles/comunicados";
import { PanelTemas } from "@/components/paneles/temas";
import { Esqueleto } from "@/components/ui/primitivas";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";

/**
 * La PORTADA: los titulares, lo que se repite en ellos y el corte del dia.
 *
 * Componente de SERVIDOR, como las otras tres paginas. Compone las secciones
 * y es dueno de toda la prosa estatica: titulos, entradas y los parrafos de
 * "cómo leer este dato" que cada panel recibe como `lectura`. Las islas de
 * cliente son chicas y reciben la zona como prop; nada de este texto viaja
 * dentro de un bundle.
 *
 * En Tendencia abre antes de Titulares por peticion del 14 de septiembre.
 * El orden no es el que tenia la pagina unica. Temas sube a pegarse al muro
 * PORQUE LO FILTRA: tocar un tema cambia las filas de arriba (ver
 * lib/muro/filtro-tema.ts), y entre los dos habia cuatro secciones. Panorama
 * cierra, porque es el resumen en numeros de lo que se acaba de leer y desde
 * ahi se sale hacia las otras tres paginas.
 */
export function PaginaTitulares({ zona }: { zona: ZonaRuta | null }) {
  const nombre = zona === null ? null : NOMBRE_CORTO[zona];

  return (
    <>
      <Encabezado zona={zona} />

      {/* En Tendencia abre la portada: es la prioridad del lector. */}
      <Suspense fallback={seccionActualidad(nombre, <Esqueleto className="h-[420px]" />)}>
        <SoloConCorpus zona={zona}>
          {seccionActualidad(
            nombre,
            <PanelActualidad zona={zona} />,
          )}
        </SoloConCorpus>
      </Suspense>

      {/* El alcance cambia tambien el encabezado; ambos comparten Suspense. */}
      <Suspense fallback={<Seccion id="muro"><MuroEsqueleto /></Seccion>}>
        <SeccionMuro zona={zona}>
          <Muro zona={zona} />
        </SeccionMuro>
      </Suspense>

      {zona === "Tecate" ? (
        <Seccion
          id="comunicados"
          titulo="Comunicados del Ayuntamiento"
          entrada="Información publicada por el Ayuntamiento. Estos comunicados no forman parte de las métricas de prensa."
        >
          <PanelComunicados />
        </Seccion>
      ) : null}

      <Seccion
        id="temas"
        titulo={nombre === null ? "De qué se habla esta semana" : `De qué se habla en ${nombre} esta semana`}
        entrada={
          nombre === null
            ? "Frases que se repiten en los titulares del periodo, con notas de ejemplo. El lugar es una faceta, no un tema."
            : `Frases que se repiten en los titulares que mencionan ${nombre}, con las notas de ejemplo.`
        }
      >
        <PanelTemas zona={zona} />
      </Seccion>

      <Seccion
        id="panorama"
        titulo={nombre === null ? "Hoy en cifras" : `${nombre} en cifras`}
        entrada={
          nombre === null
            ? "Las cifras más recientes, y a qué distancia están unas de otras. Cada tarjeta dice de dónde sale su número."
            : `Lo que se puede decir de ${nombre} con las fuentes que sí lo cubren.`
        }
      >
        <ResumenZona zona={zona} />
      </Seccion>
    </>
  );
}

/**
 * La seccion de actualidad con el cuerpo que toque: el panel de verdad, o su
 * esqueleto mientras Suspense resuelve. Una sola funcion para que el titulo y
 * la entrada no se escriban dos veces y diverjan.
 */
function seccionActualidad(nombre: string | null, cuerpo: ReactNode) {
  return (
    <Seccion
      id="actualidad"
      pegada
      titulo="En Tendencia"
      entrada={
        nombre === null
          ? "Los titulares que destacan en este momento para Tijuana y San Diego, los dos polos del corredor; cada zona tiene los suyos en su página. Es una lectura en vivo y no cuenta en las cifras de prensa."
          : `Los titulares que destacan en este momento para ${nombre}. Es una lectura en vivo y no cuenta en las cifras de prensa.`
      }
    >
      {cuerpo}
    </Seccion>
  );
}

