import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { AuthLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Input, FormField } from '@/components/ui/Input'
import { Alert } from '@/components/ui/index'

export default function LoginPage() {
  const { login, isLoading, error, clearError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string })?.from ?? '/dashboard'
  const [form, setForm] = useState({ email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.email) e.email = 'E-posta zorunludur.'
    if (!form.password) e.password = 'Sifre zorunludur.'
    return e
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); clearError()
    const errors = validate()
    if (Object.keys(errors).length) { setFieldErrors(errors); return }
    setFieldErrors({})
    try { await login(form); navigate(from, { replace: true }) } catch { }
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-stone-900 mb-2">Welcome back</h1>
          <p className="text-stone-500 text-sm">Sign in to your account</p>
        </div>
        {error && <div className="mb-4"><Alert variant="error">{error}</Alert></div>}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <FormField label="Email address" htmlFor="email" required>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              error={fieldErrors.email}
            />
          </FormField>
          <FormField label="Password" htmlFor="password" required>
            <Input
              id="password"
              type="password"
              placeholder="********"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              error={fieldErrors.password}
            />
          </FormField>
          <Button type="submit" className="w-full mt-2" isLoading={isLoading}>Sign In</Button>
        </form>
        <div className="relative mt-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-stone-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-white text-stone-400">no account yet?</span>
          </div>
        </div>
        <Button variant="secondary" className="w-full mt-4" onClick={() => navigate('/register')}>
          Create Free Account
        </Button>
      </div>
    </AuthLayout>
  )
}
