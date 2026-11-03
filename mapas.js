/* Mapa mundi coroplético de emisores — Leaflet + Natural Earth 110m (sin API key). */
window.Mapas = (function () {
  var GEO_URLS = [
    "assets/geo/ne_110m_admin_0_countries.geojson",
    "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson"
  ];
  var COLORS = ["#243656", "#1e5c6e", "#108181", "#00AEAC", "#FBBB28", "#E9901E"];
  var ES_TO_ISO = {
    "Estados Unidos": "US", "Estados Unidos de América": "US", "Estados Unidos De América": "US",
    "México": "MX", "Mexico": "MX", "Costa Rica": "CR", "Ecuador": "EC",
    "Panamá": "PA", "Panama": "PA", "República Dominicana": "DO",
    "Perú": "PE", "Peru": "PE", "Puerto Rico": "PR",
    "Venezuela": "VE",
    "Venezuela (República Bolivariana de)": "VE",
    "Venezuela (República Bolivariana De)": "VE",
    "España": "ES", "Espana": "ES", "Canadá": "CA", "Canada": "CA",
    "Chile": "CL", "Brasil": "BR", "Argentina": "AR",
    "Países Bajos": "NL", "Paises Bajos": "NL",
    "Aruba": "AW", "Alemania": "DE", "Francia": "FR", "Italia": "IT",
    "Guatemala": "GT", "El Salvador": "SV", "Honduras": "HN",
    "Colombia": "CO", "Reino Unido": "GB", "China": "CN"
  };
  var ISO_CENTROID = {
    PR: [18.22, -66.48],
    AW: [12.52, -69.97],
    SV: [13.79, -88.9],
    HN: [14.82, -86.24]
  };

  var geojsonCache = null;
  var geoPromise = null;
  var instances = {};
  var leafletPromise = null;

  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
    });
  }

  function fmt(n) {
    return Number(n || 0).toLocaleString("es-CO");
  }

  function isoOf(row) {
    if (!row) return "";
    if (row.iso) return String(row.iso).toUpperCase();
    var name = row.pais || row.nombre || row.label || "";
    return String(ES_TO_ISO[name] || "").toUpperCase();
  }

  function valueOf(row) {
    var v = row.visitantes != null ? row.visitantes
      : row.entradas != null ? row.entradas
      : row.peso != null ? row.peso
      : row.value != null ? row.value
      : 0;
    return Number(v) || 0;
  }

  function normalizeRows(rows) {
    var byIso = {};
    (rows || []).forEach(function (row) {
      var iso = isoOf(row);
      if (!iso || iso === "CO") return;
      var val = valueOf(row);
      var prev = byIso[iso];
      if (!prev || val > prev.value) {
        byIso[iso] = {
          pais: row.pais || row.nombre || row.label || iso,
          iso: iso,
          value: val,
          participacion: row.participacion
        };
      }
    });
    return byIso;
  }

  function quantileBreaks(values, n) {
    var v = values.slice().sort(function (a, b) { return a - b; });
    if (!v.length) return [0, 1];
    var out = [];
    for (var i = 1; i < n; i++) {
      var q = i / n;
      var idx = (v.length - 1) * q;
      var lo = Math.floor(idx);
      var hi = Math.ceil(idx);
      out.push(lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (idx - lo));
    }
    return out;
  }

  function colorFor(val, br) {
    if (val == null || !isFinite(val) || val <= 0) return "#121a2a";
    var i = 0;
    while (i < br.length && val > br[i]) i++;
    return COLORS[Math.min(i, COLORS.length - 1)];
  }

  function featureIso(props) {
    var raw = (props && (props.ISO_A2_EH || props.ISO_A2 || props.iso_a2)) || "";
    var iso = String(raw).toUpperCase();
    return (!iso || iso === "-99") ? "" : iso;
  }

  function ensureLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise(function (resolve, reject) {
      if (!document.querySelector('link[data-leaflet-css]')) {
        var link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.setAttribute("data-leaflet-css", "1");
        document.head.appendChild(link);
      }
      var s = document.createElement("script");
      s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      s.onload = function () { resolve(window.L); };
      s.onerror = function () { reject(new Error("No se pudo cargar Leaflet")); };
      document.head.appendChild(s);
    });
    return leafletPromise;
  }

  function loadGeo() {
    if (geojsonCache) return Promise.resolve(geojsonCache);
    if (geoPromise) return geoPromise;
    geoPromise = (async function () {
      var lastErr;
      for (var i = 0; i < GEO_URLS.length; i++) {
        try {
          var r = await fetch(GEO_URLS[i]);
          if (!r.ok) throw new Error("HTTP " + r.status);
          geojsonCache = await r.json();
          return geojsonCache;
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr || new Error("GeoJSON no disponible");
    })();
    return geoPromise;
  }

  /** Placeholder HTML (glass) — montar con mountAfterRender */
  function shell(opts) {
    opts = opts || {};
    var id = opts.id || ("mapa-" + Math.random().toString(36).slice(2, 8));
    var h = opts.height || 420;
    var showRank = opts.ranking !== false;
    return (
      '<div class="mapa-emisores glass-panel' + (showRank ? " has-rank" : "") + '" data-mapa-id="' + esc(id) + '">' +
      '<div class="mapa-emisores-head">' +
      "<div><h3>" + esc(opts.titulo || "Mapa mundi · densidad de emisores") + "</h3>" +
      '<p class="hint">' + esc(opts.pista || "Países de origen con tráfico hacia Colombia / Medellín. Coropleta Natural Earth + Leaflet.") + "</p></div>" +
      '<div class="mapa-emisores-legend" data-mapa-legend="' + esc(id) + '"></div>' +
      "</div>" +
      '<div class="mapa-emisores-body">' +
      '<div class="mapa-emisores-main">' +
      '<div class="mapa-emisores-canvas" id="' + esc(id) + '" style="height:' + h + 'px" role="img" aria-label="Mapa de densidad de emisores"></div>' +
      '<p class="mapa-emisores-status" data-mapa-status="' + esc(id) + '">Cargando mapa mundi…</p>' +
      "</div>" +
      (showRank
        ? '<aside class="mapa-emisores-rank glass-inset" aria-label="Ranking de países emisores">' +
          "<h4>Ranking emisores</h4>" +
          '<div class="mapa-rank-scroll"><table class="mapa-rank-table"><thead><tr><th>#</th><th>País</th><th>Tráfico</th><th>%</th></tr></thead>' +
          '<tbody data-mapa-rank="' + esc(id) + '"><tr><td colspan="4">Cargando…</td></tr></tbody></table></div>' +
          "</aside>"
        : "") +
      "</div></div>"
    );
  }

  function renderRank(id, byIso, breaks) {
    var tbody = document.querySelector('[data-mapa-rank="' + id + '"]');
    if (!tbody) return;
    var rows = Object.keys(byIso).map(function (k) { return byIso[k]; })
      .sort(function (a, b) { return b.value - a.value; });
    var total = rows.reduce(function (s, r) { return s + (r.value || 0); }, 0) || 1;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4">Sin emisores en el corte</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (r, i) {
      var pct = (r.value / total) * 100;
      var swatch = colorFor(r.value, breaks || []);
      return "<tr>" +
        '<td class="n">' + (i + 1) + "</td>" +
        '<td class="pais"><i style="background:' + swatch + '"></i>' + esc(r.pais) + "</td>" +
        '<td class="val">' + fmt(r.value) + "</td>" +
        '<td class="pct">' + pct.toFixed(1).replace(".", ",") + "%</td>" +
        "</tr>";
    }).join("");
  }

  function destroy(id) {
    var inst = instances[id];
    if (!inst) return;
    try {
      if (inst.map) inst.map.remove();
    } catch (e) { /* noop */ }
    delete instances[id];
  }

  function paint(id, byIso, meta) {
    var L = window.L;
    var el = document.getElementById(id);
    if (!el || !L || !geojsonCache) return;

    destroy(id);
    el.innerHTML = "";

    var values = Object.keys(byIso).map(function (k) { return byIso[k].value; }).filter(function (v) { return v > 0; });
    var breaks = quantileBreaks(values, COLORS.length - 1);
    var max = Math.max.apply(null, values.concat([1]));

    var legend = document.querySelector('[data-mapa-legend="' + id + '"]');
    if (legend) {
      var edges = [0].concat(breaks).concat([max]);
      legend.innerHTML = edges.slice(0, -1).map(function (a, i) {
        var b = edges[i + 1];
        var label = i === 0 ? "Sin dato" : fmt(Math.round(a)) + "–" + fmt(Math.round(b));
        return '<span class="mapa-leg-row"><i style="background:' + COLORS[i] + '"></i>' + esc(label) + "</span>";
      }).join("");
    }
    renderRank(id, byIso, breaks);

    var map = L.map(el, {
      worldCopyJump: true,
      minZoom: 1,
      maxZoom: 6,
      zoomSnap: 0.25,
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: false
    });
    L.rectangle([[-85, -200], [85, 200]], {
      stroke: false, fillColor: "#070d18", fillOpacity: 1, interactive: false
    }).addTo(map);

    var matched = {};
    var geoLayer = L.geoJSON(geojsonCache, {
      style: function (feature) {
        var iso = featureIso(feature.properties || {});
        var hit = byIso[iso];
        var isCO = iso === "CO";
        return {
          fillColor: isCO ? "#195855" : colorFor(hit ? hit.value : 0, breaks),
          weight: isCO ? 2.4 : hit ? 1.4 : 0.5,
          color: isCO || hit ? "#FBBB28" : "rgba(255,255,255,.14)",
          fillOpacity: isCO ? 0.78 : hit ? 0.94 : 0.36
        };
      },
      onEachFeature: function (feature, layer) {
        var iso = featureIso(feature.properties || {});
        var name = (feature.properties && (feature.properties.NAME || feature.properties.ADMIN)) || iso;
        var hit = byIso[iso];
        if (hit) matched[iso] = true;
        if (iso === "CO") {
          layer.bindPopup("<b>Colombia (destino)</b>");
          return;
        }
        if (hit) {
          var extra = hit.participacion != null
            ? "<br>Participación: <b>" + String(hit.participacion).replace(".", ",") + "%</b>"
            : "";
          layer.bindPopup("<b>" + esc(hit.pais) + "</b> (" + iso + ")<br>Tráfico / peso: <b>" + fmt(hit.value) + "</b>" + extra);
        } else {
          layer.bindPopup("<b>" + esc(name) + "</b><br>Sin dato en el corte.");
        }
      }
    }).addTo(map);

    var markers = L.layerGroup();
    Object.keys(byIso).forEach(function (iso) {
      if (matched[iso] || !ISO_CENTROID[iso]) return;
      var hit = byIso[iso];
      var ll = ISO_CENTROID[iso];
      var m = L.circleMarker(ll, {
        radius: 7 + Math.min(14, Math.sqrt(hit.value) / 90),
        color: "#FBBB28",
        weight: 1.4,
        fillColor: colorFor(hit.value, breaks),
        fillOpacity: 0.95
      });
      m.bindPopup("<b>" + esc(hit.pais) + "</b> (" + iso + ")<br>Tráfico / peso: <b>" + fmt(hit.value) + "</b>");
      markers.addLayer(m);
    });
    markers.addTo(map);

    map.fitBounds([[-56, -170], [75, 178]], {
      padding: [12, 12],
      maxZoom: 2.1,
      animate: false
    });

    instances[id] = { map: map, geoLayer: geoLayer, markers: markers };

    var status = document.querySelector('[data-mapa-status="' + id + '"]');
    if (status) {
      var n = Object.keys(byIso).length;
      status.textContent = (meta && meta.titulo ? meta.titulo + " · " : "") + n + " países marcados" +
        (meta && meta.fuente ? " · " + meta.fuente : "");
    }

    setTimeout(function () { try { map.invalidateSize(); } catch (e) { /* noop */ } }, 80);
  }

  function mount(id, rows, meta) {
    var el = document.getElementById(id);
    if (!el) return Promise.resolve(false);
    var byIso = normalizeRows(rows);
    var status = document.querySelector('[data-mapa-status="' + id + '"]');
    return ensureLeaflet()
      .then(function () { return loadGeo(); })
      .then(function () {
        paint(id, byIso, meta || {});
        return true;
      })
      .catch(function (err) {
        if (status) status.textContent = "No se pudo cargar el mapa: " + (err && err.message ? err.message : err);
        return false;
      });
  }

  /** Monta todos los shells presentes en el DOM con data-mapa-rows JSON o dataset callback */
  function mountAll(specs) {
    specs = specs || [];
    return Promise.all(specs.map(function (s) {
      return mount(s.id, s.rows || [], { titulo: s.titulo, fuente: s.fuente });
    }));
  }

  function mergeEmisores(parts) {
    var byIso = {};
    (parts || []).forEach(function (part) {
      var weight = part.weight != null ? part.weight : 1;
      (part.rows || []).forEach(function (row) {
        var iso = isoOf(row);
        if (!iso || iso === "CO") return;
        var val = valueOf(row);
        var score = val * weight;
        var prev = byIso[iso];
        if (!prev || score >= (prev.score || 0)) {
          byIso[iso] = {
            pais: row.pais || row.nombre || prev && prev.pais || iso,
            iso: iso,
            value: val,
            score: score,
            participacion: row.participacion != null ? row.participacion : (prev && prev.participacion),
            visitantes: val
          };
        }
      });
    });
    return Object.keys(byIso).map(function (k) { return byIso[k]; })
      .sort(function (a, b) { return b.value - a.value; });
  }

  return {
    shell: shell,
    mount: mount,
    mountAll: mountAll,
    destroy: destroy,
    mergeEmisores: mergeEmisores,
    isoOf: isoOf,
    ES_TO_ISO: ES_TO_ISO,
    COLORS: COLORS
  };
}());
