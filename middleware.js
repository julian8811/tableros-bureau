// Ping de diagnóstico: no toca nada, solo prueba si el edge corre en estático.
export function middleware() {
  return undefined;
}

export const config = {
  matcher: ["/ping-mw"]
};
