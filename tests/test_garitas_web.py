"""CBP publica ceros y huecos distintos; el contrato web no debe confundirlos."""
from pathlib import Path
import shutil
import subprocess
import unittest

RAIZ = Path(__file__).resolve().parents[1]

class TestGaritasWeb(unittest.TestCase):
    @unittest.skipUnless(shutil.which("node") and (RAIZ / "web/node_modules/typescript").exists(), "Requiere dependencias web")
    def test_contrato_offline(self):
        resultado = subprocess.run(["node", "scripts/probar-garitas.cjs"], cwd=RAIZ / "web", capture_output=True, text=True, encoding="utf-8", timeout=30)
        self.assertEqual(resultado.returncode, 0, resultado.stdout + resultado.stderr)
