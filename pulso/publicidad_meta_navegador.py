"""Lector opcional de la biblioteca PUBLICA, sin sesiones reutilizadas.

Meta permite abrir las fichas de Julieta, pero su robots.txt devolvio
Disallow: / para Pulso el 21-09-2026. Se informa ese bloqueo antes de abrir
Chromium. Importar una observacion manual es otra entrada, no una forma de
saltarse este control. Nunca se consultan endpoints privados ni cookies.
"""

import re
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.parse import urlsplit

from .consultas import permitido_por_robots
from .publicidad_meta import (BASE, DESDE, PERIODOS, VENTANAS, anuncio_de_texto,
                             escribir, fecha_meta, normalizar_anuncios,
                             numero_meta, seccion, url_biblioteca)

TARJETAS = r"""() => {
  const salida = new Map();
  for (const nodo of document.querySelectorAll('span,div')) {
    if (!/^Library ID:\s*\d+$/.test(nodo.innerText?.trim() || '')) continue;
    let tarjeta = nodo;
    for (let padre = nodo.parentElement; padre; padre = padre.parentElement) {
      const texto = padre.innerText || '';
      if ((texto.match(/Library ID:/g) || []).length > 1) break;
      tarjeta = padre;
      if (/See (ad|summary) details/.test(texto) && /Sponsored/.test(texto)) break;
    }
    const texto = tarjeta.innerText;
    const id = texto.match(/Library ID:\s*(\d+)/)?.[1];
    if (id) salida.set(id, {texto,
      plataformas: [...tarjeta.querySelectorAll('[aria-label],img[alt]')]
        .map(e => e.getAttribute('aria-label') || e.getAttribute('alt'))
        .filter(t => ['Facebook','Instagram','Messenger','Audience Network','Threads','WhatsApp'].includes(t)),
      video: !!tarjeta.querySelector('video'),
      imagen: !!tarjeta.querySelector('img:not([alt*="profile"]):not([alt*="picture"])')});
  }
  return [...salida.values()];
}"""


class LecturaBloqueada(Exception):
    pass


def comprobar_pagina(pagina):
    if urlsplit(pagina.url).hostname not in ("business.facebook.com", "www.facebook.com"):
        raise LecturaBloqueada("redireccion_fuera_de_meta")
    texto = pagina.locator("body").inner_text(timeout=20000)
    if (re.search(r"/login|/checkpoint|/challenge", pagina.url) or
        pagina.locator('input[type="password"]').count() or
        re.search(r"Confirm you.re human|security check|temporarily blocked|Too many requests|Something went wrong", texto, re.I)):
        raise LecturaBloqueada("acceso_restringido")
    if any(c["name"] in ("c_user", "xs") for c in pagina.context.cookies()):
        raise LecturaBloqueada("sesion_detectada")
    return texto


def esperar(pagina, patron):
    pagina.get_by_text(re.compile(patron)).first.wait_for(timeout=20000)
    return comprobar_pagina(pagina)


def periodo_texto(texto):
    # Meta abrevia el primer ano en 'Sep 12 - Sep 18, 2026'.
    abreviado = re.search(r"([A-Z][a-z]{2} \d{1,2}) - ([A-Z][a-z]{2} \d{1,2}, (\d{4}))", texto)
    if abreviado:
        hasta = fecha_meta(abreviado[2])
        desde = fecha_meta(abreviado[1] + ", " + abreviado[3])
        if desde and hasta and desde > hasta:
            desde = fecha_meta(abreviado[1] + ", " + str(int(abreviado[3]) - 1))
        if desde and hasta:
            return {"desde": desde, "hasta": hasta}
    fechas = re.findall(r"[A-Z][a-z]{2} \d{1,2}, \d{4}", texto)
    if len(fechas) < 2:
        return None
    desde, hasta = fecha_meta(fechas[0]), fecha_meta(fechas[1])
    return {"desde": desde, "hasta": hasta} if desde and hasta and desde <= hasta else None


def importe_despues(texto, etiqueta):
    resultado = re.search(re.escape(etiqueta) + r"\s*\$?([\d,.]+[KM]?)", texto)
    return numero_meta(resultado[1]) if resultado else None


