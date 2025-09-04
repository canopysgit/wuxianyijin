import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { jwtVerify } from 'jose'

export default async function UploadLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  const token = cookieStore.get('session')?.value
  const secret = process.env.AUTH_SECRET
  if (!token || !secret) {
    redirect('/login?next=/upload')
  }
  try {
    await jwtVerify(token, new TextEncoder().encode(secret))
  } catch {
    redirect('/login?next=/upload')
  }
  return <>{children}</>
}

