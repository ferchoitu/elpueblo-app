import { NextRequest, NextResponse } from 'next/server';
import { COOKIE, passwordOk, tokenEsperado } from '../../../lib/auth';

export async function POST(req: NextRequest) {
  let password = '';
  try {
    const body = await req.json();
    password = String(body.password ?? '');
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!passwordOk(password)) {
    return NextResponse.json({ ok: false, error: 'Contraseña incorrecta' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await tokenEsperado(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 días
  });
  return res;
}
