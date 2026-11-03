/* Gráficos SVG — Opción A (claros + callouts) sobre fondo navy Colmayor V7.
   Morado/hatch solo para simulación. */
window.Charts = (function () {
  var palette = ["#E9901E", "#108181", "#FBBB28", "#195855", "#00AEAC", "#172139", "#B4C42C"];
  var SIM = "#6E5A8A";
  var foco = "";
  var serieSvg = 0;

  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
    });
  }

  function eje(n) {
    var abs = Math.abs(n);
    if (abs >= 1000000) return (n / 1000000).toFixed(1).replace(".", ",") + " M";
    if (abs >= 1000) return Math.round(n / 1000) + " mil";
    if (abs >= 10) return String(Math.round(n));
    return (Math.round(n * 10) / 10).toString().replace(".", ",");
  }

  var MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  function formatX(label) {
    var s = String(label == null ? "" : label);
    var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2})(?::(\d{2}))?)?/);
    if (iso) {
      var out = Number(iso[3]) + " " + MESES_CORTOS[Number(iso[2]) - 1];
      if (iso[4] != null) out += " " + Number(iso[4]) + "h";
      return out;
    }
    var ym = s.match(/^(\d{4})-(\d{2})$/);
    if (ym) return MESES_CORTOS[Number(ym[2]) - 1] + " " + ym[1].slice(2);
    return s;
  }

  function uid(prefix) {
    serieSvg += 1;
    return (prefix || "g") + serieSvg;
  }

  function trama() {
    var id = uid("trama");
    var def = '<pattern id="' + id + '" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(32)">' +
      '<rect width="6" height="6" fill="#16233a"></rect>' +
      '<line x1="0" y1="0" x2="0" y2="6" stroke="' + SIM + '" stroke-width="2"></line></pattern>';
    return { id: id, def: def };
  }

  function fxDefs(color) {
    var gid = uid("grad");
    var fid = uid("glow");
    return {
      gid: gid,
      fid: fid,
      def:
        '<linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.38"/>' +
        '<stop offset="100%" stop-color="' + color + '" stop-opacity="0"/>' +
        "</linearGradient>" +
        '<filter id="' + fid + '" x="-20%" y="-20%" width="140%" height="140%">' +
        '<feGaussianBlur stdDeviation="2.2" result="b"/>' +
        '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>' +
        "</filter>"
    };
  }

  function tinta(item, fallback, id) {
    if (item && item.sim) return "url(#" + id + ")";
    return (item && item.color) || fallback || palette[0];
  }

  function marca(item, tip) {
    var texto = tip || item.tip || "";
    if (!texto && item.label != null && item.value != null) texto = item.label + ": " + (item.text || eje(item.value));
    var html = "";
    if (texto) html += ' data-tip="' + esc(texto) + '"';
    if (item && item.pais) html += ' data-pais="' + esc(item.pais) + '"';
    if (item && item.pais && item.pais === foco) html += ' class="foco"';
    return html;
  }

  function leyenda(items) {
    if (!items || !items.length) return "";
    return '<div class="leyenda">' + items.map(function (item, i) {
      var fondo = item.sim ? SIM : item.color;
      return '<span><i class="' + (item.sim ? "sim" : "") + " trazo-" + (item.trazo == null ? i : item.trazo) + '" style="background:' + fondo + '"></i>' + esc(item.name) + "</span>";
    }).join("") + "</div>";
  }

  function figura(svg, items, sim) {
    return '<div class="figura marco' + (sim ? " simulado" : "") + '" tabindex="0">' + svg + leyenda(items) + "</div>";
  }

  function enmarcar(svg, sim) {
    return '<div class="marco' + (sim ? " simulado" : "") + '" tabindex="0">' + svg + "</div>";
  }

  function ejesTitulos(width, height, padL, padB, xLabel, yLabel) {
    var out = "";
    if (yLabel) {
      out += '<text x="14" y="' + (height / 2) + '" font-size="10" font-weight="700" fill="#9db3b3" text-anchor="middle" transform="rotate(-90 14 ' + (height / 2) + ')">' + esc(yLabel) + "</text>";
    }
    if (xLabel) {
      out += '<text x="' + ((padL + width - 12) / 2) + '" y="' + (height - 4) + '" font-size="10" font-weight="700" fill="#9db3b3" text-anchor="middle">' + esc(xLabel) + "</text>";
    }
    return out;
  }

  function grilla(width, height, padL, padB, max) {
    var top = 22;
    var plotH = height - padB - top;
    var marcas = [0, 0.5, 1];
    return marcas.map(function (t) {
      var y = top + plotH - t * plotH;
      return '<line x1="' + padL + '" y1="' + y + '" x2="' + (width - 12) + '" y2="' + y + '" stroke="#2c3a55" stroke-width="1" stroke-dasharray="3 4"></line>' +
        '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" font-size="10" font-weight="600" fill="#8fa3a3" text-anchor="end">' + esc(eje(max * t)) + "</text>";
    }).join("");
  }

  function yDe(value, max, height, padB) {
    var top = 22;
    var plotH = height - padB - top;
    return top + plotH - (value / max) * plotH;
  }

  function callout(x, y, text) {
    var w = Math.max(54, text.length * 7.2 + 14);
    var cx = Math.min(Math.max(x, w / 2 + 4), 640 - w / 2 - 4);
    var cy = Math.max(14, y - 22);
    return '<rect class="callout-bg" x="' + (cx - w / 2) + '" y="' + (cy - 11) + '" width="' + w + '" height="20" rx="6"></rect>' +
      '<text class="callout-t" x="' + cx + '" y="' + (cy + 3) + '" text-anchor="middle">' + esc(text) + "</text>" +
      '<circle cx="' + x + '" cy="' + y + '" r="5.5" fill="#FBBB28" stroke="#0b1220" stroke-width="2"></circle>';
  }

  function line(series, color, options) {
    options = options || {};
    var width = 640, height = 250, padL = 64, padB = 44;
    var xLabel = options.xLabel || "Mes";
    var yLabel = options.yLabel || "Cantidad";
    var patron = trama();
    var fx = fxDefs(color);
    if (!series.length) return "";
    var max = Math.max.apply(null, series.map(function (p) { return p.y; }).concat([options.mark || 0, 1]));
    var step = series.length === 1 ? 0 : (width - padL - 16) / (series.length - 1);
    var pts = series.map(function (p, i) {
      return (padL + i * step) + "," + yDe(p.y, max, height, padB);
    }).join(" ");
    var lastX = padL + (series.length - 1) * step;
    var area = padL + "," + yDe(0, max, height, padB) + " " + pts + " " + lastX + "," + yDe(0, max, height, padB);
    var maxTicks = series.length > 24 ? 5 : 6;
    var salto = Math.max(1, Math.ceil(series.length / maxTicks));
    var axis = series.filter(function (_, i) { return i % salto === 0 || i === series.length - 1; }).map(function (p, idx, arr) {
      var i = series.indexOf(p);
      if (i < 0) return "";
      // evitar dos etiquetas finales pegadas
      if (idx && i - series.indexOf(arr[idx - 1]) < Math.max(1, Math.floor(salto / 2)) && i !== series.length - 1) return "";
      var x = padL + i * step;
      var etiqueta = formatX(p.x);
      var ancla = (x + etiqueta.length * 5.5 > width - 12) ? "end" : (x < padL + 20 ? "start" : "middle");
      return '<text x="' + x + '" y="' + (height - 22) + '" font-size="10" font-weight="600" fill="#8fa3a3" text-anchor="' + ancla + '">' + esc(etiqueta) + "</text>";
    }).join("");
    var drawDots = series.length <= 36;
    var puntos = drawDots ? series.map(function (p, i) {
      var x = padL + i * step;
      var y = yDe(p.y, max, height, padB);
      return '<circle cx="' + x + '" cy="' + y + '" r="3.5" fill="' + color + '"' + marca({ tip: formatX(p.tip || p.x) + ": " + eje(p.y), pais: p.pais }) + "></circle>";
    }).join("") : "";
    var marcaY = "";
    if (options.mark != null) {
      var yMark = yDe(options.mark, max, height, padB);
      marcaY = '<line x1="' + padL + '" y1="' + yMark + '" x2="' + (width - 12) + '" y2="' + yMark + '" stroke="#B4C42C" stroke-dasharray="4 3" stroke-width="1.5"></line>';
    }
    var peak = 0;
    series.forEach(function (p, i) { if (p.y >= series[peak].y) peak = i; });
    var px = padL + peak * step;
    var py = yDe(series[peak].y, max, height, padB);
    var peakLabel = eje(series[peak].y);
    var svg = '<svg class="chart" viewBox="0 0 ' + width + " " + height + '" role="img"><defs>' + patron.def + fx.def + "</defs>" +
      grilla(width, height, padL, padB, max) + marcaY +
      '<polygon points="' + area + '" fill="url(#' + fx.gid + ')"></polygon>' +
      '<polyline fill="none" stroke="' + color + '" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" filter="url(#' + fx.fid + ')" points="' + pts + '"></polyline>' +
      puntos + callout(px, py, peakLabel) + axis + ejesTitulos(width, height, padL, padB, xLabel, yLabel) + "</svg>";
    var legend = [];
    if (options.mark != null) legend.push({ name: "Referencia " + options.mark, color: "#B4C42C" });
    legend.push({ name: "Pico / dato clave", color: "#FBBB28" });
    return figura(svg, legend);
  }

  function multiLine(series, options) {
    options = options || {};
    var width = 640, height = 270, padL = 64, padB = 44;
    var xLabel = options.xLabel || "Mes";
    var yLabel = options.yLabel || "Cantidad";
    var patron = trama();
    var labels = [];
    var max = 1;
    series.forEach(function (s) {
      s.points.forEach(function (p) {
        if (labels.indexOf(p.x) < 0) labels.push(p.x);
        if (p.y > max) max = p.y;
      });
    });
    if (!labels.length) return "";
    var step = labels.length === 1 ? 0 : (width - padL - 16) / (labels.length - 1);
    var salto = Math.ceil(labels.length / 6);
    var axis = labels.filter(function (_, i) { return i % salto === 0; }).map(function (label) {
      var i = labels.indexOf(label);
      var x = padL + i * step;
      var etiqueta = String(label);
      var ancla = (x + etiqueta.length * 6 > width - 12) ? "end" : "middle";
      return '<text x="' + x + '" y="' + (height - 22) + '" font-size="10" font-weight="600" fill="#8fa3a3" text-anchor="' + ancla + '">' + esc(etiqueta) + "</text>";
    }).join("");
    var defs = patron.def;
    var trazos = ["0", "6 5", "2 3", "9 3 2 3", "4 2"];
    var lineas = series.map(function (s, serie) {
      var fx = fxDefs(s.color);
      defs += fx.def;
      var ptsArr = s.points.map(function (p) {
        var i = labels.indexOf(p.x);
        return { x: padL + i * step, y: yDe(p.y, max, height, padB), p: p };
      });
      var pts = ptsArr.map(function (pt) { return pt.x + "," + pt.y; }).join(" ");
      var area = "";
      if (serie === 0 && ptsArr.length) {
        area = '<polygon points="' + ptsArr[0].x + "," + yDe(0, max, height, padB) + " " + pts + " " + ptsArr[ptsArr.length - 1].x + "," + yDe(0, max, height, padB) + '" fill="url(#' + fx.gid + ')"></polygon>';
      }
      var circulos = ptsArr.map(function (pt) {
        return '<circle cx="' + pt.x + '" cy="' + pt.y + '" r="3.5" fill="' + s.color + '"' + marca({ tip: s.name + " · " + pt.p.x + ": " + eje(pt.p.y), pais: s.pais }) + "></circle>";
      }).join("");
      var last = ptsArr[ptsArr.length - 1];
      var tip = last ? callout(last.x, last.y, eje(last.p.y)) : "";
      return area +
        '<polyline fill="none" stroke="' + s.color + '" stroke-width="' + (serie === 0 ? "2.8" : "2.2") + '" stroke-linecap="round" stroke-dasharray="' + trazos[serie % trazos.length] + '" filter="url(#' + fx.fid + ')" points="' + pts + '"></polyline>' +
        circulos + (serie === 0 ? tip : "");
    }).join("");
    var svg = '<svg class="chart" viewBox="0 0 ' + width + " " + height + '" role="img"><defs>' + defs + "</defs>" +
      grilla(width, height, padL, padB, max) + lineas + axis + ejesTitulos(width, height, padL, padB, xLabel, yLabel) + "</svg>";
    return figura(svg, series.map(function (s, i) { return { name: s.name, color: s.color, trazo: i }; }));
  }

  function bars(items, color, options) {
    options = options || {};
    var width = 640, row = 30, labelW = 168;
    var height = Math.max(56, items.length * row + 28);
    var patron = trama();
    var max = Math.max.apply(null, items.map(function (p) { return p.value; }).concat([1]));
    var sim = items.some(function (item) { return item.sim; });
    var trackW = width - labelW - 72;
    var xLabel = options.xLabel || "";
    var yLabel = options.yLabel || "";
    var body = items.map(function (item, i) {
      var y = 6 + i * row;
      var textoValor = String(item.text || eje(item.value));
      var w = Math.max(2, (item.value / max) * trackW);
      var baseColor = item.color || color || palette[i % palette.length];
      var relleno = tinta(item, baseColor, patron.id);
      var etiqueta = item.label || "";
      var visible = etiqueta.length > 24 ? etiqueta.slice(0, 23) + "…" : etiqueta;
      var gradId = uid("bar");
      var grad = item.sim ? "" :
        '<linearGradient id="' + gradId + '" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0%" stop-color="' + baseColor + '"/>' +
        '<stop offset="100%" stop-color="#00AEAC"/>' +
        "</linearGradient>";
      var fill = item.sim ? relleno : "url(#" + gradId + ")";
      return grad +
        '<text x="0" y="' + (y + 15) + '" font-size="11" font-weight="600" fill="#eef3f3">' + esc(visible) + "</text>" +
        '<rect class="track" x="' + labelW + '" y="' + (y + 2) + '" width="' + trackW + '" height="14" rx="7"></rect>' +
        '<rect x="' + labelW + '" y="' + (y + 2) + '" width="' + w + '" height="14" rx="7" fill="' + fill + '"' + marca(item) + "></rect>" +
        '<text x="' + (labelW + trackW + 8) + '" y="' + (y + 14) + '" font-size="11" font-weight="700" fill="#eef3f3">' + esc(textoValor) + "</text>";
    }).join("");
    var ejes = (yLabel ? '<text x="14" y="' + (height / 2) + '" font-size="10" font-weight="700" fill="#9db3b3" text-anchor="middle" transform="rotate(-90 14 ' + (height / 2) + ')">' + esc(yLabel) + "</text>" : "") +
      (xLabel ? '<text x="' + (labelW + trackW / 2) + '" y="' + (height - 6) + '" font-size="10" font-weight="700" fill="#9db3b3" text-anchor="middle">' + esc(xLabel) + "</text>" : "");
    return enmarcar('<svg class="chart" viewBox="0 0 ' + width + " " + height + '" role="img"><defs>' + patron.def + "</defs>" + body + ejes + "</svg>", sim && items.every(function (item) { return item.sim; }));
  }

  function columns(items, options) {
    options = options || {};
    var width = 640, height = 250, padL = 64, padB = 44;
    var xLabel = options.xLabel || "Categoría";
    var yLabel = options.yLabel || "Valor";
    var patron = trama();
    var max = options.max != null ? options.max : Math.max.apply(null, items.map(function (p) { return p.value; }).concat([1]));
    var gap = 10;
    var col = items.length ? (width - padL - 16 - gap * (items.length - 1)) / items.length : 0;
    var base = yDe(0, max, height, padB);
    var sim = items.length && items.every(function (item) { return item.sim; });
    var body = items.map(function (item, i) {
      var y = yDe(item.value, max, height, padB);
      var x = padL + i * (col + gap);
      var h = Math.max(0, base - y);
      var fill = tinta(item, palette[i % palette.length], patron.id);
      return '<rect x="' + x + '" y="' + y + '" width="' + col + '" height="' + h + '" rx="5" fill="' + fill + '"' + marca(item) + "></rect>" +
        '<text x="' + (x + col / 2) + '" y="' + Math.max(14, y - 6) + '" font-size="10" font-weight="700" fill="#eef3f3" text-anchor="middle">' + esc(item.text || eje(item.value)) + "</text>" +
        '<text x="' + (x + col / 2) + '" y="' + (height - 22) + '" font-size="10" font-weight="600" fill="#8fa3a3" text-anchor="middle">' + esc(item.label) + "</text>";
    }).join("");
    return enmarcar('<svg class="chart" viewBox="0 0 ' + width + " " + height + '" role="img"><defs>' + patron.def + "</defs>" + grilla(width, height, padL, padB, max) + body + ejesTitulos(width, height, padL, padB, xLabel, yLabel) + "</svg>", sim);
  }

  function stacked(items, options) {
    options = options || {};
    var width = 640, height = 270, padL = 64, padB = 44;
    var xLabel = options.xLabel || "Mes";
    var yLabel = options.yLabel || "Pasajeros";
    var patron = trama();
    var nombres = [];
    items.forEach(function (item) {
      (item.parts || []).forEach(function (part) {
        if (!nombres.some(function (n) { return n.name === part.name; })) nombres.push({ name: part.name, color: part.color, sim: part.sim });
      });
    });
    var max = 1;
    items.forEach(function (item) {
      var suma = (item.parts || []).reduce(function (s, p) { return s + p.value; }, 0);
      if (suma > max) max = suma;
    });
    var gap = 8;
    var col = items.length ? (width - padL - 16 - gap * (items.length - 1)) / items.length : 0;
    var body = items.map(function (item, i) {
      var x = padL + i * (col + gap);
      var cursor = 0;
      var rects = (item.parts || []).map(function (part) {
        var y0 = yDe(cursor, max, height, padB);
        cursor += part.value;
        var y1 = yDe(cursor, max, height, padB);
        var pieza = { label: item.label + " · " + part.name, value: part.value, pais: part.pais || item.pais, sim: part.sim, tip: item.label + " · " + part.name + ": " + eje(part.value) };
        return '<rect x="' + x + '" y="' + y1 + '" width="' + col + '" height="' + Math.max(0, y0 - y1) + '" rx="2" fill="' + tinta(part, part.color, patron.id) + '"' + marca(pieza) + "></rect>";
      }).join("");
      return rects + '<text x="' + (x + col / 2) + '" y="' + (height - 22) + '" font-size="10" font-weight="600" fill="#8fa3a3" text-anchor="middle">' + esc(item.label) + "</text>";
    }).join("");
    return figura('<svg class="chart" viewBox="0 0 ' + width + " " + height + '" role="img"><defs>' + patron.def + "</defs>" + grilla(width, height, padL, padB, max) + body + ejesTitulos(width, height, padL, padB, xLabel, yLabel) + "</svg>", nombres);
  }

  function grouped(groups, options) {
    options = options || {};
    var width = 640, height = 270, padL = 64, padB = 48;
    var xLabel = options.xLabel || "Periodo";
    var yLabel = options.yLabel || "Valor";
    var patron = trama();
    var nombres = [];
    var max = 1;
    groups.forEach(function (group) {
      (group.bars || []).forEach(function (bar) {
        if (bar.value > max) max = bar.value;
        if (!nombres.some(function (n) { return n.name === bar.name; })) nombres.push({ name: bar.name, color: bar.color, sim: bar.sim });
      });
    });
    var n = groups.length || 1;
    var gap = 16;
    var slot = (width - padL - 16 - gap * (n - 1)) / n;
    var base = yDe(0, max, height, padB);
    var body = groups.map(function (group, i) {
      var barsG = group.bars || [];
      var inner = 3;
      var w = Math.max(4, (slot - inner * (barsG.length - 1)) / (barsG.length || 1));
      var x0 = padL + i * (slot + gap);
      var rects = barsG.map(function (bar, j) {
        var y = yDe(bar.value, max, height, padB);
        var x = x0 + j * (w + inner);
        var pieza = { label: group.label + " · " + bar.name, value: bar.value, pais: bar.pais || group.pais, sim: bar.sim, text: bar.text, tip: group.label + " · " + bar.name + ": " + (bar.text || eje(bar.value)) };
        return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + Math.max(0, base - y) + '" rx="3" fill="' + tinta(bar, bar.color, patron.id) + '"' + marca(pieza) + "></rect>";
      }).join("");
      return rects + '<text x="' + (x0 + slot / 2) + '" y="' + (height - 26) + '" font-size="10" font-weight="600" fill="#8fa3a3" text-anchor="middle">' + esc(group.label) + "</text>";
    }).join("");
    return figura('<svg class="chart" viewBox="0 0 ' + width + " " + height + '" role="img"><defs>' + patron.def + "</defs>" + grilla(width, height, padL, padB, max) + body + ejesTitulos(width, height, padL, padB, xLabel, yLabel) + "</svg>", nombres);
  }

  function donut(items) {
    var patron = trama();
    var total = items.reduce(function (s, item) { return s + item.value; }, 0) || 1;
    var r = 54, c = 2 * Math.PI * r, offset = 0;
    var sim = items.length && items.every(function (item) { return item.sim; });
    var arcos = items.map(function (item) {
      var len = item.value / total * c;
      var stroke = item.sim ? SIM : item.color;
      var nodo = '<circle cx="80" cy="80" r="' + r + '" fill="none" stroke="' + stroke + '" stroke-width="18" stroke-linecap="butt" stroke-dasharray="' + len + " " + (c - len) + '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 80 80)"' + marca(item) + "></circle>";
      offset += len;
      return nodo;
    }).join("");
    var centro = items[0] ? Math.round(items[0].value / total * 100) : 0;
    var labelCentro = items.length === 1 ? (items[0].text || eje(items[0].value)) : (centro + "%");
    var subCentro = items.length === 1 ? (items[0].label || "") : "mayor parte";
    var svg = '<svg class="chart donut" viewBox="0 0 160 160" role="img"><defs>' + patron.def + "</defs>" +
      '<circle cx="80" cy="80" r="' + r + '" fill="none" stroke="#1a2438" stroke-width="18"></circle>' +
      arcos +
      '<text x="80" y="76" text-anchor="middle" font-size="18" font-weight="700" fill="#eef3f3">' + esc(labelCentro) + "</text>" +
      '<text x="80" y="94" text-anchor="middle" font-size="9" font-weight="700" fill="#8fa3a3">' + esc(subCentro) + "</text>" +
      "</svg>";
    return '<div class="figura marco donut-frame' + (sim ? " simulado" : "") + '" tabindex="0">' + svg + leyenda(items.map(function (item) {
      return { name: item.label + " · " + (item.text || eje(item.value)), color: item.sim ? SIM : item.color, sim: item.sim };
    })) + "</div>";
  }

  return {
    line: line,
    multiLine: multiLine,
    bars: bars,
    columns: columns,
    stacked: stacked,
    grouped: grouped,
    donut: donut,
    palette: palette,
    SIM: SIM,
    setFoco: function (valor) { foco = valor || ""; }
  };
}());
