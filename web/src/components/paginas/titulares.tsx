import { Suspense } from "react";

import { Encabezado } from "@/components/cabecera/encabezado";
import { ResumenZona } from "@/components/cabecera/resumen-zona";
import { Seccion } from "@/components/chrome/seccion";
import { Muro } from "@/components/muro/muro";
import { MuroEsqueleto } from "@/components/muro/muro-esqueleto";
import { PanelComunicados } from "@/components/paneles/comunicados";
import { PanelTemas } from "@/components/paneles/temas";
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
  "Con México o Internacional y sin consulta, muestra la actualidad de Google Noticias en ese momento.";

export function PaginaTitulares({ zona }: { zona: ZonaRuta | null }) {
  const nombre = zona === null ? null : NOMBRE_CORTO[zona];

  return (
    <>
      <Encabezado zona={zona} />

      <Seccion
        id="muro"
        titulo={nombre === null ? "Titulares" : `Titulares sobre ${nombre}`}
        entrada={
          nombre === null
            ? `La zona sale del lugar que nombra el titular, no del medio. Al buscar, la lista se aplana y suma resultados en vivo. ${EN_VIVO}`
            : zona === "Tijuana"
              ? `Titulares que mencionan Tijuana. La delegación sale del propio titular, y la mayoría no nombra ninguna. ${EN_VIVO}`
              : `Titulares que mencionan ${nombre}. Al buscar, la lista se aplana y suma resultados en vivo. ${EN_VIVO}`
        }
      >
        {/* El muro lee ?d=, ?q= y ?a= con useSearchParams; en una ruta
            prerenderizada eso exige un limite de Suspense o `next build`
            falla. El fallback es el mismo esqueleto que el muro muestra
            mientras carga, y eso importa mas ahora que el muro es lo primero
            de la pagina: la cascara no se mueve, solo se llenan las filas.
            Los tres parametros cuelgan de este limite. */}
        <Suspense fallback={<MuroEsqueleto conZona={zona !== null} />}>
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
            ? "Frases que se repiten en los titulares del periodo, con notas de ejemplo. Sin modelo: es conteo por documento, con el lugar tratado como faceta y no como tema."
            : `Frases que se repiten en los titulares que mencionan ${nombre}, con las notas de ejemplo. Sin modelo: es conteo por documento.`
        }
      >
        <PanelTemas zona={zona} lectura={<LecturaTemas />} />
      </Seccion>

      <Seccion
        id="panorama"
        titulo={nombre === null ? "El corte de hoy" : `${nombre} en cifras`}
        entrada={
          nombre === null
            ? "Las cifras de la última corrida, y a qué distancia están unas de otras. Cada tarjeta dice de dónde sale su número."
            : `Lo que se puede decir de ${nombre} con las fuentes que sí lo cubren.`
        }
      >
        <ResumenZona zona={zona} />
      </Seccion>
    </>
  );
}

function LecturaTemas() {
  return (
    <>
      <p>
        Agrupamiento por repetición de frases en los titulares, sin modelo. Se
        cuentan notas, no porcentajes. Un tema sostenido por un solo medio se
        rotula como tal, porque es la agenda de ese medio y no de la región.
      </p>
      <p>
        La tendencia contra la semana anterior aparece solo cuando hay dos
        ventanas comparables. Tocar un tema filtra el muro de arriba.
      </p>
    </>
  );
}
