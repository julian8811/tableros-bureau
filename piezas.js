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
    return datosBoletin(DATA, anio);
  }

  /**
   * Pack vivo para boletines / infografías: Mercados + Visitante + ICCA + EVI + EMA.
   * Universos etiquetados (no sumar Migración + MinCIT + Aerocivil).
   */
  function datosBoletin(DATA, anio) {
    anio = String(anio || 2025);
    DATA = DATA || {};
    var mig = ((DATA.migracion || {}).top_paises && (DATA.migracion.top_paises[anio] || [])) || [];
    var mincit = ((DATA.mincitVnr || {}).top_paises && (DATA.mincitVnr.top_paises[anio] || [])) || [];
    var share = (((DATA.mincitVnr || {}).shares || {}).anual || []).find(function (r) {
      return String(r.anio) === anio;
    });
    var medAnual = share && share.medellin != null
      ? Number(share.medellin)
      : ((((DATA.mincitVnr || {}).anual) || []).find(function (r) {
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

    var emaSerie = ((DATA.ema || {}).serie || []).filter(function (r) {
      return String(r.anio) === anio;
    });
    if (!emaSerie.length) emaSerie = (DATA.ema || {}).serie || [];
    var emaLast = emaSerie.length ? emaSerie[emaSerie.length - 1] : null;

    var ocupSerie = (((DATA.ema || {}).ocupacion || {}).serie) || [];
    var ocupAnio = ocupSerie.filter(function (r) { return String(r.anio) === anio; });
    var ocupLast = (ocupAnio.length ? ocupAnio : ocupSerie).slice(-1)[0] || null;

    var icca = DATA.icca || {};
    var mdeIcca = (icca.ciudades || []).find(function (c) {
      return /medell/i.test(String(c.ciudad || c.nombre || ""));
    }) || (icca.ciudades || [])[0] || null;

    var ola = ((DATA.evi || {}).olas && DATA.evi.olas[0]) || (DATA.evi || {}).ultima || DATA.evi || {};
    var gastoEvi = ola.gasto_diario_usd != null ? Number(ola.gasto_diario_usd) : null;
    var nEvi = ola.n != null ? Number(ola.n) : null;

    var conPaises = ((DATA.conectividad || {}).paises || []).filter(function (r) {
      return String(r.anio) === anio;
    });
    var pasajeros = conPaises.reduce(function (s, r) {
      return s + (Number(r.pasajeros || r.llegadas) || 0);
    }, 0);
    if (!pasajeros) {
      var conSerie = ((DATA.conectividad || {}).serie || []).filter(function (r) {
        return String(r.anio) === anio;
      });
      pasajeros = conSerie.reduce(function (s, r) {
        return s + (Number(r.pasajeros || r.llegadas) || 0);
      }, 0);
    }

    var corte =
      (DATA.manifiesto && (DATA.manifiesto.corte || DATA.manifiesto.actualizado)) ||
      (DATA.meta && DATA.meta.corte_sugerido) ||
      anio;

    return {
      anio: anio,
      corte: corte,
      top: rows.slice(0, 5),
      mincitTop: mincitTop,
      total: total,
      medellin: medAnual,
      shareColombia: share && share.share_colombia != null ? Number(share.share_colombia) : null,
      shareAntioquia: share && share.share_antioquia != null ? Number(share.share_antioquia) : null,
      emaIndice: emaLast && emaLast.indice_antioquia != null ? Number(emaLast.indice_antioquia) : null,
      emaRegiones: emaLast && emaLast.indice_promedio_regiones != null ? Number(emaLast.indice_promedio_regiones) : null,
      emaPeriodo: emaLast ? (emaLast.anio + "-" + String(emaLast.mes).padStart(2, "0")) : null,
      ocupacion: ocupLast && (ocupLast.ocupacion != null ? Number(ocupLast.ocupacion) : (ocupLast.porcentaje != null ? Number(ocupLast.porcentaje) : null)),
      iccaReuniones: mdeIcca && (mdeIcca.reuniones != null ? Number(mdeIcca.reuniones) : null),
      iccaPuesto: mdeIcca && (mdeIcca.puesto != null ? Number(mdeIcca.puesto) : null),
      iccaAnio: icca.anio || anio,
      eviGasto: gastoEvi,
      eviN: nEvi,
      eviOla: ola.ola || ola.periodo || null,
      pasajeros: pasajeros || null,
      fuenteMig: "migracion.top_paises[" + anio + "]",
      fuenteMincit: "mincit_vnr · " + anio,
      fuenteEma: "DANE EMA",
      fuenteIcca: "ICCA · " + (icca.anio || anio),
      fuenteEvi: "EVI · huella",
      fuenteCon: "Aerocivil · conectividad"
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
      (top.length > 3
        ? '<p class="note-uni"><b>También en el top:</b> ' +
          top.slice(3).map(function (r, i) {
            return esc(nombreCorto(r.pais)) + " (" + esc(num(r.valor)) + ")";
          }).join(" · ") + "</p>"
        : "") +
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

  function fmtPct01(v) {
    if (v == null || isNaN(Number(v))) return "—";
    var n = Math.abs(Number(v)) <= 1 ? Number(v) * 100 : Number(v);
    return n.toFixed(1).replace(".", ",") + " %";
  }

  function pulsoChips(d) {
    var chips = [];
    if (d.emaIndice != null) {
      chips.push({
        label: "EMA Antioquia",
        value: num(d.emaIndice, 1),
        meta: (d.emaPeriodo || "") + (d.emaRegiones != null ? " · reg. " + num(d.emaRegiones, 1) : "")
      });
    }
    if (d.iccaReuniones != null) {
      chips.push({
        label: "ICCA Medellín",
        value: num(d.iccaReuniones),
        meta: d.iccaPuesto != null ? "puesto " + d.iccaPuesto + " · " + (d.iccaAnio || "") : String(d.iccaAnio || "")
      });
    }
    if (d.eviGasto != null) {
      chips.push({
        label: "Gasto EVI",
        value: "USD " + num(d.eviGasto, 1),
        meta: d.eviOla ? "ola " + d.eviOla : (d.eviN != null ? "n=" + num(d.eviN) : "diario")
      });
    }
    if (d.pasajeros != null && d.pasajeros > 0) {
      chips.push({
        label: "Pasajeros aéreos",
        value: cortoMillones(d.pasajeros),
        meta: "Aerocivil · " + d.anio
      });
    }
    if (d.ocupacion != null) {
      chips.push({
        label: "Ocupación",
        value: fmtPct01(d.ocupacion > 1 ? d.ocupacion / 100 : d.ocupacion),
        meta: "EMA hotelería"
      });
    }
    return chips.slice(0, 4);
  }

  function htmlBoletinA(d) {
    d = d || {};
    var top = d.top || [];
    var shareTxt = d.shareColombia != null
      ? "Share Colombia " + fmtPct01(d.shareColombia)
      : "MinCIT VNR";
    var maxTop = Math.max.apply(null, top.map(function (r) { return r.valor || 0; }).concat([1]));
    var rows = top.slice(0, 5).map(function (r, i) {
      var w = Math.max(8, Math.round((r.valor / maxTop) * 100));
      return "<li class='rank-bars'><span class='n'>" + (i + 1) + "</span><span class='pais'>" + esc(nombreCorto(r.pais)) +
        "</span><span class='val'>" + esc(num(r.valor)) + "</span>" +
        "<span class='bar' aria-hidden='true'><i style='width:" + w + "%;background:" + STACK_COLORS[i % STACK_COLORS.length] + "'></i></span></li>";
    }).join("");
    var t0 = top[0] || { pais: "—", valor: 0 };
    var chips = pulsoChips(d);
    var pulso = chips.length
      ? '<p class="kicker" style="margin:0">Pulso del tablero</p><div class="kpi-grid kpi-' + Math.min(chips.length, 4) + ' pulso-grid">' +
        chips.map(function (c) {
          return '<div class="kpi glass"><p class="label">' + esc(c.label) + '</p><p class="value v-sm">' + esc(c.value) +
            '</p><p class="meta">' + esc(c.meta) + "</p></div>";
        }).join("") + "</div>"
      : "";
    var mincitHint = (d.mincitTop && d.mincitTop[0])
      ? " En MinCIT Medellín lidera <b class='teal'>" + esc(nombreCorto(d.mincitTop[0].pais)) + "</b>."
      : "";
    return (
      '<article class="pieza-stage stage email" id="pieza-export" data-export="boletin-a">' +
      '<div class="stage-bg" aria-hidden="true"></div><div class="stage-inner stage-inner-email">' +
      '<header class="pieza-head"><div class="logos dark">' +
      '<img class="logo-bureau" src="assets/logo_bureau.svg" alt="Bureau">' +
      '<img class="logo-colmayor" src="assets/logo_colmayor_blanco.png" alt="Colmayor">' +
      '</div><div class="gold-bar"></div>' +
      '<p class="kicker">Boletín de inteligencia · ' + esc(d.anio) +
      (d.corte && String(d.corte) !== String(d.anio) ? " · corte " + esc(d.corte) : "") + "</p>" +
      '<h1 class="h-title">Emisores, receptivo y pulso · Medellín / Colombia</h1>' +
      '<p class="lead">Resumen para stakeholders. Datos vivos del tablero (Migración, MinCIT VNR, EMA, ICCA, EVI, Aerocivil). Universos etiquetados · sin CRM.</p></header>' +
      '<div class="kpi-grid kpi-2">' +
      '<div class="kpi glass"><p class="label">Entradas CO · ' + esc(codigoPais(t0.pais)) + '</p><p class="value v-sm">' + esc(cortoMillones(t0.valor)) + '</p><p class="meta">' + esc(nombreCorto(t0.pais)) + " · " + esc(pct(t0.valor, d.total)) + " · Migración</p></div>" +
      '<div class="kpi glass"><p class="label">Medellín VNR</p><p class="value v-sm">' + esc(cortoMillones(d.medellin)) + '</p><p class="meta">' + esc(shareTxt) + "</p></div>" +
      "</div>" +
      pulso +
      '<p class="kicker" style="margin:0">Top emisores Colombia (Migración)</p>' +
      "<ol class='rank rank-bars'>" + rows + "</ol>" +
      '<p class="insight">El top emisor nacional (<b class="gold">' + esc(nombreCorto(t0.pais)) +
      "</b>) no sustituye el ranking MinCIT de destino Medellín." + mincitHint +
      " No sumar Migración + MinCIT + Aerocivil.</p>" +
      '<a class="cta" href="index.html?tab=mercados">Abrir tableros</a>' +
      '<p class="fuente"><b>Fuentes:</b> ' + esc(d.fuenteMig) + " · " + esc(d.fuenteMincit) +
      " · " + esc(d.fuenteEma) + " · " + esc(d.fuenteIcca) + " · " + esc(d.fuenteEvi) +
      " · Bureau · Colmayor V7</p>" +
      "</div></article>"
    );
  }

  /** Boletín B · A4 vertical */
  function htmlBoletinB(d) {
    d = d || {};
    var top = d.top || [];
    var mincitTop = d.mincitTop || [];
    var shareTxt = d.shareColombia != null ? fmtPct01(d.shareColombia) : "—";
    var chips = pulsoChips(d);
    var pulsoLis = chips.map(function (c) {
      return "<li><span>" + esc(c.label) + "</span><strong>" + esc(c.value) + "</strong><em>" + esc(c.meta) + "</em></li>";
    }).join("");
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
      '<p class="kicker">Boletín TEC-Bureau · hoja A4 · datos vivos</p>' +
      '<h1 class="h-title h-a4">Receptivo, emisores y pulso · Medellín / Colombia ' + esc(d.anio) + "</h1>" +
      '<p class="lead">Una página para comité. MinCIT VNR (ciudad), Migración (país) y señales EMA/ICCA/EVI/Aerocivil del dashboard.</p>' +
      "</header>" +
      '<div class="kpi-grid kpi-3">' +
      '<div class="kpi glass"><p class="label">Medellín VNR</p><p class="value v-sm">' + esc(cortoMillones(d.medellin)) + '</p><p class="meta">MinCIT ' + esc(d.anio) + "</p></div>" +
      '<div class="kpi glass"><p class="label">Share CO</p><p class="value v-sm">' + esc(shareTxt) + '</p><p class="meta">Medellín / país' +
      (d.shareAntioquia != null ? " · Ant. " + esc(fmtPct01(d.shareAntioquia)) : "") + "</p></div>" +
      '<div class="kpi glass"><p class="label">Top Migración</p><p class="value v-sm">' + esc(codigoPais(top[0] && top[0].pais)) + '</p><p class="meta">' + esc(cortoMillones(top[0] && top[0].valor)) + " entradas</p></div>" +
      "</div>" +
      '<div class="secs secs-3">' +
      '<section class="sec glass"><h2>1 · Receptivo Medellín</h2>' +
      "<p>Visitantes no residentes con destino ciudad (MinCIT VNR). No sumar con Aerocivil ni Migración.</p>" +
      barrasMiniSvg(mincitTop.length ? mincitTop : top, "Top MinCIT MDE " + d.anio, STACK_COLORS) +
      "</section>" +
      '<section class="sec glass"><h2>2 · Emisores Colombia</h2>' +
      "<p>Cruces de entrada (Migración). Origen nacional, no ciudad destino.</p>" +
      barrasMiniSvg(top, "Top Migración CO " + d.anio, ["#E9901E", "#FBBB28", "#00AEAC"]) +
      "</section>" +
      '<section class="sec glass sec-pulso"><h2>3 · Pulso tablero</h2>' +
      "<p>Señales de Mercados / Visitante del mismo corte.</p>" +
      (pulsoLis ? "<ul class='pulso-list'>" + pulsoLis + "</ul>" : "<p>Sin series EMA/ICCA/EVI en el pack.</p>") +
      "</section></div>" +
      '<p class="insight" style="font-size:12px">No sumar receptivo MinCIT con emisores Migración ni con Aerocivil: son universos distintos (ciudad destino vs entradas nacionales vs pasajeros aéreos).</p>' +
      '<footer class="foot">' +
      '<p class="fuente"><b>Fuentes:</b> ' + esc(d.fuenteMincit) + " · " + esc(d.fuenteMig) +
      " · " + esc(d.fuenteEma) + " · " + esc(d.fuenteIcca) + " · " + esc(d.fuenteEvi) + " · " + esc(d.fuenteCon) + "</p>" +
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
    setTimeout(function () { URL.revokeObjectURL(url); }, 2500);
  }

  function fetchText(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url);
      return r.text();
    }).catch(function () { return ""; });
  }

  function absUrl(rel) {
    try { return new URL(rel, window.location.href).href; }
    catch (e) { return rel; }
  }

  /** Convierte src relativos de assets a absolutos (imprescindible en blob/print).
   *  No tocar url(#id) — son referencias SVG internas (gradientes); absolutizarlas
   *  las rompe y las barras del informe quedan invisibles en HTML/PDF. */
  function absolutizarHtml(html) {
    return String(html || "")
      .replace(/\bsrc=(["'])(?!https?:|data:|blob:)([^"']+)\1/gi, function (_, q, src) {
        return "src=" + q + absUrl(src) + q;
      })
      .replace(/url\((["']?)(?!https?:|data:|blob:|#)([^"')]+)\1\)/gi, function (_, q, u) {
        var path = String(u || "").trim();
        if (!path || path.charAt(0) === "#") return "url(" + q + path + q + ")";
        return "url(" + q + absUrl(path) + q + ")";
      })
      .replace(/background-image:\s*url\((['"])(?!https?:|data:|blob:|#)([^'"]+)\1\)/gi, function (_, q, u) {
        return "background-image:url(" + q + absUrl(u) + q + ")";
      });
  }

  function cssExportExtras(kind) {
    var common =
      "html,body{margin:0;background:#0e1422!important}" +
      ".no-print,.pieza-dl,.opts,.site,.mando,.footer-doc,.skip,#tip,.modal-back,.aviso,.check{display:none!important}" +
      ".stage-wrap{padding:24px;display:grid;place-items:center;min-height:100vh;box-sizing:border-box}" +
      "@media print{" +
      "  @page{size:landscape;margin:8mm}" +
      "  html,body{background:#0e1422!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}" +
      "  .deck{padding:0!important;gap:0!important}" +
      "  .slide{break-after:page;page-break-after:always;box-shadow:none!important;width:100%!important;max-width:none!important}" +
      "}" ;
    if (kind === "informe") {
      return common +
        ".export-informe{padding:16px;background:#0e1422!important}" +
        ".export-informe .deck{padding:12px 0 24px;display:grid;gap:24px;justify-items:center}" +
        ".export-informe .slide{width:min(100%,1280px)}" +
        ".export-informe .back{display:none!important}";
    }
    return common +
      "body{background:#0c1526!important;color:#eef3f3!important}" +
      ".stage.sq{width:min(100%,1080px);aspect-ratio:1/1}" +
      ".stage.story{width:min(100%,420px);aspect-ratio:9/16}" +
      ".stage.email{width:min(100%,600px)}" +
      ".stage.a4{width:min(100%,794px);aspect-ratio:210/297}";
  }

  function tituloExport(kind, anio) {
    var map = {
      infografia_a: "Infografia_A_Hero_KPI",
      infografia_b: "Infografia_B_Ranking",
      infografia_c: "Infografia_C_Story",
      boletin_a: "Boletin_A_Email",
      boletin_b: "Boletin_B_A4",
      boletin: "Boletin",
      informe: "Informe_TEC_Bureau"
    };
    return (map[kind] || kind || "Pieza_Bureau") + "_" + (anio || "corte");
  }

  /** Construye HTML autónomo de la pieza/informe visible */
  function buildExportDoc(kind, anio) {
    var el = document.getElementById("pieza-export") || document.querySelector(".tec-doc");
    if (!el) return Promise.reject(new Error("No hay pieza visible para descargar."));
    var baseName = tituloExport(kind, anio);
    var fetches = kind === "informe"
      ? [
        fetchText("design-options/informe-tec-deck.css"),
        fetchText("design-options/brand-v7-shared.css")
      ]
      : [
        fetchText("design-options/brand-v7-shared.css"),
        fetchText("styles.css")
      ];
    return Promise.all(fetches).then(function (cssArr) {
      var primary = absolutizarHtml(cssArr[0] || "");
      var secondary = absolutizarHtml(cssArr[1] || "");
      var css = kind === "informe"
        ? primary + "\n" + secondary + "\n" + cssExportExtras(kind)
        : primary + "\n" + cssExportExtras(kind);
      var bodyClass = kind === "informe" ? "export-informe" : "export-pieza stage-wrap";
      var markup = absolutizarHtml(el.outerHTML);
      var html =
        "<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"utf-8\">" +
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
        "<title>" + esc(baseName) + "</title>" +
        "<style>" + css + "</style></head>" +
        "<body class=\"" + bodyClass + "\">" + markup + "</body></html>";
      return { html: html, baseName: baseName, filename: baseName + ".html" };
    });
  }

  function descargarHtml(kind, anio) {
    buildExportDoc(kind, anio).then(function (doc) {
      blobDownload(doc.filename, doc.html, "text/html;charset=utf-8");
    }).catch(function (err) {
      window.alert(err && err.message ? err.message : "No se pudo generar el HTML.");
    });
  }

  /**
   * PDF de la pieza/informe: ventana propia con <title> = nombre del archivo
   * (evita "Tableros estadísticos… .pdf" del tablero padre).
   */
  function descargarPdf(kind, anio) {
    buildExportDoc(kind, anio).then(function (doc) {
      var prevTitle = document.title;
      document.title = doc.baseName;
      var blob = new Blob([doc.html], { type: "text/html;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var w = window.open(url, "_blank");
      if (!w) {
        document.title = prevTitle;
        URL.revokeObjectURL(url);
        window.alert("Permita ventanas emergentes para guardar el PDF, o use Descargar HTML y luego Imprimir.");
        return;
      }
      var restored = false;
      function restore() {
        if (restored) return;
        restored = true;
        document.title = prevTitle;
        try { URL.revokeObjectURL(url); } catch (e) {}
      }
      var tries = 0;
      function tryPrint() {
        tries += 1;
        try {
          if (w.document && w.document.readyState === "complete") {
            w.document.title = doc.baseName;
            w.focus();
            w.print();
            w.onafterprint = function () {
              restore();
              try { w.close(); } catch (e) {}
            };
            setTimeout(restore, 180000);
            return;
          }
        } catch (e) { /* cross-blob race */ }
        if (tries < 40) setTimeout(tryPrint, 150);
        else {
          restore();
          window.alert("No se pudo abrir la impresión. Use Descargar HTML.");
        }
      }
      setTimeout(tryPrint, 400);
    }).catch(function (err) {
      window.alert(err && err.message ? err.message : "No se pudo generar el PDF.");
    });
  }

  return {
    datosEmisores: datosEmisores,
    datosBoletin: datosBoletin,
    htmlInfografiaA: htmlInfografiaA,
    htmlInfografiaB: htmlInfografiaB,
    htmlInfografiaC: htmlInfografiaC,
    htmlBoletinA: htmlBoletinA,
    htmlBoletinB: htmlBoletinB,
    botonesDescarga: botonesDescarga,
    descargarHtml: descargarHtml,
    descargarPdf: descargarPdf,
    buildExportDoc: buildExportDoc,
    blobDownload: blobDownload
  };
}());
