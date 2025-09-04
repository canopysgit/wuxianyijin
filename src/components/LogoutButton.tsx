'use client'

import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()
  const handle = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/')
    router.refresh()
  }
  return (
    <button onClick={handle} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 text-sm">
      退出登录
    </button>
  )
}

