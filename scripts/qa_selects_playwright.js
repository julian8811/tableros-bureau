/**
 * QA visual de selectores LLM / filtros en Informes (tema oscuro).
 * Uso: node scripts/qa_selects_playwright.js [url]
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const url = process.argv[2] || "https://tableros-bureau.vercel.app/";
const outDir = path.join(__dirname, "..", "design-options", "qa-selects");
fs.mkdirSync(outDir, { recursive: true });

async function stylesOf(page, selector) {
  return page.$eval(selector, (el) => {
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName,
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      borderColor: cs.borderColor,
      colorScheme: getComputedStyle(document.documentElement).colorScheme || "(none)",
      optionCount: el.options ? el.options.length : 0,
      options: el.options
        ? Array.from(el.options).slice(0, 6).map((o) => {
            const ocs = getComputedStyle(o);
            return {
              text: o.textContent,
              color: ocs.color,
              backgroundColor: ocs.backgroundColor
            };
          })
        : []
    };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

  await page.click('button[data-tab="informes"]');
  await page.waitForTimeout(1200);

  // Esperar selects LLM si aparecen
  const llmReady = await page.waitForSelector("select[data-llm='provider']", { timeout: 15000 }).catch(() => null);
  const shots = {};

  await page.screenshot({ path: path.join(outDir, "01-informes.png"), fullPage: false });

  const targets = [
    { key: "filter-anio", sel: "select[data-filtro='anio']" },
    { key: "filter-pais", sel: "select[data-filtro='pais']" },
    { key: "llm-provider", sel: "select[data-llm='provider']" },
    { key: "llm-model", sel: "select[data-llm='model']" }
  ];

  const report = { url, llmReady: Boolean(llmReady), selects: {} };

  for (const t of targets) {
    const el = await page.$(t.sel);
    if (!el) {
      report.selects[t.key] = { missing: true };
      continue;
    }
    report.selects[t.key] = await stylesOf(page, t.sel);
    await el.scrollIntoViewIfNeeded();
    const box = await el.boundingBox();
    await page.screenshot({
      path: path.join(outDir, `02-${t.key}-closed.png`),
      clip: box
        ? {
            x: Math.max(0, box.x - 8),
            y: Math.max(0, box.y - 8),
            width: Math.min(600, box.width + 16),
            height: Math.min(120, box.height + 16)
          }
        : undefined
    });

    // Abrir lista nativa (Chromium headless: size expand trick + screenshot)
    await page.evaluate((selector) => {
      const s = document.querySelector(selector);
      if (!s) return;
      s.setAttribute("data-qa-open", "1");
      s.size = Math.min(s.options.length, 6);
    }, t.sel);
    await page.waitForTimeout(200);
    const openBox = await el.boundingBox();
    await page.screenshot({
      path: path.join(outDir, `03-${t.key}-open.png`),
      clip: openBox
        ? {
            x: Math.max(0, openBox.x - 8),
            y: Math.max(0, openBox.y - 8),
            width: Math.min(640, openBox.width + 24),
            height: Math.min(280, openBox.height + 24)
          }
        : undefined
    });
    shots[t.key] = await stylesOf(page, t.sel);
    await page.evaluate((selector) => {
      const s = document.querySelector(selector);
      if (!s) return;
      s.size = 1;
      s.removeAttribute("data-qa-open");
    }, t.sel);
  }

  report.openStyles = shots;
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
