import { Suspense, type ReactNode } from "react";

import { Encabezado } from "@/components/cabecera/encabezado";
import { ResumenZona } from "@/components/cabecera/resumen-zona";
import { Seccion } from "@/components/chrome/seccion";
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
 * El orden no es el que tenia la pagina unica. Temas sube a pegarse al muro
 * PORQUE LO FILTRA: tocar un tema cambia las filas de arriba (ver
 * lib/muro/filtro-tema.ts), y entre los dos habia cuatro secciones. Panorama
 * cierra, porque es el resumen en numeros de lo que se acaba de leer y desde
 * ahi se sale hacia las otras tres paginas.
 */
/**
 * La frase que cierra la entrada del muro en las tres variantes: es la misma
 * promesa y se escribe una vez.
 */
const EN_VIVO =
  "En México e Internacional muestra lo que destaca en ese momento, por rubro.";

export function PaginaTitulares({ zona }: { zona: ZonaRuta | null }) {
  const nombre = zona === null ? null : NOMBRE_CORTO[zona];

  return (
    <>
      <Encabezado zona={zona} />

      {/* `pegada`: es la primera seccion y va junto a la navegacion de alcance
          que la acota (Region, Mexico, Internacional), no una pantalla abajo. */}
      <Seccion
        id="muro"
        pegada
        titulo={nombre === null ? "Titulares" : `Titulares sobre ${nombre}`}
        entrada={
          nombre === null
            ? `La zona sale del lugar que nombra el titular, no del medio. Al buscar se añaden resultados en vivo. ${EN_VIVO}`
            : zona === "Tijuana"
              ? `Titulares que mencionan Tijuana. La delegación sale del propio titular, y la mayoría no nombra ninguna. ${EN_VIVO}`
              : `Titulares que mencionan ${nombre}. Al buscar se añaden resultados en vivo. ${EN_VIVO}`
        }
      >
        {/* El muro lee ?d=, ?q= y ?a= con useSearchParams; en una ruta
            prerenderizada eso exige un limite de Suspense o `next build`
            falla. El fallback es el mismo esqueleto que el muro muestra
            mientras carga, y eso importa mas ahora que el muro es lo primero
            de la pagina: la cascara no se mueve, solo se llenan las filas.
            Los tres parametros cuelgan de este limite. */}
        <Suspense fallback={<MuroEsqueleto />}>
          <Muro zona={zona} />
        </Suspense>
      </Seccion>

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

      {/* Despues de temas y no antes: temas FILTRA el muro que tiene encima
          y los dos van juntos. Esto es otra pregunta —que destaca ahora— y no
          toca el muro. La interfaz no nombra al agregador (peticion del
          cliente, 12 de septiembre de 2026); el codigo si.

          Solo con corpus: en Mexico e Internacional el muro ya es esta misma
          lista, con los mismos rubros. El limite de Suspense es por
          useSearchParams en una ruta prerenderizada; su fallback es la
          seccion con la lista en esqueleto, para que el HTML del servidor
          traiga la seccion y no un hueco que aparece al hidratar. */}
      <Suspense fallback={seccionActualidad(nombre, <Esqueleto className="h-[420px]" />)}>
        <SoloConCorpus zona={zona}>
          {seccionActualidad(
            nombre,
            <PanelActualidad zona={zona} />,
          )}
        </SoloConCorpus>
      </Suspense>

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
      titulo={nombre === null ? "Lo que destaca ahora" : `Lo que destaca ahora sobre ${nombre}`}
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


