import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import {
  ProfileBadge, HorizonBadge, StalenessWarning,
  Disclaimer, EmptyState, Spinner,
} from '@/components/ui/index'
import { useApi } from '@/hooks/useApi'
import { portfolioService, assessmentService } from '@/services'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts'
import type { AssetClass, Portfolio, AssessmentListItem } from '@/types'

// ─── Config ───────────────────────────────────────────────────────────────────

const ASSET_CONFIG: Record<AssetClass, { label: string; color: string }> = {
  BIST_EQUITY:    { label: 'BIST Equities',      color: '#1c1917' },
  SP500_EQUITY:   { label: 'S&P 500 ETF',        color: '#3B82F6' },
  COMMODITY:      { label: 'Commodities',         color: '#22C55E' },
  CRYPTOCURRENCY: { label: 'Cryptocurrency',      color: '#A78BFA' },
  CASH_EQUIVALENT:{ label: 'Cash / Money Market', color: '#6B7280' },
}

const PROFILE_META = {
  conservative: {
    label: 'Conservative', icon: '🛡️',
    desc: 'Capital preservation priority. Stability over growth.',
    accent: '#22C55E', bg: 'from-green-50 to-emerald-50',
    border: 'border-green-200', badge: 'bg-green-100 text-green-800',
    ring: 'ring-green-300',
  },
  balanced: {
    label: 'Balanced', icon: '⚖️',
    desc: 'Growth and security balanced. Diversified, moderate-risk approach.',
    accent: '#3B82F6', bg: 'from-blue-50 to-sky-50',
    border: 'border-blue-200', badge: 'bg-blue-100 text-blue-800',
    ring: 'ring-blue-300',
  },
  aggressive: {
    label: 'Aggressive', icon: '🚀',
    desc: 'Growth is primary. Higher volatility accepted for superior returns.',
    accent: '#A78BFA', bg: 'from-violet-50 to-purple-50',
    border: 'border-violet-200', badge: 'bg-violet-100 text-violet-800',
    ring: 'ring-violet-300',
  },
}