def informacion_de_texto(texto):
    if "About the advertiser" not in texto or "Page transparency" not in texto:
        raise ValueError("informacion_no_disponible")
    transparencia = []
    for etiqueta, patron in (
        ("Página creada", r"Page created ([^\n]+)"),
        ("Cambios de nombre", r"Page name changed ([^\n]+)"),
        ("Páginas fusionadas", r"Merged with ([^\n]+)"),
        ("Responsable de la página", r"([^\n]+)\s+is responsible for this Page"),
        ("Administración por país", r"Primary country location for people who manage this Page includes:\s*([^\n]+)"),
    ):
        encontrado = re.search(patron, texto)
        if encontrado:
            transparencia.append({"etiqueta": etiqueta, "valor": encontrado[1].strip()})
    cuentas = re.findall(r"(@[^\s]+)\s+([\d,.KM]+ followers)", texto)
    transparencia += [{"etiqueta": cuenta, "valor": seguidores.replace("followers", "seguidores")} for cuenta, seguidores in cuentas]
    totales = []
    for titulo, etiqueta in (("Total amount spent", "Histórico publicado por Meta"),
                             ("Last week's spend", "Últimos 7 días")):
        pos = texto.find(titulo)
        if pos < 0:
            continue
        fragmento = texto[pos:pos + 250]
        importe, periodo = importe_despues(fragmento, titulo), periodo_texto(fragmento)
        if importe is not None and periodo:
            # '$' no prueba MXN. La moneda queda ausente hasta que la fuente
            # la declare expresamente, y esas cifras no se comparan con INE.
            moneda = "MXN" if "MXN" in fragmento else None
            totales.append({"etiqueta": etiqueta, **periodo, "geografia": "MX", "moneda": moneda, "importe": importe})
    pagadores = []
    if totales and "Spend per disclaimer" in texto:
        fragmento = texto.split("Spend per disclaimer", 1)[1].split("Last week's spend", 1)[0]
        for nombre, importe in re.findall(r"([^\n]+)\n\s*\$([\d,]+)", fragmento):
            total = totales[0]
            pagadores.append({"nombre": nombre.strip(), "importe": numero_meta(importe),
                              **{k: total[k] for k in ("desde", "hasta", "moneda", "geografia")}})
    return {"transparencia": transparencia, "totales": totales, "pagadores": pagadores}


def audiencia_de_texto(texto, ventana):
    patron = r"Last " + ventana + r" days \(([^)]+)\)"
    coincidencia = re.search(patron, texto)
    periodo = periodo_texto(coincidencia[1]) if coincidencia else None
    if not periodo:
        raise ValueError("periodo_audiencia_no_disponible")
    importe, anuncios = importe_despues(texto, "Amount spent"), importe_despues(texto, "Ads")
    selecciones = []
    # Las etiquetas y valores son la seleccion del anunciante, nunca un
    # promedio inventado de los porcentajes de entrega de cada anuncio.
    for etiqueta in ("Age", "Gender", "Locations", "Detailed targeting", "Custom audiences", "Lookalike audiences"):
        resultado = re.search(r"(?:^|\n)" + etiqueta + r"\n([^\n]+)", texto)
        if resultado:
            selecciones.append({"etiqueta": etiqueta, "valor": resultado[1].strip()})
    return periodo, {"importe": importe, "moneda": "MXN" if "MXN" in texto else None,
                     "anuncios": int(anuncios) if anuncios is not None else None, "selecciones": selecciones}


