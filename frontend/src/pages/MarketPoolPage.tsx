import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Spinner } from '@/components/ui/index'
import { useApi } from '@/hooks/useApi'
import { useThemeLang } from '@/context/ThemeLanguageContext'
import { api } from '@/services/api'
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts'
import type { AssetClass } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PoolItem {
  ticker: string
  name: string
  assetClass: AssetClass
  exchange: string
  currency: string
  currentPrice: number
  dailyChange: number | null
  week52High: number | null
  week52Low: number | null
  dataPoints: number
  lastUpdated: string | null
  factorScore?: {
    momentum: number
    volatility: number
    composite: number
    calculatedAt: string
  } | null
}

interface PoolSnapshot {
  generatedAt: string
  usdtryRate: number
  period: string
  count: number
  items: PoolItem[]
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ASSET_CONFIG: Record<AssetClass, { label: string; color: string; bg: string; darkColor: string }> = {
  BIST_EQUITY:     { label: 'BIST',       color: '#f97316', darkColor: '#fb923c', bg: '#f9731615' },
  SP500_EQUITY:    { label: 'S&P 500',    color: '#3B82F6', darkColor: '#60a5fa', bg: '#3B82F615' },
  COMMODITY:       { label: 'Commodity',  color: '#22C55E', darkColor: '#4ade80', bg: '#22C55E15' },
  CRYPTOCURRENCY:  { label: 'Crypto',     color: '#A78BFA', darkColor: '#c4b5fd', bg: '#A78BFA15' },
  CASH_EQUIVALENT: { label: 'Cash',       color: '#6B7280', darkColor: '#d1d5db', bg: '#6B728015' },
}

const PERIODS = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '1y', label: '1Y' },
  { value: '2y', label: '2Y' },
]

const ALL_CLASSES: AssetClass[] = [
  'BIST_EQUITY', 'SP500_EQUITY', 'COMMODITY', 'CRYPTOCURRENCY', 'CASH_EQUIVALENT',
]

// ─── Subcomponents ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: string
}) {
  return (
    <div className="card">
      <p className="text-xs text-stone-400 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-display font-medium ${accent ?? 'text-stone-900 dark:text-stone-100'}`}>{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function AssetClassBadge({ assetClass }: { assetClass: AssetClass }) {
  const { theme } = useThemeLang()
  const cfg = ASSET_CONFIG[assetClass]
  const clr = theme === 'dark' ? cfg.darkColor : cfg.color
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full border font-medium whitespace-nowrap"
      style={{ color: clr, borderColor: `${clr}40`, background: cfg.bg }}
    >
      {cfg.label}
    </span>
  )
}

function ChangeCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-stone-300">—</span>
  const positive = value >= 0
  return (
    <span className={`font-medium text-sm ${positive ? 'text-green-600' : 'text-red-500'}`}>
      {positive ? '▲' : '▼'} {Math.abs(value).toFixed(2)}%
    </span>
  )
}

function DataQualityBar({ points }: { points: number }) {
  const pct = Math.min(100, Math.round((points / 252) * 100))
  const color = pct >= 80 ? '#22C55E' : pct >= 40 ? '#F59E0B' : '#EF4444'
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs text-stone-400 tabular-nums w-7">{points}d</span>
    </div>
  )
}

function FactorScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
        <div className="h-full bg-stone-700 dark:bg-stone-300 rounded-full" style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-stone-500 dark:text-stone-400 w-6 text-right tabular-nums">{score}</span>
    </div>
  )
}

// ─── Panel: Factor Score Chart across all tickers ─────────────────────────────

