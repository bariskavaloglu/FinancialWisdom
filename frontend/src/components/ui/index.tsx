import type { ProfileType, HorizonType } from '@/types'
import { useThemeLang } from '@/context/ThemeLanguageContext'

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }[size]
  return <span className={`${s} border-2 border-stone-900 dark:border-stone-100 border-t-transparent rounded-full animate-spin inline-block`} />
}

export function ProfileBadge({ profile }: { profile: ProfileType }) {
  const { t } = useThemeLang()
  return <span className={`badge-${profile}`}>{t(`profile.${profile}`)}</span>
}

export function HorizonBadge({ horizon }: { horizon: HorizonType }) {
  const { t } = useThemeLang()
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-300 dark:border-stone-600">
      {t(`horizon.${horizon}Label`)}
    </span>
  )
}

const alertStyles = {
  error:   'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400',
  warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400',
  success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400',
  info:    'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400',
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
  const { t } = useThemeLang()
  return (
    <div className="stale-warning">
      <span>⚠</span>
      <span>{t('footer.stale')}</span>
    </div>
  )
}

export function Disclaimer() {
  const { t } = useThemeLang()
  return (
    <div className="disclaimer">
      <span className="flex-shrink-0 mt-0.5">⚠</span>
      <span>{t('footer.disclaimer')}</span>
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center mb-4 text-2xl">📊</div>
      <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100 mb-2">{title}</h3>
      {description && <p className="text-stone-500 dark:text-stone-400 text-sm max-w-xs mb-6">{description}</p>}
      {action}
    </div>
  )
}
