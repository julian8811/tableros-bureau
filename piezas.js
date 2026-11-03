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
    return {
      anio: anio,
      top: rows.slice(0, 5),
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
      '<article class="pieza-stage stage sq" id="pieza-export" data-pieza="infografia-a">' +
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

  function htmlBoletinA(d) {
    d = d || {};
    var top = d.top || [];
    var rows = top.slice(0, 3).map(function (r, i) {
      return "<li><span class='n'>" + (i + 1) + "</span><span class='pais'>" + esc(nombreCorto(r.pais)) +
        "</span><span class='val'>" + esc(num(r.valor)) + "</span></li>";
    }).join("");
    return (
      '<article class="pieza-stage stage email" id="pieza-export" data-pieza="boletin-a">' +
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
      var css = (cssArr[0] || "") + "\n" + (kind === "informe" ? (cssArr[1] || "") : "");
      /* Reescribir rutas de fuentes/assets para archivo local */
      css = css.replace(/\.\.\/assets\//g, "assets/").replace(/url\("assets\//g, 'url("assets/');
      var bodyClass = kind === "informe" ? "export-informe" : "export-pieza stage-wrap";
      var doc =
        "<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"utf-8\">" +
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
        "<title>" + esc(nombre) + "</title>" +
        "<style>" + css + "\n.stage-wrap{padding:24px}.no-print{display:none!important}</style></head>" +
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
    htmlBoletinA: htmlBoletinA,
    botonesDescarga: botonesDescarga,
    descargarHtml: descargarHtml,
    descargarPdf: descargarPdf,
    blobDownload: blobDownload
  };
}());
