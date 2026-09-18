"""CLI: correr | validar | sitio | evaluar.

  python -m pulso correr [--sin-red] [--descubrimiento-web] [--salida data] [--metodo ninguno|diccionario|modelo]
  python -m pulso delegaciones --actualizar
  python -m pulso conversacion [--sentimiento ninguno|modelo]
  python -m pulso redes [--posts N] [--comentarios N]
  python -m pulso tiktok [--videos N] [--comentarios N] [--probar]
  python -m pulso tendencias [--probar] [--ubicaciones]
  python -m pulso gasto-electoral [--solo-financiamiento]
  python -m pulso apify [--verificar]
  python -m pulso validar [--config config] [--datos data]
  python -m pulso sitio [--destino _site]
  python -m pulso evaluar [--corpus tests/fixtures/corpus.json]
"""

import argparse
import json
import os
import sys
from datetime import datetime

from . import VERSION
from .archivo import RETENCION_DIAS
from .clasificar import METODOS, diccionario
from .roster import Roster

RUTA_CORPUS = os.path.join("tests", "fixtures", "corpus.json")


def _leer(ruta):
    with open(ruta, encoding="utf-8") as fh:
        return json.load(fh)


MIN_RETENCION = 14   # temas() mide momento contra el periodo anterior: 7 + 7


def cmd_correr(args):
    from .pipeline import correr

    if args.retener_dias < MIN_RETENCION:
        print("--retener-dias {} es menor que {}: temas() mide momento contra el\n"
              "periodo anterior, asi que con menos historia todo saldria 'subiendo'."
              .format(args.retener_dias, MIN_RETENCION), file=sys.stderr)
        return 1

    roster = Roster.desde_archivo(os.path.join(args.config, "roster.json"))
    medios = _leer(os.path.join(args.config, "medios.json"))["medios"]
    corpus = _leer(args.corpus) if args.sin_red else None
    # Opcional: un checkout sin el archivo tiene que seguir corriendo, igual
    # que data/ ausente no es error para el validador. No hay bandera para
    # apagarlo porque el interruptor por renglon ya existe: 'activo': false.
    ruta_bq = os.path.join(args.config, "busquedas.json")
    busquedas = _leer(ruta_bq) if os.path.exists(ruta_bq) else None

    estado = correr(
        medios=medios,
        roster=roster,
        salida=args.salida,
        sin_red=args.sin_red,
        busquedas=busquedas,
        corpus=corpus,
        metodo=args.metodo,
        retener_dias=args.retener_dias,
        descubrimiento_web=args.descubrimiento_web,
    )

    print("modo {} · postura {} · fuentes {} ok / {} fallo".format(
        estado["modo"], estado["metodo_postura"],
        estado["fuentes_ok"], estado["fuentes_fallo"],
    ))
    print("ventana {} dias: {} notas ({} nuevas) · archivo: {} notas en {} meses · total {}".format(
        estado["ventana_dias"], estado["notas_ventana"], estado["notas_nuevas"],
        estado["notas_archivadas"], estado["archivos"], estado["notas_total"],
    ))
    for s in _leer(os.path.join(args.salida, "fuentes.json"))["fuentes"]:
        marca = "ok  " if s["estado"] == "ok" else "FALLO"
        detalle = "{} notas, {} nuevas, {} ms".format(s["obtenidas"], s["nuevas"], s["ms"])
        if s["estado"] != "ok":
            detalle = s["error"] or "sin motivo"
        print("  {:<5} {:<20} {}".format(marca, s["nombre"][:20], detalle))

    # Apagon total: la corrida se marca en rojo. Un fallo parcial es normal
    # y queda visible en data/fuentes.json.
    if estado["modo"] == "red" and estado["fuentes_ok"] == 0:
        print("\nninguna fuente respondio", file=sys.stderr)
        return 2
    return 0


def cmd_comunicados(args):
    from .comunicados import correr, leer_fuente
    from .pipeline import ahora_utc
    fuente = leer_fuente(os.path.join(args.config, "comunicados.json"))
    datos = correr(fuente, args.salida, ahora_utc(), sin_red=args.sin_red)
    print("comunicados: {} · {} titulares{}".format(
        datos["estado"], len(datos["comunicados"]),
        " · " + datos["error"] if datos["error"] else ""))
    # El fallo municipal queda en su panel y no bloquea la prensa.
    return 0


def cmd_delegaciones(args):
    from .delegaciones import actualizar_catalogo

    resultado = actualizar_catalogo(
        os.path.join(args.config, "delegaciones-tijuana.json"),
        args.mapa,
    )
    print("directorio IMPLAN: {} enumeradas / {} declaradas".format(
        resultado["enumeradas"], resultado["declaradas"]))
    print("polígonos SVG: {} · {}".format(resultado["mapa_poligonos"], resultado["mapa"]))
    return 0


