import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/favicon.ico',
]

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true
  if (pathname.startsWith('/_next')) return true
  if (pathname.startsWith('/assets')) return true
  return false
}

async function getSession(req: NextRequest) {
  const cookie = req.cookies.get('session')?.value
  if (!cookie) return null
  const secret = process.env.AUTH_SECRET
  if (!secret) return null
  try {
    await jwtVerify(cookie, new TextEncoder().encode(secret))
    return { ok: true }
  } catch { return null }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  // 保护页面与 API：/query、/api/calculations/*、/api/import-*
  const needsAuth =
    pathname.startsWith('/api/calculations') ||
    pathname.startsWith('/api/import-')

  if (!needsAuth || isPublicPath(pathname)) {
    return NextResponse.next()
  }

  const session = await getSession(req)
  if (session) return NextResponse.next()

  // 区分页面与 API：API 返回 401 JSON；页面重定向到 /login
  if (pathname.startsWith('/api/')) {
    return new NextResponse(JSON.stringify({ error: '未登录' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/api/calculations/:path*', '/api/import-:path*'],
}
