"""La busqueda de Redes por termino: eleccion del termino, filas de tres redes y filtro por texto. Offline."""
from pathlib import Path
import shutil
import subprocess
import unittest

RAIZ = Path(__file__).resolve().parents[1]


class TestConsultasWeb(unittest.TestCase):
    @unittest.skipUnless(shutil.which("node") and (RAIZ / "web/node_modules/typescript").exists(), "Requiere dependencias web")
    def test_contrato_offline(self):
        resultado = subprocess.run(["node", "scripts/probar-consultas.cjs"], cwd=RAIZ / "web", capture_output=True, text=True, encoding="utf-8", timeout=30)
        self.assertEqual(resultado.returncode, 0, resultado.stdout + resultado.stderr)
