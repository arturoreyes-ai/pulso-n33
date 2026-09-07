"""Ventana reciente y archivo mensual de notas.

El problema: `correr()` fusionaba por id y nunca tiraba nada, asi que
data/notas.json crecia sin limite. Medido: 506 bytes por nota y unas 200
notas nuevas al dia, o sea ~35 MB al ano, y el tablero se los bajaba todos
en cada visita.

La forma de la solucion:

    data/notas.json                  ventana reciente (30 dias por omision)
    data/archivo/notas-AAAA-MM.json  registros completos, uno por mes
    data/archivo/indice.json         que meses existen y cuantas notas traen

Tres decisiones que conviene entender antes de tocar esto:

**Un solo esquema de nota.** La ventana y los archivos guardan exactamente
los mismos campos. Recortar campos en la ventana ahorraria un 20% y costaria
dos caminos en el validador y una bifurcacion en docs/datos.md. No vale la
pena: este JSON comprime ~7x y el servidor manda brotli, asi que una ventana
de 30 dias son ~2.9 MB en crudo pero unos 400 KB en el cable.

**Se relee y se reresuelve TODO en cada corrida**, ventana y archivos. Es lo
que sostiene la propiedad de que editar el roster o el gazetero se propaga al
historico sin migracion. El costo es leer todo el historico cada vez, que a
50 mil notas es un par de segundos.

**Solo se escribe el archivo que cambio.** Sin esto, reresolver todo
reescribiria cada mes en cada corrida y el repo se llenaria de commits que
solo cambian el orden de las llaves. `escribir_si_cambio()` compara los bytes
que va a escribir contra los que ya estan.
"""

import os
import re
from datetime import datetime, timedelta

RETENCION_DIAS = 30

# El validador tolera un dia extra en la ventana: la corrida puede cruzar la
# medianoche entre que particiona y que escribe.
GRACIA_DIAS = 1

_RE_MES = re.compile(r"^notas-(\d{4}-\d{2})\.json$")


def fecha_de(valor):
    """date desde 'AAAA-MM-DD' (o el prefijo de un ISO), o None."""
    try:
        return datetime.strptime(str(valor)[:10], "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def edad_de(nota):
    """Fecha con la que se decide si una nota ya envejecio.

    'fecha' manda. 'capturado' es el respaldo para las notas cuyo feed no
    trajo fecha usable: sin el, una nota sin fecha se quedaria en la ventana
    para siempre y la acumulacion volveria por la puerta de atras, que es el
    mismo problema que el archivo existe para resolver, solo mas chico.
    """
    return fecha_de(nota.get("fecha")) or fecha_de(nota.get("capturado"))


def mes_de(nota):
    f = edad_de(nota)
    return f.strftime("%Y-%m") if f else None


def dir_archivo(salida):
    return os.path.join(salida, "archivo")


def ruta_mes(salida, mes):
    return os.path.join(dir_archivo(salida), "notas-{}.json".format(mes))


def ruta_indice(salida):
    return os.path.join(dir_archivo(salida), "indice.json")


def meses_en_disco(salida):
    """Meses archivados, por lo que hay en la carpeta, no por el indice.

    El disco manda: si el indice y los archivos no coinciden, el validador lo
    reporta en vez de que el pipeline confie en un indice viejo.
    """
    d = dir_archivo(salida)
    if not os.path.isdir(d):
        return []
    salida_meses = []
    for nombre in sorted(os.listdir(d)):
        m = _RE_MES.match(nombre)
        if m:
            salida_meses.append(m.group(1))
    return salida_meses


def orden(nota):
    """Clave de orden estable. La misma para la ventana y para los archivos."""
    return (nota.get("fecha") or "", nota.get("publicado") or "", nota["id"])


def leer_todo(salida, leer):
    """Todas las notas conocidas por id: ventana mas archivos.

    `leer` es la funcion de lectura tolerante del pipeline. Si hay un id en
    los dos lados gana el de la ventana, que es el que se acaba de fusionar.
    """
    notas = {}
    for mes in meses_en_disco(salida):
        for n in leer(ruta_mes(salida, mes), {}).get("notas", []):
            if n.get("id"):
                notas[n["id"]] = n
    for n in leer(os.path.join(salida, "notas.json"), {}).get("notas", []):
        if n.get("id"):
            notas[n["id"]] = n
    return notas


def particionar(notas, hoy, retener=RETENCION_DIAS):
    """(ventana, {mes: [notas]}) segun la antiguedad de cada nota.

    El corte es inclusivo: una nota de exactamente `retener` dias se queda en
    la ventana. Una nota con fecha futura, por un feed mal fechado, tambien se
    queda: no tiene sentido crear un mes en el futuro.

    Las notas sin fecha usable envejecen por 'capturado' (ver `edad_de`), y se
    archivan en el mes en que se capturaron. Si no envejecieran, se
    acumularian en la ventana sin limite.
    """
    corte = hoy - timedelta(days=retener)
    ventana, por_mes = [], {}
    for n in notas:
        f = edad_de(n)
        if f is None or f > hoy or f >= corte:
            ventana.append(n)
        else:
            por_mes.setdefault(f.strftime("%Y-%m"), []).append(n)
    ventana.sort(key=orden, reverse=True)
    for mes in por_mes:
        por_mes[mes].sort(key=orden, reverse=True)
    return ventana, por_mes


def indice_de(por_mes, esquema=1):
    """Indice del archivo: que meses hay, cuantas notas y que rango cubren."""
    meses = []
    for mes in sorted(por_mes, reverse=True):
        notas = por_mes[mes]
        fechas = [f.isoformat() for f in (edad_de(n) for n in notas) if f]
        meses.append({
            "mes": mes,
            "notas": len(notas),
            "desde": min(fechas) if fechas else None,
            "hasta": max(fechas) if fechas else None,
            "archivo": "notas-{}.json".format(mes),
        })
    return {
        "esquema": esquema,
        "total": sum(m["notas"] for m in meses),
        "meses": meses,
    }


def escribir_archivos(salida, por_mes, escribir_si_cambio, esquema=1):
    """Escribe los meses que cambiaron mas el indice. Devuelve (indice, escritos).

    Los meses que ya no tienen notas se borran, para que el indice y el disco
    no se separen. Eso solo pasa si se acorta la retencion o se corrige una
    fecha, no en la operacion normal.
    """
    os.makedirs(dir_archivo(salida), exist_ok=True)
    escritos = []
    for mes, notas in sorted(por_mes.items()):
        datos = {"esquema": esquema, "mes": mes, "total": len(notas), "notas": notas}
        if escribir_si_cambio(ruta_mes(salida, mes), datos):
            escritos.append(mes)

    for mes in meses_en_disco(salida):
        if mes not in por_mes:
            os.remove(ruta_mes(salida, mes))

    indice = indice_de(por_mes, esquema)
    escribir_si_cambio(ruta_indice(salida), indice)
    return indice, escritos


def para_temas(ventana, por_mes, hoy, ventana_dias=7):
    """Notas suficientes para que los temas tengan con que comparar.

    `temas()` mide momento contra la ventana anterior, asi que necesita el
    doble del periodo que reporta. Si la ventana de retencion ya lo cubre no
    hace falta tocar el archivo; si no, se suma el mes mas reciente.
    """
    necesario = hoy - timedelta(days=ventana_dias * 2)
    mas_viejo = min((fecha_de(n.get("fecha")) or hoy for n in ventana), default=hoy)
    if mas_viejo <= necesario or not por_mes:
        return ventana
    reciente = max(por_mes)
    return ventana + por_mes[reciente]
