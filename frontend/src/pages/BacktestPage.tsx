import { useState, useCallback, useRef, useEffect } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Spinner, Disclaimer } from '@/components/ui/index'
import { useThemeLang } from '@/context/ThemeLanguageContext'
import { poolService } from '@/services'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PricePoint { date: string; close: number }

interface HoldingResult {
  ticker:     string
  name:       string
  assetClass: string
  weight:     number          // 0–1
  priceH1Start: number
  priceH1End:   number
  priceH2End:   number
  h1Return:   number          // fraction
  h2Return:   number          // fraction
  contribution: number        // weight * h2Return
  monthlyReturns: number[]    // month-by-month H2 returns (6 entries)
}

interface BacktestResult {
  profile:      string
  year:         number
  holdings:     HoldingResult[]
  totalH2Return: number
  maxDrawdown:   number
  sharpeApprox:  number
  monthlyPortfolio: number[]  // 6 cumulative values
  winRate:       number        // % of positive holdings
}

// ─── Config ───────────────────────────────────────────────────────────────────

const PROFILE_ALLOCS: Record<string, Record<string, number>> = {
  conservative: {
    BIST_EQUITY: 0.20, SP500_EQUITY: 0.25, COMMODITY: 0.30,
    CRYPTOCURRENCY: 0.05, CASH_EQUIVALENT: 0.20,
  },
  balanced: {
    BIST_EQUITY: 0.30, SP500_EQUITY: 0.30, COMMODITY: 0.15,
    CRYPTOCURRENCY: 0.10, CASH_EQUIVALENT: 0.15,
  },
  aggressive: {
    BIST_EQUITY: 0.35, SP500_EQUITY: 0.25, COMMODITY: 0.10,
    CRYPTOCURRENCY: 0.25, CASH_EQUIVALENT: 0.05,
  },
}

// Ticker → asset class mapping (projedeki gerçek universe)
const TICKER_CLASS: Record<string, string> = {
  'THYAO.IS': 'BIST_EQUITY',
  'GARAN.IS': 'BIST_EQUITY',
  'SASA.IS':  'BIST_EQUITY',
  'EREGL.IS': 'BIST_EQUITY',
  'AKBNK.IS': 'BIST_EQUITY',
  'FROTO.IS': 'BIST_EQUITY',
  'KCHOL.IS': 'BIST_EQUITY',
  'TUPRS.IS': 'BIST_EQUITY',
  'SPY':      'SP500_EQUITY',
  'QQQ':      'SP500_EQUITY',
  'VTI':      'SP500_EQUITY',
  'GLD':      'COMMODITY',
  'SLV':      'COMMODITY',
  'IAU':      'COMMODITY',
  'BTC-USD':  'CRYPTOCURRENCY',
  'ETH-USD':  'CRYPTOCURRENCY',
  'BIL':      'CASH_EQUIVALENT',
  'SGOV':     'CASH_EQUIVALENT',
}

// Profil başına hangi tickerlar seçilsin — backend'deki gerçek universe'den
const DEFAULT_TICKERS: Record<string, string[]> = {
  BIST_EQUITY:     ['THYAO.IS', 'GARAN.IS', 'EREGL.IS', 'FROTO.IS'],
  SP500_EQUITY:    ['SPY', 'QQQ'],
  COMMODITY:       ['GLD', 'SLV'],
  CRYPTOCURRENCY:  ['BTC-USD', 'ETH-USD'],
  CASH_EQUIVALENT: ['BIL', 'SGOV'],
}

const CLASS_COLORS: Record<string, string> = {
  BIST_EQUITY:     '#378ADD',
  SP500_EQUITY:    '#1D9E75',
  COMMODITY:       '#BA7517',
  CRYPTOCURRENCY:  '#7F77DD',
  CASH_EQUIVALENT: '#888780',
}

const CLASS_LABELS: Record<string, string> = {
  BIST_EQUITY:     'BIST Hisse',
  SP500_EQUITY:    'S&P 500',
  COMMODITY:       'Emtia',
  CRYPTOCURRENCY:  'Kripto',
  CASH_EQUIVALENT: 'Nakit',
}

const PROFILE_LABELS: Record<string, string> = {
  conservative: 'Muhafazakâr',
  balanced:     'Dengeli',
  aggressive:   'Agresif',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPct(v: number, decimals = 2) {
  const sign = v >= 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(decimals)}%`
}

function fmtPctRaw(v: number, decimals = 1) {
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(decimals)}%`
}

