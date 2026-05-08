import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Input, FormField } from '@/components/ui/Input'
import { Alert } from '@/components/ui/index'
import { api } from '@/services/api'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) {
      navigate('/forgot-password')
    }
  }, [token, navigate])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.password || form.password.length < 8) e.password = 'Password must be at least 8 characters.'
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.'
    return e
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const errors = validate()
    if (Object.keys(errors).length) { setFieldErrors(errors); return }
    setFieldErrors({})
    setIsLoading(true)
    try {
      await api.post('/auth/reset-password', { token, new_password: form.password })
      setSuccess(true)
    } catch (err: unknown) {
      const msg = (err as { userMessage?: string })?.userMessage
      setError(msg ?? 'This reset link is invalid or has expired.')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <AuthLayout>
        <div className="w-full max-w-md animate-slide-up">
          <div className="card text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto text-3xl">
              ✅
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-stone-900 dark:text-stone-100 mb-2">
                Password Updated
              </h2>
              <p className="text-stone-500 dark:text-stone-400 text-sm leading-relaxed">
                Your password has been reset successfully. You can now sign in with your new password.
              </p>
            </div>
            <Button className="w-full" onClick={() => navigate('/login')}>
              Sign In →
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
            🔐
          </div>
          <h1 className="font-display text-3xl font-bold text-stone-900 dark:text-stone-100 mb-2">
            Reset Password
          </h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm">
            Enter your new password below.
          </p>
        </div>

        {error && <div className="mb-4"><Alert variant="error">{error}</Alert></div>}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <FormField label="New Password" htmlFor="password" required>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              error={fieldErrors.password}
            />
          </FormField>
          <FormField label="Confirm New Password" htmlFor="confirmPassword" required>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Re-enter your new password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              error={fieldErrors.confirmPassword}
            />
          </FormField>
          <Button type="submit" className="w-full" isLoading={isLoading}>
            Reset Password
          </Button>
        </form>
      </div>
    </AuthLayout>
  )
}
