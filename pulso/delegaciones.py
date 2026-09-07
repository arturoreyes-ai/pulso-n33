"""Catalogo oficial de colonias y resolucion de delegaciones de Tijuana.

La pagina de territorio de IMPLAN es la autoridad para nombres actuales. El
catalogo versionado en ``config/delegaciones-tijuana.json`` es un snapshot de
esa pagina; este modulo tambien contiene el parser para regenerarlo sin
depender de BeautifulSoup.
"""

import html
import json
import re
from datetime import datetime
from urllib.request import Request, urlopen
from html.parser import HTMLParser
from pathlib import Path

from . import DELEGACIONES_TIJUANA
from .normalizar import fold

DIRECTORIO_URL = "https://implan.tijuana.gob.mx/indicadores/territorio.aspx"
MAPA_ARCGIS_ITEM = "https://www.arcgis.com/home/item.html?id=3db7ce3e475348e1b640fcd045d62901"
DECLARADAS_IMPLAN = 792

_CTX_RE = re.compile(
    r"(?:^|[^a-z0-9])(?:colonia|col\.?|fraccionamiento|fracc\.?|residencial|"
    r"seccion|sección|delegacion|delegación|unidad|parque industrial|"
    r"conjunto|barrio)\s+(?:de\s+)?$"
)
_TOKEN_RE = re.compile(r"(?<![a-z0-9]){}(?![a-z0-9])")


