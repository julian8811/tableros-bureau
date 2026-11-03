#!/usr/bin/env node
/**
 * QA contraste dashboard + informe deck (títulos negros, selects, charts).
 * Uso: node scripts/qa_contrast_playwright.js [baseUrl]
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PORT = 8095;
const OUT = path.join(ROOT, "design-options", "qa-piezas");
const BASE = process.argv[2] || ("http://127.0.0.1:" + PORT);

function startStatic(port, cwd) {
  return spawn(
    process.execPath,
    [
      "-e",
      "const http=require('http'),fs=require('fs'),path=require('path');" +
        "const root=process.argv[1],port=+process.argv[2];" +
        "const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'," +
        "'.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};" +
        "http.createServer((req,res)=>{" +
        "let u=decodeURIComponent((req.url||'/').split('?')[0]);" +
        "if(u==='/')u='/index.html';" +
        "const f=path.join(root,u.replace(/^\\//,''));" +
        "fs.readFile(f,(e,b)=>{" +
        "if(e){res.writeHead(404);return res.end('404 '+u);}" +
        "res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});res.end(b);" +
        "});}).listen(port);",
      cwd,
      String(port)
    ],
    { stdio: "ignore" }
  );
}

function waitPort(port, ms) {
  const deadline = Date.now() + ms;
  return new Promise(function (resolve, reject) {
    (function tick() {
      http.get({ host: "127.0.0.1", port: port, path: "/", timeout: 1500 }, function (res) {
        res.resume();
        resolve();
      }).on("error", function () {
        if (Date.now() > deadline) reject(new Error("port timeout"));
        else setTimeout(tick, 250);
      });
    })();
  });
}

function parseRgb(c) {
  if (!c || c === "transparent" || c === "rgba(0, 0, 0, 0)") return null;
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3] };
}

function lum(c) {
  const p = parseRgb(c);
  if (!p) return null;
  return (0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b) / 255;
}

function isDark(c) {
  const L = lum(c);
  return L != null && L < 0.45;
}

function isNearBlack(c) {
  const L = lum(c);
  return L != null && L < 0.22;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let kid = null;
  if (!process.argv[2]) {
    kid = startStatic(PORT, ROOT);
    await waitPort(PORT, 15000);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const issues = [];

  async function auditContrast(label) {
    return page.evaluate(function (label) {
      function parseRgb(c) {
        if (!c || c === "transparent" || c === "rgba(0, 0, 0, 0)") return null;
        const m = String(c).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!m) return null;
        return { r: +m[1], g: +m[2], b: +m[3] };
      }
      function lum(c) {
        const p = parseRgb(c);
        if (!p) return null;
        return (0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b) / 255;
      }
      function effectiveBg(el) {
        let n = el;
        while (n && n !== document.documentElement) {
          const cs = getComputedStyle(n);
          const bg = cs.backgroundColor;
          const p = parseRgb(bg);
          if (p && !(p.r === 0 && p.g === 0 && p.b === 0 && /rgba\(0,\s*0,\s*0,\s*0\)/.test(bg))) {
            if (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent") return bg;
          }
          n = n.parentElement;
        }
        return getComputedStyle(document.body).backgroundColor;
      }

      const bad = [];
      const sels = [
        "h1", "h2", "h3", "h4",
        ".block h3", ".kpi .label", ".kpi .value",
        ".tab", ".opts", ".aviso", ".lead", ".kicker",
        "select", "option", ".filter select", ".llm-sel select",
        ".tec-sec-head h3", ".slide h1", ".slide h2", ".slide h3",
        ".chart-box h3", ".mid-block", ".text-box.gold",
        ".fuente", ".photo-credit"
      ];
      const seen = new Set();
      sels.forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (el, i) {
          if (i > 40) return;
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden") return;
          const color = cs.color;
          const bg = effectiveBg(el);
          const Lc = lum(color);
          const Lb = lum(bg);
          if (Lc == null || Lb == null) return;
          const darkText = Lc < 0.35;
          const darkBg = Lb < 0.45;
          const lightText = Lc > 0.75;
          const lightBg = Lb > 0.75;
          const key = sel + "|" + (el.textContent || "").slice(0, 40);
          if (seen.has(key)) return;
          if ((darkText && darkBg) || (lightText && lightBg)) {
            seen.add(key);
            bad.push({
              where: label,
              sel: sel,
              text: String(el.textContent || "").trim().slice(0, 60),
              color: color,
              bg: bg,
              Lc: Number(Lc.toFixed(3)),
              Lb: Number(Lb.toFixed(3))
            });
          }
        });
      });

      const selects = Array.prototype.slice.call(document.querySelectorAll("select")).slice(0, 12).map(function (s) {
        const cs = getComputedStyle(s);
        const opt = s.options && s.options[s.selectedIndex];
        const ocs = opt ? getComputedStyle(opt) : null;
        return {
          name: s.getAttribute("aria-label") || s.name || s.className || s.id || "select",
          color: cs.color,
          bg: cs.backgroundColor,
          colorScheme: getComputedStyle(document.documentElement).colorScheme || "",
          optionColor: ocs ? ocs.color : null,
          optionBg: ocs ? ocs.backgroundColor : null,
          Lc: lum(cs.color),
          Lb: lum(cs.backgroundColor)
        };
      });

      return { bad: bad, selects: selects, bodyBg: getComputedStyle(document.body).backgroundColor };
    }, label);
  }

  // --- Mercados dashboard ---
  await page.goto(BASE.replace(/\/$/, "") + "/index.html?tab=mercados&anio=2025", {
    waitUntil: "networkidle",
    timeout: 90000
  });
  await page.waitForTimeout(1200);
  const mercados = await auditContrast("mercados");
  await page.screenshot({ path: path.join(OUT, "qa-mercados.png"), fullPage: false });
  mercados.bad.forEach(function (b) { issues.push(b); });
  mercados.selects.forEach(function (s) {
    if (s.Lc != null && s.Lb != null && s.Lc < 0.35 && s.Lb < 0.45) {
      issues.push({ where: "mercados-select", sel: s.name, text: "select", color: s.color, bg: s.bg, Lc: s.Lc, Lb: s.Lb });
    }
  });

  // --- Informes LLM selectors ---
  await page.goto(BASE.replace(/\/$/, "") + "/index.html?tab=informes&pieza=informe&anio=2025", {
    waitUntil: "networkidle",
    timeout: 90000
  });
  await page.waitForTimeout(1500);
  const informes = await auditContrast("informes");
  await page.screenshot({ path: path.join(OUT, "qa-informes.png"), fullPage: false });
  informes.bad.forEach(function (b) { issues.push(b); });

  const deck = await page.evaluate(function () {
    const slides = document.querySelectorAll("#pieza-export .slide");
    const charts = document.querySelectorAll("#pieza-export .chart-svg");
    const rects = Array.prototype.slice.call(document.querySelectorAll("#pieza-export .chart-svg rect"));
    const fat = rects.filter(function (r) {
      return Number(r.getAttribute("width") || 0) >= 12 || Number(r.getAttribute("height") || 0) >= 8;
    }).length;
    const tiny = rects.filter(function (r) {
      const w = Number(r.getAttribute("width") || 0);
      const h = Number(r.getAttribute("height") || 0);
      return (w > 0 && w < 8) || (h > 0 && h < 6);
    }).length;
    // chart title colors inside slide (should be dark on white slide)
    const chartTitles = Array.prototype.slice.call(document.querySelectorAll("#pieza-export .chart-box h3, #pieza-export .slide h2")).slice(0, 8).map(function (el) {
      const cs = getComputedStyle(el);
      return { text: (el.textContent || "").slice(0, 50), color: cs.color, bg: getComputedStyle(el.parentElement || el).backgroundColor };
    });
    // dashboard shell titles outside deck
    const dashTitles = Array.prototype.slice.call(document.querySelectorAll(".aviso, .opts, .mando h1, .site h1, .block h3")).slice(0, 20).map(function (el) {
      const cs = getComputedStyle(el);
      return { cls: el.className, text: (el.textContent || "").trim().slice(0, 50), color: cs.color };
    });
    return {
      slides: slides.length,
      charts: charts.length,
      fat: fat,
      tiny: tiny,
      chartTitles: chartTitles,
      dashTitles: dashTitles,
      deckExists: !!document.querySelector("#pieza-export.deck, #pieza-export.tec-deck")
    };
  });

  if (!deck.deckExists) issues.push({ where: "informe", sel: "#pieza-export", text: "deck missing", color: "", bg: "", Lc: 0, Lb: 0 });
  if (deck.charts < 5) issues.push({ where: "informe", sel: "charts", text: "charts=" + deck.charts, color: "", bg: "", Lc: 0, Lb: 0 });
  if (deck.tiny > 3) issues.push({ where: "informe", sel: "tiny-bars", text: "tiny=" + deck.tiny, color: "", bg: "", Lc: 0, Lb: 0 });

  // screenshot first chart slide
  const chartSlide = page.locator("#pieza-export .slide.chart-page").first();
  if (await chartSlide.count()) {
    await chartSlide.scrollIntoViewIfNeeded();
    await chartSlide.screenshot({ path: path.join(OUT, "qa-chart-slide.png") });
  }

  // Export HTML and re-open
  const dlP = page.waitForEvent("download", { timeout: 25000 }).catch(function () { return null; });
  await page.click("button[data-action='descargar-html']");
  const dl = await dlP;
  let exportInfo = null;
  if (dl) {
    const fp = await dl.path();
    const html = fs.readFileSync(fp, "utf8");
    exportInfo = {
      name: dl.suggestedFilename(),
      charts: (html.match(/chart-svg/g) || []).length,
      tinyBars: (html.match(/width="4"/g) || []).length,
      slides: (html.match(/class="slide /g) || []).length,
      hasBlackForce: /color:#111|color:#000|color: rgb\(17,\s*17,\s*17\)/i.test(html) && /body\{[^}]*color:#111/i.test(html)
    };
    // open export in page
    const expPath = path.join(OUT, "export-audit.html");
    fs.writeFileSync(expPath, html);
  }

  // Check if styles.css print/global forces black text on dark UI
  const cssIssues = await page.evaluate(function () {
    const probs = [];
    // sample block titles on dark glass
    document.querySelectorAll(".block h3, .kpi .label, .grupo-title, .aviso").forEach(function (el, i) {
      if (i > 30) return;
      const cs = getComputedStyle(el);
      const color = cs.color;
      const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return;
      const L = (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255;
      if (L < 0.3) {
        probs.push({
          tag: el.tagName + "." + (el.className || ""),
          text: (el.textContent || "").trim().slice(0, 50),
          color: color
        });
      }
    });
    return probs;
  });
  cssIssues.forEach(function (p) {
    issues.push({ where: "dashboard-dark-text", sel: p.tag, text: p.text, color: p.color, bg: "dashboard", Lc: 0.1, Lb: 0.1 });
  });

  const report = {
    at: new Date().toISOString(),
    base: BASE,
    mercados: { bodyBg: mercados.bodyBg, selects: mercados.selects, bad: mercados.bad.length },
    informes: { bodyBg: informes.bodyBg, selects: informes.selects, bad: informes.bad.length },
    deck: deck,
    exportInfo: exportInfo,
    issues: issues
  };
  fs.writeFileSync(path.join(OUT, "contrast-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  await browser.close();
  if (kid) kid.kill();

  const critical = issues.filter(function (i) {
    return i.where !== "informes" || !/slide|chart-box|mid-block|text-box|gold|photo-credit|fuente/i.test(i.sel);
  });
  // slide internals on white bg with dark text are OK; filter those
  const real = issues.filter(function (i) {
    // mid-block es transparente: el oro vive en .text-box.gold hijo (falso positivo navy)
    if (/mid-block/i.test(i.sel)) return false;
    if (/text-box\.gold|\.gold/i.test(i.sel) && i.Lb > 0.55) return false;
    if (/slide|chart-box|text-box|kpi-|\.slide/i.test(i.sel)) {
      if (i.Lc < 0.35 && i.Lb > 0.7) return false;
      if (i.Lc > 0.75 && i.Lb > 0.7) return true; // blanco sobre blanco
      if (i.Lc < 0.35 && i.Lb < 0.45) return true;
      return false;
    }
    if (i.where === "dashboard-dark-text") return true;
    if (i.Lc < 0.35 && i.Lb < 0.45) return true;
    if (i.sel === "tiny-bars" || i.sel === "charts" || i.sel === "#pieza-export") return true;
    return false;
  });

  console.log("\nREAL_ISSUES", real.length);
  real.slice(0, 25).forEach(function (i) {
    console.log("-", i.where, i.sel, JSON.stringify(i.text), "color="+i.color, "bg="+i.bg);
  });

  if (real.length) process.exit(1);
  console.log("qa_contrast OK");
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
