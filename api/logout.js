// Cierra la sesión: borra la cookie HttpOnly y avisa al backend.
const API = process.env.API_BASE_URL || "https://bureau-api.onrender.com";
const COOKIE = "bureau_token";

function getCookie(header, name) {
  const partes = ("; " + (header || "")).split("; " + name + "=");
  if (partes.length < 2) return "";
  return decodeURIComponent(partes[1].split(";")[0]);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "solo POST" });
    return;
  }
  const token = getCookie(req.headers.cookie, COOKIE);
  if (token) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    try {
      await fetch(API + "/auth/logout", {
        method: "POST",
        headers: { Cookie: "bureau_session=" + encodeURIComponent(token) },
        signal: ctrl.signal
      });
    } catch (e) {
      /* best-effort: igual borramos la cookie local */
    } finally {
      clearTimeout(t);
    }
  }
  res.setHeader("Set-Cookie", COOKIE + "=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax");
  res.status(200).json({ ok: true });
};
