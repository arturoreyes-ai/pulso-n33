"""Alta inicial reproducible del piloto; no consulta ni adivina paginas."""
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
roster = json.loads((RAIZ / "config/roster.json").read_text(encoding="utf-8"))
gasto = json.loads((RAIZ / "data/gasto-electoral.json").read_text(encoding="utf-8"))
INE = {"ibr": "pelo-2024-21138", "nabm": "pelo-2024-21139", "cam": "pelo-2024-21140",
       "ram": "pelo-2024-21146", "rcm": "pelo-2024-21137", "mcn": "pelo-2024-21091",
       "jld": "pelo-2024-21161", "jarp": "pef-2024-9003"}
filas = [dict(p, roster_id=p["id"]) for p in roster["figuras"]]
filas.append({"id": "jarp", "roster_id": None, "nombre": "Julieta Andrea Ramírez Padilla",
              "cargo": "Senadora por Baja California", "partido": "Morena", "ambito": "estatal"})
personas = []
for p in filas:
    fila = {k: p[k] for k in ("id", "roster_id", "nombre", "cargo", "partido", "ambito")}
    fila.update(pagina=None, ine=None, nota="Página pendiente de verificación; no equivale a ausencia de anuncios.")
    if p["id"] in INE:
        c = next(c for c in gasto["candidaturas"] if c["id"] == INE[p["id"]])
        proceso = next(x for x in gasto["procesos"] if x["id"] == c["proceso"])
        fila["ine"] = {"id": c["id"], "nombre": c["nombre"], "cargo": c["cargo"],
                       "contienda": c["contienda"], "verificado": "2026-09-21",
                       "fuentes": [proceso["dictamen_url"]],
                       "razon": "Identidad revisada por nombre completo, cargo y contienda del registro conciliado del INE."}
    if p["id"] == "jarp":
        fila["pagina"] = {"id": "257333027729841", "nombre": "Julieta Ramírez",
                          "url": "https://www.facebook.com/JulietaRamirezP",
                          "verificado": "2026-09-21",
                          "fuentes": ["https://morena.senado.gob.mx/ramirez-padilla-julieta-andrea/",
                                      "https://www.te.gob.mx/sentenciasHTML/convertir/expediente/SRE-PSD-0027-2021-"],
                          "razon": "El directorio del Senado enlaza el perfil y la sentencia identifica el id numérico del mismo perfil."}
        fila["nota"] = "Caso solicitado por el cliente. Ads, About y Audience leídos públicamente el 21 de septiembre de 2026."
    if p["id"] == "mpao":
        fila["pagina"] = {"id": "1515259965437204", "nombre": "Marina del Pilar",
                          "url": "https://www.facebook.com/MarinadelpilarBc",
                          "verificado": "2026-09-21",
                          "fuentes": ["https://transparenciaieebc.mx/files/83m/acuerdos/res16_2021_CQyD.pdf"],
                          "razon": "El acta del IEEBC identifica nombre, handle e id de biblioteca; falta sondeo actual antes de cosechar."}
    personas.append(fila)
config = {"nota": "Piloto manual solicitado el 21-09-2026: nueve figuras del roster más Julieta. Las relaciones son explícitas y documentadas; no se infieren del pagador. Sin programación ni proveedor de pago.",
          "desde": "2024-01-01", "respetar_robots": True, "excepcion_robots": None,
          "personas": sorted(personas, key=lambda p: p["id"])}
ruta = RAIZ / "config/publicidad-meta.json"
if ruta.exists():
    raise SystemExit("El catálogo ya existe: no sobrescribir verificaciones posteriores.")
ruta.write_text(json.dumps(config, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
