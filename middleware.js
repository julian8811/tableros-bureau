export function middleware() {
  return new Response("eco-resp", { status: 200, headers: { "Content-Type": "text/plain" } });
}
export const config = { matcher: ["/"] };
