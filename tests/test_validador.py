"""Pruebas del esquema ejecutable.

Lo que se prueba no es que el JSON tenga los campos, sino que las reglas de
campos cruzados atrapen los errores que de verdad ocurren: una ventana de
vigencia mal puesta, una nota editada a mano, una figura que ya no existe.
"""

import copy
import json
import unittest
from datetime import date

from pulso.normalizar import id_nota
from pulso.roster import Roster
from pulso.validador import (
    validar_estado,
    validar_fuentes,
    validar_indicadores,
    validar_medios,
    validar_notas,
    validar_roster,
    validar_todo,
)

HOY = date(2026, 9, 3)


def leer(ruta):
    with open(ruta, encoding="utf-8") as fh:
        return json.load(fh)


class TestConfigPublicada(unittest.TestCase):
    """El roster y el catalogo que se publican tienen que pasar limpios."""

    def test_roster_sin_errores(self):
        errores, _ = validar_roster(leer("config/roster.json"), hoy=HOY)
        self.assertEqual(errores, [])

    def test_medios_sin_errores(self):
        errores, _ = validar_medios(leer("config/medios.json"))
        self.assertEqual(errores, [])

    def test_roster_sin_avisos_de_zona_vencida(self):
        _, avisos = validar_roster(leer("config/roster.json"), hoy=HOY)
        self.assertEqual([a for a in avisos if "vencido" in a], [])

    def test_todo_junto(self):
        errores, _ = validar_todo("config", "data", hoy=HOY)
        self.assertEqual(errores, [])


class TestRosterRoto(unittest.TestCase):
    def setUp(self):
        self.datos = leer("config/roster.json")

    def mutar(self, fid, **cambios):
        d = copy.deepcopy(self.datos)
        for f in d["figuras"]:
            if f["id"] == fid:
                f.update(cambios)
        return d

    def test_ventanas_traslapadas_en_el_mismo_cargo(self):
        # Adelantar la entrada de Gutierrez un dia lo pone a gobernar Tijuana
        # al mismo tiempo que Burgueno: el titular 'alcalde de Tijuana' del
        # 20 de junio quedaria ambiguo.
        d = self.mutar("agc", desde="2026-06-20")
        errores, _ = validar_roster(d, hoy=HOY)
        traslape = [e for e in errores if "traslapadas" in e]
        self.assertEqual(len(traslape), 2)      # dos alias de cargo compartidos
        self.assertIn("agc", traslape[0])
        self.assertIn("ibr", traslape[0])

    def test_el_dia_exacto_del_relevo_no_es_traslape(self):
        errores, _ = validar_roster(self.datos, hoy=HOY)
        self.assertEqual([e for e in errores if "traslapadas" in e], [])

    def test_hasta_anterior_a_desde(self):
        d = self.mutar("ibr", hasta="2024-01-01")
        errores, _ = validar_roster(d, hoy=HOY)
        self.assertTrue(any("posterior a 'desde'" in e for e in errores))

    def test_campo_faltante(self):
        d = copy.deepcopy(self.datos)
        del d["figuras"][0]["partido"]
        errores, _ = validar_roster(d, hoy=HOY)
        self.assertTrue(any("falta 'partido'" in e for e in errores))

    def test_id_duplicado(self):
        d = copy.deepcopy(self.datos)
        d["figuras"].append(copy.deepcopy(d["figuras"][0]))
        errores, _ = validar_roster(d, hoy=HOY)
        self.assertTrue(any("duplicado" in e for e in errores))

    def test_id_con_formato_invalido(self):
        d = self.mutar("agc", id="Abdiel Gutiérrez")
        errores, _ = validar_roster(d, hoy=HOY)
        self.assertTrue(any("'id' invalido" in e for e in errores))

    def test_ambito_desconocido(self):
        d = self.mutar("agc", ambito="Guadalajara")
        errores, _ = validar_roster(d, hoy=HOY)
        self.assertTrue(any("'ambito' desconocido" in e for e in errores))

    def test_alias_nominal_compartido(self):
        # Dos personas con el mismo nombre propio no se pueden desempatar por
        # fecha, asi que es un error de datos, no una ambiguedad tolerable.
        d = copy.deepcopy(self.datos)
        for f in d["figuras"]:
            if f["id"] == "agc":
                f["alias"] = f["alias"] + ["Burgueño"]
        errores, _ = validar_roster(d, hoy=HOY)
        self.assertTrue(any("alias nominal" in e for e in errores))

    def test_fecha_invalida(self):
        d = self.mutar("agc", desde="21/06/2026")
        errores, _ = validar_roster(d, hoy=HOY)
        self.assertTrue(any("'desde' invalido" in e for e in errores))

    def test_avisa_si_una_zona_quedo_sin_titular(self):
        d = self.mutar("mcn", hasta="2026-01-01")
        _, avisos = validar_roster(d, hoy=HOY)
        self.assertTrue(any("San Quintín" in a and "vencido" in a for a in avisos))


