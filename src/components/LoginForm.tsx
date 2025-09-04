'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginForm({ defaultNext = '/query' }: { defaultNext?: string }) {
  const router = useRouter()
  const search = useSearchParams()
  const next = search?.get('next') || defaultNext
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || '登录失败')
      }
      router.replace(next)
      router.refresh()
    } catch (err: any) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white shadow p-6 rounded-md space-y-4">
      <h2 className="text-xl font-semibold text-center">登录</h2>
      {error && <div className="text-red-600 text-sm text-center">{error}</div>}
      <div className="space-y-1">
        <label className="text-sm">用户名</label>
        <input
          className="w-full border rounded px-3 py-2"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm">密码</label>
        <input
          className="w-full border rounded px-3 py-2"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        disabled={loading}
      >
        {loading ? '登录中...' : '登录'}
      </button>
    </form>
  )
}

