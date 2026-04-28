import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import {
  ProfileBadge, HorizonBadge, StalenessWarning,
  Disclaimer, EmptyState, Spinner,
} from '@/components/ui/index'
import { useApi } from '@/hooks/useApi'
import { useThemeLang } from '@/context/ThemeLanguageContext'
import { portfolioService, assessmentService } from '@/services'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts'
import type { AssetClass, Portfolio, AssessmentListItem } from '@/types'

// ─── Config ───────────────────────────────────────────────────────────────────

const ASSET_COLORS: Record<AssetClass, string> = {
  BIST_EQUITY:    '#D97706',
  SP500_EQUITY:   '#3B82F6',
  COMMODITY:      '#22C55E',
  CRYPTOCURRENCY: '#A78BFA',
  CASH_EQUIVALENT:'#6B7280',
}

const PROFILE_META = {
  conservative: {
    icon: '🛡️', accent: '#22C55E',
    bg:     'from-green-50 to-emerald-50',
    bgDark: 'dark:from-green-950/40 dark:to-emerald-950/40',
    border: 'border-green-200 dark:border-green-800',
    badge:  'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
    ring:   'ring-green-300 dark:ring-green-700',
    card:   'bg-white/70 dark:bg-green-950/30',
  },
  balanced: {
    icon: '⚖️', accent: '#3B82F6',
    bg:     'from-blue-50 to-sky-50',
    bgDark: 'dark:from-blue-950/40 dark:to-sky-950/40',
    border: 'border-blue-200 dark:border-blue-800',
    badge:  'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
    ring:   'ring-blue-300 dark:ring-blue-700',
    card:   'bg-white/70 dark:bg-blue-950/30',
  },
  aggressive: {
    icon: '🚀', accent: '#A78BFA',
    bg:     'from-violet-50 to-purple-50',
    bgDark: 'dark:from-violet-950/40 dark:to-purple-950/40',
    border: 'border-violet-200 dark:border-violet-800',
    badge:  'bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-300',
    ring:   'ring-violet-300 dark:ring-violet-700',
    card:   'bg-white/70 dark:bg-violet-950/30',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string, lang: 'en' | 'tr') {
  return new Date(iso).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function fmtDateTime(iso: string, lang: 'en' | 'tr') {
  return new Date(iso).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Portfolio History Dropdown ───────────────────────────────────────────────

function PortfolioDropdown({
  assessments, selectedId, onSelect,
}: {
  assessments: AssessmentListItem[]
  selectedId:  string
  onSelect:    (portfolioId: string, assessmentItem: AssessmentListItem) => void
}) {
  const [open, setOpen] = useState(false)
  const { t, language } = useThemeLang()
  const current = assessments.find((a) => a.portfolioId === selectedId)

  if (assessments.length <= 1) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors text-sm text-stone-700 dark:text-stone-300 shadow-sm"
      >
        <span className="text-base">
          {current ? PROFILE_META[current.profileType as keyof typeof PROFILE_META]?.icon : '📋'}
        </span>
        <span className="font-medium">
          {current
            ? `${t(`profile.${current.profileType}`)} · ${fmtDate(current.completedAt, language)}`
            : t('dashboard.selectPortfolio')}
        </span>
        <span className={`ml-1 text-stone-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-20 w-80 bg-white dark:bg-stone-900 rounded-2xl shadow-xl border border-stone-200 dark:border-stone-700 overflow-hidden animate-fade-in">
            <div className="px-4 py-3 border-b border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50">
              <p className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                {t('dashboard.portfolioHistory')} ({assessments.length})
              </p>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800">
              {assessments.map((a, idx) => {
                const meta    = PROFILE_META[a.profileType as keyof typeof PROFILE_META]
                const isSelected = a.portfolioId === selectedId
                const isCurrent  = idx === 0
                return (
                  <button
                    key={a.assessmentId}
                    onClick={() => { onSelect(a.portfolioId, a); setOpen(false) }}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-stone-50 dark:hover:bg-stone-800/50 flex items-start gap-3 ${isSelected ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-base mt-0.5 ring-2 ${meta?.ring ?? 'ring-stone-200'}`}
                      style={{ background: `${meta?.accent}18` }}
                    >
                      {meta?.icon ?? '📋'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                          {t(`profile.${a.profileType}`)}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {isCurrent && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-medium">
                              {t('common.current')}
                            </span>
                          )}
                          {isSelected && <span className="text-amber-600 text-xs">✓</span>}
                        </div>
                      </div>
                      <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                        {t('common.score')} {a.compositeScore}/100
                      </p>
                      <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">{fmtDate(a.completedAt, language)}</p>
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="px-4 py-3 border-t border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50">
              <button
                onClick={() => { setOpen(false); window.location.href = '/questionnaire' }}
                className="text-xs text-amber-700 dark:text-amber-400 hover:underline font-medium"
              >
                {t('dashboard.takeNew')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Profile Summary Banner ───────────────────────────────────────────────────

function ProfileBanner({ assessment, portfolio }: { assessment: AssessmentListItem; portfolio: Portfolio }) {
  const navigate = useNavigate()
  const { t, language } = useThemeLang()
  const profile  = PROFILE_META[assessment.profileType as keyof typeof PROFILE_META]
  const assetLabels: Record<AssetClass, string> = {
    BIST_EQUITY:    t('asset.BIST_EQUITY'),
    SP500_EQUITY:   t('asset.SP500_EQUITY'),
    COMMODITY:      t('asset.COMMODITY'),
    CRYPTOCURRENCY: t('asset.CRYPTOCURRENCY'),
    CASH_EQUIVALENT:t('asset.CASH_EQUIVALENT'),
  }

  const topAllocs = portfolio.allocations
    .filter((a) => a.targetWeight > 0)
    .sort((a, b) => b.targetWeight - a.targetWeight)
    .slice(0, 3)

  const totalInst = portfolio.allocations.reduce((s, a) => s + (a.instruments?.length ?? 0), 0)

  const allInst   = portfolio.allocations.flatMap((a) => a.instruments ?? [])
  const radarData = (() => {
    if (!allInst.length) return []
    const avg = (key: 'momentum' | 'value' | 'quality' | 'volatility') => {
      const vals = allInst.map((i) => i.factorScore?.[key]).filter((v): v is number => v !== undefined)
      return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 50
    }
    return [
      { factor: 'Momentum', value: avg('momentum') },
      { factor: 'Value',    value: avg('value') },
      { factor: 'Quality',  value: avg('quality') },
      { factor: 'Low Vol',  value: avg('volatility') },
    ]
  })()

  return (
    <div className={`rounded-2xl border ${profile?.border} bg-gradient-to-br ${profile?.bg} ${profile?.bgDark} p-5 space-y-4 transition-colors duration-200`}>

      {/* Top row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xl">{profile?.icon}</span>
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              {t('banner.recommendation')}
            </h2>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm">
            {t(`profile.${assessment.profileType}Desc`)}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-stone-400 dark:text-stone-500">
            {t('banner.questionnaire')} {fmtDate(assessment.completedAt, language)}
          </span>
          <button
            onClick={() => navigate('/questionnaire')}
            className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 underline underline-offset-2 transition-colors"
          >
            {t('banner.retake')}
          </button>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${profile?.badge}`}>
          {profile?.icon} {t(`profile.${assessment.profileType}`)}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
          {t(`horizon.${assessment.investmentHorizon}`)} ({t(`horizon.${assessment.investmentHorizon}Sub`)})
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
          {t('banner.riskScore')} {assessment.compositeScore}/100
        </span>
      </div>

      {/* Three columns */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

        {/* Allocations */}
        <div className={`${profile?.card} rounded-xl p-3.5 space-y-2.5`}>
          <p className="text-[10px] text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold">
            {t('banner.topAllocations')}
          </p>
          {topAllocs.map((a) => (
            <div key={a.assetClass}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-stone-600 dark:text-stone-300 truncate">{assetLabels[a.assetClass]}</span>
                <span className="text-xs font-bold text-stone-800 dark:text-stone-200 ml-2">{a.targetWeight}%</span>
              </div>
              <div className="w-full h-1 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${a.targetWeight}%`, background: ASSET_COLORS[a.assetClass] ?? '#888' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Metrics */}
        <div className={`${profile?.card} rounded-xl p-3.5 space-y-2.5`}>
          <p className="text-[10px] text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold">
            {t('banner.keyMetrics')}
          </p>
          {[
            { labelKey: 'banner.expectedReturn',     value: `${portfolio.expectedReturn?.toFixed(1) ?? '—'}%`,     icon: '📈' },
            { labelKey: 'banner.expectedVolatility', value: `${portfolio.expectedVolatility?.toFixed(1) ?? '—'}%`, icon: '〜' },
            { labelKey: 'banner.instruments',        value: String(totalInst),                                     icon: '🔢' },
          ].map(({ labelKey, value, icon }) => (
            <div key={labelKey} className="flex items-center justify-between">
              <span className="text-xs text-stone-500 dark:text-stone-400">{icon} {t(labelKey)}</span>
              <span className="text-sm font-bold text-stone-800 dark:text-stone-200">{value}</span>
            </div>
          ))}
        </div>

        {/* Radar */}
        <div className={`${profile?.card} rounded-xl p-3.5`}>
          <p className="text-[10px] text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold mb-1">
            {t('banner.avgFactorProfile')}
          </p>
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={108}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(120,113,108,0.3)" />
                <PolarAngleAxis dataKey="factor" tick={{ fontSize: 9, fill: '#78716c' }} />
                <Radar dataKey="value" stroke={profile?.accent} fill={profile?.accent} fillOpacity={0.18} strokeWidth={1.5} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[108px] text-xs text-stone-300 dark:text-stone-600">
              {t('banner.noData')}
            </div>
          )}
        </div>
      </div>

      {/* Explanation */}
      {portfolio.explanation && (
        <div className="bg-white/60 dark:bg-stone-900/40 rounded-xl px-4 py-3 border border-white/80 dark:border-stone-700/50">
          <p className="text-[10px] text-stone-400 dark:text-stone-500 uppercase tracking-wider font-semibold mb-1">
            {t('banner.whyThis')}
          </p>
          <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">{portfolio.explanation}</p>
        </div>
      )}
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <p className="text-xs text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-display font-medium text-stone-900 dark:text-stone-100">{value}</p>
      {sub && <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Allocation Pie ───────────────────────────────────────────────────────────

function AllocationPie({ portfolio }: { portfolio: Portfolio }) {
  const { t, theme } = useThemeLang()
  const tooltipStyle = {
    background: theme === 'dark' ? '#1c1917' : '#fff',
    border: theme === 'dark' ? '1px solid #44403c' : '1px solid #e7e5e4',
    borderRadius: 8,
    color: theme === 'dark' ? '#f5f5f4' : '#1c1917',
  }
  const data = portfolio.allocations
    .filter((a) => a.targetWeight > 0)
    .map((a) => ({
      name:  t(`asset.${a.assetClass}`),
      value: a.targetWeight,
      color: ASSET_COLORS[a.assetClass] ?? '#888',
    }))

  return (
    <div className="card">
      <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-4">
        {t('chart.assetAllocation')}
      </h3>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={3} dataKey="value">
              {data.map((entry, i) => <Cell key={i} fill={entry.color} stroke="transparent" />)}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v: number) => [`${v}%`, '']}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-2 flex-1">
          {data.map((d) => (
            <div key={d.name} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                <span className="text-sm text-stone-900/70 dark:text-stone-300">{d.name}</span>
              </div>
              <span className="text-sm font-medium text-stone-900 dark:text-stone-100">{d.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Instrument Table ─────────────────────────────────────────────────────────

function InstrumentTable({ portfolio }: { portfolio: Portfolio }) {
  const navigate = useNavigate()
  const { t } = useThemeLang()

  const instruments = portfolio.allocations.flatMap((a) => {
    const count = a.instruments?.length ?? 1
    const w     = count > 0 ? a.targetWeight / count : 0
    return (a.instruments ?? []).map((inst) => ({ ...inst, assetClass: a.assetClass, instrumentWeight: w }))
  })

  if (!instruments.length) return null

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest">
          {t('chart.selectedInstruments')}
        </h3>
        <button
          className="text-xs text-amber-700 dark:text-amber-400 hover:underline transition-colors"
          onClick={() => {
            const rows = instruments.map(i =>
              `${i.ticker},${i.name},${t(`asset.${i.assetClass}`)},${i.instrumentWeight.toFixed(1)}%,${i.factorScore?.composite ?? '—'}`
            )
            const blob = new Blob([['Ticker,Name,Class,Weight,Factor Score', ...rows].join('\n')], { type: 'text/csv' })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob); a.download = 'portfolio.csv'; a.click()
          }}
        >
          {t('chart.csvDownload')}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-stone-400 dark:text-stone-500 uppercase tracking-wider border-b border-stone-200 dark:border-stone-700">
              <th className="text-left pb-3 pr-4">{t('chart.instrument')}</th>
              <th className="text-left pb-3 pr-4">{t('chart.class')}</th>
              <th className="text-right pb-3 pr-4">{t('chart.weight')}</th>
              <th className="text-right pb-3 pr-4">{t('chart.momentum')}</th>
              <th className="text-right pb-3">{t('chart.score')}</th>
              <th className="pb-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
            {instruments.map((inst) => {
              const color    = ASSET_COLORS[inst.assetClass]
              const score    = inst.factorScore?.composite ?? 0
              const momentum = inst.factorScore?.momentum ?? null
              return (
                <tr key={inst.ticker} className="hover:bg-stone-50/30 dark:hover:bg-stone-800/30 transition-colors">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-stone-900 dark:text-stone-100">{inst.ticker}</p>
                    <p className="text-xs text-stone-400 dark:text-stone-500 truncate max-w-[140px]">{inst.name}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-xs px-2 py-0.5 rounded-full border font-medium"
                      style={{ color, borderColor: `${color}40`, background: `${color}15` }}>
                      {t(`asset.${inst.assetClass}`)}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right text-stone-700 dark:text-stone-300 font-medium">
                    {inst.instrumentWeight > 0 ? `${inst.instrumentWeight.toFixed(1)}%` : '—'}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {momentum !== null ? (
                      <span className={`text-xs font-medium ${momentum >= 50 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                        {momentum >= 50 ? '▲' : '▼'} {momentum.toFixed(1)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-16 h-1.5 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
                        <div className="h-full bg-stone-900 dark:bg-stone-100 rounded-full" style={{ width: `${score}%` }} />
                      </div>
                      <span className="text-xs text-stone-500 dark:text-stone-400 w-6 text-right">{score}</span>
                    </div>
                  </td>
                  <td className="py-3 pl-2">
                    <button
                      onClick={() => navigate(`/instrument/${encodeURIComponent(inst.ticker)}`)}
                      className="text-xs text-amber-700 dark:text-amber-400 hover:underline px-2 py-1 border border-amber-200 dark:border-amber-700 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                    >
                      {t('chart.detail')}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Factor Score Chart ───────────────────────────────────────────────────────

function FactorScoreChart({ portfolio }: { portfolio: Portfolio }) {
  const { t, theme } = useThemeLang()
  const barColor = theme === 'dark' ? '#f5f5f4' : '#1c1917'
  const tooltipStyle = {
    background: theme === 'dark' ? '#1c1917' : '#fff',
    border: theme === 'dark' ? '1px solid #44403c' : '1px solid #e7e5e4',
    borderRadius: 8,
    color: theme === 'dark' ? '#f5f5f4' : '#1c1917',
  }
  const instruments = portfolio.allocations
    .flatMap((a) => a.instruments ?? [])
    .filter((i) => i.factorScore)
    .slice(0, 8)
    .map((i) => ({ name: i.ticker, score: i.factorScore!.composite }))

  if (!instruments.length) return null

  return (
    <div className="card">
      <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-4">
        {t('chart.factorScore')}
      </h3>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={instruments} barSize={22}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"} />
          <XAxis dataKey="name" tick={{ fill: theme === "dark" ? "#a8a29e" : "#78716c", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: theme === "dark" ? "#a8a29e" : "#78716c", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number) => [v, 'Composite Score']}
          />
          <Bar dataKey="score" fill={barColor} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate()
  const { t, language } = useThemeLang()

  const { data: assessments, isLoading: loadingAssessments } = useApi(
    () => assessmentService.listAll()
  )
  const { data: currentPortfolio, isLoading: loadingCurrent, error, isStale } = useApi(
    () => portfolioService.getLatest()
  )

  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null)
  const [selectedAssessment, setSelectedAssessment]   = useState<AssessmentListItem | null>(null)
  const [viewedPortfolio, setViewedPortfolio]         = useState<Portfolio | null>(null)
  const [loadingViewed, setLoadingViewed]             = useState(false)

  const handleSelectPortfolio = useCallback(async (portfolioId: string, assessmentItem: AssessmentListItem) => {
    if (portfolioId === (currentPortfolio?.portfolioId ?? '')) {
      setSelectedPortfolioId(null); setSelectedAssessment(null); setViewedPortfolio(null)
      return
    }
    setSelectedPortfolioId(portfolioId); setSelectedAssessment(assessmentItem); setLoadingViewed(true)
    try {
      const p = await portfolioService.getById(portfolioId)
      setViewedPortfolio(p)
    } catch {
      setViewedPortfolio(null)
    } finally {
      setLoadingViewed(false)
    }
  }, [currentPortfolio])

  const isLoading = loadingAssessments || loadingCurrent

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" />
            <p className="text-stone-500 dark:text-stone-400 text-sm">{t('dashboard.loading')}</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (error || !currentPortfolio) {
    return (
      <AppLayout>
        <EmptyState
          title={t('dashboard.noPortfolio')}
          description={t('dashboard.noPortfolioDesc')}
          action={<Button onClick={() => navigate('/questionnaire')}>{t('dashboard.startQuestionnaire')}</Button>}
        />
      </AppLayout>
    )
  }

  const activePortfolio  = viewedPortfolio ?? currentPortfolio
  const activeAssessment = selectedAssessment ?? (assessments?.[0] ?? null)
  const isViewingHistory = selectedPortfolioId !== null && viewedPortfolio !== null
  const totalInstruments = activePortfolio.allocations.reduce((s, a) => s + (a.instruments?.length ?? 0), 0)
  const dropdownSelected = selectedPortfolioId ?? currentPortfolio.portfolioId

  const profileLabel: Record<string, string> = {
    conservative: t('profile.conservative'),
    balanced:     t('profile.balanced'),
    aggressive:   t('profile.aggressive'),
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {isStale && <StalenessWarning />}

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <ProfileBadge profile={activePortfolio.profileType} />
            <HorizonBadge horizon={activePortfolio.horizonType} />
            {isViewingHistory && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-medium">
                {t('dashboard.viewingHistory')} · {activeAssessment ? fmtDate(activeAssessment.completedAt, language) : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {assessments && assessments.length > 0 && (
              <PortfolioDropdown
                assessments={assessments}
                selectedId={dropdownSelected}
                onSelect={handleSelectPortfolio}
              />
            )}
            {isViewingHistory && (
              <button
                onClick={() => { setSelectedPortfolioId(null); setSelectedAssessment(null); setViewedPortfolio(null) }}
                className="text-xs text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 underline underline-offset-2 transition-colors"
              >
                {t('dashboard.backToCurrent')}
              </button>
            )}
            <Button variant="secondary" size="sm" onClick={() => navigate('/compare')}>
              {t('dashboard.compareScenarios')}
            </Button>
          </div>
        </div>

        {loadingViewed && (
          <div className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 py-2">
            <Spinner size="sm" /> {t('common.loading')}
          </div>
        )}

        {/* ── Profile Banner ── */}
        {!loadingViewed && activeAssessment && (
          <ProfileBanner assessment={activeAssessment} portfolio={activePortfolio} />
        )}

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label={t('stat.riskProfile')}
            value={profileLabel[activePortfolio.profileType] ?? activePortfolio.profileType}
            sub={activePortfolio.profileType}
          />
          <StatCard
            label={t('stat.portfolioScore')}
            value={activePortfolio.portfolioScore?.toFixed(1) ?? '—'}
            sub={t('stat.divIndex')}
          />
          <StatCard
            label={t('stat.expectedVolatility')}
            value={`${activePortfolio.expectedVolatility?.toFixed(1) ?? '—'}%`}
            sub={t('stat.annualised')}
          />
          <StatCard
            label={t('stat.selectedAssets')}
            value={String(totalInstruments)}
            sub={`${activePortfolio.allocations.length} ${t('stat.assetClasses')}`}
          />
        </div>

        {/* ── Charts ── */}
        <div className="grid lg:grid-cols-2 gap-6">
          <AllocationPie portfolio={activePortfolio} />
          <FactorScoreChart portfolio={activePortfolio} />
        </div>

        {/* ── Instrument table ── */}
        <InstrumentTable portfolio={activePortfolio} />

        <Disclaimer />

        <p className="text-xs text-stone-300 dark:text-stone-600 text-center">
          {t('chart.generatedAt')} {fmtDateTime(activePortfolio.generatedAt, language)} · {t('chart.cacheNote')}
        </p>
      </div>
    </AppLayout>
  )
}
