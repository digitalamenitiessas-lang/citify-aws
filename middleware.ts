import { NextResponse, type NextRequest } from 'next/server'
import { redirectForDisabledPath } from '@/lib/features'

export async function middleware(request: NextRequest) {
  // Secciones apagadas (lib/features.ts): quien entra por link va al inicio.
  const target = redirectForDisabledPath(request.nextUrl.pathname)
  if (target) {
    return NextResponse.redirect(new URL(target, request.url))
  }

  return NextResponse.next({
    request: {
      headers: request.headers,
    },
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
