"""Pruebas de los lectores de indicadores oficiales. Ninguna toca la red.

Se prueban las trampas reales de estas fuentes, cada una descubierta
rompiendose primero: celdas vacias omitidas en XLSX, municipios con coma en
el nombre, dos encodings en el mismo dataset, y paginas de error servidas
con codigo 200.
"""

import io
import json
import os
import re
import tempfile
import unittest
import unittest.mock
import zipfile

from pulso.indicadores import (
    ACS_SUPRIMIDO,
    BC_MUNICIPIOS,
    NoEsDato,
    SinLlave,
    acs,
    _columna,
    _csv_de_zip,
    _filas,
    _num,
    _xlsx_hoja,
    correr,
    predial,
)
from pulso.validador import validar_indicadores

SHEET = """<?xml version="1.0"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>
<row r="1">
 <c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c>
 <c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c>
</row>
<row r="2">
 <c r="A2"><v>1</v></c><c r="D2" t="s"><v>4</v></c>
</row>
<row r="3">
 <c r="A3"><v>2</v></c><c r="B3" t="s"><v>5</v></c><c r="D3" t="s"><v>6</v></c>
</row>
</sheetData></worksheet>"""

CADENAS = """<?xml version="1.0"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="7">
<si><t>Consecutivo</t></si><si><t>Global</t></si>
<si><t>Estado</t></si><si><t>Indice</t></si>
<si><t>Nacional</t></si><si><t>Baja California</t></si><si><t>241.66</t></si>
</sst>"""


def xlsx_falso():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("xl/sharedStrings.xml", CADENAS)
        z.writestr("xl/worksheets/sheet1.xml", SHEET)
    return buf.getvalue()


class TestColumna(unittest.TestCase):
    def test_una_letra(self):
        self.assertEqual(_columna("A1"), 0)
        self.assertEqual(_columna("D7"), 3)

    def test_dos_letras(self):
        self.assertEqual(_columna("AA1"), 26)
        self.assertEqual(_columna("AB12"), 27)

    def test_sin_referencia(self):
        self.assertIsNone(_columna(None))
        self.assertIsNone(_columna(""))


