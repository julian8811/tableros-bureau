#!/usr/bin/env node
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PORT = 8092;

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
      const req = http.get({ host: "127.0.0.1", port: port, path: "/", timeout: 1500 }, function (res) {
        res.resume();
        resolve();
      });
      req.on("error", function () {
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
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto("http://127.0.0.1:" + PORT + "/index.html?tab=informes&pieza=informe&anio=2025", {
    waitUntil: "networkidle",
    timeout: 90000
  });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(function () {
    const photos = Array.prototype.slice.call(document.querySelectorAll(".tec-photo .photo-img")).map(function (i) {
      return { src: i.getAttribute("src"), ok: i.complete && i.naturalWidth > 20 };
    });
    const hero = document.querySelector(".tec-hero");
    return {
      photos: photos.length,
      photoSrcs: photos.slice(0, 6),
      heroBg: hero ? hero.getAttribute("style") : "",
      colombia: photos.filter(function (p) { return /colombia-photos/.test(p.src); }).length,
      unsplash: photos.filter(function (p) { return /unsplash/.test(p.src); }).length,
      loaded: photos.filter(function (p) { return p.ok; }).length
    };
  });
  console.log("live", JSON.stringify(info, null, 2));
  const downloadPromise = page.waitForEvent("download", { timeout: 20000 });
  await page.click("button[data-action='descargar-html']");
  const dl = await downloadPromise;
  const fp = await dl.path();
  const html = fs.readFileSync(fp, "utf8");
  console.log("export name", dl.suggestedFilename());
  console.log("export colombia-photos", (html.match(/colombia-photos/g) || []).length);
  console.log("export unsplash", (html.match(/unsplash/g) || []).length);
  console.log("export photo-img", (html.match(/photo-img/g) || []).length);
  console.log("export cover commons", /colombia-photos\/cover\.jpg/.test(html));
  await browser.close();
  kid.kill();
  if (info.colombia < 5 || info.unsplash > 0 || !/colombia-photos\/cover\.jpg/.test(html)) {
    process.exit(1);
  }
  console.log("qa_informe_fotos OK");
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