def cmd_conversacion(args):
    """Cosecha comentarios de YouTube y escribe SOLO las metricas derivadas.

    El texto crudo queda en cache/ (ignorado por git) con TTL de 30 dias.
    Ver el encabezado de pulso/conversacion.py para el porque.
    """
    from .pipeline import ahora_utc, _escribir
    from .conversacion import cosechar, derivar, leer_cache

    roster = Roster.desde_archivo(os.path.join(args.config, "roster.json"))
    canales = _leer(os.path.join(args.config, "canales.json"))["canales"]
    temas_doc = _leer(args.temas)
    temas_busqueda = (temas_doc.get("temas") or []) if isinstance(temas_doc, dict) else []
    ahora = ahora_utc()

    n, salud, cuentas = cosechar(
        canales, ahora,
        videos_por_canal=args.videos,
        comentarios_por_video=args.comentarios,
        cache=args.cache,
        temas_busqueda=temas_busqueda,
        temas_por_corrida=args.temas_busqueda,
        videos_por_tema=args.videos_tema,
    )

    sin_llave = all(s["estado"] == "sin_llave" for s in salud) if salud else False

    # El sentimiento se etiqueta EN EL CACHE, comentario por comentario, y a
    # data/ solo llegan conteos. Ver pulso/sentimiento.py para lo que mide.
    etiquetados = 0
    if args.sentimiento == "modelo":
        from .sentimiento import Analizador
        from .conversacion import clasificar_cache
        etiquetados = clasificar_cache(args.cache, Analizador())

    vigentes = leer_cache(args.cache)
    panel = derivar(vigentes, roster, ahora, salud, cuentas)
    _escribir(os.path.join(args.salida, "conversacion.json"), panel)

    print("comentarios cosechados: {} · vigentes en cache: {}".format(n, len(vigentes)))
    s = panel["sentimiento"]
    if s["metodo"] == "modelo":
        print("sentimiento ({}): {} positivos, {} negativos, {} neutrales, {} sin clasificar; "
              "{} etiquetados en esta corrida".format(
                  s["modelo"], s["positivo"], s["negativo"], s["neutral"],
                  s["sin_clasificar"], etiquetados))
    else:
        print("sentimiento: apagado (--sentimiento modelo para encenderlo)")
    print("cuota: {}/{} unidades".format(
        cuentas["presupuesto"]["gastado"], cuentas["presupuesto"]["tope"]))
    busqueda = cuentas.get("busqueda") or {}
    if busqueda:
        gasto_busqueda = busqueda["presupuesto"]
        print("busquedas tematicas: {}/{} llamadas".format(
            gasto_busqueda["gastado"], gasto_busqueda["tope"]))
        for tema in busqueda.get("temas") or []:
            detalle = ("{} videos, {} comentarios".format(
                tema["videos"], tema["comentarios"]
            ) if tema["estado"] == "ok" else (tema["error"] or "")[:70])
            print("  {:<9} {:<26} {}".format(
                tema["estado"], tema["tema"][:26], detalle
            ))
    for s in salud:
        marca = {"ok": "ok   ", "sin_llave": "SIN LLAVE", "cuota": "CUOTA",
                 "omitido": "omit ", "fallo": "FALLO"}.get(s["estado"], s["estado"])
        detalle = ("{} videos, {} comentarios".format(s["videos"], s["comentarios"])
                   if s["estado"] == "ok" else (s["error"] or "")[:70])
        print("  {:<9} {:<26} {}".format(marca, s["nombre"][:26], detalle))

    if sin_llave:
        print("\nSin YOUTUBE_API_KEY no hay conversacion que medir. El tablero")
        print("muestra prensa sin comentarios, que es degradacion esperada.")
        return 0
    return 0


def cmd_indicadores(args):
    """Precios de vivienda y suelo, crimen y percepcion, de fuentes oficiales."""
    from .indicadores import correr

    panel, saltado = correr(
        salida=args.salida,
        max_edad_dias=args.max_edad,
        forzar=args.forzar,
        solo=args.solo or None,
    )
    if saltado:
        print("sin cambios: lo que hay tiene menos de {} dias. --forzar para bajar de nuevo."
              .format(args.max_edad))
        return 0

    for s in panel["salud"]:
        marca = "ok   " if s["estado"] == "ok" else "FALLO"
        detalle = (s["periodo"] or "sin periodo") if s["estado"] == "ok" else s["error"][:78]
        print("  {} {:<11} {:<9} {}".format(marca, s["id"], "{} ms".format(s["ms"]), detalle))

    ind = panel["indicadores"]
    if "shf" in ind:
        print("\nvivienda (variacion anual del indice SHF):")
        for k, v in sorted(ind["shf"]["series"].items()):
            if v["variacion_anual_pct"] is not None:
                print("  {:<28} {:>7.2f}%  ({})".format(k, v["variacion_anual_pct"], v["periodo"]))
    if "ensu" in ind:
        print("\npercepcion de inseguridad (ENSU):")
        for k, v in sorted(ind["ensu"]["ciudades"].items()):
            print("  {:<28} {:>5}%".format(k, v["pct_inseguro"]))
        print("  {:<28} {:>5}%".format("Nacional", ind["ensu"]["nacional"]["pct_inseguro"]))
    if "sesnsp" in ind:
        print("\ncrimen reportado en {} (acumulado del ano):".format(ind["sesnsp"]["periodo"]))
        for k, v in sorted(ind["sesnsp"]["municipios"].items(), key=lambda kv: -kv[1]["total"]):
            print("  {:<28} {:>7}".format(k, v["total"]))
    if "predial" in ind:
        print("\npredial por cuenta pagada (proxy de suelo, {}):".format(ind["predial"]["periodo"]))
        for k, v in sorted(ind["predial"]["municipios"].items(),
                           key=lambda kv: -kv[1]["por_cuenta_mxn"]):
            print("  {:<28} {:>10,.0f} MXN".format(k, v["por_cuenta_mxn"]))

    fallos = [s for s in panel["salud"] if s["estado"] == "fallo"]
    return 0 if not fallos else 0


