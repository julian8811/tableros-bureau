var API = "https://bureau-api.onrender.com";
function getCookie(header, name) {
  var parts = ("; " + (header || "")).split("; " + name + "=");
  if (parts.length < 2) return "";
  return decodeURIComponent(parts[1].split(";")[0]);
}
async function handle(request) {
  var token = getCookie(request.headers.get("cookie"), "bureau_token");
  if (!token) return Response.redirect(new URL("/login.html", request.url), 307);
  try {
    var r = await fetch(API + "/auth/yo", { headers: { Authorization: "Bearer " + token } });
    if (r.ok) return undefined;
    if (r.status === 401 || r.status === 403) return Response.redirect(new URL("/login.html", request.url), 307);
    return undefined;
  } catch (e) {
    return undefined;
  }
}
export function middleware(request) {
  return handle(request).catch(function () { return undefined; });
}
export const config = { matcher: ["/"] };
