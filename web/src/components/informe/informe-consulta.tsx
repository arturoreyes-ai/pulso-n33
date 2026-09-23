import type { ComentarioPublicado } from "@/lib/datos/tipos";
import { fechaConAnio, fechaCorta, fechaLarga } from "@/lib/dominio/formato";
import { NOMBRE_TONO_TITULAR, palabraTono, type ClaseTono, type Genero, type TonoSerie } from "@/lib/dominio/consultas";
import {
  cifra,
  limpiarParaFuente,
  type DocumentoInforme,
  type TitularInforme,
} from "@/lib/informe/modelo";
import { Badge } from "@/pdfcn/components/pdf/badge/badge";
import { DataTable } from "@/pdfcn/components/pdf/data-table/data-table";
import { Heading } from "@/pdfcn/components/pdf/heading/heading";
import { KeepTogether } from "@/pdfcn/components/pdf/keep-together/keep-together";
import { Section } from "@/pdfcn/components/pdf/section/section";
import { Text } from "@/pdfcn/components/pdf/text/text";
import { Document, Link, Page, View } from "@/pdfcn/lib/pdf-primitives";

/**
 * El informe de un termino, como documento de pdfcn sobre Takumi.
 *
 * SOLO SERVIDOR: lo importa lib/informe/render.tsx y nadie mas. No lleva
 * "use client" y no puede llevarlo: nada de esto pinta en el navegador.
 *
 * IGUAL A LA PANTALLA desde el 23 de septiembre de 2026, a pedido del
 * cliente: la direccion abre el PDF sin el tablero al lado y tiene que leer lo
 * mismo que en la ficha. Cabecera con el termino y la fecha; las tres
 * tarjetas —noticias, publicaciones, comentarios— con positivos y negativos
 * en grande y un cuadro por pieza; y debajo la lista de noticias (todas
 * juntas, con las agregadas a mano sin marca), la de publicaciones y los
 * comentarios por publicacion. Los numeros salen de DocumentoInforme.pantalla,
 * que calcula lo mismo que la ficha con las mismas funciones.
 *
 * Lo que se fue con eso, porque la pantalla tampoco lo tiene: «En resumen»,
 * fuentes consultadas, las graficas, la salvedad del tono, los temas, la
 * lectura automatica, «Agregadas a mano» y la pagina «Lo que este informe no
 * dice». El dato sigue trayendo la salvedad (el validador la exige) y el
 * modelo sigue calculando lo demas; volver a pintarlo es cosa de este archivo.
 *
 * Reglas que la forma sigue sosteniendo: conteos y nunca porcentajes; «sin
 * dato» y nunca cero donde no se leyo; noticias, publicaciones y comentarios
 * en tarjetas separadas y sin un total.
 */

const GRIS = "#71717a";

const SIN_COMENTARIOS_NOTICIAS = "Las noticias no incluyen comentarios.";

type FilaTitular = Record<string, unknown> & TitularInforme;

/** Titulares con su tono (positiva | negativa | neutral en pantalla desde el
 *  23 de septiembre de 2026; el dato sigue diciendo favorable | adversa) y su
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
            return <Badge size="sm" variant={variante} label={tono === null ? "sin tono" : NOMBRE_TONO_TITULAR[tono]} />;
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

const VERDE = "#059669";
const ROJO = "#e11d48";
const NEUTRO = "#a1a1aa";
const FILO = "#e4e4e7";

const COLOR_CUADRO: Record<ClaseTono, string> = {
  positivo: VERDE, negativo: ROJO, neutral: NEUTRO, sin_tono: "#ffffff",
};

/** Un cuadro por pieza, como la tira de la pantalla (ui/tira-tono.tsx). Con
 *  mas de 60 se deja de pintar: los numeros de arriba ya lo dicen. */
function Cuadros({ serie }: { serie: TonoSerie }) {
  if (serie.total === 0 || serie.total > 60) return null;
  return (
    <View style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 3, marginTop: 6 }}>
      {serie.tramos.flatMap((t) => Array.from({ length: t.n }, (_, i) => (
        <View key={`${t.clase}-${i}`} style={{
          width: 9, height: 9, backgroundColor: COLOR_CUADRO[t.clase],
          borderWidth: t.clase === "sin_tono" ? 1 : 0, borderColor: GRIS, borderStyle: "solid",
        }} />
      )))}
    </View>
  );
}

/** El triangulo de la tarjeta, dibujado con bordes y no con «▲»: Geist no
 *  trae ese glifo y el motor de PDF falla el documento entero ante un
 *  caracter sin fuente (ver limpiarParaFuente en lib/informe/modelo.ts).
 *  Los lados van en blanco y no en `transparent`: el motor pinta
 *  `transparent` en negro y salian relojes de arena. La tarjeta es blanca. */
