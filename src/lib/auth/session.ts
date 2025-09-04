import { SignJWT, jwtVerify } from 'jose'

export interface SessionPayload {
  username: string
}

const COOKIE_NAME = 'session'

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('缺少 AUTH_SECRET 或长度不足（建议至少 32 字符）')
  }
  return new TextEncoder().encode(secret)
}

export async function issueToken(payload: SessionPayload, ttlSeconds = 60 * 60 * 24 * 7) {
  const secret = getSecret()
  const now = Math.floor(Date.now() / 1000)
  return await new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(secret)
}

export async function verifyToken(token: string) {
  const secret = getSecret()
  const { payload } = await jwtVerify(token, secret)
  return payload as unknown as SessionPayload & { iat: number; exp: number }
}

export function buildSessionCookie(token: string) {
  const isProd = process.env.NODE_ENV === 'production'
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    isProd ? 'Secure' : '',
    // 7 天
    `Max-Age=${60 * 60 * 24 * 7}`,
  ].filter(Boolean)
  return parts.join('; ')
}

export function clearSessionCookie() {
  const isProd = process.env.NODE_ENV === 'production'
  const parts = [
    `${COOKIE_NAME}=; Path=/`,
    'HttpOnly',
    'SameSite=Lax',
    isProd ? 'Secure' : '',
    'Max-Age=0',
  ].filter(Boolean)
  return parts.join('; ')
}

export async function getSessionFromRequest(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const match = cookie.match(/(?:^|; )session=([^;]+)/)
  if (!match) return null
  try {
    return await verifyToken(decodeURIComponent(match[1]))
  } catch {
    return null
  }
}

export async function requireSessionOr401(req: Request) {
  const session = await getSessionFromRequest(req)
  if (!session) {
    return new Response(JSON.stringify({ error: '未登录' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return null
}