class TestXlsx(unittest.TestCase):
    """La trampa que rompio el lector del SHF la primera vez."""

    def setUp(self):
        self.filas = _xlsx_hoja(xlsx_falso())

    def test_encabezado(self):
        self.assertEqual(self.filas[0][:4],
                         ["Consecutivo", "Global", "Estado", "Indice"])

    def test_celdas_vacias_omitidas_no_corren_los_valores(self):
        # La fila 2 solo trae A y D: en el XML no existen B ni C. Leer en
        # orden de documento pondria 'Nacional' en la columna Global. En el
        # archivo del SHF, Global / Estado / Municipio son mutuamente
        # excluyentes, asi que casi toda fila tiene huecos y el error afecta
        # a todas.
        self.assertEqual(self.filas[1][0], "1")
        self.assertEqual(self.filas[1][1], "")
        self.assertEqual(self.filas[1][2], "")
        self.assertEqual(self.filas[1][3], "Nacional")

    def test_fila_con_hueco_intermedio(self):
        # Fila 3: A, B y D presentes, C ausente.
        self.assertEqual(self.filas[2][1], "Baja California")
        self.assertEqual(self.filas[2][2], "")
        self.assertEqual(self.filas[2][3], "241.66")

    def test_xlsx_sin_hojas_lanza(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            z.writestr("xl/sharedStrings.xml", CADENAS)
        with self.assertRaises(NoEsDato):
            _xlsx_hoja(buf.getvalue())


class TestCsv(unittest.TestCase):
    def test_municipio_con_coma_no_se_parte(self):
        # 'Heroica Villa Tezoatlan de Segura y Luna, Cuna de la
        # Independencia de Oaxaca' es un municipio real. split(',') inventa
        # registros; csv.reader no.
        crudo = ('Año,Municipio,Enero\r\n'
                 '2026,"Tezoatlán de Segura y Luna, Cuna de la Independencia",5\r\n'
                 ).encode("utf-8")
        filas = list(_filas(crudo, "utf-8"))
        self.assertEqual(len(filas), 2)
        self.assertEqual(len(filas[1]), 3)
        self.assertIn("Cuna de la Independencia", filas[1][1])
        self.assertEqual(filas[1][2], "5")

class TestZip(unittest.TestCase):
    def hacer_zip(self, nombres):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            for n in nombres:
                z.writestr(n, "a,b\n1,2\n")
        return buf.getvalue()

    def test_encuentra_por_patron(self):
        crudo = self.hacer_zip(["basura.txt", "RNID-Delitos_Municipal-2026-jul2026.csv"])
        datos, nombre = _csv_de_zip(crudo, r"municipal.*\.csv$")
        self.assertIn("Municipal", nombre)
        self.assertTrue(datos.startswith(b"a,b"))

    def test_encuentra_dentro_de_carpeta(self):
        # La ENSU trae el CSV dentro de subcarpetas.
        crudo = self.hacer_zip(["ensu_2026_2t/conjunto_de_datos/conjunto_de_datos_ensu_cb_0626.csv"])
        _, nombre = _csv_de_zip(crudo, r"ensu_cb_\d+\.csv$")
        self.assertIn("ensu_cb_0626", nombre)

    def test_sin_coincidencia_lanza_y_dice_que_habia(self):
        crudo = self.hacer_zip(["otra_cosa.csv"])
        with self.assertRaises(NoEsDato) as ctx:
            _csv_de_zip(crudo, r"municipal.*\.csv$")
        self.assertIn("otra_cosa.csv", str(ctx.exception))


class TestNum(unittest.TestCase):
    def test_vacio_es_cero(self):
        self.assertEqual(_num(""), 0.0)
        self.assertEqual(_num(None), 0.0)

    def test_texto_no_numerico_es_cero(self):
        # La ENSU y otros usan 'N/E' en periodos sin dato.
        self.assertEqual(_num("N/E"), 0.0)

    def test_numero(self):
        self.assertEqual(_num("241.66"), 241.66)
        self.assertEqual(_num(" 5 "), 5.0)


class TestCatalogoBC(unittest.TestCase):
    def test_los_siete_municipios(self):
        self.assertEqual(len(BC_MUNICIPIOS), 7)
        self.assertEqual(BC_MUNICIPIOS["2004"], "Tijuana")
        self.assertEqual(BC_MUNICIPIOS["2006"], "San Quintín")
        self.assertEqual(BC_MUNICIPIOS["2007"], "San Felipe")

    def test_nombres_coinciden_con_las_zonas_del_producto(self):
        from pulso import ZONAS
        for nombre in BC_MUNICIPIOS.values():
            self.assertIn(nombre, ZONAS, nombre)

class TestFrescura(unittest.TestCase):
    """Estas fuentes son trimestrales o mensuales: bajar 60 MB cada hora
    seria una groseria sin ningun dato nuevo a cambio."""

    def test_se_salta_si_lo_que_hay_esta_fresco(self):
        d = tempfile.mkdtemp()
        with open(os.path.join(d, "indicadores.json"), "w", encoding="utf-8") as fh:
            json.dump({"esquema": 1, "generado": "2026-09-03T00:00:00+00:00",
                       "indicadores": {}, "salud": []}, fh)
        panel, saltado = correr(salida=d, ahora="2026-09-05T00:00:00+00:00",
                                max_edad_dias=7)
        self.assertTrue(saltado)
        self.assertEqual(panel["generado"], "2026-09-03T00:00:00+00:00")

    def test_no_se_salta_si_ya_esta_viejo(self):
        # Sin red la corrida falla, pero lo que se prueba es que NO se salto.
        d = tempfile.mkdtemp()
        with open(os.path.join(d, "indicadores.json"), "w", encoding="utf-8") as fh:
            json.dump({"esquema": 1, "generado": "2026-01-01T00:00:00+00:00",
                       "indicadores": {}, "salud": []}, fh)
        _, saltado = correr(salida=d, ahora="2026-09-05T00:00:00+00:00",
                            max_edad_dias=7, solo=["ninguna_fuente_real"])
        self.assertFalse(saltado)


PREDIAL_CSV_FALSO = (
    "ciclo,entidad_federativa,municipio,cuentas_pagadas,monto_predial\n"
    # Desordenado a proposito: la fuente no garantiza orden y la serie si.
    "2024,Baja California,Tijuana,380393,1211447000\n"
    "2022,Baja California,Tijuana,360000,900000000\n"
    "2023,Baja California,Tijuana,370000,1050000000\n"
    # San Felipe es municipio nuevo: su serie arranca despues que la de
    # Tijuana, asi que el año no se puede inferir de la posicion.
    "2024,Baja California,San Felipe,10949,25505000\n"
    "2023,Baja California,San Felipe,11002,34667000\n"
    "2024,Sonora,Hermosillo,100000,200000000\n"
).encode("utf-8")


class TestSeriePersistida(unittest.TestCase):
    """La serie completa tiene que llegar a disco.

    Los 86 trimestres del SHF y los 15 ciclos del predial se calculaban y se
    tiraban, dejando un solo punto por geografia. Con eso no se puede
    contestar 'tendencias a la alza o a la baja', que es lo que pedia el
    encargo.
    """

    def setUp(self):
        parche = unittest.mock.patch("pulso.indicadores._bajar",
                                     return_value=PREDIAL_CSV_FALSO)
        parche.start()
        self.addCleanup(parche.stop)

    def test_predial_persiste_la_serie_completa(self):
        p = predial()
        tj = p["municipios"]["Tijuana"]
        self.assertEqual(tj["ciclos"], 3)
        self.assertEqual(len(tj["serie"]), 3)
        self.assertEqual([x["ciclo"] for x in tj["serie"]], [2022, 2023, 2024])

    def test_cada_punto_lleva_su_ciclo_explicito(self):
        # San Felipe arranca en 2023 y Tijuana en 2022: la posicion en la
        # lista no dice de que año es el punto.
        sf = predial()["municipios"]["San Felipe"]["serie"]
        self.assertEqual([x["ciclo"] for x in sf], [2023, 2024])
        self.assertEqual(sf[0]["ciclo"], 2023)

    def test_el_ultimo_punto_coincide_con_el_resumen(self):
        tj = predial()["municipios"]["Tijuana"]
        self.assertEqual(tj["serie"][-1]["ciclo"], tj["ciclo"])
        self.assertEqual(tj["serie"][-1]["por_cuenta_mxn"], tj["por_cuenta_mxn"])

    def test_no_se_cuela_otra_entidad(self):
        self.assertNotIn("Hermosillo", predial()["municipios"])


def acs_respuesta(anio):
    """Respuesta del ACS con la forma real: encabezado y filas de texto."""
    filas = [["B25064_001E", "B25064_001M", "zip code tabulation area"]]
    base = {"92173": 1400, "92104": 1700, "92118": 2600}
    for cp, renta in base.items():
        # Sube ~4% al año para que la variacion sea comprobable.
        v = int(renta * (1.04 ** (anio - 2021)))
        filas.append([str(v), "95", cp])
    # City Heights viene SUPRIMIDO: el censo no manda null, manda el
    # centinela. Sumarlo como monto da rentas negativas de nueve digitos.
    filas.append([str(ACS_SUPRIMIDO), str(ACS_SUPRIMIDO), "92105"])
    return json.dumps(filas).encode("utf-8")


class TestAcs(unittest.TestCase):
    """Renta mediana del ACS: la unica fuente con nivel de renta real."""

    def setUp(self):
        self.anios = [2021, 2022, 2023]
        parche = unittest.mock.patch(
            "pulso.indicadores._bajar",
            side_effect=lambda url, **kw: acs_respuesta(
                int(re.search(r"/data/(\d{4})/", url).group(1))))
        parche.start()
        self.addCleanup(parche.stop)

    def panel(self):
        return acs(anios=self.anios, llave="falsa",
                   zips={"92173": "San Ysidro", "92104": "North Park",
                         "92118": "Coronado", "92105": "City Heights"})

    def test_sin_llave_falla_antes_de_salir_a_la_red(self):
        # Sin llave la API responde 200 con una pagina HTML 'Missing Key',
        # asi que descubrirlo al parsear seria tarde y confuso.
        with unittest.mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(SinLlave) as ctx:
                acs(anios=[2023])
        self.assertIn("CENSUS_API_KEY", str(ctx.exception))

    def test_serie_por_zip_ordenada_y_completa(self):
        z = self.panel()["zips"]["92173"]
        self.assertEqual(z["anios"], 3)
        self.assertEqual([p["anio"] for p in z["serie"]], [2021, 2022, 2023])
        self.assertEqual(z["nombre"], "San Ysidro")

    def test_el_centinela_de_supresion_no_se_toma_como_renta(self):
        self.assertNotIn("92105", self.panel()["zips"])

    def test_variacion_anual_sobre_el_año_previo(self):
        z = self.panel()["zips"]["92173"]
        self.assertAlmostEqual(z["variacion_anual_pct"], 4.0, delta=0.3)

    def test_trae_el_margen_de_error(self):
        # Es muestra probabilistica: sin margen, dos ZIP parecen distintos
        # cuando no lo son.
        self.assertEqual(self.panel()["zips"]["92118"]["serie"][0]["margen_usd"], 95)

    def test_declara_que_no_se_compara_con_catastral_ni_shf(self):
        p = self.panel()
        self.assertIn("catastral", p["universo"].lower())
        self.assertIn("shf", p["universo"].lower())

    def test_un_año_caido_no_tumba_la_serie(self):
        def a_veces(url, **kw):
            anio = int(re.search(r"/data/(\d{4})/", url).group(1))
            if anio == 2022:
                raise NoEsDato("pagina de error con 200")
            return acs_respuesta(anio)
        with unittest.mock.patch("pulso.indicadores._bajar", side_effect=a_veces):
            p = self.panel()
        self.assertEqual(p["zips"]["92173"]["anios"], 2)
        self.assertEqual([f["anio"] for f in p["anios_sin_dato"]], [2022])

    def test_si_no_hay_ni_un_zip_lanza(self):
        with unittest.mock.patch("pulso.indicadores._bajar",
                                 side_effect=NoEsDato("todo mal")):
            with self.assertRaises(NoEsDato):
                self.panel()

    def test_el_panel_pasa_el_validador(self):
        p = self.panel()
        p["familia"] = "renta"
        p["obtenido"] = "2026-09-07T00:00:00+00:00"
        errores, _ = validar_indicadores({
            "esquema": 1, "generado": "2026-09-07T00:00:00+00:00",
            "indicadores": {"acs": p},
        })
        self.assertEqual(errores, [])


class TestSalidaPublicada(unittest.TestCase):
    """Lo que hay commiteado en data/indicadores.json."""

    @classmethod
    def setUpClass(cls):
        with open(os.path.join("data", "indicadores.json"), encoding="utf-8") as fh:
            cls.panel = json.load(fh)

    def test_shf_declara_los_municipios_que_no_cubre(self):
        shf = self.panel["indicadores"].get("shf")
        if not shf:
            self.skipTest("sin datos del SHF")
        for z in ("Ensenada", "Tecate", "Playas de Rosarito", "San Quintín"):
            self.assertIn(z, shf["sin_cobertura"])

    def test_shf_no_publica_niveles_como_comparables(self):
        shf = self.panel["indicadores"].get("shf")
        if not shf:
            self.skipTest("sin datos del SHF")
        self.assertIn("comparable", shf["aviso"].lower())

    def test_ensu_declara_que_solo_cubre_dos_ciudades(self):
        ensu = self.panel["indicadores"].get("ensu")
        if not ensu:
            self.skipTest("sin datos de la ENSU")
        self.assertEqual(sorted(ensu["ciudades"]), ["Mexicali", "Tijuana"])
        self.assertIn("Ensenada", ensu["cobertura"])

    def test_sesnsp_trae_los_siete_municipios(self):
        s = self.panel["indicadores"].get("sesnsp")
        if not s:
            self.skipTest("sin datos del SESNSP")
        for nombre in BC_MUNICIPIOS.values():
            self.assertIn(nombre, s["municipios"], nombre)

    def test_sesnsp_aclara_que_son_delitos_reportados(self):
        s = self.panel["indicadores"].get("sesnsp")
        if not s:
            self.skipTest("sin datos del SESNSP")
        self.assertIn("REPORTADOS", s["aviso"])

    def test_predial_cubre_las_zonas_que_el_shf_no_ve(self):
        p = self.panel["indicadores"].get("predial")
        if not p:
            self.skipTest("sin datos de predial")
        for z in ("Ensenada", "Tecate", "Playas de Rosarito", "San Quintín"):
            self.assertIn(z, p["municipios"], z)

    def test_predial_aclara_que_no_es_valuacion(self):
        p = self.panel["indicadores"].get("predial")
        if not p:
            self.skipTest("sin datos de predial")
        self.assertIn("valuación", p["aviso"])

    def test_san_diego_aclara_que_no_es_precio_de_mercado(self):
        sd = self.panel["indicadores"].get("san_diego")
        if not sd:
            self.skipTest("sin datos de San Diego")
        self.assertIn("Proposición 13", sd["aviso"])
        self.assertIn("venta", sd["faltantes"])


if __name__ == "__main__":
    unittest.main()
