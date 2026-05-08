import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { AuthLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Input, FormField } from '@/components/ui/Input'
import { Alert } from '@/components/ui/index'
import { useThemeLang } from '@/context/ThemeLanguageContext'

export default function RegisterPage() {
  const { register, isLoading, error, clearError, emailConfirmationPending, pendingEmail, resendVerification } = useAuth()
  const { t } = useThemeLang()
  const navigate = useNavigate()
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '', acceptTerms: false })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [resent, setResent] = useState(false)

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.fullName.trim()) e.fullName = t('register.fullNameReq')
    if (!form.email) e.email = t('register.emailReq')
    if (!form.password || form.password.length < 8) e.password = t('register.passMin8')
    if (form.password !== form.confirmPassword) e.confirmPassword = t('register.passMismatch')
    if (!form.acceptTerms) e.acceptTerms = t('register.termsReq')
    return e
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); clearError()
    const errors = validate()
    if (Object.keys(errors).length) { setFieldErrors(errors); return }
    setFieldErrors({})
    try { await register({ fullName: form.fullName, email: form.email, password: form.password }) } catch { }
  }

  const handleResend = async () => {
    if (!pendingEmail) return
    await resendVerification(pendingEmail)
    setResent(true)
    setTimeout(() => setResent(false), 5000)
  }

  if (emailConfirmationPending) {
    return (
      <AuthLayout>
        <div className="w-full max-w-md animate-slide-up">
          <div className="card text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center mx-auto text-3xl">📧</div>
            <div>
              <h2 className="font-display text-2xl font-bold text-stone-900 dark:text-stone-100 mb-2">{t('register.verifyEmail')}</h2>
              <p className="text-stone-500 dark:text-stone-400 text-sm leading-relaxed">
                {t('register.verifyDesc')}{' '}<strong className="text-stone-700 dark:text-stone-300">{pendingEmail}</strong>.
              </p>
            </div>
            <div className="bg-stone-50 dark:bg-stone-800/50 rounded-xl p-4 text-left space-y-2">
              <p className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest">{t('register.nextSteps')}</p>
              <ol className="space-y-2">
                {[t('register.checkInbox'), t('register.clickVerify'), t('register.autoLogin')].map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-stone-600 dark:text-stone-300">
                    <span className="w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-700 flex-shrink-0 flex items-center justify-center text-xs font-bold text-stone-500 dark:text-stone-400 mt-0.5">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
            {resent && <Alert variant="success">{t('register.resend')} ✓</Alert>}
            <p className="text-xs text-stone-400 dark:text-stone-500">
              {t('register.didntReceive')}{' '}
              <button onClick={handleResend} className="text-stone-600 dark:text-stone-300 underline hover:text-stone-900 dark:hover:text-stone-100 font-medium">{t('register.resend')}</button>
            </p>
            <Button variant="secondary" className="w-full" onClick={() => navigate('/login')}>{t('register.backToLogin')}</Button>
          </div>
        </div>
      </AuthLayout>
    )
  }

  const STEPS = [t('register.step1'), t('register.step2'), t('register.step3'), t('register.step4')]

  return (
    <AuthLayout>
      <div className="w-full max-w-4xl animate-slide-up">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold text-stone-900 dark:text-stone-100 mb-1">{t('register.createAccount')}</h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm">{t('register.subtitle')}</p>
        </div>
        <div className="grid md:grid-cols-5 gap-6 items-start">
          <div className="md:col-span-3">
            <div className="card space-y-4">
              {error && <Alert variant="error">{error}</Alert>}
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <FormField label={t('profile.page.fullName')} htmlFor="fullName" required>
                  <Input id="fullName" autoComplete="name" value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })} error={fieldErrors.fullName} />
                </FormField>
                <FormField label={t('profile.page.email')} htmlFor="email" required>
                  <Input id="email" type="email" placeholder="you@example.com" autoComplete="email"
                    value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={fieldErrors.email} />
                </FormField>
                <FormField label={t('profile.page.newPass')} htmlFor="password" required>
                  <Input id="password" type="password" autoComplete="new-password"
                    value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={fieldErrors.password} />
                </FormField>
                <FormField label={t('profile.page.confirmPass')} htmlFor="confirmPassword" required>
                  <Input id="confirmPassword" type="password" autoComplete="new-password"
                    value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} error={fieldErrors.confirmPassword} />
                </FormField>
                <div>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" className="mt-0.5 w-4 h-4 accent-stone-900 cursor-pointer"
                      checked={form.acceptTerms} onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })} />
                    <span className="text-sm text-stone-600 dark:text-stone-300">{t('register.acceptTerms')}</span>
                  </label>
                  {fieldErrors.acceptTerms && <p className="mt-1 text-xs text-red-600 ml-7">{fieldErrors.acceptTerms}</p>}
                </div>
                <Button type="submit" className="w-full" isLoading={isLoading}>{t('register.createBtn')}</Button>
              </form>
              <p className="text-center text-sm text-stone-500 dark:text-stone-400">
                {t('register.alreadyHave')}{' '}
                <button onClick={() => navigate('/login')} className="text-stone-900 dark:text-stone-100 font-medium hover:underline">{t('register.logIn')}</button>
              </p>
            </div>
          </div>
          <div className="md:col-span-2 space-y-4">
            <div className="card">
              <p className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-4">{t('register.howItWorks')}</p>
              <ol className="space-y-3">
                {STEPS.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 ${
                      i === 0 ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900' : 'bg-stone-100 dark:bg-stone-800 text-stone-400 border border-stone-200 dark:border-stone-700'
                    }`}>{i + 1}</span>
                    <span className={`text-sm leading-snug ${i === 0 ? 'text-stone-900 dark:text-stone-100 font-medium' : 'text-stone-400 dark:text-stone-500'}`}>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="disclaimer">
              <span className="flex-shrink-0 mt-0.5">⚠</span>
              <span>{t('footer.disclaimer')}</span>
            </div>
          </div>
        </div>
      </div>
    </AuthLayout>
  )
}
