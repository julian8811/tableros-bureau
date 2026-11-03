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
    bars = bars || [];
    var id = nextId("bf");
    var max = Math.max.apply(null, bars.map(function (b) { return Number(b.value) || 0; }).concat([1]));
    var base = 220;
    var top = 28;
    var scale = (base - top) / max;
    var n = Math.max(bars.length, 1);
    var gap = n > 6 ? 18 : 36;
    var barW = Math.min(52, Math.floor((420 - gap * (n - 1)) / n));
    var startX = 70;
    var rects = bars.map(function (b, i) {
      var h = Math.max(2, (Number(b.value) || 0) * scale);
      var x = startX + i * (barW + gap);
      var y = base - h;
      var fill = b.highlight ? "#FBBB28" : "url(#" + id + ")";
      return '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + h + '" fill="' + fill + '" rx="2"/>' +
        '<text x="' + (x + barW / 2) + '" y="' + (y - 6) + '" text-anchor="middle" fill="#172139" font-size="11" font-weight="700" font-family="Montserrat,Arial">' +
        esc(b.display != null ? b.display : b.value) + "</text>" +
        '<text x="' + (x + barW / 2) + '" y="242" text-anchor="middle" fill="#222" font-size="10" font-weight="600" font-family="Montserrat,Arial">' +
        esc(shortLabel(b.label, 11)) + "</text>";
    }).join("");
    return (
      '<svg class="chart-svg" viewBox="0 0 520 260" role="img">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#00AEAC"/><stop offset="100%" stop-color="#108181"/></linearGradient></defs>' +
      rects +
      '<line x1="48" y1="220" x2="500" y2="220" stroke="#172139" stroke-width="1.5"/>' +
      "</svg>"
    );
  }

  function svgHBars(bars) {
    bars = bars || [];
    var id = nextId("hb");
    var max = Math.max.apply(null, bars.map(function (b) { return Number(b.value) || 0; }).concat([1]));
    var left = 128;
    var right = 500;
    var top = 18;
    var rowH = Math.min(36, Math.floor(220 / Math.max(bars.length, 1)));
    var rows = bars.map(function (b, i) {
      var y = top + i * rowH;
      var w = ((Number(b.value) || 0) / max) * (right - left - 8);
      var fill = b.highlight ? "#FBBB28" : "url(#" + id + ")";
      return '<text x="120" y="' + (y + 14) + '" text-anchor="end" fill="#172139" font-size="11" font-weight="600" font-family="Montserrat,Arial">' +
        esc(shortLabel(b.label, 16)) + "</text>" +
        '<rect x="' + left + '" y="' + (y + 2) + '" width="' + Math.max(4, w) + '" height="16" fill="' + fill + '" rx="3"/>' +
        '<text x="' + (left + Math.max(4, w) + 6) + '" y="' + (y + 14) + '" fill="#172139" font-size="11" font-weight="700" font-family="Montserrat,Arial">' +
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

  function barsFromGrafico(g) {
    if (!g || !g.labels || !g.values) return [];
    return g.labels.map(function (lab, i) {
      var v = Number(g.values[i]);
      if (isNaN(v)) v = 0;
      var mixto = /mixto|%/i.test(String(g.unidad || ""));
      var display = mixto && Math.abs(v) <= 100
        ? (Math.abs(v) <= 1 ? (v * 100).toFixed(1) : v.toFixed(1)).replace(".", ",") + (String(g.unidad).indexOf("%") >= 0 || Math.abs(v) <= 100 ? "" : "")
        : num(v, Math.abs(v) >= 100 ? 0 : 1);
      return { label: lab, value: Math.abs(v), display: display, highlight: i === 0 };
    });
  }

  function slideChart(sec, label) {
    var g = sec.grafico;
    if (!g || !g.labels || !g.labels.length) return "";
    var bars = barsFromGrafico(g);
    var mixto = /mixto/i.test(String(g.unidad || ""));
    var many = bars.length >= 4;
    var svg = many || /rank|país|pais|motivo/i.test(String(g.titulo || ""))
      ? svgHBars(bars)
      : svgBars(bars);
    if (mixto && bars.length >= 2) {
      /* dos escalas: mostrar barras horizontales para legibilidad */
      svg = svgHBars(bars);
    }
    var bullets = (sec.bullets || []).slice(0, 4).map(function (b) {
      return "<li>" + esc(textoBullet(b)) + "</li>";
    }).join("");
    return (
      '<section class="slide chart-page" aria-label="' + esc(label) + '">' +
      '<span class="slide-label">' + esc(label) + "</span>" +
      '<div class="head"><h2>' + esc(g.titulo || sec.titulo || "Gráfico") + "</h2>" + logos("light") + "</div>" +
      '<div class="chart-body">' +
      "<ul>" + (bullets || "<li>Serie del pack dashboard.</li>") + "</ul>" +
      '<div class="chart-box"><h3>' + esc(g.titulo || "Figura") +
      (g.unidad ? " · " + esc(g.unidad) : "") + "</h3>" + svg + "</div></div>" +
      '<p class="fuente">Figura dashboard · ' + esc(sec.id) + "</p>" +
      '<div class="bar-maroon"></div></section>'
    );
  }

  function slideTable(sec, label) {
    var t = sec.tabla;
    if (!t || !t.columnas || !t.filas || !t.filas.length) return "";
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
      '<p class="fuente">Tabla dashboard · ' + esc(sec.id) + "</p>" +
      '<div class="bar-maroon"></div></section>'
    );
  }

  /** Render completo del deck (mismo markup que el mock de Generar). */
  function render(inf, opts) {
    opts = opts || {};
    if (!inf) return "";
    chartUid = 0;
    var secs = opts.secciones || inf.secciones || [];
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
    if (res) parts.push(res);
    secs.forEach(function (sec, i) {
      var slot = slotFor(sec.id);
      var titulo = sec.titulo || sec.id;
      parts.push(slideDivider(titulo, slot, lab("Divisor")));
      parts.push(slideInsight(sec, lab("Insight"), slot));
      var ch = slideChart(sec, lab("Gráfico"));
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
