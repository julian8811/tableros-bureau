// Ayuda compartida: valida bureau_token contra la API (Node serverless).
// Sin API (cold start / caída): cerrado por defecto (false).
const API = process.env.API_BASE_URL || "https://bureau-api.onrender.com";

function getCookie(header, name) {
  const parts = ("; " + (header || "")).split("; " + name + "=");
  if (parts.length < 2) return "";
  return decodeURIComponent(parts[1].split(";")[0]);
}

async function sesionValida(token) {
  if (!token) return false;
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

module.exports = { getCookie, sesionValida };
