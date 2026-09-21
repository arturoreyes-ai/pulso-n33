"""El informe en PDF de un termino: modelo puro, una sola salida de red, codigos de la ruta y un PDF real. Offline."""
from pathlib import Path
import shutil
import subprocess
import unittest

RAIZ = Path(__file__).resolve().parents[1]


class TestInformeWeb(unittest.TestCase):
    @unittest.skipUnless(shutil.which("node") and (RAIZ / "web/node_modules/takumi-pdf").exists(), "Requiere dependencias web")
    def test_contrato_offline(self):
        resultado = subprocess.run(["node", "scripts/probar-informe.cjs"], cwd=RAIZ / "web", capture_output=True, text=True, encoding="utf-8", timeout=60)
        self.assertEqual(resultado.returncode, 0, resultado.stdout + resultado.stderr)