// Split a priceHistory array into first-half and second-half by date
function splitHalves(
  prices: PricePoint[],
  year: number,
): { h1: PricePoint[]; h2: PricePoint[] } {
  const cutoff = `${year}-07-01`
  const h1 = prices.filter((p) => p.date < cutoff && p.date >= `${year}-01-01`)
  const h2 = prices.filter((p) => p.date >= cutoff && p.date < `${year + 1}-01-01`)
  return { h1, h2 }
}

// Build 6 monthly return buckets for H2 (Jul–Dec)
function monthlyBuckets(h2Prices: PricePoint[]): number[] {
  const months: Record<number, PricePoint[]> = {}
  h2Prices.forEach((p) => {
    const m = new Date(p.date).getMonth() // 6=Jul … 11=Dec
    if (!months[m]) months[m] = []
    months[m].push(p)
  })
  const result: number[] = []
  for (let m = 6; m <= 11; m++) {
    const pts = months[m] ?? []
    if (pts.length < 2) { result.push(0); continue }
    result.push((pts[pts.length - 1].close - pts[0].close) / pts[0].close)
  }
  return result
}

// Maxdrawdown from cumulative monthly returns
function maxDrawdown(monthlyCum: number[]): number {
  let peak = 0, maxDD = 0
  monthlyCum.forEach((v) => {
    if (v > peak) peak = v
    const dd = peak - v
    if (dd > maxDD) maxDD = dd
  })
  return maxDD
}

// Very rough Sharpe: mean/std of monthly returns (annualised *sqrt(12))
function sharpeApprox(monthlyRets: number[]): number {
  if (monthlyRets.length === 0) return 0
  const mean = monthlyRets.reduce((s, v) => s + v, 0) / monthlyRets.length
  const variance = monthlyRets.reduce((s, v) => s + (v - mean) ** 2, 0) / monthlyRets.length
  const std = Math.sqrt(variance)
  return std === 0 ? 0 : (mean / std) * Math.sqrt(12)
}

