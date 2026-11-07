// Edge gate de tableros-bureau: todo lo no público exige sesión válida.
// 401/403 -> /login.html. Si la API no responde (cold start de Render),
// se permite para no bloquear por disponibilidad (tradeoff documentado).
import { NextResponse } from "next/server";

var API = process.env.API_BASE_URL || "https://bureau-api.onrender.com";
var PUBLICO = [/^\/login\.html$/, /^\/assets\//, /^\/favicon/, /^\/apple-touch-icon/, /\.css$/];

export async function middleware(request) {
  var pathname = request.nextUrl.pathname;
  for (var i = 0; i < PUBLICO.length; i++) {
    if (PUBLICO[i].test(pathname)) return NextResponse.next();
  }
  var cookie = request.cookies.get("bureau_token");
  var token = cookie ? cookie.value : "";
  if (!token) return NextResponse.redirect(new URL("/login.html", request.url));
  try {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 9000);
    var r = await fetch(API + "/auth/yo", {
      headers: { Authorization: "Bearer " + token },
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (r.ok) return NextResponse.next();
    if (r.status === 401 || r.status === 403) {
      var url = new URL("/login.html", request.url);
      var resp = NextResponse.redirect(url);
      resp.cookies.delete("bureau_token");
      return resp;
    }
    return NextResponse.next();
  } catch (e) {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
