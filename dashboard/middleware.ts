import { NextRequest, NextResponse } from 'next/server';
import { COOKIE, cookieValida } from './lib/auth';

// Protege todo el dashboard: sin cookie válida → redirige a /login.
export async function middleware(req: NextRequest) {
  const ok = await cookieValida(req.cookies.get(COOKIE)?.value);
  if (ok) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  // Todo menos: /login, la API de login, y los assets internos de Next.
  matcher: ['/((?!login|api/login|_next/static|_next/image|favicon.ico).*)'],
};
