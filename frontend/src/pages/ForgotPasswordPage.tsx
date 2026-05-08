import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Input, FormField } from '@/components/ui/Input'
import { Alert } from '@/components/ui/index'
import { api } from '@/services/api'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) { setError('Email address is required.'); return }
    setError(null)
    setIsLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch {
      // Always show success to prevent email enumeration
      setSent(true)
    } finally {
      setIsLoading(false)
    }
  }

  if (sent) {
    return (
      <AuthLayout>
        <div className="w-full max-w-md animate-slide-up">
          <div className="card text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto text-3xl">
              ✉️
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-stone-900 dark:text-stone-100 mb-2">
                Check Your Email
              </h2>
              <p className="text-stone-500 dark:text-stone-400 text-sm leading-relaxed">
                If an account exists for <strong className="text-stone-700 dark:text-stone-300">{email}</strong>,
                we sent a password reset link. Check your inbox and spam folder.
              </p>
            </div>
            <div className="bg-stone-50 dark:bg-stone-800/50 rounded-xl p-4 text-left space-y-2">
              <p className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest">Next steps</p>
              <ol className="space-y-2">
                {[
                  'Open the reset email from Financial Wisdom',
                  'Click "Reset My Password"',
                  'Set your new password (link valid 1 hour)',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-stone-600 dark:text-stone-300">
                    <span className="w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-700 flex-shrink-0 flex items-center justify-center text-xs font-bold text-stone-500 dark:text-stone-400 mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
            <Button variant="secondary" className="w-full" onClick={() => navigate('/login')}>
              Back to Login
            </Button>
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center mx-auto text-2xl mb-4">
            🔑
          </div>
          <h1 className="font-display text-3xl font-bold text-stone-900 dark:text-stone-100 mb-2">
            Forgot Password
          </h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm">
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        {error && <div className="mb-4"><Alert variant="error">{error}</Alert></div>}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <FormField label="Email address" htmlFor="email" required>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>
          <Button type="submit" className="w-full" isLoading={isLoading}>
            Send Reset Link
          </Button>
        </form>

        <div className="relative mt-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-stone-200 dark:border-stone-700" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-stone-100 dark:bg-stone-950 text-stone-400 dark:text-stone-500">
              remembered it?
            </span>
          </div>
        </div>
        <Button variant="secondary" className="w-full mt-4" onClick={() => navigate('/login')}>
          Back to Login
        </Button>
      </div>
    </AuthLayout>
  )
}