def cmd_redes(args):
    """Cosecha comentarios de Instagram y escribe SOLO conteos derivados.

    El texto crudo queda en cache/instagram (ignorado por git, TTL de 30
    dias) y la identidad de quien comento no llega ni ahi: se tira al
    ingerir. Ver el encabezado de pulso/instagram.py.
    """
    from .apify import Presupuesto
    from .instagram import (cosechar, derivar, leer_cache, leer_publicaciones,
                            publicar_comentarios, sondear)
    from .pipeline import ahora_utc, _escribir

    cfg = _leer(os.path.join(args.config, "instagram.json"))

    # --sondear no cosecha ni escribe data/: solo pregunta si el handle es el
    # medio. Cuesta un resultado por cuenta. Ver instagram.sondear().
    if args.sondear:
        handles = args.sondear if args.sondear != ["*"] else [
            c["handle"] for c in cfg["cuentas"] if c.get("handle")]
        print("{:<24} {:>9} {:>7}  {:<9} {}".format(
            "handle", "seguidores", "posts", "veredicto", "nombre / bio"))
        for s in sondear(handles):
            print("{:<24} {:>9} {:>7}  {:<9} {} · {}".format(
                s["handle"], s["seguidores"] if s["seguidores"] is not None else "-",
                s["posts"] if s["posts"] is not None else "-",
                s["veredicto"], s["nombre"], s["bio"]))
        print("\nvivo = publica de verdad · ocupado = handle apartado sin publicar")
        print("Lee la bio antes de marcar verificado: la región no se deduce del "
              "handle (@afnoticias es de Tocantins, Brasil).")
        return 0
    cuentas = cfg.get("cuentas", [])
    cosecha = cfg.get("cosecha", {})
    apify_cfg = _leer(os.path.join(args.config, "apify.json"))
    # El config manda para el cron; --presupuesto es para una corrida
    # exploratoria a mano, donde interesa barrer hondo una vez y no cuatro
    # veces al dia.
    tope = args.presupuesto or (
        apify_cfg.get("presupuesto") or {}).get("resultados_por_corrida", 300)
    ahora = ahora_utc()

    sin_verificar = [c["id"] for c in cuentas if c.get("activo") and not c.get("verificado")]
    if sin_verificar:
        print("aviso: {} cuenta(s) activas sin verificar, se omiten: {}".format(
            len(sin_verificar), ", ".join(sin_verificar)), file=sys.stderr)
        print("       abre cada handle, confirma que es el medio, y pon "
              "\"verificado\": true en config/instagram.json", file=sys.stderr)

    nuevos, salud, gasto = cosechar(
        cuentas, ahora,
        presupuesto=Presupuesto(tope),
        cache=args.cache,
        posts_por_cuenta=args.posts or cosecha.get("posts_por_cuenta", 5),
        comentarios_por_post=args.comentarios or cosecha.get("comentarios_por_post", 15),
    )

    # El tono se etiqueta EN EL CACHE, comentario por comentario; a data/ solo
    # llegan conteos. Ver pulso/sentimiento.py para lo que mide de verdad.
    etiquetados = omitidos = 0
    if args.sentimiento == "modelo":
        from .sentimiento import Analizador
        from .instagram import clasificar_cache
        etiquetados, omitidos = clasificar_cache(args.cache, Analizador())

    temas_doc = _leer(args.temas) if os.path.exists(args.temas) else {}
    vigentes = leer_cache(args.cache)
    panel = derivar(vigentes, ahora, salud, gasto, temas_doc.get("temas") or [],
                    leer_publicaciones(args.cache), cuentas,
                    ventana_horas=cosecha.get("ventana_horas", 24))
    _escribir(os.path.join(args.salida, "redes.json"), panel)

    # El texto de los comentarios sale a data/ junto al resto de la corrida,
    # pero NUNCA a git: .gitignore lo excluye por nombre
    # (data/*-comentarios.json) y se regenera aqui en cada corrida desde el
    # cache, asi que la retencion de 30 dias sigue siendo ejecutable. Hasta el
    # 17 de septiembre de 2026 vivio en efimero/, una carpeta aparte. Ver el
    # encabezado de pulso/instagram.py y la regla en pulso/validador.py.
    publicados = 0
    if not args.sin_texto:
        texto = publicar_comentarios(vigentes, panel["destacados"], ahora)
        _escribir(os.path.join(args.salida, "redes-comentarios.json"), texto)
        publicados = sum(len(v) for v in texto["por_post"].values())

    print("comentarios nuevos: {} · vigentes en cache: {} · posts: {}".format(
        len(nuevos), panel["comentarios_vigentes"], panel["posts_vigentes"]))
    print("destacados: {} en las últimas {} horas · comentarios publicados: {} ({}, fuera de git)".format(
        len(panel["destacados"]), panel["ventana_horas"], publicados,
        os.path.join(args.salida, "redes-comentarios.json") if not args.sin_texto else "--sin-texto"))
    print("gasto Apify: {} de {} resultados".format(gasto["gastado"], gasto["resultados"]))
    sen = panel["sentimiento"]
    if sen["metodo"] == "modelo":
        print("tono ({}): {} positivos · {} negativos · {} neutrales · {} sin clasificar"
              " · {} sin modelo por idioma; {} etiquetados ahora".format(
                  sen["modelo"], sen["positivo"], sen["negativo"], sen["neutral"],
                  sen["sin_clasificar"], sen["sin_modelo_idioma"], etiquetados))
    print("opinión {} · reacciones {} · repetidos {}".format(
        panel["opinion"], panel["reacciones"], panel["repetidos"]))
    for s in salud:
        if s["estado"] != "ok":
            print("  {} · {} · {}".format(s["cuenta"], s["estado"],
                                          s.get("error", "")[:120]), file=sys.stderr)
    return 0