class _DirectorioParser(HTMLParser):
    """Extrae h4 de delegacion y los li de su ol siguiente."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.delegacion = None
        self.en_lista = False
        self.en_li = False
        self.en_h4 = False
        self._texto = []
        self.resultado = {}

    def handle_starttag(self, tag, attrs):
        if tag == "h4":
            self._texto = []
            self.en_h4 = True
        elif tag == "ol" and self.delegacion:
            self.en_lista = True
        elif tag == "li" and self.en_lista:
            self.en_li = True
            self._texto = []

    def handle_endtag(self, tag):
        if tag == "h4":
            raw = " ".join(self._texto).strip()
            m = re.search(r"informaci[oó]n\s+delegaci[oó]n\s+(.+)$", raw, re.I)
            self.delegacion = normalizar_delegacion(m.group(1)) if m else None
            if self.delegacion:
                self.resultado.setdefault(self.delegacion, [])
            self._texto = []
            self.en_h4 = False
        elif tag == "li" and self.en_li:
            nombre = " ".join(self._texto).strip()
            if nombre and self.delegacion:
                self.resultado.setdefault(self.delegacion, []).append(nombre)
            self.en_li = False
            self._texto = []
        elif tag == "ol":
            self.en_lista = False

    def handle_data(self, data):
        if self.en_li or self.en_h4:
            self._texto.append(data)


def normalizar_delegacion(nombre):
    """Convierte nombres históricos del mapa 2014 al contrato público actual."""
    k = fold(html.unescape(nombre or ""))
    aliases = {
        "la presa": "La Presa A.L.R.",
        "presa este": "La Presa Este",
        "mesa de otay centenario": "Otay Centenario",
        "otay centenario": "Otay Centenario",
        "rodolfo sanchez taboada": "Sánchez Taboada",
        "sanchez taboada": "Sánchez Taboada",
        "san antonio de los buenos": "San Antonio de los Buenos",
    }
    for canonical in DELEGACIONES_TIJUANA:
        aliases.setdefault(fold(canonical), canonical)
    return aliases.get(k, (nombre or "").strip())


def parsear_directorio(contenido):
    """Devuelve el snapshot enumerado y la discrepancia declarada por IMPLAN."""
    parser = _DirectorioParser()
    parser.feed(contenido or "")
    delegaciones = {d: list(dict.fromkeys(xs)) for d, xs in parser.resultado.items()
                    if d in DELEGACIONES_TIJUANA}
    # Un HTML futuro puede cambiar el orden; el contrato usa siempre el orden
    # del tablero y no el orden accidental de la pagina.
    delegaciones = {d: delegaciones.get(d, []) for d in DELEGACIONES_TIJUANA}
    enumeradas = sum(len(xs) for xs in delegaciones.values())
    candidatos = [int(x) for x in re.findall(
        r"(?:se compone|integrada por|conformada por)[^0-9]{0,80}(\d{2,4})",
        html.unescape(contenido or ""), re.I)]
    candidatos = [x for x in candidatos if 500 <= x <= 1000]
    declaradas = candidatos[0] if candidatos else DECLARADAS_IMPLAN
    return {"delegaciones": delegaciones, "enumeradas": enumeradas,
            "declaradas": declaradas}


def _config_path(path=None):
    return Path(path or "config/delegaciones-tijuana.json")


def cargar_catalogo(path=None):
    """Carga el snapshot local. Un archivo ausente no rompe el modo legacy."""
    try:
        with _config_path(path).open(encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


def _entradas(catalogo):
    salida = {}
    for bloque in (catalogo or {}).get("delegaciones", []):
        d = bloque.get("nombre")
        for item in bloque.get("colonias", []):
            if isinstance(item, str):
                nombre, modo = item, "contextual"
            else:
                nombre, modo = item.get("nombre", ""), item.get("modo", "contextual")
            if nombre:
                salida.setdefault(fold(nombre), []).append((d, modo, nombre))
    return salida


def _aliases(catalogo):
    salida = {}
    for bloque in (catalogo or {}).get("delegaciones", []):
        d = bloque.get("nombre")
        for alias in bloque.get("alias_directos", []):
            if alias:
                salida[fold(alias)] = d
    return salida


def resolver_delegaciones(texto, catalogo=None):
    """Devuelve ``[(delegacion, modo, termino)]`` de forma determinista.

    ``modo`` es ``directo`` para un alias revisado o ``contextual`` cuando la
    colonia debe aparecer junto a ``colonia``, ``fraccionamiento``, ``seccion``
    u otra palabra calificadora. Las entradas ambiguas se omiten.
    """
    t = fold(texto)
    if not t:
        return []
    for termino in ("otay mesa",):
        t = re.sub(_TOKEN_RE.pattern.format(re.escape(termino)), " ", t)
    catalogo = catalogo or cargar_catalogo()
    encontrados = {}
    # Alias exactos de alta confianza y las delegaciones/landmarks heredados.
    for alias, d in _aliases(catalogo).items():
        if re.search(_TOKEN_RE.pattern.format(re.escape(alias)), t):
            encontrados[d] = ("directo", alias)
            t = re.sub(_TOKEN_RE.pattern.format(re.escape(alias)), " ", t)
    # Compatibilidad con titulares anteriores a la existencia del snapshot.
    legacy = {
        "la presa este": "La Presa Este", "presa este": "La Presa Este",
        "playas de tijuana": "Playas de Tijuana", "delegacion playas": "Playas de Tijuana",
        "zona centro": "Centro", "centro de tijuana": "Centro", "zona rio": "Centro",
        "zona urbana rio": "Centro", "zona norte de tijuana": "Centro",
        "el chaparral": "Centro", "garita el chaparral": "Centro",
        "avenida revolucion": "Centro", "av. revolucion": "Centro",
        "cerro colorado": "Cerro Colorado", "delegacion la mesa": "La Mesa",
        "delegacion de la mesa": "La Mesa", "presa abelardo": "La Presa A.L.R.",
        "presa abelardo l rodriguez": "La Presa A.L.R.", "abelardo l rodriguez": "La Presa A.L.R.",
        "presa rodriguez": "La Presa A.L.R.", "la presa": "La Presa A.L.R.",
        "san antonio de los buenos": "San Antonio de los Buenos",
        "sanchez taboada": "Sánchez Taboada", "otay": "Otay Centenario",
        "mesa de otay": "Otay Centenario", "garita de otay": "Otay Centenario",
        "garita otay": "Otay Centenario", "aeropuerto de tijuana": "Otay Centenario",
        "aeropuerto internacional de tijuana": "Otay Centenario",
    }
    for alias, d in legacy.items():
        if d in encontrados:
            continue
        if re.search(_TOKEN_RE.pattern.format(re.escape(alias)), t):
            encontrados[d] = ("directo", alias)
            t = re.sub(_TOKEN_RE.pattern.format(re.escape(alias)), " ", t)
    # Colonias oficiales. Ambiguas exactas (dos delegaciones) no se inventan.
    for key, filas in _entradas(catalogo).items():
        delegs = {d for d, _, _ in filas}
        if len(delegs) != 1:
            continue
        d, modo, original = filas[0]
        p = _TOKEN_RE.pattern.format(re.escape(key))
        m = re.search(p, t)
        if not m:
            continue
        if modo == "omitido":
            continue
        if modo != "directo":
            prefijo = t[max(0, m.start() - 45):m.start()]
            if not _CTX_RE.search(prefijo):
                continue
        encontrados.setdefault(d, (modo, original))
    orden = {d: i for i, d in enumerate(DELEGACIONES_TIJUANA)}
    return [(d, modo, termino) for d, (modo, termino) in sorted(
        encontrados.items(), key=lambda kv: orden.get(kv[0], 99))]


def delegaciones_en(texto, catalogo=None):
    return [d for d, _, _ in resolver_delegaciones(texto, catalogo)]


def tiene_delegacion_directa(texto, catalogo=None):
    return any(modo == "directo" for _, modo, _ in resolver_delegaciones(texto, catalogo))


def _red(url):
    req = Request(url, headers={"User-Agent": "PulsoN33-delegaciones/1"})
    with urlopen(req, timeout=30) as response:
        raw = response.read()
        charset = response.headers.get_content_charset()
    # El ASP.NET histórico de IMPLAN declara ISO-8859-1 aunque algunos
    # proxies omiten el charset; ArcGIS sí entrega UTF-8.
    if charset is None and "implan.tijuana.gob.mx" in url:
        charset = "latin1"
    return raw.decode(charset or "utf-8", "replace")


def _svg_paths(arcgis):
    """Reduce los anillos oficiales a coordenadas deterministas de viewBox."""
    layers = arcgis.get("operationalLayers", [])
    layer = next((x for x in layers if x.get("title") == "DELEGACIONES"), None)
    if not layer:
        return {"viewBox": "0 0 1000 620", "paths": {}}
    fs = layer.get("featureCollection", {}).get("layers", [{}])[0].get("featureSet", {})
    features = fs.get("features", [])
    puntos = [p for f in features for ring in f.get("geometry", {}).get("rings", []) for p in ring]
    if not puntos:
        return {"viewBox": "0 0 1000 620", "paths": {}}
    minx, maxx = min(p[0] for p in puntos), max(p[0] for p in puntos)
    miny, maxy = min(p[1] for p in puntos), max(p[1] for p in puntos)
    aliases = {"La Presa": "La Presa A.L.R.", "Presa Este": "La Presa Este",
               "Mesa de Otay Centenario": "Otay Centenario",
               "Sanchez Taboada": "Sánchez Taboada", "Rodolfo Sanchez Taboada": "Sánchez Taboada",
               "Rodolfo Sánchez Taboada": "Sánchez Taboada"}
    out = {}
    for feature in features:
        attrs = feature.get("attributes", {})
        nombre = aliases.get(attrs.get("DELEGACIO_"), attrs.get("DELEGACIO_"))
        ring = feature.get("geometry", {}).get("rings", [[]])[0]
        arr = [[round((p[0] - minx) / (maxx - minx) * 1000, 1),
                round(620 - (p[1] - miny) / (maxy - miny) * 620, 1)]
               for p in ring[::3]]
        if arr and arr[-1] != arr[0]:
            arr.append(arr[0])
        out[nombre] = arr
    return {"viewBox": "0 0 1000 620", "paths": out}


def actualizar_catalogo(config_path=None, mapa_path="web/src/lib/dominio/delegaciones-mapa.ts"):
    """Refresca directorio y polígonos; es una operación explícita, no del cron."""
    ruta = _config_path(config_path)
    anterior = cargar_catalogo(ruta) or {"delegaciones": [], "conflictos": []}
    snapshot = parsear_directorio(_red(DIRECTORIO_URL))
    prev = {b.get("nombre"): b for b in anterior.get("delegaciones", [])}
    counts = {}
    for names in snapshot["delegaciones"].values():
        for name in names:
            counts[fold(name)] = counts.get(fold(name), 0) + 1
    bloques = []
    for nombre, names in snapshot["delegaciones"].items():
        old = prev.get(nombre, {})
        bloques.append({"nombre": nombre, "slug": old.get("slug", fold(nombre).replace(" ", "-")),
                        "colonias": [{"nombre": n, "modo": "omitido" if counts[fold(n)] > 1 else "contextual"}
                                     for n in names],
                        "hitos": old.get("hitos", []), "alias_directos": old.get("alias_directos", [])})
    nuevo = dict(anterior)
    nuevo.update({"actualizado": datetime.now().date().isoformat(),
                  "fuentes": {**(anterior.get("fuentes") or {}),
                              "directorio": {"url": DIRECTORIO_URL,
                                             "fecha_corte": datetime.now().date().isoformat(),
                                             "declaradas": snapshot["declaradas"],
                                             "enumeradas": snapshot["enumeradas"]}},
                  "delegaciones": bloques})
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(nuevo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    mapa = _svg_paths(json.loads(_red("https://www.arcgis.com/sharing/rest/content/items/3db7ce3e475348e1b640fcd045d62901/data?f=json")))
    destino = Path(mapa_path)
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text("/** Polígonos oficiales IMPLAN 2014, reducidos para render SVG. */\n"
                       "export const MAPA_DELEGACIONES = " + json.dumps(mapa, ensure_ascii=False, indent=2)
                       + " as const;\n", encoding="utf-8")
    return {"enumeradas": snapshot["enumeradas"], "declaradas": snapshot["declaradas"],
            "mapa_poligonos": len(mapa["paths"]), "config": str(ruta), "mapa": str(destino)}
