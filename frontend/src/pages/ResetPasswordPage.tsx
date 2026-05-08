import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Input, FormField } from '@/components/ui/Input'
import { Alert } from '@/components/ui/index'
import { api } from '@/services/api'
import { useThemeLang } from '@/context/ThemeLanguageContext'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { t } = useThemeLang()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => { if (!token) navigate('/forgot-password') }, [token, navigate])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.password || form.password.length < 8) e.password = t('auth.passMin8')
    if (form.password !== form.confirmPassword) e.confirmPassword = t('auth.passMismatch')
    return e
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null)
    const errors = validate()
    if (Object.keys(errors).length) { setFieldErrors(errors); return }
    setFieldErrors({}); setIsLoading(true)
    try {
      await api.post('/auth/reset-password', { token, new_password: form.password })
      setSuccess(true)
    } catch (err: unknown) {
      setError((err as { userMessage?: string })?.userMessage ?? t('auth.invalidLink'))
    } finally { setIsLoading(false) }
  }

  if (success) {
    return (
      <AuthLayout>
        <div className="w-full max-w-md animate-slide-up">
          <div className="card text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto text-3xl">✅</div>
            <div>
              <h2 className="font-display text-2xl font-bold text-stone-900 dark:text-stone-100 mb-2">{t('auth.passwordUpdated')}</h2>
              <p className="text-stone-500 dark:text-stone-400 text-sm leading-relaxed">{t('auth.passwordUpdatedDesc')}</p>
            </div>
            <Button className="w-full" onClick={() => navigate('/login')}>{t('auth.signIn')}</Button>
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center mx-auto text-2xl mb-4">🔐</div>
          <h1 className="font-display text-3xl font-bold text-stone-900 dark:text-stone-100 mb-2">{t('auth.resetPassword')}</h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm">{t('auth.resetDesc')}</p>
        </div>
        {error && <div className="mb-4"><Alert variant="error">{error}</Alert></div>}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <FormField label={t('auth.newPassword')} htmlFor="password" required>
            <Input id="password" type="password" autoComplete="new-password"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              error={fieldErrors.password} />
          </FormField>
          <FormField label={t('auth.confirmNewPass')} htmlFor="confirmPassword" required>
            <Input id="confirmPassword" type="password" autoComplete="new-password"
              value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              error={fieldErrors.confirmPassword} />
          </FormField>
          <Button type="submit" className="w-full" isLoading={isLoading}>{t('auth.resetBtn')}</Button>
        </form>
      </div>
    </AuthLayout>
  )
}
