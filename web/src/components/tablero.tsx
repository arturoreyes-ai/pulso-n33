import { Suspense } from "react";

import { Encabezado } from "@/components/cabecera/encabezado";
import { NavPildora } from "@/components/chrome/nav-pildora";
import { Pie } from "@/components/chrome/pie";
import { Seccion } from "@/components/chrome/seccion";
import { Muro } from "@/components/muro/muro";
import { PanelCobertura } from "@/components/paneles/cobertura";
import { PanelConversacion } from "@/components/paneles/conversacion";
import { PanelIndicadores } from "@/components/paneles/indicadores";
import { PanelTemas } from "@/components/paneles/temas";
import { Esqueleto } from "@/components/ui/primitivas";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";

/**
 * El tablero completo, para la region (zona null) o para una zona.
 *
 * Componente de SERVIDOR. Compone las secciones y es dueno de toda la prosa
 * estatica: titulos, entradas y los parrafos de "como leer este dato" que
 * cada panel recibe como `lectura`. Las islas de cliente son chicas y reciben
 * la zona como prop; nada de este texto viaja dentro de un bundle.
 */
export function Tablero({ zona }: { zona: ZonaRuta | null }) {
  const nombre = zona === null ? null : NOMBRE_CORTO[zona];
  const sd = zona === "San Diego";

  return (
    <>
      <NavPildora zona={zona} />
      <Encabezado zona={zona} />

      <Seccion
        id="indicadores"
        titulo={nombre === null ? "Precios, crimen y percepción" : `Precios, crimen y percepción en ${nombre}`}
        entrada={
          nombre === null
            ? "Cinco fuentes oficiales con cadencias distintas. Cada panel dice de dónde viene su cifra y qué no se puede concluir de ella."
            : sd
              ? "Para San Diego la fuente es el padrón catastral del condado. Los indicadores mexicanos (SHF, predial, SESNSP y ENSU) no aplican de este lado."
              : `Las cifras oficiales que existen para ${nombre}, y las que no. Cada panel dice de dónde viene su dato y qué no se puede concluir de él.`
        }
      >
        <PanelIndicadores zona={zona} lectura={<LecturaIndicadores />} />
      </Seccion>

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
        id="conversacion"
        titulo={nombre === null ? "Qué se comenta sobre las noticias" : `Qué se comenta sobre ${nombre}`}
        entrada={
          nombre === null
            ? "Comentarios en canales de noticias de YouTube, con su sentimiento. Se publican conteos, nunca el texto de un comentario ni quién lo escribió."
            : `Comentarios en canales de noticias de YouTube atribuidos a ${nombre}, con su sentimiento. Se publican conteos, nunca el texto de un comentario.`
        }
      >
        <PanelConversacion zona={zona} lectura={<LecturaConversacion />} />
      </Seccion>

      <Seccion
        id="cobertura"
        titulo={nombre === null ? "Qué se cubre y qué no" : `Qué se cubre de ${nombre} y qué no`}
        entrada="La cobertura es desigual por zona y eso es estructural. Los huecos se rotulan en vez de rellenarse con ceros."
      >
        <PanelCobertura zona={zona} />
      </Seccion>

      <Seccion
        id="muro"
        titulo={nombre === null ? "Titulares por zona" : `Titulares sobre ${nombre}`}
        entrada={
          nombre === null
            ? "La zona de cada nota sale de los lugares que nombra el titular, no del medio que la publicó. Una nota de la garita cuenta en Tijuana y en San Diego. Cada zona abre con sus seis titulares más recientes; el pie de cada una muestra las demás."
            : zona === "Tijuana"
              ? "Notas cuyo titular menciona Tijuana, o publicadas por un medio de Tijuana sin nombrar otro lugar. La delegación sale de los lugares que nombra el titular: la mayoría no nombra ninguno y queda como «sin delegación identificada». Los indicadores oficiales no bajan de municipio."
              : `Notas cuyo titular menciona ${nombre}, o publicadas por un medio de ${nombre} sin nombrar otro lugar. Toca un tema arriba para filtrarlas.`
        }
      >
        {/* El muro lee ?d= con useSearchParams; en una ruta prerenderizada
            eso exige un limite de Suspense o `next build` falla. El fallback
            es el mismo esqueleto que el muro muestra mientras carga. */}
        <Suspense fallback={<Esqueleto className="h-[600px]" />}>
          <Muro zona={zona} />
        </Suspense>
      </Seccion>

      <Pie />
    </>
  );
}

/* ----------------------------------------------------------------- lecturas */

function LecturaIndicadores() {
  return (
    <>
      <p>
        Cada fuente tiene su propia cadencia: SHF y ENSU trimestrales, SESNSP
        mensual con unas tres semanas de rezago, predial anual, SANDAG mensual.
        Ninguna de estas cifras la calcula este tablero: se leen y se etiquetan.
      </p>
      <p>
        El índice SHF mide vivienda comprada con crédito hipotecario, no terrenos
        ni operaciones al contado, y solo existe para Tijuana y Mexicali. El
        predial mide recaudación, no valor: sirve para comparar un municipio
        consigo mismo, no para rankear. El SESNSP cuenta delitos reportados, no
        ocurridos, y no es per cápita. La ENSU es la única medición de percepción
        con muestra probabilística y solo cubre dos ciudades.
      </p>
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
        ventanas comparables. Tocar un tema filtra el muro de abajo.
      </p>
    </>
  );
}

function LecturaConversacion() {
  return (
    <>
      <p>
        Comentarios leídos con la API oficial de YouTube en canales de noticias
        verificados y en búsquedas acotadas por los temas de prensa. Las
        Políticas para Desarrolladores de YouTube limitan el almacenamiento a 30
        días y un repositorio de git no puede borrar, así que aquí solo llegan
        conteos y sentimiento agregado: nunca el texto de un comentario, su
        identificador ni quién lo escribió.
      </p>
      <p>
        El sentimiento lo asigna un modelo local entrenado en texto de redes.
        Mide si una frase suena a queja, a celebración o a información; no mide
        postura hacia una persona. Y esto mide volumen de conversación en canales
        de noticias, que no es lo mismo que la opinión de la población.
      </p>
    </>
  );
}
