import type { ComentarioPublicado } from "@/lib/datos/tipos";
import { fechaConAnio, fechaCorta, fechaLarga } from "@/lib/dominio/formato";
import {
  cifra,
  limpiarParaFuente,
  NOTA_DECISION_REGLA_5,
  REGLAS_PRODUCTO,
  SALVEDAD_FIJA_INFORME,
  ventana,
  type DocumentoInforme,
  type FilaDestacadoInforme,
  type TitularInforme,
} from "@/lib/informe/modelo";
import { COLORES_GRAFICA } from "@/lib/informe/tema";
import { PdfAlert } from "@/pdfcn/components/pdf/alert/alert";
import { Badge } from "@/pdfcn/components/pdf/badge/badge";
import { DataTable } from "@/pdfcn/components/pdf/data-table/data-table";
import { Divider } from "@/pdfcn/components/pdf/divider/divider";
import { PdfGraph } from "@/pdfcn/components/pdf/graph/graph";
import { Heading } from "@/pdfcn/components/pdf/heading/heading";
import { KeepTogether } from "@/pdfcn/components/pdf/keep-together/keep-together";
import { KeyValue } from "@/pdfcn/components/pdf/key-value/key-value";
import { PdfList } from "@/pdfcn/components/pdf/list/list";
import { Section } from "@/pdfcn/components/pdf/section/section";
import { Stack } from "@/pdfcn/components/pdf/stack/stack";
import { Text } from "@/pdfcn/components/pdf/text/text";
import { Document, Link, Page, View } from "@/pdfcn/lib/pdf-primitives";

/**
 * El informe de un termino, como documento de pdfcn sobre Takumi.
 *
 * SOLO SERVIDOR: lo importa lib/informe/render.tsx y nadie mas. No lleva
 * "use client" y no puede llevarlo: nada de esto pinta en el navegador.
 *
 * Lo que dice cada seccion y lo que no, en el orden en que se lee. Es un
 * documento que viaja solo —la direccion del cliente lo abre sin el tablero
 * al lado—, asi que las salvedades que en la pagina viven pegadas al dato aqui
 * van pegadas al dato Y repetidas al final, en «Lo que este informe no dice».
 *
 *  - Portada: el termino, la ventana, el corte y de que fuentes sale, con
 *    «sin dato» y su razon donde no se leyo. Nunca un cero.
 *  - En cifras: publicaciones y comentarios leidos por plataforma, lado a
 *    lado, sin dividir. Dos graficas de barras —nunca de pastel: un pastel es
 *    una proporcion (regla 2)— sobre las publicaciones DESTACADAS, que son las
 *    que traen fecha; el rotulo lo dice.
 *  - Tono: cinco conteos y la salvedad que trae el dato, tal cual.
 *  - Lo que se repite: los temas contados y, si la hubo, la lectura automatica
 *    con su salvedad; debajo, la salvedad fija del documento y «Generado con
 *    IA».
 *  - Publicaciones destacadas por plataforma, con «sin dato» en la cifra que
 *    la plataforma no publica.
 *  - Comentarios mas votados de las publicaciones con mas likes, con su tono.
 *    No existe identidad que omitir: no esta en ningun archivo.
 *  - En la prensa: titulares con su enlace tal cual, y cuantos titulares del
 *    archivo propio nombran el termino, con la muestra.
 *  - Lo que este informe no dice: las cinco reglas y la decision sobre la 5.
 */

const GRIS = "#71717a";

type FilaTabla = Record<string, unknown> & FilaDestacadoInforme;

