"""Pruebas offline de la conciliacion del gasto electoral.

Los nombres casi coinciden entre archivos, pero no son la llave: el caso que
se fija aqui cambia el nombre en el Anexo II y aun asi une por ID de
contabilidad. Tambien se prueba el ZIP por rangos porque los anexos federales
son demasiado grandes para bajarlos completos en cada corrida.
"""

import copy
import io
import json
import struct
import unittest
import zipfile
from html import escape
from urllib.error import HTTPError
from unittest.mock import MagicMock, patch

from pulso.gasto_electoral import (
    NoEsDato,
    _buscar_anexo_desde_inicio,
    _auditoria_desde_xlsx,
    _directorio_zip_remoto,
    _dinero,
    _miembro_zip_remoto,
    _pedir,
    _contienda,
    _campo_prefijo,
    anexos_remotos,
    armar_financiamiento,
    armar_gasto,
)
from pulso.validador import (
    validar_financiamiento_partidos,
    validar_gasto_electoral,
    validar_gasto_electoral_config,
)


def xlsx(filas):
    cadenas = []
    indices = {}

    def indice(valor):
        texto = str(valor)
        if texto not in indices:
            indices[texto] = len(cadenas)
            cadenas.append(texto)
        return indices[texto]

    renglones = []
    for numero, fila in enumerate(filas, 1):
        celdas = []
        for columna, valor in enumerate(fila):
            letra = chr(ord("A") + columna)
            celdas.append('<c r="{}{}" t="s"><v>{}</v></c>'.format(
                letra, numero, indice(valor)))
        renglones.append('<row r="{}">{}</row>'.format(numero, "".join(celdas)))
    hoja = ('<?xml version="1.0"?><worksheet '
            'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            '<sheetData>{}</sheetData></worksheet>').format("".join(renglones))
    compartidas = ('<?xml version="1.0"?><sst '
                   'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                   '{}</sst>').format("".join(
                       "<si><t>{}</t></si>".format(escape(v)) for v in cadenas))
    salida = io.BytesIO()
    with zipfile.ZipFile(salida, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("xl/sharedStrings.xml", compartidas)
        z.writestr("xl/worksheets/sheet1.xml", hoja)
    return salida.getvalue()


ENCABEZADO_AUDITORIA = [
    "SUJETO OBLIGADO", "TIPO ASOCIACIÓN", "ÁMBITO", "PROCESO",
    "ESTADO ELECCIÓN", "DISTRITO ELECCIÓN", "MUNICIPIO ELECCIÓN",
    "ID CONTABILIDAD", "CARGO", "NOMBRE DEL CANDIDATO",
    "TOTAL DE GASTOS REPORTADOS", "GASTO NO REPORTADO ANEXO II-A",
    "AJUSTES O RECLASIFICACIONES DE AUDITORIA", "QUEJAS",
    "TOTAL DE GASTOS DETERMINADOS POR AUDITORÍA", "TOTAL DE GASTOS",
    "TOPE DE GASTOS", "DIFERENCIA DE PRORRATEO",
]


def auditoria(identidad="41", nombre="NOMBRE DISTINTO"):
    return xlsx([
        ["ANEXO II"],
        ENCABEZADO_AUDITORIA,
        ["PARTIDO", "CANDIDATURA", "LOCAL", "2023-2024", "BAJA CALIFORNIA",
         "1-MEXICALI", "", identidad, "DIPUTACIÓN LOCAL MR", nombre,
         "100", "20", "", "", "20", "120", "1000", ""],
    ])


def csv_candidaturas(identidad="41"):
    return (
        "ID DE CONTABILIDAD,ESTADO ELECCION,SUBNIVEL ENTIDAD,CARGO,"
        "TIPO ASOCIACION,SUJETO OBLIGADO,SIGLAS,NOMBRE COMPLETO\n"
        "{},BAJA CALIFORNIA,Distrito 1-MEXICALI,DIPUTACIÓN LOCAL MR,"
        "C,PARTIDO,PP,ANA PÉREZ\n".format(identidad)
    ).encode("utf-8")


def csv_rubros(identidad="41"):
    return (
        "ID DE CONTABILIDAD,ESTADO ELECCION,FINANCIEROS,OPERATIVOS DE LA CAMPAÑA,"
        "PRODUCCIÓN DE LOS MENSAJES PARA RADIO Y T.V.,PROPAGANDA,"
        "PROPAGANDA EN DIARIOS REVISTAS Y OTROS MEDIOS IMPRESOS,"
        "PROPAGANDA EN VÍA PÚBLICA,PROPAGANDA EXHIBIDA EN SALAS DE CINE,"
        "PROPAGANDA UTILITARIA,REDES SOCIALES Y PROPAGANDA EXHIBIDA EN PÁGINAS DE INTERNET\n"
        "{},BAJA CALIFORNIA,$-,20,$-,30,$-,$-,$-,$-,50\n".format(identidad)
    ).encode("utf-8")


def config_minima():
    return {
        "nota": "Solo cifras finales.",
        "proceso_actual": {
            "id": "bc-2026-2027", "nombre": "Proceso", "estado": "preparacion",
            "inicio_federal": "2026-09-10", "inicio_local": "2026-12-06",
            "precampana_desde": "2027-01-04", "campana_desde": "2027-04-04",
            "campana_hasta": "2027-06-02", "eleccion": "2027-06-06",
            "fuente": "https://ine.mx/",
        },
        "procesos": [{
            "id": "pelo-2024", "nombre": "Local", "ambito": "local",
            "estado": "auditado", "eleccion": "2024-06-02", "corte": "2024-07-22",
            "dictamen": "INE/CG1/2024", "dictamen_url": "https://ine.mx/dictamen.pdf",
            "reporte_candidaturas": "https://ine.mx/oyg.csv",
            "reporte_desglose": "https://ine.mx/gxr.csv",
            "indice_anexos": "https://ine.mx/anexos", "patron_zip": "a2.zip",
            "patron_anexo": "Anexo II.xlsx", "filas_esperadas": 1,
        }],
    }


class TestConciliacion(unittest.TestCase):
    def test_none_es_sin_dato_no_cero(self):
        self.assertIsNone(_dinero(None))

    def test_distrito_toma_numero_del_csv_si_anexo_solo_da_ciudad(self):
        identidad, nombre = _contienda(
            "federal", "DIPUTACIÓN FEDERAL MR", "Distrito 2-Mexicali",
            "MEXICALI", "")
        self.assertEqual((identidad, nombre),
                         ("federal-diputacion-2", "Distrito federal 2"))

    def test_hallazgo_acepta_sufijo_del_partido_en_encabezado(self):
        fila = {"gasto no reportado anexo ii a morena fd": "66571.90"}
        self.assertEqual(_campo_prefijo(
            fila, "gasto no reportado anexo ii a"), "66571.90")

    def armar(self, identidad_auditoria="41"):
        c = config_minima()
        descargas = {
            c["procesos"][0]["reporte_candidaturas"]: csv_candidaturas(),
            c["procesos"][0]["reporte_desglose"]: csv_rubros(),
        }
        anexos = lambda *_: [("https://ine.mx/a2.zip", "Anexo II.xlsx",
                              auditoria(identidad_auditoria))]
        return armar_gasto(c, bajar=descargas.__getitem__, anexos=anexos)

    def test_une_por_id_no_por_nombre(self):
        d = self.armar()
        self.assertEqual(d["candidaturas"][0]["nombre"], "Ana Pérez")
        self.assertEqual(d["candidaturas"][0]["gasto_auditado"], 120.0)
        self.assertEqual(d["candidaturas"][0]["auditoria"]["determinado"], 20.0)

    def test_partido_vacio_usa_sujeto_obligado(self):
        c = config_minima()
        candidaturas = csv_candidaturas().replace(b",PP,", b",,")
        descargas = {
            c["procesos"][0]["reporte_candidaturas"]: candidaturas,
            c["procesos"][0]["reporte_desglose"]: csv_rubros(),
        }
        d = armar_gasto(
            c, bajar=descargas.__getitem__,
            anexos=lambda *_: [("u", "Anexo II.xlsx", auditoria())])
        self.assertEqual(d["candidaturas"][0]["partido"], "Partido")

    def test_faltante_queda_como_incidencia(self):
        d = self.armar("99")
        self.assertEqual(d["candidaturas"], [])
        self.assertEqual(d["resumen"], {
            "filas_origen": 1, "candidaturas": 0, "sin_conciliar": 1,
            "incidencias": 2})

    def test_determinismo_byte_a_byte(self):
        a = json.dumps(self.armar(), ensure_ascii=False, indent=1, sort_keys=False)
        b = json.dumps(self.armar(), ensure_ascii=False, indent=1, sort_keys=False)
        self.assertEqual(a, b)

    def test_reporte_duplicado_falla(self):
        c = config_minima()
        doble = csv_candidaturas() + csv_candidaturas().split(b"\n", 1)[1]
        descargas = {c["procesos"][0]["reporte_candidaturas"]: doble,
                     c["procesos"][0]["reporte_desglose"]: csv_rubros()}
        with self.assertRaisesRegex(NoEsDato, "repite ID"):
            armar_gasto(c, bajar=descargas.__getitem__,
                        anexos=lambda *_: [("u", "Anexo II.xlsx", auditoria())])

    def test_validador_detecta_total_roto(self):
        d = self.armar()
        d["candidaturas"][0]["gasto_auditado"] = 121
        errores, _ = validar_gasto_electoral(d)
        self.assertTrue(any("reportado + determinado" in e for e in errores))

    def test_componentes_parciales_no_inventan_contrapartida(self):
        d = self.armar()
        d["candidaturas"][0]["auditoria"] = {
            "no_reportado": 20.0,
            "ajustes_reclasificaciones": None,
            "quejas": None,
            "determinado": 20.0,
        }
        errores, _ = validar_gasto_electoral(d)
        self.assertFalse(any("hallazgos y ajustes" in e for e in errores))

    def test_encuentra_gastos_en_segunda_hoja_de_anexo_i_ii(self):
        original = auditoria()
        entrada = zipfile.ZipFile(io.BytesIO(original))
        salida = io.BytesIO()
        vacia = ('<?xml version="1.0"?><worksheet '
                 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                 '<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>INGRESOS</t>'
                 '</is></c></row></sheetData></worksheet>')
        with zipfile.ZipFile(salida, "w", zipfile.ZIP_DEFLATED) as z:
            for nombre in entrada.namelist():
                destino = ("xl/worksheets/sheet2.xml"
                           if nombre == "xl/worksheets/sheet1.xml" else nombre)
                z.writestr(destino, entrada.read(nombre))
            z.writestr("xl/worksheets/sheet1.xml", vacia)

        filas = _auditoria_desde_xlsx(salida.getvalue())
        self.assertEqual(filas[0]["id contabilidad"], "41")


class TestZipPorRangos(unittest.TestCase):
    def test_busca_baja_california_desde_el_inicio_sin_directorio(self):
        salida = io.BytesIO()
        with zipfile.ZipFile(salida, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("01_AGS/Anexo II_PP_AGS.xlsx", b"otro")
            z.writestr("02_BC/Anexo II_PP_BC.xlsx", b"baja california")
            z.writestr("03_BCS/Anexo II_PP_BCS.xlsx", b"otro")
        crudo = salida.getvalue()

        def rango(_url, inicio=None, fin=None, sufijo=None, timeout=180):
            self.assertIsNone(sufijo)
            return crudo[inicio:fin + 1], inicio, len(crudo)

        entradas = _buscar_anexo_desde_inicio(
            "https://ine.mx/a2.zip", r"^Anexo II_.*\.xlsx$",
            r"(^|[/_ -])BC([/_ .-]|$)",
            rango=lambda inicio, fin: rango("", inicio, fin))
        with patch("pulso.gasto_electoral._rango", side_effect=rango):
            contenido = _miembro_zip_remoto("https://ine.mx/a2.zip", entradas[0])

        self.assertEqual(entradas[0]["nombre"], "02_BC/Anexo II_PP_BC.xlsx")
        self.assertEqual(contenido, b"baja california")

    def test_reintenta_error_500_del_indice(self):
        respuesta = MagicMock()
        respuesta.read.return_value = b"indice"
        respuesta.headers = {}
        respuesta.status = 200
        respuesta.__enter__.return_value = respuesta
        error = HTTPError("https://ine.mx/indice", 500, "", {}, None)

        with patch("pulso.gasto_electoral.urlopen",
                   side_effect=[error, respuesta]) as abrir, \
                patch("pulso.gasto_electoral.time.sleep") as dormir:
            crudo, _, estado = _pedir("https://ine.mx/indice")

        self.assertEqual((crudo, estado), (b"indice", 200))
        self.assertEqual(abrir.call_count, 2)
        dormir.assert_called_once_with(1)

    def test_lee_solo_directorio_y_miembro(self):
        salida = io.BytesIO()
        with zipfile.ZipFile(salida, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("otros/testigo.pdf", b"x" * 2000)
            z.writestr("Anexo II_PP_BC.xlsx", b"xlsx minimo")
        crudo = salida.getvalue()
        pedidos = []

        def rango(_url, inicio=None, fin=None, sufijo=None, timeout=180):
            self.assertIsNone(sufijo)
            pedidos.append((inicio, fin))
            parte = crudo[inicio:fin + 1]
            return parte, inicio, len(crudo)

        with patch("pulso.gasto_electoral._rango", side_effect=rango):
            entradas = _directorio_zip_remoto("https://ine.mx/a2.zip")
            anexo = next(e for e in entradas if e["nombre"].endswith(".xlsx"))
            self.assertEqual(_miembro_zip_remoto("https://ine.mx/a2.zip", anexo), b"xlsx minimo")
        self.assertLess(sum(fin - inicio + 1 for inicio, fin in pedidos), len(crudo) * 2)

    def test_prefiere_anexo_principal_sobre_anexo_b(self):
        entradas = [
            {"nombre": "ANEXOS_PAN_BC/Anexo II_B_PAN_BC.xlsx"},
            {"nombre": "ANEXOS_PAN_BC/Anexo II A_PAN_BC.xlsx"},
            {"nombre": "ANEXOS_PAN_BC/Anexo II_PAN_BC.xlsx"},
        ]
        html = b'<a href="CGex202407-22-dp-8-4-a2-01-PAN.zip">PAN</a>'

        with patch("pulso.gasto_electoral._bajar", return_value=html), \
                patch("pulso.gasto_electoral._directorio_zip_remoto",
                      return_value=entradas), \
                patch("pulso.gasto_electoral._miembro_zip_remoto",
                      return_value=b"principal") as miembro:
            anexos = anexos_remotos(
                "https://ine.mx/indice", r"a2-.*\.zip", r"^Anexo II_.*\.xlsx$")

        self.assertEqual(anexos[0][1], "ANEXOS_PAN_BC/Anexo II_PAN_BC.xlsx")
        self.assertEqual(miembro.call_args.args[1]["nombre"],
                         "ANEXOS_PAN_BC/Anexo II_PAN_BC.xlsx")

    def test_acepta_dos_anexos_principales_en_un_zip(self):
        entradas = [
            {"nombre": "08.2 FXMBC/Anexo II_FXMBC_BC.xlsx"},
            {"nombre": "08.1 PES/Anexo II_PES_BC.xlsx"},
        ]
        html = b'<a href="CGex202407-22-dp-8-4-a2-08-PPL.zip">PPL</a>'

        with patch("pulso.gasto_electoral._bajar", return_value=html), \
                patch("pulso.gasto_electoral._directorio_zip_remoto",
                      return_value=entradas), \
                patch("pulso.gasto_electoral._miembro_zip_remoto",
                      side_effect=lambda _url, e: e["nombre"].encode()):
            anexos = anexos_remotos(
                "https://ine.mx/indice", r"a2-.*\.zip", r"^Anexo II_.*\.xlsx$")

        self.assertEqual([a[1] for a in anexos], [
            "08.1 PES/Anexo II_PES_BC.xlsx",
            "08.2 FXMBC/Anexo II_FXMBC_BC.xlsx",
        ])


class TestFinanciamiento(unittest.TestCase):
    def documento(self):
        c = config_minima()
        c["financiamiento"] = {
            "ejercicio": 2026, "corte": "2026-07-03",
            "ordinarias_url": "https://ieebc.mx/ordinario.xlsx",
            "especificas_url": "https://ieebc.mx/especifico.xlsx",
            "acuerdos": [{"id": "IEEBC/CGE37/2026", "fecha": "2026-07-03",
                          "url": "https://ieebc.mx/acuerdo.pdf"}],
            "ajuste_pesbc": {
                "partido": "ENCUENTRO SOLIDARIO BAJA CALIFORNIA",
                "presupuesto_ordinario_vigente": 17,
                "ministrado_enero_mayo": 33,
                "excedente_ministrado": 16,
                "acuerdo_url": "https://ieebc.mx/acuerdo.pdf",
            },
        }
        encabezado = [["PARTIDO POLÍTICO", "MONTO ANUAL"]]
        descargas = {
            c["financiamiento"]["ordinarias_url"]: xlsx(
                encabezado + [["ENCUENTRO SOLIDARIO BAJA CALIFORNIA", "33"]]),
            c["financiamiento"]["especificas_url"]: xlsx(
                encabezado + [["ENCUENTRO SOLIDARIO BAJA CALIFORNIA", "2"]]),
        }
        return c, armar_financiamiento(c, bajar=descargas.__getitem__)

    def test_acuerdo_corrige_xlsx_sin_borrar_lo_ministrado(self):
        _, d = self.documento()
        p = d["partidos"][0]
        self.assertEqual(p["ordinario_original"], 33)
        self.assertEqual(p["ordinario_vigente"], 17)
        self.assertEqual(p["ministrado_enero_mayo"], 33)
        self.assertEqual(p["total_asignado"], 19)
        self.assertEqual(validar_financiamiento_partidos(d)[0], [])

    def test_config_real_fija_247_filas(self):
        with open("config/gasto-electoral.json", encoding="utf-8") as f:
            d = json.load(f)
        self.assertEqual(validar_gasto_electoral_config(d)[0], [])
        self.assertEqual(sum(p["filas_esperadas"] for p in d["procesos"]), 247)

    def test_cifra_faltante_no_se_convierte_en_cero(self):
        c, _ = self.documento()
        url = c["financiamiento"]["especificas_url"]
        descargas = {
            c["financiamiento"]["ordinarias_url"]: xlsx([
                ["PARTIDO POLÍTICO", "MONTO ANUAL"],
                ["ENCUENTRO SOLIDARIO BAJA CALIFORNIA", "33"]]),
            url: xlsx([["PARTIDO POLÍTICO", "MONTO ANUAL"],
                       ["ENCUENTRO SOLIDARIO BAJA CALIFORNIA", ""]]),
        }
        with self.assertRaisesRegex(NoEsDato, "sin monto anual"):
            armar_financiamiento(c, bajar=descargas.__getitem__)


if __name__ == "__main__":
    unittest.main()
