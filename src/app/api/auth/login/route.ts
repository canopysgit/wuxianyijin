import { NextRequest, NextResponse } from 'next/server'
import { issueToken, buildSessionCookie } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

type UserRecord = {
  id: string
  username: string
  password_hash: string
  is_active: boolean
  created_at: string
}

async function getUserFromDatabase(username: string): Promise<UserRecord | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_users')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single()

    if (error) {
      console.error('查询用户失败:', error)
      return null
    }

    return data as UserRecord
  } catch (error) {
    console.error('数据库查询异常:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json()
    const { username, password } = json || {}
    if (!username || !password) {
      return NextResponse.json({ error: '缺少用户名或密码' }, { status: 400 })
    }

    // 从数据库查询用户
    const user = await getUserFromDatabase(username)
    if (!user) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 })
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password_hash)
    if (!isPasswordValid) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 })
    }

    // 生成JWT令牌
    const token = await issueToken({ username: user.username })
    const res = NextResponse.json({
      success: true,
      user: {
        username: user.username,
        id: user.id
      }
    })
    res.headers.set('Set-Cookie', buildSessionCookie(token))
    return res
  } catch (e: any) {
    console.error('登录失败:', e)
    return NextResponse.json({ error: '登录失败', details: e?.message || String(e) }, { status: 500 })
  }
}
