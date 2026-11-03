#!/usr/bin/env node
/**
 * Banco de fotos turismo Colombia vía Wikimedia Commons API (sin API key).
 * Guarda JPG locales + manifest con atribución CC.
 *
 * Uso: node scripts/fetch_colombia_photos.js
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const OUT = path.join(__dirname, "..", "design-options", "assets", "colombia-photos");
const OUT_ROOT = path.join(__dirname, "..", "assets", "colombia-photos");
const UA = "TablerosBureau/1.0 (local mock; contact bureau medellin observatorio; colombia tourism photos)";

/** Una query distinta por slot → máxima diversidad */
const SLOTS = [
  { id: "cover", q: "Pueblito Paisa Medellín" },
  { id: "toc", q: "Cartagena Colombia murallas colonial" },
  { id: "resumen", q: "Medellín skyline Colombia" },
  { id: "tendencias", q: "Valle del Cocora Colombia" },
  { id: "receptivo", q: "Guatapé Piedra del Peñol" },
  { id: "emisores", q: "Aeropuerto José María Córdova Rionegro" },
  { id: "destinos", q: "Ciudad Amurallada Cartagena" },
  { id: "reuniones", q: "Bogotá skyline Colombia" },
  { id: "visitante", q: "Feria de las Flores Medellín" },
  { id: "oferta", q: "Parque Arví Medellín" },
  { id: "conectividad", q: "Metro de Medellín" },
  { id: "marca", q: "Comuna 13 street art Medellín" },
  { id: "territorio", q: "Cañón del Chicamocha Colombia" },
  { id: "gestion", q: "Plaza Botero Medellín" },
  { id: "pronostico", q: "San Andrés Colombia playa" },
  { id: "extra_cafe", q: "Eje Cafetero Colombia finca café" },
  { id: "extra_tayrona", q: "Parque Tayrona Colombia" },
  { id: "extra_salento", q: "Salento Quindío Colombia" }
];

function getJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { headers: { "User-Agent": UA } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return getJson(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error("HTTP " + res.statusCode + " " + url));
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(45000, () => {
      req.destroy();
      reject(new Error("timeout " + url));
    });
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { headers: { "User-Agent": UA } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error("DL " + res.statusCode + " " + url));
        return;
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve(dest)));
      file.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error("dl timeout"));
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function searchCommons(query, limit = 8) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: String(limit),
    gsrsearch: query + " filetype:bitmap",
    prop: "imageinfo",
    iiprop: "url|extmetadata|size|mime",
    iiurlwidth: "1600"
  });
  const data = await getJson("https://commons.wikimedia.org/w/api.php?" + params.toString());
  const pages = (data.query && data.query.pages) || {};
  return Object.values(pages)
    .map((p) => {
      const ii = (p.imageinfo && p.imageinfo[0]) || {};
      const meta = ii.extmetadata || {};
      return {
        title: p.title,
        url: ii.thumburl || ii.url,
        full: ii.url,
        width: ii.thumbwidth || ii.width,
        height: ii.thumbheight || ii.height,
        mime: ii.mime,
        artist: (meta.Artist && meta.Artist.value) || "",
        license: (meta.LicenseShortName && meta.LicenseShortName.value) || "",
        credit: (meta.Credit && meta.Credit.value) || "",
        descriptionUrl: ii.descriptionurl
      };
    })
    .filter((x) => x.url && x.mime && String(x.mime).startsWith("image/") && !String(x.mime).includes("svg"));
}

function stripHtml(s) {
  return String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(OUT_ROOT, { recursive: true });

  const usedUrls = new Set();
  const manifest = {
    fuente: "Wikimedia Commons API",
    api: "https://commons.wikimedia.org/w/api.php",
    nota: "Imágenes CC/public domain. Atribución por archivo. No usar fotos del PDF TEC.",
    slots: {}
  };

  for (const slot of SLOTS) {
    process.stdout.write("slot " + slot.id + " … ");
    let candidates = [];
    try {
      candidates = await searchCommons(slot.q, 10);
    } catch (e) {
      console.log("ERR search", e.message);
      await sleep(800);
      continue;
    }
    await sleep(350); // serial, courtesy Wikimedia

    const pick = candidates.find((c) => c.url && !usedUrls.has(c.full || c.url));
    if (!pick) {
      console.log("sin candidato único");
      continue;
    }
    usedUrls.add(pick.full || pick.url);

    const ext = (pick.mime || "").includes("png") ? ".png" : ".jpg";
    const filename = slot.id + ext;
    const dest = path.join(OUT, filename);
    try {
      await download(pick.url, dest);
      fs.copyFileSync(dest, path.join(OUT_ROOT, filename));
      manifest.slots[slot.id] = {
        file: "assets/colombia-photos/" + filename,
        query: slot.q,
        title: pick.title,
        artist: stripHtml(pick.artist),
        license: pick.license,
        commons: pick.descriptionUrl || pick.title,
        bytes: fs.statSync(dest).size
      };
      console.log("OK", filename, pick.license || "?");
    } catch (e) {
      console.log("DL fail", e.message);
    }
    await sleep(250);
  }

  const manPath = path.join(OUT, "manifest.json");
  fs.writeFileSync(manPath, JSON.stringify(manifest, null, 2), "utf8");
  fs.copyFileSync(manPath, path.join(OUT_ROOT, "manifest.json"));
  console.log("\nManifest:", Object.keys(manifest.slots).length, "fotos →", manPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
