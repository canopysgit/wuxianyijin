import { Suspense } from 'react'
import LoginForm from '@/components/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <Suspense fallback={<div>Loading...</div>}>
        <LoginForm defaultNext="/query" />
      </Suspense>
    </div>
  )
}
