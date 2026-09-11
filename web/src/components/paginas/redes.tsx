import type { ReactNode } from "react";

import { EncabezadoSeccion } from "@/components/cabecera/encabezado";
import { Seccion } from "@/components/chrome/seccion";
import { PanelConversacion } from "@/components/paneles/conversacion";
import { PanelRedes, PanelTikTok } from "@/components/paneles/redes";
import { SelectorRed } from "@/components/paneles/selector-red";
import { tituloSeccion } from "@/lib/dominio/secciones";
import { NOMBRE_CORTO, type ZonaRuta } from "@/lib/dominio/zonas";

/**
 * REDES: las tres plataformas en un solo lugar.
 *
 * Eran tres secciones seguidas de la pagina unica —Instagram, TikTok y
 * YouTube—, y TikTok ademas tenia pastilla propia en la nav. Se leen como una
 * sola pregunta hecha en tres lugares, asi que se eligen con una faceta y no
 * scrolleando. El detalle de por que estan tan separadas por dentro esta en
 * `components/paneles/selector-red.tsx`.
 *
 * Las tres NO son la misma fuente y la pagina no finge que lo sean:
 *
 *   Instagram — cuentas de medios verificadas una por una. La zona es la SEDE
 *               de la cuenta. Publica el texto de los comentarios. Ventana de
 *               24 horas desde el 10 de septiembre de 2026 (antes, la semana).
 *   TikTok    — una busqueda, «tijuana noticias». La zona sale del PIE del
 *               video, porque una consulta no tiene lugar. Publica el @ del
 *               creador; es la unica que trae compartidos y guardados.
 *   YouTube   — solo conteos y sentimiento agregado. Nunca el texto de un
 *               comentario: las Politicas para Desarrolladores limitan el
 *               almacenamiento a 30 dias y un repositorio de git no borra.
 *
 * Por eso cada plataforma trae su propio parrafo de encabezado y su propio
 * "cómo leer este dato". Un solo texto para las tres tendria que mentir en
 * dos de ellas.
 */
export function PaginaRedes({ zona }: { zona: ZonaRuta | null }) {
  const nombre = zona === null ? null : NOMBRE_CORTO[zona];

  return (
    <>
      <EncabezadoSeccion
        zona={zona}
        vista="redes"
        titulo={tituloSeccion("redes", nombre)}
        entrada={
          nombre === null
            ? "Lo que publican las cuentas de noticias de la región y lo que la gente comenta debajo, en Instagram, TikTok y YouTube. Se publica lo que se dijo; nunca quién lo dijo."
            : `Lo que se publica desde ${nombre} o nombra a ${nombre}, y lo que la gente comenta debajo. Se publica lo que se dijo; nunca quién lo dijo.`
        }
      />

      <Seccion id="redes">
        <SelectorRed
          paneles={{
            instagram: (
              <>
                <Intro>
                  {nombre === null
                    ? "Los posts con más likes de las últimas 24 horas en las cuentas de noticias de la región, y los comentarios más votados en cada uno. La zona de un post es la sede de la cuenta que lo publicó, no el lugar del que habla."
                    : `Los posts con más likes de las últimas 24 horas en cuentas de noticias con sede en ${nombre}, y los comentarios más votados en cada uno.`}
                </Intro>
                <PanelRedes zona={zona} lectura={<LecturaInstagram />} />
              </>
            ),
            tiktok: (
              <>
                <Intro>
                  {nombre === null
                    ? "Los videos con más likes de las últimas 24 horas que TikTok devuelve para «tijuana noticias», de cualquier creador. Aquí la zona no la da la cuenta: la da el lugar que nombra la descripción."
                    : `De los videos de las últimas 24 horas para «tijuana noticias», los que nombran ${nombre} en su descripción. La zona la da el pie del video, no el creador.`}
                </Intro>
                <PanelTikTok zona={zona} lectura={<LecturaTikTok />} />
              </>
            ),
            youtube: (
              <>
                <Intro>
                  {nombre === null
                    ? "Comentarios en canales de noticias de YouTube, con su sentimiento. Aquí solo hay conteos: el texto de un comentario de YouTube no se publica ni se guarda."
                    : `Comentarios en canales de noticias de YouTube atribuidos a ${nombre}, con su sentimiento. Aquí solo hay conteos, nunca el texto.`}
                </Intro>
                <PanelConversacion zona={zona} lectura={<LecturaYouTube />} />
              </>
            ),
          }}
        />
      </Seccion>
    </>
  );
}

