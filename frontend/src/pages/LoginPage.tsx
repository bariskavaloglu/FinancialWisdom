import {useState, useEffect} from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { AuthLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Input, FormField } from '@/components/ui/Input'
import { Alert } from '@/components/ui/index'
import { useThemeLang } from '@/context/ThemeLanguageContext'

export default function LoginPage() {

  const { login, isLoading, error, clearError } = useAuth()
  const { t, language} = useThemeLang()

  useEffect(() => { document.title = `${t('nav.login')} | Financial Wisdom` }, [language, t])
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string })?.from ?? '/dashboard'
  const [form, setForm] = useState({ email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.email) e.email = t('login.emailReq')
    if (!form.password) e.password = t('login.passReq')
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
          <h1 className="font-display text-3xl font-bold text-stone-900 dark:text-stone-100 mb-2">{t('login.welcomeBack')}</h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm">{t('login.subtitle')}</p>
        </div>
        {error && <div className="mb-4"><Alert variant="error">{error}</Alert></div>}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <FormField label="Email" htmlFor="email" required>
            <Input id="email" type="email" placeholder="you@example.com" autoComplete="email"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              error={fieldErrors.email} />
          </FormField>
          <FormField label={t('profile.page.changePass') === 'Şifre Değiştir' ? 'Şifre' : 'Password'} htmlFor="password" required>
            <Input id="password" type="password" placeholder="********" autoComplete="current-password"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              error={fieldErrors.password} />
          </FormField>
          <div className="flex justify-end">
            <button type="button" onClick={() => navigate('/forgot-password')}
              className="text-xs text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:underline transition-colors">
              {t('login.forgotPass')}
            </button>
          </div>
          <Button type="submit" className="w-full mt-2" isLoading={isLoading}>{t('login.signIn')}</Button>
        </form>
        <div className="relative mt-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-stone-200 dark:border-stone-700" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-stone-100 dark:bg-stone-950 text-stone-400 dark:text-stone-500">{t('login.noAccount')}</span>
          </div>
        </div>
        <Button variant="secondary" className="w-full mt-4" onClick={() => navigate('/register')}>
          {t('login.createFree')}
        </Button>
      </div>
    </AuthLayout>
  )
}