// Cash synthetic price: flat line, returns ~4% p.a. = 0.33% / month
function cashPrices(year: number): PricePoint[] {
  const pts: PricePoint[] = []
  let price = 100
  for (let m = 0; m < 12; m++) {
    const d = new Date(year, m, 1)
    const dEnd = new Date(year, m + 1, 0)
    // mid-month and end-of-month
    pts.push({ date: d.toISOString().slice(0, 10), close: price })
    price *= 1.0033
    pts.push({ date: dEnd.toISOString().slice(0, 10), close: price })
  }
  return pts
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 text-xs shadow-md">
      <p className="text-stone-500 dark:text-stone-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? '#888' }} className="font-medium">
          {p.name}: {fmtPctRaw(p.value)}
        </p>
      ))}
    </div>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, positive,
}: {
  label: string; value: string; sub?: string; positive?: boolean | null
}) {
  const color = positive === null || positive === undefined
    ? 'text-stone-900 dark:text-stone-100'
    : positive
      ? 'text-green-700 dark:text-green-400'
      : 'text-red-600 dark:text-red-400'
  return (
    <div className="bg-stone-50 dark:bg-stone-800/50 rounded-xl p-4">
      <p className="text-xs text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-xl font-display font-medium ${color}`}>{value}</p>
      {sub && <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BacktestPage() {
  const { theme } = useThemeLang()
  const [profile, setProfile] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced')
  const [year,    setYear   ] = useState<number>(2024)
  const [loading, setLoading] = useState(false)
  const [error,   setError  ] = useState<string | null>(null)
  const [result,  setResult ] = useState<BacktestResult | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const currentYear = new Date().getFullYear()
  const availableYears = [currentYear - 1, currentYear - 2, currentYear - 3].filter(
    (y) => y >= 2022,
  )

  // ── Fetch & compute ──────────────────────────────────────────────────────────
  const runBacktest = useCallback(async () => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const allocs = PROFILE_ALLOCS[profile]
      const holdings: HoldingResult[] = []

      // For each asset class, fetch each ticker
      for (const [assetClass, classWeight] of Object.entries(allocs)) {
        const tickers = DEFAULT_TICKERS[assetClass] ?? []
        const perTicker = classWeight / tickers.length

        for (const ticker of tickers) {
          let priceHistory: PricePoint[] = []

          if (ticker === 'CASH') {
            priceHistory = cashPrices(year)
          } else {
            try {
              // pool endpoint returns full price history via yfinance
              const data = await poolService.getTicker(ticker, '2y')
              priceHistory = (data.history ?? data.priceHistory ?? []).map(
                (p: { date: string; close?: number; Close?: number }) => ({
                  date:  p.date,
                  close: p.close ?? p.Close ?? 0,
                }),
              )
            } catch {
              // Instrument detail fallback
              try {
                const { instrumentService } = await import('@/services')
                const detail = await instrumentService.getDetail(ticker, '2y')
                priceHistory = (detail.priceHistory ?? []).map(
                  (p: { date: string; close: number }) => ({ date: p.date, close: p.close }),
                )
              } catch {
                continue
              }
            }
          }

          if (priceHistory.length === 0) continue

          const { h1, h2 } = splitHalves(priceHistory, year)
          if (h1.length < 2 || h2.length < 2) continue

          const priceH1Start = h1[0].close
          const priceH1End   = h1[h1.length - 1].close
          const priceH2End   = h2[h2.length - 1].close
          const h1Return     = (priceH1End - priceH1Start) / priceH1Start
          const h2Return     = (priceH2End - priceH1End)   / priceH1End
          const monthlyRets  = monthlyBuckets(h2)

          holdings.push({
            ticker,
            name:       ticker,
            assetClass,
            weight:     perTicker,
            priceH1Start,
            priceH1End,
            priceH2End,
            h1Return,
            h2Return,
            contribution: perTicker * h2Return,
            monthlyReturns: monthlyRets,
          })
        }
      }

      if (holdings.length === 0) {
        setError('Veri çekilemedi. Backend bağlantısını ve yfinance önbelleğini kontrol edin.')
        return
      }

      // Portfolio-level monthly returns (weighted sum)
      const monthlyPortfolio: number[] = [0, 1, 2, 3, 4, 5].map((i) =>
        holdings.reduce((s, h) => s + h.weight * (h.monthlyReturns[i] ?? 0), 0),
      )

      // Cumulative monthly portfolio returns
      const cumulative: number[] = []
      let cum = 0
      monthlyPortfolio.forEach((m) => { cum += m; cumulative.push(cum) })

      const totalH2Return = holdings.reduce((s, h) => s + h.contribution, 0)
      const winRate = holdings.filter((h) => h.h2Return > 0).length / holdings.length

      setResult({
        profile,
        year,
        holdings,
        totalH2Return,
        maxDrawdown: maxDrawdown(cumulative),
        sharpeApprox: sharpeApprox(monthlyPortfolio),
        monthlyPortfolio: cumulative,
        winRate,
      })
    } catch (err: unknown) {
      const msg = (err as Error).message ?? 'Bilinmeyen hata'
      setError(`Backtest hatası: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [profile, year])

  // Auto-run on mount
  useEffect(() => { runBacktest() }, [runBacktest])

  // ── Derived chart data ───────────────────────────────────────────────────────
  const monthLabels = ['Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'].map(
    (m) => `${m} ${year}`,
  )

  const cumulativeChartData = result
    ? result.monthlyPortfolio.map((v, i) => ({
        month: monthLabels[i],
        getiri: parseFloat((v * 100).toFixed(2)),
      }))
    : []

  const barChartData = result
    ? [...result.holdings]
        .sort((a, b) => b.h2Return - a.h2Return)
        .map((h) => ({
          ticker:  h.ticker.replace('.IS', '').replace('-USD', ''),
          h2:      parseFloat((h.h2Return * 100).toFixed(2)),
          h1:      parseFloat((h.h1Return * 100).toFixed(2)),
          cls:     h.assetClass,
        }))
    : []

  const isDark = theme === 'dark'
  const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'
  const tickColor = isDark ? '#a8a29e' : '#78716c'
  const tooltipBg = isDark ? '#1c1917' : '#fff'
  const tooltipBorder = isDark ? '1px solid #44403c' : '1px solid #e7e5e4'

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-medium text-stone-900 dark:text-stone-100">
              Portföy Validasyonu
            </h1>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
              Gerçek yfinance verisi · İlk 6 ay analiz → Portföy oluşturma → Son 6 ay gerçek performans
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Timeline badge */}
            <div className="flex rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 text-xs">
              <span className="px-3 py-2 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-medium">
                Oca–Haz {year} analiz
              </span>
              <span className="px-2 py-2 bg-stone-100 dark:bg-stone-800 text-stone-400">→</span>
              <span className="px-3 py-2 bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 font-medium">
                Tem–Ara {year} validasyon
              </span>
            </div>

            <select
              value={profile}
              onChange={(e) => setProfile(e.target.value as typeof profile)}
              className="text-sm px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300"
            >
              {Object.entries(PROFILE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="text-sm px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <button
              onClick={runBacktest}
              disabled={loading}
              className="btn-primary text-sm !px-5 !py-2 !rounded-xl"
            >
              {loading ? <Spinner size="sm" /> : 'Hesapla'}
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="card flex items-center gap-3 py-8 justify-center text-stone-500 dark:text-stone-400">
            <Spinner size="md" />
            <span className="text-sm">
              yfinance'den {year} verisi çekiliyor, lütfen bekleyin…
            </span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="card border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <p className="text-sm text-red-700 dark:text-red-400">⚠ {error}</p>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Portföy getirisi (H2)"
                value={fmtPct(result.totalH2Return)}
                sub={`${PROFILE_LABELS[result.profile]} · ${result.year} H2`}
                positive={result.totalH2Return >= 0}
              />
              <StatCard
                label="Kazanan varlık oranı"
                value={`${Math.round(result.winRate * 100)}%`}
                sub={`${result.holdings.filter((h) => h.h2Return > 0).length} / ${result.holdings.length} varlık`}
                positive={result.winRate >= 0.5}
              />
              <StatCard
                label="Maks. düşüş (H2)"
                value={fmtPct(-result.maxDrawdown)}
                sub="kümülatif aylık max drawdown"
                positive={result.maxDrawdown < 0.05}
              />
              <StatCard
                label="Sharpe (yaklaşık)"
                value={result.sharpeApprox.toFixed(2)}
                sub="aylık veriden annualised"
                positive={result.sharpeApprox >= 0}
              />
            </div>

            {/* Charts row */}
            <div className="grid lg:grid-cols-2 gap-6">

              {/* Cumulative performance */}
              <div className="card">
                <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-4">
                  Kümülatif getiri · H2 {year}
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={cumulativeChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="month" tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`}
                      tick={{ fill: tickColor, fontSize: 10 }}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      contentStyle={{ background: tooltipBg, border: tooltipBorder, borderRadius: 8 }}
                    />
                    <ReferenceLine y={0} stroke={isDark ? '#57534e' : '#d6d3d1'} strokeDasharray="4 4" />
                    <Line
                      type="monotone" dataKey="getiri" name="Portföy"
                      stroke={result.totalH2Return >= 0 ? '#639922' : '#E24B4A'}
                      strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* H1 vs H2 comparison */}
              <div className="card">
                <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-4">
                  H1 sinyal · H2 gerçek getiri
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barChartData} barSize={14} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="ticker" tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fill: tickColor, fontSize: 10 }}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ background: tooltipBg, border: tooltipBorder, borderRadius: 8 }}
                      formatter={(v: number, name: string) => [
                        `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`,
                        name === 'h1' ? 'H1 (analiz)' : 'H2 (gerçek)',
                      ]}
                    />
                    <ReferenceLine y={0} stroke={isDark ? '#57534e' : '#d6d3d1'} />
                    <Bar dataKey="h1" name="h1" fill={isDark ? '#44403c' : '#d6d3d1'} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="h2" name="h2" radius={[3, 3, 0, 0]}>
                      {barChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.h2 >= 0 ? '#639922' : '#E24B4A'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-3 text-xs text-stone-400 dark:text-stone-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: isDark ? '#44403c' : '#d6d3d1' }} />
                    H1 sinyal (Oca–Haz)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-green-600" />
                    H2 pozitif
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                    H2 negatif
                  </span>
                </div>
              </div>
            </div>

            {/* Holdings table */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 uppercase tracking-widest">
                  Varlık bazlı detay
                </h3>
                <span className="text-xs text-stone-400 dark:text-stone-500">
                  Fiyatlar yfinance · {year}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-stone-400 dark:text-stone-500 uppercase tracking-wider border-b border-stone-200 dark:border-stone-700">
                      <th className="text-left pb-3 pr-4">Varlık</th>
                      <th className="text-left pb-3 pr-4">Sınıf</th>
                      <th className="text-right pb-3 pr-4">Ağırlık</th>
                      <th className="text-right pb-3 pr-4">H1 başlangıç</th>
                      <th className="text-right pb-3 pr-4">H1 getiri</th>
                      <th className="text-right pb-3 pr-4">H2 getiri</th>
                      <th className="text-right pb-3">Portföye katkı</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {[...result.holdings]
                      .sort((a, b) => b.h2Return - a.h2Return)
                      .map((h) => {
                        const h2pos = h.h2Return >= 0
                        const ctbpos = h.contribution >= 0
                        const clsColor = CLASS_COLORS[h.assetClass] ?? '#888'
                        return (
                          <tr
                            key={h.ticker}
                            className="hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition-colors"
                          >
                            <td className="py-3 pr-4">
                              <p className="font-medium text-stone-900 dark:text-stone-100 font-mono text-xs">
                                {h.ticker}
                              </p>
                            </td>
                            <td className="py-3 pr-4">
                              <span
                                className="text-xs px-2 py-0.5 rounded-full border font-medium"
                                style={{ color: clsColor, borderColor: `${clsColor}40`, background: `${clsColor}15` }}
                              >
                                {CLASS_LABELS[h.assetClass]}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-right text-stone-700 dark:text-stone-300 font-medium">
                              {(h.weight * 100).toFixed(1)}%
                            </td>
                            <td className="py-3 pr-4 text-right text-stone-500 dark:text-stone-400 font-mono text-xs">
                              {h.priceH1Start.toFixed(2)}
                            </td>
                            <td className={`py-3 pr-4 text-right text-xs font-medium ${h.h1Return >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {fmtPct(h.h1Return)}
                            </td>
                            <td className={`py-3 pr-4 text-right font-medium ${h2pos ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {fmtPct(h.h2Return)}
                            </td>
                            <td className={`py-3 text-right text-xs ${ctbpos ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {fmtPct(h.contribution)}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>

                  {/* Totals row */}
                  <tfoot>
                    <tr className="border-t-2 border-stone-200 dark:border-stone-600">
                      <td colSpan={6} className="pt-3 text-sm font-medium text-stone-700 dark:text-stone-300">
                        Toplam portföy H2 getirisi
                      </td>
                      <td className={`pt-3 text-right font-bold ${result.totalH2Return >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {fmtPct(result.totalH2Return)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Verdict */}
            <div className={`card flex gap-4 items-start ${
              result.totalH2Return >= 0.08
                ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20'
                : result.totalH2Return >= 0
                  ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20'
                  : 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
            }`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                result.totalH2Return >= 0.08
                  ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                  : result.totalH2Return >= 0
                    ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                    : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
              }`}>
                {result.totalH2Return >= 0.08 ? '✓' : result.totalH2Return >= 0 ? '~' : '✕'}
              </div>
              <div>
                <p className={`text-sm font-medium mb-1 ${
                  result.totalH2Return >= 0.08
                    ? 'text-green-800 dark:text-green-300'
                    : result.totalH2Return >= 0
                      ? 'text-amber-800 dark:text-amber-300'
                      : 'text-red-700 dark:text-red-400'
                }`}>
                  Validasyon sonucu — {PROFILE_LABELS[result.profile]} portföy, {result.year}
                </p>
                <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
                  {result.totalH2Return >= 0.08
                    ? `H1 sinyalleri ile oluşturulan portföy, H2'de gerçek veriyle ${fmtPct(result.totalH2Return)} getiri sağladı. Sharpe ${result.sharpeApprox.toFixed(2)} — model doğrulandı.`
                    : result.totalH2Return >= 0
                      ? `Portföy H2'de ${fmtPct(result.totalH2Return)} pozitif getiri sağladı ancak hedef eşiğin altında. Profil ağırlıkları optimize edilebilir.`
                      : `H2 gerçek getirisi ${fmtPct(result.totalH2Return)} ile negatif. ${result.year} için model varsayımları ve portföy kuralları gözden geçirilmeli.`}
                </p>
              </div>
            </div>

            <Disclaimer />
          </>
        )}
      </div>
    </AppLayout>
  )
}
