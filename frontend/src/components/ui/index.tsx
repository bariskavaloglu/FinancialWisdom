import type { ProfileType, HorizonType } from '@/types'

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }[size]
  return <span className={`${s} border-2 border-stone-900 border-t-transparent rounded-full animate-spin inline-block`} />
}

const profileLabels: Record<ProfileType, string> = { conservative: 'Muhafazakâr', balanced: 'Dengeli', aggressive: 'Agresif' }
export function ProfileBadge({ profile }: { profile: ProfileType }) {
  return <span className={`badge-${profile}`}>{profileLabels[profile]}</span>
}

const horizonLabels: Record<HorizonType, string> = {
  short: 'Kısa Vade (0–1 yıl)', medium: 'Orta Vade (1–5 yıl)', long: 'Uzun Vade (5+ yıl)',
}
export function HorizonBadge({ horizon }: { horizon: HorizonType }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-600 border border-stone-300">
      {horizonLabels[horizon]}
    </span>
  )
}

const alertStyles = {
  error:   'bg-red-50 border-red-200 text-red-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  success: 'bg-green-50 border-green-200 text-green-700',
  info:    'bg-blue-50 border-blue-200 text-blue-700',
}
const alertIcons = { error: '✕', warning: '⚠', success: '✓', info: 'ℹ' }

export function Alert({ variant = 'error', children }: { variant?: 'error' | 'warning' | 'success' | 'info'; children: React.ReactNode }) {
  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border text-sm ${alertStyles[variant]}`}>
      <span className="mt-0.5 font-bold flex-shrink-0">{alertIcons[variant]}</span>
      <div>{children}</div>
    </div>
  )
}

export function StalenessWarning() {
  return (
    <div className="stale-warning">
      <span>⚠</span>
      <span>Piyasa verileri güncel olmayabilir. Sistem önbellekten yüklendi.</span>
    </div>
  )
}

export function Disclaimer() {
  return (
    <div className="disclaimer">
      <span className="flex-shrink-0 mt-0.5">⚠</span>
      <span>Bu öneriler yalnızca eğitim amaçlıdır ve düzenlenmiş finansal tavsiye niteliği taşımaz.</span>
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center mb-4 text-2xl">📊</div>
      <h3 className="text-lg font-medium text-stone-900 mb-2">{title}</h3>
      {description && <p className="text-stone-500 text-sm max-w-xs mb-6">{description}</p>}
      {action}
    </div>
  )
}
