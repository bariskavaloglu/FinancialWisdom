import { useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Disclaimer, Spinner, Alert } from '@/components/ui/index'
import { useApi } from '@/hooks/useApi'
import { useThemeLang } from '@/context/ThemeLanguageContext'
import { portfolioService } from '@/services'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'
import type { Portfolio } from '@/types'

const ASSET_KEYS = ['BIST_EQUITY','SP500_EQUITY','COMMODITY','CRYPTOCURRENCY','CASH_EQUIVALENT'] as const

// ─── Portfolio Card ───────────────────────────────────────────────────────────

function PortfolioCard({
  portfolio, label, accentColor,
}: {
  portfolio: Portfolio
  label:     string
  accentColor: string
}) {
  const { t } = useThemeLang()

  const allInst    = portfolio.allocations.flatMap((a) => a.instruments ?? [])
  const totalInst  = allInst.length
  const avgFactor  = allInst.length
    ? Math.round(allInst.reduce((s, i) => s + (i.factorScore?.composite ?? 50), 0) / allInst.length)
    : null

  return (
    <div className="card space-y-4">
      {/* Label bar */}
      <div className="flex items-center gap-3">
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ background: accentColor }}
        />
        <p className="text-xs text-stone-400 dark:text-stone-500 uppercase tracking-widest font-semibold">{label}</p>
      </div>

      {/* Profile + horizon */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-stone-900 dark:text-stone-100 capitalize">
          {t(`profile.${portfolio.profileType}`)}
        </span>
        <span className="text-stone-300 dark:text-stone-600">·</span>
        <span className="text-sm text-stone-500 dark:text-stone-400">
          {t(`horizon.${portfolio.horizonType}`)}
        </span>
      </div>

      {/* Allocations */}
      <div className="space-y-2 pt-1">
        {portfolio.allocations.map((a) => (
          <div key={a.assetClass} className="flex items-center justify-between text-sm">
            <span className="text-stone-500 dark:text-stone-400 text-xs">{t(`asset.${a.assetClass}`)}</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${a.targetWeight}%`, background: accentColor }}
                />
              </div>
              <span className="text-stone-900 dark:text-stone-100 font-mono text-xs w-8 text-right">
                %{a.targetWeight}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Key metrics */}
      <div className="pt-3 border-t border-stone-200 dark:border-stone-700 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-stone-400 dark:text-stone-500">{t('compare.portfolioScore')}</p>
          <p className="text-stone-900 dark:text-stone-100 font-semibold text-base mt-0.5">
            {portfolio.portfolioScore?.toFixed(1) ?? '—'}
          </p>
        </div>
        <div>
          <p className="text-stone-400 dark:text-stone-500">{t('compare.volatility')}</p>
          <p className="text-stone-900 dark:text-stone-100 font-semibold text-base mt-0.5">
            %{portfolio.expectedVolatility?.toFixed(1) ?? '—'}
          </p>
        </div>
        <div>
          <p className="text-stone-400 dark:text-stone-500">{t('compare.instruments')}</p>
          <p className="text-stone-900 dark:text-stone-100 font-semibold text-base mt-0.5">
            {totalInst} {avgFactor != null ? <span className="text-xs text-stone-400">⌀{avgFactor}</span> : null}
          </p>
        </div>
      </div>

      {/* Explanation snippet */}
      {portfolio.explanation && (
        <p className="text-xs text-stone-500 dark:text-stone-400 italic border-t border-stone-100 dark:border-stone-800 pt-3 line-clamp-3">
          {portfolio.explanation}
        </p>
      )}
    </div>
  )
}

// ─── Winner Analysis ──────────────────────────────────────────────────────────

function WinnerBadge({ winner, label }: { winner: 'A' | 'B' | 'tie'; label: string }) {
  const colorA   = '#D97706'  // amber
  const colorB   = '#3B82F6'  // blue
  const isTie    = winner === 'tie'
  const color    = isTie ? '#6B7280' : winner === 'A' ? colorA : colorB
  const text     = isTie ? 'tie' : `${winner}`

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700">
      <span className="text-xs text-stone-600 dark:text-stone-300">{label}</span>
      <span
        className="text-xs font-bold px-2 py-0.5 rounded-full"
        style={{ background: `${color}20`, color }}
      >
        {text}
      </span>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const { t } = useThemeLang()
  const [selectedA, setSelectedA] = useState<string>('')
  const [selectedB, setSelectedB] = useState<string>('')
  const [compared,  setCompared]  = useState<[Portfolio, Portfolio] | null>(null)
  const [comparing, setComparing] = useState(false)
  const [compareError, setCompareError] = useState<string | null>(null)

  const { data: portfolios, isLoading } = useApi(() => portfolioService.list())

  const COLOR_A = '#D97706'   // amber
  const COLOR_B = '#3B82F6'   // blue

  const handleCompare = async () => {
    if (!selectedA || !selectedB || selectedA === selectedB) return
    setComparing(true); setCompareError(null)
    try {
      const [a, b] = await Promise.all([
        portfolioService.getById(selectedA),
        portfolioService.getById(selectedB),
      ])
      setCompared([a, b])
    } catch {
      setCompareError(t('compare.failed'))
    } finally {
      setComparing(false)
    }
  }

  // ── Radar data ──
  const radarData = compared
    ? ASSET_KEYS.map((cls) => ({
        subject: t(`asset.${cls}_SHORT`),
        A: compared[0].allocations.find((a) => a.assetClass === cls)?.targetWeight ?? 0,
        B: compared[1].allocations.find((a) => a.assetClass === cls)?.targetWeight ?? 0,
      }))
    : []

  // ── Bar data for full allocation ──
  const barData = compared
    ? ASSET_KEYS.map((cls) => ({
        name: t(`asset.${cls}_SHORT`),
        [t('compare.scenarioA')]: compared[0].allocations.find((a) => a.assetClass === cls)?.targetWeight ?? 0,
        [t('compare.scenarioB')]: compared[1].allocations.find((a) => a.assetClass === cls)?.targetWeight ?? 0,
      }))
    : []

  // ── Diff metrics ──
  const metrics = compared
    ? [
        {
          labelKey:  'compare.portfolioScore',
          a: compared[0].portfolioScore,
          b: compared[1].portfolioScore,
          fmt: (v: number) => v.toFixed(1),
          higherIsBetter: true,
        },
        {
          labelKey:  'compare.volatility',
          a: compared[0].expectedVolatility,
          b: compared[1].expectedVolatility,
          fmt: (v: number) => `%${v.toFixed(1)}`,
          higherIsBetter: false,
        },
      ]
    : []

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        {/* ── Header ── */}
        <div>
          <h1 className="font-display text-2xl font-medium text-stone-900 dark:text-stone-100 mb-1">
            {t('compare.title')}
          </h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm">{t('compare.subtitle')}</p>
        </div>

        {/* ── Selector card ── */}
        <div className="card space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : !portfolios?.length ? (
            <p className="text-stone-500 dark:text-stone-400 text-sm text-center py-4">{t('compare.noPortfolios')}</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { label: t('compare.scenarioA'), value: selectedA, set: setSelectedA, color: COLOR_A },
                { label: t('compare.scenarioB'), value: selectedB, set: setSelectedB, color: COLOR_B },
              ].map(({ label, value, set, color }) => (
                <div key={label}>
                  <label className="label flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                    {label}
                  </label>
                  <select
                    className="input"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                  >
                    <option value="">{t('compare.select')}</option>
                    {portfolios.map((p) => (
                      <option key={p.portfolioId} value={p.portfolioId}>
                        {t(`profile.${p.profileType}`)} / {t(`horizon.${p.horizonType}`)} · {new Date(p.generatedAt).toLocaleDateString('tr-TR')}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {compareError && <Alert variant="error">{compareError}</Alert>}

          <Button
            onClick={handleCompare}
            isLoading={comparing}
            disabled={!selectedA || !selectedB || selectedA === selectedB}
            className="w-full sm:w-auto"
          >
            {t('compare.compareBtn')}
          </Button>
        </div>

        {/* ── Empty state ── */}
        {!compared && !comparing && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center mb-4 text-2xl">⚖️</div>
            <p className="text-stone-400 dark:text-stone-500 text-sm">{t('compare.noComparison')}</p>
          </div>
        )}

        {/* ── Results ── */}
        {compared && (
          <div className="space-y-6 animate-fade-in">

            {/* Cards side by side */}
            <div className="grid md:grid-cols-2 gap-6">
              <PortfolioCard portfolio={compared[0]} label={t('compare.scenarioA')} accentColor={COLOR_A} />
              <PortfolioCard portfolio={compared[1]} label={t('compare.scenarioB')} accentColor={COLOR_B} />
            </div>

            {/* Winner Analysis */}
            <div className="card">
              <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-4">
                {t('compare.winners')}
              </h3>
              <div className="grid sm:grid-cols-2 gap-2">
                {metrics.map(({ labelKey, a, b, higherIsBetter }) => {
                  if (a == null || b == null) return null
                  const aBetter = higherIsBetter ? a > b : a < b
                  const bBetter = higherIsBetter ? b > a : b < a
                  const winner: 'A' | 'B' | 'tie' = aBetter ? 'A' : bBetter ? 'B' : 'tie'
                  return (
                    <WinnerBadge key={labelKey} winner={winner} label={t(labelKey)} />
                  )
                })}
              </div>
            </div>

            {/* Radar chart */}
            <div className="card">
              <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-4">
                {t('compare.radarTitle')}
              </h3>
              <div className="flex justify-center gap-6 mb-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-1 rounded-full inline-block" style={{ background: COLOR_A }} />
                  {t('compare.scenarioA')}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-1 rounded-full inline-block" style={{ background: COLOR_B }} />
                  {t('compare.scenarioB')}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(120,113,108,0.2)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#78716c', fontSize: 12 }} />
                  <Radar name={t('compare.scenarioA')} dataKey="A" stroke={COLOR_A} fill={COLOR_A} fillOpacity={0.2} strokeWidth={2} />
                  <Radar name={t('compare.scenarioB')} dataKey="B" stroke={COLOR_B} fill={COLOR_B} fillOpacity={0.2} strokeWidth={2} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 8 }}
                    formatter={(v: number) => [`%${v}`, '']}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Bar chart comparison */}
            <div className="card">
              <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-4">
                {t('compare.allocationBreakdown')}
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,113,108,0.1)" />
                  <XAxis dataKey="name" tick={{ fill: '#78716c', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#78716c', fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #e7e5e4', borderRadius: 8 }}
                    formatter={(v: number) => [`%${v}`, '']}
                  />
                  <Legend />
                  <Bar dataKey={t('compare.scenarioA')} fill={COLOR_A} radius={[4,4,0,0]} />
                  <Bar dataKey={t('compare.scenarioB')} fill={COLOR_B} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Diff table */}
            <div className="card overflow-x-auto">
              <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-4">
                {t('compare.diffTable')}
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-stone-400 dark:text-stone-500 border-b border-stone-200 dark:border-stone-700">
                    <th className="text-left pb-2 font-medium">{t('compare.metric')}</th>
                    <th className="text-right pb-2 font-medium" style={{ color: COLOR_A }}>{t('compare.scenarioA')}</th>
                    <th className="text-right pb-2 font-medium" style={{ color: COLOR_B }}>{t('compare.scenarioB')}</th>
                    <th className="text-right pb-2 font-medium text-stone-400 dark:text-stone-500">{t('compare.diff')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {metrics.map(({ labelKey, a, b, fmt, higherIsBetter }) => {
                    if (a == null || b == null) return null
                    const diff = b - a
                    const diffGood = higherIsBetter ? diff > 0 : diff < 0
                    const diffColor = diff === 0
                      ? 'text-stone-400 dark:text-stone-500'
                      : diffGood
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-500 dark:text-red-400'
                    return (
                      <tr key={labelKey}>
                        <td className="py-2.5 text-stone-600 dark:text-stone-300">{t(labelKey)}</td>
                        <td className="py-2.5 text-right font-medium" style={{ color: COLOR_A }}>{fmt(a)}</td>
                        <td className="py-2.5 text-right font-medium" style={{ color: COLOR_B }}>{fmt(b)}</td>
                        <td className={`py-2.5 text-right font-semibold ${diffColor}`}>
                          {diff > 0 ? '+' : ''}{fmt(diff)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <Disclaimer />
      </div>
    </AppLayout>
  )
}