def leer_anuncios(pagina, pagina_id, ahora, limite):
    fuente = url_biblioteca(pagina_id)
    pagina.goto(fuente, wait_until="domcontentloaded")
    esperar(pagina, r"Library ID:|No ads match|No ads found|0 results")
    anuncios, completo, motivo = [], False, None
    for _ in range(limite):
        texto_pagina = comprobar_pagina(pagina)
        tarjetas = pagina.evaluate(TARJETAS)
        for tarjeta in tarjetas:
            anuncio = anuncio_de_texto(tarjeta["texto"], pagina_id)
            if anuncio:
                anuncio["plataformas"] = sorted(set(tarjeta["plataformas"]))
                if tarjeta["video"]:
                    anuncio["formato"] = "video"
                anuncios.append(anuncio)
        mas = pagina.get_by_role("button", name="See more", exact=True)
        if re.search(r"(?:No ads match|No ads found|No more results|You've reached the end)", texto_pagina):
            completo = True
            break
        anteriores = len(tarjetas)
        if mas.count():
            mas.last.click()
        else:
            # La biblioteca tambien pagina con desplazamiento. La ausencia
            # de boton nunca demuestra que se haya leido todo el resultado.
            pagina.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        try:
            pagina.wait_for_function("n => (document.body.innerText.match(/Library ID:/g)||[]).length > n", arg=anteriores, timeout=15000)
        except Exception:
            motivo = "paginacion_interrumpida"
            break
    else:
        motivo = "limite_de_paginas"
    try:
        comprobar_pagina(pagina)
    except LecturaBloqueada:
        return seccion(fuente, {"desde": DESDE, "hasta": ahora[:10]}, estado="parcial",
                       datos=normalizar_anuncios(anuncios), consultado=ahora, motivo="lectura_bloqueada")
    # Abrir grupos evita equiparar una tarjeta de '5 ads' con un anuncio.
    grupos = pagina.get_by_role("button", name="See summary details", exact=True)
    for indice in range(grupos.count()):
        try:
            grupos.nth(indice).click()
            pagina.get_by_role("dialog").last.wait_for(timeout=10000)
            comprobar_pagina(pagina)
            tarjetas = pagina.evaluate(TARJETAS)
            nuevos = [anuncio_de_texto(t["texto"], pagina_id) for t in tarjetas]
            anuncios.extend(a for a in nuevos if a)
            pagina.keyboard.press("Escape")
        except LecturaBloqueada:
            return seccion(fuente, {"desde": DESDE, "hasta": ahora[:10]}, estado="parcial",
                           datos=normalizar_anuncios(anuncios), consultado=ahora, motivo="lectura_bloqueada")
        except Exception:
            motivo = "grupos_pendientes"
            break
    anuncios = normalizar_anuncios(anuncios)
    if any(a["grupo"] for a in anuncios):
        completo, motivo = False, "grupos_pendientes"
    # Cada anuncio se abre para recuperar distribucion y region; los datos
    # de las tarjetas siguen disponibles si una ficha no llega.
    for anuncio in anuncios:
        if anuncio["grupo"]:
            continue
        try:
            pagina.goto(anuncio["url"], wait_until="domcontentloaded")
            texto = esperar(pagina, r"See ad details|Ad details|About this ad")
            detalle = pagina.get_by_role("button", name="See ad details", exact=True)
            if detalle.count():
                detalle.first.click()
                texto = esperar(pagina, r"Audience|Impressions|Amount spent")
            regiones = re.findall(r"(?:^|\n)([^\n\d%]+)\s+([\d.]+)%", texto)
            anuncio["entrega"] = [{"etiqueta": nombre.strip(), "valor": valor + "%"} for nombre, valor in regiones]
            if any(nombre.strip() == "Baja California" for nombre, _ in regiones):
                anuncio["regiones"] = ["Baja California"]
        except LecturaBloqueada:
            completo, motivo = False, "lectura_bloqueada"
            break
        except Exception:
            completo, motivo = False, "detalles_pendientes"
    return seccion(fuente, {"desde": DESDE, "hasta": ahora[:10]}, estado="ok" if completo else "parcial",
                   datos=anuncios, consultado=ahora, completo=completo, motivo=motivo)


