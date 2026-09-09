"""CLI: correr | validar | sitio | evaluar.

  python -m pulso correr [--sin-red] [--descubrimiento-web] [--salida data] [--metodo ninguno|diccionario|modelo]
  python -m pulso delegaciones --actualizar
  python -m pulso conversacion [--sentimiento ninguno|modelo]
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
    Ver el encabezado de pulso/youtube.py para el porque.
    """
    from .pipeline import ahora_utc, _escribir
    from .youtube import cosechar, derivar, leer_cache

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
        from .youtube import clasificar_cache
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



    a = sub.add_parser("apify", help="revisa APIFY_TOKEN y el catálogo de actores")
    a.add_argument("--verificar", action="store_true",
                   help="pregunta a Apify si el token sirve (una llamada, sin costo)")
    a.set_defaults(fn=cmd_apify)

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
