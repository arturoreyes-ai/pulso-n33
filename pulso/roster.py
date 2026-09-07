"""Resolucion de figuras publicas con ventanas de vigencia.

Los cargos cambian a media administracion. Tijuana es el caso testigo: el
alcalde Ismael Burgueno se fue de licencia indefinida y su suplente Abdiel
Gutierrez tomo el cargo a las 00:00 del 21 de junio de 2026. Una lista de
nombres fija habria atribuido semanas de cobertura a la persona equivocada.

De ahi que haya dos clases de alias, tratadas distinto:

  alias        nombre propio. NO depende de la fecha: si el titular dice
               'Burgueno', la nota habla de Burgueno aunque ya no gobierne.
  alias_cargo  titulo del puesto ('alcalde de Tijuana'). SI depende de la
               fecha: resuelve a quien estaba en funciones ese dia.

El prototipo distinguia las dos por subcadena ("alcalde" in clave), y esa
lista omitia 'presidenta municipal', asi que las alcaldesas se resolvian
sin importar la fecha. Aqui la distincion es explicita en los datos.
"""

import json
from datetime import date, datetime
from typing import NamedTuple

from .normalizar import fold


class Hit(NamedTuple):
    figura_id: str
    clave: str
    via: str          # 'nominal' | 'cargo'


def _fecha(s):
    return datetime.strptime(s, "%Y-%m-%d").date()


class Roster:
    def __init__(self, figuras, verificado=None):
        self.verificado = verificado
        self.figuras = []
        for f in figuras:
            g = dict(f)
            nominales = [f["nombre"]] + list(f.get("alias") or [])
            # Claves mas largas primero: el nombre completo le gana al
            # apellido, para que 'clave' reporte el empate mas especifico.
            g["_nominal"] = sorted(
                {fold(k) for k in nominales if fold(k)}, key=len, reverse=True
            )
            g["_cargo"] = sorted(
                {fold(k) for k in (f.get("alias_cargo") or []) if fold(k)},
                key=len,
                reverse=True,
            )
            g["_desde"] = _fecha(f["desde"])
            g["_hasta"] = _fecha(f["hasta"]) if f.get("hasta") else date.max
            self.figuras.append(g)

    @classmethod
    def desde_archivo(cls, ruta):
        with open(ruta, encoding="utf-8") as fh:
            datos = json.load(fh)
        return cls(datos["figuras"], datos.get("verificado"))

    def vigente(self, figura, cuando):
        """Ventana semiabierta [desde, hasta): 'hasta' es exclusivo.

        Burgueno con hasta=2026-06-21 y Gutierrez con desde=2026-06-21 no se
        traslapan; el dia 21 ya es de Gutierrez.
        """
        return figura["_desde"] <= cuando < figura["_hasta"]

    def por_id(self, figura_id):
        for f in self.figuras:
            if f["id"] == figura_id:
                return f
        return None

    def vigentes(self, cuando):
        return [f for f in self.figuras if self.vigente(f, cuando)]

    def match(self, titulo, cuando):
        """Figuras en el titular. El nombre propio le gana al cargo."""
        t = fold(titulo)
        hits, nominales = [], set()

        for f in self.figuras:                 # 1) nombre propio: sin fecha
            for k in f["_nominal"]:
                if k in t:
                    hits.append(Hit(f["id"], k, "nominal"))
                    nominales.add(f["id"])
                    break

        for f in self.figuras:                 # 2) por cargo: con fecha
            if f["id"] in nominales:
                continue
            for k in f["_cargo"]:
                if k in t and self.vigente(f, cuando):
                    hits.append(Hit(f["id"], k, "cargo"))
                    break
        return hits
