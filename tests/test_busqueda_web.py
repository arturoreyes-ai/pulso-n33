"""La actualidad de Google es en vivo y va en el orden de Google; el contrato web no la reordena ni la confunde con notas."""
from pathlib import Path
import shutil
import subprocess
import unittest

RAIZ = Path(__file__).resolve().parents[1]

class TestBusquedaWeb(unittest.TestCase):
    @unittest.skipUnless(shutil.which("node") and (RAIZ / "web/node_modules/typescript").exists(), "Requiere dependencias web")
    def test_contrato_offline(self):
        resultado = subprocess.run(["node", "scripts/probar-busqueda.cjs"], cwd=RAIZ / "web", capture_output=True, text=True, encoding="utf-8", timeout=30)
        self.assertEqual(resultado.returncode, 0, resultado.stdout + resultado.stderr)
