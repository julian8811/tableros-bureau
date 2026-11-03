#!/usr/bin/env node
/**
 * Genera design-options/informe-tec-referencia.html
 * Mock completo TEC + Colmayor V7 desde el paquete compacto del dashboard.
 */
const fs = require("fs");
const path = require("path");
const { armarPaqueteDashboard } = require("../api/evidencia");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "design-options", "informe-tec-referencia.html");
const CSS_SRC = OUT; // reuse current <style> block if present

const pack = armarPaqueteDashboard();
const fmt = (n) => (n == null || n === "" ? "—" : Number(n).toLocaleString("es-CO"));
const pct01 = (n, d = 1) => {
  if (n == null) return "—";
  const v = Math.abs(n) <= 1 ? n * 100 : n;
  return v.toFixed(d).replace(".", ",") + "%";
};
const pctAlready = (n, d = 1) => (n == null ? "—" : Number(n).toFixed(d).replace(".", ",") + "%");

/** Fotos Wikimedia Commons / Openverse — banco local assets/colombia-photos (sin PDF TEC). */
const MANIFEST_PATH = path.join(ROOT, "design-options", "assets", "colombia-photos", "manifest.json");
const photoManifest = fs.existsSync(MANIFEST_PATH)
  ? JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"))
  : { slots: {} };

