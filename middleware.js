// Edge gate de tableros-bureau SIN dependencias (sin next/server).
// Continuar = devolver undefined. Redirigir = Response.redirect.
// 401/403 -> /login.html. Si la API no responde (cold start de Render),
// se permite para no bloquear por disponibilidad (tradeoff documentado).
var API = "https://bureau-api.onrender.com";
var PUBLICO = [/^\/login\.html$/, /^\/assets\//, /^\/favicon/, /^\/apple-touch-icon/, /\.css$/];

function getCookie(header, name) {
  var parts = ("; " + (header || "")).split("; " + name + "=");
  if (parts.length < 2) return "";
  return decodeURIComponent(parts[1].split(";")[0]);
}

async function handle(request) {
  var pathname = new URL(request.url).pathname;
  for (var i = 0; i < PUBLICO.length; i++) {
    if (PUBLICO[i].test(pathname)) return undefined;
  }
  var token = getCookie(request.headers.get("cookie"), "bureau_token");
  if (!token) return Response.redirect(new URL("/login.html", request.url), 307);
  try {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 9000);
    var r = await fetch(API + "/auth/yo", {
      headers: { Authorization: "Bearer " + token },
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (r.ok) return undefined;
    if (r.status === 401 || r.status === 403) {
      return Response.redirect(new URL("/login.html", request.url), 307);
    }
    return undefined;
  } catch (e) {
    return undefined;
  }
}

export function middleware(request) {
  return handle(request).catch(function () { return undefined; });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
