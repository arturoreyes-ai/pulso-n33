"""El recorrido /ahora encadena listas en vivo sin reordenarlas ni repetir titulares. Offline."""
import pathlib
import shutil
import subprocess
import unittest

RAIZ = pathlib.Path(__file__).resolve().parents[1]

class TestCapitulosWeb(unittest.TestCase):
    @unittest.skipUnless(shutil.which("node") and (RAIZ / "web/node_modules/typescript").exists(), "Requiere dependencias web")
    def test_contrato(self):
        resultado = subprocess.run(["node", "scripts/probar-capitulos.cjs"], cwd=RAIZ / "web", capture_output=True, text=True, encoding="utf-8", timeout=30)
        self.assertEqual(resultado.returncode, 0, resultado.stdout + resultado.stderr)
