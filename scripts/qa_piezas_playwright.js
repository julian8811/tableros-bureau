#!/usr/bin/env node
/**
 * QA piezas Informes: infografías A/B/C, boletines A/B, informe TEC + mocks.
 * Uso: node scripts/qa_piezas_playwright.js
 * Requiere servidores: tablero :8080, mocks :5173 (design-options).
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "design-options", "qa-piezas");
const TABLERO = process.env.QA_TABLERO || "http://127.0.0.1:8080";
const MOCKS = process.env.QA_MOCKS || "http://127.0.0.1:5173";

fs.mkdirSync(OUT, { recursive: true });

function waitPort(port, ms) {
  const deadline = Date.now() + (ms || 20000);
  return new Promise(function (resolve, reject) {
    function tick() {
      const req = http.get({ host: "127.0.0.1", port, path: "/", timeout: 1500 }, function (res) {
        res.resume();
        resolve();
      });
      req.on("error", function () {
        if (Date.now() > deadline) reject(new Error("timeout port " + port));
        else setTimeout(tick, 400);
      });
    }
    tick();
  });
}

function startStatic(cwd, port) {
  const child = spawn(
    process.execPath,
    ["-e",
      "const http=require('http'),fs=require('fs'),path=require('path');" +
      "const root=process.argv[1],port=+process.argv[2];" +
      "const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'," +
      "'.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2'};" +
      "http.createServer((req,res)=>{" +
      "let u=decodeURIComponent((req.url||'/').split('?')[0]);" +
      "if(u==='/')u='/index.html';" +
      "const f=path.join(root,u.replace(/^\\//,''));" +
      "if(!f.startsWith(root)){res.writeHead(403);return res.end();}" +
      "fs.readFile(f,(e,b)=>{" +
      "if(e){res.writeHead(404);return res.end('404 '+u);}" +
      "res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});res.end(b);" +
      "});}).listen(port,()=>console.log('static',port,root));",
      cwd,
      String(port)
    ],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }
  );
  return child;
}

async function assertPage(page, label, url, checks) {
  const result = { label, url, ok: true, fails: [] };
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (!resp || resp.status() >= 400) {
    result.ok = false;
    result.fails.push("HTTP " + (resp && resp.status()));
    return result;
  }
  await page.waitForTimeout(800);
  for (const c of checks) {
    try {
      if (c.type === "exists") {
        const n = await page.locator(c.sel).count();
        if (n < (c.min || 1)) {
          result.ok = false;
          result.fails.push("missing " + c.sel + " (got " + n + ")");
        }
      } else if (c.type === "text") {
        const t = await page.locator(c.sel).first().innerText({ timeout: 5000 });
        if (!c.re.test(t)) {
          result.ok = false;
          result.fails.push("text " + c.sel + " !~ " + c.re);
        }
      } else if (c.type === "btn") {
        const n = await page.locator("button:has-text('" + c.text + "'), a:has-text('" + c.text + "')").count();
        if (!n) {
          result.ok = false;
          result.fails.push("button/link missing: " + c.text);
        }
      }
    } catch (err) {
      result.ok = false;
      result.fails.push((c.sel || c.text || "?") + ": " + err.message);
    }
  }
  const shot = path.join(OUT, label.replace(/[^\w.-]+/g, "_") + ".png");
  await page.screenshot({ path: shot, fullPage: true }).catch(function () {});
  result.shot = shot;
  return result;
}

(async () => {
  const kids = [];
  let ownServers = false;
  try {
    await waitPort(8080, 1500);
  } catch (_) {
    ownServers = true;
    kids.push(startStatic(ROOT, 8080));
    kids.push(startStatic(path.join(ROOT, "design-options"), 5173));
    await waitPort(8080, 20000);
    await waitPort(5173, 20000);
  }
  try {
    await waitPort(5173, 2000);
  } catch (_) {
    if (!ownServers) {
      kids.push(startStatic(path.join(ROOT, "design-options"), 5173));
      ownServers = true;
      await waitPort(5173, 20000);
    }
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const results = [];

  const cases = [
    {
      label: "tablero-infografia-a",
      url: TABLERO + "/index.html?tab=informes&pieza=infografia&ivar=a&anio=2025",
      checks: [
        { type: "exists", sel: "#pieza-export" },
        { type: "exists", sel: ".kpi-hero, .hero-block" },
        { type: "btn", text: "HTML" },
        { type: "btn", text: "PDF" }
      ]
    },
    {
      label: "tablero-infografia-b",
      url: TABLERO + "/index.html?tab=informes&pieza=infografia&ivar=b&anio=2025",
      checks: [
        { type: "exists", sel: "#pieza-export" },
        { type: "exists", sel: ".rank li, .rank-bars li", min: 5 },
        { type: "exists", sel: ".stack-svg" },
        { type: "btn", text: "HTML" },
        { type: "btn", text: "PDF" }
      ]
    },
    {
      label: "tablero-infografia-c",
      url: TABLERO + "/index.html?tab=informes&pieza=infografia&ivar=c&anio=2025",
      checks: [
        { type: "exists", sel: "#pieza-export" },
        { type: "exists", sel: ".stage.story" },
        { type: "exists", sel: ".insight" },
        { type: "btn", text: "HTML" },
        { type: "btn", text: "PDF" }
      ]
    },
    {
      label: "tablero-boletin-email",
      url: TABLERO + "/index.html?tab=informes&pieza=boletin&anio=2025",
      checks: [
        { type: "exists", sel: "#pieza-export" },
        { type: "exists", sel: ".stage.email" },
        { type: "exists", sel: ".email-split" },
        { type: "exists", sel: ".rank li", min: 1 },
        { type: "btn", text: "HTML" },
        { type: "btn", text: "PDF" }
      ]
    },
    {
      label: "tablero-informe",
      url: TABLERO + "/index.html?tab=informes&pieza=informe&anio=2025",
      checks: [
        { type: "exists", sel: ".tec-doc, #pieza-export" },
        { type: "btn", text: "HTML" },
        { type: "btn", text: "PDF" },
        { type: "btn", text: "JSON" }
      ]
    },
    {
      label: "mock-infografia-index",
      url: MOCKS + "/infografia-index.html",
      checks: [{ type: "exists", sel: "a[href*='infografia']", min: 1 }]
    },
    {
      label: "mock-infografia-a",
      url: MOCKS + "/infografia-a-hero-kpi.html",
      checks: [
        { type: "exists", sel: "#pieza-export" },
        { type: "btn", text: "Descargar HTML" },
        { type: "btn", text: "Descargar PDF" }
      ]
    },
    {
      label: "mock-infografia-b",
      url: MOCKS + "/infografia-b-ranking.html",
      checks: [{ type: "exists", sel: "#pieza-export" }]
    },
    {
      label: "mock-infografia-c",
      url: MOCKS + "/infografia-c-story.html",
      checks: [
        { type: "exists", sel: "#pieza-export" },
        { type: "exists", sel: ".stage.story, .insight" },
        { type: "btn", text: "Descargar HTML" }
      ]
    },
    {
      label: "mock-boletin-index",
      url: MOCKS + "/boletin-index.html",
      checks: [{ type: "exists", sel: "a[href*='boletin']", min: 1 }]
    },
    {
      label: "mock-boletin-email",
      url: MOCKS + "/boletin-a-email.html",
      checks: [
        { type: "exists", sel: "#pieza-export" },
        { type: "exists", sel: ".stage.email" },
        { type: "exists", sel: ".email-split" },
        { type: "btn", text: "Descargar HTML" }
      ]
    }
  ];

  for (const c of cases) {
    const r = await assertPage(page, c.label, c.url, c.checks);
    results.push(r);
    console.log((r.ok ? "OK  " : "FAIL") + " " + c.label + (r.fails.length ? " · " + r.fails.join("; ") : ""));
  }

  await browser.close();
  kids.forEach(function (k) {
    try { k.kill(); } catch (_) {}
  });

  const report = {
    at: new Date().toISOString(),
    tablero: TABLERO,
    mocks: MOCKS,
    results: results
  };
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  const failed = results.filter(function (r) { return !r.ok; });
  if (failed.length) {
    console.error("\n" + failed.length + " fallos. Ver " + path.join(OUT, "report.json"));
    process.exit(1);
  }
  console.log("\nqa_piezas OK · " + results.length + " casos · " + OUT);
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