function TablaDestacados({ filas }: { filas: FilaDestacadoInforme[] }) {
  return (
    <DataTable<FilaTabla>
      size="compact"
      stripe
      columns={[
        { key: "fecha", header: "Fecha", width: "13%", render: (v) => <Text variant="xs" noMargin>{fechaCorta(String(v))}</Text> },
        { key: "fuente", header: "Cuenta", width: "17%", render: (v) => <Text variant="xs" noMargin>{limpiarParaFuente(String(v))}</Text> },
        { key: "primeraLinea", header: "Primera línea", render: (v) => <Text variant="xs" noMargin>{limpiarParaFuente(String(v)) || "(sin pie)"}</Text> },
        { key: "likes", header: "Likes", align: "right", width: "10%", render: (v) => <Text variant="xs" noMargin>{cifra(v as number | null)}</Text> },
        { key: "comentarios", header: "Coment.", align: "right", width: "10%", render: (v) => <Text variant="xs" noMargin>{cifra(v as number | null)}</Text> },
        { key: "compartidos", header: "Compart.", align: "right", width: "10%", render: (v) => <Text variant="xs" noMargin>{cifra(v as number | null)}</Text> },
        { key: "url", header: "Enlace", width: "9%", render: (v) => <Link src={String(v)} style={{ color: "#0284c7", fontSize: 9 }}>abrir</Link> },
      ]}
      data={filas.map((f) => ({ ...f }))}
    />
  );
}

type FilaTitular = Record<string, unknown> & TitularInforme;

/** Titulares con su tono de prensa (favorable | adversa | neutral) y su
 *  enlace tal cual. «sin tono» donde el modelo no corrio o no lee el idioma. */
function TablaTitulares({ filas }: { filas: TitularInforme[] }) {
  return (
    <DataTable<FilaTitular>
      size="compact"
      stripe
      columns={[
        { key: "fecha", header: "Fecha", width: "14%", render: (v) => <Text variant="xs" noMargin>{v === null ? "sin fecha" : fechaConAnio(String(v))}</Text> },
        { key: "fuente", header: "Medio", width: "19%", render: (v) => <Text variant="xs" noMargin>{limpiarParaFuente(String(v))}</Text> },
        { key: "titulo", header: "Titular", render: (v) => <Text variant="xs" noMargin>{limpiarParaFuente(String(v))}</Text> },
        {
          key: "tono", header: "Tono", width: "12%",
          render: (v) => {
            const tono = v as TitularInforme["tono"];
            const variante = tono === "adversa" ? "destructive" : tono === "favorable" ? "success" : "outline";
            return <Badge size="sm" variant={variante} label={tono ?? "sin tono"} />;
          },
        },
        { key: "url", header: "Enlace", width: "9%", render: (v) => <Link src={String(v)} style={{ color: "#0284c7", fontSize: 9 }}>abrir</Link> },
      ]}
      data={filas.map((f) => ({ ...f }))}
    />
  );
}

