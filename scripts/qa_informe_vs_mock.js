#!/usr/bin/env node
/**
 * Contrasta mock informe-tec-referencia vs export HTML vivo (estructura + layout).
 * Uso: node scripts/qa_informe_vs_mock.js
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PORT = 8105;
const OUT = path.join(ROOT, "design-options", "qa-piezas");
const MOCK = "/design-options/informe-tec-referencia.html";

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
        "if(e){res.writeHead(404);return res.end('404');}" +
        "res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});res.end(b);" +
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
        else setTimeout(tick, 200);
      });
    })();
  });
}

async function auditDeck(page, rootSel) {
  return page.evaluate(function (rootSel) {
    const root = document.querySelector(rootSel) || document.querySelector(".deck");
    if (!root) return { error: "no deck", rootSel: rootSel };
    const slides = Array.prototype.slice.call(root.querySelectorAll(".slide"));
    function box(el) {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        ratio: r.width > 0 ? +(r.width / r.height).toFixed(3) : 0,
        display: cs.display,
        bg: cs.backgroundColor
      };
    }
    function slideInfo(s, i) {
      const label = ((s.querySelector(".slide-label") || {}).textContent || "").trim();
      const kinds = ["cover", "toc", "divider", "insight", "chart-page", "kpi-photo", "table-page"]
        .filter(function (k) { return s.classList.contains(k); });
      const chart = s.querySelector(".chart-svg, .chart-box svg");
      const chartBox = s.querySelector(".chart-box");
      const body = s.querySelector(".chart-body, .insight .copy, .split, .stack");
      const photo = s.querySelector(".photo-img, .photo-frame");
      const h2 = s.querySelector("h2, .text-box.gold, .cover h1");
      const rects = chart ? Array.prototype.slice.call(chart.querySelectorAll("rect")) : [];
      const fat = rects.filter(function (r) {
        return Number(r.getAttribute("width") || 0) >= 12 || Number(r.getAttribute("height") || 0) >= 8;
      }).length;
      const tiny = rects.filter(function (r) {
        const w = Number(r.getAttribute("width") || 0);
        const h = Number(r.getAttribute("height") || 0);
        return (w > 0 && w < 8) || (h > 0 && h < 6);
      }).length;
      const br = s.getBoundingClientRect();
      return {
        i: i,
        kinds: kinds,
        label: label.slice(0, 40),
        title: ((h2 && h2.textContent) || "").trim().slice(0, 60),
        slide: box(s),
        aspectOk: br.width > 0 && Math.abs(br.width / br.height - 16 / 9) < 0.12,
        hasChart: !!chart,
        hasChartBox: !!chartBox,
        hasPhoto: !!photo,
        hasBody: !!body,
        chartBox: box(chartBox),
        chartSvg: box(chart),
        fatBars: fat,
        tinyBars: tiny,
        emptyChart: !!chart && fat === 0 && rects.length > 0
      };
    }
    const byKind = {};
    slides.forEach(function (s) {
      ["cover", "toc", "divider", "insight", "chart-page", "kpi-photo", "table-page"].forEach(function (k) {
        if (s.classList.contains(k)) byKind[k] = (byKind[k] || 0) + 1;
      });
    });
    const sampleIdx = [];
    function firstOf(k) {
      const i = slides.findIndex(function (s) { return s.classList.contains(k); });
      if (i >= 0) sampleIdx.push(i);
    }
    firstOf("cover");
    firstOf("toc");
    firstOf("divider");
    firstOf("insight");
    firstOf("chart-page");
    firstOf("kpi-photo");
    firstOf("table-page");
    // second chart if any
    const charts = slides.map(function (s, i) { return s.classList.contains("chart-page") ? i : -1; }).filter(function (i) { return i >= 0; });
    if (charts[1] != null) sampleIdx.push(charts[1]);

    return {
      slides: slides.length,
      byKind: byKind,
      photos: root.querySelectorAll(".photo-img").length,
      charts: root.querySelectorAll(".chart-svg, .chart-box svg").length,
      goldBoxes: root.querySelectorAll(".text-box.gold").length,
      logos: root.querySelectorAll(".logo-bureau, .logo-colmayor").length,
      samples: sampleIdx.map(function (i) { return slideInfo(slides[i], i); }),
      badAspect: slides.filter(function (s) {
        const r = s.getBoundingClientRect();
        return r.width > 40 && Math.abs(r.width / r.height - 16 / 9) > 0.15;
      }).length,
      emptyCharts: slides.filter(function (s) {
        if (!s.classList.contains("chart-page")) return false;
        const chart = s.querySelector(".chart-svg");
        if (!chart) return true;
        const rects = chart.querySelectorAll("rect");
        let fat = 0;
        rects.forEach(function (r) {
          if (Number(r.getAttribute("width") || 0) >= 12 || Number(r.getAttribute("height") || 0) >= 8) fat++;
        });
        return fat === 0;
      }).length
    };
  }, rootSel);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const kid = startStatic(PORT, ROOT);
  await waitPort(PORT, 15000);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 },
    acceptDownloads: true
  });

  // --- MOCK ---
  await page.goto("http://127.0.0.1:" + PORT + MOCK, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(800);
  const mock = await auditDeck(page, ".deck");
  const mockSlides = page.locator(".deck .slide");
  const mockN = await mockSlides.count();
  for (const kind of ["cover", "toc", "divider", "insight", "chart-page", "kpi-photo", "table-page"]) {
    const loc = page.locator(".deck .slide." + kind).first();
    if (await loc.count()) {
      await loc.scrollIntoViewIfNeeded();
      await loc.screenshot({ path: path.join(OUT, "mock-" + kind + ".png") });
    }
  }

  // --- LIVE + EXPORT ---
  await page.goto("http://127.0.0.1:" + PORT + "/index.html?tab=informes&pieza=informe&anio=2025", {
    waitUntil: "networkidle",
    timeout: 90000
  });
  await page.waitForTimeout(1800);
  const live = await auditDeck(page, "#pieza-export");

  const dlP = page.waitForEvent("download", { timeout: 25000 }).catch(function () { return null; });
  await page.click("button[data-action='descargar-html']");
  const dl = await dlP;
  let exportHtml = null;
  let expPath = null;
  if (dl) {
    exportHtml = fs.readFileSync(await dl.path(), "utf8");
    expPath = path.join(OUT, "export-vs-mock.html");
    fs.writeFileSync(expPath, exportHtml);
  }

  let exported = null;
  if (expPath) {
    await page.goto("file://" + expPath.replace(/\\/g, "/"), { waitUntil: "networkidle", timeout: 60000 }).catch(async function () {
      // file:// may fail assets; serve via static
      await page.goto("http://127.0.0.1:" + PORT + "/design-options/qa-piezas/export-vs-mock.html", {
        waitUntil: "networkidle",
        timeout: 60000
      });
    });
    await page.waitForTimeout(1000);
    exported = await auditDeck(page, ".deck, #pieza-export, body");
    for (const kind of ["cover", "toc", "divider", "insight", "chart-page", "kpi-photo", "table-page"]) {
      const loc = page.locator(".slide." + kind).first();
      if (await loc.count()) {
        await loc.scrollIntoViewIfNeeded();
        await loc.screenshot({ path: path.join(OUT, "export-" + kind + ".png") });
      }
    }
  }

  // structural diff
  const gaps = [];
  function cmpKind(k) {
    const m = (mock.byKind && mock.byKind[k]) || 0;
    const e = (exported && exported.byKind && exported.byKind[k]) || (live.byKind && live.byKind[k]) || 0;
    if (m > 0 && e === 0) gaps.push({ kind: "missing-kind", key: k, mock: m, export: e });
    if (m > 0 && e > 0 && e < Math.floor(m * 0.5)) gaps.push({ kind: "few-kind", key: k, mock: m, export: e });
  }
  ["cover", "toc", "divider", "insight", "chart-page", "kpi-photo", "table-page"].forEach(cmpKind);

  if (mock.slides && exported && exported.slides) {
    /* Mock ~27 (cover+toc+resumen+divider+chart×N). Export no debe inflarse a 2× con KPI/tablas. */
    if (exported.slides < Math.floor(mock.slides * 0.55)) {
      gaps.push({ kind: "few-slides", mock: mock.slides, export: exported.slides });
    }
    if (exported.slides > mock.slides * 1.65) {
      gaps.push({ kind: "too-many-slides", mock: mock.slides, export: exported.slides });
    }
  }
  if (exported && exported.emptyCharts > 0) gaps.push({ kind: "empty-charts", n: exported.emptyCharts });
  if (exported && exported.badAspect > 2) gaps.push({ kind: "bad-aspect", n: exported.badAspect });
  if (exportHtml && /fill="url\(https?:/.test(exportHtml)) {
    htmlGaps.push("fill url(#grad) absolutizado — barras rotas");
  }

  // layout: chart-page should have chart-body grid with two columns roughly
  const layoutGaps = [];
  const mockChart = (mock.samples || []).find(function (s) { return s.kinds.indexOf("chart-page") >= 0; });
  const expChart = ((exported && exported.samples) || live.samples || []).find(function (s) {
    return s.kinds.indexOf("chart-page") >= 0;
  });
  if (mockChart && expChart) {
    if (mockChart.hasChart && !expChart.hasChart) layoutGaps.push("export chart-page sin SVG");
    if (mockChart.chartBox && expChart.chartBox && expChart.chartBox.h < mockChart.chartBox.h * 0.45) {
      layoutGaps.push("chart-box mucho más bajo que mock (" + expChart.chartBox.h + " vs " + mockChart.chartBox.h + ")");
    }
    if (expChart.tinyBars > 3) layoutGaps.push("barras tiny=" + expChart.tinyBars);
    if (expChart.emptyChart) layoutGaps.push("chart vacío (sin barras fat)");
  }
  const mockDiv = (mock.samples || []).find(function (s) { return s.kinds.indexOf("divider") >= 0; });
  const expDiv = ((exported && exported.samples) || []).find(function (s) { return s.kinds.indexOf("divider") >= 0; });
  if (mockDiv && expDiv && !/gold|TENDENCIAS|RECEPTIVO|DIVISOR/i.test(expDiv.title + expDiv.label) && !(exported.goldBoxes > 0)) {
    layoutGaps.push("divider sin caja gold");
  }

  // HTML markup checks on export string
  const htmlGaps = [];
  if (exportHtml) {
    if (!/informe-tec-deck\.css|tec-navy|--tec-gold/.test(exportHtml)) htmlGaps.push("export sin CSS deck TEC");
    if (!/class="deck/.test(exportHtml) && !/class='deck/.test(exportHtml)) htmlGaps.push("export sin .deck");
    if ((exportHtml.match(/chart-svg/g) || []).length < 5) htmlGaps.push("pocos chart-svg en HTML");
    if (/width="4"/g.test(exportHtml) && (exportHtml.match(/width="4"/g) || []).length > 3) {
      htmlGaps.push("barras width=4 en HTML");
    }
    if (!/text-box gold/.test(exportHtml)) htmlGaps.push("sin text-box gold");
    if (!/slide-label/.test(exportHtml)) htmlGaps.push("sin slide-label");
    // mock has cover-stage / photo-frame patterns
    if (!/photo-frame|photo-img|cover-stage/.test(exportHtml)) htmlGaps.push("sin foto/cover-stage");
  } else {
    htmlGaps.push("no se descargó HTML");
  }

  const report = {
    at: new Date().toISOString(),
    mockSlides: mockN,
    mock: mock,
    live: live,
    exported: exported,
    gaps: gaps,
    layoutGaps: layoutGaps,
    htmlGaps: htmlGaps,
    exportName: dl && dl.suggestedFilename()
  };
  fs.writeFileSync(path.join(OUT, "informe-vs-mock-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    mock: { slides: mock.slides, byKind: mock.byKind, charts: mock.charts, photos: mock.photos },
    live: { slides: live.slides, byKind: live.byKind, charts: live.charts, photos: live.photos, emptyCharts: live.emptyCharts },
    exported: exported && {
      slides: exported.slides,
      byKind: exported.byKind,
      charts: exported.charts,
      photos: exported.photos,
      emptyCharts: exported.emptyCharts,
      badAspect: exported.badAspect,
      goldBoxes: exported.goldBoxes
    },
    gaps: gaps,
    layoutGaps: layoutGaps,
    htmlGaps: htmlGaps,
    samplesMock: mock.samples,
    samplesExport: exported && exported.samples
  }, null, 2));

  await browser.close();
  kid.kill();

  const fail = gaps.length + layoutGaps.length + htmlGaps.length;
  if (fail) {
    console.error("\nPARITY_FAIL", fail);
    process.exit(1);
  }
  console.log("\nqa_informe_vs_mock OK");
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
