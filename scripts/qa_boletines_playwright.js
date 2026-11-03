#!/usr/bin/env node
/** QA boletín email (única variante) con datos vivos del dashboard. */
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
  const id = "boletin_email";

  await page.goto("http://127.0.0.1:" + PORT + "/index.html?tab=informes&pieza=boletin&anio=2025", {
    waitUntil: "networkidle",
    timeout: 90000
  });
  await page.waitForTimeout(1500);

  const audit = await page.evaluate(function () {
    const root = document.querySelector("#pieza-export");
    const inner = root && root.querySelector(".stage-inner");
    const text = root ? root.innerText : "";
    const hasA4Nav = !!document.querySelector("[data-bvar='b']");
    return {
      hasExport: !!root,
      isEmail: !!(root && root.classList.contains("email")),
      hasA4Nav: hasA4Nav,
      rank: document.querySelectorAll("#pieza-export .rank li").length,
      kpi: document.querySelectorAll("#pieza-export .kpi").length,
      hasSplit: !!document.querySelector("#pieza-export .email-split"),
      hasPulso: /Pulso|EMA|ICCA|EVI|Pasajeros/i.test(text),
      hasReceptivo: /Receptivo|MinCIT/i.test(text),
      hasMedellin: /Medell/i.test(text),
      hasFuente: /Fuente/i.test(text),
      hasNumber: /\d[\d.]{2,}/.test(text),
      endsWithFuente: /Colmayor|Bureau|V7|conectividad/i.test(text.slice(-280)),
      clip: root && inner
        ? {
            stageH: Math.round(root.getBoundingClientRect().height),
            innerH: Math.round(inner.scrollHeight),
            clipped: inner.scrollHeight > root.clientHeight + 4
          }
        : null,
      sample: text.slice(0, 220)
    };
  });

  await page.locator("#pieza-export").screenshot({
    path: path.join(OUT, id + "-live.png")
  }).catch(function () {});

  const dlP = page.waitForEvent("download", { timeout: 20000 }).catch(function () { return null; });
  await page.click("button[data-action='descargar-html']");
  const dl = await dlP;
  let htmlOk = false;
  let htmlName = null;
  let exportClip = null;
  let exportPdfOk = false;
  if (dl) {
    htmlName = dl.suggestedFilename();
    const html = fs.readFileSync(await dl.path(), "utf8");
    htmlOk =
      html.length > 1200 &&
      /pieza-export/.test(html) &&
      /boletin-email|stage email/.test(html) &&
      !/boletin-b|stage a4/.test(html) &&
      !/fill="url\(https?:/.test(html);
    const exportPath = path.join(OUT, id + "-export.html");
    fs.writeFileSync(exportPath, html);

    const exp = await browser.newPage({ viewport: { width: 900, height: 1400 } });
    await exp.goto("file://" + exportPath.replace(/\\/g, "/"), { waitUntil: "load", timeout: 30000 });
    await exp.waitForTimeout(400);
    exportClip = await exp.evaluate(function () {
      const root = document.querySelector("#pieza-export");
      const inner = root && root.querySelector(".stage-inner");
      if (!root || !inner) return { clipped: true };
      return {
        stageH: Math.round(root.getBoundingClientRect().height),
        innerH: Math.round(inner.scrollHeight),
        clipped: inner.scrollHeight > root.clientHeight + 4,
        hasSplit: !!root.querySelector(".email-split"),
        endsOk: /Colmayor|Bureau|V7|conectividad/i.test(root.innerText.slice(-280))
      };
    });
    await exp.locator("#pieza-export").screenshot({
      path: path.join(OUT, id + "-export.png")
    }).catch(function () {});
    await exp.pdf({
      path: path.join(OUT, id + "-export.pdf"),
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" }
    }).catch(function () {});
    exportPdfOk = fs.existsSync(path.join(OUT, id + "-export.pdf"));
    await exp.close();
  }

  const row = { id: id, audit: audit, htmlOk: htmlOk, htmlName: htmlName, exportClip: exportClip, exportPdfOk: exportPdfOk };
  report.cases.push(row);

  if (!audit.hasExport) fails.push(id + ": sin #pieza-export");
  if (!audit.isEmail) fails.push(id + ": no es stage.email");
  if (audit.hasA4Nav) fails.push(id + ": sigue el selector B · A4");
  if (audit.rank < 5) fails.push(id + ": rank=" + audit.rank);
  if (audit.kpi < 4) fails.push(id + ": kpi=" + audit.kpi);
  if (!audit.hasSplit) fails.push(id + ": sin email-split");
  if (!audit.hasPulso) fails.push(id + ": sin pulso");
  if (!audit.hasReceptivo) fails.push(id + ": sin receptivo MinCIT");
  if (!audit.hasMedellin || !audit.hasNumber) fails.push(id + ": datos débiles");
  if (!audit.endsWithFuente) fails.push(id + ": pie/fuentes no visibles");
  if (audit.clip && audit.clip.clipped) fails.push(id + ": live clipped");
  if (!htmlOk) fails.push(id + ": HTML export falló");
  if (exportClip && exportClip.clipped) fails.push(id + ": export clipped");
  if (exportClip && !exportClip.endsOk) fails.push(id + ": export sin pie");
  if (!exportPdfOk) fails.push(id + ": PDF export falló");

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
