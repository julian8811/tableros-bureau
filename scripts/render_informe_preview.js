const fs = require("fs");
const path = require("path");

const inf = JSON.parse(fs.readFileSync(path.join("data", "open", "informe_llm_borrador.json"), "utf8"));
const css = fs.readFileSync("styles.css", "utf8");

function esc(t) {
  return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

function lista(items, cls) {
  if (!items || !items.length) return "";
  return "<ul class=\"lista informe-lista " + (cls || "") + "\">" + items.map(function (b) {
    var extra = b.implicacion ? " <em class=\"implicacion\">" + esc(b.implicacion) + "</em>" : "";
    return "<li><span>" + esc(b.texto || "") + "</span>" + extra +
      (b.fuente ? " <span class=\"src\">(" + esc(b.fuente) + ")</span>" : "") + "</li>";
  }).join("") + "</ul>";
}

function tabla(t) {
  if (!t || !t.filas || !t.filas.length) return "";
  return "<div class=\"tec-tabla-wrap\"><h4>" + esc(t.titulo || "Tabla") + "</h4><table class=\"tec-tabla\"><thead><tr>" +
    t.columnas.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") +
    "</tr></thead><tbody>" +
    t.filas.map(function (f) {
      return "<tr>" + (f || []).map(function (c) {
        return "<td>" + esc(typeof c === "number" ? c.toLocaleString("es-CO") : c) + "</td>";
      }).join("") + "</tr>";
    }).join("") +
    "</tbody></table></div>";
}

function fig(g) {
  if (!g || !g.labels) return "";
  var max = Math.max.apply(null, g.values.map(Number).concat([1]));
  var bars = g.labels.map(function (lab, i) {
    var v = Number(g.values[i]) || 0;
    var w = Math.max(2, Math.round(v / max * 100));
    return "<div class=\"pv-bar\"><span class=\"pv-lab\">" + esc(lab) +
      "</span><span class=\"pv-track\"><i style=\"width:" + w + "%\"></i></span><span class=\"pv-val\">" +
      esc(v.toLocaleString("es-CO")) + "</span></div>";
  }).join("");
  return "<h4>" + esc(g.titulo || "") + "</h4><p class=\"src\">" + esc(g.unidad || "") +
    "</p><div class=\"pv-bars\">" + bars + "</div>";
}

var portada = inf.banco_imagenes && inf.banco_imagenes.portada;
var body = "<section class=\"tec-portada\">" +
  (portada ? "<div class=\"tec-hero\" style=\"background-image:url('" + esc(portada.url) + "')\"></div>" : "") +
  "<div class=\"tec-portada-copy\"><p class=\"tec-kicker\">BORRADOR · SIN GROQ</p><h2>" + esc(inf.titulo) +
  "</h2><p>" + esc(inf.subtitulo) + "</p></div></section>";

body += "<section class=\"tec-resumen\"><h3>Resumen ejecutivo</h3><ul class=\"lista\">" +
  (inf.resumen_ejecutivo || []).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") +
  "</ul></section>";

body += "<section class=\"tec-toc\"><h3>Contenido</h3><ol>" +
  (inf.secciones || []).map(function (s) {
    return "<li><a href=\"#sec-" + esc(s.id) + "\">" + esc(s.titulo) + "</a></li>";
  }).join("") + "</ol></section>";

(inf.secciones || []).forEach(function (sec) {
  var img = sec.imagen;
  body += "<article class=\"tec-sec\" id=\"sec-" + esc(sec.id) +
    "\"><header class=\"tec-sec-head\"><h3>" + esc(sec.titulo) + "</h3></header>";
  if (img && img.url) {
    body += "<figure class=\"tec-figure\"><img src=\"" + esc(img.url) +
      "\" alt=\"\"><figcaption>" + esc(img.credito || "") + "</figcaption></figure>";
  }
  if (sec.lead) body += "<p class=\"tec-lead\">" + esc(sec.lead) + "</p>";
  if (sec.bullets && sec.bullets.length) body += "<h4>Hallazgos</h4>" + lista(sec.bullets);
  if (sec.analisis && sec.analisis.length) body += "<h4>Análisis</h4>" + lista(sec.analisis);
  if (sec.insights && sec.insights.length) body += "<h4>Insights</h4>" + lista(sec.insights, "insights");
  body += tabla(sec.tabla) + fig(sec.grafico) + "</article>";
});

var extraCss =
  ".pv-bars{display:grid;gap:8px;margin:8px 0 16px}" +
  ".pv-bar{display:grid;grid-template-columns:140px 1fr 90px;gap:8px;align-items:center;font-size:12px}" +
  ".pv-track{height:10px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden}" +
  ".pv-track i{display:block;height:100%;background:#00AEAC}" +
  ".pv-val{text-align:right;font-variant-numeric:tabular-nums}" +
  ".wrap{max-width:980px;margin:0 auto;padding:24px}" +
  ".banner{background:#E9901E;color:#111;padding:10px 14px;border-radius:10px;margin-bottom:16px;font-weight:600}";

var html = "<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"utf-8\">" +
  "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
  "<title>Borrador informe TEC-Bureau</title><style>" + css + extraCss +
  "</style></head><body><div class=\"wrap\">" +
  "<div class=\"banner\">Borrador determinístico del dashboard · sin GROQ_API_KEY · para corrección conjunta</div>" +
  body +
  "<p class=\"src\" style=\"margin-top:24px\">meta: " + esc(JSON.stringify(inf.meta_generacion)) +
  "</p></div></body></html>";

fs.writeFileSync("informe-preview.html", html, "utf8");
console.log("wrote informe-preview.html", html.length);
