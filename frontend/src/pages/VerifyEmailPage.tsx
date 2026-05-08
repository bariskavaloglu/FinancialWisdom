import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { AuthLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/index'
import { useThemeLang } from '@/context/ThemeLanguageContext'
import { api } from '@/services/api'

type Status = 'verifying' | 'success' | 'error'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { loginWithTokens } = useAuth()
  const { t } = useThemeLang()
  const [status, setStatus] = useState<Status>('verifying')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setErrorMsg(t('auth.invalidLink'))
      return
    }
    api.get(`/auth/verify-email?token=${token}`)
      .then(async ({ data }) => {
        await loginWithTokens(data.accessToken, data.refreshToken)
        setStatus('success')
        setTimeout(() => navigate('/questionnaire', { replace: true }), 2000)
      })
      .catch((err) => {
        setErrorMsg(err?.response?.data?.detail ?? t('auth.invalidLink'))
        setStatus('error')
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const verifyTexts = {
    verifying: { icon: null, title: t('common.loading'), sub: '' },
    success:   { icon: '✅', title: t('register.verifyEmail'), sub: t('auth.signIn') },
    error:     { icon: '❌', title: t('auth.invalidLink'), sub: errorMsg },
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-md animate-slide-up">
        <div className="card text-center space-y-6 py-8">
          {status === 'verifying' && (
            <>
              <Spinner size="lg" />
              <div>
                <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100 mb-1">
                  {t('common.loading')}
                </h2>
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 flex items-center justify-center mx-auto text-3xl">✅</div>
              <div>
                <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100 mb-1">
                  {t('register.verifyEmail')} ✓
                </h2>
                <p className="text-stone-500 dark:text-stone-400 text-sm">{t('auth.signIn').replace('→', '')}…</p>
              </div>
              <Spinner size="sm" />
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 flex items-center justify-center mx-auto text-3xl">❌</div>
              <div>
                <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100 mb-1">
                  {t('auth.invalidLink')}
                </h2>
                <p className="text-stone-500 dark:text-stone-400 text-sm">{errorMsg}</p>
              </div>
              <div className="flex flex-col gap-3">
                <Button onClick={() => navigate('/register')}>{t('register.createAccount')}</Button>
                <Button variant="secondary" onClick={() => navigate('/login')}>{t('auth.backToLogin')}</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </AuthLayout>
  )
}