function Comentario({ c }: { c: ComentarioPublicado }) {
  const tono = c.sentimiento === null ? "sin tono" : c.sentimiento;
  const variante = c.sentimiento === "positivo" ? "success" : c.sentimiento === "negativo" ? "destructive" : "outline";
  return (
    <View style={{ display: "flex", flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
      <View style={{ width: 72 }}><Badge size="sm" variant={variante} label={tono} /></View>
      <View style={{ flex: 1 }}>
        <Text variant="sm" noMargin>{limpiarParaFuente(c.texto)}</Text>
        <Text variant="xs" color={GRIS} noMargin>{c.fecha ? fechaCorta(c.fecha) : ""}{c.likes > 0 ? ` · ${cifra(c.likes)} likes` : ""}</Text>
      </View>
    </View>
  );
}

export function InformeConsulta({ modelo }: { modelo: DocumentoInforme }) {
  const m = modelo;
  const t = m.tono;
  const corte = fechaLarga(m.corte);
  return (
    <Document title={`Pulso N33 · ${m.termino}`}>
      <Page size="A4">
        {/* ---------------------------------------------------------- portada */}
        <Text variant="xs" color={GRIS} transform="uppercase">Pulso N33 · Informe por término</Text>
        <Heading level={1}>{m.termino}</Heading>
        <Text variant="base" color={GRIS}>{m.tipo} · qué se dice en prensa y redes · prensa: últimos {ventana(m.ventanaPrensaDias)} · redes: últimos {ventana(m.ventanaDias)} · al {corte}</Text>

        {/* ------------------------------------------------------- en resumen */}
        <Section spacing="md">
          <Heading level={2}>En resumen</Heading>
          <PdfList variant="bullet" items={m.resumen.map((frase) => ({ text: limpiarParaFuente(frase) }))} />
          <Text variant="xs" color={GRIS}>Conteos y fechas sacados de este mismo informe. No son una medida de opinión pública ni de la reputación de nadie.</Text>
        </Section>

        <Section spacing="md">
          <Heading level={3}>Fuentes consultadas</Heading>
          <KeyValue
            divided
            items={[
              { key: "Prensa", value: m.prensa.estado === "ok" ? `leída · últimos ${ventana(m.ventanaPrensaDias)}` : "sin dato", valueColor: m.prensa.estado === "ok" ? undefined : GRIS },
              ...m.fuentes.map((f) => ({
                key: f.nombre,
                value: f.estado === "ok" ? `leída · últimos ${ventana(m.ventanaDias)}` : f.estado === "sin_dato" ? "sin dato" : "no disponible esta vez",
                valueColor: f.estado === "ok" ? undefined : GRIS,
              })),
            ]}
          />
          <Text variant="xs" color={GRIS}>
            Titulares, publicaciones y comentarios se leyeron sin iniciar sesión en ninguna red, sobre medios, cuentas, etiquetas, búsquedas y páginas públicas. La identidad de quien comenta no se guarda en ningún archivo.
          </Text>
        </Section>

        {/* -------------------------------------------------------- en cifras */}
        <Section spacing="md">
          <Heading level={2}>En cifras</Heading>
          <KeepTogether>
            <DataTable
              size="compact"
              columns={[
                { key: "nombre", header: "Plataforma" },
                { key: "publicaciones", header: "Publicaciones", align: "right", render: (v) => <Text variant="xs" noMargin>{cifra(v as number | null)}</Text> },
                { key: "comentariosLeidos", header: "Comentarios leídos", align: "right", render: (v) => <Text variant="xs" noMargin>{cifra(v as number | null)}</Text> },
              ]}
              data={m.cifras.map((c) => ({ ...c }))}
            />
            <Text variant="xs" color={GRIS}>«Comentarios leídos» son los que se leyeron de cada publicación; las plataformas reportan más. Van lado a lado y no se dividen.</Text>
          </KeepTogether>
          {m.destacadosPorRed.length === 0 ? null : (
            <KeepTogether>
              <PdfGraph variant="bar" data={m.destacadosPorRed} title="Publicaciones destacadas por plataforma" subtitle={`Las que entran en este informe · al ${corte}`} showValues legend="none" colors={COLORES_GRAFICA} height={200} />
            </KeepTogether>
          )}
          {m.destacadosPorSemana.length === 0 || (m.destacadosPorSemana[0]?.data.length ?? 0) === 0 ? null : (
            <KeepTogether>
              <PdfGraph variant="bar" data={m.destacadosPorSemana} title="Publicaciones destacadas por semana" subtitle="Cuántas de las publicaciones de este informe se publicaron cada semana" showValues legend="bottom" colors={COLORES_GRAFICA} height={220} />
            </KeepTogether>
          )}
        </Section>

        {/* ------------------------------------------------------------- tono */}
        <Section spacing="md">
          <Heading level={2}>Tono de los comentarios</Heading>
          {t.comentarios === 0 ? (
            <Text>Sin comentarios que leer en la ventana.</Text>
          ) : (
            <KeyValue
              divided
              items={[
                { key: "Positivo", value: cifra(t.positivo) },
                { key: "Negativo", value: cifra(t.negativo) },
                { key: "Neutral", value: cifra(t.neutral) },
                { key: "Sin clasificar", value: cifra(t.sin_clasificar) },
                { key: "En un idioma que el modelo no lee", value: cifra(t.sin_modelo_idioma) },
                { key: "Comentarios leídos", value: cifra(t.comentarios) },
              ]}
            />
          )}
          <PdfAlert variant="info" title="Cómo leer este conteo" showIcon={false}>
            {t.salvedad_tono}{t.metodo === "modelo" && t.modelo ? ` Modelo: ${t.modelo}.` : " Esta vez no corrió el modelo de tono."}
          </PdfAlert>
        </Section>

        {/* ------------------------------------------------------ se repite */}
        <Section spacing="md">
          <Heading level={2}>Lo que se repite en los comentarios</Heading>
          {m.temas.length === 0 ? (
            <Text>Ninguna frase se repite en al menos {m.temasMinimo} comentarios.</Text>
          ) : (
            <PdfList variant="bullet" items={m.temas.map((x) => ({ text: `${limpiarParaFuente(x.termino)} · ${cifra(x.n)} comentarios` }))} />
          )}
          {m.lectura.estado === "lista" ? (
            <Stack gap="sm">
              <Heading level={4}>Lectura automática</Heading>
              <Text>{limpiarParaFuente(m.lectura.lectura)}</Text>
              <Text variant="sm" color={GRIS}>Lo que no establece: {limpiarParaFuente(m.lectura.salvedad)}</Text>
              <Text variant="xs" color={GRIS}>{SALVEDAD_FIJA_INFORME} Generado con IA.</Text>
            </Stack>
          ) : (
            <Text variant="sm" color={GRIS}>
              {m.lectura.estado === "pocos"
                ? "Con menos de diez comentarios no hay una lectura de qué se repite: sería un comentario ascendido a patrón."
                : m.lectura.estado === "apagada"
                  ? "La lectura automática no está disponible."
                  : "La lectura automática no se pudo hacer esta vez."}
            </Text>
          )}
        </Section>

        {/* -------------------------------------------------------- destacados */}
        <View break>
          <Heading level={2}>Publicaciones destacadas</Heading>
          {m.destacados.length === 0 ? <Text>Ninguna plataforma trajo publicaciones en la ventana.</Text> : null}
          {m.destacados.map((bloque) => (
            <Section key={bloque.red} spacing="sm">
              <Heading level={3}>{bloque.nombre}</Heading>
              {bloque.filas.length === 0
                ? <Text variant="sm" color={GRIS}>Sin publicaciones que nombren el término en los últimos {m.ventanaDias} días.</Text>
                : <TablaDestacados filas={bloque.filas} />}
              <Text variant="xs" color={GRIS}>Cifras al {corte}, como las reportaba la plataforma. «Sin dato» donde la plataforma no publica esa cifra.</Text>
            </Section>
          ))}
        </View>

        {/* ------------------------------------------------------ comentarios */}
        <Section spacing="md">
          <Heading level={2}>Comentarios más votados</Heading>
          {!m.hayArchivoDeTexto ? (
            <Text variant="sm" color={GRIS}>El texto de los comentarios no está disponible en esta vista.</Text>
          ) : m.conTexto.length === 0 ? (
            <Text variant="sm" color={GRIS}>Ninguna publicación destacada trajo comentarios con texto.</Text>
          ) : (
            m.conTexto.map((p) => (
              <KeepTogether key={`${p.red}:${p.titulo}:${p.fuente}`}>
                <View style={{ marginBottom: 12 }}>
                  <Text variant="xs" color={GRIS} noMargin>{p.nombre} · {limpiarParaFuente(p.fuente)}</Text>
                  <Text variant="sm" weight="semibold">{limpiarParaFuente(p.titulo) || "(sin pie)"}</Text>
                  {p.comentarios.map((c, i) => <Comentario key={i} c={c} />)}
                </View>
              </KeepTogether>
            ))
          )}
        </Section>

        {/* ----------------------------------------------------------- prensa */}
        <Section spacing="md">
          <Heading level={2}>En la prensa · últimos {ventana(m.ventanaPrensaDias)}</Heading>
          {m.prensa.estado !== "ok" ? (
            <Text variant="sm" color={GRIS}>Sin dato.</Text>
          ) : (
            <>
              {m.prensa.tono === null || m.prensa.tono.titulares === 0 ? null : (
                <KeepTogether>
                  <KeyValue
                    divided
                    items={[
                      { key: "Adversos", value: cifra(m.prensa.tono.adversa) },
                      { key: "Favorables", value: cifra(m.prensa.tono.favorable) },
                      { key: "Neutrales", value: cifra(m.prensa.tono.neutral) },
                      { key: "Sin tono", value: cifra(m.prensa.tono.sin_clasificar + m.prensa.tono.sin_modelo_idioma) },
                      { key: "Titulares", value: cifra(m.prensa.tono.titulares) },
                    ]}
                  />
                </KeepTogether>
              )}
              {m.prensa.resultados.length === 0 ? (
                <Text>Ningún titular nombra {m.termino} en los últimos {ventana(m.ventanaPrensaDias)} en las fuentes revisadas.</Text>
              ) : (
                <TablaTitulares filas={m.prensa.resultados} />
              )}
              {m.prensa.porMedio.length < 2 ? null : (
                <KeepTogether>
                  <Heading level={4}>Por medio</Heading>
                  <DataTable
                    size="compact"
                    columns={[
                      { key: "fuente", header: "Medio" },
                      { key: "titulares", header: "Titulares", align: "right", render: (v) => <Text variant="xs" noMargin>{cifra(v as number)}</Text> },
                      { key: "adversa", header: "Adversos", align: "right", render: (v) => <Text variant="xs" noMargin>{cifra(v as number)}</Text> },
                      { key: "favorable", header: "Favorables", align: "right", render: (v) => <Text variant="xs" noMargin>{cifra(v as number)}</Text> },
                      { key: "neutral", header: "Neutrales", align: "right", render: (v) => <Text variant="xs" noMargin>{cifra(v as number)}</Text> },
                    ]}
                    data={m.prensa.porMedio.map((r) => ({ ...r }))}
                  />
                </KeepTogether>
              )}
              {m.prensa.anteriores.length === 0 ? null : (
                <Stack gap="sm">
                  <Heading level={4}>Anteriores a los últimos {ventana(m.ventanaPrensaDias)}</Heading>
                  <TablaTitulares filas={m.prensa.anteriores} />
                  <Text variant="xs" color={GRIS}>No entran en el conteo de arriba: son los titulares que el buscador de cada medio devolvió más atrás, con su fecha.</Text>
                </Stack>
              )}
              {m.prensa.muestra === null ? null : <Text variant="xs" color={GRIS}>{m.prensa.muestra}.</Text>}
            </>
          )}
          {m.prensa.archivo === null ? null : (
            <Text variant="xs" color={GRIS}>
              {cifra(m.prensa.archivo.coincidencias)} {m.prensa.archivo.coincidencias === 1 ? "titular" : "titulares"} del archivo propio {m.prensa.archivo.coincidencias === 1 ? "nombra" : "nombran"} el término · {m.prensa.archivo.muestra}.
            </Text>
          )}
          <PdfAlert variant="info" title="Cómo leer el tono de un titular" showIcon={false}>
            El mismo modelo que lee los comentarios lee cada titular y dice si suena favorable, adverso o neutral; no mide lo que el medio piensa de la persona o de la marca. Los titulares y los comentarios no se suman en una sola cifra.
          </PdfAlert>
        </Section>

        {/* ------------------------------------------------ agregados a mano */}
        {m.agregados.length === 0 ? null : (
          <Section spacing="md">
            <Heading level={2}>Agregadas a mano</Heading>
            <Text variant="sm" color={GRIS}>
              Señaladas una por una. No las devolvió ninguna búsqueda y no entran en los conteos de las secciones anteriores.
            </Text>
            <TablaTitulares filas={m.agregados} />
          </Section>
        )}

        {/* ------------------------------------------------- lo que no dice */}
        <View break>
          <Heading level={2}>Lo que este informe no dice</Heading>
          <PdfList variant="numbered" gap="md" items={REGLAS_PRODUCTO.map((r) => ({ text: r }))} />
          <Divider spacing="md" />
          <PdfAlert variant="warning" title="Sobre el tono de una persona" showIcon={false}>{NOTA_DECISION_REGLA_5}</PdfAlert>
          <Text variant="xs" color={GRIS}>
            Pulso N33 mide volumen de prensa y de conversación en el corredor Tijuana–San Diego. Este informe se armó al {corte} a partir de lo publicado en el tablero; el texto de los comentarios se conserva 30 días y la identidad de quien comenta no se guarda.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/** La banda de pie de cada pagina. Los `className` son los ganchos que el
 *  motor rellena con el numero de pagina y el total. */
export function PieInforme({ modelo }: { modelo: DocumentoInforme }) {
  return (
    <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", padding: "10px 48px 18px", fontFamily: "Geist", fontSize: 9, color: GRIS }}>
      <span>Pulso N33 · {limpiarParaFuente(modelo.termino)} · al {fechaLarga(modelo.corte)}</span>
      <span>Página <span className="pageNumber" /> de <span className="totalPages" /></span>
    </div>
  );
}
