import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Alert, Spinner } from '@/components/ui/index'
import { useAuth } from '@/context/AuthContext'
import { useThemeLang } from '@/context/ThemeLanguageContext'
import { useApi } from '@/hooks/useApi'
import { assessmentService, portfolioService } from '@/services'
import { api } from '@/services/api'

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card space-y-4">
      <h2 className="text-sm font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-widest border-b border-stone-100 dark:border-stone-800 pb-3">
        {title}
      </h2>
      {children}
    </div>
  )
}

// ─── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <span className="text-sm text-stone-400 dark:text-stone-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-stone-900 dark:text-stone-100 text-right">{value}</span>
    </div>
  )
}

// ─── Password Form ────────────────────────────────────────────────────────────

function PasswordForm() {
  const { t } = useThemeLang()
  const [current,  setCurrent]  = useState('')
  const [next,     setNext]     = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [success,  setSuccess]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const handleSubmit = async () => {
    setError(null); setSuccess(false)
    if (next.length < 8) { setError(t('profile.page.passShort')); return }
    if (next !== confirm) { setError(t('profile.page.passMismatch')); return }
    setLoading(true)
    try {
      await api.put('/auth/change-password', {
        currentPassword: current,
        newPassword: next,
      })
      setSuccess(true)
      setCurrent(''); setNext(''); setConfirm('')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? t('profile.page.passFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {success && <Alert variant="success">{t('profile.page.passSuccess')}</Alert>}
      {error   && <Alert variant="error">{error}</Alert>}

      <div className="grid sm:grid-cols-1 gap-3">
        <div>
          <label className="label">{t('profile.page.currentPass')}</label>
          <input
            type="password"
            className="input"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">{t('profile.page.newPass')}</label>
            <input
              type="password"
              className="input"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="label">{t('profile.page.confirmPass')}</label>
            <input
              type="password"
              className="input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
            />
          </div>
        </div>
      </div>

      {/* Password strength indicator */}
      {next.length > 0 && (
        <div className="space-y-1">
          <div className="flex gap-1">
            {[8, 12, 16].map((len, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  next.length >= len
                    ? ['bg-red-400', 'bg-amber-400', 'bg-green-500'][i]
                    : 'bg-stone-200 dark:bg-stone-700'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-stone-400 dark:text-stone-500">
            {next.length < 8 ? t('profile.page.passShort') : next.length < 12 ? '🔒 OK' : next.length < 16 ? '🔒 Good' : '🔒 Strong'}
          </p>
        </div>
      )}

      <Button onClick={handleSubmit} isLoading={loading} disabled={!current || !next || !confirm}>
        {t('profile.page.updatePass')}
      </Button>
    </div>
  )
}

// ─── Edit Name Form ───────────────────────────────────────────────────────────

function EditNameForm({ currentName, onSaved }: { currentName: string; onSaved: (name: string) => void }) {
  const { t } = useThemeLang()
  const [name,    setName]    = useState(currentName)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handleSave = async () => {
    setError(null)
    if (!name.trim()) return
    setLoading(true)
    try {
      await api.put('/auth/me', { fullName: name.trim() })
      onSaved(name.trim())
    } catch {
      setError(t('profile.page.saveFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}
      <div>
        <label className="label">{t('profile.page.fullName')}</label>
        <input
          type="text"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ad Soyad"
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={handleSave} isLoading={loading} size="sm">{t('profile.page.save')}</Button>
        <Button variant="secondary" size="sm" onClick={() => onSaved(currentName)}>{t('profile.page.cancel')}</Button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user }  = useAuth()
  const { t, language } = useThemeLang()

  const [editingName, setEditingName] = useState(false)
  const [displayName, setDisplayName] = useState(user?.fullName ?? '')
  const [nameSaved,   setNameSaved]   = useState(false)

  // Activity counts
  const { data: assessments, isLoading: loadingA } = useApi(() => assessmentService.listAll())
  const { data: portfolios,  isLoading: loadingP } = useApi(() => portfolioService.list())

  if (!user) return null

  const memberSince = new Date(user.createdAt).toLocaleDateString(
    language === 'tr' ? 'tr-TR' : 'en-US',
    { day: '2-digit', month: 'long', year: 'numeric' }
  )

  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const handleNameSaved = (newName: string) => {
    setDisplayName(newName)
    setEditingName(false)
    if (newName !== user.fullName) setNameSaved(true)
    setTimeout(() => setNameSaved(false), 3000)
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">

        {/* ── Hero header ── */}
        <div className="flex items-center gap-5">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 flex items-center justify-center text-xl font-bold shrink-0 shadow-lg">
            {initials}
          </div>
          <div>
            <h1 className="font-display text-2xl font-medium text-stone-900 dark:text-stone-100">
              {displayName}
            </h1>
            <p className="text-stone-500 dark:text-stone-400 text-sm">{t('profile.page.subtitle')}</p>
          </div>
        </div>

        {nameSaved && <Alert variant="success">{t('profile.page.saved')}</Alert>}

        {/* ── Account Info ── */}
        <Section title={t('profile.page.info')}>
          {editingName ? (
            <EditNameForm currentName={displayName} onSaved={handleNameSaved} />
          ) : (
            <>
              <InfoRow label={t('profile.page.fullName')} value={
                <div className="flex items-center gap-2">
                  <span>{displayName}</span>
                  <button
                    onClick={() => setEditingName(true)}
                    className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
                  >
                    {t('profile.page.editName')}
                  </button>
                </div>
              } />
              <InfoRow label={t('profile.page.email')} value={user.email} />
              <InfoRow label={t('profile.page.role')} value={
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  user.role === 'admin'
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                }`}>
                  {user.role === 'admin' ? '🛡️ ' + t('profile.page.admin') : '💼 ' + t('profile.page.investor')}
                </span>
              } />
              <InfoRow label={t('profile.page.memberSince')} value={memberSince} />
            </>
          )}
        </Section>

        {/* ── Activity Summary ── */}
        <Section title={t('profile.page.stats')}>
          {(loadingA || loadingP) ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  icon: '📋',
                  label: t('profile.page.assessments'),
                  value: assessments?.length ?? 0,
                  action: () => navigate('/questionnaire'),
                  actionLabel: t('profile.page.goToQuest'),
                },
                {
                  icon: '📊',
                  label: t('profile.page.portfolios'),
                  value: portfolios?.length ?? 0,
                  action: () => navigate('/dashboard'),
                  actionLabel: t('profile.page.goToDashboard'),
                },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/40 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{item.icon}</span>
                    <span className="text-xs text-stone-500 dark:text-stone-400">{item.label}</span>
                  </div>
                  <p className="text-3xl font-display font-bold text-stone-900 dark:text-stone-100">
                    {item.value}
                  </p>
                  <button
                    onClick={item.action}
                    className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
                  >
                    {item.actionLabel} →
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── Security ── */}
        <Section title={t('profile.page.security')}>
          <div className="pb-1">
            <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-4">
              {t('profile.page.changePass')}
            </h3>
            <PasswordForm />
          </div>
        </Section>

      </div>
    </AppLayout>
  )
}