class TestMediosRotos(unittest.TestCase):
    def setUp(self):
        self.datos = leer("config/medios.json")

    def test_url_sin_esquema(self):
        d = copy.deepcopy(self.datos)
        d["medios"][0]["url"] = "zetatijuana.com/feed/"
        errores, _ = validar_medios(d)
        self.assertTrue(any("http://" in e for e in errores))

    def test_activo_no_booleano(self):
        d = copy.deepcopy(self.datos)
        d["medios"][0]["activo"] = "si"
        errores, _ = validar_medios(d)
        self.assertTrue(any("booleano" in e for e in errores))

    def test_zona_desconocida(self):
        d = copy.deepcopy(self.datos)
        d["medios"][0]["zona"] = "Sonora"
        errores, _ = validar_medios(d)
        self.assertTrue(any("'zona' desconocida" in e for e in errores))

    def test_tipo_scrapy_exige_selectores(self):
        d = copy.deepcopy(self.datos)
        d["medios"][0]["tipo"] = "scrapy"
        d["medios"][0].pop("scrapy", None)
        errores, _ = validar_medios(d)
        self.assertTrue(any("exige objeto 'scrapy'" in e for e in errores))

    def test_tipo_desconocido(self):
        d = copy.deepcopy(self.datos)
        d["medios"][0]["tipo"] = "navegador"
        errores, _ = validar_medios(d)
        self.assertTrue(any("'tipo' debe ser" in e for e in errores))