def capturar_perfil(pagina, persona, ahora, limite, cache, probar=False):
    ident, pagina_id = persona["id"], persona["pagina"]["id"]
    fuente = url_biblioteca(pagina_id)
    captura = {"pagina_id": pagina_id, "audiencia": {}}
    pagina.goto(fuente, wait_until="domcontentloaded")
    esperar(pagina, re.escape(persona["pagina"]["nombre"]))
    # Verificar tanto nombre como enlace: un nombre homonimo no sirve.
    enlaces = pagina.get_by_role("link", name=persona["pagina"]["nombre"], exact=True)
    esperado = urlsplit(persona["pagina"]["url"]).path.rstrip("/").lower()
    if not any(urlsplit(e.get_attribute("href") or "").path.rstrip("/").lower() == esperado for e in enlaces.all()):
        raise LecturaBloqueada("identidad_no_coincide")
    if probar:
        return {"pagina_id": pagina_id, "sondeo": "ok", "consultado": ahora}
    for pestana, clave in (("About", "informacion"), ("Audience", "audiencia")):
        try:
            pagina.get_by_role("link", name=pestana, exact=True).click()
            texto = esperar(pagina, "Page transparency" if clave == "informacion" else "Last 7 days")
            if clave == "informacion":
                datos = informacion_de_texto(texto)
                captura[clave] = seccion(fuente, estado="parcial", datos=datos, consultado=ahora,
                                         motivo="campos_publicos_disponibles")
                escribir(Path(cache) / (ident + "-informacion.json"), {"consultado": ahora, "fuente": fuente, "texto": texto})
            else:
                for ventana in VENTANAS:
                    try:
                        if ventana != "7":
                            pagina.get_by_role("button", name=re.compile(r"Last \d+ days")).click()
                            pagina.get_by_text(re.compile(r"^Last " + ventana + r" days")).last.click()
                        texto = esperar(pagina, r"Last " + ventana + r" days")
                        periodo, datos = audiencia_de_texto(texto, ventana)
                        completo = datos["anuncios"] == 0 or bool(datos["selecciones"])
                        captura[clave][ventana] = seccion(fuente, periodo, estado="ok" if completo else "parcial",
                            datos=datos, consultado=ahora, completo=completo)
                        escribir(Path(cache) / (ident + "-audiencia-" + ventana + ".json"),
                                 {"consultado": ahora, "fuente": fuente, "texto": texto})
                    except LecturaBloqueada:
                        raise
                    except Exception:
                        captura[clave][ventana] = seccion(fuente, estado="fallo", consultado=ahora, motivo="audiencia_no_disponible")
        except LecturaBloqueada:
            bloqueo = seccion(fuente, estado="bloqueado", consultado=ahora, motivo="lectura_bloqueada")
            captura.setdefault("informacion", bloqueo)
            captura["anuncios"] = bloqueo
            for ventana in VENTANAS:
                captura["audiencia"].setdefault(ventana, bloqueo)
            return captura
        except Exception:
            if clave == "informacion":
                captura[clave] = seccion(fuente, estado="fallo", consultado=ahora, motivo="informacion_no_disponible")
            else:
                captura[clave] = {v: seccion(fuente, estado="fallo", consultado=ahora, motivo="audiencia_no_disponible") for v in VENTANAS}
    try:
        captura["anuncios"] = leer_anuncios(pagina, pagina_id, ahora, limite)
    except LecturaBloqueada:
        captura["anuncios"] = seccion(fuente, estado="bloqueado", consultado=ahora, motivo="lectura_bloqueada")
    except Exception:
        captura["anuncios"] = seccion(fuente, estado="fallo", consultado=ahora, motivo="anuncios_no_disponibles")
    return captura


def capturar_reporte(pagina, ahora):
    fuente = BASE + "report/?country=MX"
    salida = {}
    pagina.goto(fuente, wait_until="domcontentloaded")
    esperar(pagina, "Spending by advertiser")
    for ventana, etiqueta in (("1", "Last day"), ("7", "Last 7 days"), ("30", "Last 30 days"), ("90", "Last 90 days"), ("todo", "All dates")):
        try:
            pagina.get_by_role("tab", name=etiqueta, exact=True).click()
            texto = comprobar_pagina(pagina)
            fragmento = texto.split("Spending by advertiser", 1)[1]
            periodo = periodo_texto(fragmento[:180])
            if ventana == "1":
                fecha = fecha_meta(fragmento[:100])
                periodo = {"desde": fecha, "hasta": fecha} if fecha else None
            if not periodo:
                raise ValueError("periodo_no_disponible")
            enlaces = pagina.locator('a[href*="view_all_page_id="]').all()
            anunciantes = []
            for enlace in enlaces:
                from urllib.parse import parse_qs
                pid = parse_qs(urlsplit(enlace.get_attribute("href")).query).get("view_all_page_id", [None])[0]
                lineas = enlace.inner_text().splitlines()
                if pid and len(lineas) >= 4:
                    importe = numero_meta(lineas[-2])
                    if importe is not None:
                        anunciantes.append({"pagina_id": pid, "nombre": lineas[0], "pagador": lineas[1],
                                            "importe": importe, "anuncios": int(numero_meta(lineas[-1]))})
            regiones = []
            if "Spending by location" in texto:
                for nombre, valor in re.findall(r"([^\n]+)\n\$([\d,]+)", texto.split("Spending by location", 1)[1]):
                    regiones.append({"nombre": nombre.strip(), "importe": numero_meta(valor)})
            # La tabla es paginada: no llamar total a su primera pagina.
            salida[ventana] = seccion(fuente, periodo, estado="parcial", datos={"importe": None, "anuncios": None,
                "moneda": "MXN" if "MXN" in texto else None, "anunciantes": anunciantes, "regiones": regiones},
                consultado=ahora, motivo="tabla_parcial")
        except LecturaBloqueada:
            for pendiente in PERIODOS:
                salida.setdefault(pendiente, seccion(fuente, estado="bloqueado", consultado=ahora, motivo="lectura_bloqueada"))
            break
        except Exception:
            salida[ventana] = seccion(fuente, estado="fallo", consultado=ahora, motivo="reporte_no_disponible")
    return salida


