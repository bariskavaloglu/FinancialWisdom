import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { AuthLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Input, FormField } from '@/components/ui/Input'
import { Alert } from '@/components/ui/index'

const STEPS = [
  'Create your account',
  'Verify your email address',
  'Complete the risk questionnaire (15 questions)',
  'View your personalised portfolio recommendation',
]

export default function RegisterPage() {
  const { register, isLoading, error, clearError, emailConfirmationPending, pendingEmail, resendVerification } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '', acceptTerms: false })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [resent, setResent] = useState(false)

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.fullName.trim()) e.fullName = 'Full name is required.'
    if (!form.email) e.email = 'Email address is required.'
    if (!form.password || form.password.length < 8) e.password = 'Password must be at least 8 characters.'
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.'
    if (!form.acceptTerms) e.acceptTerms = 'You must accept the terms to continue.'
    return e
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    const errors = validate()
    if (Object.keys(errors).length) { setFieldErrors(errors); return }
    setFieldErrors({})
    try {
      await register({ fullName: form.fullName, email: form.email, password: form.password })
    } catch { /* error managed by AuthContext */ }
  }

  const handleResend = async () => {
    if (!pendingEmail) return
    await resendVerification(pendingEmail)
    setResent(true)
    setTimeout(() => setResent(false), 5000)
  }

  // ── Email Verification Pending Screen ────────────────────────────────────
  if (emailConfirmationPending) {
    return (
      <AuthLayout>
        <div className="w-full max-w-md animate-slide-up">
          <div className="card text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-3xl">
              📧
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-stone-900 mb-2">
                Verify Your Email
              </h2>
              <p className="text-stone-500 text-sm leading-relaxed">
                We sent a verification link to{' '}
                <strong className="text-stone-700">{pendingEmail}</strong>.
              </p>
            </div>

            <div className="bg-stone-50 rounded-xl p-4 text-left space-y-2">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Next steps</p>
              <ol className="space-y-2">
                {[
                  'Check your inbox (also try your spam folder)',
                  'Click the "Verify My Email" button in the email',
                  'You will be logged in automatically',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
                    <span className="w-5 h-5 rounded-full bg-stone-200 flex-shrink-0 flex items-center justify-center text-xs font-bold text-stone-500 mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {resent && (
              <Alert variant="success">Verification email resent!</Alert>
            )}

            <p className="text-xs text-stone-400">
              Didn't receive it?{' '}
              <button
                onClick={handleResend}
                className="text-stone-600 underline hover:text-stone-900 font-medium"
              >
                Resend
              </button>
            </p>

            <Button variant="secondary" className="w-full" onClick={() => navigate('/login')}>
              Back to Login
            </Button>
          </div>
        </div>
      </AuthLayout>
    )
  }

  // ── Registration Form ─────────────────────────────────────────────────────
  return (
    <AuthLayout>
      <div className="w-full max-w-4xl animate-slide-up">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold text-stone-900 mb-1">Create Account</h1>
          <p className="text-stone-500 text-sm">Start building your personalised portfolio</p>
        </div>

        <div className="grid md:grid-cols-5 gap-6 items-start">
          <div className="md:col-span-3">
            <div className="card space-y-4">
              {error && <Alert variant="error">{error}</Alert>}
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <FormField label="Full Name" htmlFor="fullName" required>
                  <Input id="fullName" placeholder="Your full name" autoComplete="name"
                    value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    error={fieldErrors.fullName} />
                </FormField>
                <FormField label="Email Address" htmlFor="email" required>
                  <Input id="email" type="email" placeholder="you@example.com" autoComplete="email"
                    value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    error={fieldErrors.email} />
                </FormField>
                <FormField label="Password" htmlFor="password" required>
                  <Input id="password" type="password" placeholder="At least 8 characters" autoComplete="new-password"
                    value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    error={fieldErrors.password} />
                </FormField>
                <FormField label="Confirm Password" htmlFor="confirmPassword" required>
                  <Input id="confirmPassword" type="password" placeholder="Re-enter your password" autoComplete="new-password"
                    value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    error={fieldErrors.confirmPassword} />
                </FormField>
                <div>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" className="mt-0.5 w-4 h-4 accent-stone-900 cursor-pointer"
                      checked={form.acceptTerms} onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })} />
                    <span className="text-sm text-stone-600">I accept the Terms of Service and Privacy Policy</span>
                  </label>
                  {fieldErrors.acceptTerms && (
                    <p className="mt-1 text-xs text-red-600 ml-7">{fieldErrors.acceptTerms}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" isLoading={isLoading}>
                  Create Account →
                </Button>
              </form>
              <p className="text-center text-sm text-stone-500">
                Already have an account?{' '}
                <button onClick={() => navigate('/login')} className="text-stone-900 font-medium hover:underline">
                  Log in
                </button>
              </p>
            </div>
          </div>

          <div className="md:col-span-2 space-y-4">
            <div className="card">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-4">HOW IT WORKS</p>
              <ol className="space-y-3">
                {STEPS.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 ${
                      i === 0 ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-400 border border-stone-200'
                    }`}>{i + 1}</span>
                    <span className={`text-sm leading-snug ${i === 0 ? 'text-stone-900 font-medium' : 'text-stone-400'}`}>
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="disclaimer">
              <span className="flex-shrink-0 mt-0.5">⚠</span>
              <span>
                <strong>Disclaimer</strong><br />
                Recommendations are for educational purposes only. This is not licensed financial advice.
              </span>
            </div>
          </div>
        </div>
      </div>
    </AuthLayout>
  )
}
