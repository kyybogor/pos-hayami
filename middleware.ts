import { NextResponse, NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'pos_hayami_secret_key_2026_super_secure_jwt'
);

// Rute publik yang boleh diakses tanpa login
const PUBLIC_PATHS = ['/login', '/api/auth/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('pos_session')?.value;

  let isValidSession = false;
  if (token) {
    try {
      await jwtVerify(token, JWT_SECRET);
      isValidSession = true;
    } catch {
      isValidSession = false;
    }
  }

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith('/api/auth/login'));

  // 1. Jika belum login dan mencoba mengakses rute terproteksi (termasuk '/' atau rute apapun)
  if (!isValidSession && !isPublicPath) {
    // Jika request ke API, kembalikan 401 Unauthorized
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized. Silakan login terlebih dahulu.' },
        { status: 401 }
      );
    }
    // Jika request ke halaman biasa, redirect ke /login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Jika sudah login dan mencoba ke rute /login, redirect ke /dashboard
  if (isValidSession && pathname === '/login') {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // 3. Jika sudah login dan mengakses root '/', redirect ke /dashboard
  if (isValidSession && pathname === '/') {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Proteksi seluruh URL aplikasi kecuali aset statis & file gambar
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

