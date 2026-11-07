// GET /api/datos?f=data/open/ema.json -> contenido solo con sesión válida.
// La cookie bureau_token (mismo dominio, la manda el navegador sola) se
// valida contra la API. vercel.json reescribe /data/* hacia acá, así los
// JSON/JS de datos dejan de ser públicos aunque existan en el deploy.
// Sin API (cold start / caída): 503 honesto, cerrado por defecto.
const fs = require("fs");
const path = require("path");

const API = process.env.API_BASE_URL || "https://bureau-api.onrender.com";
const DIRS = [
  path.join(process.cwd(), "api", "_data"),
  path.join(__dirname, "_data")
];
const TIPOS = {
  ".json": "application/json; charset=utf-8",
  ".js": "application/javascript; charset=utf-8"
};

function getCookie(header, name) {
  const parts = ("; " + (header || "")).split("; " + name + "=");
  if (parts.length < 2) return "";
  return decodeURIComponent(parts[1].split(";")[0]);
}

function resolver(f) {
  if (typeof f !== "string" || f.indexOf("..") !== -1) return null;
  const rel = f.replace(/^\/+/, "").replace(/^data\//, "");
  if (!rel || rel[0] === "." || rel[0] === "/") return null;
  const ext = path.extname(rel).toLowerCase();
  if (!TIPOS[ext]) return null;
  for (const dir of DIRS) {
    const p = path.resolve(dir, rel);
    if (p !== dir && p.startsWith(dir + path.sep)) {
      try {
        if (fs.statSync(p).isFile()) return { ruta: p, tipo: TIPOS[ext] };
      } catch (e) { /* sigue al siguiente dir */ }
    }
  }
  return null;
}

async function sesionValida(token) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(API + "/auth/yo", {
      headers: { Authorization: "Bearer " + token },
      signal: ctrl.signal
    });
    clearTimeout(t);
    return r.ok;
  } catch (e) {
    return false;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "solo GET" });
    return;
  }
  const token = getCookie(req.headers.cookie, "bureau_token");
  if (!token || !(await sesionValida(token))) {
    res.status(401).json({ error: "sin sesión" });
    return;
  }
  const hit = resolver(req.query && req.query.f);
  if (!hit) {
    res.status(404).json({ error: "no existe" });
    return;
  }
  res.setHeader("Content-Type", hit.tipo);
  res.setHeader("Cache-Control", "private, max-age=300");
  fs.createReadStream(hit.ruta).pipe(res);
};
