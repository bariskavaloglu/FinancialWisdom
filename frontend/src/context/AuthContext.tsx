/**
 * AuthContext — FastAPI backend ile çalışır.
 *
 * Kayıt akışı:
 *   register() → POST /auth/register → "mail doğrulama bekleniyor" mesajı
 *   Kullanıcı maildeki linke tıklar → /verify-email?token=xxx
 *   VerifyEmailPage → GET /auth/verify-email?token=xxx → JWT alır → giriş yapılır
 *
 * Giriş akışı:
 *   login() → POST /auth/login → JWT alır (sadece doğrulanmış hesaplar)
 */
import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react'
import { api } from '@/services/api'
import type { User, LoginRequest, RegisterRequest } from '@/types'

// ─── State ────────────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  emailConfirmationPending: boolean
  pendingEmail: string | null  // doğrulama beklenen mail adresi
}

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: User }
  | { type: 'AUTH_ERROR'; payload: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'EMAIL_CONFIRMATION_PENDING'; payload: string }

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  emailConfirmationPending: false,
  pendingEmail: null,
}

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_START':
      return { ...state, isLoading: true, error: null, emailConfirmationPending: false, pendingEmail: null }
    case 'AUTH_SUCCESS':
      return { user: action.payload, isAuthenticated: true, isLoading: false, error: null, emailConfirmationPending: false, pendingEmail: null }
    case 'AUTH_ERROR':
      return { ...state, isLoading: false, error: action.payload }
    case 'AUTH_LOGOUT':
      return { user: null, isAuthenticated: false, isLoading: false, error: null, emailConfirmationPending: false, pendingEmail: null }
    case 'CLEAR_ERROR':
      return { ...state, error: null }
    case 'EMAIL_CONFIRMATION_PENDING':
      return { ...state, isLoading: false, error: null, emailConfirmationPending: true, pendingEmail: action.payload }
    default:
      return state
  }
}

// ─── Token helpers ─────────────────────────────────────────────────────────────

const TOKEN_KEY = 'accessToken'
const REFRESH_KEY = 'refreshToken'

function saveTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_KEY, refreshToken)
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AuthContextValue extends AuthState {
  login: (data: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  loginWithTokens: (accessToken: string, refreshToken: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
  resendVerification: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Sayfa yüklendiğinde mevcut oturumu kontrol et
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      dispatch({ type: 'AUTH_LOGOUT' })
      return
    }
    api.get('/auth/me')
      .then(({ data }) => {
        dispatch({ type: 'AUTH_SUCCESS', payload: {
          userId: data.userId,
          email: data.email,
          fullName: data.fullName,
          role: data.role,
          createdAt: data.createdAt,
        }})
      })
      .catch(() => {
        clearTokens()
        dispatch({ type: 'AUTH_LOGOUT' })
      })
  }, [])

  const login = useCallback(async (data: LoginRequest) => {
    dispatch({ type: 'AUTH_START' })
    try {
      const { data: tokens } = await api.post('/auth/login', {
        email: data.email,
        password: data.password,
      })
      saveTokens(tokens.accessToken, tokens.refreshToken)
      const { data: me } = await api.get('/auth/me')
      dispatch({ type: 'AUTH_SUCCESS', payload: {
        userId: me.userId, email: me.email, fullName: me.fullName,
        role: me.role, createdAt: me.createdAt,
      }})
    } catch (err: unknown) {
      const msg = _extractError(err, 'Giriş başarısız.')
      dispatch({ type: 'AUTH_ERROR', payload: msg })
      throw new Error(msg)
    }
  }, [])

  const register = useCallback(async (data: RegisterRequest) => {
    dispatch({ type: 'AUTH_START' })
    try {
      await api.post('/auth/register', {
        fullName: data.fullName,
        email: data.email,
        password: data.password,
      })
      // Kayıt başarılı → mail doğrulama bekleniyor
      dispatch({ type: 'EMAIL_CONFIRMATION_PENDING', payload: data.email })
    } catch (err: unknown) {
      const msg = _extractError(err, 'Kayıt başarısız.')
      dispatch({ type: 'AUTH_ERROR', payload: msg })
      throw new Error(msg)
    }
  }, [])

  // Mail doğrulama sonrası (VerifyEmailPage'den çağrılır)
  const loginWithTokens = useCallback(async (accessToken: string, refreshToken: string) => {
    saveTokens(accessToken, refreshToken)
    const { data: me } = await api.get('/auth/me')
    dispatch({ type: 'AUTH_SUCCESS', payload: {
      userId: me.userId, email: me.email, fullName: me.fullName,
      role: me.role, createdAt: me.createdAt,
    }})
  }, [])

  const resendVerification = useCallback(async (email: string) => {
    await api.post('/auth/resend-verification', { email })
  }, [])

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem(REFRESH_KEY)
    if (refreshToken) {
      api.post('/auth/logout', { refreshToken }).catch(() => {})
    }
    clearTokens()
    dispatch({ type: 'AUTH_LOGOUT' })
  }, [])

  const clearError = useCallback(() => dispatch({ type: 'CLEAR_ERROR' }), [])

  return (
    <AuthContext.Provider value={{
      ...state, login, register, loginWithTokens,
      logout, clearError, resendVerification,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function _extractError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const e = err as { response?: { data?: { detail?: string }; status?: number } }
    if (e.response?.data?.detail) return e.response.data.detail
    if (e.response?.status === 409) return 'Bu e-posta adresi zaten kayıtlı.'
    if (e.response?.status === 401) return 'E-posta veya şifre hatalı.'
    if (e.response?.status === 403) return 'E-posta adresiniz henüz doğrulanmadı. Lütfen gelen kutunuzu kontrol edin.'
    if (e.response?.status === 422) return 'Lütfen tüm alanları doğru doldurun.'
  }
  if (err instanceof Error) return err.message
  return fallback
}