/** El parrafo que enmarca una plataforma. Va entre la faceta y el panel, en
 *  el sitio donde estaba la entrada de la seccion que cada una tenia. */
function Intro({ children }: { children: ReactNode }) {
  return <p className="mb-6 max-w-[65ch] text-lectura text-tinta-prosa">{children}</p>;
}

/* ----------------------------------------------------------------- lecturas */

function LecturaInstagram() {
  return (
    <>
      <p>
        Cuentas públicas de Instagram de medios verificados uno por uno, leídas
        sin iniciar sesión. La zona de un post es la sede de la cuenta que lo
        publicó, no el lugar del que habla. El título es la primera línea del
        pie que escribió el medio; el resto del pie no se publica. La ventana
        es de 24 horas sobre la hora exacta de publicación, que se muestra en
        cada fila. Las cifras de un post se refrescan en cada corrida; sus
        comentarios se leen una sola vez, así que son la foto de la primera
        lectura.
      </p>
      <p>
        Los comentarios se muestran tal cual, sin usuario ni foto: la identidad
        de quien comenta se descarta al leer y no existe en ningún archivo. Se
        ordenan por likes; los que aparecen al desplegar «ver más» siempre
        tienen al menos un like. El texto se renueva en cada corrida y nunca
        se conserva más de 30 días. Los comentarios repetidos en varios posts
        de la misma cuenta y los de puro emoji se cuentan pero no se muestran.
      </p>
      <p>
        Instagram no publica cuántas veces se compartió o guardó un post de
        otra cuenta, así que esa cifra no está: es «sin dato», no cero. El
        sentimiento lo asigna un modelo local y mide el tono de la frase, no la
        postura hacia una persona. Y todo esto es volumen de conversación en
        cuentas de noticias, no opinión de la población.
      </p>
    </>
  );
}

function LecturaTikTok() {
  return (
    <>
      <p>
        Aquí la fuente no es una lista de cuentas verificadas sino una búsqueda:
        «tijuana noticias», ordenada por relevancia, sobre las últimas 24 horas,
        leída sin iniciar sesión. Los videos vienen de cualquier creador que
        TikTok considere relevante, así que la zona no la da la búsqueda: la da lo
        que nombra la descripción del video. Uno que nombra Tijuana va a Tijuana;
        uno que nombra otra ciudad de la región va a esa; uno que no nombra lugar
        alguno se rotula «sin lugar en la descripción» y solo aparece en la vista
        de región. Los que hablan de fuera de Baja California se descartan.
      </p>
      <p>
        Se muestra el @ del creador porque es quien decidió publicar y la liga ya lo
        trae. Los comentarios se muestran tal cual, sin usuario ni foto: esa
        identidad se descarta al leer y no existe en ningún archivo. Se ordenan por
        likes; los que aparecen al desplegar «ver más» siempre tienen al menos un
        like. El texto se renueva en cada corrida y nunca se conserva más de 30
        días. Los repetidos en varios videos y los de puro emoji se cuentan pero no
        se muestran.
      </p>
      <p>
        TikTok sí publica compartidos y guardados, así que aquí aparecen; un cero es
        un cero medido. El título es la descripción del video sin la cola de
        hashtags. El sentimiento lo asigna un modelo local y mide el tono de la
        frase, no la postura hacia una persona. Y todo esto es volumen de
        conversación alrededor de una búsqueda, no opinión de la población.
      </p>
    </>
  );
}

function LecturaYouTube() {
  return (
    <>
      <p>
        Comentarios leídos con la API oficial de YouTube en canales de noticias
        verificados y en búsquedas acotadas por los temas de prensa. Las
        Políticas para Desarrolladores de YouTube limitan el almacenamiento a 30
        días y un repositorio de git no puede borrar, así que aquí solo llegan
        conteos y sentimiento agregado: nunca el texto de un comentario, su
        identificador ni quién lo escribió. Es la diferencia con las otras dos
        plataformas de esta página, y es una obligación, no una preferencia.
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
