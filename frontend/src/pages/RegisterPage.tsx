import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { AuthLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Input, FormField } from '@/components/ui/Input'
import { Alert } from '@/components/ui/index'

const STEPS = [
  'Hesabınızı oluşturun',
  'E-postanızı doğrulayın',
  'Risk anketini doldurun (15 soru)',
  'Portföy önerinizi görüntüleyin',
]

export default function RegisterPage() {
  const { register, isLoading, error, clearError, emailConfirmationPending, pendingEmail, resendVerification } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '', acceptTerms: false })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [resent, setResent] = useState(false)

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.fullName.trim()) e.fullName = 'Ad soyad gerekli.'
    if (!form.email) e.email = 'E-posta gerekli.'
    if (!form.password || form.password.length < 8) e.password = 'Şifre en az 8 karakter olmalı.'
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Şifreler eşleşmiyor.'
    if (!form.acceptTerms) e.acceptTerms = 'Devam etmek için şartları kabul edin.'
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
    } catch { /* hata AuthContext'te yönetiliyor */ }
  }

  const handleResend = async () => {
    if (!pendingEmail) return
    await resendVerification(pendingEmail)
    setResent(true)
    setTimeout(() => setResent(false), 5000)
  }

  // ── Mail Doğrulama Bekleniyor Ekranı ─────────────────────────────────────
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
                E-postanızı Doğrulayın
              </h2>
              <p className="text-stone-500 text-sm leading-relaxed">
                <strong className="text-stone-700">{pendingEmail}</strong> adresine
                bir doğrulama bağlantısı gönderdik.
              </p>
            </div>

            <div className="bg-stone-50 rounded-xl p-4 text-left space-y-2">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Sonraki adımlar</p>
              <ol className="space-y-2">
                {[
                  'Gelen kutunuzu kontrol edin (spam klasörünü de deneyin)',
                  'E-postadaki "E-postamı Doğrula" butonuna tıklayın',
                  'Otomatik olarak giriş yapılacaksınız',
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
              <Alert variant="success">Doğrulama maili tekrar gönderildi!</Alert>
            )}

            <p className="text-xs text-stone-400">
              Mail gelmediyse?{' '}
              <button
                onClick={handleResend}
                className="text-stone-600 underline hover:text-stone-900 font-medium"
              >
                Tekrar gönder
              </button>
            </p>

            <Button variant="secondary" className="w-full" onClick={() => navigate('/login')}>
              Giriş Sayfasına Dön
            </Button>
          </div>
        </div>
      </AuthLayout>
    )
  }

  // ── Kayıt Formu ───────────────────────────────────────────────────────────
  return (
    <AuthLayout>
      <div className="w-full max-w-4xl animate-slide-up">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold text-stone-900 mb-1">Hesap Oluştur</h1>
          <p className="text-stone-500 text-sm">Kişiselleştirilmiş portföyünüzü oluşturmaya başlayın</p>
        </div>

        <div className="grid md:grid-cols-5 gap-6 items-start">
          <div className="md:col-span-3">
            <div className="card space-y-4">
              {error && <Alert variant="error">{error}</Alert>}
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <FormField label="Ad Soyad" htmlFor="fullName" required>
                  <Input id="fullName" placeholder="Adınız Soyadınız" autoComplete="name"
                    value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    error={fieldErrors.fullName} />
                </FormField>
                <FormField label="E-posta Adresi" htmlFor="email" required>
                  <Input id="email" type="email" placeholder="siz@ornek.com" autoComplete="email"
                    value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    error={fieldErrors.email} />
                </FormField>
                <FormField label="Şifre" htmlFor="password" required>
                  <Input id="password" type="password" placeholder="En az 8 karakter" autoComplete="new-password"
                    value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    error={fieldErrors.password} />
                </FormField>
                <FormField label="Şifre Tekrar" htmlFor="confirmPassword" required>
                  <Input id="confirmPassword" type="password" placeholder="Şifreyi tekrar girin" autoComplete="new-password"
                    value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    error={fieldErrors.confirmPassword} />
                </FormField>
                <div>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" className="mt-0.5 w-4 h-4 accent-stone-900 cursor-pointer"
                      checked={form.acceptTerms} onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })} />
                    <span className="text-sm text-stone-600">Kullanım Koşulları ve Gizlilik Politikasını kabul ediyorum</span>
                  </label>
                  {fieldErrors.acceptTerms && (
                    <p className="mt-1 text-xs text-red-600 ml-7">{fieldErrors.acceptTerms}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" isLoading={isLoading}>
                  Hesap Oluştur →
                </Button>
              </form>
              <p className="text-center text-sm text-stone-500">
                Zaten hesabınız var mı?{' '}
                <button onClick={() => navigate('/login')} className="text-stone-900 font-medium hover:underline">
                  Giriş yapın
                </button>
              </p>
            </div>
          </div>

          <div className="md:col-span-2 space-y-4">
            <div className="card">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-4">SONRAKI ADIMLAR</p>
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
                <strong>Sorumluluk Reddi</strong><br />
                Öneriler yalnızca eğitim amaçlıdır. Bu, lisanslı finansal tavsiye değildir.
              </span>
            </div>
          </div>
        </div>
      </div>
    </AuthLayout>
  )
}
