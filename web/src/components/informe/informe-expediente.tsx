import type { ReactNode } from "react";

import { fechaConAnio, MESES, MESES_CORTOS } from "@/lib/dominio/formato";
import { REDES_DEL_ANO, type AnoEnRedes, type Expediente, type Historia, type PublicacionDelMes, type RedDelAno, type Segmento } from "@/lib/expedientes/expedientes";
import { cifraDelAno, delAnoPorRed, diaEnTijuana, RESUMIDAS_POR_RED, temasRepetidos, tonoDeRed, type PublicacionDelAno, type ResumenesPdf } from "@/lib/expedientes/pdf";
import { cifra, limpiarParaFuente } from "@/lib/informe/modelo";
import { Heading } from "@/pdfcn/components/pdf/heading/heading";
import { KeepTogether } from "@/pdfcn/components/pdf/keep-together/keep-together";
import { Section } from "@/pdfcn/components/pdf/section/section";
import { Text } from "@/pdfcn/components/pdf/text/text";
import { Document, Link, Page, View } from "@/pdfcn/lib/pdf-primitives";

/**
 * El expediente de /reportes/<id> en PDF: un informe CONDENSADO para la
 * direccion (cliente, 2 de octubre de 2026: «los de arriba solo quieren un
 * informe condensado de como se percibe al alcalde en todos lados»). Unas
 * cinco paginas y no veintinueve.
 *
 * SOLO SERVIDOR, como informe-consulta.tsx: lo importa
 * lib/expedientes/render-pdf.tsx y nadie mas.
 *
 * El orden responde esa pregunta: en corto; en la prensa (cada historia con
 * su alcance y en dos frases —`Historia.resumen`, no el cuerpo de la
 * pantalla—); el año en redes (lo mas visto de cada red, el #1 de cada mes,
 * el tono por red, los temas que se repiten y lo que dicen los comentarios
 * de las tres mas vistas de cada red, en su resumen de IA); y lo menor. El
 * año entra el 5 de octubre de 2026 en lugar de las publicaciones de
 * septiembre en seguimiento, como en la pantalla. Se fueron el anexo
 * de titulares, la lista de comentarios y la grafica por mes: estan en la
 * pantalla, y la grafica empujaba «En redes» a una pagina mas.
 *
 * Prensa y comentarios NUNCA en una cifra comun (regla 3): son dos
 * secciones. La prensa no lleva tono (regla 5: es una figura del roster). El
 * tono de los comentarios lleva SALVEDAD_TONO, y los resumenes dicen que son
 * de IA y llevan SALVEDAD_RESUMEN: es la excepcion de seguimiento, la misma
 * que la pantalla. Conteos y nunca porcentajes.
 */

const GRIS = "#71717a";
const TINTA = "#18181b";
const FILO = "#e4e4e7";
const FONDO = "#fafafa";
const ACENTO = "#E0342B";
const VERDE = "#059669";
const ROJO = "#e11d48";
const ENLACE = "#0284c7";

const t = (s: string) => limpiarParaFuente(s);

/** Un filo de un solo lado. Takumi, con `borderStyle` y un solo ancho, pinta
 *  los otros tres lados con su ancho por omision y en negro: todo el primer
 *  render salio enmarcado en cajas negras. Por eso los cuatro anchos van
 *  siempre explicitos. */
const filoArriba = { borderTopWidth: 1, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0, borderColor: FILO, borderStyle: "solid" } as const;
const filoIzquierda = (ancho: number, color: string) =>
  ({ borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: ancho, borderColor: color, borderStyle: "solid" }) as const;

/** Un tramo de un parrafo con enlaces. `limpiarParaFuente` recorta, y el
 *  espacio que separaba el tramo del enlace se perdia («el Tesorosancionó»,
 *  «sancionada.MVSdice»); el motor ademas recorta los espacios comunes en la
 *  orilla de cada hijo. Se limpia y la orilla vuelve como espacio duro. */
const tramo = (s: string) => `${/^\s/.test(s) ? " " : ""}${t(s)}${/\s$/.test(s) ? " " : ""}`;

const NOMBRE_RED = { youtube: "YouTube", tiktok: "TikTok", facebook: "Facebook", instagram: "Instagram" } as const;