def cmd_tiktok(args):
    """Busca videos de TikTok, cosecha sus comentarios y escribe conteos.

    Espejo de cmd_redes con una fuente distinta: una BUSQUEDA, no cuentas
    verificadas. La zona de cada video sale de su pie (pulso/zonas.py), nunca
    de la consulta. El texto de los comentarios va a data/, fuera de git;
    la identidad de quien comenta no llega ni al cache; el @handle del
    creador si se publica. Ver el encabezado de pulso/tiktok.py.
    """
    from .apify import Presupuesto
    from .tiktok import (cosechar, derivar, leer_cache, leer_publicaciones, probar,
                         publicar_comentarios)
    from .pipeline import ahora_utc, _escribir

    cfg = _leer(os.path.join(args.config, "tiktok.json"))
    busquedas = cfg.get("busquedas", [])
    cosecha = cfg.get("cosecha", {})
    filtro_fecha = cosecha.get("filtro_fecha", "PAST_24_HOURS")
    orden = cosecha.get("orden", "MOST_RELEVANT")
    ahora = ahora_utc()

    # --probar no cosecha comentarios ni escribe nada: tres videos por
    # busqueda para leer que devuelve el filtro y como quedan zona y titulo.
    if args.probar:
        for r in probar(busquedas, ahora, filtro_fecha=filtro_fecha, orden=orden):
            print("{}  ({} videos; descartes: {})".format(
                r["busqueda"], len(r["videos"]),
                ", ".join("{} {}".format(k, v) for k, v in r["descartes"].items()) or "ninguno"))
            for v in r["videos"]:
                print("  {}  {:<22} {:<9} {:>6} likes  {}".format(
                    v["publicado"], v["creador"][:22], v["zona"], v["likes"], v["titulo"][:70]))
        print("\nLa ventana de derivar() recorta a 'ventana_horas' aunque el filtro traiga "
              "mas. Anota la fecha en 'verificado' del config.")
        return 0

    apify_cfg = _leer(os.path.join(args.config, "apify.json"))
    tope = args.presupuesto or cosecha.get("presupuesto_resultados") or (
        apify_cfg.get("presupuesto") or {}).get("resultados_por_corrida", 300)

    nuevos, salud, gasto = cosechar(
        busquedas, ahora,
        presupuesto=Presupuesto(tope),
        cache=args.cache,
        videos_por_busqueda=args.videos or cosecha.get("videos_por_busqueda", 30),
        comentarios_por_video=args.comentarios or cosecha.get("comentarios_por_video", 30),
        filtro_fecha=filtro_fecha,
        orden=orden,
    )

    etiquetados = omitidos = 0
    if args.sentimiento == "modelo":
        from .sentimiento import Analizador
        from .tiktok import clasificar_cache
        etiquetados, omitidos = clasificar_cache(args.cache, Analizador())

    temas_doc = _leer(args.temas) if os.path.exists(args.temas) else {}
    vigentes = leer_cache(args.cache)
    panel = derivar(vigentes, ahora, salud, gasto, temas_doc.get("temas") or [],
                    leer_publicaciones(args.cache), busquedas,
                    ventana_horas=cosecha.get("ventana_horas", 24))
    _escribir(os.path.join(args.salida, "tiktok.json"), panel)

    publicados = 0
    if not args.sin_texto:
        texto = publicar_comentarios(vigentes, panel["destacados"], ahora)
        _escribir(os.path.join(args.salida, "tiktok-comentarios.json"), texto)
        publicados = sum(len(v) for v in texto["por_post"].values())

    print("comentarios nuevos: {} · vigentes en cache: {} · videos: {}".format(
        len(nuevos), panel["comentarios_vigentes"], panel["posts_vigentes"]))
    print("destacados: {} en las últimas {} horas · comentarios publicados: {} ({}, fuera de git)"
          .format(len(panel["destacados"]), panel["ventana_horas"], publicados,
                  os.path.join(args.salida, "tiktok-comentarios.json")
                  if not args.sin_texto else "--sin-texto"))
    print("gasto Apify: {} de {} resultados".format(gasto["gastado"], gasto["resultados"]))
    sen = panel["sentimiento"]
    if sen["metodo"] == "modelo":
        print("tono ({}): {} positivos · {} negativos · {} neutrales · {} sin clasificar"
              " · {} sin modelo por idioma; {} etiquetados ahora".format(
                  sen["modelo"], sen["positivo"], sen["negativo"], sen["neutral"],
                  sen["sin_clasificar"], sen["sin_modelo_idioma"], etiquetados))
    for s in salud:
        if s["estado"] != "ok":
            print("  {} · {} · {}".format(s["cuenta"], s["estado"],
                                          s.get("error", "")[:120]), file=sys.stderr)
        elif s.get("fuera") or s.get("descartados"):
            print("  {} · fuera de la región: {} · descartados: {}".format(
                s["cuenta"], s.get("fuera", 0), s.get("descartados", 0)), file=sys.stderr)
    return 0