function Flecha({ arriba, color }: { arriba: boolean; color: string }) {
  return (
    <View style={{
      width: 0, height: 0, borderStyle: "solid",
      borderLeftWidth: 6, borderRightWidth: 6, borderLeftColor: "#ffffff", borderRightColor: "#ffffff",
      ...(arriba
        ? { borderBottomWidth: 10, borderBottomColor: color, borderTopWidth: 0, borderTopColor: "#ffffff" }
        : { borderTopWidth: 10, borderTopColor: color, borderBottomWidth: 0, borderBottomColor: "#ffffff" }),
    }} />
  );
}

function Numero({ n, clase, genero }: { n: number; clase: "positivo" | "negativo"; genero: Genero }) {
  const color = clase === "positivo" ? VERDE : ROJO;
  return (
    <View style={{ display: "flex", flexDirection: "column" }}>
      {/* La flecha siempre en su color y mas chica, el numero en gris si es
          cero: igual que la tarjeta de la pantalla. */}
      <View style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Flecha arriba={clase === "positivo"} color={color} />
        <Text noMargin weight="bold" color={n === 0 ? GRIS : color} style={{ fontSize: 30, lineHeight: 1 }}>{cifra(n)}</Text>
      </View>
      <Text variant="sm" noMargin>{palabraTono(clase, n, genero)}</Text>
    </View>
  );
}

/** Una tarjeta, como en la pantalla: positivos y negativos en grande, un
 *  cuadro por pieza y el resto en gris. `serie` null es «sin dato». */
function Tarjeta({ rotulo, serie, genero, unidad, sinTono, nota }: {
  rotulo: string;
  serie: TonoSerie | null;
  genero: Genero;
  unidad: [string, string, string];
  sinTono?: number;
  nota?: string;
}) {
  const resto = serie === null ? [] : [
    serie.neutral > 0 ? `${cifra(serie.neutral)} ${palabraTono("neutral", serie.neutral, genero)}` : null,
    serie.sinTono > 0 ? `${cifra(serie.sinTono)} sin tono` : null,
  ].filter((x): x is string => x !== null);
  return (
    <View style={{ flex: 1, borderWidth: 1, borderColor: FILO, borderStyle: "solid", borderRadius: 8, padding: 12 }}>
      <Text variant="sm" weight="medium" color={GRIS} noMargin>{rotulo}</Text>
      {sinTono !== undefined ? (
        <View style={{ marginTop: 8 }}>
          <Text noMargin weight="bold" style={{ fontSize: 30, lineHeight: 1 }}>{cifra(sinTono)}</Text>
          <Text variant="xs" color={GRIS} noMargin>{sinTono === 1 ? unidad[0] : unidad[1]} · tono sin dato</Text>
        </View>
      ) : serie === null ? (
        <Text variant="lg" italic color="#b45309" style={{ marginTop: 8 }}>Sin dato</Text>
      ) : (
        <View style={{ marginTop: 8 }}>
          <View style={{ display: "flex", flexDirection: "row", gap: 18 }}>
            <Numero n={serie.positivo} clase="positivo" genero={genero} />
            <Numero n={serie.negativo} clase="negativo" genero={genero} />
          </View>
          <Cuadros serie={serie} />
          <Text variant="xs" color={GRIS} style={{ marginTop: 6 }} noMargin>
            {serie.total === 0
              ? unidad[2]
              : `de ${cifra(serie.total)} ${serie.total === 1 ? unidad[0] : unidad[1]}${resto.length > 0 ? ` · ${resto.join(" · ")}` : ""}`}
          </Text>
        </View>
      )}
      {nota === undefined ? null : <Text variant="xs" color={GRIS} style={{ marginTop: 4 }} noMargin>{nota}</Text>}
    </View>
  );
}

type FilaPublicacion = Record<string, unknown> & DocumentoInforme["pantalla"]["publicaciones"][number];

function TablaPublicaciones({ filas }: { filas: DocumentoInforme["pantalla"]["publicaciones"] }) {
  return (
    <DataTable<FilaPublicacion>
      size="compact"
      stripe
      columns={[
        { key: "fecha", header: "Fecha", width: "13%", render: (v) => <Text variant="xs" noMargin>{v === null ? "sin fecha" : fechaCorta(String(v))}</Text> },
        { key: "red", header: "Red", width: "12%", render: (v) => <Text variant="xs" noMargin>{String(v)}</Text> },
        { key: "fuente", header: "Cuenta", width: "18%", render: (v) => <Text variant="xs" noMargin>{limpiarParaFuente(String(v))}</Text> },
        { key: "titulo", header: "Primera línea", render: (v) => <Text variant="xs" noMargin>{limpiarParaFuente(String(v)) || "(sin pie)"}</Text> },
        { key: "url", header: "Enlace", width: "9%", render: (v) => <Link src={String(v)} style={{ color: "#0284c7", fontSize: 9 }}>abrir</Link> },
      ]}
      data={filas.map((f) => ({ ...f }))}
    />
  );
}

