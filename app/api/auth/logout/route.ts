import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('pos_session');
  return NextResponse.json({ success: true, message: 'Berhasil logout' });
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete('pos_session');
  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}
