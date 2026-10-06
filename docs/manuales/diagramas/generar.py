# Genera neon-modelo-de-datos.drawio y ciclo-de-ingesta.drawio.
#
# Se escriben desde codigo, y no a mano en draw.io, para que un cambio de
# tabla o de paso del cron sea una linea aqui. El de arquitectura se dibujo a
# mano y vive solo como .drawio. Los conteos son de produccion, 5 oct 2026.
#
#   python docs/manuales/diagramas/generar.py

from pathlib import Path
from xml.sax.saxutils import escape

AQUI = Path(__file__).parent


def q(s):
    return escape(s, {'"': "&quot;"})


def archivo(nombre, pagina, ancho, alto, celdas):
    xml = (f'<mxfile><diagram name="{q(pagina)}"><mxGraphModel dx="{ancho}" dy="{alto}" grid="1" '
           f'gridSize="10" page="1" pageWidth="{ancho}" pageHeight="{alto}"><root>'
           + "".join(celdas) + "</root></mxGraphModel></diagram></mxfile>\n")
    (AQUI / nombre).write_text(xml, encoding="utf-8", newline="\n")


BASE = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']


def texto(id_, valor, x, y, w, h, tam=18, negrita=True, color=None):
    st = f"text;html=1;whiteSpace=wrap;fontSize={tam};" + ("fontStyle=1;" if negrita else "")
    if color:
        st += f"fontColor={color};"
    return (f'<mxCell id="{id_}" value="{q(valor)}" style="{st}" vertex="1" parent="1">'
            f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')


def arista(id_, a, b, etiqueta="", estilo="", puntos=()):
    # Los puntos van escritos porque el visor de draw.io no recalcula rutas:
    # sin ellos una flecha larga cruza por encima de las cajas.
    st = "edgeStyle=orthogonalEdgeStyle;html=1;rounded=1;labelBackgroundColor=#ffffff;" + estilo
    arreglo = ""
    if puntos:
        arreglo = ('<Array as="points">' + "".join(f'<mxPoint x="{x}" y="{y}"/>' for x, y in puntos)
                   + "</Array>")
    return (f'<mxCell id="{id_}" value="{q(etiqueta)}" style="{st}" edge="1" parent="1" '
            f'source="{a}" target="{b}"><mxGeometry relative="1" as="geometry">{arreglo}</mxGeometry></mxCell>')


# ---------- Modelo de datos de Neon ----------

TABLAS = {
    "usuarios": (40, 60, "16 filas", [
        "id · int · PK", "entra_oid · varchar · UK", "correo · varchar · UK", "nombre · varchar",
        "rol · lector | admin", "activo · bool", "aprobado · bool", "creado_en · timestamptz",
        "ultimo_acceso_en · timestamptz"]),
    "seguimientos": (380, 60, "6 filas", [
        "id · uuid · PK", "red · instagram | tiktok | facebook", "url · text · UK", "idioma · es | en",
        "titulo · text", "creador · varchar", "publicado · timestamptz", "tipo · varchar",
        "usuario_id · int", "creado_en · timestamptz"]),
    "seguimiento_comentarios": (720, 60, "414 filas", [
        "seguimiento_id · uuid · PK, FK", "huella · char(16) · PK", "texto · text (15 días)",
        "likes · int", "sentimiento · varchar", "escrito_en · timestamptz",
        "primera_vez · timestamptz", "cosechado_en · timestamptz"]),
    "gasto_seguimiento": (40, 440, "7 filas · 0.51 USD", [
        "id · uuid · PK", "usuario_id · int", "tope_usd · numeric", "usd · numeric",
        "creado_en · timestamptz", "terminado_en · timestamptz"]),
    "seguimiento_actualizaciones": (380, 440, "7 filas", [
        "id · uuid · PK", "seguimiento_id · uuid · FK", "gasto_id · uuid · FK",
        "estado · leyendo | guardando | listo | fallo", "corridas · jsonb", "metricas · jsonb",
        "leidos · int", "nuevos · int", "tono · jsonb", "resumen · jsonb (15 días)",
        "creado_en · timestamptz", "terminado_en · timestamptz"]),
    "busquedas_redes": (720, 440, "0 filas", [
        "id · uuid · PK", "clave · char(64) · HMAC del término", "usuario_id · int",
        "estado · buscando | listo | fallo", "corridas · jsonb", "tope_usd · numeric",
        "usd · numeric", "creado_en · timestamptz", "terminado_en · timestamptz"]),
}

# (origen, destino, etiqueta, por convencion, anclas, puntos)
RELACIONES = [
    ("usuarios", "seguimientos", "agrega", True,
     "exitX=1;exitY=0.5;entryX=0;entryY=0.455;", ()),
    ("usuarios", "gasto_seguimiento", "gasta · convención", True, "", ()),
    ("usuarios", "busquedas_redes", "busca · convención", True,
     "exitX=0;exitY=0.15;entryX=0.5;entryY=1;", ((20, 96), (20, 780), (870, 780))),
    ("seguimientos", "seguimiento_comentarios", "FK", False,
     "exitX=1;exitY=0.455;entryX=0;entryY=0.555;", ()),
    ("seguimientos", "seguimiento_actualizaciones", "FK · ON DELETE CASCADE", False, "", ()),
    ("gasto_seguimiento", "seguimiento_actualizaciones", "FK", False, "", ()),
]


def modelo():
    ancho, fila = 300, 24
    c = BASE + [texto("titulo", "Pulso N33 · Neon Postgres (producción, 5 de octubre de 2026)", 40, 10, 800, 34)]
    for nombre, (x, y, cuenta, cols) in TABLAS.items():
        alto = 26 + fila * len(cols)
        c.append(f'<mxCell id="{nombre}" value="{q(nombre)}  ({q(cuenta)})" style="swimlane;fontStyle=1;'
                 f'childLayout=stackLayout;horizontal=1;startSize=26;horizontalStack=0;resizeParent=1;'
                 f'collapsible=0;fillColor=#dae8fc;strokeColor=#6c8ebf;html=1;" vertex="1" parent="1">'
                 f'<mxGeometry x="{x}" y="{y}" width="{ancho}" height="{alto}" as="geometry"/></mxCell>')
        for i, col in enumerate(cols):
            negrita = "fontStyle=1;" if "PK" in col else ""
            c.append(f'<mxCell id="{nombre}_{i}" value="{q(col)}" style="text;strokeColor=none;fillColor=none;'
                     f'align=left;verticalAlign=middle;spacingLeft=6;html=1;{negrita}" vertex="1" parent="{nombre}">'
                     f'<mxGeometry y="{26 + i * fila}" width="{ancho}" height="{fila}" as="geometry"/></mxCell>')
    for i, (a, b, etiqueta, convencion, anclas, puntos) in enumerate(RELACIONES):
        estilo = "endArrow=ERmany;startArrow=ERmandOne;endFill=0;startFill=0;" + anclas
        estilo += "dashed=1;strokeColor=#888888;fontColor=#666666;" if convencion else "strokeColor=#333333;"
        c.append(arista(f"r{i}", a, b, etiqueta, estilo, puntos))
    c.append(texto("nota", "Línea continua: clave foránea real; las dos que salen de seguimientos borran en cascada. "
                           "Punteada: relación por convención (usuario_id no tiene clave foránea).", 40, 800, 900, 24, 11, False, "#555555"))
    archivo("neon-modelo-de-datos.drawio", "Neon", 1080, 840, c)


# ---------- Ciclo de la ingesta ----------

GRATIS = [
    ("A", "checkout · Python 3.11 · modelo de tono", "p"),
    ("B", "pruebas unittest", "p"),
    ("C", "validar (canario, no bloquea)", "p"),
    ("D", "correr --metodo modelo (prensa)", "p"),
    ("E", "comunicados", "p"),
    ("F", "youtube (feeds públicos)", "p"),
    ("G", "indicadores", "p"),
    ("H", "gasto-electoral (solo lunes)", "p"),
    ("I", "¿validar ok?", "d"),
    ("J", "Commit 1 · «datos: ingesta»", "c"),
]
PAGADO = [
    ("K", "¿APIFY_HABILITADO?", "d"),
    ("L", "apify --verificar", "$"),
    ("M", "redes · Instagram (15 min)", "$"),
    ("N", "tiktok (15 min)", "$"),
    ("O", "facebook (10 min)", "$"),
    ("P", "tendencias de X (5 min)", "$"),
    ("Q", "¿validar --anotaciones ok?", "d"),
    ("R", "Commit 2 · «datos: redes»", "c"),
    ("S", "¿DESPLEGAR_TABLERO?", "d"),
]
ESTILO = {
    "p": "rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;",
    "d": "rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;",
    "c": "shape=process;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;fontStyle=1;",
    "$": "rounded=1;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;",
}
SALIDAS = [
    ("W", "Anotación de aviso; solo se publica la prensa", "fillColor=#ffe6cc;strokeColor=#d79b00;", 100),
    ("T", "vercel build + deploy desde el runner · con comentarios", "fillColor=#e1d5e7;strokeColor=#9673a6;", 700),
    ("U", "Vercel construye el commit desde git · sin comentarios (estado actual)",
     "fillColor=#e1d5e7;strokeColor=#9673a6;", 800),
]
ARISTAS = [("A", "B", ""), ("B", "C", ""), ("C", "D", ""), ("D", "E", ""), ("E", "F", ""), ("F", "G", ""),
           ("G", "H", ""), ("H", "I", ""), ("I", "J", "sí"), ("J", "K", ""), ("K", "W", "no"),
           ("K", "L", "sí"), ("L", "M", ""), ("M", "N", ""), ("N", "O", ""), ("O", "P", ""), ("P", "Q", ""),
           ("Q", "R", "sí"), ("R", "S", ""), ("S", "T", "sí"), ("S", "U", "no")]


def ciclo():
    c = BASE + [texto("t", "Pulso N33 · Ciclo de la ingesta (pulso.yml, cada 6 h al minuto 17)", 40, 10, 900, 34)]
    for id_, titulo, x, color in (("gl", "Pasos gratuitos", 40, "fillColor=#f5f5f5;strokeColor=#999999;"),
                                  ("gp", "Cosechas pagadas (Apify) · continue-on-error", 400,
                                   "fillColor=#fdf1f0;strokeColor=#b85450;")):
        c.append(f'<mxCell id="{id_}" value="{q(titulo)}" style="swimlane;startSize=26;rounded=1;fontStyle=1;{color}" '
                 f'vertex="1" parent="1"><mxGeometry x="{x}" y="60" width="300" height="830" as="geometry"/></mxCell>')
    for padre, pasos in (("gl", GRATIS), ("gp", PAGADO)):
        for i, (id_, valor, tipo) in enumerate(pasos):
            alto = 60 if tipo == "d" else 46
            c.append(f'<mxCell id="{id_}" value="{q(valor)}" style="{ESTILO[tipo]}" vertex="1" parent="{padre}">'
                     f'<mxGeometry x="40" y="{40 + i * 80}" width="220" height="{alto}" as="geometry"/></mxCell>')
    for id_, valor, color, y in SALIDAS:
        c.append(f'<mxCell id="{id_}" value="{q(valor)}" style="rounded=1;whiteSpace=wrap;html=1;{color}" '
                 f'vertex="1" parent="1"><mxGeometry x="760" y="{y}" width="240" height="56" as="geometry"/></mxCell>')
    for i, (a, b, etiqueta) in enumerate(ARISTAS):
        if (a, b) == ("J", "K"):
            # Del fondo de la columna gratuita a la cima de la pagada, por el pasillo.
            c.append(arista(f"e{i}", a, b, etiqueta, "exitX=1;exitY=0.5;entryX=0;entryY=0.5;",
                            ((370, 843), (370, 130))))
        else:
            c.append(arista(f"e{i}", a, b, etiqueta))
    c.append(texto("nt", "Límite del trabajo: 75 min, por encima de la suma de los límites de cada paso pagado, "
                         "para que siempre se guarde lo ya cosechado.", 40, 900, 960, 30, 11, False, "#555555"))
    archivo("ciclo-de-ingesta.drawio", "Ciclo", 1040, 950, c)


if __name__ == "__main__":
    modelo()
    ciclo()
    print("escritos neon-modelo-de-datos.drawio y ciclo-de-ingesta.drawio")