export function InformeConsulta({ modelo }: { modelo: DocumentoInforme }) {
  const m = modelo;
  const p = m.pantalla;
  const { prensa: cp, publicaciones: cpub, comentarios: cc } = p.cifras;
  const corte = fechaLarga(m.corte);
  const tipo = m.tipo.charAt(0).toUpperCase() + m.tipo.slice(1);
  return (
    <Document title={`Pulso N33 · ${m.termino}`}>
      <Page size="A4">
        {/* ------------------------------------------------------- cabecera */}
        <Text variant="xs" color={GRIS} transform="uppercase">Pulso N33 · Informe por término</Text>
        <Heading level={1}>{m.termino}</Heading>
        <Text variant="base" color={GRIS}>{tipo} · al {corte}</Text>

        {/* -------------------------------------------------------- tarjetas */}
        <KeepTogether>
          <View style={{ display: "flex", flexDirection: "row", gap: 10, marginTop: 14, marginBottom: 18 }}>
            <Tarjeta rotulo="Noticias" serie={cp.estado === "ok" ? cp.tono : null} genero="f"
              unidad={["noticia", "noticias", "Ninguna noticia"]}
              nota={cp.estado === "ok" ? SIN_COMENTARIOS_NOTICIAS : undefined} />
            <Tarjeta rotulo={p.rotulos.publicaciones} serie={cpub.estado === "ok" ? cpub.tono : null} genero="f"
              sinTono={cpub.estado === "ok" && cpub.tono === null ? cpub.total : undefined}
              unidad={["publicación", "publicaciones", "Ninguna publicación"]} />
            <Tarjeta rotulo={p.rotulos.comentarios} serie={cc.estado === "ok" ? cc.tono : null} genero="m"
              unidad={["comentario", "comentarios", "Ningún comentario"]} />
          </View>
        </KeepTogether>

        {/* -------------------------------------------------------- noticias */}
        <Section spacing="md">
          <Heading level={2}>Noticias</Heading>
          <Text variant="sm" color={GRIS}>{SIN_COMENTARIOS_NOTICIAS}</Text>
          {p.porMedio.length < 2 ? null : (
            <KeepTogether>
              <Heading level={4}>De dónde vienen</Heading>
              <DataTable
                size="compact"
                columns={[
                  { key: "fuente", header: "Medio" },
                  { key: "titulares", header: "Noticias", align: "right", render: (v) => <Text variant="xs" noMargin>{cifra(v as number)}</Text> },
                  { key: "favorable", header: "Positivas", align: "right", render: (v) => <Text variant="xs" noMargin>{cifra(v as number)}</Text> },
                  { key: "adversa", header: "Negativas", align: "right", render: (v) => <Text variant="xs" noMargin>{cifra(v as number)}</Text> },
                  { key: "neutral", header: "Neutrales", align: "right", render: (v) => <Text variant="xs" noMargin>{cifra(v as number)}</Text> },
                ]}
                data={p.porMedio.map((r) => ({ ...r }))}
              />
            </KeepTogether>
          )}
          {cp.estado !== "ok"
            ? <Text color={GRIS}>Sin dato.</Text>
            : p.noticias.length === 0
              ? <Text>Ninguna noticia menciona a {m.termino}.</Text>
              : <TablaTitulares filas={p.noticias} />}
        </Section>

        {/* --------------------------------------------------- publicaciones */}
        <Section spacing="md">
          <Heading level={2}>Publicaciones</Heading>
          {p.publicaciones.length === 0
            ? <Text color={GRIS}>{cpub.estado === "ok" ? "Ninguna publicación." : "Sin dato."}</Text>
            : <TablaPublicaciones filas={p.publicaciones} />}
        </Section>

        {/* ----------------------------------------------------- comentarios */}
        <Section spacing="md">
          <Heading level={2}>{p.rotulos.hoja}</Heading>
          {!m.hayArchivoDeTexto ? (
            <Text variant="sm" color={GRIS}>El texto de los comentarios no está disponible en esta vista.</Text>
          ) : p.comentarios.length === 0 ? (
            <Text variant="sm" color={GRIS}>{cc.estado === "ok" ? "Sin comentarios." : "Sin dato."}</Text>
          ) : (
            p.comentarios.map((pub) => (
              <View key={`${pub.red}:${pub.titulo}:${pub.fuente}`} style={{ marginBottom: 12 }}>
                <Text variant="xs" color={GRIS} noMargin>{limpiarParaFuente(pub.fuente)} · {pub.nombre}</Text>
                <Text variant="sm" weight="semibold">{limpiarParaFuente(pub.titulo) || "(sin pie)"}</Text>
                {pub.comentarios.map((c, i) => <Comentario key={i} c={c} />)}
              </View>
            ))
          )}
        </Section>
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