function photo(slot) {
  const hit = photoManifest.slots && photoManifest.slots[slot];
  if (hit && hit.file) return hit.file.replace(/^assets\//, "assets/");
  return "assets/colombia-photos/" + slot + ".jpg";
}
function photoCredit(slot) {
  const hit = photoManifest.slots && photoManifest.slots[slot];
  if (!hit) return "";
  const who = hit.artist || hit.title || "Wikimedia Commons";
  const lic = hit.license ? " · " + hit.license : "";
  return `<p class="photo-credit">Foto: ${String(who).replace(/</g, "")}${lic}</p>`;
}

const fotos = {
  cover: photo("cover"),
  toc: photo("toc"),
  resumen: photo("resumen"),
  tendencias: photo("tendencias"),
  receptivo: photo("receptivo"),
  emisores: photo("emisores"),
  destinos: photo("destinos"),
  destinosB: photo("extra_salento"),
  reuniones: photo("reuniones"),
  visitante: photo("visitante"),
  visitanteB: photo("extra_tayrona"),
  oferta: photo("oferta"),
  conectividad: photo("conectividad"),
  marca: photo("marca"),
  territorio: photo("territorio"),
  gestion: photo("gestion"),
  pronostico: photo("pronostico")
};

const logosDark = `<div class="logos on-dark compact">
  <img class="logo-bureau" src="assets/logo_bureau.svg" alt="Bureau Medellín">
  <img class="logo-colmayor" src="assets/logo_colmayor_blanco.png?v=5" alt="Colmayor">
</div>`;
const logosLight = `<div class="logos on-light compact">
  <img class="logo-bureau" src="assets/logo_bureau.svg" alt="Bureau Medellín">
  <img class="logo-colmayor" src="assets/logo_colmayor_light.png?v=5" alt="Colmayor">
</div>`;

function photoFrame(photoUrl, creditSlot, alt) {
  return `<div class="photo-frame">
  <img class="photo-img" src="${photoUrl}" alt="${alt || "Turismo Colombia"}" loading="eager" decoding="async">
  ${photoCredit(creditSlot || "")}
</div>`;
}

function divider(title, photoUrl, label, creditSlot) {
  return `<section class="slide divider" aria-label="Divisor ${title}">
  <span class="slide-label">${label}</span>
  <div class="split">
    ${photoFrame(photoUrl, creditSlot, title)}
    <div class="stack">
      <div class="top-block"><div class="text-box dark">${logosDark}</div></div>
      <div class="mid-block"><div class="text-box gold">${title}</div></div>
      <div class="bot-block"></div>
    </div>
  </div>
  <div class="bar-maroon"></div>
</section>`;
}

function insight(label, photoUrl, h2, bullets, fuente, creditSlot) {
  return `<section class="slide insight" aria-label="${label}">
  <span class="slide-label">${label}</span>
  <div class="split">
    ${photoFrame(photoUrl, creditSlot, "Colombia")}
    <div class="copy panel white">
      <div class="text-box light logos-box">${logosLight}</div>
      <div class="text-box light body-box">
        <p class="kicker-sec">Hallazgo</p>
        <h2>${h2}</h2>
        <div class="insight-cols">
          <div>
            <p class="col-label">Datos</p>
            <ul>${bullets.map((b) => "<li>" + b + "</li>").join("")}</ul>
          </div>
          <div class="analisis">
            <p class="col-label">Lectura</p>
            <p class="analisis-text">${bullets[0] ? "Priorizar este hallazgo en la narrativa de destino y contrastarlo con el resto del pack." : ""}</p>
          </div>
        </div>
        <p class="fuente">${fuente}</p>
      </div>
      <div class="bar-maroon"></div>
    </div>
  </div>
</section>`;
}

let chartUid = 0;
function nextChartId(prefix) {
  chartUid += 1;
  return prefix + chartUid;
}

function shortLabel(s, n) {
  const t = String(s || "");
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

/** Barras verticales */
function svgBars(bars, opts) {
  const o = opts || {};
  const id = nextChartId("bf");
  const max = Math.max(...bars.map((b) => Number(b.value) || 0), 1);
  const base = 220;
  const top = 28;
  const scale = (base - top) / max;
  const n = Math.max(bars.length, 1);
  const gap = n > 6 ? 18 : 36;
  const barW = Math.min(52, Math.floor((420 - gap * (n - 1)) / n));
  const startX = 70;
  let rects = "";
  bars.forEach((b, i) => {
    const h = Math.max(2, (Number(b.value) || 0) * scale);
    const x = startX + i * (barW + gap);
    const y = base - h;
    const fill = b.highlight ? "#FBBB28" : "url(#" + id + ")";
    rects += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${fill}" rx="2"/>
      <text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" fill="#172139" font-size="11" font-weight="700" font-family="Montserrat,Arial,sans-serif">${b.display != null ? b.display : b.value}</text>
      <text x="${x + barW / 2}" y="242" text-anchor="middle" fill="#222" font-size="10" font-weight="600" font-family="Montserrat,Arial,sans-serif">${shortLabel(b.label, o.labelLen || 11)}</text>`;
  });
  const ticks = [0, 0.25, 0.5, 0.75, 1]
    .map((t) => {
      const y = base - max * t * scale;
      const val = Math.round(max * t);
      return `<line x1="48" y1="${y}" x2="500" y2="${y}" stroke="#cfd8e6"/>
      <text x="42" y="${y + 4}" text-anchor="end" fill="#7a8799" font-size="10" font-family="Montserrat,Arial,sans-serif">${val}</text>`;
    })
    .join("");
  return `<svg class="chart-svg" viewBox="0 0 520 260" role="img" aria-label="${o.title || "Gráfico de barras"}">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#00AEAC"/><stop offset="100%" stop-color="#108181"/></linearGradient></defs>
  ${ticks}${rects}
  <line x1="48" y1="220" x2="500" y2="220" stroke="#172139" stroke-width="1.5"/>
</svg>`;
}

/** Barras horizontales (rankings) */
function svgHBars(bars, opts) {
  const o = opts || {};
  const id = nextChartId("hb");
  const max = Math.max(...bars.map((b) => Number(b.value) || 0), 1);
  const left = 128;
  const right = 500;
  const top = 18;
  const rowH = Math.min(36, Math.floor(220 / Math.max(bars.length, 1)));
  let rows = "";
  bars.forEach((b, i) => {
    const y = top + i * rowH;
    const w = ((Number(b.value) || 0) / max) * (right - left - 8);
    const fill = b.highlight ? "#FBBB28" : "url(#" + id + ")";
    rows += `<text x="120" y="${y + 14}" text-anchor="end" fill="#172139" font-size="11" font-weight="600" font-family="Montserrat,Arial,sans-serif">${shortLabel(b.label, 16)}</text>
      <rect x="${left}" y="${y + 2}" width="${Math.max(4, w)}" height="16" fill="${fill}" rx="3"/>
      <text x="${left + Math.max(4, w) + 6}" y="${y + 14}" fill="#172139" font-size="11" font-weight="700" font-family="Montserrat,Arial,sans-serif">${b.display != null ? b.display : b.value}</text>`;
  });
  return `<svg class="chart-svg" viewBox="0 0 520 260" role="img" aria-label="${o.title || "Ranking"}">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#108181"/><stop offset="100%" stop-color="#00AEAC"/></linearGradient></defs>
  ${rows}
</svg>`;
}

/** Línea simple */
function svgLine(points, opts) {
  const o = opts || {};
  const vals = points.map((p) => Number(p.value) || 0);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const span = Math.max(max - min, 1);
  const left = 56;
  const right = 500;
  const top = 28;
  const base = 220;
  const step = points.length > 1 ? (right - left) / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = left + i * step;
    const y = base - ((Number(p.value) || 0) - min) / span * (base - top);
    return { x, y, label: p.label, value: p.value, display: p.display };
  });
  const path = coords.map((c, i) => (i ? "L" : "M") + c.x.toFixed(1) + "," + c.y.toFixed(1)).join(" ");
  const dots = coords
    .map(
      (c) =>
        `<circle cx="${c.x}" cy="${c.y}" r="4" fill="#FBBB28" stroke="#172139" stroke-width="1.2"/>
      <text x="${c.x}" y="${c.y - 10}" text-anchor="middle" fill="#172139" font-size="10" font-weight="700" font-family="Montserrat,Arial,sans-serif">${c.display != null ? c.display : c.value}</text>
      <text x="${c.x}" y="242" text-anchor="middle" fill="#222" font-size="10" font-weight="600" font-family="Montserrat,Arial,sans-serif">${shortLabel(c.label, 10)}</text>`
    )
    .join("");
  const ticks = [0, 0.5, 1]
    .map((t) => {
      const y = base - t * (base - top);
      const val = Math.round(min + span * t);
      return `<line x1="48" y1="${y}" x2="500" y2="${y}" stroke="#cfd8e6"/>
      <text x="42" y="${y + 4}" text-anchor="end" fill="#7a8799" font-size="10" font-family="Montserrat,Arial,sans-serif">${val}</text>`;
    })
    .join("");
  return `<svg class="chart-svg" viewBox="0 0 520 260" role="img" aria-label="${o.title || "Serie"}">
  ${ticks}
  <path d="${path}" fill="none" stroke="#00AEAC" stroke-width="3" stroke-linejoin="round"/>
  ${dots}
  <line x1="48" y1="220" x2="500" y2="220" stroke="#172139" stroke-width="1.5"/>
</svg>`;
}

function chartPage(label, h2, bullets, chartTitle, barsOrSvg, fuente, kind) {
  let svg;
  if (typeof barsOrSvg === "string") {
    svg = barsOrSvg;
  } else if (kind === "hbar") {
    svg = svgHBars(barsOrSvg, { title: chartTitle });
  } else if (kind === "line") {
    svg = svgLine(barsOrSvg, { title: chartTitle });
  } else {
    svg = svgBars(barsOrSvg, { title: chartTitle });
  }
  return `<section class="slide chart-page" aria-label="${label}">
  <span class="slide-label">${label}</span>
  <div class="head"><h2>${h2}</h2>${logosLight}</div>
  <div class="chart-body">
    <ul>${bullets.map((b) => "<li>" + b + "</li>").join("")}</ul>
    <div class="chart-box">
      <h3>${chartTitle}</h3>
      ${svg}
    </div>
  </div>
  <p class="fuente">${fuente}</p>
  <div class="bar-maroon"></div>
</section>`;
}

function tablePage(label, h2, headers, rows, foot, sideTitle, sideBullets, fuente) {
  const head = headers.map((h) => "<th>" + h + "</th>").join("");
  const body = rows.map((r) => "<tr>" + r.map((c) => "<td>" + c + "</td>").join("") + "</tr>").join("");
  const footHtml = foot ? "<tfoot><tr>" + foot.map((c) => "<td>" + c + "</td>").join("") + "</tr></tfoot>" : "";
  const sparse = rows.length <= 3;
  return `<section class="slide table-page${sparse ? " table-sparse" : ""}" aria-label="${label}">
  <span class="slide-label">${label}</span>
  <div class="head"><h2>${h2}</h2>${logosLight}</div>
  <div class="table-grid">
    <div class="table-wrap text-box light">
      <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${footHtml}</table>
    </div>
    <div class="side text-box light">
      <h3>${sideTitle}</h3>
      <ul>${sideBullets.map((b) => "<li>" + b + "</li>").join("")}</ul>
    </div>
  </div>
  <p class="fuente">${fuente}</p>
  <div class="bar-maroon"></div>
</section>`;
}

/** Lámina KPI con cajas sobre foto (opcional) o fondo navy. */
function kpiOnPhoto(label, photoUrl, creditSlot, h2, cards, fuente) {
  const cardsHtml = cards
    .map(
      (c) => `<article class="kpi-card text-box light">
      <p class="kpi-label">${c.label}</p>
      <p class="kpi-value">${c.value}</p>
      ${c.note ? `<p class="kpi-note">${c.note}</p>` : ""}
    </article>`
    )
    .join("");
  const stagePhoto = photoUrl
    ? photoFrame(photoUrl, creditSlot, h2)
    : `<div class="photo-frame kpi-fallback" aria-hidden="true"></div>`;
  return `<section class="slide kpi-photo" aria-label="${label}">
  <span class="slide-label">${label}</span>
  <div class="kpi-photo-stage">
    ${stagePhoto}
    <div class="kpi-overlay">
      <div class="text-box dark kpi-head">${logosDark}<h2>${h2}</h2></div>
      <div class="kpi-grid">${cardsHtml}</div>
      <p class="fuente on-photo">${fuente}</p>
    </div>
  </div>
  <div class="bar-maroon"></div>
</section>`;
}

function extractStyle() {
  if (!fs.existsSync(CSS_SRC)) return defaultStyle();
  const prev = fs.readFileSync(CSS_SRC, "utf8");
  const m = prev.match(/<style>[\s\S]*?<\/style>/);
  if (!m) return defaultStyle();
  // Portada: la imagen va inline (Commons); neutralizar fondo TEC del CSS previo
  let css = m[0].replace(
    /url\("assets\/tec-photos\/cover\.png"\)/g,
    "none"
  );
  return css.replace(
    "</style>",
    `
  /* Foto completa en contenedor (sin crop) + cajas de texto encima */
  .photo-frame{
    position:relative;background:#0b1220;display:grid;place-items:center;
    overflow:hidden;min-height:0;height:100%;width:100%;
  }
  .photo-img{
    width:100%;height:100%;object-fit:contain;object-position:center;display:block;
  }
  .photo-credit{
    position:absolute;left:0;right:0;bottom:0;z-index:3;margin:0;padding:6px 10px;
    font-size:9px;line-height:1.3;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.75));
  }
  .text-box{border-radius:10px}
  .text-box.dark{background:rgba(23,33,57,.88);padding:14px 16px;backdrop-filter:blur(6px)}
  .text-box.gold{background:var(--tec-gold);color:var(--tec-navy);padding:14px 18px;font-weight:800}
  .text-box.light{background:rgba(255,255,255,.96);padding:14px 16px;box-shadow:0 8px 24px rgba(23,33,57,.12)}
  .cover{
    background:#0b1220 !important;background-image:none !important;
    display:grid;grid-template-rows:1fr;position:relative;
  }
  .cover-stage{position:absolute;inset:0;z-index:0}
  .cover-stage .photo-img{object-fit:contain}
  .cover .top,.cover .center{position:relative;z-index:2}
  .cover .top{inset:auto;padding:28px 36px 0;display:flex;justify-content:flex-start}
  .cover .top .text-box{display:inline-flex}
  .cover .center{
    left:50%;top:50%;transform:translate(-50%,-50%);position:absolute;
    text-align:center;width:min(92%,860px);
  }
  .cover .center h1{
    display:inline-block;background:rgba(23,33,57,.82);padding:14px 22px;border-radius:12px;
    backdrop-filter:blur(6px);margin:0 0 14px;
  }
  .cover .photo-credit{z-index:4}
  .toc .panel{padding:24px 28px 40px;display:flex;flex-direction:column}
  .toc ol{gap:6px;grid-template-columns:1fr 1fr;display:grid}
  .toc li{grid-template-columns:40px 1px 1fr;gap:10px}
  .toc .n{font-size:15px}
  .toc .t{font-size:12.5px;line-height:1.2}
  .toc .v{height:22px}
  .toc h2{margin:14px 0 6px;font-size:28px}
  .kicker-sec{margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--tec-teal)}
  .col-label{margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--tec-gold)}
  .insight-cols{display:grid;grid-template-columns:1.15fr .85fr;gap:18px;flex:1;min-height:0}
  .insight-cols ul{margin:0;padding-left:16px;display:grid;gap:8px}
  .insight-cols li{font-size:12.5px;line-height:1.4}
  .analisis{border-left:3px solid var(--tec-gold);padding-left:14px}
  .analisis-text{margin:0;font-size:12.5px;line-height:1.45;color:#333}
  .insight h2{font-size:clamp(16px,1.7vw,22px);max-width:42ch}
  .insight .copy{gap:12px;padding:22px 28px 40px}
  .insight .body-box{flex:1;display:flex;flex-direction:column;min-height:0}
  .chart-body{grid-template-columns:1fr 1.15fr;gap:20px}
  .chart-box .chart-svg{width:100%;height:auto;min-height:200px;display:block}
  .table-page{display:grid;grid-template-rows:auto 1fr auto;gap:10px}
  .table-grid{grid-template-columns:1.3fr .85fr;gap:16px;align-items:stretch;min-height:0}
  .table-wrap{overflow:auto;min-height:0}
  .table-page table{font-size:13px}
  .table-page tbody td{padding:10px 12px;vertical-align:top}
  .table-page .side h3{margin:0 0 10px;font-size:14px;color:var(--tec-navy)}
  .table-page .side ul{gap:12px}
  .table-page .side li{font-size:13.5px;line-height:1.45}
  .table-sparse .table-grid{grid-template-columns:1fr 1fr;align-content:center}
  .table-sparse table{font-size:15px}
  .table-sparse tbody td{padding:16px 14px}
  .divider .top-block,.divider .mid-block,.divider .bot-block{display:flex;align-items:center}
  .divider .top-block{justify-content:center;padding:22px}
  .divider .mid-block{padding:16px 22px;background:transparent !important;font-size:clamp(18px,2.1vw,28px)}
  .divider .mid-block .text-box.gold{width:100%;font-size:inherit;letter-spacing:.02em}
  .kpi-photo{padding:0;overflow:hidden}
  .kpi-photo-stage{position:relative;height:100%;background:#0b1220}
  .kpi-photo-stage .photo-frame{position:absolute;inset:0}
  .kpi-fallback{
    background:
      radial-gradient(ellipse at 30% 20%,rgba(0,174,172,.28),transparent 55%),
      linear-gradient(160deg,#172139 0%,#195855 55%,#0b1220 100%) !important;
  }
  .kpi-overlay{
    position:relative;z-index:2;height:100%;padding:28px 32px 40px;
    display:grid;grid-template-rows:auto 1fr auto;gap:16px;box-sizing:border-box;
  }
  .kpi-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}
  .kpi-head h2{margin:0;color:#fff;font-size:clamp(16px,1.8vw,22px);max-width:40ch;line-height:1.25}
  .kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;align-content:center}
  .kpi-card{min-height:120px;display:grid;align-content:center;gap:6px}
  .kpi-label{margin:0;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--tec-teal)}
  .kpi-value{margin:0;font-size:clamp(18px,2vw,26px);font-weight:800;color:var(--tec-navy);line-height:1.2}
  .kpi-note{margin:0;font-size:12px;color:#445;line-height:1.4}
  .fuente.on-photo{color:#e8eef8;background:rgba(0,0,0,.45);padding:8px 10px;border-radius:8px;width:fit-content}
  @media (max-width:900px){
    .toc ol,.insight-cols,.table-grid,.kpi-grid{grid-template-columns:1fr}
  }
</style>`
  );
}

function defaultStyle() {
  return `<style>
  :root{--tec-navy:#172139;--tec-gold:#FBBB28;--tec-yellow:var(--tec-gold);--tec-teal-bright:#00AEAC;--slide-w:1280px}
  body{margin:0;font-family:Montserrat,Calibri,Arial,sans-serif;background:#0e1422}
</style>`;
}

// --- pack fields ---
const mincit = pack.mincit_vnr || {};
const shares = (mincit.shares_anual || []).slice().sort((a, b) => a.anio - b.anio);
const share2025 = shares.find((s) => s.anio === 2025) || shares[shares.length - 1];
const top2026 = mincit.top_paises_2026 || [];
const total2026 = top2026.reduce((a, b) => a + (b.visitantes || 0), 0);
const usa = top2026[0];
const ema = pack.ema_ult6 || [];
const emaLast = ema[ema.length - 1] || {};
const trm = pack.trm_ultimo || {};
const owid = pack.owid_top || [];
const icca = pack.icca || {};
const evi = pack.evi_ola || {};
const marca = pack.marca_llm || {};
const conn = pack.conectividad_anual || [];
const conn2025 = conn
  .filter((c) => c.anio === 2025)
  .sort((a, b) => (b.llegadas || 0) - (a.llegadas || 0))
  .slice(0, 5);
const gest = pack.informe_gestion_2025 || {};
const pron = pack.pronostico || {};
const sit = pack.sit || [];
const medata = pack.medata_zonas || [];
const seg = pack.seguridad_muestra || [];
const clima = pack.clima || {};
const corte = (pack.meta && pack.meta.corte_sugerido) || "2026-11-03";

const tocItems = [
  ["1", "Tendencias"],
  ["2", "Turismo receptivo"],
  ["2.1", "Emisores internacionales"],
  ["2.2", "Destinos / ciudades"],
  ["2.3", "Reuniones y negocios (ICCA)"],
  ["3", "Perfil del visitante (EVI)"],
  ["3.1", "Oferta turística"],
  ["4", "Conectividad aérea"],
  ["5", "Marca y conversación"],
  ["6", "Territorio, clima y seguridad"],
  ["7", "Gestión Bureau"],
  ["8", "Pronóstico"]
];

let slideN = 0;
const next = (txt) => {
  slideN += 1;
  return slideN + " · " + txt;
};

let body = "";

body += `<section class="slide cover" aria-label="Portada">
  <span class="slide-label">${next("Portada")}</span>
  <div class="cover-stage">${photoFrame(fotos.cover, "cover", "Cartagena ciudad amurallada")}</div>
  <div class="top">
    <div class="text-box dark">
      <div class="logos on-dark">
        <img class="logo-bureau" src="assets/logo_bureau.svg" alt="Greater Medellín Convention and Visitors Bureau">
        <img class="logo-colmayor" src="assets/logo_colmayor_blanco.png?v=5" alt="Colegio Mayor de Antioquia">
      </div>
    </div>
  </div>
  <div class="center">
    <h1>Turismo e inteligencia<br>de destino · Medellín</h1>
    <div class="period">Corte ${corte}</div>
  </div>
  <div class="bar-maroon"></div>
</section>`;

body += `<section class="slide" aria-label="Contenido">
  <span class="slide-label">${next("Contenido")}</span>
  <div class="split toc">
    ${photoFrame(fotos.toc, "toc", "Cartagena murallas")}
    <div class="panel">
      <div style="display:flex;justify-content:flex-end">${logosLight}</div>
      <h2>Contenido</h2>
      <div class="rule"></div>
      <ol>${tocItems.map(([n, t]) => '<li><span class="n">' + n + '</span><span class="v"></span><span class="t">' + t + "</span></li>").join("")}</ol>
      <div class="bar-maroon"></div>
    </div>
  </div>
</section>`;

body += insight(
  next("Resumen ejecutivo"),
  fotos.resumen,
  "Corte " + corte + " · cobertura completa del dashboard Bureau + Colmayor",
  [
    share2025
      ? "En <strong>" +
        share2025.anio +
        "</strong> Medellín recibió <strong>" +
        fmt(share2025.medellin) +
        "</strong> VNR MinCIT (<strong>" +
        pct01(share2025.share_colombia) +
        "</strong> de Colombia)."
      : "MinCIT VNR disponible en pack.",
    "TRM promedio último mes: <strong>" +
      fmt(trm.trm) +
      " COP/USD</strong> (" +
      trm.anio +
      "-" +
      String(trm.mes).padStart(2, "0") +
      ").",
    "Gestión 2025: <strong>" +
      fmt(gest.captados) +
      "</strong> eventos captados/apoyados · impacto <strong>USD " +
      fmt(gest.impactoUsd) +
      "</strong>.",
    "Marca LLM: <strong>" +
      fmt(marca.n_total) +
      "</strong> piezas · tópico: <strong>" +
      (marca.top_topico_global || "—") +
      "</strong>.",
    "Oferta en tablero: <strong>" +
      fmt(pack.oferta_n) +
      "</strong> registros · Prensa: <strong>" +
      fmt(pack.prensa_n) +
      "</strong> piezas."
  ],
  "Fuente: paquete compacto dashboard · meta.corte_sugerido " + corte,
  "resumen"
);

body += divider("1. TENDENCIAS", fotos.tendencias, next("Divisor tendencias"), "tendencias");
const emaBars = ema.slice(-5).map((r) => ({
  label: r.anio + "-" + String(r.mes).padStart(2, "0").slice(-2),
  value: r.indice_antioquia || 0,
  display: String(r.indice_antioquia || 0)
}));
body += chartPage(
  next("Tendencias · EMA + TRM"),
  "EMA Antioquia en <strong>" +
    (emaLast.indice_antioquia || "—") +
    "</strong> vs regiones <strong>" +
    (emaLast.indice_promedio_regiones || "—") +
    "</strong> · TRM <strong>" +
    fmt(trm.trm) +
    "</strong>",
  [
    "Último índice Antioquia <strong>" +
      (emaLast.indice_antioquia || "—") +
      "</strong> (índice 100 = <strong>" +
      (emaLast.indice_100 || "—") +
      "</strong>).",
    "TRM promedio <strong>" +
      fmt(trm.trm) +
      "</strong> COP/USD en " +
      trm.anio +
      "-" +
      String(trm.mes).padStart(2, "0") +
      " (" +
      fmt(trm.n_dias) +
      " días).",
    medata[0]
      ? "Medata tarifas por zona (ej. " + medata.map((z) => z.zona).slice(0, 3).join(", ") + ")."
      : "Medata zonas en pack.",
    owid[0]
      ? "OWID: " + owid[0].pais + " lidera llegadas de referencia (" + fmt(owid[0].valor) + ", " + owid[0].anio + ")."
      : ""
  ].filter(Boolean),
  "Índice EMA Antioquia (últimos meses)",
  emaBars,
  "Fuente: ema_ult6, trm_ultimo, medata_zonas, owid_top"
);

body += divider("2. TURISMO RECEPTIVO", fotos.receptivo, next("Divisor receptivo"), "receptivo");
const shareBars = shares.slice(-4).map((s) => ({
  label: String(s.anio),
  value: Math.round((s.medellin || 0) / 1000),
  display: fmt(Math.round((s.medellin || 0) / 1000))
}));
body += chartPage(
  next("Receptivo MinCIT VNR"),
  share2025
    ? "Medellín <strong>" +
      fmt(share2025.medellin) +
      "</strong> VNR en " +
      share2025.anio +
      " · <strong>" +
      pct01(share2025.share_colombia) +
      "</strong> de Colombia · <strong>" +
      pct01(share2025.share_antioquia) +
      "</strong> de Antioquia"
    : "Receptivo MinCIT",
  shares.slice(-3).map(
    (s) =>
      "En <strong>" +
      s.anio +
      "</strong>: Medellín <strong>" +
      fmt(s.medellin) +
      "</strong> · Antioquia <strong>" +
      fmt(s.antioquia) +
      "</strong> · Colombia <strong>" +
      fmt(s.colombia) +
      "</strong>."
  ),
  "Llegadas Medellín VNR (miles)",
  shareBars,
  "Fuente: mincit_vnr.shares_anual"
);

body += divider("2.1 EMISORES INTERNACIONALES", fotos.emisores, next("Divisor emisores"), "emisores");
const top5share = top2026.slice(0, 5).reduce((a, b) => a + (b.visitantes || 0), 0) / (total2026 || 1);
const emBars = top2026.slice(0, 6).map((p, i) => ({
  label: p.pais,
  value: p.visitantes || 0,
  display: fmt(p.visitantes),
  highlight: i === 0
}));
body += chartPage(
  next("Emisores YTD 2026"),
  usa ? usa.pais + " lidera con <strong>" + fmt(usa.visitantes) + "</strong> llegadas YTD 2026" : "Emisores YTD 2026",
  [
    usa ? "<strong>" + usa.pais + "</strong> concentra la mayor cuota del top publicado." : "Ver top MinCIT.",
    "El top 5 concentra <strong>" + pct01(top5share) + "</strong> del set de países en pack.",
    top2026[1] ? "<strong>" + top2026[1].pais + "</strong> es el segundo mercado (" + fmt(top2026[1].visitantes) + ")." : ""
  ].filter(Boolean),
  "Top emisores YTD 2026 (llegadas)",
  emBars,
  "Fuente: mincit_vnr.top_paises_2026",
  "hbar"
);

body += divider("2.2 DESTINOS / CIUDADES", fotos.destinos, next("Divisor destinos"), "destinos");
const shareColBars = shares.slice(-4).map((s) => ({
  label: String(s.anio),
  value: Math.round((s.share_colombia || 0) * 1000) / 10,
  display: pct01(s.share_colombia)
}));
body += chartPage(
  next("Share ciudad vs país"),
  share2025
    ? "Share Medellín/Colombia en " +
      share2025.anio +
      ": <strong>" +
      pct01(share2025.share_colombia) +
      "</strong> · vs Antioquia <strong>" +
      pct01(share2025.share_antioquia) +
      "</strong>"
    : "Destinos MinCIT",
  [
    share2025 ? "Volumen ciudad: <strong>" + fmt(share2025.medellin) + "</strong> VNR." : "",
    "Serie de share Medellín/Colombia en shares_anual del pack.",
    "Competitividad relativa: cruzar con tablero MinCIT cuando el pack lo amplíe."
  ].filter(Boolean),
  "Share Medellín / Colombia (%)",
  shareColBars,
  "Fuente: mincit_vnr.shares_anual"
);

body += divider("2.3 REUNIONES Y NEGOCIOS", fotos.reuniones, next("Divisor ICCA"), "reuniones");
const iccaCities = icca.ciudades || [];
body += chartPage(
  next("ICCA ciudades"),
  "Ranking ICCA " + (icca.anio || "") + " · reuniones internacionales",
  [
    iccaCities[0]
      ? "<strong>" + iccaCities[0].ciudad + "</strong> lidera el set local con puesto <strong>" + iccaCities[0].puesto + "</strong>."
      : "ICCA en pack.",
    "Usar ICCA como proxy de agenda MICE, no como flujo vacacional.",
    "Cruzar con captación Bureau (gestión 2025) en la sección 7."
  ],
  "Reuniones ICCA por ciudad",
  iccaCities.map((c, i) => ({
    label: c.ciudad,
    value: c.reuniones || 0,
    display: fmt(c.reuniones),
    highlight: i === 0
  })),
  "Fuente: icca · anio " + (icca.anio || "—")
);

body += divider("3. PERFIL DEL VISITANTE (EVI)", fotos.visitante, next("Divisor visitante"), "visitante");
const motivos = evi.motivos || [];
body += chartPage(
  next("EVI gasto y motivos"),
  "EVI " +
    (evi.ola || "") +
    " · n=<strong>" +
    fmt(evi.n) +
    "</strong> · gasto diario <strong>USD " +
    fmt(evi.gasto_diario_usd) +
    "</strong>",
  [
    "Gasto por estadía <strong>USD " +
      fmt(evi.gasto_estadia_usd) +
      "</strong> · noches media <strong>" +
      (evi.noches != null ? Number(evi.noches).toFixed(1).replace(".", ",") : "—") +
      "</strong>.",
    ...motivos.slice(0, 2).map((m) => "<strong>" + m.nombre + "</strong>: " + pctAlready(m.participacion) + "."),
    evi.residencia && evi.residencia[0]
      ? "Residencia top: <strong>" + evi.residencia[0].nombre + "</strong> (" + pctAlready(evi.residencia[0].participacion) + ")."
      : ""
  ].filter(Boolean),
  "Motivos de viaje EVI (% participación)",
  motivos.slice(0, 5).map((m, i) => ({
    label: m.nombre,
    value: m.participacion || 0,
    display: pctAlready(m.participacion),
    highlight: i === 0
  })),
  "Fuente: evi_ola · huella",
  "hbar"
);

body += divider("3.1 OFERTA TURÍSTICA", fotos.oferta, next("Divisor oferta"), "oferta");
body += chartPage(
  next("Oferta en tablero"),
  "El tablero registra <strong>" + fmt(pack.oferta_n) + "</strong> elementos de oferta turística",
  [
    "Inventario compacto; no inventar tipologías fuera del pack.",
    "Útil para narrativa de capacidad frente a picos de demanda.",
    "Prensa en pack: <strong>" + fmt(pack.prensa_n) + "</strong> piezas (referencia de conversación)."
  ],
  "Oferta vs prensa (conteos del pack)",
  [
    { label: "Oferta", value: pack.oferta_n || 0, display: fmt(pack.oferta_n), highlight: true },
    { label: "Prensa", value: pack.prensa_n || 0, display: fmt(pack.prensa_n) }
  ],
  "Fuente: oferta_n, prensa_n"
);

body += divider("4. CONECTIVIDAD AÉREA", fotos.conectividad, next("Divisor conectividad"), "conectividad");
body += chartPage(
  next("Aerocivil / mercados 2025"),
  "Top mercados por llegadas 2025 (serie conectividad)",
  [
    conn2025[0] ? "<strong>" + conn2025[0].mercado + "</strong> concentra el mayor volumen de llegadas en 2025." : "",
    "Separar doméstico vs internacional al comunicar capacidad aérea.",
    "Serie anual disponible en conectividad_anual del pack."
  ].filter(Boolean),
  "Llegadas 2025 por mercado (miles)",
  conn2025.map((c, i) => ({
    label: c.mercado,
    value: Math.round((c.llegadas || 0) / 1000),
    display: fmt(Math.round((c.llegadas || 0) / 1000)),
    highlight: i === 0
  })),
  "Fuente: conectividad_anual · anio 2025",
  "hbar"
);

body += divider("5. MARCA Y CONVERSACIÓN", fotos.marca, next("Divisor marca"), "marca");
const serieMarca = marca.serie || [];
body += chartPage(
  next("Marca LLM + prensa + SIT"),
  "Marca LLM: <strong>" +
    fmt(marca.n_total) +
    "</strong> piezas · tópico <strong>" +
    (marca.top_topico_global || "—") +
    "</strong>",
  [
    "Ventana <strong>" + (marca.ventana || "—") + "</strong>.",
    "Prensa Bureau en pack: <strong>" + fmt(pack.prensa_n) + "</strong> piezas.",
    sit[0]
      ? "SIT ejemplo: <strong>" +
        sit[0].mercado +
        "</strong> · llegadas " +
        fmt(sit[0].llegadas) +
        " (" +
        (sit[0].periodo || "") +
        ")."
      : "SIT en pack.",
    ...serieMarca
      .slice(0, 2)
      .map(
        (s) =>
          "<strong>" +
          s.categoria +
          "</strong>: n=" +
          fmt(s.n) +
          " · share " +
          pct01(s.share) +
          " · sent_net " +
          (s.sent_net != null ? Number(s.sent_net).toFixed(2) : "—")
      )
  ].filter(Boolean),
  "Piezas por categoría (Marca LLM)",
  serieMarca.slice(0, 5).map((s) => ({ label: s.categoria, value: s.n || 0, display: String(s.n || 0) })),
  "Fuente: marca_llm, prensa_n, sit"
);

body += divider("6. TERRITORIO, CLIMA Y SEGURIDAD", fotos.territorio, next("Divisor territorio"), "territorio");
const segLine = seg.slice(-8).map((s) => ({
  label: String(s.periodo || "").slice(2),
  value: s.hurtos || 0,
  display: fmt(s.hurtos)
}));
body += chartPage(
  next("Seguridad + clima"),
  "Señales territoriales del pack (muestra seguridad)",
  [
    seg.length
      ? "Muestra: <strong>" + fmt(seg.length) + "</strong> periodos · último hurtos <strong>" + fmt(seg[seg.length - 1].hurtos) + "</strong> (" + seg[seg.length - 1].periodo + ")."
      : "Sin muestra seguridad.",
    clima.resumen && clima.resumen[0]
      ? "Clima <strong>" + clima.resumen[0].periodo + "</strong> · mm_prom " + fmt(clima.resumen[0].mm_prom) + " · est. " + fmt(clima.resumen[0].n_estaciones) + "."
      : "Clima en pack.",
    "No extrapolar seguridad fuera de la muestra publicada."
  ].filter(Boolean),
  "Hurtos en muestra de seguridad (serie)",
  segLine.length ? segLine : [{ label: "—", value: 0, display: "0" }],
  "Fuente: seguridad_muestra, clima",
  "line"
);

body += divider("7. GESTIÓN BUREAU", fotos.gestion, next("Divisor gestión"), "gestion");
const flujo = gest.flujo || [];
body += chartPage(
  next("Informe de gestión 2025"),
  "Captación 2025: <strong>" +
    fmt(gest.captados) +
    "</strong> eventos · impacto <strong>USD " +
    fmt(gest.impactoUsd) +
    "</strong>",
  [
    "Internacionales <strong>" + fmt(gest.internacionales) + "</strong> · nacionales <strong>" + fmt(gest.nacionales) + "</strong>.",
    "Asistentes <strong>" + fmt(gest.asistentes) + "</strong> · cuartos-noche <strong>" + fmt(gest.cuartosNoche) + "</strong>.",
    flujo[0] ? flujo[0].etiqueta + ": <strong>" + String(flujo[0].valor) + "</strong>." : "Fuente: Informe de gestión 2025 CVB."
  ].filter(Boolean),
  "Eventos captados 2025 (conteo)",
  [
    { label: "Total", value: gest.captados || 0, display: fmt(gest.captados), highlight: true },
    { label: "Internac.", value: gest.internacionales || 0, display: fmt(gest.internacionales) },
    { label: "Nacional", value: gest.nacionales || 0, display: fmt(gest.nacionales) }
  ],
  "Fuente: informe_gestion_2025"
);

body += divider("8. PRONÓSTICO", fotos.pronostico, next("Divisor pronóstico"), "pronostico");
const series = pron.series || [];
body += chartPage(
  next("Modelos de pronóstico"),
  "Pronóstico generado <strong>" + (pron.generado || "—") + "</strong> · series del tablero",
  [
    "MAPE bajo no garantiza acierto fuera de muestra; usar como rango de planeación.",
    series[0] ? "Ejemplo: <strong>" + series[0].id + "</strong> · " + series[0].modelo + " · MAPE " + series[0].mape + "%." : "",
    "Horizonte y holdout están en el objeto pronostico del pack."
  ].filter(Boolean),
  "MAPE por serie de pronóstico (%)",
  series.map((s, i) => ({
    label: String(s.id || "").replace(/^llegadas_/, "").replace(/_/g, " "),
    value: s.mape || 0,
    display: s.mape != null ? String(s.mape).replace(".", ",") : "—",
    highlight: i === 0
  })),
  "Fuente: pronostico",
  "hbar"
);

const style = extractStyle();
const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mock completo TEC · Colmayor V7 · cobertura dashboard</title>
${style}
</head>
<body>
  <nav class="back">
    <span class="opt">TEC + Colmayor V7</span>
    <strong>Mock completo · diagramación de Generar</strong>
    <a href="informe-index.html">← Chooser</a>
  </nav>
  <div class="deck">
    <p class="note"><b>Sí:</b> diagramación de <b>Generar</b> (TEC + Manual V7). Fotos: <b>Wikimedia Commons API</b> (+ Openverse fallback), turismo Colombia, una imagen distinta por lámina fotográfica. Atribución CC en cada foto. Sin imágenes del PDF TEC.</p>
    ${body}
  </div>
</body>
</html>
`;

fs.writeFileSync(OUT, html, "utf8");
console.log("Wrote", OUT);
console.log("slides:", slideN, "bytes:", html.length);
