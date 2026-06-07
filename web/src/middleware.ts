import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'ppp-jwt-secret-key-2024-change-in-production'
);

const COOKIE_NAME = 'ppp_token';

// Public paths that don't require authentication
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/debug/vision'];

// Admin-only API paths
const ADMIN_API_PREFIX = '/api/admin';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // Skip middleware for large file upload routes (avoid body buffering issues)
  if (pathname.includes('/plan-upload')) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    // API routes return 401, pages redirect to login
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // Check if user must change password - redirect to change-password page
    if (
      payload.mustChangePassword &&
      pathname !== '/change-password' &&
      pathname !== '/api/auth/change-password' &&
      pathname !== '/api/auth/me' &&
      pathname !== '/api/auth/logout'
    ) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: '请先修改密码', code: 'MUST_CHANGE_PASSWORD' },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL('/change-password', request.url));
    }

    // Check admin access for admin API routes
    if (pathname.startsWith(ADMIN_API_PREFIX) && payload.role !== 'admin') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    // Check admin access for admin pages
    if (pathname.startsWith('/admin') && payload.role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
  } catch {
    // Invalid token
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/reviews/:id/plan-upload (large file uploads, skip middleware buffering)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
