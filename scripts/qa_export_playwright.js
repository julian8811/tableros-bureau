#!/usr/bin/env node
/**
 * Verifica descargas HTML y buildExportDoc (título TEC/pieza, no tablero).
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const PORT = 8091;

function startStatic(port, cwd) {
  const child = spawn(
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
        "res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});res.end(b);" +
        "});}).listen(port);",
      cwd,
      String(port)
    ],
    { stdio: "ignore" }
  );
  return child;
}

function waitPort(port, ms) {
  const deadline = Date.now() + ms;
  return new Promise(function (resolve, reject) {
    (function tick() {
      const req = http.get({ host: "127.0.0.1", port, path: "/", timeout: 1500 }, function (res) {
        res.resume();
        resolve();
      });
      req.on("error", function () {
        if (Date.now() > deadline) reject(new Error("port timeout"));
        else setTimeout(tick, 300);
      });
    })();
  });
}

(async () => {
  const kid = startStatic(PORT, ROOT);
  await waitPort(PORT, 15000);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ acceptDownloads: true });
  const cases = [
    ["infografia_a", "?tab=informes&pieza=infografia&ivar=a&anio=2025", ".kpi-hero", 1],
    ["infografia_b", "?tab=informes&pieza=infografia&ivar=b&anio=2025", ".rank li", 5],
    ["infografia_c", "?tab=informes&pieza=infografia&ivar=c&anio=2025", ".insight", 1],
    ["boletin_a", "?tab=informes&pieza=boletin&anio=2025", ".rank li", 5],
    ["informe", "?tab=informes&pieza=informe&anio=2025", "#pieza-export .slide, .tec-doc", 10]
  ];
  const out = [];
  for (const [name, q, sel, min] of cases) {
    await page.goto("http://127.0.0.1:" + PORT + "/index.html" + q, {
      waitUntil: "networkidle",
      timeout: 90000
    });
    await page.waitForTimeout(1000);
    const n = await page.locator(sel).count();
    const hasExport = (await page.locator("#pieza-export").count()) > 0;
    const downloadPromise = page.waitForEvent("download", { timeout: 20000 }).catch(function () {
      return null;
    });
    await page.click("button[data-action='descargar-html']");
    const download = await downloadPromise;
    const row = { name: name, contentCount: n, contentOk: n >= min, hasExport: hasExport };
    if (!download) {
      row.htmlFail = true;
    } else {
      row.htmlName = download.suggestedFilename();
      const fp = await download.path();
      const txt = fs.readFileSync(fp, "utf8");
      row.htmlOk = txt.length > 800;
      row.htmlHasTitle = /Infografia_|Boletin_|Informe_TEC/.test(txt);
      row.badDashTitle = /<title>Tableros estad/.test(txt);
      row.hasPiezaMarkup = /pieza-export|tec-portada|stage /.test(txt);
    }
    row.pdfMeta = await page.evaluate(async function (kind) {
      if (!window.Piezas || !Piezas.buildExportDoc) return { err: "no api" };
      const doc = await Piezas.buildExportDoc(kind, 2025);
      const m = /<title>([^<]+)<\/title>/.exec(doc.html);
      return {
        baseName: doc.baseName,
        len: doc.html.length,
        title: m && m[1],
        hasTableroTitle: /Tableros estadísticos \|/.test(doc.html),
        hasPieza: /pieza-export|tec-doc|tec-portada/.test(doc.html)
      };
    }, name);
    out.push(row);
    console.log(
      (row.contentOk && row.hasExport && row.htmlOk && !row.badDashTitle && row.pdfMeta && !row.pdfMeta.hasTableroTitle
        ? "OK  "
        : "FAIL") +
        " " +
        name +
        " · html=" +
        (row.htmlName || "—") +
        " · pdfTitle=" +
        ((row.pdfMeta && row.pdfMeta.title) || "—")
    );
  }
  await browser.close();
  kid.kill();
  const fails = out.filter(function (r) {
    return (
      r.htmlFail ||
      !r.htmlOk ||
      !r.contentOk ||
      !r.hasExport ||
      r.badDashTitle ||
      (r.pdfMeta && (r.pdfMeta.hasTableroTitle || r.pdfMeta.err))
    );
  });
  fs.mkdirSync(path.join(ROOT, "design-options", "qa-piezas"), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, "design-options", "qa-piezas", "export-report.json"),
    JSON.stringify(out, null, 2)
  );
  if (fails.length) {
    console.error("\n" + fails.length + " fallos");
    process.exit(1);
  }
  console.log("\nqa_export OK · " + out.length);
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
