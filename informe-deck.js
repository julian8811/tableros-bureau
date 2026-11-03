/**
 * Diagramación Informe TEC = mock informe-tec-referencia.html (láminas 16:9).
 * Consume el JSON del informe LLM + assets/colombia-photos.
 */
window.InformeDeck = (function () {
  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
    });
  }

  function num(v, d) {
    if (v == null || isNaN(Number(v))) return "—";
    return Number(v).toLocaleString("es-CO", {
      maximumFractionDigits: d == null ? 0 : d,
      minimumFractionDigits: d == null ? 0 : d
    });
  }

  var FOTO = {
    cover: "cover",
    toc: "toc",
    resumen: "resumen",
    tendencias: "tendencias",
    receptivo: "receptivo",
    emisores: "emisores",
    destinos: "destinos",
    reuniones: "reuniones",
    visitante: "visitante",
    oferta: "oferta",
    conectividad: "conectividad",
    marca: "marca",
    territorio: "territorio",
    gestion: "gestion",
    pronostico: "pronostico",
    salidas: "emisores",
    aereo: "conectividad"
  };

  function photoUrl(slot) {
    return "assets/colombia-photos/" + (slot || "cover") + ".jpg";
  }

  function slotFor(secId) {
    return FOTO[secId] || "resumen";
  }

  function logos(mode) {
    if (mode === "dark") {
      return (
        '<div class="logos on-dark compact">' +
        '<img class="logo-bureau" src="assets/logo_bureau.svg" alt="Bureau Medellín">' +
        '<img class="logo-colmayor" src="assets/logo_colmayor_blanco.png?v=5" alt="Colmayor">' +
        "</div>"
      );
    }
    return (
      '<div class="logos on-light compact">' +
      '<img class="logo-bureau" src="assets/logo_bureau.svg" alt="Bureau Medellín">' +
      '<img class="logo-colmayor" src="assets/logo_colmayor_light.png?v=5" alt="Colmayor">' +
      "</div>"
    );
  }

  function photoFrame(slot, alt) {
    return (
      '<div class="photo-frame">' +
      '<img class="photo-img" src="' + esc(photoUrl(slot)) + '" alt="' + esc(alt || "Turismo Colombia") +
      '" loading="eager" decoding="async">' +
      '<p class="photo-credit">Foto: Wikimedia Commons · ' + esc(slot) + "</p>" +
      "</div>"
    );
  }

  var chartUid = 0;
  function nextId(p) {
    chartUid += 1;
    return p + chartUid;
  }

  function shortLabel(s, n) {
    var t = String(s || "");
    return t.length > n ? t.slice(0, n - 1) + "…" : t;
  }

  function svgBars(bars) {
    bars = (bars || []).filter(function (b) { return b && !isNaN(Number(b.value)); });
    if (!bars.length) {
      return '<svg class="chart-svg" viewBox="0 0 520 260"><text x="260" y="130" text-anchor="middle" fill="#7a8799" font-size="14">Sin serie</text></svg>';
    }
    var id = nextId("bf");
    var max = Math.max.apply(null, bars.map(function (b) { return Math.abs(Number(b.value)) || 0; }).concat([1]));
    var base = 220;
    var top = 28;
    var scale = (base - top) / max;
    var n = Math.max(bars.length, 1);
    var gap = n > 6 ? 14 : 28;
    var barW = Math.max(28, Math.min(56, Math.floor((420 - gap * (n - 1)) / n)));
    var startX = 70;
    var ticks = [0, 0.25, 0.5, 0.75, 1].map(function (t) {
      var y = base - max * t * scale;
      return '<line x1="48" y1="' + y + '" x2="500" y2="' + y + '" stroke="#cfd8e6"/>' +
        '<text x="42" y="' + (y + 4) + '" text-anchor="end" fill="#7a8799" font-size="10" font-family="Montserrat,Arial">' +
        esc(num(max * t, max >= 100 ? 0 : 1)) + "</text>";
    }).join("");
    var rects = bars.map(function (b, i) {
      var h = Math.max(8, Math.abs(Number(b.value) || 0) * scale);
      var x = startX + i * (barW + gap);
      var y = base - h;
      var fill = b.highlight ? "#FBBB28" : "url(#" + id + ")";
      return '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + h + '" fill="' + fill + '" rx="2"/>' +
        '<text x="' + (x + barW / 2) + '" y="' + (y - 6) + '" text-anchor="middle" fill="#172139" font-size="11" font-weight="700" font-family="Montserrat,Arial">' +
        esc(b.display != null ? b.display : b.value) + "</text>" +
        '<text x="' + (x + barW / 2) + '" y="242" text-anchor="middle" fill="#222" font-size="10" font-weight="600" font-family="Montserrat,Arial">' +
        esc(shortLabel(b.label, 12)) + "</text>";
    }).join("");
    return (
      '<svg class="chart-svg" viewBox="0 0 520 260" role="img">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#00AEAC"/><stop offset="100%" stop-color="#108181"/></linearGradient></defs>' +
      ticks + rects +
      '<line x1="48" y1="220" x2="500" y2="220" stroke="#172139" stroke-width="1.5"/>' +
      "</svg>"
    );
  }

  function svgHBars(bars) {
    bars = (bars || []).filter(function (b) { return b && !isNaN(Number(b.value)); });
    if (!bars.length) {
      return '<svg class="chart-svg" viewBox="0 0 520 260"><text x="260" y="130" text-anchor="middle" fill="#7a8799" font-size="14">Sin serie</text></svg>';
    }
    var id = nextId("hb");
    var max = Math.max.apply(null, bars.map(function (b) { return Math.abs(Number(b.value)) || 0; }).concat([1]));
    var left = 128;
    var right = 500;
    var top = 18;
    var rowH = Math.min(36, Math.floor(220 / Math.max(bars.length, 1)));
    var rows = bars.map(function (b, i) {
      var y = top + i * rowH;
      var w = Math.max(12, ((Math.abs(Number(b.value)) || 0) / max) * (right - left - 8));
      var fill = b.highlight ? "#FBBB28" : "url(#" + id + ")";
      return '<text x="120" y="' + (y + 14) + '" text-anchor="end" fill="#172139" font-size="11" font-weight="600" font-family="Montserrat,Arial">' +
        esc(shortLabel(b.label, 16)) + "</text>" +
        '<rect x="' + left + '" y="' + (y + 2) + '" width="' + w + '" height="16" fill="' + fill + '" rx="3"/>' +
        '<text x="' + (left + w + 6) + '" y="' + (y + 14) + '" fill="#172139" font-size="11" font-weight="700" font-family="Montserrat,Arial">' +
        esc(b.display != null ? b.display : b.value) + "</text>";
    }).join("");
    return (
      '<svg class="chart-svg" viewBox="0 0 520 260" role="img">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0%" stop-color="#108181"/><stop offset="100%" stop-color="#00AEAC"/></linearGradient></defs>' +
      rows + "</svg>"
    );
  }

  function textoBullet(b) {
    if (!b) return "";
    if (typeof b === "string") return b;
    return b.texto || "";
  }

  function slideCover(inf) {
    return (
      '<section class="slide cover" aria-label="Portada">' +
      '<span class="slide-label">1 · Portada</span>' +
      '<div class="cover-stage">' + photoFrame("cover", "Cartagena ciudad amurallada") + "</div>" +
      '<div class="top">' + logos("dark") +
      '<span class="turismo-tag">Turismo <i></i></span></div>' +
      '<div class="center">' +
      "<h1>" + esc(inf.titulo || "Informe de inteligencia turística") + "</h1>" +
      '<p class="period">' + esc(inf.subtitulo || ("Corte " + (inf.corte || "—"))) + "</p>" +
      "</div><div class=\"bar-maroon\"></div></section>"
    );
  }

  function slideToc(inf, secs) {
    var items = (secs || []).map(function (s, i) {
      return '<li><span class="n">' + ("0" + (i + 1)).slice(-2) + '</span><span class="v"></span><span class="t">' +
        esc(s.titulo || s.id) + "</span></li>";
    }).join("");
    return (
      '<section class="slide toc" aria-label="Contenido">' +
      '<span class="slide-label">2 · Contenido</span>' +
      '<div class="split">' + photoFrame("toc", "Contenido") +
      '<div class="panel white">' + logos("light") +
      "<h2>Contenido</h2><div class=\"rule\"></div><ol>" + items + "</ol>" +
      '<div class="bar-maroon"></div></div></div></section>'
    );
  }

  function slideResumen(inf) {
    var bullets = inf.resumen_ejecutivo || [];
    if (!bullets.length) return "";
    var lis = bullets.slice(0, 6).map(function (t) {
      return "<li>" + esc(typeof t === "string" ? t : (t.texto || "")) + "</li>";
    }).join("");
    return (
      '<section class="slide insight" aria-label="Resumen ejecutivo">' +
      '<span class="slide-label">3 · Resumen</span>' +
      '<div class="split">' + photoFrame("resumen", "Resumen") +
      '<div class="copy panel white">' +
      '<div class="text-box light logos-box">' + logos("light") + "</div>" +
      '<div class="text-box light body-box">' +
      '<p class="kicker-sec">Resumen ejecutivo</p>' +
      "<h2>Hallazgos del corte " + esc(inf.corte || "") + "</h2>" +
      '<div class="insight-cols"><div><p class="col-label">Síntesis</p><ul>' + lis +
      "</ul></div></div>" +
      '<p class="fuente">Bureau Medellín · Colmayor Manual V7 · Commons</p>' +
      '</div><div class="bar-maroon"></div></div></div></section>'
    );
  }

  function slideDivider(title, slot, label) {
    return (
      '<section class="slide divider" aria-label="Divisor ' + esc(title) + '">' +
      '<span class="slide-label">' + esc(label) + "</span>" +
      '<div class="split">' + photoFrame(slot, title) +
      '<div class="stack">' +
      '<div class="top-block"><div class="text-box dark">' + logos("dark") + "</div></div>" +
      '<div class="mid-block"><div class="text-box gold">' + esc(title) + "</div></div>" +
      '<div class="bot-block"></div></div></div>' +
      '<div class="bar-maroon"></div></section>'
    );
  }

  function slideInsight(sec, label, slot) {
    var hall = (sec.bullets || []).slice(0, 4).map(function (b) {
      return "<li>" + esc(textoBullet(b)) + "</li>";
    }).join("");
    var ana = (sec.analisis || []).slice(0, 3).map(function (b) {
      return "<li>" + esc(textoBullet(b)) + "</li>";
    }).join("");
    var h2 = (sec.insights && sec.insights[0] && textoBullet(sec.insights[0])) ||
      (sec.bullets && sec.bullets[0] && textoBullet(sec.bullets[0])) ||
      sec.titulo ||
      "Hallazgo";
    if (h2.length > 140) h2 = h2.slice(0, 137) + "…";
    return (
      '<section class="slide insight" aria-label="' + esc(label) + '">' +
      '<span class="slide-label">' + esc(label) + "</span>" +
      '<div class="split">' + photoFrame(slot, sec.titulo) +
      '<div class="copy panel white">' +
      '<div class="text-box light logos-box">' + logos("light") + "</div>" +
      '<div class="text-box light body-box">' +
      '<p class="kicker-sec">Hallazgo</p>' +
      "<h2>" + esc(h2) + "</h2>" +
      '<div class="insight-cols">' +
      "<div><p class=\"col-label\">Datos</p><ul>" + (hall || "<li>—</li>") + "</ul></div>" +
      '<div class="analisis"><p class="col-label">Lectura</p><ul>' + (ana || "<li>—</li>") + "</ul></div>" +
      "</div>" +
      '<p class="fuente">Informe TEC-Bureau · ' + esc(sec.id) + " · Commons</p>" +
      '</div><div class="bar-maroon"></div></div></div></section>'
    );
  }

  function fmtBar(v, unidad) {
    var n0 = Number(v);
    if (isNaN(n0)) return "—";
    var u = String(unidad || "");
    if (/mixto|%|ocup/i.test(u) && Math.abs(n0) <= 100) {
      var p = Math.abs(n0) <= 1 ? n0 * 100 : n0;
      return p.toFixed(1).replace(".", ",") + (/cop|usd|tarifa/i.test(u) && Math.abs(n0) > 100 ? "" : "%");
    }
    if (/usd/i.test(u)) return "USD " + num(n0, Math.abs(n0) >= 100 ? 0 : 1);
    if (/cop|tarifa/i.test(u) || Math.abs(n0) >= 1000) return num(n0, 0);
    return num(n0, Math.abs(n0) >= 100 ? 0 : 1);
  }

  function barsFromGrafico(g) {
    if (!g || !g.labels || !g.values) return [];
    return g.labels.map(function (lab, i) {
      var v = Number(g.values[i]);
      if (isNaN(v)) v = 0;
      return {
        label: lab,
        value: Math.abs(v),
        raw: v,
        display: fmtBar(v, g.unidad),
        highlight: i === 0
      };
    });
  }

  /** Si hay escalas incompatibles (p. ej. 67 % vs 442k COP), partir en grupos. */
  function splitScaleGroups(bars) {
    if (!bars || bars.length < 2) return [bars || []];
    var vals = bars.map(function (b) { return Math.abs(Number(b.value)) || 0; }).filter(function (v) { return v > 0; });
    if (vals.length < 2) return [bars];
    var max = Math.max.apply(null, vals);
    var min = Math.min.apply(null, vals);
    if (max / min < 25) return [bars];
    var low = [];
    var high = [];
    bars.forEach(function (b) {
      var v = Math.abs(Number(b.value)) || 0;
      if (v <= 0) return;
      if (v / max < 0.05 || v < max / 25) low.push(b);
      else high.push(b);
    });
    if (!low.length || !high.length) return [bars];
    return [high, low];
  }

  function preferHBar(g, bars) {
    if (!bars) return false;
    if (bars.length >= 4) return true;
    var t = String((g && g.titulo) || "");
    return /rank|país|pais|motivo|emisor|destino|aerol|ruta|ciudad/i.test(t);
  }

  /** Series del pack abierto cuando el LLM manda mixto ilegible o vacío. */
  function packBarsFor(secId, data) {
    data = data || window.DATA || {};
    var anio = String((data.informe && data.informe.corte || "2025").slice(0, 4));
    function topRows(obj, keyAnio, mapFn) {
      var rows = (obj && obj[keyAnio]) || (obj && obj[anio]) || [];
      if (!rows.length && obj) {
        var keys = Object.keys(obj);
        if (keys.length) rows = obj[keys[keys.length - 1]] || [];
      }
      return (rows || []).slice(0, 6).map(mapFn);
    }
    if (secId === "emisores" || secId === "salidas") {
      var mig = (data.migracion && data.migracion.top_paises) || {};
      var bars = topRows(mig, anio, function (r, i) {
        return {
          label: r.pais,
          value: Number(r.entradas || r.visitantes) || 0,
          display: num(r.entradas || r.visitantes),
          highlight: i === 0
        };
      });
      if (bars.length) return { titulo: "Top emisores Migración " + anio, bars: bars, kind: "hbar", fuente: "migracion.top_paises" };
    }
    if (secId === "receptivo" || secId === "destinos") {
      var min = (data.mincitVnr && data.mincitVnr.top_paises) || {};
      var barsM = topRows(min, anio, function (r, i) {
        return {
          label: r.pais,
          value: Number(r.visitantes) || 0,
          display: num(r.visitantes),
          highlight: i === 0
        };
      });
      if (barsM.length) return { titulo: "Top MinCIT VNR Medellín " + anio, bars: barsM, kind: "hbar", fuente: "mincit_vnr.top_paises" };
    }
    if (secId === "conectividad" || secId === "aereo") {
      var aero = ((data.conectividad && data.conectividad.aerolineas) || []).filter(function (r) {
        return String(r.anio) === anio;
      }).slice(0, 6);
      if (aero.length) {
        return {
          titulo: "Pasajeros por aerolínea " + anio,
          bars: aero.map(function (r, i) {
            return {
              label: r.aerolinea || r.nombre || "—",
              value: Number(r.pasajeros || r.valor) || 0,
              display: num(r.pasajeros || r.valor),
              highlight: i === 0
            };
          }),
          kind: "hbar",
          fuente: "conectividad.aerolineas"
        };
      }
    }
    if (secId === "visitante") {
      var ola = (data.evi && data.evi.olas && data.evi.olas[0]) || data.evi || {};
      var motivos = ola.motivos || [];
      if (motivos.length) {
        return {
          titulo: "Motivos EVI (% participación)",
          bars: motivos.slice(0, 5).map(function (m, i) {
            var p = Number(m.participacion);
            if (p <= 1) p = p * 100;
            return {
              label: m.nombre,
              value: p,
              display: p.toFixed(1).replace(".", ",") + "%",
              highlight: i === 0
            };
          }),
          kind: "hbar",
          fuente: "evi_ola.motivos"
        };
      }
    }
    if (secId === "tendencias") {
      var serie = (data.ema && data.ema.serie) || [];
      var last = serie.slice(-5);
      if (last.length) {
        return {
          titulo: "Índice EMA Antioquia (últimos meses)",
          bars: last.map(function (r, i) {
            return {
              label: String(r.anio) + "-" + String(r.mes || "").padStart(2, "0").slice(-2),
              value: Number(r.indice_antioquia) || 0,
              display: String(r.indice_antioquia != null ? r.indice_antioquia : "—"),
              highlight: i === last.length - 1
            };
          }),
          kind: "bars",
          fuente: "ema.serie"
        };
      }
    }
    if (secId === "marca") {
      var marca = data.bureauMarca || {};
      var cats = marca.categorias || marca.top || [];
      if (cats.length) {
        return {
          titulo: "Share menciones marca",
          bars: cats.slice(0, 5).map(function (c, i) {
            return {
              label: c.nombre || c.categoria || c.label || "—",
              value: Number(c.valor || c.share || c.pct) || 0,
              display: num(c.valor || c.share || c.pct, 1),
              highlight: i === 0
            };
          }),
          kind: "hbar",
          fuente: "bureauMarca"
        };
      }
    }
    return null;
  }

  function chartBox(title, svg) {
    return '<div class="chart-box"><h3>' + esc(title) + "</h3>" + svg + "</div>";
  }

  function slideChart(sec, label, data) {
    var g = sec.grafico;
    var bullets = (sec.bullets || []).slice(0, 4).map(function (b) {
      return "<li>" + esc(textoBullet(b)) + "</li>";
    }).join("");
    var packs = packBarsFor(sec.id, data);
    var groups = [];
    var titulo = (g && g.titulo) || (sec.titulo + " · figura") || "Gráfico";
    var fuente = "Figura informe · " + (sec.id || "");

    if (g && g.labels && g.labels.length) {
      var bars = barsFromGrafico(g);
      var mixto = /mixto/i.test(String(g.unidad || ""));
      var parts = (mixto || bars.length >= 2) ? splitScaleGroups(bars) : [bars];
      var sparse = parts.length > 1 && parts.every(function (p) { return p.length <= 1; });
      if (sparse) {
        /* Un punto por escala: mejor KPI cards + serie del pack si existe */
        var cards = bars.map(function (b) {
          return '<article class="kpi-card text-box light">' +
            '<p class="kpi-label">' + esc(b.label) + "</p>" +
            '<p class="kpi-value">' + esc(b.display) + "</p></article>";
        }).join("");
        if (packs && packs.bars && packs.bars.length >= 2) {
          groups.push({
            title: packs.titulo,
            svg: packs.kind === "hbar" ? svgHBars(packs.bars) : svgBars(packs.bars)
          });
          fuente = packs.fuente + " · KPIs LLM";
          titulo = packs.titulo;
          var figurePack = chartBox(groups[0].title, groups[0].svg);
          return (
            '<section class="slide chart-page" aria-label="' + esc(label) + '">' +
            '<span class="slide-label">' + esc(label) + "</span>" +
            '<div class="head"><h2>' + esc(titulo) + "</h2>" + logos("light") + "</div>" +
            '<div class="chart-body">' +
            '<div><ul>' + (bullets || "") + '</ul><div class="kpi-grid" style="margin-top:12px">' + cards + "</div></div>" +
            figurePack +
            "</div>" +
            '<p class="fuente">' + esc(fuente) + "</p>" +
            '<div class="bar-maroon"></div></section>'
          );
        }
        return (
          '<section class="slide kpi-photo" aria-label="' + esc(label) + '">' +
          '<span class="slide-label">' + esc(label) + "</span>" +
          '<div class="kpi-photo-stage">' + photoFrame(slotFor(sec.id), titulo) +
          '<div class="kpi-overlay">' +
          '<div class="text-box dark kpi-head">' + logos("dark") + "<h2>" + esc(titulo) + "</h2></div>" +
          '<div class="kpi-grid">' + cards + "</div>" +
          '<p class="fuente on-photo">Indicadores mixtos · sin forzar una sola escala</p>' +
          "</div></div><div class=\"bar-maroon\"></div></section>"
        );
      }
      if (parts.length > 1) {
        parts.forEach(function (grp, i) {
          groups.push({
            title: titulo + (i === 0 ? " · escala A" : " · escala B"),
            svg: preferHBar(g, grp) ? svgHBars(grp) : svgBars(grp)
          });
        });
      } else {
        var useH = preferHBar(g, bars) || (mixto && bars.length >= 3);
        groups.push({
          title: titulo + (g.unidad ? " · " + g.unidad : ""),
          svg: useH ? svgHBars(bars) : svgBars(bars)
        });
      }
      if (mixto && packs && packs.bars && packs.bars.length >= 3 && groups.length <= 2) {
        groups = [{
          title: packs.titulo,
          svg: packs.kind === "hbar" ? svgHBars(packs.bars) : svgBars(packs.bars)
        }];
        fuente = packs.fuente;
        titulo = packs.titulo;
      }
    } else if (packs && packs.bars && packs.bars.length) {
      groups.push({
        title: packs.titulo,
        svg: packs.kind === "hbar" ? svgHBars(packs.bars) : svgBars(packs.bars)
      });
      fuente = packs.fuente;
      titulo = packs.titulo;
    } else {
      return "";
    }

    var figure = groups.length === 1
      ? chartBox(groups[0].title, groups[0].svg)
      : '<div class="chart-stack">' + groups.map(function (gr) {
        return chartBox(gr.title, gr.svg);
      }).join("") + "</div>";

    return (
      '<section class="slide chart-page' + (groups.length > 1 ? " chart-page-multi" : "") + '" aria-label="' + esc(label) + '">' +
      '<span class="slide-label">' + esc(label) + "</span>" +
      '<div class="head"><h2>' + esc(titulo) + "</h2>" + logos("light") + "</div>" +
      '<div class="chart-body">' +
      "<ul>" + (bullets || "<li>Serie del pack dashboard.</li>") + "</ul>" +
      figure +
      "</div>" +
      '<p class="fuente">' + esc(fuente) + "</p>" +
      '<div class="bar-maroon"></div></section>'
    );
  }

  function slideKpi(sec, label, slot) {
    var cards = [];
    (sec.bullets || []).slice(0, 4).forEach(function (b) {
      var t = textoBullet(b);
      var m = t.match(/([\d.,]+)\s*(%|USD|COP|M|k)?/i);
      if (!m) return;
      cards.push({
        label: shortLabel(t.replace(m[0], "").replace(/^[,:\s]+/, "") || sec.titulo, 42),
        value: m[1] + (m[2] ? " " + m[2] : ""),
        note: b.fuente || ""
      });
    });
    if (cards.length < 2) return "";
    var cardsHtml = cards.map(function (c) {
      return '<article class="kpi-card text-box light">' +
        '<p class="kpi-label">' + esc(c.label) + "</p>" +
        '<p class="kpi-value">' + esc(c.value) + "</p>" +
        (c.note ? '<p class="kpi-note">' + esc(c.note) + "</p>" : "") +
        "</article>";
    }).join("");
    return (
      '<section class="slide kpi-photo" aria-label="' + esc(label) + '">' +
      '<span class="slide-label">' + esc(label) + "</span>" +
      '<div class="kpi-photo-stage">' + photoFrame(slot, sec.titulo) +
      '<div class="kpi-overlay">' +
      '<div class="text-box dark kpi-head">' + logos("dark") +
      "<h2>" + esc(sec.titulo || "Indicadores") + "</h2></div>" +
      '<div class="kpi-grid">' + cardsHtml + "</div>" +
      '<p class="fuente on-photo">KPIs de la sección · Commons</p>' +
      "</div></div>" +
      '<div class="bar-maroon"></div></section>'
    );
  }

  function slideTable(sec, label) {
    var t = sec.tabla;
    if (!t || !t.columnas || !t.filas || !t.filas.length) {
      /* Tabla sintética desde gráfico si no hay tabla LLM */
      var g = sec.grafico;
      if (!g || !g.labels || !g.labels.length) return "";
      t = {
        titulo: (g.titulo || sec.titulo) + " · datos",
        columnas: ["Categoría", "Valor"],
        filas: g.labels.map(function (lab, i) {
          return [lab, fmtBar(g.values[i], g.unidad)];
        })
      };
    }
    var head = t.columnas.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("");
    var body = t.filas.slice(0, 12).map(function (fila) {
      return "<tr>" + (fila || []).map(function (cel) {
        return "<td>" + esc(typeof cel === "number" ? num(cel, Math.abs(cel) >= 100 ? 0 : 1) : cel) + "</td>";
      }).join("") + "</tr>";
    }).join("");
    var side = (sec.analisis || sec.insights || []).slice(0, 4).map(function (b) {
      return "<li>" + esc(textoBullet(b)) + "</li>";
    }).join("");
    return (
      '<section class="slide table-page" aria-label="' + esc(label) + '">' +
      '<span class="slide-label">' + esc(label) + "</span>" +
      '<div class="head"><h2>' + esc(t.titulo || sec.titulo || "Tabla") + "</h2>" + logos("light") + "</div>" +
      '<div class="table-grid">' +
      '<div class="table-wrap text-box light"><table><thead><tr>' + head +
      "</tr></thead><tbody>" + body + "</tbody></table></div>" +
      '<div class="side text-box light"><h3>Lectura</h3><ul>' +
      (side || "<li>Ver hallazgos de la sección.</li>") + "</ul></div></div>" +
      '<p class="fuente">Tabla · ' + esc(sec.id) + "</p>" +
      '<div class="bar-maroon"></div></section>'
    );
  }

  function ensureResumen(inf, secs) {
    if (inf.resumen_ejecutivo && inf.resumen_ejecutivo.length) return inf;
    var bullets = [];
    (secs || []).slice(0, 6).forEach(function (sec) {
      var b = (sec.insights && sec.insights[0]) || (sec.bullets && sec.bullets[0]);
      if (b) bullets.push(textoBullet(b));
    });
    if (!bullets.length) return inf;
    var clone = {};
    Object.keys(inf).forEach(function (k) { clone[k] = inf[k]; });
    clone.resumen_ejecutivo = bullets;
    return clone;
  }

  /** Render completo del deck (mismo markup que el mock de Generar). */
  function render(inf, opts) {
    opts = opts || {};
    if (!inf) return "";
    chartUid = 0;
    var data = opts.data || window.DATA || {};
    var secs = opts.secciones || inf.secciones || [];
    inf = ensureResumen(inf, secs);
    var parts = [];
    var n = 1;
    function lab(txt) {
      var s = n + " · " + txt;
      n += 1;
      return s;
    }
    parts.push(slideCover(inf));
    n = 2;
    parts.push(slideToc(inf, secs));
    n = 3;
    var res = slideResumen(inf);
    if (res) {
      parts.push(res);
    }
    secs.forEach(function (sec) {
      var slot = slotFor(sec.id);
      var titulo = sec.titulo || sec.id;
      parts.push(slideDivider(titulo, slot, lab("Divisor " + (sec.id || ""))));
      parts.push(slideInsight(sec, lab("Insight"), slot));
      var kpi = slideKpi(sec, lab("KPI"), slot);
      if (kpi) parts.push(kpi);
      var ch = slideChart(sec, lab("Gráfico"), data);
      if (ch) parts.push(ch);
      var tb = slideTable(sec, lab("Tabla"));
      if (tb) parts.push(tb);
    });
    return (
      '<div class="deck tec-deck" id="pieza-export" data-export="informe-tec-deck">' +
      parts.join("") +
      "</div>"
    );
  }

  return {
    render: render,
    photoUrl: photoUrl,
    cssHref: "design-options/informe-tec-deck.css"
  };
}());
