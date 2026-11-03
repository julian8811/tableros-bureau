#!/usr/bin/env node
/**
 * Auditoría completa de contraste del dashboard (todos los tabs).
 * Detecta texto oscuro sobre fondo oscuro y filas claras con texto claro.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PORT = 8101;
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

const TABS = [
  { id: "mercados", q: "?tab=mercados&anio=2025" },
  { id: "visitante", q: "?tab=visitante&anio=2025" },
  { id: "captacion", q: "?tab=captacion&anio=2025" },
  { id: "miembros", q: "?tab=miembros&anio=2025" },
  { id: "informes", q: "?tab=informes&pieza=informe&anio=2025" }
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const kid = startStatic(PORT, ROOT);
  await waitPort(PORT, 15000);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const report = { at: new Date().toISOString(), tabs: {}, issues: [] };

  for (const tab of TABS) {
    await page.goto("http://127.0.0.1:" + PORT + "/index.html" + tab.q, {
      waitUntil: "networkidle",
      timeout: 90000
    });
    await page.waitForTimeout(1800);

    const audit = await page.evaluate(function (tabId) {
      function parseRgb(c) {
        if (!c || c === "transparent" || c === "rgba(0, 0, 0, 0)") return null;
        const m = String(c).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?/);
        if (!m) return null;
        const a = m[4] == null ? 1 : +m[4];
        if (a < 0.08) return null;
        return { r: +m[1], g: +m[2], b: +m[3], a: a };
      }
      function lum(c) {
        const p = parseRgb(c);
        if (!p) return null;
        // blend onto navy if semi-transparent
        const br = 14, bg = 22, bb = 38;
        const r = p.r * p.a + br * (1 - p.a);
        const g = p.g * p.a + bg * (1 - p.a);
        const b = p.b * p.a + bb * (1 - p.a);
        return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      }
      function effectiveBg(el) {
        let n = el;
        while (n && n !== document.documentElement) {
          const cs = getComputedStyle(n);
          const bg = cs.backgroundColor;
          const p = parseRgb(bg);
          if (p) return bg;
          // also check background-image solid-ish
          n = n.parentElement;
        }
        return getComputedStyle(document.body).backgroundColor;
      }

      const sels = [
        ".qbox strong", ".qbox span",
        ".block h3", ".kpi .label", ".kpi .value",
        ".grupo h2", ".hint", ".lead", ".aviso",
        ".filter", ".filter select", ".llm-sel select",
        ".tab", ".opts", ".opts span",
        ".mapa-emisores-rank h4", ".mapa-rank-table th", ".mapa-rank-table td",
        ".table th", ".table td",
        ".lista li", ".lista li span", ".lista li strong",
        ".hueco strong", ".glass-panel h3", ".mapa-emisores-head h3"
      ];

      const bad = [];
      const samples = {};
      sels.forEach(function (sel) {
        const nodes = document.querySelectorAll(sel);
        samples[sel] = nodes.length;
        Array.prototype.slice.call(nodes, 0, 25).forEach(function (el) {
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return;
          // skip inside deck export
          if (el.closest && el.closest(".deck, .informe-deck-live, #pieza-export")) return;
          const color = cs.color;
          const bg = effectiveBg(el);
          const Lc = lum(color);
          const Lb = lum(bg);
          if (Lc == null || Lb == null) return;
          const darkText = Lc < 0.4;
          const darkBg = Lb < 0.45;
          const lightText = Lc > 0.72;
          const lightBg = Lb > 0.72;
          if ((darkText && darkBg) || (lightText && lightBg)) {
            bad.push({
              tab: tabId,
              sel: sel,
              text: String(el.textContent || "").trim().slice(0, 70),
              color: color,
              bg: bg,
              Lc: +Lc.toFixed(3),
              Lb: +Lb.toFixed(3),
              kind: darkText && darkBg ? "dark-on-dark" : "light-on-light"
            });
          }
        });
      });

      // even rows with light bg
      const stripe = [];
      document.querySelectorAll("table tbody tr").forEach(function (tr, i) {
        if (tr.closest && tr.closest(".deck, #pieza-export")) return;
        const cs = getComputedStyle(tr);
        const bg = cs.backgroundColor;
        const Lb = lum(bg);
        const td = tr.querySelector("td");
        if (!td) return;
        const tcs = getComputedStyle(td);
        const Lc = lum(tcs.color);
        if (Lb != null && Lb > 0.65 && Lc != null && Lc > 0.65) {
          stripe.push({
            tab: tabId,
            row: i + 1,
            text: String(tr.textContent || "").trim().slice(0, 60),
            bg: bg,
            color: tcs.color,
            Lb: +Lb.toFixed(3),
            Lc: +Lc.toFixed(3)
          });
        }
      });

      // which stylesheets set color on qbox strong / block h3
      function ownerRules(selProbe) {
        const el = document.querySelector(selProbe);
        if (!el) return null;
        const out = [];
        for (const sheet of document.styleSheets) {
          let rules;
          try { rules = sheet.cssRules; } catch (e) { continue; }
          if (!rules) continue;
          for (const rule of rules) {
            if (!rule.selectorText || !rule.style) continue;
            if (!rule.style.color && !rule.style.backgroundColor && !rule.style.background) continue;
            try {
              if (el.matches(rule.selectorText.split(",")[0].trim()) || rule.selectorText.indexOf(selProbe.replace(/^\./,"")) >= 0) {
                if (rule.style.color || /nth-child|tbody/.test(rule.selectorText)) {
                  out.push({
                    href: (sheet.href || "inline").split("/").pop(),
                    sel: rule.selectorText.slice(0, 100),
                    color: rule.style.color,
                    bg: rule.style.backgroundColor || rule.style.background
                  });
                }
              }
            } catch (e) {}
          }
        }
        return out.slice(0, 20);
      }

      return {
        bad: bad,
        stripe: stripe,
        samples: samples,
        qboxStrong: (function () {
          const el = document.querySelector(".qbox strong");
          if (!el) return null;
          const cs = getComputedStyle(el);
          return { color: cs.color, bg: effectiveBg(el), text: el.textContent.slice(0, 60) };
        })(),
        blockH3: (function () {
          const el = document.querySelector(".block h3");
          if (!el) return null;
          const cs = getComputedStyle(el);
          return { color: cs.color, bg: effectiveBg(el), text: el.textContent.slice(0, 60) };
        })(),
        bodyColor: getComputedStyle(document.body).color,
        rootText: getComputedStyle(document.documentElement).getPropertyValue("--text").trim(),
        deckOnPage: !!document.querySelector(".deck"),
        evenRuleHit: (function () {
          const tr = document.querySelector(".mapa-rank-table tbody tr:nth-child(2), .table tbody tr:nth-child(2)");
          if (!tr) return null;
          return {
            bg: getComputedStyle(tr).backgroundColor,
            tdColor: tr.querySelector("td") ? getComputedStyle(tr.querySelector("td")).color : null,
            inDeck: !!(tr.closest && tr.closest(".deck"))
          };
        })()
      };
    }, tab.id);

    report.tabs[tab.id] = {
      qboxStrong: audit.qboxStrong,
      blockH3: audit.blockH3,
      bodyColor: audit.bodyColor,
      rootText: audit.rootText,
      deckOnPage: audit.deckOnPage,
      evenRuleHit: audit.evenRuleHit,
      badCount: audit.bad.length,
      stripeCount: audit.stripe.length
    };
    audit.bad.forEach(function (b) { report.issues.push(b); });
    audit.stripe.forEach(function (s) {
      report.issues.push({
        tab: s.tab,
        sel: "tbody tr even-light",
        text: s.text,
        color: s.color,
        bg: s.bg,
        Lc: s.Lc,
        Lb: s.Lb,
        kind: "stripe-light-on-light"
      });
    });

    await page.screenshot({ path: path.join(OUT, "dash-" + tab.id + ".png"), fullPage: false });
  }

  fs.writeFileSync(path.join(OUT, "dashboard-full-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    issueCount: report.issues.length,
    byTab: Object.fromEntries(Object.entries(report.tabs).map(function (e) {
      return [e[0], { bad: e[1].badCount, stripe: e[1].stripeCount, qbox: e[1].qboxStrong, h3: e[1].blockH3, even: e[1].evenRuleHit, textVar: e[1].rootText, body: e[1].bodyColor }];
    })),
    issues: report.issues.slice(0, 40)
  }, null, 2));

  await browser.close();
  kid.kill();
  if (report.issues.length) process.exit(1);
  console.log("qa_dashboard_full OK");
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
