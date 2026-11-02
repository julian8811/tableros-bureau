import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const base = "http://127.0.0.1:8765/";
const browser = await chromium.launch();
const hallazgos = [];

for (const tab of ["mercados", "visitante", "captacion", "miembros", "informes"]) {
  for (const anio of [2026, 2025]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(base + "?tab=" + tab + "&anio=" + anio + "&pais=Todos", { waitUntil: "networkidle" });
    await page.waitForSelector(".kpi, .hueco, .block", { timeout: 15000 }).catch(() => {});
    const bloques = await page.evaluate(() => [...document.querySelectorAll("#app .block")].map((s) => ({
      titulo: ((s.querySelector("h3") || {}).textContent || "").trim(),
      hint: [...s.querySelectorAll(":scope > .hint")].map((n) => n.textContent.trim()).join(" | "),
      pies: [...s.querySelectorAll("p.src")].map((n) => n.textContent.trim()),
      huecos: [...s.querySelectorAll(".hueco")].map((n) => n.textContent.trim().slice(0, 220)),
    })));
    hallazgos.push({ tab, anio, n: bloques.length, bloques });
    await page.close();
  }
}
await browser.close();
await writeFile(new URL("./salida-leyendas.json", import.meta.url), JSON.stringify(hallazgos, null, 2));
console.log("tabs:", hallazgos.length, "bloques:", hallazgos.reduce((a, h) => a + h.n, 0));