def purgar_capturas(cache, ahora):
    """Solo nuestras capturas JSON, despues de 30 dias; reloj inyectado."""
    limite = date.fromisoformat(ahora[:10]) - timedelta(days=30)
    for ruta in Path(cache).glob("*.json"):
        try:
            import json
            captura = json.loads(ruta.read_text(encoding="utf-8"))
            consultado = captura.get("consultado")
            if consultado and date.fromisoformat(consultado[:10]) < limite:
                ruta.unlink()
        except (ValueError, OSError, TypeError):
            continue


def cosechar(config, ahora, cache="cache/publicidad-meta", persona_id=None, probar=False, limite=100):
    datetime.fromisoformat(ahora)
    if limite < 1 or limite > 1000:
        raise ValueError("max-paginas debe estar entre 1 y 1000")
    if not probar:
        purgar_capturas(cache, ahora)
    personas = [p for p in config["personas"] if p["pagina"] and (persona_id is None or p["id"] == persona_id)]
    capturas, sondeos = {"perfiles": {}, "reporte": {}}, []
    permitido = permitido_por_robots(BASE)
    if not permitido and config["respetar_robots"]:
        for persona in personas:
            fuente = url_biblioteca(persona["pagina"]["id"])
            bloqueo = seccion(fuente, estado="bloqueado", consultado=ahora, motivo="robots")
            capturas["perfiles"][persona["id"]] = {"pagina_id": persona["pagina"]["id"],
                "anuncios": bloqueo, "informacion": bloqueo, "audiencia": {v: bloqueo for v in VENTANAS}}
            sondeos.append({"id": persona["id"], "estado": "bloqueado", "motivo": "robots"})
        capturas["reporte"] = {v: seccion(BASE + "report/?country=MX", estado="bloqueado", consultado=ahora, motivo="robots") for v in PERIODOS}
        return capturas, sondeos
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError("Instala requirements-meta.txt y ejecuta python -m playwright install chromium") from exc
    with sync_playwright() as gestor:
        navegador = gestor.chromium.launch(headless=True)
        contexto = navegador.new_context(locale="en-US", user_agent="PulsoN33/1.0")
        # Un contexto nuevo, sin storage_state ni perfil de usuario. Los
        # recursos multimedia no hacen falta para leer texto y metadatos.
        contexto.route("**/*", lambda ruta: ruta.abort() if ruta.request.resource_type in ("media", "image", "font") else ruta.continue_())
        pagina = contexto.new_page()
        for persona in personas:
            try:
                captura = capturar_perfil(pagina, persona, ahora, limite, cache, probar)
                sondeos.append({"id": persona["id"], "estado": "ok"})
                if not probar:
                    capturas["perfiles"][persona["id"]] = captura
            except Exception:
                sondeos.append({"id": persona["id"], "estado": "fallo", "motivo": "pagina_no_disponible"})
                if not probar:
                    fallo = seccion(url_biblioteca(persona["pagina"]["id"]), estado="fallo", consultado=ahora, motivo="pagina_no_disponible")
                    capturas["perfiles"][persona["id"]] = {"pagina_id": persona["pagina"]["id"],
                        "anuncios": fallo, "informacion": fallo, "audiencia": {v: fallo for v in VENTANAS}}
        if not probar:
            try:
                capturas["reporte"] = capturar_reporte(pagina, ahora)
            except Exception:
                capturas["reporte"] = {v: seccion(BASE + "report/?country=MX", estado="fallo", consultado=ahora, motivo="reporte_no_disponible") for v in PERIODOS}
        contexto.close()
        navegador.close()
    return capturas, sondeos
