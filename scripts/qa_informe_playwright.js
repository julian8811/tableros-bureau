#!/usr/bin/env node
/**
 * QA visual mock TEC+V7: portada Cartagena, fotos contain, tablas/KPI.
 * Uso: node scripts/qa_informe_playwright.js [url]
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const url = process.argv[2] || "http://127.0.0.1:5173/informe-tec-referencia.html";
const outDir = path.join(__dirname, "..", "design-options", "qa-informe");
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  // Forzar carga de imgs lazy/eager fuera de viewport
  await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll("img.photo-img")];
    await Promise.all(
      imgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise((res) => {
          img.addEventListener("load", () => res(), { once: true });
          img.addEventListener("error", () => res(), { once: true });
          // re-trigger
          const s = img.src;
          img.src = "";
          img.src = s;
        });
      })
    );
  });
  await page.waitForTimeout(500);

  const report = await page.evaluate(() => {
    const slides = [...document.querySelectorAll("section.slide")];
    const imgs = [...document.querySelectorAll("img.photo-img")];
    const issues = [];
    const photoMeta = [];

    imgs.forEach((img, i) => {
      const cs = getComputedStyle(img);
      const slide = img.closest("section.slide");
      const label = (slide && slide.querySelector(".slide-label") || {}).textContent || "img-" + i;
      const meta = {
        slide: label,
        src: (img.currentSrc || img.src || "").split("?")[0],
        naturalW: img.naturalWidth,
        naturalH: img.naturalHeight,
        complete: img.complete,
        objectFit: cs.objectFit,
        w: Math.round(img.getBoundingClientRect().width),
        h: Math.round(img.getBoundingClientRect().height)
      };
      photoMeta.push(meta);
      if (!img.complete || img.naturalWidth < 50) issues.push({ type: "broken-img", ...meta });
      if (cs.objectFit !== "contain") issues.push({ type: "not-contain", ...meta });
    });

    const urls = photoMeta.map((p) => p.src);
    const counts = {};
    urls.forEach((u) => {
      counts[u] = (counts[u] || 0) + 1;
    });
    const duplicates = Object.entries(counts).filter(([, n]) => n > 1);

    const cover = slides[0];
    const coverImg = cover && cover.querySelector("img.photo-img");
    const coverSrc = coverImg ? (coverImg.currentSrc || coverImg.src) : "";
    const coverCredit = ((cover && cover.querySelector(".photo-credit")) || {}).textContent || "";

    const slide23 = slides.find((s) => /23 ·/.test((s.querySelector(".slide-label") || {}).textContent || ""));
    const slide23Info = slide23
      ? {
          label: slide23.querySelector(".slide-label").textContent,
          isKpi: slide23.classList.contains("kpi-photo"),
          cards: slide23.querySelectorAll(".kpi-card").length,
          tableRows: slide23.querySelectorAll("tbody tr").length,
          hasPhoto: Boolean(slide23.querySelector("img.photo-img"))
        }
      : null;

    slides.forEach((slide) => {
      const label = (slide.querySelector(".slide-label") || {}).textContent || "?";
      if (slide.scrollHeight > slide.clientHeight + 6) {
        issues.push({
          type: "overflow",
          slide: label,
          scroll: slide.scrollHeight,
          client: slide.clientHeight
        });
      }
    });

    return {
      slides: slides.length,
      photoImgs: imgs.length,
      uniquePhotos: Object.keys(counts).length,
      duplicates: duplicates.map(([u, n]) => ({ url: u, n })),
      tecLeak: urls.filter((u) => /tec-photos/i.test(u)),
      coverSrc,
      coverCredit,
      coverLooksCartagena: /cartagena|muralla|walls of cartagena/i.test(coverSrc + " " + coverCredit) ||
        /Cartagena|Murallas|walls/i.test((coverImg && coverImg.alt) || ""),
      slide23Info,
      issues,
      sampleFits: photoMeta.slice(0, 6).map((p) => ({ slide: p.slide, objectFit: p.objectFit, nat: p.naturalW + "x" + p.naturalH }))
    };
  });

  // Screenshots clave
  await page.locator('section.slide[aria-label="Portada"]').screenshot({
    path: path.join(outDir, "01-portada-cartagena.png")
  });

  const s23 = page.locator('section.slide').filter({ hasText: "23 ·" }).first();
  if (await s23.count()) {
    await s23.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await s23.screenshot({ path: path.join(outDir, "02-slide-23-kpi.png") });
  }

  const div = page.locator("section.slide.divider").first();
  await div.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await div.screenshot({ path: path.join(outDir, "03-divisor-foto-contain.png") });

  const table = page.locator("section.slide.table-page").first();
  await table.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await table.screenshot({ path: path.join(outDir, "04-tabla-emisores.png") });

  const ok =
    report.duplicates.length === 0 &&
    report.tecLeak.length === 0 &&
    report.coverLooksCartagena &&
    report.slide23Info &&
    report.slide23Info.isKpi &&
    report.slide23Info.cards >= 2 &&
    report.issues.filter((i) => i.type === "broken-img" || i.type === "not-contain" || i.type === "overflow").length === 0;

  const out = { url, ok, ...report, ts: new Date().toISOString() };
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
  process.exit(ok ? 0 : 2);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
