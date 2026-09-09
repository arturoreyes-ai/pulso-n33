/* Muro de prensa: lee data/*.json y los pinta.
 *
 * Todas las rutas son relativas, sin diagonal inicial, para que el mismo
 * _site/ funcione en http://localhost:8000/ y bajo el subcamino
 * /pulso-n33/ de GitHub Pages.
 *
 * Sin framework y sin build a proposito: la Fase 0 tiene que poder abrirse
 * con `python -m http.server` y nada mas.
 */

"use strict";

var MESES = ["ene", "feb", "mar", "abr", "may", "jun",
             "jul", "ago", "sep", "oct", "nov", "dic"];

var estado = { zona: null, notas: [], roster: {}, corte: null };

function $(id) { return document.getElementById(id); }

function texto(el, s) { el.textContent = s; }

function pedir(ruta) {
  return fetch(ruta, { cache: "no-store" }).then(function (r) {
    if (!r.ok) throw new Error(ruta + ": HTTP " + r.status);
    return r.json();
  });
}

/* ------------------------------------------------------------- formato */

function aFecha(s) {
  if (!s) return null;
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function fechaCorta(d) {
  return d.getDate() + " " + MESES[d.getMonth()];
}

function hora(d) {
  return String(d.getHours()).padStart(2, "0") + ":" +
         String(d.getMinutes()).padStart(2, "0");
}

/* El corte es el reloj: la edad se mide contra la corrida, no contra el
   navegador, para que una pagina abierta desde ayer no mienta. */
function edad(d, corte) {
  var ms = corte - d;
  if (ms < 0) return "";
  var h = Math.floor(ms / 3600000);
  if (h < 48) return h + " h";
  var dias = Math.floor(h / 24);
  if (dias < 60) return dias + " d";
  return Math.floor(dias / 30) + " me";
}

function cuando(nota, corte) {
  var d = aFecha(nota.publicado) || aFecha(nota.fecha);
  if (!d) return { principal: "s/f", edad: "" };
  var mismoDia = corte && d.toDateString() === corte.toDateString();
  var tieneHora = d.getHours() !== 0 || d.getMinutes() !== 0;
  return {
    principal: (mismoDia && tieneHora) ? hora(d) : fechaCorta(d),
    edad: corte ? edad(d, corte) : ""
  };
}

function nombreCorto(figuraId) {
  var f = estado.roster[figuraId];
  if (!f) return figuraId;
  return (f.alias && f.alias.length) ? f.alias[0] : f.nombre;
}

/* -------------------------------------------------------------- cabeza */

function pintarCifras(est, salud) {
  var ok = est ? est.fuentes_ok : 0;
  var total = salud ? salud.length : 0;
  $("c-notas").innerHTML = "<strong>" + estado.notas.length + "</strong>";
  $("c-fuentes").innerHTML = "<strong>" + ok + "</strong>/" + total;
  if (estado.corte) {
    texto($("c-corte"), fechaCorta(estado.corte) + " " + hora(estado.corte) + " h");
  }
}

function pintarBanda(est) {
  var b = $("banda");
  if (!est) {
    b.className = "banda rota";
    b.innerHTML = "<b>Sin datos.</b> No se pudo leer data/estado.json. " +
      "Corre <code>python -m pulso correr --sin-red</code> y vuelve a armar el sitio.";
    return;
  }
  if (est.modo === "corpus") {
    b.className = "banda";
    b.innerHTML = "<b>Corrida sin red.</b> Estas notas vienen del corpus de " +
      "prueba, no de los feeds. Sirven para verificar el pipeline; no son un " +
      "corte de prensa. Corre <code>python -m pulso correr</code> para ingesta real.";
    return;
  }
  var roto = est.fuentes_ok === 0;
  b.className = "banda " + (roto ? "rota" : "viva");
  var partes = ["<b>" + (roto ? "Ninguna fuente respondió." : "Ingesta automática.") + "</b>"];
  partes.push(est.fuentes_ok + " de " + (est.fuentes_ok + est.fuentes_fallo) +
              " fuentes respondieron");
  if (est.notas_nuevas) partes.push(est.notas_nuevas + " notas nuevas en este corte");
  if (estado.descartadas) {
    partes.push(estado.descartadas + " notas de fuera de la región descartadas");
  }
  if (est.metodo_postura === "ninguno") partes.push("sin clasificación de postura");
  if (est.corrida) {
    partes.push('<a href="' + est.corrida + '">ver la corrida</a>');
  }
  b.innerHTML = partes.join(" · ") + ".";
}

/* --------------------------------------------------------------- salud */

function pintarSalud(salud) {
  if (!salud || !salud.length) return;
  var cont = $("salud");
  var lista = $("salud-lista");
  lista.innerHTML = "";
  salud.forEach(function (s) {
    var li = document.createElement("li");
    li.setAttribute("data-estado", s.estado);
    var punto = document.createElement("span");
    punto.className = "punto";
    var medio = document.createElement("span");
    medio.className = "medio";
    medio.textContent = s.nombre;
    var detalle = document.createElement("span");
    detalle.className = "detalle";
    detalle.textContent = s.estado === "ok"
      ? s.obtenidas + " notas · " + s.ms + " ms"
      : (s.error || "fallo");
    detalle.title = s.estado === "ok"
      ? s.url
      : (s.error || "") + (s.ultima_ok ? " · último éxito: " + s.ultima_ok : "");
    li.appendChild(punto);
    li.appendChild(medio);
    li.appendChild(detalle);
    lista.appendChild(li);
  });
  cont.hidden = false;
}

/* -------------------------------------------------------- indicadores */

function pct(v) {
  if (v === null || v === undefined) return "—";
  return (v > 0 ? "+" : "") + v.toFixed(2) + "%";
}

function pesos(v) {
  return "$" + Math.round(v).toLocaleString("es-MX");
}

/* Cada bloque lleva su propia advertencia porque cada fuente mide algo
   distinto y confundirlas es el error facil: el indice SHF no es un precio,
   el predial no es una valuacion y el catastral de California no es precio
   de mercado. */
function tarjeta(titulo, fuente, periodo, filas, aviso) {
  var d = document.createElement("div");
  d.className = "ind-card";

  var h = document.createElement("h3");
  h.textContent = titulo;
  d.appendChild(h);

  var meta = document.createElement("p");
  meta.className = "ind-meta";
  meta.textContent = fuente + (periodo ? " · " + periodo : "");
  d.appendChild(meta);

  var ul = document.createElement("ul");
  ul.className = "conteos";
  filas.forEach(function (f) {
    var li = document.createElement("li");
    if (f.hueco) li.className = "hueco";
    var a = document.createElement("span");
    a.textContent = f.etiqueta;
    var b = document.createElement("span");
    b.className = "conteo-n";
    b.textContent = f.valor;
    if (f.titulo) li.title = f.titulo;
    li.appendChild(a);
    li.appendChild(b);
    ul.appendChild(li);
  });
  d.appendChild(ul);

  if (aviso) {
    var p = document.createElement("p");
    p.className = "ind-aviso";
    p.textContent = aviso;
    d.appendChild(p);
  }
  return d;
}

var ZONAS_MX = ["Tijuana", "Mexicali", "Ensenada", "Playas de Rosarito",
                "Tecate", "San Quintín", "San Felipe"];

function pintarIndicadores(ind) {
  if (!ind || !ind.indicadores) return;
  var I = ind.indicadores;
  var grid = $("ind-grid");
  grid.innerHTML = "";

  /* Vivienda: solo variaciones. Los niveles del indice estan rebaseados por
     serie, asi que compararlos entre ciudades es un error. */
  if (I.shf) {
    var filas = Object.keys(I.shf.series).sort().map(function (k) {
      var s = I.shf.series[k];
      return {
        etiqueta: k.replace("Baja California · ", ""),
        valor: pct(s.variacion_anual_pct)
      };
    });
    (I.shf.sin_cobertura || []).forEach(function (z) {
      filas.push({ etiqueta: z, valor: "sin dato", hueco: true,
                   titulo: "SHF no publica índice para este municipio" });
    });
    grid.appendChild(tarjeta("Vivienda · variación anual", I.shf.fuente,
                             I.shf.periodo, filas, I.shf.aviso));
  }

  if (I.predial) {
    var pf = ZONAS_MX.filter(function (z) { return I.predial.municipios[z]; })
      .map(function (z) {
        var m = I.predial.municipios[z];
        return {
          etiqueta: z,
          valor: pesos(m.por_cuenta_mxn) + (m.variacion_anual_pct !== null
            ? "  " + pct(m.variacion_anual_pct) : ""),
          titulo: m.cuentas_pagadas.toLocaleString("es-MX") + " cuentas pagadas"
        };
      });
    grid.appendChild(tarjeta("Suelo · predial por cuenta", I.predial.fuente,
                             I.predial.periodo, pf, I.predial.aviso));
  }

  if (I.sesnsp) {
    var cf = ZONAS_MX.filter(function (z) { return I.sesnsp.municipios[z]; })
      .map(function (z) {
        var m = I.sesnsp.municipios[z];
        return { etiqueta: z, valor: m.total.toLocaleString("es-MX"),
                 titulo: Object.keys(m.delitos_clave).slice(0, 4).map(function (d) {
                   return d + ": " + m.delitos_clave[d];
                 }).join(" · ") };
      });
    grid.appendChild(tarjeta("Crimen reportado · acumulado del año",
                             I.sesnsp.fuente, I.sesnsp.periodo, cf, I.sesnsp.aviso));
  }

  /* Percepcion: la unica medicion con muestra probabilistica, y solo cubre
     dos ciudades. Las otras cinco se rotulan como hueco, no se infieren. */
  if (I.ensu) {
    var ef = Object.keys(I.ensu.ciudades).sort().map(function (k) {
      return { etiqueta: k, valor: I.ensu.ciudades[k].pct_inseguro + "%" };
    });
    ef.push({ etiqueta: "Nacional", valor: I.ensu.nacional.pct_inseguro + "%" });
    ZONAS_MX.forEach(function (z) {
      if (!I.ensu.ciudades[z]) {
        ef.push({ etiqueta: z, valor: "fuera de muestra", hueco: true,
                  titulo: "La ENSU nunca ha muestreado esta ciudad" });
      }
    });
    grid.appendChild(tarjeta("Percepción de inseguridad", I.ensu.fuente,
                             I.ensu.periodo, ef, I.ensu.cobertura));
  }

  if (I.san_diego && I.san_diego.zips) {
    var z = I.san_diego.zips;
    // Los ZIP de la franja fronteriza primero: son los que comparan con TJ.
    var frontera = ["92173", "92154", "91910", "91911", "92101", "92118"];
    var sf = frontera.filter(function (c) { return z[c]; }).map(function (c) {
      return { etiqueta: c, valor: "$" + z[c].mediana_usd.toLocaleString("en-US"),
               titulo: z[c].parcelas.toLocaleString("es-MX") + " parcelas" };
    });
    grid.appendChild(tarjeta("San Diego · valor catastral mediano",
                             I.san_diego.fuente, null, sf, I.san_diego.aviso));
  }

  var fallos = (ind.salud || []).filter(function (s) { return s.estado === "fallo"; });
  var nota = "Fuentes oficiales, cada una con su propia cadencia: SHF y ENSU " +
    "trimestrales, SESNSP mensual con unas tres semanas de rezago, predial anual. " +
    "Ninguna de estas cifras la calcula este tablero: se leen y se etiquetan.";
  if (fallos.length) {
    nota += " No se pudo actualizar: " + fallos.map(function (f) {
      return f.id;
    }).join(", ") + ".";
  }
  texto($("ind-nota"), nota);
  texto($("ind-sub"), (ind.generado || "").slice(0, 10));
  $("indicadores").hidden = false;
}

/* --------------------------------------------------------------- temas */

/* Sin dos ventanas comparables el momento es ruido: en la primera corrida
   la ventana anterior esta vacia porque un feed RSS solo trae lo reciente,
   y todo saldria como "+N, subiendo". Se oculta hasta que haya historia. */
var MIN_PREVIAS = 20;

function pintarTemas(t) {
  if (!t || !t.temas || !t.temas.length) return;
  var hayMomento = t.notas_previas >= MIN_PREVIAS;

  texto($("temas-sub"), t.notas_ventana + " notas · " + t.ventana_dias + " días");

  var ol = $("temas-lista");
  ol.innerHTML = "";
  t.temas.slice(0, 12).forEach(function (x) {
    var li = document.createElement("li");

    var cab = document.createElement("div");
    cab.className = "tema-cab";
    var term = document.createElement("span");
    term.className = "tema-term";
    term.textContent = x.termino;
    cab.appendChild(term);

    var n = document.createElement("span");
    n.className = "tema-n";
    n.textContent = x.n + (x.n === 1 ? " nota" : " notas");
    cab.appendChild(n);

    if (hayMomento && x.momento !== 0) {
      var m = document.createElement("span");
      m.className = "tema-mom " + (x.momento > 0 ? "sube" : "baja");
      m.textContent = (x.momento > 0 ? "+" : "") + x.momento;
      m.title = "contra las " + t.notas_previas + " notas de la ventana anterior";
      cab.appendChild(m);
    }
    if (x.un_solo_medio) {
      var s = document.createElement("span");
      s.className = "etiqueta";
      s.textContent = "un solo medio";
      s.title = "Un tema sostenido por un medio es la agenda de ese medio, no de la región";
      cab.appendChild(s);
    }
    li.appendChild(cab);

    var zs = document.createElement("p");
    zs.className = "tema-zonas";
    zs.textContent = Object.keys(x.zonas).slice(0, 4).map(function (z) {
      return z + " " + x.zonas[z];
    }).join(" · ");
    li.appendChild(zs);

    if (x.ejemplos && x.ejemplos.length) {
      var ej = document.createElement("p");
      ej.className = "tema-ej";
      ej.textContent = x.ejemplos[0];
      li.appendChild(ej);
    }
    ol.appendChild(li);
  });

  var nota = "Agrupamiento por repetición de frases en los titulares, sin modelo. " +
    "Se cuentan notas, no porcentajes, y no se publica nada con menos de " +
    t.minimo + " notas.";
  if (!hayMomento) {
    nota += " La tendencia (sube o baja) aparece cuando haya dos semanas de " +
      "historia; ahora la ventana anterior tiene " + t.notas_previas + " notas.";
  }
  texto($("temas-nota"), nota);
  $("temas").hidden = false;
}

/* --------------------------------------------------- conversacion (YT) */

function pintarConversacion(c) {
  if (!c) return;
  var cuerpo = $("conv-cuerpo");
  cuerpo.innerHTML = "";

  var canales = c.canales || [];
  var sinLlave = canales.length && canales.every(function (s) {
    return s.estado === "sin_llave";
  });

  if (sinLlave || !c.comentarios_vigentes) {
    var p = document.createElement("p");
    p.className = "vacio-panel";
    p.textContent = sinLlave
      ? "Sin llave de la API de YouTube configurada, así que no hay comentarios que medir. " +
        "El resto del tablero funciona igual: es degradación esperada, no una falla."
      : "Sin comentarios vigentes en el corte actual.";
    cuerpo.appendChild(p);
  } else {
    texto($("conv-sub"), c.comentarios_vigentes + " comentarios vigentes");

    var cols = document.createElement("div");
    cols.className = "conv-cols";

    cols.appendChild(bloqueConteo("Por zona", c.por_zona));
    cols.appendChild(bloqueConteo("Por canal", c.por_canal));
    if (c.por_figura && Object.keys(c.por_figura).length) {
      var etiquetas = {};
      Object.keys(c.por_figura).forEach(function (k) {
        etiquetas[nombreCorto(k)] = c.por_figura[k];
      });
      cols.appendChild(bloqueConteo("Figuras mencionadas", etiquetas));
    }
    cuerpo.appendChild(cols);

    if (c.por_tema && c.por_tema.length) {
      var temaTitulo = document.createElement("h3");
      temaTitulo.className = "conv-sub-h conv-tema-titulo";
      temaTitulo.textContent = "Qué se comenta sobre las noticias principales";
      cuerpo.appendChild(temaTitulo);

      var selector = document.createElement("div");
      selector.className = "conv-selector";
      selector.setAttribute("role", "group");
      selector.setAttribute("aria-label", "Tema de conversación");
      var detalle = document.createElement("div");
      detalle.className = "conv-detalle";

      function pintarDetalleTema(indice) {
        var elegido = c.por_tema[indice];
        Array.prototype.forEach.call(selector.children, function (b, i) {
          b.setAttribute("aria-pressed", String(i === indice));
        });
        detalle.innerHTML = "";
        var metricas = [
          ["Comentarios", elegido.comentarios],
          ["Videos", elegido.videos],
          ["Likes + respuestas", elegido.interacciones],
          ["Preguntas", elegido.preguntas]
        ];
        var dl = document.createElement("dl");
        dl.className = "conv-metricas";
        metricas.forEach(function (m) {
          var grupo = document.createElement("div");
          var dt = document.createElement("dt");
          dt.textContent = m[0];
          var dd = document.createElement("dd");
          dd.textContent = m[1];
          grupo.appendChild(dt);
          grupo.appendChild(dd);
          dl.appendChild(grupo);
        });
        detalle.appendChild(dl);
        if (elegido.subtemas && elegido.subtemas.length) {
          var etiqueta = document.createElement("p");
          etiqueta.className = "conv-detalle-etiqueta";
          etiqueta.textContent = "Lo que más se repite dentro del tema";
          detalle.appendChild(etiqueta);
          var lista = document.createElement("ul");
          lista.className = "conv-temas";
          elegido.subtemas.forEach(function (subtema) {
            var li = document.createElement("li");
            li.textContent = subtema.termino + " ";
            var cuenta = document.createElement("span");
            cuenta.className = "tema-n";
            cuenta.textContent = subtema.n;
            li.appendChild(cuenta);
            lista.appendChild(li);
          });
          detalle.appendChild(lista);
        }
      }

      c.por_tema.forEach(function (tema, indice) {
        var boton = document.createElement("button");
        boton.type = "button";
        boton.textContent = tema.tema;
        boton.addEventListener("click", function () { pintarDetalleTema(indice); });
        selector.appendChild(boton);
      });
      cuerpo.appendChild(selector);
      cuerpo.appendChild(detalle);
      pintarDetalleTema(0);
    }

    if (c.temas && c.temas.length) {
      var h = document.createElement("h3");
      h.className = "conv-sub-h";
      h.textContent = "De qué se habla";
      cuerpo.appendChild(h);
      var ul = document.createElement("ul");
      ul.className = "conv-temas";
      c.temas.slice(0, 10).forEach(function (t) {
        var li = document.createElement("li");
        li.innerHTML = "";
        var term = document.createElement("span");
        term.className = "tema-term";
        term.textContent = t.termino;
        li.appendChild(term);
        var n = document.createElement("span");
        n.className = "tema-n";
        n.textContent = t.n;
        li.appendChild(n);
        ul.appendChild(li);
      });
      cuerpo.appendChild(ul);
    }
  }

  /* El aviso no es decorativo. Es la razon por la que este panel no muestra
     comentarios textuales y por la que el repo no los guarda. */
  texto($("conv-nota"),
    "Comentarios de YouTube leídos con la API oficial, en canales verificados y " +
    "búsquedas acotadas por los temas de prensa. Se publican conteos y temas " +
    "calculados, nunca el texto de un comentario ni quién lo escribió: " +
    "las Políticas para Desarrolladores de YouTube limitan el almacenamiento " +
    "a " + (c.retencion_dias || 30) + " días y un repo de git no puede borrar. " +
    "Esto mide volumen de conversación en canales de noticias, que no es lo " +
    "mismo que la opinión de la población.");
  $("conversacion").hidden = false;
}

function bloqueConteo(titulo, mapa) {
  var d = document.createElement("div");
  var h = document.createElement("h3");
  h.className = "conv-sub-h";
  h.textContent = titulo;
  d.appendChild(h);
  var ul = document.createElement("ul");
  ul.className = "conteos";
  Object.keys(mapa).slice(0, 8).forEach(function (k) {
    var li = document.createElement("li");
    var a = document.createElement("span");
    a.textContent = k;
    var b = document.createElement("span");
    b.className = "conteo-n";
    b.textContent = mapa[k];
    li.appendChild(a);
    li.appendChild(b);
    ul.appendChild(li);
  });
  d.appendChild(ul);
  return d;
}

/* ----------------------------------------------------------- cobertura */

/* Todas las zonas del producto, incluso las que hoy salen en cero. Un cero
   rotulado es informacion; una zona ausente de la lista parece un olvido. */
var ZONAS_PRODUCTO = ["Tijuana", "Mexicali", "Ensenada", "Playas de Rosarito",
                      "Tecate", "San Quintín", "San Felipe", "San Diego", "estatal"];

function pintarCobertura(est) {
  if (!est || !est.por_zona) return;
  var por = est.por_zona;
  var max = 0;
  ZONAS_PRODUCTO.forEach(function (z) { max = Math.max(max, por[z] || 0); });
  if (!max) return;

  var ul = $("cobertura-lista");
  ul.innerHTML = "";
  ZONAS_PRODUCTO.forEach(function (z) {
    var n = por[z] || 0;
    var li = document.createElement("li");
    if (!n) li.className = "cero";

    var et = document.createElement("span");
    et.className = "barra-et";
    et.textContent = z;
    li.appendChild(et);

    var pista = document.createElement("span");
    pista.className = "barra-pista";
    var barra = document.createElement("span");
    barra.className = "barra";
    barra.style.width = Math.round((n / max) * 100) + "%";
    pista.appendChild(barra);
    li.appendChild(pista);

    var num = document.createElement("span");
    num.className = "barra-n";
    num.textContent = n ? n : "sin cobertura";
    li.appendChild(num);

    ul.appendChild(li);
  });
  $("cobertura").hidden = false;
}

/* --------------------------------------------------------------- zonas */

/* Zonas de una nota para efectos de agrupar. Una nota de la garita es de
   Tijuana Y de San Diego y sale en las dos. Una nota nacional no se le
   inventa zona: se agrupa aparte. */
function zonasDeNota(n) {
  return (n.zonas && n.zonas.length) ? n.zonas : ["nacional"];
}

function zonasDe(notas) {
  var cuenta = {};
  notas.forEach(function (n) {
    zonasDeNota(n).forEach(function (z) { cuenta[z] = (cuenta[z] || 0) + 1; });
  });
  var orden = ZONAS_PRODUCTO.concat(["nacional"]);
  return Object.keys(cuenta).sort(function (a, b) {
    var ia = orden.indexOf(a), ib = orden.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  }).map(function (z) { return { zona: z, n: cuenta[z] }; });
}

function pintarZonas() {
  var nav = $("zonas");
  nav.innerHTML = "";
  var opciones = [{ zona: null, etiqueta: "Toda la zona", n: estado.notas.length }];
  zonasDe(estado.notas).forEach(function (z) {
    opciones.push({ zona: z.zona, etiqueta: z.zona, n: z.n });
  });
  opciones.forEach(function (o) {
    var b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-pressed", String(estado.zona === o.zona));
    b.innerHTML = "";
    b.appendChild(document.createTextNode(o.etiqueta));
    var c = document.createElement("span");
    c.className = "cuenta";
    c.textContent = o.n;
    b.appendChild(c);
    b.addEventListener("click", function () {
      estado.zona = o.zona;
      pintarZonas();
      pintarMuro();
    });
    nav.appendChild(b);
  });
}

/* ---------------------------------------------------------------- muro */

function nodoNota(n) {
  var art = document.createElement("article");
  art.className = "nota";

  var c = cuando(n, estado.corte);
  var col = document.createElement("div");
  col.className = "cuando";
  col.appendChild(document.createTextNode(c.principal));
  if (c.edad) {
    var e = document.createElement("span");
    e.className = "edad";
    e.textContent = c.edad;
    col.appendChild(e);
  }
  art.appendChild(col);

  var cuerpo = document.createElement("div");

  var h = document.createElement("h3");
  var a = document.createElement("a");
  a.href = n.url;
  a.rel = "noopener nofollow";
  a.target = "_blank";
  a.textContent = n.titulo;
  h.appendChild(a);
  cuerpo.appendChild(h);

  var meta = document.createElement("p");
  meta.className = "meta";
  var dom = document.createElement("span");
  dom.textContent = n.dominio || n.fuente;
  meta.appendChild(dom);
  (n.figuras || []).forEach(function (f) {
    var chip = document.createElement("span");
    chip.className = "figura";
    chip.setAttribute("data-via", f.via);
    chip.textContent = nombreCorto(f.id);
    chip.title = (estado.roster[f.id] ? estado.roster[f.id].cargo + " · " : "") +
      (f.via === "cargo" ? "resuelto por cargo vigente a la fecha" : "nombrado en el titular") +
      " («" + f.clave + "»)";
    meta.appendChild(chip);
  });
  if (n.postura) {
    var p = document.createElement("span");
    p.className = "figura";
    p.textContent = n.postura.etiqueta + " (" + n.postura.metodo + ")";
    meta.appendChild(p);
  }
  cuerpo.appendChild(meta);

  art.appendChild(cuerpo);
  return art;
}

function pintarMuro() {
  pintarComunicados();
  var muro = $("muro");
  muro.innerHTML = "";

  var notas = estado.zona
    ? estado.notas.filter(function (n) { return zonasDeNota(n).indexOf(estado.zona) >= 0; })
    : estado.notas;

  if (!notas.length) {
    var v = document.createElement("p");
    v.className = "vacio";
    v.textContent = estado.notas.length
      ? "Sin notas en esta zona en el corte actual."
      : "Sin notas todavía. Corre el pipeline y vuelve a armar el sitio.";
    muro.appendChild(v);
    return;
  }

  var grupos = {};
  notas.forEach(function (n) {
    zonasDeNota(n).forEach(function (z) { (grupos[z] = grupos[z] || []).push(n); });
  });

  var orden = ZONAS_PRODUCTO.concat(["nacional"]);
  Object.keys(grupos).sort(function (a, b) {
    var ia = orden.indexOf(a), ib = orden.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  }).forEach(function (z) {
    var sec = document.createElement("section");
    sec.className = "zona";
    var h = document.createElement("h2");
    h.appendChild(document.createTextNode(z));
    var c = document.createElement("span");
    c.className = "cuenta";
    c.textContent = grupos[z].length;
    h.appendChild(c);
    sec.appendChild(h);
    grupos[z].forEach(function (n) { sec.appendChild(nodoNota(n)); });
    muro.appendChild(sec);
  });
}

/* --------------------------------------------------------------- arranque */

var comunicadosDatos = null, comunicadosCargando = false, comunicadosIntentados = false;

function pintarComunicados() {
  var seccion = $("comunicados"), cuerpo = $("comunicados-cuerpo");
  seccion.hidden = estado.zona !== "Tecate";
  if (seccion.hidden) return;
  if (!comunicadosIntentados) {
    comunicadosIntentados = true;
    comunicadosCargando = true;
    pedir("data/comunicados.json").then(function (datos) {
      comunicadosDatos = datos;
    }).catch(function () { comunicadosDatos = null; }).then(function () {
      comunicadosCargando = false;
      pintarComunicados();
    });
  }
  cuerpo.textContent = "";
  if (comunicadosCargando || !comunicadosDatos) {
    cuerpo.textContent = comunicadosCargando ? "Cargando comunicados…" : "Comunicados no disponibles en este corte.";
    return;
  }
  var datos = comunicadosDatos;
  var origen = document.createElement("p");
  origen.className = "meta";
  origen.textContent = "Gobierno de Tecate" + (datos.ultimo_exito ? " · Última lectura correcta: " + datos.ultimo_exito : "");
  cuerpo.appendChild(origen);
  if (datos.estado === "fallo" || datos.modo === "sin_red") {
    var aviso = document.createElement("p");
    aviso.className = "nota-panel";
    aviso.textContent = (datos.modo === "sin_red" ? "Ejemplo sin red. Estos titulares son datos de prueba. " : "") +
      (datos.estado === "fallo" ? "No se pudo actualizar la fuente. " + (datos.comunicados.length ? "Se conserva la última lectura correcta." : "Todavía no hay una lectura correcta disponible.") : "");
    cuerpo.appendChild(aviso);
  }
  if (!datos.comunicados.length) {
    var vacio = document.createElement("p");
    vacio.textContent = "Sin comunicados disponibles.";
    cuerpo.appendChild(vacio);
  }
  datos.comunicados.forEach(function (fila) {
    var articulo = document.createElement("article");
    articulo.className = "nota";
    var fecha = document.createElement("span");
    fecha.className = "meta";
    fecha.textContent = fila.fecha || "Sin fecha";
    var titulo = document.createElement("h3");
    var enlace = document.createElement("a");
    enlace.href = fila.url;
    enlace.target = "_blank";
    enlace.rel = "noopener noreferrer";
    enlace.textContent = fila.titulo;
    titulo.appendChild(enlace);
    articulo.appendChild(fecha);
    articulo.appendChild(titulo);
    cuerpo.appendChild(articulo);
  });
}

function fallido(x) { return x === null; }

Promise.all([
  pedir("data/estado.json").catch(function () { return null; }),
  pedir("data/fuentes.json").catch(function () { return null; }),
  pedir("data/notas.json").catch(function () { return null; }),
  pedir("data/temas.json").catch(function () { return null; }),
  pedir("data/conversacion.json").catch(function () { return null; }),
  pedir("data/indicadores.json").catch(function () { return null; }),
  pedir("config/roster.json").catch(function () { return null; })
]).then(function (r) {
  var est = r[0], fuentes = r[1], notas = r[2], temas = r[3],
      conv = r[4], ind = r[5], roster = r[6];

  if (roster && roster.figuras) {
    roster.figuras.forEach(function (f) { estado.roster[f.id] = f; });
  }
  var todas = (notas && notas.notas) ? notas.notas : [];
  // Las notas de fuera de la region no entran al muro. Vienen de cables de
  // grupo: el feed de El Imparcial trae Hermosillo y Ciudad Obregon.
  estado.notas = todas.filter(function (n) { return n.alcance !== "fuera"; });
  estado.descartadas = todas.length - estado.notas.length;
  estado.corte = est ? aFecha(est.generado) : null;

  pintarCifras(est, fuentes ? fuentes.fuentes : null);
  pintarBanda(est);
  pintarIndicadores(ind);
  pintarTemas(temas);
  pintarConversacion(conv);
  pintarCobertura(est);
  pintarSalud(fuentes ? fuentes.fuentes : null);
  pintarZonas();
  pintarMuro();

  if (fallido(notas)) {
    document.title = "Pulso N33 — sin datos";
  }
});
