import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Korumasız sayfalar
const publicPaths = ['/login', '/api/auth', '/api/base44', '/api/drivers/recommendations']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public path'leri atla
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Static dosyaları atla
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Auth cookie kontrolü
  const authCookie = request.cookies.get('auth')

  if (authCookie?.value !== 'authenticated') {
    // Login sayfasına yönlendir
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
