/**
 * VerifyEmailPage — /verify-email?token=xxx
 *
 * User lands here after clicking the link in the verification email.
 * Sends the token to the backend; on success receives a JWT and logs the user in.
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
      setErrorMsg('Invalid verification link.')
      return
    }

    api.get(`/auth/verify-email?token=${token}`)
      .then(async ({ data }) => {
        await loginWithTokens(data.accessToken, data.refreshToken)
        setStatus('success')
        setTimeout(() => navigate('/questionnaire', { replace: true }), 2000)
      })
      .catch((err) => {
        const detail = err?.response?.data?.detail ?? 'Verification failed.'
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
                  Verifying your email…
                </h2>
                <p className="text-stone-500 text-sm">Please wait.</p>
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
                  Email Verified!
                </h2>
                <p className="text-stone-500 text-sm">
                  You are logged in. Redirecting to the risk questionnaire…
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
                  Verification Failed
                </h2>
                <p className="text-stone-500 text-sm">{errorMsg}</p>
              </div>
              <div className="flex flex-col gap-3">
                <Button onClick={() => navigate('/register')}>
                  Register Again
                </Button>
                <Button variant="secondary" onClick={() => navigate('/login')}>
                  Go to Login
                </Button>
              </div>
            </>
          )}

        </div>
      </div>
    </AuthLayout>
  )
}
