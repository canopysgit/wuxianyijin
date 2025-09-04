import { NextRequest, NextResponse } from 'next/server'
import { issueToken, buildSessionCookie } from '@/lib/auth/session'
import bcrypt from 'bcryptjs'

type UserRecord = { username: string; passwordHash: string; isActive?: boolean }

function parseUsers(): UserRecord[] {
  const raw = process.env.AUTH_USERS || ''
  if (!raw) {
    throw new Error('未配置 AUTH_USERS 环境变量（JSON 数组或 csv 样式）')
  }
  try {
    // 优先尝试 JSON 数组：[{"username":"u","passwordHash":"..."}]
    const list = JSON.parse(raw)
    if (Array.isArray(list)) return list
  } catch {}
  // 回退：csv 风格 u1:hash1,u2:hash2
  const list: UserRecord[] = raw.split(',').map((pair) => {
    const [u, h] = pair.split(':')
    return { username: u?.trim() || '', passwordHash: h?.trim() || '' }
  })
  return list.filter((x) => x.username && x.passwordHash)
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json()
    const { username, password } = json || {}
    if (!username || !password) {
      return NextResponse.json({ error: '缺少用户名或密码' }, { status: 400 })
    }

    const users = parseUsers()
    // 调试：输出用户数量（不输出敏感信息）
    console.log('[auth] users loaded:', users.length)
    const user = users.find((u) => u.username === username)
    if (!user || user.isActive === false) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 })
    }

    let ok = false
    if (user.passwordHash.startsWith('$2a$') || user.passwordHash.startsWith('$2b$')) {
      ok = await bcrypt.compare(password, user.passwordHash)
    } else {
      ok = password === user.passwordHash
    }
    if (!ok) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 })
    }

    const token = await issueToken({ username })
    const res = NextResponse.json({ success: true })
    res.headers.set('Set-Cookie', buildSessionCookie(token))
    return res
  } catch (e: any) {
    return NextResponse.json({ error: '登录失败', details: e?.message || String(e) }, { status: 500 })
  }
}
