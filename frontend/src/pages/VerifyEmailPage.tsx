/**
 * VerifyEmailPage — /verify-email?token=xxx
 *
 * Kullanıcı maildeki linke tıklayınca bu sayfaya gelir.
 * Backend'e token gönderir, başarılıysa JWT alır ve giriş yapılır.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { AuthLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/index'
import { api } from '@/services/api'

type Status = 'verifying' | 'success' | 'error'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { loginWithTokens } = useAuth()
  const [status, setStatus] = useState<Status>('verifying')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setErrorMsg('Geçersiz doğrulama bağlantısı.')
      return
    }

    api.get(`/auth/verify-email?token=${token}`)
      .then(async ({ data }) => {
        // Başarılı — token'ları kaydet ve giriş yap
        await loginWithTokens(data.accessToken, data.refreshToken)
        setStatus('success')
        // 2 saniye sonra questionnaire'e yönlendir
        setTimeout(() => navigate('/questionnaire', { replace: true }), 2000)
      })
      .catch((err) => {
        const detail = err?.response?.data?.detail ?? 'Doğrulama başarısız.'
        setErrorMsg(detail)
        setStatus('error')
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthLayout>
      <div className="w-full max-w-md animate-slide-up">
        <div className="card text-center space-y-6 py-8">

          {status === 'verifying' && (
            <>
              <Spinner size="lg" />
              <div>
                <h2 className="font-display text-xl font-bold text-stone-900 mb-1">
                  E-posta doğrulanıyor…
                </h2>
                <p className="text-stone-500 text-sm">Lütfen bekleyin.</p>
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto text-3xl">
                ✅
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-stone-900 mb-1">
                  E-posta doğrulandı!
                </h2>
                <p className="text-stone-500 text-sm">
                  Giriş yapıldı. Risk anketine yönlendiriliyorsunuz…
                </p>
              </div>
              <Spinner size="sm" />
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto text-3xl">
                ❌
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-stone-900 mb-1">
                  Doğrulama Başarısız
                </h2>
                <p className="text-stone-500 text-sm">{errorMsg}</p>
              </div>
              <div className="flex flex-col gap-3">
                <Button onClick={() => navigate('/register')}>
                  Tekrar Kayıt Ol
                </Button>
                <Button variant="secondary" onClick={() => navigate('/login')}>
                  Giriş Sayfası
                </Button>
              </div>
            </>
          )}

        </div>
      </div>
    </AuthLayout>
  )
}
