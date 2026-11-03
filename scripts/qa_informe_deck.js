#!/usr/bin/env node
/** Paridad informe vivo vs mock: slides, fotos Commons, charts SVG. */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PORT = 8093;

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

(async () => {
  const kid = startStatic(PORT, ROOT);
  await waitPort(PORT, 15000);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1400, height: 900 } });
  await page.goto("http://127.0.0.1:" + PORT + "/index.html?tab=informes&pieza=informe&anio=2025", {
    waitUntil: "networkidle",
    timeout: 90000
  });
  await page.waitForTimeout(1500);
  const live = await page.evaluate(function () {
    const slides = document.querySelectorAll("#pieza-export .slide");
    const photos = document.querySelectorAll("#pieza-export .photo-img");
    const charts = document.querySelectorAll("#pieza-export .chart-svg");
    const cover = document.querySelector("#pieza-export .slide.cover");
    const divider = document.querySelectorAll("#pieza-export .slide.divider");
    const insight = document.querySelectorAll("#pieza-export .slide.insight");
    const chartPage = document.querySelectorAll("#pieza-export .slide.chart-page");
    const kpi = document.querySelectorAll("#pieza-export .slide.kpi-photo");
    const tables = document.querySelectorAll("#pieza-export .slide.table-page");
    const resumen = Array.prototype.some.call(slides, function (s) {
      return /Resumen/i.test((s.querySelector(".slide-label") || {}).textContent || "") ||
        /Resumen ejecutivo/i.test(s.textContent || "");
    });
    const rects = document.querySelectorAll("#pieza-export .chart-svg rect");
    let fatBars = 0;
    rects.forEach(function (r) {
      const w = Number(r.getAttribute("width") || 0);
      const h = Number(r.getAttribute("height") || 0);
      if (w >= 12 || h >= 8) fatBars += 1;
    });
    const loaded = Array.prototype.slice.call(photos).filter(function (img) {
      return img.complete && img.naturalWidth > 40;
    }).length;
    const commons = Array.prototype.slice.call(photos).filter(function (img) {
      return /colombia-photos/.test(img.getAttribute("src") || "");
    }).length;
    return {
      slides: slides.length,
      photos: photos.length,
      loaded: loaded,
      commons: commons,
      charts: charts.length,
      cover: !!cover,
      dividers: divider.length,
      insights: insight.length,
      chartPages: chartPage.length,
      kpi: kpi.length,
      tables: tables.length,
      resumen: resumen,
      fatBars: fatBars,
      hasDeck: !!document.querySelector(".tec-deck, .deck#pieza-export, #pieza-export.deck")
    };
  });
  console.log("live", JSON.stringify(live, null, 2));
  fs.mkdirSync(path.join(ROOT, "design-options", "qa-piezas"), { recursive: true });
  await page.locator("#pieza-export .slide.chart-page").first().screenshot({
    path: path.join(ROOT, "design-options", "qa-piezas", "informe-deck-chart.png")
  }).catch(function () {});
  await page.screenshot({
    path: path.join(ROOT, "design-options", "qa-piezas", "informe-deck-live.png"),
    fullPage: false
  });

  const dlP = page.waitForEvent("download", { timeout: 20000 });
  await page.click("button[data-action='descargar-html']");
  const dl = await dlP;
  const html = fs.readFileSync(await dl.path(), "utf8");
  const exp = {
    name: dl.suggestedFilename(),
    slides: (html.match(/class="slide /g) || []).length,
    photos: (html.match(/colombia-photos/g) || []).length,
    charts: (html.match(/chart-svg/g) || []).length,
    kpi: (html.match(/kpi-photo/g) || []).length,
    tables: (html.match(/table-page/g) || []).length,
    resumen: /Resumen ejecutivo/i.test(html),
    hasDeckCss: /aspect-ratio:\s*16\/9/.test(html) || /--slide-w/.test(html),
    unsplash: (html.match(/unsplash/g) || []).length,
    tinyBars: (html.match(/width="4"/g) || []).length
  };
  console.log("export", JSON.stringify(exp, null, 2));

  await browser.close();
  kid.kill();

  const ok =
    live.slides >= 20 &&
    live.cover &&
    live.charts >= 8 &&
    live.fatBars >= 12 &&
    live.commons >= 8 &&
    live.loaded >= 5 &&
    live.resumen &&
    exp.charts >= 8 &&
    exp.hasDeckCss &&
    exp.unsplash === 0 &&
    exp.tinyBars === 0;
  if (!ok) {
    console.error("FAIL parity", { live: live, exp: exp });
    process.exit(1);
  }
  console.log("qa_informe_deck OK");
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