def cmd_youtube(args):
    """Shorts y videos de YouTube por feed publico. No cuesta nada.

    Tercera plataforma de la familia redes y la unica sin factura: lee dos
    listas Atom por canal, sin llave y sin cuota. No cosecha comentarios -- el
    feed no los trae -- asi que el documento sale con `cosecha_comentarios`
    en false, que es lo que impide leer sus ceros como una medicion. La zona
    de cada pieza sale de su titulo y su descripcion, nunca de la fila del
    canal: ver el encabezado de pulso/youtube.py, donde El Vigia lo demuestra
    con numeros.
    """
    from .youtube import cosechar, derivar, probar
    from .pipeline import ahora_utc, _escribir

    cfg = _leer(os.path.join(args.config, "youtube.json"))
    canales = cfg.get("canales", [])
    cosecha = cfg.get("cosecha", {})
    ventana = cosecha.get("ventana_horas", 24)
    piezas = args.piezas or max(cosecha.get("shorts_por_canal", 15),
                                cosecha.get("videos_por_canal", 15))
    ahora = ahora_utc()

    if args.probar:
        for fila in probar([c for c in canales if c.get("activo")], ahora):
            print("\n{} ({}, ámbito {})".format(fila["nombre"], fila["cuenta"], fila["ambito"]))
            for p in fila["piezas"]:
                print("  {:>8} vistas · {:<6} · {:<14} · {}".format(
                    p["reproducciones"], p["formato"], p["zona"], p["titulo"][:56]))
            if fila["descartes"]:
                print("  descartes: {}".format(fila["descartes"]))
        return 0

    publicaciones, salud = cosechar(canales, ahora, cache=args.cache, piezas=piezas)
    panel = derivar(ahora, salud, publicaciones, canales, ventana_horas=ventana)
    _escribir(os.path.join(args.salida, "youtube.json"), panel)

    formatos = {}
    for d in panel["destacados"]:
        formatos[d["formato"]] = formatos.get(d["formato"], 0) + 1
    # `posts_vigentes` cuenta los que tienen comentarios, asi que aqui es
    # siempre 0 y no se imprime: diria "ninguna pieza vigente" sobre un panel
    # lleno. Lo que informa es cuantas hay en el catalogo y cuantas se cortaron.
    print("piezas en catálogo: {} · destacados: {} en las últimas {} horas ({})".format(
        len(publicaciones), len(panel["destacados"]), panel["ventana_horas"],
        " · ".join("{} {}".format(n, f) for f, n in sorted(formatos.items())) or "ninguno"))
    print("sin comentarios: el feed público no los trae (cosecha_comentarios: false)")
    for s in salud:
        if s["estado"] != "ok":
            print("  {} · {} · {}".format(s["cuenta"], s["estado"],
                                          s.get("nota") or s.get("error", "")[:120]),
                  file=sys.stderr)
        elif s.get("fuera") or s.get("descartados") or s.get("reclasificados"):
            print("  {} · fuera de la región: {} · descartados: {} · reclasificados: {}".format(
                s["cuenta"], s.get("fuera", 0), s.get("descartados", 0),
                s.get("reclasificados", 0)), file=sys.stderr)
    return 0


def cmd_tendencias(args):
    """Tendencias de X por ubicacion: el ranking de X, sin sesion y sin tuits.

    Una sola llamada al actor por corrida cubre todas las ubicaciones activas
    de config/tendencias.json. Escribe data/tendencias.json con el nombre, el
    puesto y la liga de cada tendencia; nunca un tuit ni quien lo escribio.
    Ver el encabezado de pulso/tendencias.py.
    """
    from .apify import Presupuesto, SinToken
    from .tendencias import cosechar, derivar, probar, ubicaciones_disponibles
    from .pipeline import ahora_utc, _escribir

    cfg = _leer(os.path.join(args.config, "tendencias.json"))
    ubicaciones = cfg.get("ubicaciones", [])
    cosecha = cfg.get("cosecha", {})
    maximo = args.maximo or cosecha.get("maximo_por_ubicacion", 20)
    ahora = ahora_utc()

    # --ubicaciones es el --sondear de esta seccion: lista lo que X publica
    # para Mexico, Estados Unidos y el mundo, con su WOEID, y sale. Cuesta una
    # corrida del actor (~470 resultados) y no escribe nada.
    if args.ubicaciones:
        try:
            filas = ubicaciones_disponibles()
        except SinToken as e:
            print("token: {}".format(e), file=sys.stderr)
            return 1
        conocidos = {u.get("woeid") for u in ubicaciones}
        print("  {:>9}  {:<10} {:<28} {}".format("woeid", "tipo", "nombre", "pais"))
        for f in filas:
            print("{} {:>9}  {:<10} {:<28} {}".format(
                "*" if f["woeid"] in conocidos else " ", f["woeid"], f["tipo"],
                f["nombre"][:28], f["pais"] or "-"))
        print("\n* = ya esta en config/tendencias.json. Una ubicacion se enciende solo con el "
              "WOEID visto aqui, y su 'razon' cita la fecha.")
        return 0

    # --probar: pocas tendencias por ubicacion, para leerlas con ojos humanos
    # antes de confiar en el cron. No escribe nada.
    if args.probar:
        try:
            filas = probar(ubicaciones, ahora, maximo=5)
        except SinToken as e:
            print("token: {}".format(e), file=sys.stderr)
            return 1
        for r in filas:
            print("{}  (corte {}; {} tendencias; descartes: {})".format(
                r["ubicacion"], r["corte"] or "-", len(r["tendencias"]),
                ", ".join("{} {}".format(k, v) for k, v in r["descartes"].items()) or "ninguno"))
            for t in r["tendencias"]:
                print("  {:>2}. {:<44} {}".format(
                    t["puesto"], t["nombre"][:44],
                    "{:,} posts".format(t["volumen"]) if "volumen" in t else "sin dato"))
        print("\nNo se escribio nada. El ranking es el de X; las promocionadas se descartan.")
        return 0

    apify_cfg = _leer(os.path.join(args.config, "apify.json"))
    tope = args.presupuesto or cosecha.get("presupuesto_resultados") or (
        apify_cfg.get("presupuesto") or {}).get("resultados_por_corrida", 200)
    por_woeid, salud, gasto = cosechar(ubicaciones, ahora, presupuesto=Presupuesto(tope),
                                       maximo=maximo)
    panel = derivar(por_woeid, ahora, salud, gasto, ubicaciones, maximo=maximo)
    _escribir(os.path.join(args.salida, "tendencias.json"), panel)

    for u in panel["ubicaciones"]:
        if u["activa"]:
            print("{:<10} {:<9} {:>3} tendencias  corte {}".format(
                u["id"], u["estado"], len(u["tendencias"]), u["corte"] or "-"))
    print("gasto Apify: {} de {} resultados".format(gasto["gastado"], gasto["resultados"]))
    for s in panel["salud"]:
        if s["estado"] != "ok":
            print("  {} · {} · {}".format(
                s["ubicacion"], s["estado"], (s.get("error") or s.get("nota") or "")[:120]),
                file=sys.stderr)
    return 0