function Texto({ segmentos }: { segmentos: readonly Segmento[] }) {
  // Un parrafo con enlaces: el texto corre y el enlace va en su color, como
  // hijos del mismo <Text> para que el renglon parta igual que en pantalla.
  return (
    <Text variant="sm" noMargin style={{ lineHeight: 1.55 }}>
      {segmentos.map((s, i) => typeof s === "string"
        ? tramo(s)
        : s.url !== undefined
          ? <Link key={i} src={s.url} style={{ color: ENLACE }}>{tramo(s.t)}</Link>
          : <Text key={i} variant="sm" weight="semibold" noMargin>{tramo(s.t)}</Text>)}
    </Text>
  );
}

function Rotulo({ children }: { children: string }) {
  return <Text variant="xs" color={GRIS} transform="uppercase" noMargin style={{ letterSpacing: 0.6 }}>{children}</Text>;
}

/** Cifras de cabecera: tres columnas con su rotulo arriba. */
function Cifras({ e }: { e: Expediente }) {
  const items: [string, string][] = [
    ["Titulares que lo nombran", cifra(e.titulares)],
    ["Medios", cifra(e.medios)],
    ...(e.proximo === null ? [] : [[e.proximo.evento, fechaConAnio(e.proximo.fecha)] as [string, string]]),
  ];
  return (
    <View style={{ display: "flex", flexDirection: "row", gap: 28, ...filoArriba, paddingTop: 10, marginTop: 14 }}>
      {items.map(([r, v]) => (
        <View key={r} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Text variant="xs" color={GRIS} noMargin>{r}</Text>
          <Text noMargin weight="semibold" color={TINTA} style={{ fontSize: 18 }}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

/** Medios por historia en una escala comun, con el resumen de cada una
 *  debajo de su barra: alcance e historia en una sola lista, que es lo que
 *  condensa el informe. */
function Historias({ historias }: { historias: readonly Historia[] }) {
  const escala = Math.ceil(Math.max(...historias.map((h) => h.medios)) / 10) * 10;
  return (
    <View style={{ display: "flex", flexDirection: "column" }}>
      <Text variant="xs" color={GRIS} noMargin style={{ marginBottom: 4 }}>{`Medios que publicaron cada historia, en una escala de 0 a ${escala}. Ordenadas por polémica y alcance.`}</Text>
      {historias.map((h, i) => (
        <KeepTogether key={h.id}>
          <View style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 8, paddingBottom: 8, ...filoArriba }}>
            <View style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text variant="sm" weight="semibold" noMargin style={{ width: 230 }}>{`${i + 1}. ${t(h.titulo)}`}</Text>
              <View style={{ flex: 1, height: 6, backgroundColor: "#f4f4f5", borderRadius: 3 }}>
                <View style={{ width: `${(h.medios / escala) * 100}%`, height: 6, backgroundColor: ACENTO, borderRadius: 3 }} />
              </View>
              <Text variant="xs" noMargin style={{ width: 92, textAlign: "right" }}>{`${cifra(h.medios)} ${h.medios === 1 ? "medio" : "medios"} · ${cifra(h.nacionales.length)} nac.`}</Text>
            </View>
            <Text variant="xs" color="#3f3f46" noMargin style={{ lineHeight: 1.5 }}>{t(h.resumen)}</Text>
          </View>
        </KeepTogether>
      ))}
    </View>
  );
}

const NOMBRE_ANO: Record<RedDelAno, string> = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook" };
/** Instagram y Facebook son siempre sus cuentas; en TikTok publica cualquiera. */
const DE_QUIEN: Record<RedDelAno, string> = { tiktok: "videos que lo nombran", instagram: "su cuenta", facebook: "su página" };
const UNIDAD: Record<RedDelAno, readonly [string, string]> = {
  tiktok: ["vista", "vistas"],
  instagram: ["like", "likes"],
  facebook: ["reacción", "reacciones"],
};
const VACIO: Record<RedDelAno, string> = { tiktok: "Ningún video que lo nombre.", instagram: "No publicó.", facebook: "No publicó." };
const GRIS_BARRA = "#d4d4d8";
const PISTA = "#f4f4f5";

/** «296,500 vistas»: la cifra con la unidad de su red. Un TikTok sin vistas
 *  se mide en likes, y lo dice. */
function cifraYUnidad(red: RedDelAno, p: PublicacionDelMes): string {
  const n = cifraDelAno(red, p);
  const [uno, varios] = red === "tiktok" && p.reproducciones === undefined ? UNIDAD.instagram : UNIDAD[red];
  return `${cifra(n)} ${n === 1 ? uno : varios}`;
}

const mesLargo = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1] ?? mes} de ${mes.slice(0, 4)}`;
const recorte = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Lo mas visto del año, una por red, en tres columnas: la respuesta antes
 *  que el detalle, como la pantalla. */
function LoMasVisto({ ano }: { ano: AnoEnRedes }) {
  return (
    <View style={{ display: "flex", flexDirection: "row", gap: 14 }}>
      {REDES_DEL_ANO.map((red) => {
        const mejor = delAnoPorRed(ano, red)[0];
        return (
          <View key={red} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, paddingTop: 8, ...filoArriba, borderColor: ACENTO }}>
            <Text variant="xs" color={GRIS} noMargin>{`${NOMBRE_ANO[red]} · ${DE_QUIEN[red]}`}</Text>
            {ano.sin_dato.includes(red) || mejor === undefined ? (
              <Text variant="xs" color={GRIS} noMargin>{ano.sin_dato.includes(red) ? "Sin dato." : VACIO[red]}</Text>
            ) : (
              <>
                {/* La cifra sola y la unidad debajo: «10,297 reacciones» en una
                    linea no cabia en un tercio de pagina y partia la unidad. */}
                <Text noMargin weight="bold" color={TINTA} style={{ fontSize: 22, lineHeight: 1.1 }}>{cifra(cifraDelAno(red, mejor.p))}</Text>
                <Text variant="xs" color={GRIS} noMargin>{cifraYUnidad(red, mejor.p).replace(/^[\d,]+ /, "")}</Text>
                <Link src={mejor.p.url} style={{ color: TINTA, fontSize: 9, lineHeight: 1.4 }}>{t(recorte(mejor.p.titulo || "Sin texto", 110))}</Link>
                <Text variant="xs" color={GRIS} noMargin>{`${mesLargo(mejor.mes)}${red === "tiktok" ? ` · ${t(mejor.p.cuenta)}` : ""}`}</Text>
              </>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** Mes por mes: el #1 de cada red con su barra en la escala de ESA red en el
 *  año. El pico va en el acento: es la misma publicacion de arriba. Del mes
 *  mas reciente al mas viejo, como la pantalla. Sin el titulo de cada celda,
 *  que la pantalla si lleva: con el, la tabla no cabia bajo «Lo mas visto» y
 *  saltaba de pagina dejando media hoja en blanco. */
function MesPorMes({ ano }: { ano: AnoEnRedes }) {
  const tope = Object.fromEntries(REDES_DEL_ANO.map((red) => [red, Math.max(0, ...ano.meses.flatMap((m) => (m.redes[red] ?? []).slice(0, 1).map((p) => cifraDelAno(red, p))))])) as Record<RedDelAno, number>;
  const meses = [...ano.meses].reverse();
  return (
    <View style={{ display: "flex", flexDirection: "column" }}>
      <View style={{ display: "flex", flexDirection: "row", gap: 14, paddingBottom: 4 }}>
        <Text variant="xs" color={GRIS} noMargin style={{ width: 52 }}>Mes</Text>
        {REDES_DEL_ANO.map((red) => <Text key={red} variant="xs" color={GRIS} noMargin style={{ flex: 1 }}>{`${NOMBRE_ANO[red]} · ${UNIDAD[red][1]}`}</Text>)}
      </View>
      {meses.map((m) => (
        <View key={m.mes} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 3, paddingBottom: 3, ...filoArriba }}>
          <Text variant="xs" noMargin style={{ width: 52 }}>{`${MESES_CORTOS[Number(m.mes.slice(5, 7)) - 1] ?? m.mes} ${m.mes.slice(2, 4)}`}</Text>
          {REDES_DEL_ANO.map((red) => {
            const p = m.redes[red]?.[0];
            if (ano.sin_dato.includes(red) || m.redes[red] === undefined) return <Text key={red} variant="xs" color={GRIS} noMargin style={{ flex: 1 }}>Sin dato</Text>;
            if (p === undefined) return <Text key={red} variant="xs" color={GRIS} noMargin style={{ flex: 1 }}>—</Text>;
            const n = cifraDelAno(red, p);
            const pico = n === tope[red];
            return (
              <View key={red} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <View style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ flex: 1, height: 5, backgroundColor: PISTA, borderRadius: 3 }}>
                    <View style={{ width: `${tope[red] > 0 ? (n / tope[red]) * 100 : 0}%`, height: 5, backgroundColor: pico ? ACENTO : GRIS_BARRA, borderRadius: 3 }} />
                  </View>
                  <Text variant="xs" noMargin weight={pico ? "semibold" : "normal"} style={{ width: 44, textAlign: "right" }}>{cifra(n)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
      <Text variant="xs" color={GRIS} noMargin style={{ marginTop: 6 }}>El #1 de cada mes en cada red. Cada barra se mide contra el pico de su red; en rojo, lo más visto del año.</Text>
    </View>
  );
}

/** Como suenan los comentarios leidos del año, por red y sin total. */
function TonoDelAno({ ano }: { ano: AnoEnRedes }) {
  const filas = REDES_DEL_ANO.map((red) => ({ red, ...tonoDeRed(ano, red) }));
  return (
    <View style={{ backgroundColor: FONDO, borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
      <View style={{ display: "flex", flexDirection: "row", gap: 10, paddingBottom: 2 }}>
        <Text variant="xs" color={GRIS} noMargin style={{ flex: 1 }}>Comentarios leídos</Text>
        <Text variant="xs" color={GRIS} noMargin style={{ width: 70, textAlign: "right" }}>negativos</Text>
        <Text variant="xs" color={GRIS} noMargin style={{ width: 70, textAlign: "right" }}>positivos</Text>
        <Text variant="xs" color={GRIS} noMargin style={{ width: 70, textAlign: "right" }}>neutrales</Text>
      </View>
      {filas.map((f) => {
        const total = f.positivo + f.negativo + f.neutral + f.sinTono;
        return (
          <View key={f.red} style={{ display: "flex", flexDirection: "row", alignItems: "baseline", gap: 10, paddingTop: 5, ...filoArriba }}>
            <Text variant="sm" noMargin style={{ flex: 1 }}>{total === 0 ? `${NOMBRE_ANO[f.red]} · sin dato` : `${NOMBRE_ANO[f.red]} · ${cifra(total)} en ${cifra(f.publicaciones)} publicaciones`}</Text>
            <Text variant="sm" weight="semibold" color={f.negativo === 0 ? GRIS : ROJO} noMargin style={{ width: 70, textAlign: "right" }}>{cifra(f.negativo)}</Text>
            <Text variant="sm" weight="semibold" color={f.positivo === 0 ? GRIS : VERDE} noMargin style={{ width: 70, textAlign: "right" }}>{cifra(f.positivo)}</Text>
            <Text variant="sm" color={GRIS} noMargin style={{ width: 70, textAlign: "right" }}>{cifra(f.neutral)}</Text>
          </View>
        );
      })}
      <Text variant="xs" color={GRIS} noMargin style={{ marginTop: 4 }}>{`${t(ano.salvedad_tono)} Sus cuentas y TikTok son públicos distintos, por eso no se suman.`}</Text>
    </View>
  );
}

/** Los temas con el mismo nombre en mas de una publicacion del año. */
function Repetidos({ resumenes }: { resumenes: ResumenesPdf }) {
  const lista = resumenes === null ? [] : temasRepetidos(Object.values(resumenes)).slice(0, 8);
  if (lista.length === 0) return null;
  return (
    <View style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
      <Text variant="sm" weight="semibold" noMargin style={{ marginBottom: 4 }}>Lo que se repite entre publicaciones</Text>
      {lista.map((x) => (
        <View key={x.nombre} style={{ display: "flex", flexDirection: "row", gap: 10, paddingTop: 4, paddingBottom: 4, ...filoArriba }}>
          <Text variant="xs" noMargin style={{ flex: 1 }}>{t(x.nombre)}</Text>
          <Text variant="xs" color={GRIS} noMargin style={{ width: 190, textAlign: "right" }}>{`${cifra(x.n)} comentarios en ${cifra(x.publicaciones)} publicaciones`}</Text>
        </View>
      ))}
    </View>
  );
}

/** Una de las mas vistas del año: su linea, su tono y lo que dicen sus
 *  comentarios en el resumen de IA. Ningun comentario literal. */
function Resumida({ x, resumenes, antes }: { x: PublicacionDelAno; resumenes: ResumenesPdf; antes?: ReactNode }) {
  const { red, p } = x;
  const r = resumenes?.[p.url];
  const tono = p.tono;
  return (
    <KeepTogether>
      {antes}
      <View style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 10, paddingBottom: 10, ...filoArriba }}>
        <Text variant="xs" color={GRIS} noMargin>{`${NOMBRE_ANO[red]} · ${mesLargo(x.mes)}${red === "tiktok" ? ` · ${t(p.cuenta)}` : ""} · ${cifraYUnidad(red, p)}`}</Text>
        <Link src={p.url} style={{ color: TINTA, fontSize: 10, fontWeight: 600 }}>{t(recorte(p.titulo || "Sin texto", 140))}</Link>
        {tono === undefined ? null : (
          <View style={{ display: "flex", flexDirection: "row", gap: 10 }}>
            <Text variant="xs" color={ROJO} weight="semibold" noMargin>{`${cifra(tono.negativo)} negativos`}</Text>
            <Text variant="xs" color={VERDE} weight="semibold" noMargin>{`${cifra(tono.positivo)} positivos`}</Text>
            <Text variant="xs" color={GRIS} noMargin>{`${cifra(tono.neutral)} neutrales · de ${cifra(p.cosechados)} comentarios leídos`}</Text>
          </View>
        )}
        {resumenes === null ? (
          <Text variant="xs" color={GRIS} noMargin>Lo que dicen sus comentarios: sin dato.</Text>
        ) : r === undefined ? (
          <Text variant="xs" color={GRIS} noMargin>{p.cosechados < 10 ? `${cifra(p.cosechados)} comentarios: muy pocos para resumirlos.` : "Sin resumen de sus comentarios."}</Text>
        ) : (
          <View style={{ display: "flex", flexDirection: "column", gap: 3, ...filoIzquierda(2, ACENTO), paddingLeft: 8, marginTop: 2 }}>
            <Text variant="sm" noMargin style={{ lineHeight: 1.5 }}>{t(r.texto)}</Text>
            {r.temas.length === 0 ? null : (
              <Text variant="xs" color={GRIS} noMargin>{`Temas: ${r.temas.map((m) => `${t(m.nombre)} (${cifra(m.n)})`).join(" · ")}`}</Text>
            )}
          </View>
        )}
      </View>
    </KeepTogether>
  );
}

export function InformeExpediente({ e, resumenes, salvedadResumen }: { e: Expediente; resumenes: ResumenesPdf; salvedadResumen: string }) {
  const cargo = e.cargo.charAt(0).toLowerCase() + e.cargo.slice(1);
  const otros = [...e.otros].sort((a, b) => a.fecha.localeCompare(b.fecha));
  return (
    <Document title={`Pulso N33 · ${e.persona}`}>
      <Page size="A4">
        {/* ------------------------------------------------------- cabecera */}
        <Rotulo>Pulso N33 · Expediente</Rotulo>
        <Heading level={1}>{t(e.persona)}</Heading>
        <Text variant="sm" color={GRIS} style={{ lineHeight: 1.5 }}>
          {`Cómo se habló del ${cargo} entre el ${fechaConAnio(e.desde)} y el ${fechaConAnio(e.hasta)}: lo que más publicó la prensa y lo que dicen los comentarios en redes.`}
        </Text>
        <Cifras e={e} />

        {/* ------------------------------------------------------- en corto */}
        <Section spacing="md">
          <Heading level={2}>En corto</Heading>
          {e.enCorto.map((p, i) => (
            <KeepTogether key={p.titulo}>
              <View style={{ marginBottom: 10, paddingLeft: 10, ...filoIzquierda(i === 0 ? 2 : 1, i === 0 ? ACENTO : FILO) }}>
                <Text variant="sm" weight="semibold" noMargin>{t(p.titulo)}</Text>
                <Texto segmentos={p.texto} />
              </View>
            </KeepTogether>
          ))}
        </Section>

        {/* -------------------------------------------------------- prensa */}
        <Section spacing="md">
          <Heading level={2}>En la prensa</Heading>
          <Historias historias={e.historias} />
        </Section>

        {/* ------------------------------------------------- año en redes */}
        {e.ano === null ? null : (
          <Section spacing="md">
            <Heading level={2}>El año en redes</Heading>
            <Text variant="sm" color={GRIS}>{`Lo más visto entre el ${fechaConAnio(e.ano.desde)} y el ${fechaConAnio(e.ano.hasta)} en sus cuentas de Instagram y Facebook y en los videos de TikTok que lo nombran. Cada red se mide con su propia cifra y no se suman.`}</Text>
            <KeepTogether>
              <Text variant="sm" weight="semibold" noMargin style={{ marginTop: 6, marginBottom: 6 }}>Lo más visto del año</Text>
              <LoMasVisto ano={e.ano} />
            </KeepTogether>
            <View style={{ marginTop: 16 }}>
              <KeepTogether>
                <Text variant="sm" weight="semibold" noMargin style={{ marginBottom: 6 }}>Mes por mes</Text>
                <MesPorMes ano={e.ano} />
              </KeepTogether>
            </View>
            <View style={{ marginTop: 16 }}>
              <KeepTogether>
                <Text variant="sm" weight="semibold" noMargin style={{ marginBottom: 6 }}>Cómo suenan los comentarios</Text>
                <TonoDelAno ano={e.ano} />
                <Repetidos resumenes={resumenes} />
              </KeepTogether>
            </View>
            {/* El encabezado viaja dentro de la primera publicacion: suelto, se
                quedaba al pie de una pagina y su primera publicacion en la
                siguiente. */}
            <View style={{ marginTop: 16 }}>
              {REDES_DEL_ANO.flatMap((red) => delAnoPorRed(e.ano as AnoEnRedes, red).slice(0, RESUMIDAS_POR_RED)).map((x, i) => (
                <Resumida key={x.p.url} x={x} resumenes={resumenes} antes={i > 0 ? undefined : (
                  <>
                    <Text variant="sm" weight="semibold" noMargin style={{ marginBottom: 2 }}>{`Lo que dicen los comentarios de las ${cifra(RESUMIDAS_POR_RED)} más vistas de cada red`}</Text>
                    <Text variant="xs" color={GRIS} style={{ marginBottom: 4 }}>{`Resúmenes generados con IA a partir del texto de los comentarios de cada publicación. ${salvedadResumen}`}</Text>
                  </>
                )} />
              ))}
            </View>
          </Section>
        )}

        {/* ---------------------------------------------------------- otros */}
        <Section spacing="md">
          <Heading level={2}>Otros asuntos</Heading>
          {otros.map((o) => (
            <View key={o.url} style={{ display: "flex", flexDirection: "row", gap: 10, paddingTop: 5, paddingBottom: 5, ...filoArriba }}>
              <Text variant="xs" color={GRIS} noMargin style={{ width: 62 }}>{fechaConAnio(o.fecha)}</Text>
              <Link src={o.url} style={{ flex: 1, color: TINTA, fontSize: 9 }}>{t(o.titulo)}</Link>
              <Text variant="xs" color={GRIS} noMargin style={{ width: 92, textAlign: "right" }}>{t(o.medio)}</Text>
            </View>
          ))}
          <Text variant="xs" color={GRIS} style={{ marginTop: 10 }}>{`Cuenta los medios que publicaron cada historia, no a quienes la leyeron. Varias historias descansan en un solo medio y se le atribuyen. Corte de prensa al ${fechaConAnio(e.hasta)}. Los titulares de cada historia están en la página del expediente.`}</Text>
        </Section>
      </Page>
    </Document>
  );
}

/** La banda de pie de cada pagina, con los contadores que el motor rellena. */
export function PieExpediente({ e, generado }: { e: Expediente; generado: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", padding: "10px 48px 18px", fontFamily: "Geist", fontSize: 9, color: GRIS }}>
      <span>Pulso N33 · {limpiarParaFuente(e.persona)} · generado el {fechaConAnio(diaEnTijuana(generado))}</span>
      <span>Página <span className="pageNumber" /> de <span className="totalPages" /></span>
    </div>
  );
}
