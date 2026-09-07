import unittest

from pulso.delegaciones import (
    delegaciones_en,
    normalizar_delegacion,
    parsear_directorio,
    resolver_delegaciones,
)


class DelegacionesTest(unittest.TestCase):
    def test_parsea_directorio_y_no_inventa_la_792(self):
        html = """
        <h4>Información Delegación La Presa</h4><ol><li>Villa Fontana I</li><li>Hacienda Las Fuentes</li></ol>
        <h4>Información Delegación Presa Este</h4><ol><li>Hacienda Las Fuentes</li></ol>
        """
        dato = parsear_directorio(html)
        self.assertEqual(dato["enumeradas"], 3)
        self.assertEqual(dato["declaradas"], 792)
        self.assertEqual(dato["delegaciones"]["La Presa A.L.R."], ["Villa Fontana I", "Hacienda Las Fuentes"])

    def test_normaliza_nombres_historicos(self):
        casos = {
            "La Presa": "La Presa A.L.R.", "Presa Este": "La Presa Este",
            "Mesa de Otay Centenario": "Otay Centenario", "Sanchez Taboada": "Sánchez Taboada",
            "Centro": "Centro", "Cerro Colorado": "Cerro Colorado", "La Mesa": "La Mesa",
            "Playas de Tijuana": "Playas de Tijuana", "San Antonio de los Buenos": "San Antonio de los Buenos",
        }
        for nombre, esperado in casos.items():
            with self.subTest(nombre=nombre):
                self.assertEqual(normalizar_delegacion(nombre), esperado)

    def test_contexto_y_directo_y_ambiguedad(self):
        catalogo = {"delegaciones": [
            {"nombre": "La Mesa", "colonias": [{"nombre": "Praderas de la Mesa", "modo": "omitido"},
                                                   {"nombre": "Camino Real", "modo": "contextual"}],
             "alias_directos": []},
            {"nombre": "Sánchez Taboada", "colonias": [{"nombre": "Camino Verde", "modo": "contextual"}],
             "alias_directos": []},
        ]}
        self.assertEqual(delegaciones_en("Colonia Camino Real" , catalogo), ["La Mesa"])
        self.assertEqual(delegaciones_en("Camino Real" , catalogo), [])
        self.assertEqual(delegaciones_en("Camino Verde" , catalogo), [])
        self.assertEqual(delegaciones_en("Delegación La Mesa" , catalogo), ["La Mesa"])
        self.assertEqual(delegaciones_en("Colonia Praderas de la Mesa", catalogo), [])

    def test_conflictos_de_tabla_se_resuelven_con_oficial(self):
        self.assertEqual(delegaciones_en("Fundadores"), ["Centro"])
        self.assertEqual(delegaciones_en("Colonia Salvatierra"), ["San Antonio de los Buenos"])
        self.assertEqual(delegaciones_en("Colinas de California"), ["San Antonio de los Buenos"])
        self.assertEqual(delegaciones_en("Alamar"), ["Otay Centenario"])
        self.assertEqual(delegaciones_en("El Florido"), [])
        self.assertEqual(delegaciones_en("Hacienda Las Fuentes"), [])
