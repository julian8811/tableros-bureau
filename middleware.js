export function middleware(request) {
  return new Response("eco:" + new URL(request.url).pathname, {
    status: 200,
    headers: { "Content-Type": "text/plain" }
  });
}
export const config = {
  matcher: ["/", "/index.html", "/informe-preview.html", "/login.html", "/data/:path*", "/api/:path*"]
};
