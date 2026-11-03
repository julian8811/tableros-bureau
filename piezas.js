/* Piezas diagramación V7 · infografía A (implementada) + export HTML/PDF */
window.Piezas = (function () {
  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
    });
  }

  function num(v, d) {
    if (v == null || isNaN(v)) return "—";
    return Number(v).toLocaleString("es-CO", {
      maximumFractionDigits: d == null ? 0 : d,
      minimumFractionDigits: d == null ? 0 : d
    });
  }

  function pct(part, total) {
    if (!total) return "—";
    return ((part / total) * 100).toFixed(1).replace(".", ",") + " %";
  }

  function cortoMillones(v) {
    if (v == null || isNaN(v)) return "—";
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2).replace(".", ",") + " M";
    return num(v);
  }

  /** Snapshot emisores desde DATA del dashboard */
  function datosEmisores(DATA, anio) {
    anio = String(anio || 2025);
    var mig = ((DATA.migracion || {}).top_paises && (DATA.migracion.top_paises[anio] || [])) || [];
    var mincit = ((DATA.mincitVnr || {}).top_paises && (DATA.mincitVnr.top_paises[anio] || [])) || [];
    var share = (((DATA.mincitVnr || {}).shares || {}).anual || []).find(function (r) {
      return String(r.anio) === anio;
    });
    var medAnual = ((((DATA.mincitVnr || {}).anual) || []).find(function (r) {
      return String(r.anio) === anio;
    }) || {}).visitantes;
    var rows = mig.map(function (r) {
      return { pais: r.pais, valor: Number(r.entradas || r.visitantes) || 0 };
    });
    if (!rows.length) {
      rows = mincit.map(function (r) {
        return { pais: r.pais, valor: Number(r.visitantes) || 0 };
      });
    }
    rows.sort(function (a, b) { return b.valor - a.valor; });
    var total = rows.reduce(function (s, r) { return s + r.valor; }, 0);
    var mincitTop = mincit.map(function (r) {
      return { pais: r.pais, valor: Number(r.visitantes) || 0 };
    }).sort(function (a, b) { return b.valor - a.valor; }).slice(0, 5);
    return {
      anio: anio,
      top: rows.slice(0, 5),
      mincitTop: mincitTop,
      total: total,
      medellin: medAnual,
      shareColombia: share && share.share_colombia != null ? share.share_colombia : null,
      fuenteMig: "migracion.top_paises[" + anio + "]",
      fuenteMincit: "mincit_vnr · " + anio
    };
  }

  function nombreCorto(pais) {
    var s = String(pais || "");
    if (/Estados Unidos/i.test(s)) return "Estados Unidos";
    if (/Venezuela/i.test(s)) return "Venezuela";
    return s;
  }

  function codigoPais(pais) {
    var s = String(pais || "");
    if (/Estados Unidos/i.test(s)) return "US";
    if (/Venezuela/i.test(s)) return "VE";
    if (/M[eé]xico/i.test(s)) return "MX";
    if (/Ecuador/i.test(s)) return "EC";
    if (/Per[uú]/i.test(s)) return "PE";
    if (/Espa[nñ]a/i.test(s)) return "ES";
    if (/Brasil/i.test(s)) return "BR";
    if (/Chile/i.test(s)) return "CL";
    if (/Panam/i.test(s)) return "PA";
    if (/Costa Rica/i.test(s)) return "CR";
    if (/Argentina/i.test(s)) return "AR";
    if (/Canad/i.test(s)) return "CA";
    return (s.slice(0, 2) || "??").toUpperCase();
  }

  var STACK_COLORS = ["#FBBB28", "#E9901E", "#00AEAC", "#108181", "#B4C42C"];

  /** Infografía A · Hero KPI 1080×1080 (opción implementada) */
  function htmlInfografiaA(d) {
    d = d || {};
    var top = d.top || [];
    var t0 = top[0] || { pais: "—", valor: 0 };
    var t1 = top[1] || { pais: "—", valor: 0 };
    var t2 = top[2] || { pais: "—", valor: 0 };
    var shareTxt = d.shareColombia != null
      ? "Share CO " + (d.shareColombia * 100).toFixed(1).replace(".", ",") + " %"
      : "MinCIT VNR";
    return (
      '<article class="pieza-stage stage sq" id="pieza-export" data-export="infografia-a">' +
      '<div class="stage-bg" aria-hidden="true"></div>' +
      '<div class="stage-inner">' +
      '<header class="pieza-head">' +
      '<div class="logos dark">' +
      '<img class="logo-bureau" src="assets/logo_bureau.svg" alt="Greater Medellín Convention &amp; Visitors Bureau">' +
      '<img class="logo-colmayor" src="assets/logo_colmayor_blanco.png" alt="Colegio Mayor de Antioquia">' +
      "</div>" +
      '<div class="gold-bar"></div>' +
      '<p class="kicker">Inteligencia turística · Corte ' + esc(d.anio) + "</p>" +
      "</header>" +
      '<div class="hero-block">' +
      '<h1 class="h-title">' + esc(nombreCorto(t0.pais)) + " lidera las entradas a Colombia</h1>" +
      '<p class="lead">Mercados emisores con mayor tráfico hacia el país. Universo Migración Colombia (cruces de entrada), contrastable con MinCIT Medellín y EVI.</p>' +
      '<div class="kpi-hero glass">' +
      '<p class="label">Top emisor ' + esc(d.anio) + "</p>" +
      '<p class="value">' + esc(num(t0.valor)) + "</p>" +
      '<p class="meta">' + esc(nombreCorto(t0.pais)) + " · " + esc(pct(t0.valor, d.total)) + " del set publicado</p>" +
      "</div></div>" +
      '<div class="kpi-grid">' +
      '<div class="kpi glass"><p class="label">2.º ' + esc(nombreCorto(t1.pais)) + '</p><p class="value v-sm">' + esc(num(t1.valor)) + '</p><p class="meta">' + esc(pct(t1.valor, d.total)) + "</p></div>" +
      '<div class="kpi glass"><p class="label">3.º ' + esc(nombreCorto(t2.pais)) + '</p><p class="value v-sm">' + esc(num(t2.valor)) + '</p><p class="meta">' + esc(pct(t2.valor, d.total)) + "</p></div>" +
      '<div class="kpi glass"><p class="label">Medellín VNR</p><p class="value v-sm">' + esc(cortoMillones(d.medellin)) + '</p><p class="meta">' + esc(shareTxt) + "</p></div>" +
      "</div>" +
      '<footer class="foot">' +
      '<p class="fuente"><b>Fuente:</b> ' + esc(d.fuenteMig) + " · " + esc(d.fuenteMincit) + " · sin CRM</p>" +
      '<p class="fuente">Bureau Medellín · Colmayor V7</p>' +
      "</footer></div></article>"
    );
  }

  /** Infografía B · Ranking top 5 1080×1080 */
  function htmlInfografiaB(d) {
    d = d || {};
    var top = (d.top || []).slice(0, 5);
    var max = (top[0] && top[0].valor) || 1;
    var sumTop = top.reduce(function (s, r) { return s + (r.valor || 0); }, 0) || 1;
    var list = top.map(function (r, i) {
      var w = Math.max(4, Math.round((r.valor / max) * 100));
      return (
        "<li>" +
        '<span class="n">' + (i + 1) + "</span>" +
        '<span class="pais">' + esc(nombreCorto(r.pais)) + "</span>" +
        '<span class="val">' + esc(num(r.valor)) + "</span>" +
        '<span class="bar"><i style="width:' + w + '%;background:' + STACK_COLORS[i % STACK_COLORS.length] + '"></i></span>' +
        "</li>"
      );
    }).join("");
    var x = 0;
    var segs = top.map(function (r, i) {
      var w = Math.max(2, Math.round((r.valor / sumTop) * 640));
      if (i === top.length - 1) w = Math.max(2, 640 - x);
      var rect = '<rect x="' + x + '" y="28" width="' + w + '" height="14" rx="0" fill="' + STACK_COLORS[i % STACK_COLORS.length] + '"/>';
      x += w;
      return rect;
    }).join("");
    var codes = top.map(function (r) { return codigoPais(r.pais); }).join(" · ");
    return (
      '<article class="pieza-stage stage sq stage-rank" id="pieza-export" data-export="infografia-b">' +
      '<div class="stage-bg" aria-hidden="true"></div>' +
      '<div class="stage-inner stage-inner-rank">' +
      '<header class="pieza-head">' +
      '<div class="logos dark">' +
      '<img class="logo-bureau" src="assets/logo_bureau.svg" alt="Bureau">' +
      '<img class="logo-colmayor" src="assets/logo_colmayor_blanco.png" alt="Colmayor">' +
      "</div>" +
      '<div class="gold-bar"></div>' +
      '<p class="kicker">Emisores internacionales · ' + esc(d.anio) + "</p>" +
      '<h1 class="h-title h-rank">Top 5 países que generan tráfico a Colombia</h1>' +
      "</header>" +
      '<div class="rank-body">' +
      '<ol class="rank rank-bars">' + list + "</ol>" +
      '<p class="note-uni"><b>Universo:</b> Entradas de extranjeros a Colombia (Migración). No es destino Medellín ni pasajeros Aerocivil. Para ciudad usar MinCIT VNR.</p>' +
      '<svg class="stack-svg" viewBox="0 0 640 72" role="img" aria-label="Participación relativa del top 5">' +
      '<text x="0" y="14" fill="#9db3b3" font-size="11" font-family="Montserrat,Arial">Participación relativa del top 5</text>' +
      '<rect x="0" y="28" width="640" height="14" rx="7" fill="rgba(255,255,255,.08)"/>' +
      segs +
      '<text x="0" y="62" fill="#eef3f3" font-size="10" font-family="Montserrat,Arial" font-weight="600">' + esc(codes) + "</text>" +
      "</svg></div>" +
      '<footer class="foot">' +
      '<p class="fuente"><b>Fuente:</b> ' + esc(d.fuenteMig) + " · dataset 96sh-4v8d</p>" +
      '<p class="fuente">Bureau Medellín · Colmayor Manual V7</p>' +
      "</footer></div></article>"
    );
  }

  function mapaSvgEstatico() {
    return (
      '<svg viewBox="0 0 360 220" role="img" aria-label="Mapa densidad emisores simplificado">' +
      '<rect width="360" height="220" fill="#070d18"/>' +
      '<path d="M48 48h52v78H48z" fill="#FBBB28" opacity=".92"/>' +
      '<text x="56" y="90" fill="#172139" font-size="9" font-weight="700" font-family="Montserrat,Arial">US</text>' +
      '<path d="M58 128h28v36H58z" fill="#E9901E" opacity=".9"/>' +
      '<text x="62" y="150" fill="#fff" font-size="8" font-family="Montserrat,Arial">MX</text>' +
      '<path d="M92 150h18v22H92z" fill="#00AEAC"/>' +
      '<path d="M110 158h22v48h-22z" fill="#108181"/>' +
      '<path d="M132 168h40v42h-40z" fill="#00AEAC" opacity=".85"/>' +
      '<text x="138" y="192" fill="#fff" font-size="8" font-family="Montserrat,Arial">BR</text>' +
      '<path d="M118 140h16v18h-16z" fill="#B4C42C"/>' +
      '<path d="M118 155h14v16h-14z" fill="#195855" stroke="#FBBB28" stroke-width="1.5"/>' +
      '<text x="120" y="166" fill="#FBBB28" font-size="7" font-weight="700" font-family="Montserrat,Arial">CO</text>' +
      '<path d="M198 62h14v18h-14z" fill="#FBBB28" opacity=".75"/>' +
      '<text x="200" y="74" fill="#172139" font-size="7" font-family="Montserrat,Arial">ES</text>' +
      '<path d="M214 58h12v14h-12z" fill="#00AEAC" opacity=".7"/>' +
      '<path d="M228 55h12v16h-12z" fill="#108181" opacity=".7"/>' +
      '<path d="M242 60h10v12h-10z" fill="#B4C42C" opacity=".65"/>' +
      '<text x="16" y="210" fill="#7d8ea3" font-size="8" font-family="Montserrat,Arial">SVG estático · sin API</text>' +
      "</svg>"
    );
  }

  function barrasMiniSvg(rows, titulo, colors) {
    rows = (rows || []).slice(0, 3);
    var max = (rows[0] && rows[0].valor) || 1;
    var bars = rows.map(function (r, i) {
      var w = Math.max(8, Math.round((r.valor / max) * 200));
      var y = 28 + i * 20;
      var lab = codigoPais(r.pais) + " " + (r.valor >= 1e6
        ? (r.valor / 1e6).toFixed(2).replace(".", ",") + "M"
        : (r.valor >= 1000 ? Math.round(r.valor / 1000) + "k" : num(r.valor)));
      return '<rect x="0" y="' + y + '" width="' + w + '" height="12" rx="4" fill="' + (colors[i] || STACK_COLORS[i]) + '"/>' +
        '<text x="' + (w + 8) + '" y="' + (y + 10) + '" fill="#eef3f3" font-size="9" font-family="Montserrat,Arial">' + esc(lab) + "</text>";
    }).join("");
    return (
      '<svg class="fig" viewBox="0 0 320 100" role="img" aria-label="' + esc(titulo) + '">' +
      '<text x="0" y="14" fill="#9db3b3" font-size="10" font-family="Montserrat,Arial">' + esc(titulo) + "</text>" +
      bars + "</svg>"
    );
  }

  /** Infografía C · Story 1080×1920 */
  function htmlInfografiaC(d) {
    d = d || {};
    var t0 = (d.top && d.top[0]) || { pais: "—", valor: 0 };
    var shareTxt = d.shareColombia != null
      ? (d.shareColombia * 100).toFixed(1).replace(".", ",") + " %"
      : "—";
    return (
      '<article class="pieza-stage stage story" id="pieza-export" data-export="infografia-c">' +
      '<div class="stage-bg" aria-hidden="true"></div>' +
      '<div class="stage-inner stage-inner-story">' +
      '<header class="stack">' +
      '<div class="logos dark">' +
      '<img class="logo-bureau" src="assets/logo_bureau.svg" alt="Bureau" style="height:28px">' +
      '<img class="logo-colmayor" src="assets/logo_colmayor_blanco.png" alt="Colmayor" style="height:36px">' +
      "</div>" +
      '<div class="gold-bar"></div>' +
      '<p class="kicker">Story · Emisores ' + esc(d.anio) + "</p>" +
      "</header>" +
      '<div class="stack">' +
      '<h1 class="h-title h-story">¿De dónde llegan los visitantes a Colombia?</h1>' +
      '<p class="lead">Densidad de países emisores · corte anual Migración + lectura Medellín MinCIT.</p>' +
      "</div>" +
      '<div class="map-static glass">' + mapaSvgEstatico() + "</div>" +
      '<p class="insight">' + esc(nombreCorto(t0.pais)) + " concentra <b class='gold'>" + esc(cortoMillones(t0.valor)) +
      "</b> entradas (" + esc(pct(t0.valor, d.total)) + "). En Medellín, MinCIT VNR suma <b class='teal'>" +
      esc(cortoMillones(d.medellin)) + "</b> no residentes con share Colombia " + esc(shareTxt) + ".</p>" +
      '<footer class="stack foot-story">' +
      '<a class="cta" href="index.html?tab=mercados">Ver tablero Bureau</a>' +
      '<p class="fuente"><b>Fuente:</b> ' + esc(d.fuenteMig) + " · " + esc(d.fuenteMincit) + "</p>" +
      "</footer></div></article>"
    );
  }

  function htmlBoletinA(d) {
    d = d || {};
    var top = d.top || [];
    var rows = top.slice(0, 3).map(function (r, i) {
      return "<li><span class='n'>" + (i + 1) + "</span><span class='pais'>" + esc(nombreCorto(r.pais)) +
        "</span><span class='val'>" + esc(num(r.valor)) + "</span></li>";
    }).join("");
    return (
      '<article class="pieza-stage stage email" id="pieza-export" data-export="boletin-a">' +
      '<div class="stage-bg" aria-hidden="true"></div><div class="stage-inner">' +
      '<header class="pieza-head"><div class="logos dark">' +
      '<img class="logo-bureau" src="assets/logo_bureau.svg" alt="Bureau">' +
      '<img class="logo-colmayor" src="assets/logo_colmayor_blanco.png" alt="Colmayor">' +
      '</div><div class="gold-bar"></div>' +
      '<p class="kicker">Boletín de inteligencia · ' + esc(d.anio) + "</p>" +
      '<h1 class="h-title">Emisores y receptivo Medellín · corte anual</h1>' +
      '<p class="lead">Resumen para stakeholders. Cifras del pack abierto. Sin CRM.</p></header>' +
      '<div class="kpi-grid kpi-2">' +
      '<div class="kpi glass"><p class="label">Entradas CO · top</p><p class="value v-sm">' + esc(cortoMillones(top[0] && top[0].valor)) + '</p><p class="meta">' + esc(nombreCorto(top[0] && top[0].pais)) + "</p></div>" +
      '<div class="kpi glass"><p class="label">Medellín VNR</p><p class="value v-sm">' + esc(cortoMillones(d.medellin)) + '</p><p class="meta">MinCIT</p></div>' +
      "</div>" +
      "<ol class='rank'>" + rows + "</ol>" +
      '<p class="fuente"><b>Fuentes:</b> ' + esc(d.fuenteMig) + " · " + esc(d.fuenteMincit) + "</p>" +
      "</div></article>"
    );
  }

  /** Boletín B · A4 vertical */
  function htmlBoletinB(d) {
    d = d || {};
    var top = d.top || [];
    var mincitTop = d.mincitTop || [];
    var shareTxt = d.shareColombia != null
      ? (d.shareColombia * 100).toFixed(1).replace(".", ",") + " %"
      : "—";
    return (
      '<article class="pieza-stage stage a4" id="pieza-export" data-export="boletin-b">' +
      '<div class="stage-bg" aria-hidden="true"></div>' +
      '<div class="stage-inner stage-inner-a4">' +
      '<header class="pieza-head">' +
      '<div class="logos dark">' +
      '<img class="logo-bureau" src="assets/logo_bureau.svg" alt="Bureau">' +
      '<img class="logo-colmayor" src="assets/logo_colmayor_blanco.png" alt="Colmayor">' +
      "</div>" +
      '<div class="gold-bar"></div>' +
      '<p class="kicker">Boletín TEC-Bureau · hoja A4</p>' +
      '<h1 class="h-title h-a4">Receptivo e emisores · Medellín / Colombia ' + esc(d.anio) + "</h1>" +
      '<p class="lead">Una página para comité. Dos universos etiquetados: MinCIT VNR (destino ciudad) y Migración (entradas nacionales).</p>' +
      "</header>" +
      '<div class="kpi-grid kpi-3">' +
      '<div class="kpi glass"><p class="label">Medellín VNR</p><p class="value v-sm">' + esc(cortoMillones(d.medellin)) + '</p><p class="meta">MinCIT ' + esc(d.anio) + "</p></div>" +
      '<div class="kpi glass"><p class="label">Share CO</p><p class="value v-sm">' + esc(shareTxt) + '</p><p class="meta">Medellín / país</p></div>' +
      '<div class="kpi glass"><p class="label">Top Migración</p><p class="value v-sm">' + esc(codigoPais(top[0] && top[0].pais)) + '</p><p class="meta">' + esc(cortoMillones(top[0] && top[0].valor)) + " entradas</p></div>" +
      "</div>" +
      '<div class="secs">' +
      '<section class="sec glass"><h2>1 · Receptivo Medellín</h2>' +
      "<p>Visitantes no residentes con destino ciudad (MinCIT VNR). No sumar con Aerocivil ni con Migración nacional.</p>" +
      barrasMiniSvg(mincitTop.length ? mincitTop : top, "Top MinCIT MDE " + d.anio, STACK_COLORS) +
      "</section>" +
      '<section class="sec glass"><h2>2 · Emisores Colombia</h2>' +
      "<p>Cruces de entrada de extranjeros (Migración). Lectura de origen nacional, no de ciudad destino.</p>" +
      barrasMiniSvg(top, "Top Migración CO " + d.anio, ["#E9901E", "#FBBB28", "#00AEAC"]) +
      "</section></div>" +
      '<footer class="foot">' +
      '<p class="fuente"><b>Fuentes:</b> ' + esc(d.fuenteMincit) + " · " + esc(d.fuenteMig) + "</p>" +
      '<p class="fuente">Greater Medellín CVB · Colmayor Manual V7</p>' +
      "</footer></div></article>"
    );
  }

  function botonesDescarga(opts) {
    opts = opts || {};
    var kind = opts.kind || "pieza";
    return (
      '<div class="opts no-print pieza-dl">' +
      '<span>Descargar:</span> ' +
      '<button class="btn" type="button" data-action="descargar-html" data-kind="' + esc(kind) + '">HTML</button> ' +
      '<button class="btn" type="button" data-action="descargar-pdf" data-kind="' + esc(kind) + '">PDF</button>' +
      "</div>"
    );
  }

  function blobDownload(filename, text, mime) {
    var blob = new Blob([text], { type: mime || "text/html;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function fetchText(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url);
      return r.text();
    }).catch(function () { return ""; });
  }

  /** Empaqueta #pieza-export (o .tec-doc) como HTML autónomo */
  function descargarHtml(kind, anio) {
    var el = document.getElementById("pieza-export") || document.querySelector(".tec-doc");
    if (!el) {
      window.alert("No hay pieza visible para descargar.");
      return;
    }
    var nombre = (kind || "pieza") + "_" + (anio || "corte") + ".html";
    Promise.all([
      fetchText("design-options/brand-v7-shared.css"),
      fetchText("styles.css")
    ]).then(function (cssArr) {
      var brand = cssArr[0] || "";
      var appCss = cssArr[1] || "";
      var css = brand + "\n" + (kind === "informe" ? appCss : "");
      /* Reescribir rutas de fuentes/assets para archivo local */
      css = css.replace(/\.\.\/assets\//g, "assets/").replace(/url\("assets\//g, 'url("assets/');
      var bodyClass = kind === "informe" ? "export-informe" : "export-pieza stage-wrap";
      var doc =
        "<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"utf-8\">" +
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
        "<title>" + esc(nombre) + "</title>" +
        "<style>" + css + "\n.stage-wrap{padding:24px;display:grid;place-items:center;min-height:100vh}" +
        ".no-print{display:none!important}</style></head>" +
        "<body class=\"" + bodyClass + "\">" + el.outerHTML + "</body></html>";
      blobDownload(nombre, doc, "text/html;charset=utf-8");
    });
  }

  function descargarPdf() {
    document.body.classList.add("print-pieza");
    window.print();
    setTimeout(function () { document.body.classList.remove("print-pieza"); }, 500);
  }

  return {
    datosEmisores: datosEmisores,
    htmlInfografiaA: htmlInfografiaA,
    htmlInfografiaB: htmlInfografiaB,
    htmlInfografiaC: htmlInfografiaC,
    htmlBoletinA: htmlBoletinA,
    htmlBoletinB: htmlBoletinB,
    botonesDescarga: botonesDescarga,
    descargarHtml: descargarHtml,
    descargarPdf: descargarPdf,
    blobDownload: blobDownload
  };
}());
