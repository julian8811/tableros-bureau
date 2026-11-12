// Proxy de login: la cookie de sesión se emite HttpOnly desde el servidor,
// así el JavaScript del navegador nunca puede leer el token (mitiga XSS).
// El navegador la reenvía sola a /api/*, que ya la validan server-side.
const API = process.env.API_BASE_URL || "https://bureau-api.onrender.com";
const COOKIE = "bureau_token";
const MAX_AGE = 604800; // 7 días, igual que la sesión del backend

function conTimeout(ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, listo: () => clearTimeout(t) };
}

// Render (free) duerme la API: el primer request puede tardar >15s. Reintentamos
// una vez con margen amplio antes de rendirnos.
async function csrfUnaVez(ms) {
  const to = conTimeout(ms);
  try {
    const r = await fetch(API + "/auth/csrf", { signal: to.signal });
    if (!r.ok) return "";
    const body = await r.json();
    return body.csrf_token || "";
  } catch (e) {
    return "";
  } finally {
    to.listo();
  }
}

async function csrf() {
  const primero = await csrfUnaVez(25000);
  if (primero) return primero;
  return await csrfUnaVez(25000);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "solo POST" });
    return;
  }
  let datos = req.body;
  if (typeof datos === "string") {
    try {
      datos = JSON.parse(datos || "{}");
    } catch (e) {
      datos = {};
    }
  }
  datos = datos || {};

  const token = await csrf();
  if (!token) {
    res.status(503).json({
      error: "El servidor de acceso está despertando. Esperá 30 segundos y reintentá."
    });
    return;
  }

  const form = new URLSearchParams({
    email: String(datos.email || ""),
    password: String(datos.password || ""),
    totp: String(datos.totp || ""),
    csrf_token: token
  });

  const to = conTimeout(25000);
  let r;
  try {
    r = await fetch(API + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: to.signal
    });
  } catch (e) {
    to.listo();
    const abortado = e && e.name === "AbortError";
    res.status(abortado ? 504 : 502).json({
      error: abortado
        ? "El servidor está despertando. Esperá 30 segundos y reintentá con un código nuevo."
        : "No se pudo contactar el servidor de acceso."
    });
    return;
  }
  to.listo();

  if (r.status === 403) {
    res.status(403).json({ error: "Pendiente de aprobación o sin acceso." });
    return;
  }
  if (r.status === 429) {
    const espera = r.headers.get("retry-after") || "";
    res.setHeader("Retry-After", espera || "60");
    res.status(429).json({ error: "Bloqueado temporalmente, probá más tarde." });
    return;
  }
  if (r.status === 400) {
    res.status(400).json({ error: "Revisá los datos ingresados." });
    return;
  }
  if (!r.ok) {
    res.status(401).json({ error: "Credenciales inválidas." });
    return;
  }

  let cuerpo;
  try {
    cuerpo = await r.json();
  } catch (e) {
    res.status(502).json({ error: "Respuesta inesperada del servidor de acceso." });
    return;
  }
  const sesion = cuerpo && cuerpo.token;
  if (!sesion) {
    res.status(502).json({ error: "El servidor no devolvió una sesión válida." });
    return;
  }
  const partes = [
    COOKIE + "=" + encodeURIComponent(sesion),
    "Max-Age=" + MAX_AGE,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax"
  ];
  res.setHeader("Set-Cookie", partes.join("; "));
  res.setHeader("Cache-Control", "no-store");
  // Nunca se devuelve el token al navegador: la cookie HttpOnly es la única copia.
  res.status(200).json({ ok: true });
};