const HORIZON_META = {
  short:  { label: 'Short-term',  sub: '< 1 yr',   icon: '📅' },
  medium: { label: 'Medium-term', sub: '1–5 yrs',   icon: '📆' },
  long:   { label: 'Long-term',   sub: '5+ yrs',    icon: '🗓️' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Portfolio History Dropdown ───────────────────────────────────────────────

function PortfolioDropdown({
  assessments,
  selectedId,
  onSelect,
}: {
  assessments: AssessmentListItem[]
  selectedId: string
  onSelect: (portfolioId: string, assessmentItem: AssessmentListItem) => void
}) {
  const [open, setOpen] = useState(false)
  const current = assessments.find((a) => a.portfolioId === selectedId)

  if (assessments.length <= 1) return null   // tek portföy varsa gösterme

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 transition-colors text-sm text-stone-700 shadow-sm"
      >
        <span className="text-base">
          {current ? PROFILE_META[current.profileType as keyof typeof PROFILE_META]?.icon : '📋'}
        </span>
        <span className="font-medium">
          {current
            ? `${PROFILE_META[current.profileType as keyof typeof PROFILE_META]?.label} · ${fmtDate(current.completedAt)}`
            : 'Select portfolio'}
        </span>
        <span className={`ml-1 text-stone-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

          <div className="absolute right-0 mt-2 z-20 w-80 bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden animate-fade-in">
            <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
              <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">
                Portfolio History ({assessments.length})
              </p>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-stone-100">
              {assessments.map((a, idx) => {
                const meta    = PROFILE_META[a.profileType as keyof typeof PROFILE_META]
                const horizon = HORIZON_META[a.investmentHorizon as keyof typeof HORIZON_META]
                const isSelected = a.portfolioId === selectedId
                const isCurrent  = idx === 0   // en yeni = current

                return (
                  <button
                    key={a.assessmentId}
                    onClick={() => { onSelect(a.portfolioId, a); setOpen(false) }}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-stone-50 flex items-start gap-3 ${isSelected ? 'bg-amber-50' : ''}`}
                  >
                    {/* Profile icon circle */}
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-base mt-0.5 ring-2 ${meta?.ring ?? 'ring-stone-200'}`}
                      style={{ background: `${meta?.accent}18` }}
                    >
                      {meta?.icon ?? '📋'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-stone-900">
                          {meta?.label ?? a.profileType}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {isCurrent && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                              Current
                            </span>
                          )}
                          {isSelected && (
                            <span className="text-amber-600 text-xs">✓</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-stone-500">
                          {horizon?.icon} {horizon?.label} ({horizon?.sub})
                        </span>
                        <span className="text-stone-300 text-xs">·</span>
                        <span className="text-xs text-stone-400">
                          Score {a.compositeScore}/100
                        </span>
                      </div>
                      <p className="text-xs text-stone-400 mt-0.5">{fmtDate(a.completedAt)}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="px-4 py-3 border-t border-stone-100 bg-stone-50">
              <button
                onClick={() => { setOpen(false); window.location.href = '/questionnaire' }}
                className="text-xs text-amber-700 hover:underline font-medium"
              >
                + Take a new questionnaire →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Profile Summary Banner ───────────────────────────────────────────────────

function ProfileBanner({
  assessment,
  portfolio,
}: {
  assessment: AssessmentListItem
  portfolio: Portfolio
}) {
  const navigate = useNavigate()
  const profile  = PROFILE_META[assessment.profileType as keyof typeof PROFILE_META]
  const horizon  = HORIZON_META[assessment.investmentHorizon as keyof typeof HORIZON_META]

  const topAllocs = portfolio.allocations
    .filter((a) => a.targetWeight > 0)
    .sort((a, b) => b.targetWeight - a.targetWeight)
    .slice(0, 3)

  const totalInst = portfolio.allocations.reduce(
    (s, a) => s + (a.instruments?.length ?? 0), 0
  )

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
    <div className={`rounded-2xl border ${profile?.border} bg-gradient-to-br ${profile?.bg} p-5 space-y-4`}>

      {/* Top row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xl">{profile?.icon}</span>
            <h2 className="text-base font-semibold text-stone-900">
              Portfolio Recommendation
            </h2>
          </div>
          <p className="text-xs text-stone-500 max-w-sm">{profile?.desc}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-stone-400">
            Questionnaire: {fmtDate(assessment.completedAt)}
          </span>
          <button
            onClick={() => navigate('/questionnaire')}
            className="text-xs text-stone-400 hover:text-stone-600 underline underline-offset-2 transition-colors"
          >
            Retake →
          </button>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${profile?.badge}`}>
          {profile?.icon} {profile?.label}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-stone-100 text-stone-700">
          {horizon?.icon} {horizon?.label} ({horizon?.sub})
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
          Risk score {assessment.compositeScore}/100
        </span>
      </div>

      {/* Three columns */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

        {/* Allocations */}
        <div className="bg-white/70 rounded-xl p-3.5 space-y-2.5">
          <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">Top Allocations</p>
          {topAllocs.map((a) => {
            const cfg = ASSET_CONFIG[a.assetClass]
            return (
              <div key={a.assetClass}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-stone-600 truncate">{cfg?.label}</span>
                  <span className="text-xs font-bold text-stone-800 ml-2">{a.targetWeight}%</span>
                </div>
                <div className="w-full h-1 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${a.targetWeight}%`, background: cfg?.color }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Metrics */}
        <div className="bg-white/70 rounded-xl p-3.5 space-y-2.5">
          <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">Key Metrics</p>
          {[
            { label: 'Expected Return',     value: `${portfolio.expectedReturn?.toFixed(1) ?? '—'}%`,     icon: '📈' },
            { label: 'Expected Volatility', value: `${portfolio.expectedVolatility?.toFixed(1) ?? '—'}%`, icon: '〜' },
            { label: 'Instruments',         value: String(totalInst),                                     icon: '🔢' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs text-stone-500">{icon} {label}</span>
              <span className="text-sm font-bold text-stone-800">{value}</span>
            </div>
          ))}
        </div>

        {/* Radar */}
        <div className="bg-white/70 rounded-xl p-3.5">
          <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-1">Avg Factor Profile</p>
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={108}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e7e5e4" />
                <PolarAngleAxis dataKey="factor" tick={{ fontSize: 9, fill: '#78716c' }} />
                <Radar dataKey="value" stroke={profile?.accent} fill={profile?.accent} fillOpacity={0.18} strokeWidth={1.5} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[108px] text-xs text-stone-300">No data</div>
          )}
        </div>
      </div>

      {/* Explanation */}
      {portfolio.explanation && (
        <div className="bg-white/60 rounded-xl px-4 py-3 border border-white/80">
          <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-1">Why this portfolio?</p>
          <p className="text-xs text-stone-600 leading-relaxed">{portfolio.explanation}</p>
        </div>
      )}
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <p className="text-xs text-stone-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-display font-medium text-stone-900">{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Allocation Pie ───────────────────────────────────────────────────────────

function AllocationPie({ portfolio }: { portfolio: Portfolio }) {
  const data = portfolio.allocations
    .filter((a) => a.targetWeight > 0)
    .map((a) => ({
      name:  ASSET_CONFIG[a.assetClass]?.label ?? a.assetClass,
      value: a.targetWeight,
      color: ASSET_CONFIG[a.assetClass]?.color ?? '#888',
    }))

  return (
    <div className="card">
      <h3 className="text-sm font-medium text-stone-500 uppercase tracking-widest mb-4">Asset Allocation</h3>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={3} dataKey="value">
              {data.map((entry, i) => <Cell key={i} fill={entry.color} stroke="transparent" />)}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 8 }}
              formatter={(v: number) => [`${v}%`, '']}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-2 flex-1">
          {data.map((d) => (
            <div key={d.name} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                <span className="text-sm text-stone-900/70">{d.name}</span>
              </div>
              <span className="text-sm font-medium text-stone-900">{d.value}%</span>
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

  const instruments = portfolio.allocations.flatMap((a) => {
    const count = a.instruments?.length ?? 1
    const w     = count > 0 ? a.targetWeight / count : 0
    return (a.instruments ?? []).map((inst) => ({ ...inst, assetClass: a.assetClass, instrumentWeight: w }))
  })

  if (!instruments.length) return null

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-stone-500 uppercase tracking-widest">Selected Instruments</h3>
        <button
          className="text-xs text-amber-700 hover:underline transition-colors"
          onClick={() => {
            const rows = instruments.map(i =>
              `${i.ticker},${i.name},${ASSET_CONFIG[i.assetClass]?.label},${i.instrumentWeight.toFixed(1)}%,${i.factorScore?.composite ?? '—'}`
            )
            const blob = new Blob([['Ticker,Name,Class,Weight,Factor Score', ...rows].join('\n')], { type: 'text/csv' })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob); a.download = 'portfolio.csv'; a.click()
          }}
        >
          ↓ CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-stone-400 uppercase tracking-wider border-b border-stone-200">
              <th className="text-left pb-3 pr-4">Instrument</th>
              <th className="text-left pb-3 pr-4">Class</th>
              <th className="text-right pb-3 pr-4">Weight</th>
              <th className="text-right pb-3 pr-4">Momentum</th>
              <th className="text-right pb-3">Score</th>
              <th className="pb-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {instruments.map((inst) => {
              const cfg      = ASSET_CONFIG[inst.assetClass]
              const score    = inst.factorScore?.composite ?? 0
              const momentum = inst.factorScore?.momentum ?? null
              return (
                <tr key={inst.ticker} className="hover:bg-stone-50/30 transition-colors">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-stone-900">{inst.ticker}</p>
                    <p className="text-xs text-stone-400 truncate max-w-[140px]">{inst.name}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-xs px-2 py-0.5 rounded-full border font-medium"
                      style={{ color: cfg?.color, borderColor: `${cfg?.color}40`, background: `${cfg?.color}15` }}>
                      {cfg?.label ?? inst.assetClass}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right text-stone-700 font-medium">
                    {inst.instrumentWeight > 0 ? `${inst.instrumentWeight.toFixed(1)}%` : '—'}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {momentum !== null ? (
                      <span className={`text-xs font-medium ${momentum >= 50 ? 'text-green-600' : 'text-red-500'}`}>
                        {momentum >= 50 ? '▲' : '▼'} {momentum.toFixed(1)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-16 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-stone-900 rounded-full" style={{ width: `${score}%` }} />
                      </div>
                      <span className="text-xs text-stone-500 w-6 text-right">{score}</span>
                    </div>
                  </td>
                  <td className="py-3 pl-2">
                    <button
                      onClick={() => navigate(`/instrument/${encodeURIComponent(inst.ticker)}`)}
                      className="text-xs text-amber-700 hover:underline px-2 py-1 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors"
                    >
                      Detail
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
  const instruments = portfolio.allocations
    .flatMap((a) => a.instruments ?? [])
    .filter((i) => i.factorScore)
    .slice(0, 8)
    .map((i) => ({ name: i.ticker, score: i.factorScore!.composite }))

  if (!instruments.length) return null

  return (
    <div className="card">
      <h3 className="text-sm font-medium text-stone-500 uppercase tracking-widest mb-4">
        Factor Score Comparison (Top 8)
      </h3>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={instruments} barSize={22}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
          <XAxis dataKey="name" tick={{ fill: '#78716c', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: '#78716c', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 8 }}
            formatter={(v: number) => [v, 'Composite Score']}
          />
          <Bar dataKey="score" fill="#1c1917" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate()

  // Assessment history list
  const { data: assessments, isLoading: loadingAssessments } = useApi(
    () => assessmentService.listAll()
  )

  // Default: current portfolio
  const { data: currentPortfolio, isLoading: loadingCurrent, error, isStale } = useApi(
    () => portfolioService.getLatest()
  )

  // Selected portfolio state (null = current)
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null)
  const [selectedAssessment, setSelectedAssessment]   = useState<AssessmentListItem | null>(null)
  const [viewedPortfolio, setViewedPortfolio]         = useState<Portfolio | null>(null)
  const [loadingViewed, setLoadingViewed]             = useState(false)

  const handleSelectPortfolio = useCallback(async (portfolioId: string, assessmentItem: AssessmentListItem) => {
    if (portfolioId === (currentPortfolio?.portfolioId ?? '')) {
      // Seçilen mevcut portföy — ekstra fetch gerek yok
      setSelectedPortfolioId(null)
      setSelectedAssessment(null)
      setViewedPortfolio(null)
      return
    }
    setSelectedPortfolioId(portfolioId)
    setSelectedAssessment(assessmentItem)
    setLoadingViewed(true)
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
            <p className="text-stone-500 text-sm">Loading dashboard…</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (error || !currentPortfolio) {
    return (
      <AppLayout>
        <EmptyState
          title="No portfolio found"
          description="Complete the risk questionnaire to get your personalised portfolio."
          action={<Button onClick={() => navigate('/questionnaire')}>Start Risk Questionnaire →</Button>}
        />
      </AppLayout>
    )
  }

  // Aktif gösterilen portföy: seçilen geçmiş ya da mevcut
  const activePortfolio   = viewedPortfolio ?? currentPortfolio
  const activeAssessment  = selectedAssessment ?? (assessments?.[0] ?? null)
  const isViewingHistory  = selectedPortfolioId !== null && viewedPortfolio !== null
  const totalInstruments  = activePortfolio.allocations.reduce((s, a) => s + (a.instruments?.length ?? 0), 0)

  // Dropdown için: assessment listesindeki her item portfolioId ile eşleşmeli
  // Current portfolio dropdown'da işaretli görünsün
  const dropdownSelected = selectedPortfolioId ?? currentPortfolio.portfolioId

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
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                📂 Viewing historical portfolio · {activeAssessment ? fmtDate(activeAssessment.completedAt) : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Portfolio history dropdown */}
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
                className="text-xs text-stone-500 hover:text-stone-700 underline underline-offset-2 transition-colors"
              >
                ← Back to current
              </button>
            )}

            <Button variant="secondary" size="sm" onClick={() => navigate('/compare')}>
              Compare Scenarios
            </Button>
          </div>
        </div>

        {/* ── Loading geçmiş portföy ── */}
        {loadingViewed && (
          <div className="flex items-center gap-2 text-sm text-stone-500 py-2">
            <Spinner size="sm" /> Loading historical portfolio…
          </div>
        )}

        {/* ── Profile Banner (questionnaire özeti) ── */}
        {!loadingViewed && activeAssessment && (
          <ProfileBanner assessment={activeAssessment} portfolio={activePortfolio} />
        )}

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Risk Profile"
            value={{ conservative: 'Conservative', balanced: 'Balanced', aggressive: 'Aggressive' }[activePortfolio.profileType]}
            sub={activePortfolio.profileType}
          />
          <StatCard
            label="Portfolio Score"
            value={activePortfolio.portfolioScore?.toFixed(1) ?? '—'}
            sub="Diversification index"
          />
          <StatCard
            label="Expected Volatility"
            value={`${activePortfolio.expectedVolatility?.toFixed(1) ?? '—'}%`}
            sub="Annualised std. dev."
          />
          <StatCard
            label="Selected Assets"
            value={String(totalInstruments)}
            sub={`${activePortfolio.allocations.length} asset classes`}
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

        <p className="text-xs text-stone-300 text-center">
          Generated: {fmtDateTime(activePortfolio.generatedAt)} · yfinance data (15 min cache)
        </p>
      </div>
    </AppLayout>
  )
}
