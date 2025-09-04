import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { jwtVerify } from 'jose'

export default async function QueryLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  const token = cookieStore.get('session')?.value
  const secret = process.env.AUTH_SECRET
  if (!token || !secret) {
    redirect('/login?next=/query')
  }
  try {
    await jwtVerify(token, new TextEncoder().encode(secret))
  } catch {
    redirect('/login?next=/query')
  }
  return <>{children}</>
}

