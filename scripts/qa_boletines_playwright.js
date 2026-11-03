#!/usr/bin/env node
/** QA boletines A/B con datos vivos del dashboard. */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PORT = 8110;
const OUT = path.join(ROOT, "design-options", "qa-piezas");

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

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const kid = startStatic(PORT, ROOT);
  await waitPort(PORT, 15000);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  const report = { at: new Date().toISOString(), cases: [] };
  const fails = [];

  for (const [id, q, needs] of [
    ["boletin_a", "?tab=informes&pieza=boletin&bvar=a&anio=2025", { rank: 5, kpi: 2, pulso: true }],
    ["boletin_b", "?tab=informes&pieza=boletin&bvar=b&anio=2025", { secs: 3, kpi: 3, pulso: true }]
  ]) {
    await page.goto("http://127.0.0.1:" + PORT + "/index.html" + q, {
      waitUntil: "networkidle",
      timeout: 90000
    });
    await page.waitForTimeout(1500);
    const audit = await page.evaluate(function (needs) {
      const root = document.querySelector("#pieza-export");
      const text = root ? root.innerText : "";
      return {
        hasExport: !!root,
        rank: document.querySelectorAll("#pieza-export .rank li").length,
        kpi: document.querySelectorAll("#pieza-export .kpi").length,
        secs: document.querySelectorAll("#pieza-export .sec").length,
        hasPulso: /Pulso|EMA|ICCA|EVI|Pasajeros|Ocupaci/i.test(text),
        hasMedellin: /Medell/i.test(text),
        hasFuente: /Fuente/i.test(text),
        hasNumber: /\d[\d.]{2,}/.test(text),
        sample: text.slice(0, 220)
      };
    }, needs);

    await page.locator("#pieza-export").screenshot({
      path: path.join(OUT, id + "-live.png")
    }).catch(function () {});

    const dlP = page.waitForEvent("download", { timeout: 20000 }).catch(function () { return null; });
    await page.click("button[data-action='descargar-html']");
    const dl = await dlP;
    let htmlOk = false;
    let htmlName = null;
    if (dl) {
      htmlName = dl.suggestedFilename();
      const html = fs.readFileSync(await dl.path(), "utf8");
      htmlOk = html.length > 1200 && /pieza-export/.test(html) && !/fill="url\(https?:/.test(html);
      fs.writeFileSync(path.join(OUT, id + "-export.html"), html);
    }

    const row = { id: id, audit: audit, htmlOk: htmlOk, htmlName: htmlName };
    report.cases.push(row);

    if (!audit.hasExport) fails.push(id + ": sin #pieza-export");
    if (needs.rank && audit.rank < needs.rank) fails.push(id + ": rank=" + audit.rank);
    if (needs.secs && audit.secs < needs.secs) fails.push(id + ": secs=" + audit.secs);
    if (needs.kpi && audit.kpi < needs.kpi) fails.push(id + ": kpi=" + audit.kpi);
    if (needs.pulso && !audit.hasPulso) fails.push(id + ": sin pulso dashboard");
    if (!audit.hasMedellin || !audit.hasNumber) fails.push(id + ": datos débiles");
    if (!htmlOk) fails.push(id + ": HTML export falló");
  }

  fs.writeFileSync(path.join(OUT, "boletines-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ fails: fails, cases: report.cases }, null, 2));
  await browser.close();
  kid.kill();
  if (fails.length) {
    console.error("qa_boletines FAIL", fails.length);
    process.exit(1);
  }
  console.log("qa_boletines OK");
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