def cmd_apify(args):
    """Revisa el token y el catalogo de actores. No raspa nada.

    Es el paso de puesta a punto: un token mal pegado falla con 401 en medio
    del cron, seis horas despues y sin nadie mirando. Corre esto primero.
    """
    from .apify import SinToken, leer_catalogo, verificar

    codigo = 0
    ruta = os.path.join(args.config, "apify.json")

    if args.verificar:
        try:
            v = verificar()
            print("token: válido · usuario {} · plan {} · {}".format(
                v["usuario"], v["plan"], "de paga" if v["de_paga"] else "gratuito"))
            if v["credito_mensual_usd"] is not None:
                print("crédito mensual: {} USD".format(v["credito_mensual_usd"]))
        except SinToken as e:
            print("token: {}".format(e), file=sys.stderr)
            codigo = 1

    activos, errores = leer_catalogo(ruta)
    doc = _leer(ruta)
    apagados = [a for a in doc.get("actores", []) if not a.get("activo")]
    presupuesto = (doc.get("presupuesto") or {}).get("resultados_por_corrida", 0)

    print("actores activos: {} · apagados: {} · señuelos: {}".format(
        len(activos), len(apagados), len(doc.get("senuelos", []))))
    for a in activos:
        print("  · {} [{}] cuota {}".format(a["id"], a["idioma"], a.get("cuota", 0)))
    if activos:
        print("presupuesto: {} resultados/corrida, {} por actor".format(
            presupuesto, presupuesto // len(activos)))

    for e in errores:
        print("ERROR {}".format(e), file=sys.stderr)
        codigo = 1

    return codigo


def cmd_gasto_electoral(args):
    """Actualiza archivos finales del INE y asignaciones vigentes del IEEBC."""
    from .gasto_electoral import armar_financiamiento, armar_gasto, leer_config
    from .pipeline import _escribir

    ruta = os.path.join(args.config, "gasto-electoral.json")
    config = leer_config(ruta)
    os.makedirs(args.salida, exist_ok=True)

    # Son dos fuentes y dos contratos independientes. El IEEBC omitio el
    # certificado intermedio de su servidor en septiembre de 2026; dejarlo
    # primero impedia publicar los dictamenes del INE aunque estos respondieran.
    if not args.solo_financiamiento:
        gasto = armar_gasto(config)
        _escribir(os.path.join(args.salida, "gasto-electoral.json"), gasto)
        print("gasto electoral: {} candidaturas conciliadas · {} incidencias".format(
            len(gasto["candidaturas"]), len(gasto["incidencias"])))

    if not args.solo_gasto:
        financiamiento = armar_financiamiento(config)
        _escribir(os.path.join(args.salida, "financiamiento-partidos.json"), financiamiento)
        print("financiamiento {}: {} partidos · ${:,.2f} asignados".format(
            financiamiento["ejercicio"], len(financiamiento["partidos"]),
            financiamiento["totales"]["asignado"]))
    return 0


def cmd_validar(args):
    from .validador import resumen, validar_todo

    errores, avisos = validar_todo(args.config, args.datos)
    for a in avisos:
        print("aviso: {}".format(a))
    for e in errores:
        print("error: {}".format(e), file=sys.stderr)
    if errores:
        print("\n{} error(es)".format(len(errores)), file=sys.stderr)
        return 1
    linea = resumen(args.config, args.datos)
    print("ok{}".format(": " + linea if linea else ""))
    return 0


def cmd_sitio(args):
    from .sitio import armar

    archivos = armar(args.destino)
    print("{} armado con {} archivos".format(args.destino, len(archivos)))
    for a in archivos:
        print("  {}".format(a))
    print("\nvista previa: python -m http.server 8000 -d {}".format(args.destino))
    return 0


def cmd_servir(args):
    """Servidor de desarrollo: sitio/ en la raiz, data/ y config/ mapeados."""
    from .sitio import servir

    host = "0.0.0.0" if args.publico else "127.0.0.1"
    servidor, raices = servir(puerto=args.puerto, host=host)

    print("Pulso N33 en http://localhost:{}/".format(args.puerto))
    if args.publico:
        print("  ABIERTO A LA RED LOCAL: cualquiera en esta red puede verlo.")
    print()
    print("  /            -> {}".format(raices["sitio"]))
    print("  /data/       -> {}".format(raices["data"]))
    print("  /config/     -> {}".format(raices["config"]))
    print()
    print("Sin paso de armado: edita sitio/ o vuelve a correr el pipeline y")
    print("recarga. Ctrl+C para detener.")

    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\ndetenido")
    finally:
        servidor.server_close()
    return 0


def cmd_evaluar(args):
    """Tabla de diagnostico del prototipo: resolucion de figuras + diccionario.

    Es la linea base contra la cual se compara el clasificador real. Las
    etiquetas que imprime no son producto: ver docs/PLAN.md seccion 4.
    """
    roster = Roster.desde_archivo(os.path.join(args.config, "roster.json"))
    corpus = _leer(args.corpus)
    print("{} titulares reales".format(len(corpus)))
    print("=" * 78)

    sin_figura = 0
    for n in corpus:
        cuando = datetime.strptime(n["fecha"], "%Y-%m-%d").date()
        hits = roster.match(n["titulo"], cuando)
        r = diccionario(n["titulo"])

        print("\n{}".format(n["titulo"][:74]))
        print("  {} · {}".format(n["fuente"], n["fecha"]))
        if hits:
            for h in hits:
                figura = roster.por_id(h.figura_id)
                via = "por cargo" if h.via == "cargo" else "nominal"
                print("  -> {} ({}) · {} «{}»".format(
                    figura["nombre"], figura["ambito"], via, h.clave))
        else:
            sin_figura += 1
            print("  -> sin figura del roster")
        top = ", ".join("{}{:+d}".format(p, v) for p, v in r["disparos"][:4])
        print("  diccionario: {} ({:+d}) [{}]".format(
            r["etiqueta"], r["puntaje"], top or "sin disparos"))

    print("\n" + "=" * 78)
    print("{}/{} titulares con figura resuelta".format(len(corpus) - sin_figura, len(corpus)))
    return 0


def main(argv=None):
    p = argparse.ArgumentParser(prog="pulso", description="Pulso N33 {}".format(VERSION))
    p.add_argument("--config", default="config", help="carpeta de roster.json y medios.json")
    sub = p.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("correr", help="ingesta y escritura de data/*.json")
    c.add_argument("--sin-red", action="store_true", help="usa el corpus en vez de la red")
    c.add_argument("--descubrimiento-web", action="store_true",
                   help="descubre URLs recientes con GDELT y visita publishers")
    c.add_argument("--salida", default="data")
    c.add_argument("--corpus", default=RUTA_CORPUS)
    c.add_argument("--metodo", default="ninguno", choices=METODOS)
    c.add_argument("--retener-dias", type=int, default=RETENCION_DIAS,
                   help="dias que se quedan en la ventana; lo mas viejo se archiva "
                        "por mes (por omision {})".format(RETENCION_DIAS))
    c.set_defaults(fn=cmd_correr)

    municipal = sub.add_parser("comunicados", help="titulares oficiales del Ayuntamiento de Tecate")
    municipal.add_argument("--salida", default="data")
    municipal.add_argument("--sin-red", action="store_true")
    municipal.set_defaults(fn=cmd_comunicados)

    d = sub.add_parser("delegaciones", help="mantenimiento explícito del catálogo IMPLAN")
    d.add_argument("--actualizar", action="store_true", required=True,
                   help="refresca directorio oficial y polígonos SVG")
    d.add_argument("--mapa", default="web/src/lib/dominio/delegaciones-mapa.ts",
                   help="destino del asset SVG generado")
    d.set_defaults(fn=cmd_delegaciones)

    i = sub.add_parser("indicadores", help="vivienda, suelo, crimen y percepcion")
    i.add_argument("--salida", default="data")
    i.add_argument("--max-edad", type=int, default=7,
                   help="dias antes de volver a bajar (estas fuentes son trimestrales)")
    i.add_argument("--forzar", action="store_true")
    i.add_argument("--solo", action="append",
                   choices=[n for n, _, _ in __import__(
                       "pulso.indicadores", fromlist=["FUENTES"]).FUENTES])
    i.set_defaults(fn=cmd_indicadores)

    k = sub.add_parser("conversacion", help="comentarios de YouTube (requiere YOUTUBE_API_KEY)")
    k.add_argument("--salida", default="data")
    k.add_argument("--cache", default=os.path.join("cache", "comentarios"))
    k.add_argument("--videos", type=int, default=8, help="videos por canal")
    k.add_argument("--comentarios", type=int, default=100, help="comentarios por video")
    k.add_argument("--temas", default=os.path.join("data", "temas.json"),
                   help="temas de prensa usados por la busqueda de YouTube")
    k.add_argument("--temas-busqueda", type=int, default=3,
                   help="temas de prensa a buscar por corrida (0 apaga; maximo recomendado 3)")
    k.add_argument("--videos-tema", type=int, default=2,
                   help="videos con comentarios por cada tema buscado")
    k.add_argument("--sentimiento", default="ninguno", choices=("ninguno", "modelo"),
                   help="etiqueta el sentimiento de cada comentario con el modelo local "
                        "(requiere requirements-modelo.txt); a data/ solo llegan conteos")
    k.set_defaults(fn=cmd_conversacion)

    r = sub.add_parser("redes", help="comentarios de Instagram (requiere APIFY_TOKEN)")
    r.add_argument("--salida", default="data")
    r.add_argument("--cache", default=os.path.join("cache", "instagram"))
    r.add_argument("--posts", type=int, default=0, help="posts por cuenta (0 usa el config)")
    r.add_argument("--comentarios", type=int, default=0,
                   help="comentarios por post (0 usa el config)")
    r.add_argument("--temas", default=os.path.join("data", "temas.json"))
    r.add_argument("--sentimiento", default="ninguno", choices=("ninguno", "modelo"),
                   help="etiqueta el tono de cada comentario con el modelo local; "
                        "a data/ solo llegan conteos")
    r.add_argument("--presupuesto", type=int, default=0,
                   help="tope de resultados de esta corrida (0 usa config/apify.json)")
    r.add_argument("--sin-texto", action="store_true",
                   help="no escribe redes-comentarios.json; el resto de data/ sale igual")
    r.add_argument("--sondear", nargs="+", metavar="HANDLE",
                   help="pregunta si esos handles son el medio y sale; "
                        "'*' sondea los del config. Cuesta 1 resultado por cuenta")
    r.set_defaults(fn=cmd_redes)

    tk = sub.add_parser("tiktok", help="videos y comentarios de TikTok por búsqueda (requiere APIFY_TOKEN)")
    tk.add_argument("--salida", default="data")
    tk.add_argument("--cache", default=os.path.join("cache", "tiktok"))
    tk.add_argument("--videos", type=int, default=0, help="videos por búsqueda (0 usa el config)")
    tk.add_argument("--comentarios", type=int, default=0,
                    help="comentarios por video (0 usa el config)")
    tk.add_argument("--temas", default=os.path.join("data", "temas.json"))
    tk.add_argument("--sentimiento", default="ninguno", choices=("ninguno", "modelo"),
                    help="etiqueta el tono de cada comentario con el modelo local; "
                         "a data/ solo llegan conteos")
    tk.add_argument("--presupuesto", type=int, default=0,
                    help="tope de resultados de esta corrida (0 usa config/tiktok.json)")
    tk.add_argument("--sin-texto", action="store_true",
                    help="no escribe tiktok-comentarios.json; el resto de data/ sale igual")
    tk.add_argument("--probar", action="store_true",
                    help="tres videos por búsqueda, sin comentarios y sin escribir: para ver "
                         "qué devuelve el filtro de fecha antes de confiar en el cron")
    tk.set_defaults(fn=cmd_tiktok)

    yt = sub.add_parser("youtube",
                        help="Shorts y videos de YouTube por feed público (sin llave, sin costo)")
    yt.add_argument("--salida", default="data")
    yt.add_argument("--cache", default=os.path.join("cache", "youtube"))
    yt.add_argument("--piezas", type=int, default=0,
                    help="piezas por lista y canal (0 usa el config)")
    yt.add_argument("--probar", action="store_true",
                    help="unas pocas piezas por canal, sin escribir: para ver cómo quedan "
                         "zona y formato antes de dar de alta una fila")
    yt.set_defaults(fn=cmd_youtube)

    tx = sub.add_parser("tendencias",
                        help="tendencias de X por ubicación, sin sesión (requiere APIFY_TOKEN)")
    tx.add_argument("--salida", default="data")
    tx.add_argument("--maximo", type=int, default=0,
                    help="tendencias por ubicación (0 usa el config; el tope de X es 50)")
    tx.add_argument("--presupuesto", type=int, default=0,
                    help="tope de resultados de esta corrida (0 usa config/tendencias.json)")
    tx.add_argument("--probar", action="store_true",
                    help="cinco tendencias por ubicación, sin escribir: para ver qué devuelve "
                         "el actor antes de confiar en el cron")
    tx.add_argument("--ubicaciones", action="store_true",
                    help="lista las ubicaciones que X publica (México, EE. UU. y el mundo) con "
                         "su WOEID y sale; cuesta una corrida del actor (~470 resultados)")
    tx.set_defaults(fn=cmd_tendencias)

    a = sub.add_parser("apify", help="revisa APIFY_TOKEN y el catálogo de actores")
    a.add_argument("--verificar", action="store_true",
                   help="pregunta a Apify si el token sirve (una llamada, sin costo)")
    a.set_defaults(fn=cmd_apify)

    ge = sub.add_parser("gasto-electoral",
                        help="gasto final auditado 2024 y financiamiento partidista 2026")
    ge.add_argument("--salida", default="data")
    fuente_ge = ge.add_mutually_exclusive_group()
    fuente_ge.add_argument("--solo-financiamiento", action="store_true",
                           help="actualiza el IEEBC sin descargar los anexos finales del INE")
    fuente_ge.add_argument("--solo-gasto", action="store_true",
                           help="actualiza los dictamenes del INE sin consultar el IEEBC")
    ge.set_defaults(fn=cmd_gasto_electoral)

    v = sub.add_parser("validar", help="valida config/ y data/")
    v.add_argument("--datos", default="data")
    v.set_defaults(fn=cmd_validar)

    s = sub.add_parser("sitio", help="arma _site/ para publicar en Pages")
    s.add_argument("--destino", default="_site")
    s.set_defaults(fn=cmd_sitio)

    sv = sub.add_parser("servir", help="servidor de desarrollo, sin paso de armado")
    sv.add_argument("--puerto", type=int, default=8000)
    sv.add_argument("--publico", action="store_true",
                    help="escuchar en toda la red local, no solo en localhost")
    sv.set_defaults(fn=cmd_servir)

    e = sub.add_parser("evaluar", help="linea base del diccionario sobre el corpus")
    e.add_argument("--corpus", default=RUTA_CORPUS)
    e.set_defaults(fn=cmd_evaluar)

    args = p.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