function FactorOverviewChart({ items }: { items: PoolItem[] }) {
  const { theme, t } = useThemeLang()
  const isDark = theme === 'dark'

  const data = items
    .filter(i => i.factorScore)
    .map(i => ({
      name: i.ticker.replace('.IS', '').replace('-USD', ''),
      score: i.factorScore!.composite,
      momentum: i.factorScore!.momentum,
      volatility: i.factorScore!.volatility,
      assetClass: i.assetClass,
    }))
    .sort((a, b) => b.score - a.score)

  if (!data.length) return null

  const gridColor  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'
  const tickColor  = isDark ? '#a8a29e' : '#78716c'
  const tipStyle   = {
    background:   isDark ? '#1c1917' : '#fff',
    border:       isDark ? '1px solid #44403c' : '1px solid #e7e5e4',
    borderRadius: 8,
    fontSize:     12,
  }

  return (
    <div className="card">
      <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-4">
        {t('chart.factorScore').split('(')[0].trim()}
      </h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barSize={22} margin={{ left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="name" tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={tipStyle}
            formatter={(v: number, name: string) => [v.toFixed(1), name.charAt(0).toLocaleUpperCase('en-US') + name.slice(1)]}
          />
          <Bar dataKey="score" radius={[4, 4, 0, 0]} {name={t("pool.compositeName")}>
            {data.map((d, i) => {
              const cfg = ASSET_CONFIG[d.assetClass]
              return <Cell key={i} fill={isDark ? cfg.darkColor : cfg.color} />
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {ALL_CLASSES.map(cls => {
          const cfg = ASSET_CONFIG[cls]
          const hasData = data.some(d => d.assetClass === cls)
          if (!hasData) return null
          return (
            <div key={cls} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: isDark ? cfg.darkColor : cfg.color }} />
              <span className="text-xs text-stone-500 dark:text-stone-400">{cfg.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Panel: Daily change mini heat strip ─────────────────────────────────────

function DailyChangeHeatmap({ items }: { items: PoolItem[] }) {
  const { t } = useThemeLang()
  const sorted = [...items].sort((a, b) => (b.dailyChange ?? 0) - (a.dailyChange ?? 0))
  return (
    <div className="card">
      <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-4">
        {t('pool.dailyChange')} — {t('pool.allInstruments')}
      </h3>
      <div className="flex flex-wrap gap-2">
        {sorted.map(item => {
          const chg = item.dailyChange ?? 0
          const intensity = Math.min(Math.abs(chg) / 3, 1)
          const bg = chg > 0
            ? `rgba(34,197,94,${0.1 + intensity * 0.5})`
            : chg < 0
              ? `rgba(239,68,68,${0.1 + intensity * 0.5})`
              : 'rgba(107,114,128,0.1)'
          const textColor = chg > 0 ? '#15803d' : chg < 0 ? '#b91c1c' : '#6b7280'
          return (
            <div
              key={item.ticker}
              className="px-3 py-2 rounded-lg text-center min-w-[72px] transition-all hover:scale-105 cursor-default"
              style={{ background: bg }}
              title={`${item.name}: ${item.dailyChange?.toFixed(2) ?? '—'}%`}
            >
              <div className="text-xs font-mono font-medium text-stone-700 dark:text-stone-300">
                {item.ticker.replace('.IS', '').replace('-USD', '')}
              </div>
              <div className="text-sm font-semibold mt-0.5" style={{ color: textColor }}>
                {item.dailyChange !== null
                  ? `${item.dailyChange >= 0 ? '+' : ''}${item.dailyChange.toFixed(2)}%`
                  : '—'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Table ───────────────────────────────────────────────────────────────

type SortKey = 'ticker' | 'currentPrice' | 'dailyChange' | 'dataPoints' | 'composite'
type SortDir = 'asc' | 'desc'

function PoolTable({
  items,
  onSelectTicker,
  selectedTicker,
}: {
  items: PoolItem[]
  onSelectTicker: (t: string) => void
  selectedTicker: string | null
}) {
  const navigate = useNavigate()
  const { t } = useThemeLang()
  const [sortKey, setSortKey]   = useState<SortKey>('assetClass' as SortKey)
  const [sortDir, setSortDir]   = useState<SortDir>('asc')

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      let av: number | string, bv: number | string
      if (sortKey === 'ticker')       { av = a.ticker;       bv = b.ticker }
      else if (sortKey === 'currentPrice') { av = a.currentPrice; bv = b.currentPrice }
      else if (sortKey === 'dailyChange')  { av = a.dailyChange ?? -999; bv = b.dailyChange ?? -999 }
      else if (sortKey === 'dataPoints')   { av = a.dataPoints;   bv = b.dataPoints }
      else if (sortKey === 'composite')    { av = a.factorScore?.composite ?? -1; bv = b.factorScore?.composite ?? -1 }
      else { av = a.assetClass; bv = b.assetClass }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [items, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? <span className="ml-1 opacity-50">{sortDir === 'asc' ? '↑' : '↓'}</span> : null

  const thClass = "text-left pb-3 pr-4 text-xs text-stone-400 dark:text-stone-500 uppercase tracking-wider cursor-pointer hover:text-stone-600 dark:hover:text-stone-300 transition-colors select-none"

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-stone-500 uppercase tracking-widest">
          {t('pool.allInstruments')} ({items.length})
        </h3>
        <button
          className="text-xs text-amber-700 hover:underline"
          onClick={() => {
            const rows = items.map(i =>
              [i.ticker, i.name, i.assetClass, i.currentPrice, i.dailyChange ?? '', i.dataPoints, i.factorScore?.composite ?? ''].join(',')
            )
            const csv = ['Ticker,Name,Asset Class,Price (USD),Daily Change %,Data Points,Factor Score', ...rows].join('\n')
            const a = document.createElement('a')
            a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
            a.download = 'market_pool.csv'
            a.click()
          }}
        >
          ↓ CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 dark:border-stone-700">
              <th className={thClass} onClick={() => handleSort('ticker')}>{t('chart.instrument')} <SortIcon k="ticker" /></th>
              <th className={`${thClass} hidden sm:table-cell`}>{t('chart.class')}</th>
              <th className={`${thClass} hidden md:table-cell`}>{t('pool.exchange')}</th>
              <th className={`${thClass} text-right`} onClick={() => handleSort('currentPrice')}>
                {t('pool.price')} <SortIcon k="currentPrice" />
              </th>
              <th className={`${thClass} text-right`} onClick={() => handleSort('dailyChange')}>
                {t('pool.dailyChg')} <SortIcon k="dailyChange" />
              </th>
              <th className={`${thClass} hidden lg:table-cell`}>{t('pool.range52w')}</th>
              <th className={`${thClass} hidden xl:table-cell`} onClick={() => handleSort('dataPoints')}>
                {t('pool.data')} <SortIcon k="dataPoints" />
              </th>
              <th className={`${thClass} hidden lg:table-cell`} onClick={() => handleSort('composite')}>
                {t('pool.factor')} <SortIcon k="composite" />
              </th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
            {sorted.map(item => {
              const isSelected = item.ticker === selectedTicker
              const week52Pct = item.week52High && item.week52Low && item.week52High !== item.week52Low
                ? Math.round(((item.currentPrice - item.week52Low) / (item.week52High - item.week52Low)) * 100)
                : null

              return (
                <tr
                  key={item.ticker}
                  className={`hover:bg-stone-50/50 transition-colors cursor-pointer ${isSelected ? 'bg-amber-50/50' : ''}`}
                  onClick={() => onSelectTicker(item.ticker)}
                >
                  <td className="py-3 pr-4">
                    <p className="font-medium text-stone-900 dark:text-stone-100">{item.ticker}</p>
                    <p className="text-xs text-stone-400 truncate max-w-[140px]">{item.name}</p>
                  </td>
                  <td className="py-3 pr-4 hidden sm:table-cell">
                    <AssetClassBadge assetClass={item.assetClass} />
                  </td>
                  <td className="py-3 pr-4 text-xs text-stone-400 hidden md:table-cell">
                    {item.exchange}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <span className="font-mono text-stone-900 dark:text-stone-100 font-medium">
                      ${item.currentPrice > 0 ? item.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <ChangeCell value={item.dailyChange} />
                  </td>
                  <td className="py-3 pr-4 hidden lg:table-cell">
                    {week52Pct !== null ? (
                      <div className="flex flex-col gap-0.5">
                        <div className="w-20 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <div className="h-full bg-stone-400 rounded-full" style={{ width: `${week52Pct}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-stone-300 tabular-nums">
                          <span>${item.week52Low?.toFixed(0)}</span>
                          <span>${item.week52High?.toFixed(0)}</span>
                        </div>
                      </div>
                    ) : <span className="text-stone-300 text-xs">—</span>}
                  </td>
                  <td className="py-3 pr-4 hidden xl:table-cell">
                    <DataQualityBar points={item.dataPoints} />
                  </td>
                  <td className="py-3 pr-4 hidden lg:table-cell">
                    {item.factorScore
                      ? <FactorScoreBar score={item.factorScore.composite} />
                      : <span className="text-stone-300 text-xs">—</span>}
                  </td>
                  <td className="py-3 pl-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/instrument/${encodeURIComponent(item.ticker)}`) }}
                      className="text-xs text-amber-700 dark:text-amber-400 hover:underline px-2 py-1 border border-amber-200 dark:border-amber-700 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 whitespace-nowrap"
                    >
                      {t('chart.detail')} →
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

// ─── Ticker Detail Drawer ─────────────────────────────────────────────────────

function TickerDrawer({ ticker, period, onClose }: {
  ticker: string | null
  period: string
  onClose: () => void
}) {
  const { theme } = useThemeLang()
  const isDark = theme === 'dark'
  const { data, isLoading } = useApi(
    () => ticker ? api.get(`/pool/${ticker}?period=${period}`).then(r => r.data) : Promise.resolve(null),
    [ticker, period]
  )

  if (!ticker) return null

  // Recharts area chart data
  const chartData = data?.history
    ? data.history.slice(-90).map((p: { date: string; close: number }) => ({
        date: p.date.slice(5),   // "MM-DD"
        close: p.close,
      }))
    : []

  const meta: { assetClass?: string; exchange?: string; name?: string } = {}

  return (
    <div className="fixed inset-0 z-40 flex justify-end pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-stone-900/20 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="relative w-full max-w-md bg-white dark:bg-stone-900 border-l border-stone-200 dark:border-stone-700 shadow-2xl pointer-events-auto flex flex-col animate-[slideIn_0.2s_ease-out]">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-stone-100 dark:border-stone-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <AssetClassBadge assetClass={(meta.assetClass as AssetClass) ?? 'SP500_EQUITY'} />
              <span className="text-xs text-stone-400">{meta.exchange}</span>
            </div>
            <h2 className="text-xl font-display font-bold text-stone-900 dark:text-stone-100">{ticker}</h2>
            <p className="text-sm text-stone-400">{meta.name ?? ticker}</p>
          </div>
          <button onClick={onClose} className="text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-200 transition-colors text-xl leading-none mt-1">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {isLoading ? (
            <div className="flex justify-center py-10"><Spinner size="lg" /></div>
          ) : data ? (
            <>
              {/* Price + change */}
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-display font-bold text-stone-900 dark:text-stone-100">
                    ${data.currentPrice?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}
                  </p>
                  <div className="mt-0.5"><ChangeCell value={data.dailyChange} /></div>
                </div>
                <div className="text-right text-xs text-stone-400">
                  <p>{data.history?.length ?? 0} {t('pool.dataPoints')}</p>
                  <p>{t('common.current')}: {data.history?.at(-1)?.date ?? '—'}</p>
                </div>
              </div>

              {/* Mini chart */}
              {chartData.length > 0 && (
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-widest mb-2">{t('pool.priceLast90')}</p>
                  <ResponsiveContainer width="100%" height={130}>
                    <AreaChart data={chartData} margin={{ left: -20 }}>
                      <defs>
                        <linearGradient id={`grad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={isDark ? '#d6d3d1' : '#1c1917'} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={isDark ? '#d6d3d1' : '#1c1917'} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                      <XAxis dataKey="date" tick={{ fill: '#a8a29e', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: '#a8a29e', fontSize: 9 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                      <Tooltip
                        contentStyle={{ background: isDark ? '#1c1917' : '#fff', border: isDark ? '1px solid #44403c' : '1px solid #e7e5e4', borderRadius: 8, fontSize: 11 }}
                        formatter={(v: number) => [`$${v.toFixed(2)}`, t('pool.price')]}
                      />
                      <Area type="monotone" dataKey="close" stroke={isDark ? '#d6d3d1' : '#1c1917'} strokeWidth={1.5} fill={`url(#grad-${ticker})`} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Factor scores */}
              {data.factorScore && (
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-widest mb-3">{t('pool.factorScores')}</p>
                  <div className="space-y-2.5">
                    {(['momentum', 'volatility', 'composite'] as const).map(key => {
                      const keyLabel = key === 'momentum' ? t('dash.momentum') :
                                       key === 'volatility' ? t('stat.expectedVolatility').split(' ')[0] :
                                       t('pool.compositeName')
                      return (
                      <div key={key} className="flex items-center justify-between gap-3">
                        <span className="text-sm text-stone-500 dark:text-stone-400">{keyLabel}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-28 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${data.factorScore[key]}%`,
                                background: key === 'composite' ? '#1c1917' : key === 'momentum' ? '#3B82F6' : '#22C55E',
                              }}
                            />
                          </div>
                          <span className="text-xs text-stone-500 w-7 text-right tabular-nums">
                            {data.factorScore[key].toFixed(0)}
                          </span>
                        </div>
                      </div>
                    )})}
                  </div>
                </div>
              )}

              {/* 52W range */}
              {data.history && data.history.length > 0 && (() => {
                const highs  = data.history.map((p: { high: number }) => p.high)
                const lows   = data.history.map((p: { low: number }) => p.low)
                const h52    = Math.max(...highs)
                const l52    = Math.min(...lows)
                const pct    = h52 !== l52 ? Math.round(((data.currentPrice - l52) / (h52 - l52)) * 100) : 0
                return (
                  <div>
                    <p className="text-xs text-stone-400 uppercase tracking-widest mb-3">{t('pool.range52wTitle')}</p>
                    <div className="space-y-1.5">
                      <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-stone-900 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-stone-400 tabular-nums">
                        <span>${l52.toFixed(2)}</span>
                        <span className="text-stone-600 dark:text-stone-400 font-medium">{pct}%</span>
                        <span>${h52.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </>
          ) : (
            <p className="text-stone-400 text-sm text-center py-8">{t('pool.noData')}</p>
          )}
        </div>

        <div className="p-4 border-t border-stone-100 dark:border-stone-800">
          <a
            href={`/instrument/${encodeURIComponent(ticker)}`}
            className="btn-secondary w-full text-sm justify-center"
          >
            {t('pool.fullDetail')}
          </a>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MarketPoolPage() {
  const [period, setPeriod]             = useState('1y')
  const [filterClass, setFilterClass]   = useState<AssetClass | 'ALL'>('ALL')
  const [search, setSearch]             = useState('')
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const { t, theme } = useThemeLang()

  const { data, isLoading, error } = useApi<PoolSnapshot>(
    () => {
      const params = new URLSearchParams({ period })
      if (filterClass !== 'ALL') params.set('asset_class', filterClass)
      return api.get(`/pool?${params}`).then(r => r.data)
    },
    [period, filterClass]
  )

  const items = useMemo(() => {
    if (!data?.items) return []
    if (!search) return data.items
    const q = search.toLowerCase()
    return data.items.filter(i =>
      i.ticker.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)
    )
  }, [data, search])

  // Summary stats
  const gainers   = items.filter(i => (i.dailyChange ?? 0) > 0).length
  const losers    = items.filter(i => (i.dailyChange ?? 0) < 0).length
  const avgScore  = items.filter(i => i.factorScore).length > 0
    ? Math.round(items.filter(i => i.factorScore).reduce((s, i) => s + (i.factorScore!.composite), 0) / items.filter(i => i.factorScore).length)
    : null
  const totalPoints = items.reduce((s, i) => s + i.dataPoints, 0)

  return (
    <AppLayout>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>

      <div className="space-y-6 animate-fade-in">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-stone-900 dark:text-stone-100">{t('pool.title')}</h1>
            <p className="text-sm text-stone-400 mt-0.5">
              {data?.count ?? '—'} instruments · USDTRY {data?.usdtryRate?.toFixed(2) ?? '—'} ·{' '}
              {data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}
            </p>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-lg">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  period === p.value
                    ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm'
                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label={t('pool.totalInstruments')} value={String(data?.count ?? '—')} sub={`${period.toLocaleUpperCase('en-US')} ${t('common.period')}`} />
          <StatCard
            label={t('pool.gainersLosers')}
            value={`${gainers} / ${losers}`}
            sub={t('pool.dailyChange')}
            accent={gainers > losers ? 'text-green-600' : 'text-red-500'}
          />
          <StatCard
            label={t('pool.avgFactorScore')}
            value={avgScore !== null ? String(avgScore) : '—'}
            sub={t('pool.composite')}
          />
          <StatCard
            label={t('pool.totalDataPoints')}
            value={totalPoints > 1000 ? `${(totalPoints / 1000).toFixed(1)}k` : String(totalPoints)}
            sub={t('pool.cachedRows')}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">⌕</span>
            <input
              type="text"
              placeholder={t('pool.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-8 py-2 text-sm w-52"
            />
          </div>

          {/* Asset class pills */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterClass('ALL')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                filterClass === 'ALL'
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-white dark:bg-stone-900 text-stone-500 dark:text-stone-400 border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-500'
              }`}
            >
              All
            </button>
            {ALL_CLASSES.map(cls => {
              const cfg = ASSET_CONFIG[cls]
              const active = filterClass === cls
              const clr = theme === 'dark' ? cfg.darkColor : cfg.color
              return (
                <button
                  key={cls}
                  onClick={() => setFilterClass(active ? 'ALL' : cls)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                  style={active
                    ? { background: clr, color: '#fff', borderColor: clr }
                    : { background: 'transparent', color: clr, borderColor: `${clr}80` }
                  }
                >
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Loading / Error */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <Spinner size="lg" />
              <p className="text-stone-400 text-sm">{t('pool.fetching')}</p>
            </div>
          </div>
        )}

        {!isLoading && error && (
          <div className="card text-center py-10">
            <p className="text-stone-400">{t('pool.error')}</p>
          </div>
        )}

        {!isLoading && data && (
          <>
            {/* Charts row */}
            <div className="grid lg:grid-cols-2 gap-6">
              <DailyChangeHeatmap items={items} />
              <FactorOverviewChart items={items} />
            </div>

            {/* Main table */}
            <PoolTable
              items={items}
              onSelectTicker={t => setSelectedTicker(t === selectedTicker ? null : t)}
              selectedTicker={selectedTicker}
            />

            <p className="text-xs text-stone-300 text-center">
              {t('pool.footer')}
            </p>
          </>
        )}
      </div>

      {/* Ticker drawer */}
      <TickerDrawer
        ticker={selectedTicker}
        period={period}
        onClose={() => setSelectedTicker(null)}
      />
    </AppLayout>
  )
}
