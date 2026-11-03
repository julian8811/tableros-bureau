#!/usr/bin/env node
/**
 * Extrae CSS del mock y lo aísla bajo .deck / .export-informe
 * para no pintar el dashboard con color:#1a1a1a.
 */
const fs = require("fs");
const path = require("path");
const src = path.join(__dirname, "..", "design-options", "informe-tec-referencia.html");
const out = path.join(__dirname, "..", "design-options", "informe-tec-deck.css");
const h = fs.readFileSync(src, "utf8");
const m = h.match(/<style>([\s\S]*?)<\/style>/);
if (!m) {
  console.error("no style");
  process.exit(1);
}
let css = m[1];
css = css.replace(/url\("assets\/tec-photos\/cover\.png"\)/g, "none");

/* Quitar body global (filtraba color negro al dashboard).
   NO usar \bbody — matcheaba ".chart-body{...}" y rompía el CSS del deck. */
css = css.replace(/(^|[^.\w-])body\s*\{[^}]*\}/gm, "$1/* body scoped below */");

/* Prefijar selectores simples con .deck — conservar @font-face, :root, @keyframes, @media */
function scopeSelector(sel) {
  sel = sel.trim();
  if (!sel) return sel;
  if (sel.startsWith("@") || sel.startsWith("from") || sel.startsWith("to") || sel === ":root") return sel;
  if (sel.startsWith(".deck") || sel.startsWith(".export-informe") || sel.startsWith(".informe-deck-live")) return sel;
  return sel
    .split(",")
    .map(function (s) {
      s = s.trim();
      if (!s) return s;
      if (s.startsWith(":root") || s.startsWith("@")) return s;
      if (s.startsWith(".deck") || s.startsWith(".export-informe")) return s;
      if (s === "*" || s.startsWith("*")) return ".deck " + s;
      return ".deck " + s;
    })
    .join(", ");
}

/* Scope block by block (naive but works for this file) */
let outCss = "";
let i = 0;
while (i < css.length) {
  if (css.startsWith("@font-face", i)) {
    const end = css.indexOf("}", css.indexOf("{", i)) + 1;
    outCss += css.slice(i, end);
    i = end;
    continue;
  }
  if (css.startsWith(":root", i)) {
    const end = css.indexOf("}", css.indexOf("{", i)) + 1;
    /* vars en .deck también */
    const block = css.slice(i, end);
    outCss += block.replace(":root", ".deck, .export-informe, :root");
    i = end;
    continue;
  }
  if (css.startsWith("@media", i)) {
    const brace = css.indexOf("{", i);
    let depth = 0;
    let j = brace;
    for (; j < css.length; j++) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }
    const mediaHead = css.slice(i, brace + 1);
    const mediaBody = css.slice(brace + 1, j - 1);
    const scopedBody = mediaBody.replace(/([^{}@]+)\{/g, function (full, sel) {
      if (/^\s*$/.test(sel)) return full;
      return scopeSelector(sel) + "{";
    });
    outCss += mediaHead + scopedBody + "}";
    i = j;
    continue;
  }
  const brace = css.indexOf("{", i);
  if (brace < 0) {
    outCss += css.slice(i);
    break;
  }
  const sel = css.slice(i, brace);
  const end = css.indexOf("}", brace) + 1;
  if (/^\s*$/.test(sel) || sel.indexOf("/*") >= 0 && sel.indexOf("*/") >= 0 && !/[a-zA-Z.#\[]/.test(sel.replace(/\/\*[\s\S]*?\*\//g, ""))) {
    outCss += css.slice(i, end);
    i = end;
    continue;
  }
  const cleanSel = sel.replace(/\/\*[\s\S]*?\*\//g, "").trim();
  if (!cleanSel) {
    outCss += css.slice(i, end);
    i = end;
    continue;
  }
  outCss += scopeSelector(cleanSel) + css.slice(brace, end);
  i = end;
}

const banner =
  "/* Deck TEC scoped under .deck — no contaminar body del dashboard */\n" +
  ".cover-stage .photo-img{object-fit:cover!important;width:100%;height:100%}\n" +
  ".deck .chart-stack{display:grid;grid-template-columns:1fr;gap:10px;min-height:0}\n" +
  ".deck .chart-stack .chart-svg{min-height:140px}\n" +
  ".deck .chart-page-multi .chart-body{grid-template-columns:.85fr 1.25fr}\n" +
  ".deck .chart-page .chart-svg{width:100%;height:auto;min-height:180px;display:block}\n" +
  ".deck,.export-informe .deck{color:#1a1a1a;font-family:Montserrat,Calibri,Arial,sans-serif}\n" +
  ".deck .slide .insight h2,.deck .slide .chart-page h2,.deck .slide .table-page h2," +
  ".deck .slide .toc h2,.deck .chart-box h3,.deck .text-box.light h2,.deck .copy h2{color:#172139!important}\n" +
  ".deck .text-box.gold{background:#FBBB28!important;color:#172139!important}\n" +
  ".deck .kpi-head h2,.deck .cover h1{color:#fff!important}\n" +
  "@media print{.deck .slide{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}\n\n";

/* Zebra solo en tablas de lámina — no en ranking/tablas del dashboard */
outCss = outCss.replace(
  /\.deck tbody tr:nth-child\(even\)\{background:#f5f7fb\}/g,
  ".deck .table-page tbody tr:nth-child(even),.deck .table-sparse tbody tr:nth-child(even){background:#f5f7fb}"
);

fs.writeFileSync(out, banner + outCss);
console.log("scoped", out, "bytes", fs.statSync(out).size);