class TestNotasRotas(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.roster = Roster.desde_archivo("config/roster.json")
        cls.medios = leer("config/medios.json")["medios"]

    def setUp(self):
        self.datos = leer("data/notas.json")

    def test_datos_publicados_limpios(self):
        errores, _ = validar_notas(self.datos, self.roster, self.medios)
        self.assertEqual(errores, [])

    def test_id_alterado_a_mano(self):
        # El hash se recalcula: no se puede editar un titular y dejar el id.
        d = copy.deepcopy(self.datos)
        d["notas"][0]["titulo"] = d["notas"][0]["titulo"] + " (corregido)"
        errores, _ = validar_notas(d, self.roster, self.medios)
        self.assertTrue(any("no corresponde al hash" in e for e in errores))

    def test_figura_inexistente(self):
        d = copy.deepcopy(self.datos)
        d["notas"][0]["figuras"] = [{"id": "xyz", "via": "nominal", "clave": "x"}]
        errores, _ = validar_notas(d, self.roster, self.medios)
        self.assertTrue(any("no esta en config/roster.json" in e for e in errores))

    def test_fuente_inexistente(self):
        d = copy.deepcopy(self.datos)
        d["notas"][0]["fuente"] = "elpais"
        d["notas"][0]["id"] = id_nota("elpais", d["notas"][0]["titulo"])
        errores, _ = validar_notas(d, self.roster, self.medios)
        self.assertTrue(any("no esta en config/medios.json" in e for e in errores))

    def test_total_desalineado(self):
        d = copy.deepcopy(self.datos)
        d["total"] = d["total"] + 1
        errores, _ = validar_notas(d, self.roster, self.medios)
        self.assertTrue(any("'total'" in e for e in errores))

    def test_via_invalida(self):
        d = copy.deepcopy(self.datos)
        for n in d["notas"]:
            if n["figuras"]:
                n["figuras"][0]["via"] = "adivinada"
                break
        errores, _ = validar_notas(d, self.roster, self.medios)
        self.assertTrue(any("'via' invalida" in e for e in errores))

    def test_postura_con_metodo_apagado(self):
        d = copy.deepcopy(self.datos)
        d["notas"][0]["postura"] = {
            "etiqueta": "favorable", "puntaje": 2,
            "metodo": "ninguno", "version": "0.1.0",
        }
        errores, _ = validar_notas(d, self.roster, self.medios)
        self.assertTrue(any("postura.metodo invalido" in e for e in errores))

    def test_zona_medio_que_no_es_la_del_medio(self):
        d = copy.deepcopy(self.datos)
        d["notas"][0]["zona_medio"] = "Tecate"
        errores, _ = validar_notas(d, self.roster, self.medios)
        self.assertTrue(any("no coincide con la del medio" in e for e in errores))

    def test_alcance_invalido(self):
        d = copy.deepcopy(self.datos)
        d["notas"][0]["alcance"] = "regional"
        errores, _ = validar_notas(d, self.roster, self.medios)
        self.assertTrue(any("'alcance' invalido" in e for e in errores))

    def test_alcance_fuera_no_lleva_zonas(self):
        # Una nota de Hermosillo no puede quedar contada en Tijuana.
        d = copy.deepcopy(self.datos)
        d["notas"][0]["alcance"] = "fuera"
        d["notas"][0]["zonas"] = ["Tijuana"]
        errores, _ = validar_notas(d, self.roster, self.medios)
        self.assertTrue(any("no deberia traer zonas" in e for e in errores))

    def test_alcance_zona_exige_zona(self):
        d = copy.deepcopy(self.datos)
        d["notas"][0]["alcance"] = "zona"
        d["notas"][0]["zonas"] = []
        errores, _ = validar_notas(d, self.roster, self.medios)
        self.assertTrue(any("exige al menos una zona" in e for e in errores))

    def test_zona_desconocida_en_nota(self):
        d = copy.deepcopy(self.datos)
        d["notas"][0]["zonas"] = ["Culiacán"]
        errores, _ = validar_notas(d, self.roster, self.medios)
        self.assertTrue(any("zona desconocida" in e for e in errores))

    def test_delegacion_desconocida(self):
        d = copy.deepcopy(self.datos)
        n = d["notas"][0]
        n["alcance"], n["zonas"], n["delegaciones"] = "zona", ["Tijuana"], ["Otay"]
        errores, _ = validar_notas(d, self.roster, self.medios)
        self.assertTrue(any("delegacion desconocida" in e for e in errores))

    def test_delegacion_exige_tijuana(self):
        d = copy.deepcopy(self.datos)
        n = d["notas"][0]
        n["alcance"], n["zonas"], n["delegaciones"] = "zona", ["Mexicali"], ["Centro"]
        errores, _ = validar_notas(d, self.roster, self.medios)
        self.assertTrue(any("exige 'Tijuana'" in e for e in errores))

    def test_corte_viejo_sin_delegaciones_es_aviso(self):
        # El campo llego despues del primer corte publicado: la clave ausente
        # es aviso, no error, y se agrega en uno solo en vez de uno por nota.
        d = copy.deepcopy(self.datos)
        for n in d["notas"]:
            n.pop("delegaciones", None)
        errores, avisos = validar_notas(d, self.roster, self.medios)
        self.assertEqual(errores, [])
        self.assertEqual(len([a for a in avisos if "delegaciones" in a]), 1)


class TestFuentesYEstado(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.medios = leer("config/medios.json")["medios"]

    def test_publicados_limpios(self):
        e1, _ = validar_fuentes(leer("data/fuentes.json"), self.medios)
        e2, _ = validar_estado(leer("data/estado.json"))
        self.assertEqual(e1, [])
        self.assertEqual(e2, [])

    def test_fallo_sin_motivo(self):
        d = leer("data/fuentes.json")
        d["fuentes"][0]["estado"] = "fallo"
        d["fuentes"][0]["error"] = None
        errores, _ = validar_fuentes(d, self.medios)
        self.assertTrue(any("exige 'error'" in e for e in errores))

    def test_medio_activo_sin_registro_de_salud(self):
        activo = next(m["id"] for m in self.medios if m["activo"])
        d = leer("data/fuentes.json")
        d["fuentes"] = [s for s in d["fuentes"] if s["id"] != activo]
        errores, _ = validar_fuentes(d, self.medios)
        self.assertTrue(any("falta el registro de salud" in e for e in errores))
        self.assertTrue(any(activo in e for e in errores))

    def test_medio_apagado_no_necesita_registro(self):
        # Apagar un medio lo saca del monitoreo; no deja el validador en rojo.
        apagado = next(m["id"] for m in self.medios if not m["activo"])
        d = leer("data/fuentes.json")
        self.assertNotIn(apagado, [s["id"] for s in d["fuentes"]])
        errores, _ = validar_fuentes(d, self.medios)
        self.assertEqual(errores, [])

    def test_version_desalineada(self):
        d = leer("data/estado.json")
        d["pulso_version"] = "0.0.1"
        errores, _ = validar_estado(d)
        self.assertTrue(any("pulso_version" in e for e in errores))

    def test_modo_invalido(self):
        d = leer("data/estado.json")
        d["modo"] = "produccion"
        errores, _ = validar_estado(d)
        self.assertTrue(any("'modo'" in e for e in errores))


PANEL = {
    "esquema": 1,
    "generado": "2026-09-04T00:55:26+00:00",
    "indicadores": {
        "shf": {
            "fuente": "SHF Índice de Precios de la Vivienda",
            "url": "https://example.mx/shf.xlsx",
            "cadencia": "trimestral",
            "familia": "vivienda",
            "aviso": "Índice rebaseado por serie; los niveles no son comparables.",
            "obtenido": "2026-09-04T00:55:26+00:00",
            "series": {
                "Baja California · Tijuana": {
                    "ambito": "municipio",
                    "periodo": "2026-2T",
                    "indice": 248.66,
                    "variacion_anual_pct": 8.64,
                    "trimestres": 3,
                    "serie": [
                        {"periodo": "2025-4T", "indice": 240.1},
                        {"periodo": "2026-1T", "indice": 244.3},
                        {"periodo": "2026-2T", "indice": 248.66},
                    ],
                },
            },
        },
        "predial": {
            "fuente": "SHCP · Impuesto predial municipal",
            "url": "https://example.mx/predial.csv",
            "cadencia": "anual",
            "familia": "suelo",
            "aviso": "Recaudación, NO valuación.",
            "municipios": {
                "San Felipe": {
                    "ciclo": 2024,
                    "por_cuenta_mxn": 2329.68,
                    "cuentas_pagadas": 10949,
                    "variacion_anual_pct": -26.07,
                    "ciclos": 2,
                    "serie": [
                        {"ciclo": 2023, "por_cuenta_mxn": 3151.0, "cuentas_pagadas": 11002},
                        {"ciclo": 2024, "por_cuenta_mxn": 2329.68, "cuentas_pagadas": 10949},
                    ],
                },
            },
        },
        "san_diego": {
            "fuente": "SANDAG · Parcels (valor catastral)",
            "url": "https://geo.sandag.org/",
            "cadencia": "mensual",
            "familia": "vivienda",
            "aviso": "Valor catastral, no de venta. No comparable con el SHF.",
            "zips": {"92173": {"mediana_usd": 281941, "parcelas": 3895}},
        },
    },
}


class TestIndicadoresRotos(unittest.TestCase):
    """El panel de cifras oficiales: cada una tiene que venir rotulada."""

    def test_panel_valido_pasa(self):
        errores, avisos = validar_indicadores(copy.deepcopy(PANEL))
        self.assertEqual(errores, [])
        self.assertEqual(avisos, [])

    def test_el_publicado_no_tiene_errores(self):
        errores, _ = validar_indicadores(leer("data/indicadores.json"))
        self.assertEqual(errores, [])

    def test_indicador_sin_aviso(self):
        # La regla central: una cifra sin rotulo se lee como lo que no es.
        d = copy.deepcopy(PANEL)
        del d["indicadores"]["shf"]["aviso"]
        errores, _ = validar_indicadores(d)
        self.assertTrue(any("aviso" in e for e in errores))

    def test_familia_invalida(self):
        d = copy.deepcopy(PANEL)
        d["indicadores"]["shf"]["familia"] = "precios"
        errores, _ = validar_indicadores(d)
        self.assertTrue(any("familia" in e for e in errores))

    def test_serie_desordenada_es_error(self):
        # Si el orden variara entre corridas, el cron commitearia el mismo
        # dato reacomodado cada seis horas.
        d = copy.deepcopy(PANEL)
        s = d["indicadores"]["shf"]["series"]["Baja California · Tijuana"]["serie"]
        s[0], s[-1] = s[-1], s[0]
        errores, _ = validar_indicadores(d)
        self.assertTrue(any("ordenada" in e for e in errores))

    def test_serie_con_periodo_repetido(self):
        d = copy.deepcopy(PANEL)
        s = d["indicadores"]["shf"]["series"]["Baja California · Tijuana"]["serie"]
        s[1]["periodo"] = s[0]["periodo"]
        errores, _ = validar_indicadores(d)
        self.assertTrue(any("repetido" in e for e in errores))

    def test_serie_que_no_cuadra_con_el_conteo(self):
        d = copy.deepcopy(PANEL)
        d["indicadores"]["shf"]["series"]["Baja California · Tijuana"]["trimestres"] = 86
        errores, _ = validar_indicadores(d)
        self.assertTrue(any("conteo" in e for e in errores))

    def test_ultimo_punto_tiene_que_ser_el_periodo(self):
        d = copy.deepcopy(PANEL)
        d["indicadores"]["shf"]["series"]["Baja California · Tijuana"]["periodo"] = "2026-1T"
        errores, _ = validar_indicadores(d)
        self.assertTrue(any("ultimo punto" in e for e in errores))

    def test_serie_ausente_es_aviso_no_error(self):
        # Los cortes escritos antes de que existiera el campo no la traen.
        d = copy.deepcopy(PANEL)
        del d["indicadores"]["predial"]["municipios"]["San Felipe"]["serie"]
        errores, avisos = validar_indicadores(d)
        self.assertEqual(errores, [])
        self.assertTrue(any("sin 'serie'" in a for a in avisos))

    def test_serie_vacia_si_es_error(self):
        d = copy.deepcopy(PANEL)
        d["indicadores"]["predial"]["municipios"]["San Felipe"]["serie"] = []
        errores, _ = validar_indicadores(d)
        self.assertTrue(any("vacia" in e for e in errores))

    def test_punto_con_campo_no_numerico(self):
        d = copy.deepcopy(PANEL)
        d["indicadores"]["predial"]["municipios"]["San Felipe"]["serie"][0]["por_cuenta_mxn"] = "3151"
        errores, _ = validar_indicadores(d)
        self.assertTrue(any("por_cuenta_mxn" in e for e in errores))

    def test_zip_que_no_es_zip(self):
        d = copy.deepcopy(PANEL)
        d["indicadores"]["san_diego"]["zips"]["9217"] = {"mediana_usd": 1, "parcelas": 1}
        errores, _ = validar_indicadores(d)
        self.assertTrue(any("ZIP" in e for e in errores))

    def test_esquema_equivocado(self):
        d = copy.deepcopy(PANEL)
        d["esquema"] = 2
        errores, _ = validar_indicadores(d)
        self.assertTrue(any("esquema" in e for e in errores))


if __name__ == "__main__":
    unittest.main()
