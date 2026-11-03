#!/usr/bin/env node
/** Mide colores reales de filtros/ranking/tablas en Mercados. */
const { chromium } = require("playwright");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PORT = 8097;

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

function lum(c) {
  const m = String(c || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return (0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3]) / 255;
}

(async () => {
  const kid = startStatic(PORT, ROOT);
  await waitPort(PORT, 15000);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://127.0.0.1:" + PORT + "/index.html?tab=mercados&anio=2025", {
    waitUntil: "networkidle",
    timeout: 90000
  });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(function () {
    function sample(sel, n) {
      return Array.prototype.slice.call(document.querySelectorAll(sel), 0, n || 8).map(function (el) {
        const cs = getComputedStyle(el);
        return {
          sel: sel,
          tag: el.tagName,
          cls: String(el.className || "").slice(0, 60),
          text: String(el.textContent || "").trim().slice(0, 55),
          color: cs.color,
          bg: cs.backgroundColor
        };
      });
    }
    return {
      filter: sample(".filter"),
      filterSelect: sample(".filter select"),
      lista: sample(".lista li"),
      listaSpan: sample(".lista li span, .lista li b, .lista li strong"),
      tableTd: sample(".table td"),
      blockH3: sample(".block h3"),
      mapaRank: sample(".mapa-rank-table td, .mapa-rank-table th, .mapa-emisores-rank h4")
    };
  });
  const dark = [];
  function check(arr) {
    (arr || []).forEach(function (row) {
      const L = lum(row.color);
      if (L != null && L < 0.35) dark.push(row);
    });
  }
  check(info.filter);
  check(info.filterSelect);
  check(info.lista);
  check(info.listaSpan);
  check(info.tableTd);
  check(info.blockH3);
  check(info.mapaRank);
  console.log(JSON.stringify({ dark: dark, info: info }, null, 2));
  await page.screenshot({
    path: path.join(ROOT, "design-options", "qa-piezas", "qa-mercados-rank.png"),
    clip: { x: 720, y: 300, width: 680, height: 400 }
  });
  await browser.close();
  kid.kill();
  if (dark.length) {
    console.error("DARK_TEXT", dark.length);
    process.exit(1);
  }
  console.log("qa_dash_colors OK");
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
